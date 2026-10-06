'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarCheck, CalendarX2, Check, Clock, FileText, MapPin, MessageCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { Empty, Field, FormError } from '@/components/ui';
import { ApiError, bookingApi, errorMessage, type BookedFromLink, type PublicBooking, type PublicBookingResult } from '@/lib/api';
import { WEEKDAYS_LONG, addDays, brDate, duration, longDate, money, shortDate, today, weekday } from '@/lib/format';

// Agendamento pelo link pessoal que o bot manda no WhatsApp. O cliente já vem
// identificado (nome e telefone): escolhe o serviço, o dia e o horário livres.
// A confirmação também chega no WhatsApp.

type Step = 'services' | 'day' | 'time' | 'confirm';

const capitalize = (text: string) => text.replace(/^./, (c) => c.toUpperCase());
// Botões dos dias: "Hoje", "Amanhã", "Quarta · 07/10".
const dayChip = (iso: string) => {
  if (iso === today()) return 'Hoje';
  if (iso === addDays(today(), 1)) return 'Amanhã';
  return `${capitalize(WEEKDAYS_LONG[weekday(iso)].replace('-feira', ''))} · ${shortDate(iso)}`;
};
// Resumo e confirmação: "Amanhã (06/10)", "Quarta-feira, 7 de outubro".
const dayLabel = (iso: string) => {
  if (iso === today()) return `Hoje (${brDate(iso).slice(0, 5)})`;
  if (iso === addDays(today(), 1)) return `Amanhã (${brDate(iso).slice(0, 5)})`;
  return capitalize(longDate(iso));
};

export default function BookingPage() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('services');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [days, setDays] = useState<string[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<(PublicBookingResult & { notified: boolean; receiptUrl: string; address: string | null }) | null>(null);

  // Link de uso único: aberto de novo depois de agendar, mostra o agendamento feito.
  const [booked, setBooked] = useState<BookedFromLink | null>(null);

  useEffect(() => {
    bookingApi.get(token).then((b) => {
      if (b.booked) return setBooked(b.booked);
      setBooking(b);
      // Um serviço só: já vai para os dias.
      if (b.services.length === 1) chooseServices([b.services[0].id]);
    }).catch((err) => setLoadError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const chosen = useMemo(() => booking?.services.filter((s) => serviceIds.includes(s.id)) ?? [], [booking, serviceIds]);
  const totalMinutes = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalCents = chosen.reduce((sum, s) => sum + s.priceCents, 0);

  function chooseServices(ids: string[]) {
    setServiceIds(ids);
    setDays(null);
    setDate(null);
    setTime(null);
    setError(null);
    setStep('day');
    bookingApi.days(token, ids).then(setDays).catch((err) => { setDays([]); setError(errorMessage(err)); });
  }

  function chooseDay(day: string) {
    setDate(day);
    setTimes(null);
    setTime(null);
    setError(null);
    setStep('time');
    bookingApi.times(token, serviceIds, day).then(setTimes).catch((err) => { setTimes([]); setError(errorMessage(err)); });
  }

  function back() {
    setError(null);
    if (step === 'confirm') setStep('time');
    else if (step === 'time') setStep('day');
    else if (step === 'day') setStep('services');
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setError(null);
    setBusy(true);
    try {
      const result = await bookingApi.book(token, { serviceIds, date, time, name: booking?.client.name ? undefined : name.trim() });
      setDone({ ...result.appointment, notified: result.notified, receiptUrl: result.receiptUrl, address: result.address });
    } catch (err) {
      // Já agendou por este link (ex.: em outra aba): mostra o agendamento feito.
      if (err instanceof ApiError && err.code === 'LINK_USED') {
        bookingApi.get(token).then((b) => { if (b.booked) setBooked(b.booked); }).catch(() => setError(errorMessage(err)));
        return;
      }
      setError(errorMessage(err));
      // Horário ocupado (ou passou) enquanto escolhia: atualiza a lista.
      bookingApi.times(token, serviceIds, date).then(setTimes).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
      <Logo kind="wordmark" height={22} />
      <ThemeToggle />
    </header>
  );

  if (booked) {
    const a = booked.appointment;
    const canceled = a?.status === 'CANCELED';
    return (
      <main className="booking-page">
        {header}
        <div className="card">
          {a ? (
            <div className="card-body stack" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: 32 }}>
              <span className="metric-icon">{canceled ? <CalendarX2 size={20} /> : <Check size={20} />}</span>
              <h1 style={{ fontSize: 24 }}>{canceled ? 'Agendamento cancelado' : 'Agendamento confirmado'}</h1>
              {booked.company && <div className="eyebrow">{booked.company.name}</div>}
              <p className="muted">{a.services.join(' + ')}</p>
              <p><strong>{dayLabel(a.date)}</strong>, às <strong>{a.startTime}</strong> (até {a.endTime})</p>
              {a.totalCents > 0 && <p className="muted">Valor: {money(a.totalCents)}</p>}
              {booked.company?.address && <p className="muted"><MapPin size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{booked.company.address}</p>}
              {a.receiptUrl && <a className="btn btn-primary" href={new URL(a.receiptUrl).pathname}><FileText size={16} />Ver comprovante</a>}
              <p className="muted">
                <MessageCircle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
                {canceled ? 'Para marcar outro horário, peça um novo link pelo WhatsApp.' : 'Este link já foi usado. Para remarcar ou marcar outro horário, fale com a empresa pelo WhatsApp.'}
              </p>
            </div>
          ) : (
            <Empty icon={<CalendarX2 size={22} />} title="Este link já foi usado" text="Para marcar um horário, peça um novo link pelo WhatsApp." />
          )}
        </div>
      </main>
    );
  }

  if (loadError || !booking) {
    return (
      <main className="booking-page">
        {header}
        <div className="card">
          {loadError
            ? <Empty icon={<CalendarX2 size={22} />} title="Não foi possível abrir a agenda" text={loadError} />
            : <div className="loading-screen" style={{ minHeight: 240 }}><span className="spinner" /></div>}
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="booking-page">
        {header}
        <div className="card">
          <div className="card-body stack" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: 32 }}>
            <span className="metric-icon"><Check size={20} /></span>
            <h1 style={{ fontSize: 24 }}>Horário marcado!</h1>
            <p className="muted">{done.services.join(' + ')}</p>
            <p><strong>{dayLabel(done.date)}</strong>, às <strong>{done.startTime}</strong> (até {done.endTime})</p>
            {done.totalCents > 0 && <p className="muted">Valor: {money(done.totalCents)}</p>}
            {done.address && <p className="muted"><MapPin size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{done.address}</p>}
            <a className="btn btn-primary" href={new URL(done.receiptUrl).pathname}><FileText size={16} />Ver comprovante</a>
            {done.notified && <p className="muted"><MessageCircle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />A confirmação também foi enviada no seu WhatsApp.</p>}
            <p className="muted">Pode fechar esta página.</p>
          </div>
        </div>
      </main>
    );
  }

  const firstName = booking.client.name?.split(/\s+/)[0];

  return (
    <main className="booking-page">
      {header}
      <div className="stack">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{booking.company.name}</div>
          <h1 style={{ fontSize: 26 }}>{firstName ? `Olá, ${firstName}! ` : ''}Escolha seu horário</h1>
          <p className="muted" style={{ marginTop: 6 }}>Agendamento para {booking.client.name ?? 'você'} · {booking.client.phone}</p>
          {booking.company.address && <p className="muted" style={{ marginTop: 2 }}><MapPin size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{booking.company.address}</p>}
        </div>

        <div className="card">
          <div className="card-body stack">
            {step !== 'services' && !(step === 'day' && booking.services.length === 1) && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={back}><ArrowLeft size={15} />Voltar</button>
            )}
            {chosen.length > 0 && step !== 'services' && (
              <div className="row-wrap muted" style={{ fontSize: 13 }}>
                <span>{chosen.map((s) => s.name).join(' + ')}</span>
                <span>· <Clock size={13} style={{ verticalAlign: -2 }} /> {duration(totalMinutes)}</span>
                {totalCents > 0 && <span>· {money(totalCents)}</span>}
                {date && step !== 'day' && <span>· {dayLabel(date)}</span>}
              </div>
            )}
            <FormError message={error} />

            {step === 'services' && (
              booking.services.length === 0 ? (
                <Empty icon={<CalendarX2 size={22} />} title="Nenhum serviço disponível" text="Esta empresa ainda não tem serviços para agendar on-line. Fale com ela pelo WhatsApp." />
              ) : (
                <>
                  <h2 style={{ fontSize: 17 }}>Qual serviço?</h2>
                  <div className="stack-sm">
                    {booking.services.map((s) => {
                      const on = serviceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`booking-option${on ? ' on' : ''}`}
                          onClick={() => setServiceIds((ids) => (on ? ids.filter((id) => id !== s.id) : [...ids, s.id]))}
                          aria-pressed={on}
                        >
                          <span style={{ minWidth: 0 }}>
                            <strong>{s.name}</strong>
                            <small>{duration(s.durationMinutes)}{s.priceCents > 0 ? ` · ${money(s.priceCents)}` : ''}</small>
                            {s.description && <small>{s.description}</small>}
                          </span>
                          <span className="booking-check">{on && <Check size={14} />}</span>
                        </button>
                      );
                    })}
                  </div>
                  <small className="muted">Pode escolher mais de um.</small>
                  <button type="button" className="btn btn-primary" disabled={!serviceIds.length} onClick={() => chooseServices(serviceIds)}>Continuar</button>
                </>
              )
            )}

            {step === 'day' && (
              <>
                <h2 style={{ fontSize: 17 }}>Qual dia?</h2>
                {days === null ? (
                  <div className="loading-screen" style={{ minHeight: 120 }}><span className="spinner" /></div>
                ) : days.length === 0 ? (
                  <p className="muted">Não há dias com horário livre nas próximas semanas. Fale com a empresa pelo WhatsApp.</p>
                ) : (
                  <div className="booking-grid">
                    {days.map((d) => <button key={d} type="button" className={`chip${date === d ? ' on' : ''}`} onClick={() => chooseDay(d)}>{dayChip(d)}</button>)}
                  </div>
                )}
              </>
            )}

            {step === 'time' && (
              <>
                <h2 style={{ fontSize: 17 }}>Qual horário?</h2>
                {times === null ? (
                  <div className="loading-screen" style={{ minHeight: 120 }}><span className="spinner" /></div>
                ) : times.length === 0 ? (
                  <p className="muted">Não sobrou horário livre neste dia. Volte e escolha outro dia.</p>
                ) : (
                  <div className="booking-grid times">
                    {times.map((t) => <button key={t} type="button" className={`chip${time === t ? ' on' : ''}`} onClick={() => { setTime(t); setError(null); setStep('confirm'); }}>{t}</button>)}
                  </div>
                )}
              </>
            )}

            {step === 'confirm' && date && time && (
              <form className="stack" onSubmit={confirm}>
                <h2 style={{ fontSize: 17 }}>Confirme seu agendamento</h2>
                <div className="booking-summary">
                  <div><CalendarCheck size={16} /><span><strong>{dayLabel(date)}</strong>, às <strong>{time}</strong></span></div>
                  <div><Clock size={16} /><span>{chosen.map((s) => s.name).join(' + ')} · {duration(totalMinutes)}</span></div>
                  {totalCents > 0 && <div><span style={{ width: 16 }} /><span>Valor: <strong>{money(totalCents)}</strong></span></div>}
                  {booking.company.address && <div><MapPin size={16} /><span>{booking.company.address}</span></div>}
                </div>
                {!booking.client.name && (
                  <Field label="Seu nome">
                    <input className="input" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </Field>
                )}
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Confirmar agendamento</button>
              </form>
            )}
          </div>
        </div>
        <small className="muted" style={{ textAlign: 'center' }}>Agenda on-line por Sysora</small>
      </div>
    </main>
  );
}
