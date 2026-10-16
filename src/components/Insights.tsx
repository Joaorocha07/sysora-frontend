'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Clock, Ghost, Inbox, UserPlus, Users } from 'lucide-react';
import { Avatar, Empty, useToast } from './ui';
import { dashboardApi, errorMessage, type Insights as InsightsData } from '@/lib/api';
import { WEEKDAYS, relativeTime, shortDate } from '@/lib/format';

// Aba "Atendimento" do painel: como os clientes conversam pelo WhatsApp.
const PERIODS = [7, 30, 90];

const seconds = (s: number | undefined | null) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '0%');
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function HBars({ rows }: { rows: { label: string; value: number; hint?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.label} className="hbar" title={`${r.label}: ${r.value}${r.hint ? ` (${r.hint})` : ''}`}>
          <span>{r.label}</span>
          <div><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <b>{r.value}{r.hint && <small style={{ marginLeft: 4 }}>{r.hint}</small>}</b>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    setData(null);
    dashboardApi.insights(days).then(setData).catch((err) => toast(errorMessage(err), true));
  }, [days, toast]);

  const periodPicker = (
    <div className="segmented" style={{ marginBottom: 20 }}>
      {PERIODS.map((d) => <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>Últimos {d} dias</button>)}
    </div>
  );

  if (!data) return <>{periodPicker}<div className="loading-screen" style={{ minHeight: 240 }}><span className="spinner" /></div></>;

  const { totals, response } = data;
  const outbound = totals.bot + totals.staff;
  const metrics = [
    { label: 'Leads atendidos', value: totals.leads, hint: `${totals.newLeads} novos no período`, icon: Users },
    { label: 'Mensagens recebidas', value: totals.inbound, hint: `${outbound} enviadas`, icon: Inbox },
    { label: 'Respondidas pelo bot', value: pct(totals.bot, outbound), hint: `${totals.bot} de ${outbound} mensagens`, icon: Bot },
    { label: 'Resposta da equipe', value: seconds(response.staff?.median), hint: response.staff ? `Tempo mediano · ${response.staff.count} respostas` : 'Sem respostas da equipe', icon: Clock },
  ];

  // Série por dia, com os dias sem mensagem zerados.
  const series: { date: string; inbound: number; outbound: number }[] = [];
  const byDate = new Map(data.daily.map((d) => [d.date, d]));
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toLocaleDateString('en-CA');
    series.push(byDate.get(iso) ?? { date: iso, inbound: 0, outbound: 0 });
  }
  const maxDay = Math.max(1, ...series.map((d) => Math.max(d.inbound, d.outbound)));

  // Mapa de calor e horários.
  const heatMax = Math.max(1, ...data.heat.flat());
  const byHour = Array.from({ length: 24 }, (_, h) => data.heat.reduce((sum, day) => sum + day[h], 0));
  const byDay = data.heat.map((day) => day.reduce((a, b) => a + b, 0));
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakDay = byDay.indexOf(Math.max(...byDay));
  const open = toMin(data.hours.openingTime);
  const close = toMin(data.hours.closingTime);
  const inHours = data.heat.reduce((sum, day, dow) => sum + day.reduce((s, n, h) => (data.hours.workDays.includes(dow) && h * 60 >= open && h * 60 < close ? s + n : s), 0), 0);
  const shifts = [
    { label: 'Manhã (6h–12h)', value: byHour.slice(6, 12).reduce((a, b) => a + b, 0) },
    { label: 'Tarde (12h–18h)', value: byHour.slice(12, 18).reduce((a, b) => a + b, 0) },
    { label: 'Noite (18h–24h)', value: byHour.slice(18).reduce((a, b) => a + b, 0) },
    { label: 'Madrugada (0h–6h)', value: byHour.slice(0, 6).reduce((a, b) => a + b, 0) },
  ];
  const retentionTotal = data.retention.active + data.retention.cold + data.retention.inactive + data.retention.lost;
  const funnelTotal = data.funnel.reduce((s, f) => s + f.count, 0);

  if (!totals.inbound && !retentionTotal) {
    return (
      <>
        {periodPicker}
        <div className="card">
          <Empty icon={<Inbox size={22} />} title="Ainda sem conversas" text="Quando os clientes mandarem mensagem no WhatsApp conectado, os números do atendimento aparecem aqui." action={<Link href="/whatsapp" className="btn btn-primary btn-sm">Conectar WhatsApp</Link>} />
        </div>
      </>
    );
  }

  return (
    <>
      {periodPicker}
      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="insight-grid">
        <div className="card wide">
          <div className="card-head">
            <div><h2>Fluxo de mensagens</h2><p>Recebidas e enviadas por dia</p></div>
            <div className="legend"><span><i />Recebidas</span><span><i className="out" />Enviadas</span></div>
          </div>
          <div className="card-body">
            <div className="flow-chart" role="img" aria-label={`Mensagens por dia nos últimos ${days} dias`}>
              {series.map((d) => (
                <div key={d.date} title={`${shortDate(d.date)}: ${d.inbound} recebidas, ${d.outbound} enviadas`}>
                  <span style={{ height: `${(d.inbound / maxDay) * 100}%` }} />
                  <span className="out" style={{ height: `${(d.outbound / maxDay) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flow-axis"><span>{shortDate(series[0].date)}</span><span>{shortDate(series[Math.floor(series.length / 2)].date)}</span><span>Hoje</span></div>
          </div>
        </div>

        <div className="card wide">
          <div className="card-head"><div><h2>Quando os clientes escrevem</h2><p>Mensagens recebidas por dia da semana e hora (horário de Brasília)</p></div></div>
          <div className="card-body">
            <div className="heat" role="img" aria-label="Mapa de mensagens por dia e hora">
              <em />
              {Array.from({ length: 24 }, (_, h) => <em key={h} className="hour" style={{ justifyContent: 'center' }}>{h % 3 === 0 ? `${h}h` : ''}</em>)}
              {data.heat.map((day, dow) => [
                <em key={`l-${dow}`}>{WEEKDAYS[dow]}</em>,
                ...day.map((n, h) => (
                  <span
                    key={`${dow}-${h}`}
                    title={`${WEEKDAYS[dow]}, ${h}h: ${n} ${n === 1 ? 'mensagem' : 'mensagens'}`}
                    style={n ? { background: 'var(--ink)', opacity: 0.12 + (n / heatMax) * 0.88 } : undefined}
                  />
                )),
              ])}
            </div>
            <div className="mini-stats">
              <div><small>Horário de pico</small><strong>{byHour[peakHour] ? `${peakHour}h às ${peakHour + 1}h` : '—'}</strong></div>
              <div><small>Dia mais movimentado</small><strong>{byDay[peakDay] ? WEEKDAYS[peakDay] : '—'}</strong></div>
              <div><small>Dentro do horário de atendimento</small><strong>{pct(inHours, totals.inbound)}</strong></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Por turno</h2><p>Em que parte do dia os clientes mais escrevem</p></div></div>
          <div className="card-body"><HBars rows={shifts.map((s) => ({ ...s, hint: pct(s.value, totals.inbound) }))} /></div>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Engajamento</h2><p>Mensagens que cada lead mandou no período</p></div></div>
          <div className="card-body">
            <HBars rows={data.engagement.map((e) => ({ label: e.bucket === '1' ? '1 mensagem' : `${e.bucket} mensagens`, value: e.count }))} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Retenção</h2><p>Tempo desde a última mensagem de cada cliente</p></div></div>
          <div className="card-body">
            <HBars rows={[
              { label: 'Ativos (até 7 dias)', value: data.retention.active, hint: pct(data.retention.active, retentionTotal) },
              { label: 'Frios (8–15 dias)', value: data.retention.cold, hint: pct(data.retention.cold, retentionTotal) },
              { label: 'Inativos (16–30)', value: data.retention.inactive, hint: pct(data.retention.inactive, retentionTotal) },
              { label: 'Perdidos (+30)', value: data.retention.lost, hint: pct(data.retention.lost, retentionTotal) },
            ]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h2>Funil de vendas</h2><p>Clientes em cada etapa</p></div>
            <Link href="/funil" className="btn btn-sm btn-outline">Abrir <ArrowRight size={14} /></Link>
          </div>
          <div className="card-body"><HBars rows={data.funnel.map((f) => ({ label: f.name, value: f.count, hint: pct(f.count, funnelTotal) }))} /></div>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Novos leads hoje</h2><p>Primeira mensagem hoje · {data.todayCount}</p></div><span className="metric-icon"><UserPlus size={17} /></span></div>
          {data.todayLeads.length ? (
            <div className="lead-list" style={{ marginTop: 12 }}>
              {data.todayLeads.map((c) => (
                <Link key={c.id} href={`/conversas?cliente=${c.id}`}>
                  <Avatar name={c.name} size="sm" />
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>{c.name}</strong><small>{c.phone}</small></span>
                  <small>{relativeTime(c.firstAt)}</small>
                </Link>
              ))}
            </div>
          ) : <p className="muted" style={{ padding: '10px 24px 24px' }}>Nenhum lead novo hoje até agora.</p>}
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Mandaram 1 mensagem e sumiram</h2><p>Leads do período que não voltaram a escrever · {data.ghostCount}</p></div><span className="metric-icon"><Ghost size={17} /></span></div>
          {data.ghosts.length ? (
            <div className="lead-list" style={{ marginTop: 12 }}>
              {data.ghosts.map((c) => (
                <Link key={c.id} href={`/conversas?cliente=${c.id}`}>
                  <Avatar name={c.name} size="sm" />
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>{c.name}</strong><small>{c.phone}</small></span>
                  <small>{relativeTime(c.firstAt)}</small>
                </Link>
              ))}
            </div>
          ) : <p className="muted" style={{ padding: '10px 24px 24px' }}>Nenhum. Todo mundo que escreveu continuou a conversa.</p>}
        </div>
      </div>
    </>
  );
}
