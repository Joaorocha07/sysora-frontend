'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, UserPlus } from 'lucide-react';
import ClientFormModal from './ClientFormModal';
import { Field, FormError, Modal } from './ui';
import {
  ApiError, appointmentsApi, clientsApi, errorMessage, servicesApi, usersApi,
  type Appointment, type Client, type Member, type Service,
} from '@/lib/api';
import { duration, longDate, money, today } from '@/lib/format';

// Novo agendamento ou edição (remarcar, trocar serviços, profissional).
export default function AppointmentModal({ appointment, defaultDate, defaultClient, onClose, onSaved }: {
  appointment?: Appointment | null;
  defaultDate?: string;
  defaultClient?: Pick<Client, 'id' | 'name' | 'phone'> | null;
  onClose: () => void;
  onSaved: (appointment: Appointment) => void;
}) {
  const editing = Boolean(appointment);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [newClient, setNewClient] = useState(false);

  const [clientId, setClientId] = useState(appointment?.clientId ?? defaultClient?.id ?? '');
  const [clientLabel, setClientLabel] = useState(appointment?.client.name ?? defaultClient?.name ?? '');
  const [serviceIds, setServiceIds] = useState<string[]>(appointment?.items.map((i) => i.serviceId).filter((id): id is string => Boolean(id)) ?? []);
  const [date, setDate] = useState(appointment?.date ?? defaultDate ?? today());
  const [time, setTime] = useState(appointment?.startTime ?? '');
  const [staffId, setStaffId] = useState(appointment?.staffId ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');

  const [times, setTimes] = useState<string[] | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    servicesApi.list().then((list) => setServices(list.filter((s) => s.active || serviceIds.includes(s.id)))).catch(() => {});
    usersApi.list().then((list) => setStaff(list.filter((m) => m.active))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca de clientes (só para novo agendamento).
  useEffect(() => {
    if (editing) return;
    const timer = setTimeout(() => { clientsApi.list(search || undefined).then(setClients).catch(() => {}); }, 250);
    return () => clearTimeout(timer);
  }, [search, editing]);

  // Horários livres do dia para os serviços escolhidos (mesma regra do bot).
  useEffect(() => {
    if (!date || !serviceIds.length) { setTimes(null); return; }
    setLoadingTimes(true);
    appointmentsApi.availability(date, serviceIds, appointment?.id)
      .then((r) => setTimes(r.times))
      .catch(() => setTimes([]))
      .finally(() => setLoadingTimes(false));
  }, [date, serviceIds, appointment?.id]);

  const chosen = useMemo(() => serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => Boolean(s)), [serviceIds, services]);
  const totalMinutes = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalCents = chosen.reduce((sum, s) => sum + s.priceCents, 0);

  const toggleService = (id: string) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  async function save(ignoreConflicts = false) {
    setError(null);
    if (!clientId) return setError('Selecione o cliente.');
    if (!serviceIds.length) return setError('Selecione pelo menos um serviço.');
    if (!time) return setError('Escolha o horário.');
    setBusy(true);
    try {
      const input = { serviceIds, date, startTime: time, staffId: staffId || null, notes: notes || null, ignoreConflicts };
      const saved = appointment ? await appointmentsApi.update(appointment.id, input) : await appointmentsApi.create({ ...input, clientId });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  if (newClient) {
    return (
      <ClientFormModal
        onClose={() => setNewClient(false)}
        onSaved={(c) => { setClientId(c.id); setClientLabel(c.name); setNewClient(false); }}
      />
    );
  }

  return (
    <Modal
      wide
      title={editing ? 'Editar agendamento' : 'Novo agendamento'}
      description={editing ? `${appointment!.client.name}` : 'Os horários sugeridos respeitam o funcionamento e a duração dos serviços.'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        {conflict && <button type="button" className="btn btn-outline" onClick={() => save(true)} disabled={busy}>Marcar mesmo assim</button>}
        <button type="submit" form="appointment-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}{editing ? 'Salvar alterações' : 'Agendar'}</button>
      </>}
    >
      <form id="appointment-form" className="stack" onSubmit={submit}>
        <FormError message={error} />

        {!editing && (
          <Field label="Cliente">
            {clientId ? (
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 16px', border: '1px solid var(--line-strong)', borderRadius: 14 }}>
                <strong>{clientLabel}</strong>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setClientId(''); setClientLabel(''); }}>Trocar</button>
              </div>
            ) : (
              <div className="stack-sm">
                <div className="row">
                  <div className="input-icon" style={{ flex: 1 }}>
                    <Search size={16} />
                    <input className="input" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn-outline" onClick={() => setNewClient(true)}><UserPlus size={16} /><span className="hide-mobile">Novo</span></button>
                </div>
                <div className="chips" style={{ maxHeight: 132, overflow: 'auto' }}>
                  {clients.slice(0, 30).map((c) => (
                    <button key={c.id} type="button" className="chip" onClick={() => { setClientId(c.id); setClientLabel(c.name); }}>
                      {c.name} <small>{c.phone}</small>
                    </button>
                  ))}
                  {!clients.length && <small>Nenhum cliente encontrado.</small>}
                </div>
              </div>
            )}
          </Field>
        )}

        <Field label="Serviços" hint={chosen.length ? `Duração total: ${duration(totalMinutes)} · ${money(totalCents)}` : 'Selecione um ou mais serviços.'}>
          <div className="chips">
            {services.map((s) => (
              <button key={s.id} type="button" className={`chip${serviceIds.includes(s.id) ? ' on' : ''}`} onClick={() => toggleService(s.id)}>
                {s.name} · {duration(s.durationMinutes)}
              </button>
            ))}
            {!services.length && <small>Nenhum serviço cadastrado. Cadastre em Serviços.</small>}
          </div>
        </Field>

        <div className="grid-2">
          <Field label="Data" hint={date ? longDate(date) : undefined}>
            <input className="input" type="date" required value={date} min={editing ? undefined : today()} onChange={(e) => { setDate(e.target.value); setTime(''); setConflict(false); }} />
          </Field>
          <Field label="Horário" hint="Escolha abaixo ou digite outro horário.">
            <input className="input" type="time" required value={time} onChange={(e) => { setTime(e.target.value); setConflict(false); }} />
          </Field>
        </div>

        {serviceIds.length > 0 && (
          <div className="stack-sm">
            <small>{loadingTimes ? 'Buscando horários livres...' : times?.length ? 'Horários livres' : 'Nenhum horário livre na grade deste dia.'}</small>
            {!!times?.length && (
              <div className="times">
                {times.map((t) => (
                  <button key={t} type="button" className={`chip${time === t ? ' on' : ''}`} onClick={() => { setTime(t); setConflict(false); }}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid-2">
          <Field label="Profissional (opcional)">
            <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Qualquer profissional</option>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Observações">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" />
          </Field>
        </div>
        {!editing && !services.length && (
          <a href="/servicos" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }}><Plus size={15} />Cadastrar serviços</a>
        )}
      </form>
    </Modal>
  );
}
