'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bot, CalendarCheck, Check, CalendarDays, ClipboardList, MessageCircle, Plus, QrCode, TrendingUp, Users } from 'lucide-react';
import AppointmentDetails from '@/components/AppointmentDetails';
import AppointmentModal from '@/components/AppointmentModal';
import { Empty, Loading, useToast } from '@/components/ui';
import { dashboardApi, errorMessage, surveyApi, type Appointment, type Dashboard } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS, WEEKDAYS, firstName, longDate, money, shortDate, today, weekday } from '@/lib/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function PainelPage() {
  const { user, company, isAdmin } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  // Pesquisa inicial ainda não respondida: o aviso fica até a pessoa responder.
  const [surveyPending, setSurveyPending] = useState(false);

  const load = useCallback(() => {
    dashboardApi.get().then(setData).catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  useEffect(() => {
    surveyApi.status().then((r) => setSurveyPending(r.eligible && r.status !== 'done')).catch(() => {});
  }, []);

  if (!data) return <Loading />;

  const max = Math.max(1, ...data.week.map((d) => d.count));
  const metrics = [
    { label: 'Agendamentos hoje', value: data.todayCount, hint: longDate(today()), icon: CalendarDays },
    { label: 'Agendamentos no mês', value: data.monthAppointments, hint: `${data.botAppointmentsMonth} feitos pelo bot`, icon: Bot },
    { label: 'Clientes', value: data.clients, hint: `+${data.newClientsMonth} neste mês`, icon: Users },
    { label: 'Faturado no mês', value: money(data.monthRevenueCents), hint: `${data.monthCompleted} atendimentos concluídos`, icon: TrendingUp },
  ];

  return (
    <>
      <section className="welcome">
        <img src="/brand/sysora-icon-white.png" alt="" aria-hidden className="welcome-art logo-on-light" />
        <img src="/brand/sysora-icon-black.png" alt="" aria-hidden className="welcome-art logo-on-dark" />
        <div style={{ position: 'relative' }}>
          <div className="eyebrow">{company?.name}</div>
          <h1>{greeting()}, {firstName(user?.name ?? '')}.</h1>
          <p>
            {data.todayCount ? `Você tem ${data.todayCount} ${data.todayCount === 1 ? 'atendimento' : 'atendimentos'} hoje.` : 'Nenhum atendimento marcado para hoje.'}
            {' '}{data.unreadMessages ? `${data.unreadMessages} mensagens aguardando leitura.` : 'Nenhuma mensagem pendente.'}
          </p>
          <div className="row-wrap">
            <button type="button" className="btn" onClick={() => setCreating(true)}><Plus size={16} />Novo agendamento</button>
            {!data.whatsapp.whatsappConnected && isAdmin && (
              <Link href="/whatsapp" className="btn" style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}><QrCode size={16} />Conectar WhatsApp</Link>
            )}
          </div>
        </div>
      </section>

      {surveyPending && (
        <div className="card survey-invite">
          <span className="metric-icon"><ClipboardList size={18} /></span>
          <div>
            <strong style={{ display: 'block' }}>Falta pouco para conhecermos o seu negócio</strong>
            <small className="muted">Você ainda não respondeu a pesquisa rápida: são 4 perguntas de marcar, menos de 3 minutos, e ajudam a melhorar a Sysora para você.</small>
          </div>
          <Link href="/pesquisa" className="btn btn-primary btn-sm">Responder agora <ArrowRight size={15} /></Link>
        </div>
      )}

      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      {isAdmin && (data.servicesCount === 0 || !data.hoursReviewed || !data.whatsapp.whatsappConnected || data.pendingUsers > 0) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head" style={{ paddingBottom: 14 }}><div><h2>Primeiros passos</h2><p>Deixe o bot pronto para atender seus clientes</p></div></div>
          <div className="onboarding">
            {[
              { done: data.servicesCount > 0, href: '/servicos', title: 'Monte seu catálogo', text: 'Serviços com duração e preço (e produtos, se vender). O bot usa essa lista no WhatsApp.' },
              { done: data.hoursReviewed, href: '/configuracoes?aba=horarios', title: 'Confira os horários de atendimento', text: 'Dias, abertura, fechamento e intervalo de almoço.' },
              { done: data.whatsapp.whatsappConnected, href: '/whatsapp', title: 'Conecte o WhatsApp', text: 'Conecte o número da empresa pelo WhatsApp oficial, em poucos cliques.' },
              ...(data.pendingUsers > 0 ? [{ done: false, href: '/equipe', title: `Aprove ${data.pendingUsers} ${data.pendingUsers === 1 ? 'pedido' : 'pedidos'} de acesso`, text: 'Pessoas da equipe pediram para entrar com o código da empresa.' }] : []),
            ].map((step) => (
              <Link key={step.href} href={step.href}>
                <span className={`check${step.done ? ' done' : ''}`}>{step.done && <Check size={14} />}</span>
                <span style={{ flex: 1 }}><strong style={{ display: 'block', textDecoration: step.done ? 'line-through' : 'none' }}>{step.title}</strong><small>{step.text}</small></span>
                <ArrowRight size={16} className="muted" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div><h2>Agenda de hoje</h2><p>{longDate(today())}</p></div>
            <Link href="/agenda" className="btn btn-sm btn-outline">Abrir agenda <ArrowRight size={14} /></Link>
          </div>
          <div style={{ paddingTop: 12 }}>
            {data.today.length ? (
              <div className="timeline">
                {data.today.map((a) => (
                  <button key={a.id} type="button" className="timeline-item" style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', width: '100%' }} onClick={() => setSelected(a)}>
                    <span className="timeline-time">{a.startTime}<small className="muted">até {a.endTime}</small></span>
                    <span className="person">
                      <span className="avatar sm">{a.client.name.slice(0, 1).toUpperCase()}</span>
                      <span style={{ minWidth: 0 }}><strong>{a.client.name}</strong><small>{a.items.map((i) => i.name).join(' + ')}</small></span>
                    </span>
                    <span className={`badge ${STATUS[a.status].badge}`}>{STATUS[a.status].label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty icon={<CalendarCheck size={22} />} title="Dia livre" text="Quando o bot ou a equipe marcar um horário para hoje, ele aparece aqui." />
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h2>Últimos 7 dias</h2><p>Agendamentos por dia</p></div></div>
            <div className="card-body">
              <div className="bars">
                {data.week.map((d) => (
                  <div key={d.date} className={`bar${d.date === today() ? ' today' : ''}`} title={`${shortDate(d.date)}: ${d.count}`}>
                    <b>{d.count}</b>
                    <div style={{ height: `${(d.count / max) * 120}px` }} />
                    <span>{WEEKDAYS[weekday(d.date)]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div><h2>Próximos</h2><p>Depois de hoje</p></div></div>
            <div style={{ paddingTop: 8 }}>
              {data.upcoming.length ? data.upcoming.map((a) => (
                <button key={a.id} type="button" className="timeline-item" style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', width: '100%', gridTemplateColumns: '64px 1fr' }} onClick={() => setSelected(a)}>
                  <span className="timeline-time" style={{ fontSize: 14 }}>{shortDate(a.date)}<small className="muted">{a.startTime}</small></span>
                  <span className="person"><span style={{ minWidth: 0 }}><strong>{a.client.name}</strong><small>{a.items.map((i) => i.name).join(' + ')}</small></span></span>
                </button>
              )) : <p className="muted" style={{ padding: '8px 24px 24px' }}>Nenhum agendamento futuro.</p>}
            </div>
          </div>

          <div className="card card-pad row" style={{ gap: 14 }}>
            <span className="metric-icon"><MessageCircle size={17} /></span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block' }}>WhatsApp {data.whatsapp.whatsappConnected ? 'conectado' : 'desconectado'}</strong>
              <small>{data.whatsapp.whatsappConnected ? `${data.whatsapp.whatsappPhone ?? ''} · bot ${data.whatsapp.botEnabled ? 'ligado' : 'desligado'}` : 'O bot só atende com o número conectado.'}</small>
            </div>
            <Link href={isAdmin ? '/whatsapp' : '/conversas'} className="icon-btn bordered"><ArrowRight size={16} /></Link>
          </div>
        </div>
      </div>

      {creating && <AppointmentModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); toast('Agendamento criado.'); load(); }} />}
      {selected && <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </>
  );
}
