'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, Check, Copy, CreditCard, ExternalLink, Link2Off, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui';
import {
  errorMessage, whatsappApi, type WhatsAppCloudConfig, type WhatsAppCloudInfo, type WhatsAppStatus, type WhatsAppTemplateStatus,
  type WhatsAppUsage,
} from '@/lib/api';
import { monthLabel } from '@/lib/format';
import { SignupCancelled, startWhatsAppSignup } from '@/lib/metaSignup';

// Conexão pela API oficial do WhatsApp (Cloud API da Meta) pelo popup da Meta
// (cadastro incorporado). Só aparece liberada quando o servidor tem o app da
// Meta da Sysora configurado (passo a passo em /master/whatsapp). A Meta
// cobra as mensagens direto da empresa.

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const unitPrice = (brl: number) => brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3 });

export function formatWaPhone(phone: string | null) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return `+${d}`;
}

const TEMPLATE_LABELS: Record<string, { label: string; badge: string }> = {
  APPROVED: { label: 'Aprovado', badge: 'solid' },
  PENDING: { label: 'Em análise', badge: '' },
  IN_APPEAL: { label: 'Em recurso', badge: '' },
  REJECTED: { label: 'Recusado', badge: 'strike' },
  PAUSED: { label: 'Pausado', badge: 'dashed' },
  DISABLED: { label: 'Desativado', badge: 'strike' },
  MISSING: { label: 'Não criado', badge: 'dashed' },
};
const templateLabel = (status: WhatsAppTemplateStatus) => TEMPLATE_LABELS[status] ?? { label: status, badge: 'dashed' };

// ============ Conectar ============

const COSTS = (
  <div className="phone-preview">
    <small className="eyebrow">Custos da Meta (cobrados no seu cartão)</small>
    <span style={{ fontSize: 13 }}>
      <strong>1.000 mensagens de atendimento grátis por mês</strong> (respostas do bot e da equipe até 24 h depois da mensagem do cliente). Depois disso, cerca de R$ 0,035 por mensagem.
      Lembretes enviados fora de uma conversa custam cerca de R$ 0,035 cada. A Sysora não cobra nada a mais por isso.
    </span>
  </div>
);

export function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiado.`);
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie.', true);
    }
  }
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" readOnly value={value} onFocus={(e) => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        <button type="button" className="icon-btn bordered" onClick={copy} aria-label={`Copiar ${label}`}><Copy size={15} /></button>
      </div>
    </div>
  );
}

const NUMBER_OPTIONS = [
  {
    coexistence: true,
    title: 'O número que já uso no WhatsApp Business',
    text: 'Você continua atendendo pelo app no celular junto com o bot. Grupos e listas de transmissão deixam de funcionar nesse número.',
  },
  {
    coexistence: false,
    title: 'Um número novo (sem WhatsApp)',
    text: 'O número funciona só pela Sysora: você e a equipe respondem os clientes pela tela de Conversas.',
  },
];

function PopupConnect({ config, onConnected }: { config: WhatsAppCloudConfig; onConnected: (state: WhatsAppStatus) => void }) {
  const toast = useToast();
  const [coexistence, setCoexistence] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const signup = await startWhatsAppSignup(config, coexistence);
      onConnected(await whatsappApi.cloudOnboard(signup));
    } catch (err) {
      if (err instanceof SignupCancelled) toast(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="field">
        <span>Qual número você vai conectar?</span>
        <div className="grid-2">
          {NUMBER_OPTIONS.map((option) => (
            <label key={String(option.coexistence)} className="phone-preview" style={{ cursor: 'pointer', outline: coexistence === option.coexistence ? '2px solid var(--ink)' : undefined }}>
              <span className="row" style={{ gap: 8 }}>
                <input type="radio" name="numero" checked={coexistence === option.coexistence} onChange={() => setCoexistence(option.coexistence)} />
                <strong>{option.title}</strong>
              </span>
              <small className="muted">{option.text}</small>
            </label>
          ))}
        </div>
        {coexistence && (
          <small className="hint">
            Usa o WhatsApp comum (não o Business)? Instale o <strong>WhatsApp Business</strong> no celular e entre com o mesmo número antes de conectar: é grátis e as conversas vêm junto.
          </small>
        )}
      </div>

      <ol className="steps">
        <li><span>Clique em <strong>Conectar com a Meta</strong> e entre com o seu Facebook. Tenha o celular do número em mãos (leva uns 5 minutos).</span></li>
        <li><span>Escolha a sua empresa na Meta ou crie uma com o nome do seu negócio.</span></li>
        {coexistence ? (
          <>
            <li><span>Escolha <strong>conectar o app WhatsApp Business</strong> e informe o número.</span></li>
            <li><span>No celular, abra o <strong>WhatsApp Business</strong> e confirme a conexão na mensagem que chegar.</span></li>
          </>
        ) : (
          <li><span>Informe o <strong>número</strong> e o nome que os clientes vão ver, e confirme com o código que chega por SMS ou ligação.</span></li>
        )}
        <li><span>Pronto! Volte para cá: a Sysora mostra o que falta (como cadastrar o cartão na Meta).</span></li>
      </ol>

      {error && <p className="form-error"><AlertTriangle size={16} />{error}</p>}

      <div className="row-wrap">
        <button type="button" className="btn btn-primary" onClick={connect} disabled={busy}>
          {busy ? <span className="spinner" /> : <ShieldCheck size={16} />}
          {busy ? 'Conectando...' : 'Conectar com a Meta'}
        </button>
      </div>
    </div>
  );
}

// Só é exibido quando o app da Meta da Sysora está configurado (config.enabled).
export function OfficialConnect({ config, onConnected }: { config: WhatsAppCloudConfig; onConnected: (state: WhatsAppStatus) => void }) {
  return (
    <div className="card card-pad stack">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 10 }}>
          <ShieldCheck size={22} />
          <h3>WhatsApp oficial (API da Meta)</h3>
        </div>
        <span className="badge solid">Recomendado</span>
      </div>
      <p className="muted">
        Conexão oficial e segura, sem risco de bloqueio do número e sem depender de um celular ligado. Você entra com a sua conta da Meta e o número continua sendo seu.
      </p>

      {COSTS}

      <PopupConnect config={config} onConnected={onConnected} />
    </div>
  );
}

// ============ Conectado ============

function UsageCard() {
  const [usage, setUsage] = useState<WhatsAppUsage | null>(null);
  useEffect(() => { whatsappApi.cloudUsage().then(setUsage).catch(() => {}); }, []);
  if (!usage) return null;

  const pct = usage.freeLimit ? Math.min(100, (usage.freeUsed / usage.freeLimit) * 100) : 100;
  const month = monthLabel(`${usage.month}-01`);
  const rows = [
    { label: 'Atendimento (respostas do bot e da equipe)', ...usage.service, price: usage.prices.service },
    { label: 'Utilidade (lembretes fora da conversa)', ...usage.utility, price: usage.prices.utility },
    { label: 'Marketing', ...usage.marketing, price: usage.prices.marketing },
    { label: 'Autenticação', ...usage.authentication, price: usage.prices.authentication },
  ].filter((r, i) => i < 2 || r.total > 0);

  return (
    <div className="card card-pad stack">
      <div>
        <h3>Consumo de {month}</h3>
        <small className="muted">Mensagens entregues por este número. A cota grátis renova no dia 1º.</small>
      </div>
      <div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
          <span><strong>{usage.freeUsed.toLocaleString('pt-BR')}</strong> de {usage.freeLimit.toLocaleString('pt-BR')} mensagens grátis usadas</span>
          <span className="muted">{Math.round(pct)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Mensagens grátis usadas">
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} />
        </div>
        {pct >= 80 && (
          <small style={{ display: 'block', marginTop: 8 }}>
            {pct >= 100 ? 'A cota grátis do mês acabou: as próximas mensagens de atendimento são cobradas pela Meta.' : 'A cota grátis está perto do fim. Depois dela, a Meta cobra cada mensagem de atendimento.'}
          </small>
        )}
      </div>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        {rows.map((r) => (
          <div key={r.label} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>{r.label}</span>
            <span className="muted" style={{ whiteSpace: 'nowrap' }}>{r.total.toLocaleString('pt-BR')} · {r.billable.toLocaleString('pt-BR')} cobradas × {unitPrice(r.price)}</span>
          </div>
        ))}
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Estimativa do mês (cobrada pela Meta)</strong>
          <strong>{money(usage.estimatedCents)}</strong>
        </div>
        <small className="hint">Valor aproximado pela tabela de preços da Meta para o Brasil. O valor oficial fica no WhatsApp Manager.</small>
      </div>
    </div>
  );
}

type Step = { done: boolean | null; title: string; text: ReactNode };

const NAME_STATUS: Record<string, string> = {
  APPROVED: 'aprovado', AVAILABLE_WITHOUT_REVIEW: 'aprovado', PENDING_REVIEW: 'em análise pela Meta', DECLINED: 'recusado pela Meta', EXPIRED: 'expirado', NONE: 'em análise pela Meta',
};

// O que falta para o número funcionar por completo, na ordem em que o cliente resolve.
function SetupChecklist({ info, onRefresh, refreshing }: { info: WhatsAppCloudInfo; onRefresh: () => void; refreshing: boolean }) {
  const { health } = info;
  const link = (label: string) => <a href={info.managerUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{label}</a>;
  const nameOk = health.nameStatus ? ['APPROVED', 'AVAILABLE_WITHOUT_REVIEW'].includes(health.nameStatus) : null;
  const templatesOk = info.templates.every((t) => t.status === 'APPROVED');
  const steps: Step[] = [
    { done: true, title: 'Número conectado', text: 'O bot já responde quem mandar mensagem para este número.' },
    {
      done: health.paymentConfigured,
      title: 'Forma de pagamento na Meta',
      text: health.paymentConfigured
        ? 'Cartão cadastrado: a Meta cobra direto de você o que passar da cota grátis.'
        : <>
            {health.paymentConfigured === null ? 'Não foi possível consultar a Meta agora. Confira se já tem um cartão cadastrado: sem' : 'Sem'} cartão, os lembretes e as mensagens além das 1.000 grátis do mês não são entregues.
            {' '}No {link('WhatsApp Manager')}, abra <strong>Configurações da conta → Pagamentos</strong> e adicione um cartão.
          </>,
    },
    {
      done: nameOk,
      title: 'Nome de exibição',
      text: health.nameStatus === 'DECLINED'
        ? <>A Meta recusou o nome “{info.verifiedName}”. Use o nome da empresa como aparece na fachada ou no site e peça de novo no {link('WhatsApp Manager')}.</>
        : <>“{info.verifiedName ?? 'Nome da empresa'}” {health.nameStatus ? NAME_STATUS[health.nameStatus] ?? health.nameStatus.toLowerCase() : 'aguardando a Meta'}. {nameOk ? '' : 'Enquanto isso o bot funciona normalmente; o nome aparece para os clientes depois da aprovação.'}</>,
    },
    {
      done: templatesOk,
      title: 'Templates dos lembretes',
      text: templatesOk ? 'Aprovados: os lembretes saem mesmo quando o cliente não conversou nas últimas 24 horas.' : 'Em análise pela Meta (costuma levar de minutos a algumas horas). Até lá, os lembretes só saem para quem conversou nas últimas 24 horas.',
    },
    {
      done: Boolean(info.lastWebhookAt),
      title: 'Teste com o seu celular',
      text: info.lastWebhookAt ? 'Mensagens chegando normalmente.' : 'Mande um “oi” do seu celular (de outro número) para o WhatsApp da empresa: o bot responde na hora.',
    },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <div className="card card-pad stack">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>Primeiros passos</h3>
          <small className="muted">{steps.filter((s) => s.done).length} de {steps.length} concluídos</small>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <span className="spinner" /> : <RefreshCw size={14} />}Atualizar situação
        </button>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {steps.map((s) => (
          <div key={s.title} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <span className={`check${s.done ? ' done' : ''}`}>{s.done ? <Check size={14} /> : null}</span>
            <span style={{ fontSize: 14 }}>
              <strong>{s.title}</strong>
              <small style={{ display: 'block', marginTop: 2, color: 'var(--muted)' }}>{s.text}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OfficialConnected({ state, onChange, onDisconnect, busy }: {
  state: WhatsAppStatus; onChange: (state: WhatsAppStatus) => void; onDisconnect: () => void; busy: boolean;
}) {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const info = state.cloud!;

  const syncTemplates = useCallback(async () => {
    setSyncing(true);
    try { onChange(await whatsappApi.cloudTemplates()); } catch (err) { toast(errorMessage(err), true); } finally { setSyncing(false); }
  }, [onChange, toast]);

  const pending = info.templates.some((t) => t.status !== 'APPROVED');

  return (
    <div className="stack">
      <div className="card card-pad stack">
        <div>
          <div className="status-line"><span className="status-dot on" />Conectado pelo WhatsApp oficial</div>
          <h2 style={{ marginTop: 10, fontSize: 24 }}>{formatWaPhone(info.phone)}</h2>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            {info.verifiedName && <span className="badge plain soft"><BadgeCheck size={13} />{info.verifiedName}</span>}
            <span className="badge plain soft">{info.coexistence ? 'Também no app WhatsApp Business' : 'Somente pela API'}</span>
          </div>
        </div>

        {info.lastError && (
          <p className="form-error">
            <AlertTriangle size={16} />
            <span>{info.lastError} <a href={info.managerUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Abrir o WhatsApp Manager</a></span>
          </p>
        )}

        <p className="muted">
          O bot responde as mensagens deste número. Para testar, mande um “oi” do seu celular para ele.
          {info.coexistence ? ' Quando alguém da equipe responde pelo app no celular, o bot pausa com aquele cliente.' : ''}
        </p>

        <div className="row-wrap">
          <a className="btn btn-outline" href={info.managerUrl} target="_blank" rel="noreferrer"><CreditCard size={15} />Pagamento e conta na Meta<ExternalLink size={13} /></a>
          <button type="button" className="btn btn-danger" onClick={onDisconnect} disabled={busy}><Link2Off size={15} />Desconectar</button>
        </div>
      </div>

      <SetupChecklist info={info} onRefresh={syncTemplates} refreshing={syncing} />

      <UsageCard />

      <div className="card card-pad stack">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3>Templates dos lembretes</h3>
            <small className="muted">A Meta só deixa a empresa puxar conversa com mensagens aprovadas por ela.</small>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={syncTemplates} disabled={syncing}>
            {syncing ? <span className="spinner" /> : <RefreshCw size={14} />}Atualizar situação
          </button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {info.templates.map((t) => {
            const s = templateLabel(t.status);
            return (
              <div key={t.name} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                <span>{t.label}</span>
                <span className={`badge ${s.badge}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
        <small className="hint">
          Se o cliente conversou nas últimas 24 horas, o lembrete sai com o texto que você escreveu em Lembretes. Fora disso, sai pelo template aprovado.
          {pending ? ' Enquanto um template estiver em análise, esse lembrete espera a aprovação (costuma levar de minutos a algumas horas).' : ''}
        </small>
      </div>
    </div>
  );
}
