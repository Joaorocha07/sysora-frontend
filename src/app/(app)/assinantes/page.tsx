'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Bot, CalendarClock, CheckCircle2, Pencil, Plus, Repeat, Search, Trash2, UserCheck, UserPlus, Wallet, XCircle } from 'lucide-react';
import { ConfirmDialog, Empty, Field, FormError, Modal, PageHead, useToast } from '@/components/ui';
import {
  clientSubscriptionsApi, clientsApi, errorMessage, servicesApi, settingsApi, type Client, type ClientSubscription, type Service,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { brDate, centsToMoneyInput, maskMoney, maskPhone, money, parseMoney, today } from '@/lib/format';

// Assinaturas dos clientes: produto vendido por mês, com a data da compra e o
// vencimento. O bot registra sozinho a venda das contas de acesso; a equipe
// cadastra as outras vendas e as renovações. Só nas empresas liberadas pelo
// admin master (settings.clientSubscriptionsEnabled).

const pad = (n: number) => String(n).padStart(2, '0');
// Mesmo dia `months` meses depois (31/01 + 1 mês = 28/02), igual ao backend.
function plusMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}
const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);

// Vencendo: faltam até SOON_DAYS dias.
const SOON_DAYS = 7;
type Status = 'ok' | 'soon' | 'expired' | 'canceled';
function statusOf(s: ClientSubscription): { status: Status; label: string } {
  if (s.canceledAt) return { status: 'canceled', label: 'Cancelada' };
  const days = daysBetween(today(), s.dueDate);
  if (days < 0) return { status: 'expired', label: `Vencida há ${-days} ${days === -1 ? 'dia' : 'dias'}` };
  if (days === 0) return { status: 'soon', label: 'Vence hoje' };
  if (days <= SOON_DAYS) return { status: 'soon', label: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}` };
  return { status: 'ok', label: 'Em dia' };
}
const BADGE: Record<Status, string> = { ok: 'solid', soon: '', expired: 'dashed', canceled: 'strike' };

type Filter = 'all' | Status;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'ok', label: 'Em dia' },
  { id: 'soon', label: 'Vencendo' },
  { id: 'expired', label: 'Vencidas' },
  { id: 'canceled', label: 'Canceladas' },
];

// ---------- Nova assinatura ----------
function NewSubscriptionModal({ clients, products, onClose, onSaved, onClientCreated }: {
  clients: Client[]; products: Service[]; onClose: () => void; onSaved: (s: ClientSubscription) => void; onClientCreated: (c: Client) => void;
}) {
  const [newClient, setNewClient] = useState(clients.length === 0);
  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState({ name: '', phone: '', email: '' });
  const [serviceId, setServiceId] = useState(products[0]?.id ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(centsToMoneyInput(products[0]?.priceCents ?? 0));
  const [startDate, setStartDate] = useState(today());
  const [dueDate, setDueDate] = useState(plusMonths(today(), 1));
  const [dueEdited, setDueEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickProduct(id: string) {
    setServiceId(id);
    const product = products.find((p) => p.id === id);
    if (product) setPrice(centsToMoneyInput(product.priceCents));
  }
  function changeStart(value: string) {
    setStartDate(value);
    if (!dueEdited && value) setDueDate(plusMonths(value, 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let id = clientId;
      if (newClient) {
        const created = await clientsApi.create({ name: client.name.trim(), phone: client.phone, email: client.email.trim() || null });
        onClientCreated(created);
        // Se a assinatura falhar, o cliente já existe: segue pelo seletor para não cadastrar duas vezes.
        id = created.id;
        setClientId(created.id);
        setNewClient(false);
      }
      const saved = await clientSubscriptionsApi.create({
        clientId: id, serviceId: serviceId || null, name: serviceId ? undefined : name, priceCents: parseMoney(price), startDate, dueDate, notes: notes || null,
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nova assinatura"
      description="Registre a venda: o dia da compra e o vencimento do cliente."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="new-subscription" className="btn btn-primary" disabled={busy || (newClient ? !client.name.trim() || !client.phone : !clientId)}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="new-subscription" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <div className="segmented full" role="tablist" aria-label="Cliente">
          <button type="button" className={newClient ? '' : 'on'} disabled={!clients.length} onClick={() => setNewClient(false)}><UserCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Cliente cadastrado</button>
          <button type="button" className={newClient ? 'on' : ''} onClick={() => setNewClient(true)}><UserPlus size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Novo cliente</button>
        </div>
        {newClient ? (
          <>
            <div className="grid-2">
              <Field label="Nome do cliente"><input className="input" required maxLength={120} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></Field>
              <Field label="WhatsApp"><input className="input" required inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></Field>
            </div>
            <Field label="E-mail (opcional)"><input className="input" type="email" maxLength={160} value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
          </>
        ) : (
          <Field label="Cliente">
            <select className="select" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Escolha o cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
            </select>
          </Field>
        )}
        <Field label="Produto">
          <select className="select" value={serviceId} onChange={(e) => pickProduct(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="">Outro (digitar o nome)</option>
          </select>
        </Field>
        {!serviceId && (
          <Field label="Nome da assinatura"><input className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        )}
        <div className="grid-3">
          <Field label="Valor (R$)"><input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(maskMoney(e.target.value))} placeholder="0,00" /></Field>
          <Field label="Data da compra"><input className="input" type="date" required value={startDate} onChange={(e) => changeStart(e.target.value)} /></Field>
          <Field label="Vencimento" hint={dueEdited ? undefined : '1 mês depois da compra'}>
            <input className="input" type="date" required min={startDate} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueEdited(true); }} />
          </Field>
        </div>
        <Field label="Observações (opcional)"><textarea className="textarea" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

// ---------- Renovar ----------
function RenewModal({ subscription, onClose, onSaved }: { subscription: ClientSubscription; onClose: () => void; onSaved: (s: ClientSubscription) => void }) {
  const [months, setMonths] = useState(1);
  const [price, setPrice] = useState(centsToMoneyInput(subscription.priceCents));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Renovou antes de vencer: conta a partir do vencimento atual (o cliente não perde dias).
  const base = subscription.canceledAt || subscription.dueDate < today() ? today() : subscription.dueDate;
  const newDue = plusMonths(base, months);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      onSaved(await clientSubscriptionsApi.renew(subscription.id, { months, priceCents: parseMoney(price) }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Renovar · ${subscription.client.name}`}
      description={`${subscription.name} · vencimento atual ${brDate(subscription.dueDate)}`}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <span className="spinner" />}Registrar pagamento</button>
      </>}
    >
      <div className="stack">
        <FormError message={error} />
        <div className="grid-2">
          <Field label="Meses pagos">
            <select className="select" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'mês' : 'meses'}</option>)}
            </select>
          </Field>
          <Field label="Valor pago (R$)"><input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(maskMoney(e.target.value))} placeholder="0,00" /></Field>
        </div>
        <p className="muted">Data da compra: <strong>{brDate(today())}</strong>. Novo vencimento: <strong>{brDate(newDue)}</strong>.</p>
      </div>
    </Modal>
  );
}

// ---------- Histórico e edição ----------
function HistoryModal({ subscription, isAdmin, onClose, onChanged }: {
  subscription: ClientSubscription; isAdmin: boolean; onClose: () => void; onChanged: (message: string) => void;
}) {
  const toast = useToast();
  const [periods, setPeriods] = useState<ClientSubscription[] | null>(null);
  const [editing, setEditing] = useState<ClientSubscription | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'cancel' | 'remove'; period: ClientSubscription } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    clientSubscriptionsApi.ofClient(subscription.clientId).then(setPeriods).catch((err) => toast(errorMessage(err), true));
  }, [subscription.clientId, toast]);
  useEffect(load, [load]);

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'cancel') await clientSubscriptionsApi.cancel(confirm.period.id);
      else await clientSubscriptionsApi.remove(confirm.period.id);
      setConfirm(null);
      onChanged(confirm.kind === 'cancel' ? 'Assinatura cancelada.' : 'Registro apagado.');
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal wide title={subscription.client.name} description={`${subscription.client.phone} · histórico de pagamentos`} onClose={onClose}>
        {periods === null ? (
          <div className="loading-screen" style={{ minHeight: 120 }}><span className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Produto</th><th>Compra</th><th>Vencimento</th><th className="hide-mobile">Valor</th><th /></tr></thead>
              <tbody>
                {periods.map((p) => {
                  const { status, label } = statusOf(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="muted" style={{ display: 'block' }}>
                          {p.source === 'BOT' ? 'Registrada pelo bot' : 'Registrada pela equipe'}{p.notes ? ` · ${p.notes}` : ''}
                        </small>
                      </td>
                      <td className="mono">{brDate(p.startDate)}</td>
                      <td><span className="mono">{brDate(p.dueDate)}</span> <span className={`badge ${BADGE[status]}`}>{label}</span></td>
                      <td className="hide-mobile mono">{money(p.priceCents)}</td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                          <button type="button" className="icon-btn" title="Editar datas" aria-label="Editar" onClick={() => setEditing(p)}><Pencil size={15} /></button>
                          {!p.canceledAt && <button type="button" className="icon-btn" title="Cancelar assinatura" aria-label="Cancelar" onClick={() => setConfirm({ kind: 'cancel', period: p })}><XCircle size={15} /></button>}
                          {isAdmin && <button type="button" className="icon-btn" title="Apagar registro" aria-label="Apagar" onClick={() => setConfirm({ kind: 'remove', period: p })}><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {editing && (
        <EditPeriodModal
          period={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged('Assinatura atualizada.'); load(); }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'cancel' ? 'Cancelar assinatura?' : 'Apagar registro?'}
          message={confirm.kind === 'cancel'
            ? `${confirm.period.name} de ${subscription.client.name} fica como cancelada: o bot passa a tratar o acesso como vencido.`
            : 'Use só para registros feitos por engano. O pagamento some do histórico do cliente.'}
          confirmLabel={confirm.kind === 'cancel' ? 'Cancelar assinatura' : 'Apagar'}
          danger
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function EditPeriodModal({ period, onClose, onSaved }: { period: ClientSubscription; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: period.name, price: centsToMoneyInput(period.priceCents), startDate: period.startDate, dueDate: period.dueDate, notes: period.notes ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: key === 'price' ? maskMoney(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await clientSubscriptionsApi.update(period.id, {
        name: form.name, priceCents: parseMoney(form.price), startDate: form.startDate, dueDate: form.dueDate, notes: form.notes || null,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Editar assinatura"
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="edit-period" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="edit-period" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Nome"><input className="input" required maxLength={120} value={form.name} onChange={set('name')} /></Field>
        <div className="grid-3">
          <Field label="Valor (R$)"><input className="input" inputMode="numeric" value={form.price} onChange={set('price')} placeholder="0,00" /></Field>
          <Field label="Data da compra"><input className="input" type="date" required value={form.startDate} onChange={set('startDate')} /></Field>
          <Field label="Vencimento"><input className="input" type="date" required min={form.startDate} value={form.dueDate} onChange={set('dueDate')} /></Field>
        </div>
        <Field label="Observações"><textarea className="textarea" rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  );
}

export default function AssinantesPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Service[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [renewing, setRenewing] = useState<ClientSubscription | null>(null);
  const [viewing, setViewing] = useState<ClientSubscription | null>(null);

  const load = useCallback(() => {
    clientSubscriptionsApi.list().then(setSubscriptions).catch((err) => toast(errorMessage(err), true));
  }, [toast]);

  useEffect(() => {
    settingsApi.get().then((r) => {
      const on = Boolean(r.settings.clientSubscriptionsEnabled);
      setEnabled(on);
      if (!on) return;
      load();
      clientsApi.list().then((list) => setClients([...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))).catch(() => {});
      servicesApi.list().then((list) => setProducts(list.filter((s) => s.kind === 'PRODUCT' && s.active))).catch(() => {});
    }).catch(() => setEnabled(false));
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (subscriptions ?? [])
      .map((s) => ({ ...s, ...statusOf(s) }))
      .filter((s) => filter === 'all' || s.status === filter)
      .filter((s) => !term || s.client.name.toLowerCase().includes(term) || s.client.phone.includes(term) || s.name.toLowerCase().includes(term))
      // Mais urgentes primeiro: vencidas e vencendo no topo.
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [subscriptions, filter, search]);

  const metrics = useMemo(() => {
    const all = (subscriptions ?? []).map(statusOf);
    const active = (subscriptions ?? []).filter((s) => !s.canceledAt && s.dueDate >= today());
    return [
      { label: 'Em dia', value: String(all.filter((s) => s.status === 'ok').length), hint: 'assinaturas ativas', icon: CheckCircle2 },
      { label: 'Vencendo', value: String(all.filter((s) => s.status === 'soon').length), hint: `nos próximos ${SOON_DAYS} dias`, icon: CalendarClock },
      { label: 'Vencidas', value: String(all.filter((s) => s.status === 'expired').length), hint: 'precisam renovar', icon: AlertTriangle },
      { label: 'Receita mensal', value: money(active.reduce((sum, s) => sum + s.priceCents, 0)), hint: 'das assinaturas ativas', icon: Wallet },
    ];
  }, [subscriptions]);

  if (enabled === false) {
    return (
      <div className="card">
        <Empty icon={<Repeat size={22} />} title="Recurso não liberado" text="As assinaturas de clientes não estão liberadas para esta empresa." />
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Assinaturas"
        title="Assinaturas dos clientes"
        text="Data da compra e vencimento de cada cliente. O bot registra sozinho as vendas feitas pelo WhatsApp; aqui você cadastra as outras e renova quando o cliente paga."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Nova assinatura</button>}
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
        <div className="card-head" style={{ paddingBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div className="input-icon" style={{ width: 'min(360px, 100%)' }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar cliente, telefone ou produto" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="segmented" style={{ maxWidth: '100%', overflowX: 'auto' }}>
            {FILTERS.map((f) => <button key={f.id} type="button" className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>)}
          </div>
        </div>

        {subscriptions === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<Repeat size={22} />}
            title={subscriptions.length ? 'Nenhuma assinatura neste filtro' : 'Nenhuma assinatura ainda'}
            text={subscriptions.length ? 'Tente outro filtro ou busca.' : 'Registre a primeira venda. As vendas feitas pelo bot aparecem aqui sozinhas.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th className="hide-mobile">Produto</th><th className="hide-mobile">Compra</th><th>Vencimento</th><th className="hide-mobile">Valor</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setViewing(s)}>
                    <td>
                      <div style={{ minWidth: 0 }}>
                        <strong>{s.client.name}</strong>
                        <small className="muted" style={{ display: 'block' }}>{s.client.phone}</small>
                      </div>
                    </td>
                    <td className="hide-mobile">
                      {s.name}
                      {s.source === 'BOT' && <span className="badge plain soft" style={{ marginLeft: 6 }} title="Venda registrada pelo bot"><Bot size={13} />Bot</span>}
                    </td>
                    <td className="hide-mobile mono">{brDate(s.startDate)}</td>
                    <td>
                      <div className="mono">{brDate(s.dueDate)}</div>
                      <span className={`badge ${BADGE[s.status]}`}>{s.label}</span>
                    </td>
                    <td className="hide-mobile mono">{money(s.priceCents)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRenewing(s)}><Repeat size={14} />Renovar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <NewSubscriptionModal
          clients={clients}
          products={products}
          onClose={() => setCreating(false)}
          onSaved={(s) => { setCreating(false); toast(`Assinatura registrada. Vence em ${brDate(s.dueDate)}.`); load(); }}
          onClientCreated={(c) => setClients((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))}
        />
      )}
      {renewing && (
        <RenewModal
          subscription={renewing}
          onClose={() => setRenewing(null)}
          onSaved={(s) => { setRenewing(null); toast(`Renovada até ${brDate(s.dueDate)}.`); load(); }}
        />
      )}
      {viewing && (
        <HistoryModal
          subscription={viewing}
          isAdmin={isAdmin}
          onClose={() => { setViewing(null); load(); }}
          onChanged={(message) => toast(message)}
        />
      )}
    </>
  );
}
