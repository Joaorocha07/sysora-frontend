'use client';

import { useState, type FormEvent } from 'react';
import { Field, FormError, Modal } from './ui';
import { clientsApi, errorMessage, type Client } from '@/lib/api';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(e.target.value) : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = { ...form, email: form.email || null, birthday: form.birthday || null, notes: form.notes || null };
      const saved = client ? await clientsApi.update(client.id, input) : await clientsApi.create(input);
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
      </form>
    </Modal>
  );
}
