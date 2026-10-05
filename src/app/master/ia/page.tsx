'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, ExternalLink, RefreshCw, Sparkles, Wallet, Zap } from 'lucide-react';
import { Empty, Field, Loading, PageHead, useToast } from '@/components/ui';
import { adminApi, errorMessage, type AiUsageSummary } from '@/lib/api';

// Gastos com IA (Sora): créditos colocados na Anthropic, gasto estimado pelos
// tokens de cada chamada e saldo. O valor oficial fica no console da Anthropic.

// Valores pequenos (centavos de dólar) precisam de mais casas para não virar US$ 0,00.
const usd = (value: number) => {
  const digits = Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits });
};
const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n));
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function MasterAiPage() {
  const toast = useToast();
  const [data, setData] = useState<AiUsageSummary | null>(null);
  const [credit, setCredit] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminApi.aiUsage()
      .then((d) => { setData(d); setCredit(String(d.creditUsd).replace('.', ',')); })
      .catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  async function saveCredit(e: FormEvent) {
    e.preventDefault();
    const value = Number(credit.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return toast('Informe um valor em dólares, ex.: 5 ou 12,50.', true);
    setSaving(true);
    try {
      await adminApi.updateSettings({ aiCreditCents: Math.round(value * 100) });
      toast('Créditos atualizados.');
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <Loading />;

  const usedPct = data.creditUsd > 0 ? Math.min(100, (data.spentUsd / data.creditUsd) * 100) : 0;
  const low = data.creditUsd > 0 && data.remainingUsd < data.creditUsd * 0.2;
  const metrics = [
    { label: 'Saldo estimado', value: usd(data.remainingUsd), hint: `de ${usd(data.creditUsd)} em créditos`, icon: Wallet },
    { label: 'Gasto total', value: usd(data.spentUsd), hint: `${data.calls} chamadas à IA`, icon: Zap },
    { label: 'Gasto no mês', value: usd(data.month.spentUsd), hint: `${data.month.calls} chamadas este mês`, icon: CalendarDays },
    { label: 'Média por chamada', value: usd(data.calls ? data.spentUsd / data.calls : 0), hint: `modelo ${data.model}`, icon: Sparkles },
  ];

  return (
    <>
      <PageHead
        eyebrow="Painel master"
        title="IA (Sora)"
        text="Quanto a Sora está gastando dos créditos da Anthropic. Valores estimados pelos tokens de cada chamada."
        actions={<button type="button" className="btn btn-outline" onClick={load}><RefreshCw size={15} />Atualizar</button>}
      />

      {!data.configured && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <strong>A Sora não está configurada.</strong>
          <p className="muted" style={{ marginTop: 4 }}>Coloque a ANTHROPIC_API_KEY no .env do backend (e no Render) e reinicie o servidor.</p>
        </div>
      )}

      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="card card-pad stack">
          <div><h3>Créditos na Anthropic</h3><small>Some aqui cada recarga feita no console, para o saldo continuar certo.</small></div>
          <div>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>{usedPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% usado</span>
              <span className="muted">{usd(data.spentUsd)} de {usd(data.creditUsd)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)} aria-label="Créditos usados">
              <div style={{ width: `${usedPct}%`, height: '100%', borderRadius: 999, background: 'var(--primary)' }} />
            </div>
            {low && <small style={{ display: 'block', marginTop: 8 }}>Saldo baixo: recarregue no console da Anthropic para a Sora não parar.</small>}
          </div>
          <form className="row" style={{ alignItems: 'flex-end', gap: 8 }} onSubmit={saveCredit}>
            <Field label="Total colocado (US$)">
              <input className="input" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="5,00" />
            </Field>
            <button className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Salvar'}</button>
          </form>
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }}>
            <ExternalLink size={14} />Ver saldo oficial no console
          </a>
        </div>

        <div className="card card-pad stack">
          <div><h3>Por empresa (este mês)</h3><small>Limite de {data.monthlyLimitPerCompany} pedidos à Sora por conta por mês (as empresas da mesma conta dividem).</small></div>
          {data.byCompany.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Empresa</th><th>Chamadas</th><th style={{ textAlign: 'right' }}>Gasto</th></tr></thead>
                <tbody>
                  {data.byCompany.map((c) => (
                    <tr key={c.companyId ?? 'sem-empresa'}><td>{c.name}</td><td>{c.calls}</td><td style={{ textAlign: 'right' }}>{usd(c.spentUsd)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Nenhuma empresa usou a Sora este mês.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ padding: '18px 22px' }}><div><h3>Últimas chamadas</h3><p>Cada mensagem enviada à Sora (uma nova tentativa automática conta como outra chamada).</p></div></div>
        {data.recent.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Quando</th><th>Empresa</th><th className="hide-mobile">Modelo</th><th className="hide-mobile">Tokens (entrada / saída)</th><th style={{ textAlign: 'right' }}>Custo</th></tr></thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{when(r.createdAt)}</td>
                    <td>{r.company}</td>
                    <td className="hide-mobile muted">{r.model}</td>
                    <td className="hide-mobile muted">{tokens(r.inputTokens)} / {tokens(r.outputTokens)}</td>
                    <td style={{ textAlign: 'right' }}>{usd(r.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={<Sparkles size={22} />} title="Nenhuma chamada ainda" />}
      </div>
    </>
  );
}
