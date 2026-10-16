'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bot, Cake, CalendarClock, CalendarPlus, Link2, Mail, MessageCircle, Pencil, Phone, StickyNote, Trash2, X } from 'lucide-react';
import BookingLinkModal from '@/components/BookingLinkModal';
import AppointmentDetails from '@/components/AppointmentDetails';
import AppointmentModal from '@/components/AppointmentModal';
import ClientFormModal from '@/components/ClientFormModal';
import { ClientNotesCard, ClientTagsButton, SCHEDULED_STATUS, ScheduleMessageModal, StageSelect, TagChip, scheduledWhen } from '@/components/Crm';
import { Avatar, ConfirmDialog, Empty, Loading, useToast } from '@/components/ui';
import { clientsApi, errorMessage, scheduledMessagesApi, type Appointment, type ClientDetail, type ScheduledMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS, brDate, money, relativeTime, today } from '@/lib/format';

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [messageModal, setSchedulingMessage] = useState<ScheduledMessage | 'new' | null>(null);
  const [sharingLink, setSharingLink] = useState(false);

  const load = useCallback(() => {
    clientsApi.get(id).then(setClient).catch((err) => { toast(errorMessage(err), true); router.replace('/clientes'); });
  }, [id, router, toast]);
  useEffect(load, [load]);

  const loadScheduled = useCallback(() => {
    scheduledMessagesApi.list({ clientId: id }).then(setScheduled).catch(() => {});
  }, [id]);
  useEffect(loadScheduled, [loadScheduled]);

  async function cancelScheduled(m: ScheduledMessage) {
    try {
      await scheduledMessagesApi.cancel(m.id);
      toast('Mensagem cancelada.');
      loadScheduled();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  async function remove() {
    try {
      await clientsApi.remove(id);
      toast('Cliente excluído.');
      router.replace('/clientes');
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  if (!client) return <Loading />;

  const upcoming = client.appointments.filter((a) => a.date >= today() && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED')).reverse();
  const history = client.appointments.filter((a) => !upcoming.includes(a));
  const spent = client.appointments.filter((a) => a.status === 'COMPLETED').reduce((sum, a) => sum + a.totalCents, 0);

  const row = (a: Appointment) => (
    <tr key={a.id} className="clickable" onClick={() => setSelected(a)}>
      <td><strong>{brDate(a.date)}</strong><small style={{ display: 'block' }}>{a.startTime} – {a.endTime}</small></td>
      <td>{a.items.map((i) => i.name).join(' + ')}{a.source === 'BOT' && <Bot size={13} style={{ marginLeft: 6, verticalAlign: -2 }} />}</td>
      <td className="hide-mobile mono">{money(a.totalCents)}</td>
      <td><span className={`badge ${STATUS[a.status].badge}`}>{STATUS[a.status].label}</span></td>
    </tr>
  );

  return (
    <>
      <Link href="/clientes" className="btn btn-ghost btn-sm" style={{ marginBottom: 16, paddingLeft: 8 }}><ArrowLeft size={16} />Clientes</Link>

      <div className="client-layout">
        <div className="card card-pad stack">
          <div className="row" style={{ gap: 16 }}>
            <Avatar name={client.name} size="lg" inverse />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 20 }}>{client.name}</h2>
              <small>{client.source === 'BOT' ? 'Cadastrado pelo bot' : 'Cadastrado pela equipe'} em {brDate(client.createdAt.slice(0, 10))}</small>
            </div>
          </div>
          <div className="stack-sm">
            <div className="row"><Phone size={16} className="muted" />{client.phone}</div>
            {client.email && <div className="row"><Mail size={16} className="muted" />{client.email}</div>}
            {client.birthday && <div className="row"><Cake size={16} className="muted" />{brDate(client.birthday)}</div>}
            {client.notes && <div className="row" style={{ alignItems: 'flex-start' }}><StickyNote size={16} className="muted" style={{ marginTop: 2 }} /><span style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</span></div>}
          </div>
          <div className="stack-sm">
            <small>Etapa do funil</small>
            <StageSelect clientId={client.id} value={client.stageId} onSaved={(stageId) => setClient({ ...client, stageId })} />
          </div>
          <div className="stack-sm">
            <small>Etiquetas</small>
            <div className="row-wrap" style={{ gap: 6 }}>
              {(client.tags ?? []).map((t) => <TagChip key={t.id} tag={t} />)}
              <ClientTagsButton clientId={client.id} value={(client.tags ?? []).map((t) => t.id)} onSaved={(tags) => setClient({ ...client, tags })} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            <div className="card" style={{ boxShadow: 'none', padding: 14 }}><small>Atendimentos</small><strong style={{ display: 'block', fontSize: 22, fontFamily: 'var(--display)' }}>{client.appointments.filter((a) => a.status === 'COMPLETED').length}</strong></div>
            <div className="card" style={{ boxShadow: 'none', padding: 14 }}><small>Total gasto</small><strong style={{ display: 'block', fontSize: 22, fontFamily: 'var(--display)' }}>{money(spent)}</strong></div>
          </div>
          <div className="stack-sm">
            <button type="button" className="btn btn-primary btn-block" onClick={() => setScheduling(true)}><CalendarPlus size={16} />Agendar</button>
            {client.whatsappId && (
              <Link href={`/conversas?cliente=${client.id}`} className="btn btn-outline btn-block">
                <MessageCircle size={16} />Conversa{client.lastMessageAt ? ` · ${relativeTime(client.lastMessageAt)}` : ''}
              </Link>
            )}
            {client.whatsappId && (
              <button type="button" className="btn btn-outline btn-block" onClick={() => setSchedulingMessage('new')}><CalendarClock size={16} />Agendar mensagem</button>
            )}
            <button type="button" className="btn btn-outline btn-block" onClick={() => setSharingLink(true)}><Link2 size={16} />Link de agendamento</button>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(true)}><Pencil size={15} />Editar</button>
              {isAdmin && <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setRemoving(true)}><Trash2 size={15} />Excluir</button>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h2>Próximos agendamentos</h2></div></div>
            {upcoming.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}><table className="table"><tbody>{upcoming.map(row)}</tbody></table></div>
            ) : (
              <p className="muted" style={{ padding: '10px 24px 24px' }}>Nenhum horário marcado.</p>
            )}
          </div>
          <div className="card">
            <div className="card-head"><div><h2>Histórico</h2><p>Atendimentos anteriores, cancelados e faltas</p></div></div>
            {history.length ? (
              <div className="table-wrap" style={{ marginTop: 12 }}><table className="table"><tbody>{history.map(row)}</tbody></table></div>
            ) : (
              <Empty icon={<CalendarPlus size={22} />} title="Sem histórico" text="Os atendimentos deste cliente vão aparecer aqui." />
            )}
          </div>
          {scheduled.length > 0 && (
            <div className="card">
              <div className="card-head"><div><h2>Mensagens agendadas</h2><p>Programadas pela equipe para este cliente</p></div></div>
              <div className="sched-list" style={{ marginTop: 12 }}>
                {scheduled.slice().reverse().slice(0, 10).map((m) => (
                  <div key={m.id} className="sched-item">
                    <div className="sched-when"><strong>{scheduledWhen(m.sendAt).split(' às ')[1]}</strong><small>{scheduledWhen(m.sendAt).split(' às ')[0]}</small></div>
                    <div style={{ minWidth: 0 }}>
                      <span className={`badge ${SCHEDULED_STATUS[m.status].badge}`} style={{ marginBottom: 4 }}>{SCHEDULED_STATUS[m.status].label}</span>
                      <p>{m.text}</p>
                      {m.error && <small>Motivo: {m.error}</small>}
                    </div>
                    <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                      {m.status === 'PENDING' && (
                        <>
                          <button type="button" className="icon-btn" onClick={() => setSchedulingMessage(m)} aria-label="Editar"><Pencil size={15} /></button>
                          <button type="button" className="icon-btn" onClick={() => cancelScheduled(m)} aria-label="Cancelar envio"><X size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ClientNotesCard clientId={client.id} />
        </div>
      </div>

      {editing && <ClientFormModal client={client} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('Cliente atualizado.'); load(); }} />}
      {scheduling && <AppointmentModal defaultClient={client} onClose={() => setScheduling(false)} onSaved={() => { setScheduling(false); toast('Agendamento criado.'); load(); }} />}
      {selected && <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {sharingLink && <BookingLinkModal client={client} onClose={() => setSharingLink(false)} />}
      {messageModal && (
        <ScheduleMessageModal
          client={client}
          message={messageModal === 'new' ? null : messageModal}
          onClose={() => setSchedulingMessage(null)}
          onSaved={() => { setSchedulingMessage(null); toast('Mensagem agendada.'); loadScheduled(); }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir cliente?"
          message={`${client.name} será removido junto com os agendamentos e a conversa. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir cliente"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(false)}
        />
      )}
    </>
  );
}
