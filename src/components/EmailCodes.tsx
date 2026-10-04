'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, KeyRound, Mail, Plus, Search, Trash2, TriangleAlert, Users, Zap } from 'lucide-react';
import { ConfirmDialog, Empty, Field, FormError, Loading, Modal, PasswordInput, Switch, useToast } from './ui';
import { clientsApi, emailCodesApi, errorMessage, servicesApi, type Client, type EmailInbox, type FoundEmailCode, type Service } from '@/lib/api';

// Aba "Códigos por e-mail" (WhatsApp): caixas do Gmail de onde o bot tira o
// código que o cliente pede no WhatsApp (opção "Receber código de acesso" do
// fluxo). Cada caixa só entrega código para os clientes liberados nela.

const timeBr = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function NewInboxModal({ defaultSenders, preset, onClose, onSaved }: { defaultSenders: string; preset?: { label: string; email: string }; onClose: () => void; onSaved: (inbox: EmailInbox) => void }) {
  const [form, setForm] = useState({ label: preset?.label ?? '', email: preset?.email ?? '', appPassword: '', senders: defaultSenders });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSaved(await emailCodesApi.create(form));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Conectar e-mail do Gmail"
      description="A Sysora só lê os e-mails dos remetentes informados. Nada é apagado nem marcado como lido."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="inbox-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}{busy ? 'Testando acesso...' : 'Conectar'}</button>
      </>}
    >
      <form id="inbox-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <ol className="steps">
          <li><span>Na conta do Gmail, ligue a <strong>Verificação em duas etapas</strong>.</span></li>
          <li><span>Abra <strong>myaccount.google.com/apppasswords</strong>, crie uma senha com o nome “Sysora” e copie as 16 letras.</span></li>
          <li><span>Cole abaixo. A senha normal da conta não funciona aqui.</span></li>
        </ol>
        <div className="grid-2">
          <Field label="Nome" hint="Como aparece para você e para o cliente."><input className="input" required maxLength={60} value={form.label} onChange={set('label')} placeholder="ChatGPT 1" /></Field>
          <Field label="E-mail do Gmail"><input className="input" required type="email" value={form.email} onChange={set('email')} placeholder="conta@gmail.com" /></Field>
        </div>
        <Field label="Senha de app"><PasswordInput required value={form.appPassword} onChange={set('appPassword')} placeholder="abcd efgh ijkl mnop" autoComplete="off" /></Field>
        <Field label="Remetentes aceitos" hint="Domínios ou e-mails separados por vírgula. openai.com = códigos do ChatGPT.">
          <input className="input" value={form.senders} onChange={set('senders')} placeholder="openai.com" />
        </Field>
      </form>
    </Modal>
  );
}

function ClientsModal({ inbox, clients, onClose, onSaved }: { inbox: EmailInbox; clients: Client[]; onClose: () => void; onSaved: (inbox: EmailInbox) => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState(new Set(inbox.clientIds));
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q));
  }, [clients, search]);
  const toggle = (id: string) => setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function save() {
    setBusy(true);
    try {
      onSaved(await emailCodesApi.setInboxClients(inbox.id, [...selected]));
    } catch (err) {
      toast(errorMessage(err), true);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Quem recebe os códigos de ${inbox.label}`}
      description="Só esses clientes recebem o código desta caixa quando pedem no WhatsApp."
      onClose={onClose}
      footer={<>
        <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <div className="stack" style={{ gap: 10 }}>
        <div className="input-icon"><Search size={16} /><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente por nome ou telefone" /></div>
        {!clients.length ? (
          <p className="muted">Nenhum cliente cadastrado ainda. Quem manda mensagem no WhatsApp é cadastrado sozinho.</p>
        ) : (
          <div className="stack" style={{ gap: 4, maxHeight: 340, overflowY: 'auto' }}>
            {visible.map((c) => (
              <label key={c.id} className="row" style={{ gap: 10, padding: '8px 4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span style={{ flex: 1 }}>{c.name}</span>
                <small className="muted">{c.phone}</small>
              </label>
            ))}
            {!visible.length && <small className="muted">Nenhum cliente encontrado.</small>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function InboxCard({ inbox, clients, onChange, onRemoved }: { inbox: EmailInbox; clients: Client[]; onChange: (inbox: EmailInbox) => void; onRemoved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'test' | 'active' | 'remove' | null>(null);
  const [found, setFound] = useState<FoundEmailCode | null | undefined>(undefined);
  const [editingClients, setEditingClients] = useState(false);
  const [removing, setRemoving] = useState(false);
  const names = clients.filter((c) => inbox.clientIds.includes(c.id)).map((c) => c.name);

  async function test() {
    setBusy('test');
    try { setFound(await emailCodesApi.test(inbox.id)); } catch (err) { toast(errorMessage(err), true); } finally { setBusy(null); }
  }
  async function setActive(active: boolean) {
    setBusy('active');
    try { onChange(await emailCodesApi.update(inbox.id, { active })); } catch (err) { toast(errorMessage(err), true); } finally { setBusy(null); }
  }
  async function remove() {
    setBusy('remove');
    try { await emailCodesApi.remove(inbox.id); toast('Caixa removida.'); onRemoved(); } catch (err) { toast(errorMessage(err), true); setBusy(null); }
  }

  return (
    <div className="card card-pad stack" style={{ gap: 12 }}>
      <div className="row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="metric-icon"><Mail size={18} /></span>
          <div>
            <strong style={{ display: 'block' }}>{inbox.label}</strong>
            <small className="muted">{inbox.email} · remetentes: {inbox.senders}</small>
          </div>
        </div>
        <Switch checked={inbox.active} onChange={setActive} disabled={busy !== null} label={inbox.active ? 'Ativa' : 'Pausada'} />
      </div>
      {inbox.lastError && <p className="form-error" style={{ margin: 0 }}>{inbox.lastError}</p>}
      <small><Users size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        {names.length ? `Liberada para: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` e mais ${names.length - 4}` : ''}` : 'Nenhum cliente liberado ainda: o bot não entrega código desta caixa.'}
      </small>
      {found !== undefined && (
        <div className="flow-data" style={{ margin: 0 }}>
          {found ? (
            <>
              <strong><KeyRound size={13} />Último código da última hora</strong>
              <span><b style={{ fontSize: 18, letterSpacing: 2 }}>{found.code ?? 'link'}</b> · {timeBr(found.receivedAt)} · {found.from}</span>
              <small className="muted">{found.subject}</small>
            </>
          ) : <span>Acesso ok. Nenhum código destes remetentes na última hora.</span>}
        </div>
      )}
      <div className="row-wrap">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingClients(true)}><Users size={14} />Clientes liberados</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={test} disabled={busy !== null}>{busy === 'test' ? <span className="spinner" /> : <Zap size={14} />}Testar</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(true)} disabled={busy !== null}><Trash2 size={14} />Remover</button>
      </div>
      {editingClients && <ClientsModal inbox={inbox} clients={clients} onClose={() => setEditingClients(false)} onSaved={(next) => { onChange(next); setEditingClients(false); toast('Clientes atualizados.'); }} />}
      {removing && (
        <ConfirmDialog
          title={`Remover ${inbox.label}?`}
          message="O bot deixa de buscar códigos neste e-mail e os clientes liberados perdem o acesso. A conta do Gmail não é alterada."
          confirmLabel="Remover"
          danger
          busy={busy === 'remove'}
          onConfirm={remove}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
}

export function EmailCodes({ onOpenFlow }: { onOpenFlow: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ inboxes: EmailInbox[]; defaultSenders: string; windowMinutes: number } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Service[]>([]);
  const [adding, setAdding] = useState<{ label: string; email: string } | true | false>(false);

  const load = useCallback(() => {
    emailCodesApi.list().then(setData).catch((err) => toast(errorMessage(err), true));
    clientsApi.list().then(setClients).catch(() => {});
    servicesApi.list().then((list) => setAccounts(list.filter((s) => s.kind === 'PRODUCT' && s.accessEmail))).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);

  if (!data) return <Loading />;
  const replace = (next: EmailInbox) => setData((d) => d && { ...d, inboxes: d.inboxes.map((i) => (i.id === next.id ? next : i)) });

  const connected = new Set(data.inboxes.filter((i) => i.active).map((i) => i.email.toLowerCase()));

  return (
    <div className="stack">
      {accounts.length > 0 && (
        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div>
            <strong style={{ display: 'block' }}>Contas de acesso ({accounts.length})</strong>
            <small className="muted">
              Produtos do catálogo com e-mail de acesso. Na primeira vez que o cliente escolhe “Receber código de acesso”, o bot entrega uma conta
              (com Gmail conectado e menos clientes) e registra na agenda a conta e o vencimento de 30 dias. Depois, usa sempre a conta da agenda.
              “Não consigo gerar imagem” troca a conta e mantém o vencimento. Vencido, o bot pede um novo pagamento e passa para a equipe.
            </small>
          </div>
          {accounts.map((a) => {
            const ok = connected.has(a.accessEmail!.toLowerCase());
            return (
              <div key={a.id} className="row-wrap" style={{ justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                <span className="row" style={{ gap: 8 }}>
                  {ok ? <Check size={16} /> : <TriangleAlert size={16} />}
                  <span><strong>{a.name}</strong><small className="muted" style={{ display: 'block' }}>{a.accessEmail}{a.description ? ` · ${a.description}` : ''}</small></span>
                </span>
                {ok
                  ? <span className="badge solid">Gmail conectado</span>
                  : <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding({ label: a.name, email: a.accessEmail! })}><Plus size={14} />Conectar Gmail</button>}
              </div>
            );
          })}
        </div>
      )}

      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong style={{ display: 'block' }}>Como funciona</strong>
            <small className="muted">
              O cliente pede o código no site ou no app e escolhe “Receber código de acesso” no WhatsApp (ou escreve “código”).
              O bot procura nos e-mails liberados para ele o código dos últimos {data.windowMinutes} minutos e responde. Se ainda não chegou, espera até 1 minuto.
            </small>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Conectar e-mail</button>
        </div>
        <small>Falta só colocar a opção no menu: <button type="button" className="btn-link" onClick={onOpenFlow}>abra o Fluxo do bot</button>, adicione uma opção do tipo Função e escolha “Receber código de acesso”.</small>
      </div>

      {!data.inboxes.length ? (
        <div className="card"><Empty icon={<Mail size={22} />} title="Nenhum e-mail conectado" text="Conecte a conta do Gmail que recebe os códigos e escolha quais clientes podem recebê-los." /></div>
      ) : data.inboxes.map((inbox) => (
        <InboxCard key={inbox.id} inbox={inbox} clients={clients} onChange={replace} onRemoved={() => setData((d) => d && { ...d, inboxes: d.inboxes.filter((i) => i.id !== inbox.id) })} />
      ))}

      {adding && <NewInboxModal defaultSenders={data.defaultSenders} preset={adding === true ? undefined : adding} onClose={() => setAdding(false)} onSaved={(inbox) => { setAdding(false); toast('E-mail conectado.'); setData((d) => d && { ...d, inboxes: [...d.inboxes, inbox] }); }} />}
    </div>
  );
}
