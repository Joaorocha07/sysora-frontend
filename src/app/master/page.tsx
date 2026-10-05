'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Banknote, Building2, CreditCard, Globe, Pencil, Plus, Search, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { Avatar, ConfirmDialog, Empty, Field, FormError, Loading, Modal, PageHead, Switch, useToast, PasswordInput, DocumentInput } from '@/components/ui';
import { adminApi, errorMessage, type AdminCompany, type AdminStats, type PlanId, type Subscription, type SubscriptionStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { brDate, maskPhone, money } from '@/lib/format';
import { PLANS, TRIAL_LABEL } from '@/lib/plans';

const STATUS_LABEL: Record<SubscriptionStatus, string> = { TRIAL: 'Teste grátis', ACTIVE: 'Ativa', PAST_DUE: 'Pagamento pendente', CANCELED: 'Cancelada' };

function subscriptionBadge(s: Subscription) {
  if (!s.active) return { label: s.status === 'TRIAL' ? 'Teste encerrado' : 'Bloqueada', cls: 'strike' };
  return { label: STATUS_LABEL[s.status], cls: s.status === 'ACTIVE' ? 'solid' : s.status === 'TRIAL' ? '' : 'dashed' };
}
const shortIso = (value: string | null) => (value ? brDate(value.slice(0, 10)) : '—');

function PlanPicker({ value, onChange }: { value: PlanId; onChange: (plan: PlanId) => void }) {
  return (
    <div className="plan-picker">
      {PLANS.map((p) => (
        <button key={p.id} type="button" className={`plan-option${value === p.id ? ' on' : ''}`} onClick={() => onChange(p.id)}>
          <strong>{p.name} · {money(p.priceCents).replace(',00', '')}/mês</strong>
          <small>{p.maxCompanies === 1 ? '1 empresa' : `Até ${p.maxCompanies} empresas`} · admin + {p.maxEmployees} funcionários</small>
        </button>
      ))}
    </div>
  );
}

function NewCompanyModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({ name: '', document: '', phone: '', email: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [plan, setPlan] = useState<PlanId>('INICIAL');
  const [trial, setTrial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await adminApi.createCompany({
        name: form.name, document: form.document || null, phone: form.phone || null, email: form.email || null, plan, trial,
        admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword },
      });
      onSaved(result.adminAlreadyExisted
        ? 'Empresa criada. O administrador já tinha conta e entra com a senha atual.'
        : 'Empresa criada. Envie o e-mail e a senha ao administrador.');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title="Nova empresa"
      description="Cria a conta do cliente, a empresa e o administrador que vai gerenciá-la."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="company-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Criar empresa</button>
      </>}
    >
      <form id="company-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <div className="eyebrow">Empresa</div>
        <div className="grid-2">
          <Field label="Nome da empresa"><input className="input" required minLength={2} value={form.name} onChange={set('name')} /></Field>
          <Field label="CNPJ ou CPF"><DocumentInput value={form.document} onChange={(document) => setForm((f) => ({ ...f, document }))} placeholder="opcional" /></Field>
          <Field label="Telefone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="opcional" /></Field>
          <Field label="E-mail da empresa"><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="opcional" /></Field>
        </div>
        <Field label="Plano"><PlanPicker value={plan} onChange={setPlan} /></Field>
        <Switch checked={trial} onChange={setTrial} label={`Começar com ${TRIAL_LABEL} grátis`} description="Desligado, a conta já nasce paga por 30 dias (ex.: o cliente pagou antes)." />
        <div className="divider" />
        <div className="eyebrow">Administrador da empresa</div>
        <div className="grid-2">
          <Field label="Nome"><input className="input" required minLength={2} value={form.adminName} onChange={set('adminName')} /></Field>
          <Field label="E-mail de acesso"><input className="input" type="email" required value={form.adminEmail} onChange={set('adminEmail')} /></Field>
        </div>
        <Field label="Senha inicial" hint="Mínimo de 8 caracteres. Se o e-mail já tiver conta na Sysora, a senha atual dele é mantida.">
          <PasswordInput required minLength={8} autoComplete="new-password" value={form.adminPassword} onChange={set('adminPassword')} />
        </Field>
      </form>
    </Modal>
  );
}

function EditCompanyModal({ company, onClose, onSaved }: { company: AdminCompany; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState({ name: company.name, document: company.document ?? '', phone: company.phone ?? '', email: company.email ?? '' });
  const [active, setActive] = useState(company.active);
  const [emailCodes, setEmailCodes] = useState(Boolean(company.emailCodesEnabled));
  const [clientSubscriptions, setClientSubscriptions] = useState(Boolean(company.clientSubscriptionsEnabled));
  const [plan, setPlan] = useState<PlanId>(company.subscription.plan);
  const [status, setStatus] = useState<SubscriptionStatus>(company.subscription.status);
  const [complimentary, setComplimentary] = useState(Boolean(company.subscription.complimentary));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sub = company.subscription;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.updateCompany(company.id, { name: form.name, document: form.document || null, phone: form.phone || null, email: form.email || null, active, emailCodesEnabled: emailCodes, clientSubscriptionsEnabled: clientSubscriptions });
      if (plan !== sub.plan || status !== sub.status || complimentary !== Boolean(sub.complimentary)) await adminApi.updateAccount(sub.accountId, { plan, status, complimentary });
      onSaved('Empresa atualizada.');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function payment() {
    setBusy(true);
    try {
      const next = await adminApi.registerPayment(sub.accountId);
      onSaved(`Pagamento registrado. Acesso liberado até ${shortIso(next.paidUntil)}.`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={company.name}
      description={`Conta ${company.subscription.planName} · ${STATUS_LABEL[sub.status]}${sub.paidUntil ? ` · pago até ${shortIso(sub.paidUntil)}` : sub.trialEndsAt ? ` · teste até ${shortIso(sub.trialEndsAt)}` : ''}`}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={payment} disabled={busy}><Banknote size={16} />Registrar pagamento (+30 dias)</button>
        <div className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="edit-company" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="edit-company" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <div className="eyebrow">Assinatura</div>
        <Field label="Plano" hint={sub.maxCompanies > 1 ? 'Com 2 empresas na conta não é possível voltar para o Inicial.' : undefined}><PlanPicker value={plan} onChange={setPlan} /></Field>
        <Field label="Status da assinatura">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
            {(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Switch checked={complimentary} onChange={setComplimentary} label="Cortesia (sem cobrança)" description="Para testes e parceiros: o plano funciona normalmente, mas a conta não entra na receita nem nas contas pagantes." />
        <div className="divider" />
        <div className="eyebrow">Empresa</div>
        <div className="grid-2">
          <Field label="Nome da empresa"><input className="input" required minLength={2} value={form.name} onChange={set('name')} /></Field>
          <Field label="CNPJ ou CPF"><DocumentInput value={form.document} onChange={(document) => setForm((f) => ({ ...f, document }))} /></Field>
          <Field label="Telefone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="E-mail"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
        </div>
        <Switch checked={active} onChange={setActive} label="Empresa ativa" description="Desativada, ninguém da empresa consegue entrar e o WhatsApp dela é desconectado." />
        <Switch checked={emailCodes} onChange={setEmailCodes} label="Códigos por e-mail" description="Libera a aba Códigos por e-mail e a opção “Receber código de acesso” no bot desta empresa." />
        <Switch checked={clientSubscriptions} onChange={setClientSubscriptions} label="Assinaturas de clientes" description="Troca a Agenda do menu por Assinaturas (data da compra e vencimento de cada cliente). O bot registra sozinho a venda das contas de acesso como assinatura de 1 mês e avisa o cliente quando vence." />
      </form>
    </Modal>
  );
}

export default function MasterPage() {
  const router = useRouter();
  const toast = useToast();
  const { switchCompany } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminCompany | null>(null);
  const [removing, setRemoving] = useState<AdminCompany | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.stats().then(setStats).catch(() => {});
    adminApi.companies().then(setCompanies).catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  async function enter(company: AdminCompany) {
    try {
      await switchCompany(company.id);
      router.push('/painel');
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await adminApi.deleteCompany(removing.id, removing.name);
      toast('Empresa excluída.');
      setRemoving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  if (!companies) return <Loading />;

  const filtered = companies.filter((c) => `${c.name} ${c.email ?? ''} ${c.admins.map((a) => a.email).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const metrics = stats ? [
    { label: 'Receita mensal', value: money(stats.mrrCents), hint: `${stats.payingAccounts} contas pagantes${stats.complimentaryAccounts ? ` · ${stats.complimentaryAccounts} cortesia` : ''}`, icon: TrendingUp },
    { label: 'Em teste grátis', value: stats.trialAccounts, hint: `${stats.accounts} contas no total`, icon: Sparkles },
    { label: 'Empresas', value: stats.companies, hint: `${stats.whatsappConnected} com WhatsApp conectado`, icon: Building2 },
    { label: 'Agendamentos no mês', value: stats.appointmentsThisMonth, hint: `${stats.clients} clientes cadastrados`, icon: CreditCard },
  ] : [];

  return (
    <>
      <PageHead
        eyebrow="Painel master"
        title="Empresas e assinaturas"
        text="Acompanhe os clientes da Sysora, registre pagamentos e acesse qualquer empresa para dar suporte."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Nova empresa</button>}
      />

      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 18 }}>
          <div className="input-icon" style={{ width: 'min(420px, 100%)' }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar empresa ou administrador" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {!filtered.length ? (
          <Empty icon={<Building2 size={22} />} title={search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'} text={search ? undefined : 'Empresas criadas aqui ou pelo cadastro do site aparecem nesta lista.'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Empresa</th><th className="hide-mobile">Administrador</th><th>Assinatura</th><th className="hide-mobile">Uso</th><th /></tr></thead>
              <tbody>
                {filtered.map((c) => {
                  const badge = subscriptionBadge(c.subscription);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="person">
                          <Avatar name={c.name} inverse={c.active} />
                          <div style={{ minWidth: 0 }}>
                            <strong>{c.name}{!c.active && <small style={{ display: 'inline', marginLeft: 6 }}>(desativada)</small>}</strong>
                            <small>{c.selfSignup ? <><Globe size={11} style={{ verticalAlign: -1 }} /> cadastro pelo site · </> : ''}desde {brDate(c.createdAt.slice(0, 10))}</small>
                          </div>
                        </div>
                      </td>
                      <td className="hide-mobile">{c.admins[0] ? <><span>{c.admins[0].name}</span><small style={{ display: 'block' }}>{c.admins[0].email}</small></> : <span className="muted">—</span>}</td>
                      <td>
                        <div className="row-wrap" style={{ gap: 6 }}>
                          <span className="badge plain">{c.subscription.planName}</span>
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                          {c.subscription.complimentary && <span className="badge dashed">Cortesia</span>}
                        </div>
                        <small style={{ display: 'block', marginTop: 4 }}>
                          {c.subscription.complimentary
                            ? `sem cobrança · ${c.subscription.paidUntil ? `até ${shortIso(c.subscription.paidUntil)}` : 'sem vencimento'}`
                            : `${money(c.subscription.priceCents)}/mês · ${c.subscription.status === 'TRIAL' ? `teste até ${shortIso(c.subscription.trialEndsAt)}` : `pago até ${shortIso(c.subscription.paidUntil)}`}`}
                        </small>
                      </td>
                      <td className="hide-mobile">
                        <small style={{ display: 'block' }}>{Math.max(0, c.users - 1)}/{c.subscription.maxEmployees} funcionários ·{c.clients} clientes · {c.appointments} agend.</small>
                        <small className="row" style={{ gap: 6 }}><span className={`status-dot${c.whatsappConnected ? ' on' : ''}`} style={{ width: 8, height: 8 }} />WhatsApp {c.whatsappConnected ? 'conectado' : 'desconectado'}</small>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="icon-btn" onClick={() => setEditing(c)} aria-label="Editar"><Pencil size={16} /></button>
                        <button type="button" className="icon-btn" onClick={() => setRemoving(c)} aria-label="Excluir"><Trash2 size={16} /></button>
                        <button type="button" className="btn btn-sm btn-outline" style={{ marginLeft: 6 }} onClick={() => enter(c)} disabled={!c.active}>Entrar <ArrowRight size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <NewCompanyModal onClose={() => setCreating(false)} onSaved={(message) => { toast(message); setCreating(false); load(); }} />}
      {editing && <EditCompanyModal company={editing} onClose={() => setEditing(null)} onSaved={(message) => { toast(message); setEditing(null); load(); }} />}
      {removing && (
        <ConfirmDialog
          title={`Excluir ${removing.name}?`}
          message="Todos os dados da empresa (clientes, serviços, agendamentos, conversas e a conexão do WhatsApp) serão apagados permanentemente. Para só bloquear o acesso, prefira desativar a empresa."
          confirmLabel="Excluir definitivamente"
          typeToConfirm={removing.name}
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
