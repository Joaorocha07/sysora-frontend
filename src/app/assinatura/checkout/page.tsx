'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
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
import { accountApi, errorMessage, subscriptionsApi, type PlanId, type PlanInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { FormError, Loading } from '@/components/ui';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

type Tab = 'card' | 'pix';

function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mpStyle: any = {
  base: {
    width: '100%',
    height: '42px',
    fontSize: '15px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#0a0a0a',
  },
  placeholder: { color: '#a3a3a3' },
};

// Juros compostos (Tabela Price) com 2,49% a.m. — taxa padrão MP Brasil.
function installmentAmount(priceCents: number, n: number): number {
  if (n === 1) return priceCents;
  const r = 0.0249;
  const coef = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.ceil(priceCents * coef);
}

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, reloadSession } = useAuth();

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planId, setPlanId] = useState<PlanId>((params.get('plan') ?? 'INICIAL') as PlanId);
  const [tab, setTab] = useState<Tab>('card');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const [cardholderName, setCardholderName] = useState('');
  const [cpf, setCpf] = useState('');
  const [installments, setInstallments] = useState(1);

  const [pixData, setPixData] = useState<{ paymentId: string; qrCode: string; qrCodeBase64: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;

  // Proteção de rota
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    accountApi.get()
      .then((d) => setPlans(d.plans))
      .catch(() => router.push('/assinatura'));
  }, [router]);

  function selectPlan(id: PlanId) {
    setPlanId(id);
    setPixData(null);
    setError(null);
    router.replace(`/assinatura/checkout?plan=${id}`, { scroll: false });
  }

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
    setBusy(true);
    setError(null);
    try {
      const token = await createCardToken({
        cardholderName,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      });
      if (!token?.id) throw new Error('Não foi possível tokenizar o cartão. Verifique os dados e tente novamente.');
      const paymentMethodId = (token as Record<string, unknown>).payment_method_id as string | undefined;
      await subscriptionsApi.checkout({ cardTokenId: token.id, payerEmail: user.email, plan: plan.id, installments, paymentMethodId });
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
      const pix = await subscriptionsApi.generatePix({ plan: plan.id, payerEmail: user.email });
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
              <h2 style={{ fontSize: 26, marginBottom: 8 }}>Pagamento confirmado!</h2>
              <p className="muted">Plano {plan.name} ativo. Redirecionando para sua conta...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth" style={{ gridTemplateColumns: '1fr 1.1fr' }}>

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
                    <strong style={{ fontFamily: 'var(--display)', fontSize: 20 }}>{money(p.priceCents)}</strong>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>/mês</span>
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

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Complete seu pedido
            </div>
            <h2 style={{ fontSize: 22 }}>
              Plano {plan.name}{' '}
              <span style={{ fontWeight: 400, fontSize: 16, color: 'var(--muted)' }}>
                · {money(plan.priceCents)}/mês
              </span>
            </h2>
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
                        <CardNumber placeholder="1234 5678 9012 3456" style={mpStyle} />
                      </div>
                    </div>
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
                  {plan && (
                    <label className="field">
                      <span>Parcelas</span>
                      <div className="input-icon">
                        <Banknote size={17} />
                        <select
                          className="select"
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          style={{ paddingLeft: 44 }}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                            const per = installmentAmount(plan.priceCents, n);
                            const total = per * n;
                            return (
                              <option key={n} value={n}>
                                {n === 1
                                  ? `1x de ${money(per)} sem juros`
                                  : `${n}x de ${money(per)} (total ${money(total)}) com juros`}
                              </option>
                            );
                          })}
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
                      />
                    </div>
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-block"
                    style={{ marginTop: 8 }}
                    disabled={busy}
                  >
                    {busy && <span className="spinner" />}
                    Assinar · {money(plan.priceCents)}/mês
                  </button>
                </form>
              )}

              {/* ── PIX ── */}
              {tab === 'pix' && (
                <div className="stack" style={{ marginTop: error ? 16 : 0 }}>
                  {!pixData ? (
                    <>
                      <p className="muted" style={{ fontSize: 13 }}>
                        Acesso liberado em minutos após a confirmação. A renovação é manual todo mês.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-lg btn-block"
                        onClick={generatePix}
                        disabled={busy}
                        style={{ gap: 10 }}
                      >
                        {busy ? <span className="spinner" /> : <QrCode size={18} />}
                        Gerar QR Code · {money(plan.priceCents)}
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
