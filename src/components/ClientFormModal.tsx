'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Field, FormError, Modal, Switch } from './ui';
import { clientsApi, emailCodesApi, errorMessage, type Client, type EmailInbox } from '@/lib/api';
import { maskPhone } from '@/lib/format';

export default function ClientFormModal({ client, onClose, onSaved }: {
  client?: Client | null; onClose: () => void; onSaved: (client: Client) => void;
}) {
  const [form, setForm] = useState({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    birthday: client?.birthday ?? '',
    notes: client?.notes ?? '',
  });
  const [reminders, setReminders] = useState(!client?.whatsappOptOutAt);
  // Códigos por e-mail (só nas empresas liberadas): caixas que o cliente pode usar.
  const [inboxes, setInboxes] = useState<EmailInbox[] | null>(null);
  const [inboxIds, setInboxIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    emailCodesApi.list().then(({ inboxes: list }) => {
      setInboxes(list);
      if (client) setInboxIds(new Set(list.filter((i) => i.clientIds.includes(client.id)).map((i) => i.id)));
    }).catch(() => setInboxes(null));
  }, [client]);
  const toggleInbox = (id: string) => setInboxIds((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = { ...form, email: form.email || null, birthday: form.birthday || null, notes: form.notes || null, reminders };
      const saved = client ? await clientsApi.update(client.id, input) : await clientsApi.create(input);
      if (inboxes?.length) await emailCodesApi.setClientInboxes(saved.id, [...inboxIds]);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={client ? 'Editar cliente' : 'Novo cliente'}
      description={client ? undefined : 'Clientes que falam com o bot no WhatsApp são cadastrados automaticamente.'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="client-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="client-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Nome completo"><input className="input" required value={form.name} onChange={set('name')} /></Field>
        <div className="grid-2">
          <Field label="Telefone / WhatsApp" hint="Com DDD. É por ele que o bot reconhece o cliente.">
            <input className="input" required inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Data de nascimento"><input className="input" type="date" value={form.birthday} onChange={set('birthday')} /></Field>
        </div>
        <Field label="E-mail"><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="opcional" /></Field>
        <Field label="Observações"><textarea className="textarea" value={form.notes} onChange={set('notes')} placeholder="Preferências, alergias, informações úteis..." /></Field>
        <Switch
          checked={reminders}
          onChange={setReminders}
          label="Receber lembretes pelo WhatsApp"
          description={client?.whatsappOptOutAt
            ? `O cliente respondeu PARAR em ${new Date(client.whatsappOptOutAt).toLocaleDateString('pt-BR')}. Só reative se ele pedir.`
            : 'Desligado, o bot continua atendendo, mas não envia lembretes a este cliente.'}
        />
        {inboxes && inboxes.length > 0 && (
          <div className="field">
            <span>Códigos por e-mail liberados</span>
            <div className="stack" style={{ gap: 6 }}>
              {inboxes.map((i) => (
                <label key={i.id} className="row" style={{ gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={inboxIds.has(i.id)} onChange={() => toggleInbox(i.id)} />
                  <span>{i.label}</span><small className="muted">{i.email}</small>
                </label>
              ))}
            </div>
            <small>O cliente recebe no WhatsApp o código dessas contas quando pedir.</small>
          </div>
        )}
      </form>
    </Modal>
  );
}
