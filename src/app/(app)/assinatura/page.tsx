'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, CreditCard, MessageCircle, Plus, Sparkles } from 'lucide-react';
import PlanCard from '@/components/PlanCard';
import { ConfirmDialog, Field, FormError, Loading, Modal, PageHead, useToast } from '@/components/ui';
import { accountApi, errorMessage, type AccountOverview, type PlanInfo, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { brDate, money } from '@/lib/format';

// Link de contato para pagamento (WhatsApp, página de checkout...). Opcional.
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL;

function statusText(s: Subscription): string {
  const date = (value: string | null) => (value ? brDate(value.slice(0, 10)) : '');
  if (s.status === 'TRIAL') return s.active ? `Teste grátis até ${date(s.trialEndsAt)}` : `Teste grátis encerrado em ${date(s.trialEndsAt)}`;
  if (s.status === 'ACTIVE') return s.paidUntil ? `Ativa · pago até ${date(s.paidUntil)}` : 'Ativa';
  if (s.status === 'PAST_DUE') return s.active ? `Pagamento pendente desde ${date(s.paidUntil)}` : 'Bloqueada por falta de pagamento';
  return 'Cancelada';
}

function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const company = await accountApi.createCompany(name);
      onCreated(company.id, company.name);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nova empresa"
      description="Ela terá clientes, agenda, serviços, equipe e o próprio número de WhatsApp, separados da empresa atual."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="new-company" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Criar e abrir</button>
      </>}
    >
      <form id="new-company" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Nome da empresa"><input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Studio Aurora Centro" /></Field>
      </form>
    </Modal>
  );
}

export default function AssinaturaPage() {
  const router = useRouter();
  const toast = useToast();
  const { isAdmin, company, switchCompany, reloadSession } = useAuth();
  const [data, setData] = useState<AccountOverview | null>(null);
  const [changing, setChanging] = useState<PlanInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    accountApi.get().then(setData).catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  async function changePlan() {
    if (!changing) return;
    setBusy(true);
    try {
      await accountApi.changePlan(changing.id);
      toast(`Plano alterado para ${changing.name}.`);
      setChanging(null);
      await reloadSession();
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function open(companyId: string, name?: string) {
    try {
      await switchCompany(companyId);
      if (name) toast(`Agora em ${name}`);
      router.push('/painel');
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  if (!data) return <Loading />;
  const sub = data.subscription;

  if (!isAdmin) {
    return (
      <>
        <PageHead eyebrow="Assinatura" title="Assinatura da empresa" />
        <div className="card card-pad stack" style={{ maxWidth: 560 }}>
          <span className={`badge ${sub.active ? 'soft' : 'solid'}`} style={{ justifySelf: 'start' }}>{statusText(sub)}</span>
          <p className="muted">{sub.active ? `Sua empresa usa o plano ${sub.planName}.` : 'O acesso está suspenso até a assinatura ser regularizada. Avise o administrador da empresa.'}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Assinatura" title={`Plano ${sub.planName}`} text="Seu plano, suas empresas e os números de WhatsApp de cada uma." />

      <div className="card card-pad row-wrap" style={{ gap: 20, marginBottom: 20 }}>
        <span className="metric-icon" style={{ width: 48, height: 48, borderRadius: 16 }}><CreditCard size={20} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ display: 'block', fontSize: 18, fontFamily: 'var(--display)' }}>{money(sub.priceCents)}/mês</strong>
          <small>{statusText(sub)} · {sub.maxCompanies === 1 ? '1 empresa' : `até ${sub.maxCompanies} empresas`} · administrador + até {sub.maxEmployees} funcionários por empresa</small>
        </div>
        {(sub.status !== 'ACTIVE' || !sub.active) && (
          SUPPORT_URL
            ? <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="btn btn-primary"><MessageCircle size={16} />{sub.status === 'TRIAL' ? 'Assinar agora' : 'Regularizar pagamento'}</a>
            : <span className="hint" style={{ maxWidth: 320 }}>Para assinar ou regularizar, fale com o suporte do Sysora. Assim que o pagamento é confirmado, o acesso é liberado.</span>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div><h2>Suas empresas</h2><p>{data.companies.length} de {sub.maxCompanies} {sub.maxCompanies === 1 ? 'empresa' : 'empresas'} do plano · cada uma com o próprio WhatsApp</p></div>
          {data.canCreateCompany && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={15} />Nova empresa</button>}
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.id}>
                  <td><div className="person"><span className={`avatar${c.id === company?.id ? ' inverse' : ''}`}><Building2 size={16} /></span><div><strong>{c.name}</strong><small>{c.users} {c.users === 1 ? 'usuário' : 'usuários'}{c.id === company?.id ? ' · empresa atual' : ''}</small></div></div></td>
                  <td><span className="row" style={{ gap: 8 }}><span className={`status-dot${c.whatsappConnected ? ' on' : ''}`} />{c.whatsappConnected ? `WhatsApp ${c.whatsappPhone ?? 'conectado'}` : 'WhatsApp desconectado'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    {c.id !== company?.id && <button type="button" className="btn btn-sm btn-outline" onClick={() => open(c.id, c.name)}>Abrir <ArrowRight size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sub.plan === 'INICIAL' && (
          <div className="row-wrap" style={{ padding: '16px 24px 22px', gap: 12 }}>
            <Sparkles size={16} />
            <span className="muted" style={{ flex: 1 }}>Tem outra unidade ou outro negócio? No plano Avançado você gerencia até 2 empresas, cada uma com o seu WhatsApp.</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setChanging(data.plans.find((p) => p.id === 'AVANCADO')!)}>Conhecer o Avançado</button>
          </div>
        )}
      </div>

      <h2 style={{ marginBottom: 14 }}>Planos</h2>
      <div className="pricing">
        {data.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={plan.id === sub.plan}
            action={plan.id === sub.plan
              ? <button type="button" className="btn btn-outline btn-lg btn-block" disabled>Plano atual</button>
              : <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setChanging(plan)}>Mudar para o {plan.name}</button>}
          />
        ))}
      </div>

      {changing && (
        <ConfirmDialog
          title={`Mudar para o plano ${changing.name}?`}
          message={changing.priceCents > sub.priceCents
            ? `O valor passa a ser ${money(changing.priceCents)}/mês e os novos limites valem na hora: até ${changing.maxCompanies} empresas e até ${changing.maxEmployees} funcionários por empresa (além do administrador).`
            : `O valor passa a ser ${money(changing.priceCents)}/mês. O plano ${changing.name} permite ${changing.maxCompanies} empresa e até ${changing.maxEmployees} funcionários (além do administrador). Quem passar do limite continua cadastrado, mas você não poderá ativar mais ninguém.`}
          confirmLabel="Mudar de plano"
          busy={busy}
          onConfirm={changePlan}
          onClose={() => setChanging(null)}
        />
      )}
      {creating && (
        <NewCompanyModal
          onClose={() => setCreating(false)}
          onCreated={(id, name) => { setCreating(false); void open(id, name); }}
        />
      )}
    </>
  );
}
