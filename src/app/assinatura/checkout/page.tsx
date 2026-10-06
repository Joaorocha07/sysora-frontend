'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import {
  CardNumber,
  ExpirationDate,
  SecurityCode,
  createCardToken,
  initMercadoPago,
} from '@mercadopago/sdk-react';
import { ArrowLeft, Banknote, CalendarDays, Check, CheckCircle, Copy, CreditCard, Lock, QrCode, User } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { accountApi, errorMessage, subscriptionsApi, type BillingCycle, type PlanId, type PlanInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isValidCpf, maskCpf } from '@/lib/document';
import { money } from '@/lib/format';
import { YEARLY_DISCOUNT_PERCENT } from '@/lib/plans';
import { FormError, Loading } from '@/components/ui';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

type Tab = 'card' | 'pix';

// Os campos do cartão são iframes do Mercado Pago: não herdam o CSS da página,
// então as cores seguem o tema (data-theme no <html>) aqui.
type Theme = 'light' | 'dark';
const MP_STYLES = {
  light: { height: '42px', fontSize: '15px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#0a0a0a', placeholderColor: '#a3a3a3' },
  dark: { height: '42px', fontSize: '15px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f5f5f5', placeholderColor: '#737373' },
} as const;

function usePageTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// Parcelas do cartão no plano anual, como o Mercado Pago calcula para a bandeira/banco do cartão.
type CardInstallments = {
  paymentMethodId: string;
  issuerId?: string;
  options: { installments: number; label: string }[];
};

// Erro do número do cartão vindo do campo seguro do Mercado Pago.
type CardNumberError = 'incomplete' | 'invalid' | null;
type CardValidity = { errorMessages?: { cause?: string }[] };
const cardNumberError = (arg: CardValidity): CardNumberError => {
  const causes = (arg.errorMessages ?? []).map((e) => e.cause);
  if (!causes.length) return null;
  return causes.every((c) => c === 'invalid_length') ? 'incomplete' : 'invalid';
};

// Parcelas pela API pública do Mercado Pago (a mesma que o getInstallments do SDK
// usa). Chamada direta porque o SDK escreve "failed to get installments" no
// console quando o cartão não é reconhecido; aqui isso vira só `null`.
type MpInstallments = {
  payment_method_id: string;
  issuer?: { id?: string | number };
  payer_costs: { installments: number; recommended_message: string }[];
}[];

async function fetchInstallments(amountCents: number, bin: string): Promise<CardInstallments | null> {
  const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  if (!key) return null;
  const query = new URLSearchParams({ public_key: key, amount: String(amountCents / 100), bin, locale: 'pt-BR' });
  const res = await fetch(`https://api.mercadopago.com/v1/payment_methods/installments?${query}`);
  if (!res.ok) return null;
  const first = ((await res.json()) as MpInstallments)[0];
  if (!first?.payer_costs?.length) return null;
  return {
    paymentMethodId: first.payment_method_id,
    issuerId: first.issuer?.id ? String(first.issuer.id) : undefined,
    options: first.payer_costs
      .filter((c) => c.installments <= 12)
      .map((c) => ({ installments: c.installments, label: c.recommended_message })),
  };
}

const cyclePrice = (plan: PlanInfo, cycle: BillingCycle) => (cycle === 'YEARLY' ? plan.yearlyPriceCents : plan.priceCents);
const cycleSuffix = (cycle: BillingCycle) => (cycle === 'YEARLY' ? '/ano' : '/mês');

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, reloadSession } = useAuth();
  // Trocar o tema recria os campos do cartão (o Mercado Pago só aplica o estilo ao montar).
  const mpStyle = MP_STYLES[usePageTheme()];

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planId, setPlanId] = useState<PlanId>((params.get('plan') ?? 'INICIAL') as PlanId);
  const [cycle, setCycle] = useState<BillingCycle>(params.get('ciclo') === 'anual' ? 'YEARLY' : 'MONTHLY');
  const [bin, setBin] = useState<string | null>(null);
  const [cardInstallments, setCardInstallments] = useState<CardInstallments | null>(null);
  // O Mercado Pago não reconheceu os primeiros dígitos (ex.: cartão de teste com chave de produção).
  const [cardUnknown, setCardUnknown] = useState(false);
  const [cardError, setCardError] = useState<CardNumberError>(null);
  // Só mostra o erro depois que a pessoa sai do campo (enquanto digita o número fica incompleto).
  const [cardTouched, setCardTouched] = useState(false);

  // Callbacks estáveis: o campo do Mercado Pago é recriado (e apagado) quando uma prop muda.
  const onCardBin = useCallback((e: { bin?: string | null } | undefined) => setBin(e?.bin ?? null), []);
  const onCardValidity = useCallback((e: CardValidity) => setCardError(cardNumberError(e)), []);
  const onCardBlur = useCallback(() => setCardTouched(true), []);
  const [tab, setTab] = useState<Tab>('card');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  // Cartão aceito, mas o MP ainda está processando a primeira cobrança.
  const [pending, setPending] = useState(false);

  const [cardholderName, setCardholderName] = useState('');
  const [cpf, setCpf] = useState('');
  const [installments, setInstallments] = useState(1);

  const [pixData, setPixData] = useState<{ paymentId: string; qrCode: string; qrCodeBase64: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const price = plan ? cyclePrice(plan, cycle) : 0;

  // Proteção de rota
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    accountApi.get()
      .then((d) => setPlans(d.plans))
      .catch(() => router.push('/assinatura'));
  }, [router]);

  function selectPlan(id: PlanId, nextCycle = cycle) {
    setPlanId(id);
    setCycle(nextCycle);
    setPixData(null);
    setError(null);
    router.replace(`/assinatura/checkout?plan=${id}${nextCycle === 'YEARLY' ? '&ciclo=anual' : ''}`, { scroll: false });
  }

  // Anual: com os primeiros dígitos do cartão, busca no Mercado Pago a bandeira e as parcelas.
  useEffect(() => {
    setCardInstallments(null);
    setCardUnknown(false);
    setInstallments(1);
    if (cycle !== 'YEARLY' || !bin || !price) return;
    let alive = true;
    fetchInstallments(price, bin)
      .then((result) => {
        if (!alive) return;
        if (result) setCardInstallments(result);
        else setCardUnknown(true);
      })
      .catch(() => { if (alive) setCardUnknown(true); });
    return () => { alive = false; };
  }, [cycle, bin, price]);

  useEffect(() => {
    if (!pixData) return;
    const timer = setInterval(async () => {
      try {
        const res = await subscriptionsApi.pixStatus(pixData.paymentId);
        if (res.paid) {
          clearInterval(timer);
          setSuccess(true);
          await reloadSession();
          setTimeout(() => router.push('/assinatura'), 3000);
        }
      } catch { /* continua */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [pixData, reloadSession, router]);

  async function submitCard(e: FormEvent) {
    e.preventDefault();
    if (!plan || !user) return;
    if (cardError) { setCardTouched(true); return; }
    setBusy(true);
    setError(null);
    try {
      const token = await createCardToken({
        cardholderName,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      });
      if (!token?.id) throw new Error('Não foi possível tokenizar o cartão. Verifique os dados e tente novamente.');
      if (cycle === 'YEARLY' && !cardInstallments) throw new Error('O Mercado Pago não reconheceu este cartão. Confira o número ou pague com Pix.');
      const result = await subscriptionsApi.checkout({
        cardTokenId: token.id, payerEmail: user.email, plan: plan.id, cycle,
        ...(cycle === 'YEARLY' && cardInstallments
          ? { installments, paymentMethodId: cardInstallments.paymentMethodId, issuerId: cardInstallments.issuerId }
          : {}),
      });
      setPending(result.pending);
      setSuccess(true);
      await reloadSession();
      setTimeout(() => router.push('/assinatura'), 3000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function generatePix() {
    if (!plan || !user) return;
    setBusy(true);
    setError(null);
    try {
      const pix = await subscriptionsApi.generatePix({ plan: plan.id, cycle, payerEmail: user.email });
      setPixData(pix);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function copyPix() {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.qrCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2500);
  }

  if (status === 'loading' || !plan) return <Loading />;

  if (success) {
    return (
      <div className="auth">
        <aside className="auth-side">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sysora-icon-white.png" alt="" className="art" aria-hidden />
          <Logo kind="wordmark" tone="white" height={28} />
          <div style={{ flex: 1 }} />
          <small style={{ color: '#5c5c5c' }}>© {new Date().getFullYear()} Sysora</small>
        </aside>
        <main className="auth-main">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', width: 'min(420px, 100%)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary)', display: 'grid', placeItems: 'center', color: 'var(--on-primary)' }}>
              <CheckCircle size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: 26, marginBottom: 8 }}>{pending ? 'Pagamento em análise' : 'Pagamento confirmado!'}</h2>
              <p className="muted">
                {pending
                  ? `Seu plano ${plan.name} será ativado assim que o Mercado Pago confirmar a cobrança. Redirecionando para sua conta...`
                  : `Plano ${plan.name}${cycle === 'YEARLY' ? ' anual' : ''} ativo. Redirecionando para sua conta...`}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth checkout-page">

      {/* ── PAINEL ESQUERDO (escuro) ── */}
      <aside className="auth-side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/sysora-icon-white.png" alt="" className="art" aria-hidden />

        {/* Logo + voltar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo kind="wordmark" tone="white" height={26} />
          <Link
            href="/assinatura"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500, textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />Voltar
          </Link>
        </div>

        {/* Título */}
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>
            Escolha seu plano
          </span>
          <h2 style={{ fontSize: 28, lineHeight: 1.1, maxWidth: 320 }}>
            Simples, transparente, sem fidelidade.
          </h2>
        </div>

        {/* Seletor de planos — grid 1fr 1fr */}
        {plans.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {plans.map((p) => {
              const active = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPlan(p.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '18px 16px', borderRadius: 20, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${active ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.14)'}`,
                    background: active ? 'rgba(255,255,255,.09)' : 'transparent',
                    color: 'inherit', transition: 'all .15s',
                    boxShadow: active ? '0 0 0 3px rgba(255,255,255,.12)' : 'none',
                  }}
                >
                  <strong style={{ fontFamily: 'var(--display)', fontSize: 15 }}>{p.name}</strong>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.4 }}>
                    {p.maxCompanies === 1 ? '1 empresa' : `${p.maxCompanies} empresas`}<br />
                    até {p.maxEmployees} func.
                  </span>
                  <div style={{ marginTop: 4 }}>
                    <strong style={{ fontFamily: 'var(--display)', fontSize: 20 }}>{money(cyclePrice(p, cycle))}</strong>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{cycleSuffix(cycle)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Features do plano selecionado */}
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>
            Incluso no plano {plan.name}
          </span>
          {plan.features.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', marginTop: 1 }}>
                <Check size={11} />
              </div>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,.72)' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
          <Lock size={12} />
          Cancele quando quiser · sem taxa de setup
        </div>
      </aside>

      {/* ── PAINEL DIREITO (formulário) ── */}
      <main className="auth-main">
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10 }}><ThemeToggle /></div>

        <div style={{ width: 'min(520px, 100%)', display: 'grid', gap: 24 }}>

          {/* Celular: o painel escuro some, então o voltar e a troca de plano ficam aqui. */}
          <div className="checkout-mobile">
            <Link href="/assinatura" className="checkout-back"><ArrowLeft size={14} />Voltar</Link>
            {plans.length > 1 && (
              <div className="checkout-plans">
                {plans.map((p) => (
                  <button key={p.id} type="button" className={p.id === planId ? 'active' : ''} onClick={() => selectPlan(p.id)}>
                    <strong>{p.name}</strong>
                    <span>{money(cyclePrice(p, cycle))}{cycleSuffix(cycle)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Complete seu pedido
            </div>
            <h2 style={{ fontSize: 22 }}>
              Plano {plan.name}{' '}
              <span style={{ fontWeight: 400, fontSize: 16, color: 'var(--muted)' }}>
                · {money(price)}{cycleSuffix(cycle)}
              </span>
            </h2>
            {cycle === 'YEARLY' && (
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Equivale a {money(Math.round(price / 12))}/mês · você economiza {money(plan.priceCents * 12 - price)} no ano
              </p>
            )}
          </div>

          <div className="checkout-cycle" role="radiogroup" aria-label="Forma de cobrança">
            {(['MONTHLY', 'YEARLY'] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cycle === c} className={cycle === c ? 'active' : ''} onClick={() => selectPlan(planId, c)}>
                {c === 'MONTHLY' ? 'Mensal' : 'Anual'}
                {c === 'YEARLY' && <span className="checkout-cycle-off">-{YEARLY_DISCOUNT_PERCENT}%</span>}
              </button>
            ))}
          </div>

          <div>
            {/* Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--line)', marginBottom: 28 }}>
              {(['card', 'pix'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(null); setPixData(null); }}
                  style={{
                    padding: '14px 0', border: 'none', borderRadius: 0, background: 'transparent',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    color: tab === t ? 'var(--ink)' : 'var(--muted)',
                    borderBottom: `2px solid ${tab === t ? 'var(--ink)' : 'transparent'}`,
                    transition: 'color .15s',
                  }}
                >
                  {t === 'card' ? 'Cartão de crédito' : 'PIX'}
                </button>
              ))}
            </div>

            <div>
              <FormError message={error} />

              {/* ── CARTÃO ── */}
              {tab === 'card' && (
                <form onSubmit={submitCard} className="stack" style={{ marginTop: error ? 16 : 0 }}>
                  <label className="field">
                    <span>Número do cartão</span>
                    <div className="input-icon">
                      <CreditCard size={17} />
                      <div className="input checkout-secure-field">
                        <CardNumber
                          placeholder="1234 5678 9012 3456"
                          style={mpStyle}
                          enableLuhnValidation
                          onBinChange={onCardBin}
                          onValidityChange={onCardValidity}
                          onBlur={onCardBlur}
                        />
                      </div>
                    </div>
                    {cardTouched && cardError === 'invalid' && <small className="field-error">Número de cartão inválido. Confira os dígitos.</small>}
                    {cardTouched && cardError === 'incomplete' && <small className="field-error">Número do cartão incompleto.</small>}
                    {!cardError && cardUnknown && <small className="field-error">O Mercado Pago não reconheceu este cartão. Confira o número ou pague com Pix.</small>}
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span>Validade</span>
                      <div className="input-icon">
                        <CalendarDays size={17} />
                        <div className="input checkout-secure-field">
                          <ExpirationDate placeholder="MM/AA" style={mpStyle} />
                        </div>
                      </div>
                    </label>
                    <label className="field">
                      <span>CVV</span>
                      <div className="input-icon">
                        <Lock size={17} />
                        <div className="input checkout-secure-field">
                          <SecurityCode placeholder="123" style={mpStyle} />
                        </div>
                      </div>
                    </label>
                  </div>
                  {/* Parcelas só no anual: a assinatura mensal do Mercado Pago não parcela. */}
                  {cycle === 'YEARLY' && (
                    <label className="field">
                      <span>Parcelas</span>
                      <div className="input-icon">
                        <Banknote size={17} />
                        <select
                          className="select"
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          disabled={!cardInstallments}
                          style={{ paddingLeft: 44 }}
                        >
                          {cardInstallments
                            ? cardInstallments.options.map((o) => <option key={o.installments} value={o.installments}>{o.label}</option>)
                            : <option value={1}>{cardUnknown ? 'Cartão não reconhecido' : bin ? 'Buscando parcelas...' : 'Digite o número do cartão para ver as parcelas'}</option>}
                        </select>
                      </div>
                    </label>
                  )}
                  <label className="field">
                    <span>Nome no cartão</span>
                    <div className="input-icon">
                      <User size={17} />
                      <input
                        className="input"
                        placeholder="NOME SOBRENOME"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>CPF do titular</span>
                    <div className="input-icon">
                      <User size={17} />
                      <input
                        className="input"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => setCpf(maskCpf(e.target.value))}
                        required
                        aria-invalid={cpf.length === 14 && !isValidCpf(cpf)}
                      />
                    </div>
                    {cpf.length === 14 && !isValidCpf(cpf) && <small className="field-error">CPF inválido: confira os números.</small>}
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-block"
                    style={{ marginTop: 8 }}
                    disabled={busy}
                  >
                    {busy && <span className="spinner" />}
                    {cycle === 'YEARLY' ? `Pagar ${money(price)} · 12 meses` : `Assinar · ${money(price)}/mês`}
                  </button>
                </form>
              )}

              {/* ── PIX ── */}
              {tab === 'pix' && (
                <div className="stack" style={{ marginTop: error ? 16 : 0 }}>
                  {!pixData ? (
                    <>
                      <p className="muted" style={{ fontSize: 13 }}>
                        {cycle === 'YEARLY'
                          ? 'Acesso liberado em minutos após a confirmação, por 12 meses. Perto do vencimento é só pagar de novo.'
                          : 'Acesso liberado em minutos após a confirmação. A renovação é manual todo mês.'}
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-lg btn-block"
                        onClick={generatePix}
                        disabled={busy}
                        style={{ gap: 10 }}
                      >
                        {busy ? <span className="spinner" /> : <QrCode size={18} />}
                        Gerar QR Code · {money(price)}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
                        {pixData.qrCodeBase64 && (
                          <img
                            src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`}
                            alt="QR Code PIX"
                            style={{ width: 188, height: 188, borderRadius: 12, border: '1px solid var(--line)' }}
                          />
                        )}
                        <p className="muted" style={{ fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
                          Escaneie com o app do seu banco ou copie a chave abaixo
                        </p>
                      </div>
                      <label className="field">
                        <span>Chave PIX copia e cola</span>
                        <div className="row" style={{ gap: 8 }}>
                          <input className="input" readOnly value={pixData.qrCode} style={{ fontSize: 11, flex: 1 }} />
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={copyPix}
                            style={{ flexShrink: 0, gap: 6, height: 44, borderRadius: 14 }}
                          >
                            {pixCopied ? <Check size={15} /> : <Copy size={15} />}
                            {pixCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </label>
                      <div className="row" style={{ justifyContent: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                        Aguardando confirmação do pagamento...
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--faint)', fontSize: 12 }}>
            <Lock size={13} />
            Dados criptografados · processado pelo Mercado Pago
          </div>

        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CheckoutContent />
    </Suspense>
  );
}
