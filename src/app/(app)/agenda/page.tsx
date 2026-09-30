'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CalendarCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import AppointmentDetails from '@/components/AppointmentDetails';
import AppointmentModal from '@/components/AppointmentModal';
import { Empty, PageHead, useToast } from '@/components/ui';
import { appointmentsApi, errorMessage, settingsApi, type Appointment } from '@/lib/api';
import { STATUS, WEEKDAYS, addDays, longDate, monthLabel, startOfWeek, today, weekday } from '@/lib/format';

type View = 'semana' | 'dia';

export default function AgendaPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('semana');
  const [anchor, setAnchor] = useState(today());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);

  const from = view === 'semana' ? startOfWeek(anchor) : anchor;
  const to = view === 'semana' ? addDays(from, 6) : anchor;
  const days = useMemo(() => Array.from({ length: view === 'semana' ? 7 : 1 }, (_, i) => addDays(from, i)), [from, view]);

  const load = useCallback(() => {
    setLoading(true);
    appointmentsApi.list({ from, to })
      .then(setAppointments)
      .catch((err) => toast(errorMessage(err), true))
      .finally(() => setLoading(false));
  }, [from, to, toast]);
  useEffect(load, [load]);

  useEffect(() => { settingsApi.get().then((r) => setWorkDays(r.settings.workDays)).catch(() => {}); }, []);

  const visible = appointments.filter((a) => showCanceled || (a.status !== 'CANCELED'));
  const byDay = (date: string) => visible.filter((a) => a.date === date);
  const step = view === 'semana' ? 7 : 1;

  const title = view === 'semana' ? `Semana de ${from.split('-').reverse().slice(0, 2).join('/')} a ${to.split('-').reverse().slice(0, 2).join('/')}` : longDate(anchor);

  return (
    <>
      <PageHead
        eyebrow="Agenda"
        title={monthLabel(anchor).replace(/^\w/, (c) => c.toUpperCase())}
        text={title}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(anchor < today() ? today() : anchor)}><Plus size={16} />Novo agendamento</button>}
      />

      <div className="agenda-bar">
        <div className="row">
          <button type="button" className="icon-btn bordered" onClick={() => setAnchor(addDays(anchor, -step))} aria-label="Anterior"><ChevronLeft size={18} /></button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setAnchor(today())}>Hoje</button>
          <button type="button" className="icon-btn bordered" onClick={() => setAnchor(addDays(anchor, step))} aria-label="Próximo"><ChevronRight size={18} /></button>
        </div>
        <input type="date" className="input" style={{ width: 170, height: 38 }} value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
        <div className="segmented">
          <button type="button" className={view === 'semana' ? 'on' : ''} onClick={() => setView('semana')}>Semana</button>
          <button type="button" className={view === 'dia' ? 'on' : ''} onClick={() => setView('dia')}>Dia</button>
        </div>
        <div className="spacer" />
        <label className="row" style={{ fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showCanceled} onChange={(e) => setShowCanceled(e.target.checked)} /> Mostrar cancelados
        </label>
        {loading && <span className="spinner" />}
      </div>

      {view === 'semana' ? (
        <div className="week">
          {days.map((date) => {
            const items = byDay(date);
            const off = !workDays.includes(weekday(date));
            return (
              <div key={date} className={`day-col${date === today() ? ' today' : ''}${off ? ' off' : ''}`}>
                <div className="day-head" onClick={() => { setAnchor(date); setView('dia'); }} title="Ver o dia">
                  <span>{WEEKDAYS[weekday(date)]}</span>
                  <strong>{date.slice(8)}</strong>
                </div>
                <div className="day-list">
                  {items.map((a) => (
                    <button key={a.id} type="button" className={`appt ${a.status}`} onClick={() => setSelected(a)}>
                      <span className="t">{a.startTime} {a.source === 'BOT' && <Bot size={11} style={{ verticalAlign: -1 }} />}</span>
                      <strong>{a.client.name}</strong>
                      <small>{a.items.map((i) => i.name).join(' + ')}</small>
                    </button>
                  ))}
                  {off && !items.length && <small style={{ padding: '4px 6px' }}>Fechado</small>}
                </div>
                {date >= today() && <button type="button" className="add-slot" onClick={() => setCreating(date)}>+ agendar</button>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card day-list-view">
          {byDay(anchor).length ? (
            <div className="timeline">
              {byDay(anchor).map((a) => (
                <button key={a.id} type="button" className="timeline-item" style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', width: '100%' }} onClick={() => setSelected(a)}>
                  <span className="timeline-time">{a.startTime}<small className="muted">até {a.endTime}</small></span>
                  <span className="person">
                    <span className="avatar sm">{a.client.name.slice(0, 1).toUpperCase()}</span>
                    <span style={{ minWidth: 0 }}><strong>{a.client.name}</strong><small>{a.items.map((i) => i.name).join(' + ')}{a.staff ? ` · ${a.staff.name}` : ''}</small></span>
                  </span>
                  <span className="hide-mobile">{a.source === 'BOT' ? <span className="badge plain soft"><Bot size={13} />Bot</span> : null}</span>
                  <span className={`badge ${STATUS[a.status].badge}`}>{STATUS[a.status].label}</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarCheck size={22} />}
              title="Nenhum agendamento neste dia"
              text={workDays.includes(weekday(anchor)) ? 'Crie um agendamento ou deixe o bot marcar pelo WhatsApp.' : 'A empresa não atende neste dia da semana.'}
              action={anchor >= today() ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(anchor)}><Plus size={15} />Agendar</button> : undefined}
            />
          )}
        </div>
      )}

      <div className="legend" style={{ marginTop: 16 }}>
        {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => <span key={s} className={`badge ${STATUS[s].badge}`}>{STATUS[s].label}</span>)}
        <span className="badge plain soft"><Bot size={13} />Agendado pelo bot</span>
      </div>

      {creating && <AppointmentModal defaultDate={creating} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); toast('Agendamento criado.'); load(); }} />}
      {selected && <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </>
  );
}
