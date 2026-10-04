'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bot, CalendarClock, Check, CheckCheck, Clock, Pencil, Trash2, User, UserX, X } from 'lucide-react';
import AppointmentModal from './AppointmentModal';
import { ConfirmDialog, Modal, useToast } from './ui';
import { appointmentsApi, errorMessage, type Appointment, type AppointmentStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS, duration, longDate, money } from '@/lib/format';

// Detalhes de um agendamento com as ações da equipe (confirmar, concluir...).
export default function AppointmentDetails({ appointment, onClose, onChanged }: {
  appointment: Appointment; onClose: () => void; onChanged: () => void;
}) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState(appointment);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = current.status === 'SCHEDULED' || current.status === 'CONFIRMED';
  const minutes = current.items.reduce((sum, i) => sum + i.durationMinutes, 0);

  async function setStatus(status: AppointmentStatus, message: string) {
    setBusy(true);
    try {
      setCurrent(await appointmentsApi.setStatus(current.id, status));
      toast(message);
      onChanged();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await appointmentsApi.remove(current.id);
      toast('Agendamento excluído.');
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err), true);
      setBusy(false);
    }
  }

  if (editing) {
    return <AppointmentModal appointment={current} onClose={() => setEditing(false)} onSaved={(a) => { setCurrent(a); setEditing(false); toast('Agendamento atualizado.'); onChanged(); }} />;
  }
  if (confirmDelete) {
    return <ConfirmDialog title="Excluir agendamento?" message="O registro some da agenda e do histórico do cliente. Para manter o histórico, prefira cancelar." confirmLabel="Excluir" danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} />;
  }

  const reminder = current.confirmedAt
    ? 'Presença confirmada'
    : current.reminderSentAt || current.hourReminderSentAt
      ? 'Lembrete enviado, aguardando resposta do cliente'
      : 'Lembrete ainda não enviado';

  return (
    <Modal
      title={current.items.map((i) => i.name).join(' + ') || 'Atendimento'}
      description={`${longDate(current.date)} · ${current.startTime} às ${current.endTime}`}
      onClose={onClose}
      footer={<>
        {isAdmin && <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Excluir</button>}
        <div className="spacer" />
        {active && <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}><Pencil size={15} />Editar / remarcar</button>}
        {current.status === 'SCHEDULED' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setStatus('CONFIRMED', 'Presença confirmada.')}><Check size={15} />Confirmar</button>}
        {current.status === 'CONFIRMED' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setStatus('COMPLETED', 'Atendimento concluído.')}><CheckCheck size={15} />Concluir</button>}
      </>}
    >
      <div className="row-wrap">
        <span className={`badge ${STATUS[current.status].badge}`}>{STATUS[current.status].label}</span>
        <span className="badge plain soft">{current.source === 'BOT' ? <><Bot size={13} />Agendado pelo bot</> : <><User size={13} />Agendado pela equipe</>}</span>
      </div>

      <div className="card" style={{ boxShadow: 'none' }}>
        <div className="card-pad stack-sm">
          <Link href={`/clientes/${current.client.id}`} className="person">
            <span className="avatar sm">{current.client.name.slice(0, 1).toUpperCase()}</span>
            <div><strong>{current.client.name}</strong><small>{current.client.phone}</small></div>
          </Link>
          <div className="divider" />
          {current.items.map((i) => (
            <div key={i.id} className="row"><span>{i.name}</span><div className="spacer" /><small>{i.kind === 'PRODUCT' ? 'Produto' : duration(i.durationMinutes)}</small><strong className="mono">{money(i.priceCents)}</strong></div>
          ))}
          <div className="divider" />
          <div className="row"><strong>Total</strong><div className="spacer" /><small>{duration(minutes)}</small><strong className="mono">{money(current.totalCents)}</strong></div>
        </div>
      </div>

      <div className="stack-sm">
        <div className="row"><Clock size={16} className="muted" /><span>{reminder}</span></div>
        {current.staff && <div className="row"><User size={16} className="muted" /><span>Profissional: {current.staff.name}</span></div>}
        {current.notes && <div className="row" style={{ alignItems: 'flex-start' }}><CalendarClock size={16} className="muted" /><span>{current.notes}</span></div>}
      </div>

      {active && (
        <div className="row-wrap">
          <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => setStatus('NO_SHOW', 'Marcado como não compareceu.')}><UserX size={15} />Não compareceu</button>
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => setStatus('CANCELED', 'Agendamento cancelado.')}><X size={15} />Cancelar agendamento</button>
        </div>
      )}
      {!active && current.status !== 'COMPLETED' && (
        <button type="button" className="btn btn-sm btn-outline" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => setStatus('SCHEDULED', 'Agendamento reativado.')}>Reativar agendamento</button>
      )}
    </Modal>
  );
}
