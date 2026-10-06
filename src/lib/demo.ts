// Modo demonstração: uma API falsa, em memória, para navegar pela Sysora sem
// backend. Ativado pelo botão "Ver demonstração" (localStorage 'sysora-demo').
// Os dados são gerados a partir da data de hoje e somem ao recarregar a página.
import type {
  AdminCompany, AdminUser, Appointment, AppointmentStatus, Client, Conversation, FlowNode, Member, Message, Service, Session, Settings, Subscription,
} from './api';
import { PLANS } from './plans';

export type DemoMode = 'empresa' | 'master';
// Configuração "cadastro pelo site" do painel master na demonstração.
let demoPublicSignup = true;
const KEY = 'sysora-demo';
const COMPANY_KEY = 'sysora-demo-company';

export function demoMode(): DemoMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(KEY);
    return value === 'empresa' || value === 'master' ? value : null;
  } catch {
    return null;
  }
}

export function startDemo(mode: DemoMode) {
  try { localStorage.setItem(KEY, mode); sessionStorage.removeItem(COMPANY_KEY); } catch { /* navegação privada */ }
  loggedIn = true;
  db = null;
}

export function stopDemo() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(COMPANY_KEY); } catch { /* navegação privada */ }
  loggedIn = false;
  db = null;
}

// ============ Dados ============
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
let seq = 1000;
const id = () => `demo-${seq++}`;

const DEMO_COMPANIES = [
  { id: 'demo-co-1', name: 'Studio Aurora', slug: 'studio-aurora' },
  { id: 'demo-co-2', name: 'Studio Aurora Centro', slug: 'studio-aurora-centro' },
];

function subscription(): Subscription {
  const plan = PLANS.find((p) => p.id === 'AVANCADO')!;
  const trialEndsAt = new Date(Date.now() + 5 * 86400000).toISOString();
  return {
    accountId: 'demo-account', plan: plan.id, planName: plan.name, priceCents: plan.priceCents, status: 'TRIAL',
    trialEndsAt, paidUntil: null, active: true, maxCompanies: plan.maxCompanies, maxEmployees: plan.maxEmployees,
    // Como no servidor: o teste grátis não tem IA.
    ai: false, sora: false, soraBudgetUsd: plan.soraBudgetUsd,
  };
}

function build() {
  const services: Service[] = [
    { id: 's1', kind: 'SERVICE', name: 'Consulta', description: 'Primeira conversa e avaliação completa.', durationMinutes: 60, priceCents: 15000, active: true, position: 0 },
    { id: 's2', kind: 'SERVICE', name: 'Retorno', description: null, durationMinutes: 30, priceCents: 0, active: true, position: 1 },
    { id: 's3', kind: 'SERVICE', name: 'Sessão completa', description: 'Atendimento de 90 minutos.', durationMinutes: 90, priceCents: 22000, active: true, position: 2 },
    { id: 's4', kind: 'SERVICE', name: 'Avaliação rápida', description: null, durationMinutes: 20, priceCents: 6000, active: true, position: 3 },
    { id: 's5', kind: 'SERVICE', name: 'Pacote mensal', description: 'Quatro sessões no mês.', durationMinutes: 60, priceCents: 52000, active: false, position: 4 },
    { id: 's6', kind: 'PRODUCT', name: 'Kit de cuidados em casa', description: 'Produtos para manter o resultado entre as sessões.', durationMinutes: 0, priceCents: 8900, active: true, position: 5 },
  ];
  const names = ['Ana Lima', 'Bruno Martins', 'Carla Souza', 'Diego Alves', 'Eduarda Rocha', 'Felipe Costa', 'Gabriela Nunes', 'Henrique Dias', 'Isabela Freitas', 'João Pedro Silva', 'Larissa Moura', 'Marcos Vinícius'];
  const clients: Client[] = names.map((name, i) => ({
    id: `c${i + 1}`, name, phone: `(31) 9${8000 + i * 37}-${1000 + i * 111}`, email: i % 3 === 0 ? `${name.split(' ')[0].toLowerCase()}@email.com` : null,
    birthday: i % 4 === 0 ? `199${i % 10}-0${(i % 9) + 1}-1${i % 9}` : null, notes: i === 0 ? 'Prefere horários pela manhã.' : null,
    whatsappId: `55319${8000 + i * 37}${1000 + i * 111}`, source: i % 3 === 2 ? 'STAFF' : 'BOT',
    lastMessageAt: i < 7 ? ago(i * 47 + 3) : null, unreadCount: i < 3 ? 3 - i : 0, createdAt: ago(60 * 24 * (i * 3 + 1)),
  }));
  const members: Member[] = [
    { membershipId: 'm1', id: 'demo-user', name: 'Você (demonstração)', email: 'voce@studioaurora.com', phone: null, avatarUrl: null, role: 'ADMIN', active: true, createdAt: ago(60 * 24 * 40) },
    { membershipId: 'm2', id: 'u2', name: 'Paula Ribeiro', email: 'paula@studioaurora.com', phone: '(31) 98888-1111', avatarUrl: null, role: 'EMPLOYEE', active: true, createdAt: ago(60 * 24 * 20) },
    { membershipId: 'm3', id: 'u3', name: 'Rafael Gomes', email: 'rafael@studioaurora.com', phone: null, avatarUrl: null, role: 'EMPLOYEE', active: true, createdAt: ago(60 * 24 * 9) },
  ];
  const pending: Member[] = [
    { membershipId: 'm4', id: 'u4', name: 'Sofia Andrade', email: 'sofia@gmail.com', phone: '(31) 97777-2222', avatarUrl: null, role: 'EMPLOYEE', active: true, createdAt: ago(90) },
  ];

  const plan: [number, string, string[], AppointmentStatus, 'BOT' | 'STAFF'][] = [
    [-3, '09:00', ['s1'], 'COMPLETED', 'BOT'], [-2, '14:00', ['s3'], 'COMPLETED', 'STAFF'], [-1, '10:30', ['s2'], 'NO_SHOW', 'BOT'],
    [-1, '16:00', ['s1', 's6'], 'COMPLETED', 'BOT'], [0, '09:00', ['s1'], 'CONFIRMED', 'BOT'], [0, '10:30', ['s4'], 'SCHEDULED', 'STAFF'],
    [0, '14:00', ['s3'], 'CONFIRMED', 'BOT'], [0, '16:30', ['s2'], 'SCHEDULED', 'BOT'], [1, '09:30', ['s1'], 'SCHEDULED', 'BOT'],
    [1, '11:00', ['s2'], 'CANCELED', 'BOT'], [1, '15:00', ['s3'], 'CONFIRMED', 'STAFF'], [2, '10:00', ['s1', 's4'], 'SCHEDULED', 'BOT'],
    [3, '13:30', ['s1'], 'SCHEDULED', 'BOT'], [4, '09:00', ['s3'], 'SCHEDULED', 'STAFF'], [5, '10:00', ['s2'], 'SCHEDULED', 'BOT'],
  ];
  const appointments: Appointment[] = plan.map(([offset, start, ids, status, source], i) => {
    const items = ids.map((sid) => { const s = services.find((x) => x.id === sid)!; return { id: id(), serviceId: s.id, kind: s.kind, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents }; });
    const client = clients[i % clients.length];
    const minutes = items.reduce((sum, it) => sum + it.durationMinutes, 0);
    return {
      id: `a${i + 1}`, clientId: client.id, staffId: i % 4 === 1 ? 'u2' : null, date: dayOffset(offset), startTime: start, endTime: fromMin(toMin(start) + minutes),
      status, source, notes: null, totalCents: items.reduce((sum, it) => sum + it.priceCents, 0),
      reminderSentAt: offset >= 0 && status === 'SCHEDULED' && offset <= 1 ? ago(120) : null, hourReminderSentAt: null,
      confirmedAt: status === 'CONFIRMED' ? ago(200) : null, createdAt: ago(60 * 24 * 2),
      items, client: { id: client.id, name: client.name, phone: client.phone, whatsappId: client.whatsappId },
      staff: i % 4 === 1 ? { id: 'u2', name: 'Paula Ribeiro' } : null,
    };
  });

  const messages: Record<string, Message[]> = {};
  clients.slice(0, 7).forEach((c, i) => {
    const base = i * 47 + 12;
    const first = c.name.split(' ')[0];
    messages[c.id] = [
      { id: id(), text: 'Oi, boa tarde!', sender: 'CLIENT', staffName: null, createdAt: ago(base + 9) },
      { id: id(), text: `Olá, ${first}! Bem-vindo(a) ao Studio Aurora.`, sender: 'BOT', staffName: null, createdAt: ago(base + 9) },
      { id: id(), text: 'Como posso te ajudar? Responda com o número:\n\n1) Agendar um horário\n2) Meus agendamentos\n3) Serviços e valores\n4) Falar com a equipe', sender: 'BOT', staffName: null, createdAt: ago(base + 9) },
      { id: id(), text: i === 1 ? '4' : '1', sender: 'CLIENT', staffName: null, createdAt: ago(base + 8) },
      ...(i === 1
        ? [
            { id: id(), text: 'Certo! Uma pessoa da nossa equipe vai te responder por aqui em instantes.', sender: 'BOT' as const, staffName: null, createdAt: ago(base + 8) },
            { id: id(), text: 'Vocês aceitam cartão?', sender: 'CLIENT' as const, staffName: null, createdAt: ago(base + 7) },
            { id: id(), text: 'Aceitamos sim! Débito, crédito e Pix 😊', sender: 'STAFF' as const, staffName: 'Paula Ribeiro', createdAt: ago(base + 5) },
          ]
        : [
            { id: id(), text: 'Estes são os próximos dias com horário livre:\n\n1) amanhã\n2) depois de amanhã', sender: 'BOT' as const, staffName: null, createdAt: ago(base + 8) },
            { id: id(), text: '1', sender: 'CLIENT' as const, staffName: null, createdAt: ago(base + 4) },
            { id: id(), text: `Agendado! Consulta amanhã às 09:30. Até lá, ${first}!`, sender: 'BOT' as const, staffName: null, createdAt: ago(base + 3) },
          ]),
    ];
  });

  const settings: Settings = {
    openingTime: '09:00', closingTime: '18:00', workDays: [1, 2, 3, 4, 5, 6], slotMinutes: 30, slotCapacity: 1,
    lunchEnabled: true, lunchStart: '12:00', lunchEnd: '13:00', whatsappConnected: false, whatsappPhone: null,
    botEnabled: true, autoCreateClient: true, askName: true, botAiEnabled: true, transcribeAudio: true,
    greetingMessage: 'Olá, {nome}! Bem-vindo(a) à {empresa}.', handoffMessage: 'Certo! Uma pessoa da nossa equipe vai te responder por aqui em instantes.',
    confirmationMessage: 'Agendado! {servico} no dia {data} às {hora}. Até lá, {nome}!',
    reminderEnabled: true, reminderTime: '10:00', reminderMessage: 'Oi, {nome}! Passando para lembrar do seu horário amanhã: {servico} no dia {data} às {hora}.',
    hourReminderEnabled: true, hourReminderMinutes: 60, hourReminderMessage: 'Oi, {nome}! Seu horário é hoje às {hora}: {servico}. Te esperamos!',
    pauseOnStaffReply: true, humanTimeoutMinutes: 30, humanEndMessage: 'Seu atendimento com a nossa equipe foi encerrado. Obrigado pelo contato!',
  };

  const sub = subscription();
  const adminCompanies: AdminCompany[] = [
    ['Studio Aurora', 'AVANCADO', 'TRIAL', true, 12, 15], ['Clínica Bem Viver', 'INICIAL', 'ACTIVE', false, 86, 240],
    ['Barbearia Navalha', 'AVANCADO', 'ACTIVE', true, 143, 512], ['Pet Feliz', 'INICIAL', 'PAST_DUE', false, 31, 77],
  ].map(([name, planId, status, self, clientsCount, appts], i) => {
    const p = PLANS.find((x) => x.id === planId)!;
    return {
      id: i === 0 ? DEMO_COMPANIES[0].id : `demo-admin-co-${i}`, name: name as string, slug: String(name).toLowerCase().replace(/\s+/g, '-'),
      document: null, phone: null, email: null, active: true, selfSignup: self as boolean, inviteCode: `DEMO${i}X7K2`, createdAt: ago(60 * 24 * (i * 25 + 5)),
      subscription: { ...sub, accountId: `acc-${i}`, plan: p.id, planName: p.name, priceCents: p.priceCents, status: status as Subscription['status'],
        trialEndsAt: status === 'TRIAL' ? sub.trialEndsAt : null, paidUntil: status === 'TRIAL' ? null : new Date(Date.now() + (status === 'PAST_DUE' ? -2 : 18) * 86400000).toISOString(),
        maxCompanies: p.maxCompanies, maxEmployees: p.maxEmployees },
      whatsappConnected: i !== 3, whatsappPhone: i !== 3 ? `553199${i}001234` : null, users: 2 + i,
      admins: [{ id: `adm-${i}`, name: ['Você (demonstração)', 'Dra. Helena Prado', 'Carlos Navalha', 'Juliana Pet'][i], email: `admin${i}@exemplo.com`, avatarUrl: null }],
      clients: clientsCount as number, appointments: appts as number, services: 4 + i,
    };
  });

  // O master começa no painel master (fora de empresa); o dono já dentro da
  // empresa. A empresa aberta sobrevive a um F5 (o resto dos dados, não).
  let companyIdx = demoMode() === 'master' ? -1 : 0;
  try {
    const saved = sessionStorage.getItem(COMPANY_KEY);
    if (saved !== null) companyIdx = Number(saved);
  } catch { /* navegação privada */ }
  return { services, clients, members, pending, appointments, messages, settings, adminCompanies, sub, whatsappSince: 0, companyIdx, flows: null as { id: string; name: string; flow: FlowNode; updatedAt: string }[] | null, activeFlowId: '' };
}

// Mesmo fluxo padrão do backend (whatsapp.flow.ts).
function defaultDemoFlow(greeting: string): FlowNode {
  const labels = { agendar: 'Agendar um horário', meus: 'Meus agendamentos', servicos: 'Serviços e valores', equipe: 'Falar com a equipe' } as const;
  return {
    id: 'inicio', label: 'Início', type: 'menu', messages: [greeting], together: false, prompt: 'Como posso te ajudar? Responda com o número:',
    options: (Object.keys(labels) as (keyof typeof labels)[]).map((action) => ({ id: action, label: labels[action], type: 'action', action, messages: [], together: true })),
  };
}

// Sem servidor não há IA: palavras-chave imitam o que ela entenderia no simulador.
function demoUnderstand({ flow, text }: { flow: FlowNode; text: string }) {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const intent = /remarc|cancel|desmarc|meus/.test(t) ? 'meus' : /agend|marcar|horario/.test(t) ? 'agendar'
    : /preco|valor|quanto|servico/.test(t) ? 'servicos' : /atendente|pessoa|humano|falar/.test(t) ? 'equipe' : 'pergunta';
  const option = flow.options?.find((o) => o.type === 'action' && o.action === intent)
    ?? flow.options?.find((o) => t.includes(o.label.toLowerCase()));
  return {
    optionId: option?.id ?? null,
    intent: option ? intent : 'pergunta',
    answer: option ? null : 'No modo demonstração a IA não responde perguntas. Com o servidor, ela usa os dados da sua empresa.',
    services: [], date: null, time: null,
    usage: { used: 0, limit: 1500, available: true, transcription: true },
  };
}

let db: ReturnType<typeof build> | null = null;
const data = () => (db ??= build());
let loggedIn = true;

function session(): Session {
  const master = demoMode() === 'master';
  const company = data().companyIdx === -1 ? null : DEMO_COMPANIES[data().companyIdx];
  return {
    accessToken: 'demo',
    user: { id: 'demo-user', name: master ? 'Admin Master (demonstração)' : 'Você (demonstração)', email: 'demo@sysora.com.br', isSuperAdmin: master, avatarUrl: null },
    company,
    role: company ? 'ADMIN' : null,
    subscription: company ? data().sub : null,
  };
}

// ============ Roteamento ============
class DemoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (message: string, status = 400): never => { throw new DemoError(status, message); };

const withCount = (s: Service) => ({ ...s, _count: { appointments: data().appointments.filter((a) => a.items.some((i) => i.serviceId === s.id)).length } });
const clientCount = (c: Client) => ({ ...c, _count: { appointments: data().appointments.filter((a) => a.clientId === c.id).length } });

function makeAppointment(body: { clientId?: string; serviceIds: string[]; date: string; startTime: string; staffId?: string | null; notes?: string | null }, base?: Appointment): Appointment {
  const d = data();
  const items = body.serviceIds.map((sid) => { const s = d.services.find((x) => x.id === sid) ?? fail('Serviço não encontrado.'); return { id: id(), serviceId: s.id, kind: s.kind, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents }; });
  const client = d.clients.find((c) => c.id === (body.clientId ?? base?.clientId)) ?? fail('Cliente não encontrado.');
  const staff = d.members.find((m) => m.id === body.staffId);
  const minutes = items.reduce((sum, it) => sum + it.durationMinutes, 0);
  return {
    ...(base ?? { id: id(), status: 'SCHEDULED', source: 'STAFF', reminderSentAt: null, hourReminderSentAt: null, confirmedAt: null, createdAt: new Date().toISOString() }),
    clientId: client.id, staffId: staff?.id ?? null, date: body.date, startTime: body.startTime, endTime: fromMin(toMin(body.startTime) + minutes),
    notes: body.notes ?? null, totalCents: items.reduce((sum, it) => sum + it.priceCents, 0), items,
    client: { id: client.id, name: client.name, phone: client.phone, whatsappId: client.whatsappId }, staff: staff ? { id: staff.id, name: staff.name } : null,
  } as Appointment;
}

function freeTimes(date: string, serviceIds: string[], excludeId?: string) {
  const d = data();
  const minutes = serviceIds.reduce((sum, sid) => sum + (d.services.find((s) => s.id === sid)?.durationMinutes ?? 30), 0) || 30;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (!d.settings.workDays.includes(weekday) || date < dayOffset(0)) return { times: [], duration: minutes };
  const busy = d.appointments.filter((a) => a.date === date && a.id !== excludeId && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'));
  const now = new Date();
  const times: string[] = [];
  for (let t = toMin(d.settings.openingTime); t + minutes <= toMin(d.settings.closingTime); t += d.settings.slotMinutes) {
    if (date === dayOffset(0) && t < now.getHours() * 60 + now.getMinutes() + 30) continue;
    if (d.settings.lunchEnabled && t < toMin(d.settings.lunchEnd) && t + minutes > toMin(d.settings.lunchStart)) continue;
    if (busy.some((b) => t < toMin(b.endTime) && toMin(b.startTime) < t + minutes)) continue;
    times.push(fromMin(t));
  }
  return { times, duration: minutes };
}

function dashboard() {
  const d = data();
  const today = dayOffset(0);
  const month = today.slice(0, 8);
  const notCanceled = d.appointments.filter((a) => a.status !== 'CANCELED');
  const completed = d.appointments.filter((a) => a.status === 'COMPLETED' && a.date.startsWith(month));
  const sorted = (list: Appointment[]) => [...list].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  return {
    clients: d.clients.length, newClientsMonth: 5, todayCount: notCanceled.filter((a) => a.date === today).length,
    monthAppointments: notCanceled.filter((a) => a.date.startsWith(month)).length, monthCompleted: completed.length,
    monthRevenueCents: completed.reduce((sum, a) => sum + a.totalCents, 0), botAppointmentsMonth: d.appointments.filter((a) => a.source === 'BOT').length,
    unreadMessages: d.clients.reduce((sum, c) => sum + c.unreadCount, 0), servicesCount: d.services.filter((s) => s.active).length, pendingUsers: d.pending.length,
    whatsapp: { whatsappConnected: d.settings.whatsappConnected, whatsappPhone: d.settings.whatsappPhone, botEnabled: d.settings.botEnabled },
    today: sorted(notCanceled.filter((a) => a.date === today)),
    upcoming: sorted(d.appointments.filter((a) => a.date > today && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'))).slice(0, 6),
    week: Array.from({ length: 7 }, (_, i) => { const date = dayOffset(i - 6); return { date, count: notCanceled.filter((a) => a.date === date).length }; }),
  };
}

// QR Code de mentira (desenho em blocos) para a tela de conexão.
function fakeQr(): string {
  let cells = '';
  let x = 7;
  for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const finder = (r < 7 && c < 7) || (r < 7 && c > 17) || (r > 17 && c < 7);
    const ring = finder && ((r % 18 === 0 || r % 18 === 6 || c % 18 === 0 || c % 18 === 6) || ((r % 18 >= 2 && r % 18 <= 4) && (c % 18 >= 2 && c % 18 <= 4)));
    if (finder ? ring : (x >> 16) % 2 === 0) cells += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 27 27" shape-rendering="crispEdges"><rect x="-1" y="-1" width="27" height="27" fill="#fff"/><g fill="#000">${cells}</g></svg>`)}`;
}

// Fluxos do bot na demonstração (até 5, um em uso), como em whatsapp.flows.ts.
type DemoState = ReturnType<typeof build>;
function demoFlows(d: DemoState, path: string, method: string, body: unknown) {
  const base = defaultDemoFlow(d.settings.greetingMessage);
  const template = (t: string): FlowNode => (t === 'link'
    ? { ...base, options: base.options?.map((o) => (o.action === 'agendar' ? { ...o, action: 'link' as const } : o)) }
    : t === 'vazio'
      ? { ...base, messages: ['Olá, {nome}! Bem-vindo(a) à {empresa}.'], options: [{ id: 'equipe', label: 'Falar com a equipe', type: 'action', action: 'equipe', messages: [], together: true }] }
      : base);
  const now = () => new Date().toISOString();
  if (!d.flows) {
    d.flows = [{ id: id(), name: 'Padrão', flow: base, updatedAt: now() }, { id: id(), name: 'Agendamento pelo link', flow: template('link'), updatedAt: now() }];
    d.activeFlowId = d.flows[0].id;
  }
  const flows = d.flows;
  const list = () => ({ flows: flows.map((f) => ({ id: f.id, name: f.name, active: f.id === d.activeFlowId, updatedAt: f.updatedAt })), max: 5 });
  const full = (f: (typeof flows)[number]) => ({ id: f.id, name: f.name, active: f.id === d.activeFlowId, updatedAt: f.updatedAt, flow: f.flow });
  if (path === '/whatsapp/flow') return full(flows.find((f) => f.id === d.activeFlowId)!);
  if (path === '/whatsapp/flows' && method === 'GET') return list();
  if (path === '/whatsapp/flows') {
    if (flows.length >= 5) throw { demo: true, status: 400, message: 'Você pode ter até 5 fluxos. Apague um para criar outro.' };
    const input = body as { template: string; name?: string };
    const created = { id: id(), name: input.name || (input.template === 'link' ? 'Agendamento pelo link' : input.template === 'padrao' ? 'Padrão' : 'Novo fluxo'), flow: template(input.template), updatedAt: now() };
    flows.push(created);
    return full(created);
  }
  const [, , , flowId, extra] = path.split('/');
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) throw { demo: true, status: 404, message: 'Fluxo não encontrado.' };
  if (extra === 'activate') { d.activeFlowId = flow.id; return list(); }
  if (method === 'DELETE') {
    if (flow.id === d.activeFlowId) throw { demo: true, status: 400, message: 'Este fluxo está em uso no WhatsApp. Coloque outro em uso antes de apagar.' };
    d.flows = flows.filter((f) => f.id !== flow.id);
    return { flows: d.flows.map((f) => ({ id: f.id, name: f.name, active: f.id === d.activeFlowId, updatedAt: f.updatedAt })), max: 5 };
  }
  if (method === 'PUT') {
    const input = body as { flow?: FlowNode; name?: string };
    if (input.flow) flow.flow = input.flow;
    if (input.name) flow.name = input.name;
    flow.updatedAt = now();
  }
  return full(flow);
}

// "Testar conversa" na demonstração: percorre os menus do fluxo. As funções do
// sistema (agendar, catálogo...) só explicam o que o bot faria de verdade.
const demoSims = new Map<string, string>();
const DEMO_ACTIONS: Record<string, string> = {
  agendar: 'o bot mostraria os seus serviços, os próximos dias com horário livre e os horários da agenda, e marcaria o agendamento',
  meus: 'o bot mostraria o próximo horário do cliente para confirmar, remarcar ou cancelar',
  servicos: 'o bot enviaria a lista de serviços e produtos com os preços do seu catálogo',
  equipe: 'o bot passaria a conversa para a sua equipe e ficaria em silêncio',
  link: 'o bot mandaria um link pessoal da agenda, onde o cliente escolhe serviço, dia e horário',
};

function demoSimulate(body: { simId: string | null; text: string; flow: FlowNode; profileName?: string }) {
  const simId = body.simId ?? id();
  const company = DEMO_COMPANIES[Math.max(0, data().companyIdx)]?.name ?? 'Studio Aurora';
  const fill = (t: string) => t.replaceAll('{nome}', body.profileName ?? 'Maria').replaceAll('{empresa}', company);
  const find = (node: FlowNode, nodeId: string): FlowNode | null => (node.id === nodeId ? node : (node.options ?? []).map((o) => find(o, nodeId)).find(Boolean) ?? null);
  const menuText = (menu: FlowNode) => `${fill(menu.prompt ?? 'Responda com o número:')}\n\n${(menu.options ?? []).map((o, i) => `${i + 1}) ${fill(o.label)}`).join('\n')}`;
  const root = body.flow;
  const current = demoSims.get(simId) ? find(root, demoSims.get(simId)!) : null;
  const option = current && /^\d+$/.test(body.text.trim()) ? current.options?.[Number(body.text.trim()) - 1] : undefined;

  if (!current || !option) {
    demoSims.set(simId, root.id);
    return { simId, replies: [...root.messages.map(fill), menuText(root)], step: 'MENU', inactive: false };
  }
  const say = option.messages.map(fill);
  if (option.type === 'menu') {
    demoSims.set(simId, option.id);
    return { simId, replies: [...say, menuText(option)], step: 'MENU', inactive: false };
  }
  if (option.type === 'end') {
    demoSims.delete(simId);
    return { simId, replies: say, step: null, inactive: false };
  }
  if (option.type === 'action') {
    const human = option.action === 'equipe';
    demoSims.set(simId, root.id);
    const note = `(Demonstração) Aqui ${DEMO_ACTIONS[option.action ?? 'agendar']}. Na sua conta, o teste usa o bot de verdade com o seu catálogo e a sua agenda.`;
    return { simId, replies: [...say, note, ...(human ? [] : [menuText(root)])], step: human ? 'HUMAN' : 'MENU', inactive: false };
  }
  const back = option.next === 'parent' ? current : root;
  demoSims.set(simId, back.id);
  return { simId, replies: [...say, menuText(back)], step: 'MENU', inactive: false };
}

function whatsappStatus() {
  const d = data();
  if (d.settings.whatsappConnected) return { status: 'connected', qr: null, phone: '5531999990000', error: null };
  if (d.whatsappSince && Date.now() - d.whatsappSince > 8000) {
    d.settings.whatsappConnected = true;
    d.settings.whatsappPhone = '5531999990000';
    return { status: 'connected', qr: null, phone: '5531999990000', error: null };
  }
  if (d.whatsappSince) return { status: 'qr', qr: fakeQr(), phone: null, error: null };
  return { status: 'disconnected', qr: null, phone: null, error: null };
}

type Body = Record<string, unknown> & { [key: string]: never | unknown };

function route(method: string, path: string, query: URLSearchParams, body: Body): unknown {
  const d = data();
  const m = (pattern: RegExp) => pattern.exec(path);
  let r: RegExpExecArray | null;

  // Autenticação
  if (path === '/auth/refresh' || path === '/auth/login' || path === '/auth/login/company') {
    if (!loggedIn && path === '/auth/refresh') fail('Sessão expirada.', 401);
    loggedIn = true;
    return session();
  }
  if (path === '/auth/logout') { stopDemo(); return undefined; }
  if (path === '/auth/switch-company') {
    d.companyIdx = body.companyId ? Math.max(0, DEMO_COMPANIES.findIndex((c) => c.id === body.companyId)) : -1;
    try { sessionStorage.setItem(COMPANY_KEY, String(d.companyIdx)); } catch { /* navegação privada */ }
    return session();
  }
  if (path === '/auth/companies') return { companies: DEMO_COMPANIES.map((c) => ({ ...c, role: 'ADMIN' })) };
  if (path === '/auth/change-password') return { message: 'Senha alterada (demonstração).' };
  if (path === '/auth/signup-config') return { companySignup: demoPublicSignup };
  if (path === '/admin/settings') {
    if (method === 'PATCH' && typeof body.publicSignupEnabled === 'boolean') demoPublicSignup = body.publicSignupEnabled;
    return { settings: { publicSignupEnabled: demoPublicSignup } };
  }
  if (path.startsWith('/auth/')) fail('Indisponível no modo demonstração.');

  // Assinatura
  if (path === '/account' && method === 'GET') {
    return {
      subscription: d.sub, plans: PLANS, canCreateCompany: false,
      companies: DEMO_COMPANIES.map((c, i) => ({ id: c.id, name: c.name, active: true, users: 3 - i, whatsappConnected: i === 0 ? d.settings.whatsappConnected : true, whatsappPhone: i === 0 ? d.settings.whatsappPhone : '5531988880000' })),
    };
  }
  if (path === '/account/plan') {
    const p = PLANS.find((x) => x.id === body.plan)!;
    if (p.maxCompanies < DEMO_COMPANIES.length) fail(`O plano ${p.name} permite ${p.maxCompanies} empresa. Exclua a outra empresa antes de mudar.`);
    d.sub = { ...d.sub, plan: p.id, planName: p.name, priceCents: p.priceCents, maxCompanies: p.maxCompanies, maxEmployees: p.maxEmployees };
    return { subscription: d.sub };
  }
  if (path === '/account/companies') fail('Sua conta já tem as 2 empresas do plano Avançado.', 403);

  // Painel master
  if (path === '/admin/stats') {
    const paying = d.adminCompanies.filter((c) => c.subscription.status === 'ACTIVE');
    return { companies: d.adminCompanies.length, accounts: d.adminCompanies.length, payingAccounts: paying.length, trialAccounts: 1, mrrCents: paying.reduce((s, c) => s + c.subscription.priceCents, 0), users: 14, clients: 272, appointmentsThisMonth: 318, whatsappConnected: 3 };
  }
  if (path === '/admin/companies' && method === 'GET') return { companies: d.adminCompanies };
  if (path === '/admin/users') {
    const users: AdminUser[] = d.adminCompanies.flatMap((c, i) => c.admins.map((a) => ({
      ...a, phone: null, isSuperAdmin: false, active: true, google: i % 2 === 0, lastLoginAt: ago(60 * (i * 9 + 2)), createdAt: c.createdAt,
      companies: [{ id: c.id, name: c.name, companyActive: c.active, role: 'ADMIN' as const, status: 'ACTIVE' as const, active: true }],
    })));
    const studio = d.adminCompanies[0];
    for (const m of [...d.members.slice(1), ...d.pending]) {
      const status = d.pending.includes(m) ? 'PENDING' as const : 'ACTIVE' as const;
      users.push({
        id: m.id, name: m.name, email: m.email, phone: m.phone, avatarUrl: null, isSuperAdmin: false, active: true, google: false,
        lastLoginAt: status === 'ACTIVE' ? ago(60 * 5) : null, createdAt: m.createdAt,
        companies: [{ id: studio.id, name: studio.name, companyActive: true, role: m.role, status, active: true }],
      });
    }
    return { users };
  }
  if (path.startsWith('/admin/')) {
    if ((r = m(/^\/admin\/accounts\/([^/]+)\/payment$/))) {
      const co = d.adminCompanies.find((c) => c.subscription.accountId === r![1])!;
      co.subscription = { ...co.subscription, status: 'ACTIVE', active: true, trialEndsAt: null, paidUntil: new Date(Date.now() + 30 * 86400000).toISOString() };
      return { subscription: co.subscription };
    }
    if ((r = m(/^\/admin\/accounts\/([^/]+)$/))) {
      const co = d.adminCompanies.find((c) => c.subscription.accountId === r![1])!;
      const p = PLANS.find((x) => x.id === (body.plan ?? co.subscription.plan))!;
      co.subscription = { ...co.subscription, plan: p.id, planName: p.name, priceCents: p.priceCents, status: (body.status as Subscription['status']) ?? co.subscription.status };
      return { subscription: co.subscription };
    }
    if ((r = m(/^\/admin\/companies\/([^/]+)$/))) {
      if (method === 'DELETE') { d.adminCompanies = d.adminCompanies.filter((c) => c.id !== r![1]); return undefined; }
      const co = d.adminCompanies.find((c) => c.id === r![1])!;
      Object.assign(co, body);
      return { company: co };
    }
    if (path === '/admin/companies') {
      const p = PLANS.find((x) => x.id === body.plan)!;
      d.adminCompanies.unshift({
        ...d.adminCompanies[1], id: id(), name: String(body.name), selfSignup: false, clients: 0, appointments: 0, services: 0, users: 1, whatsappConnected: false, whatsappPhone: null,
        createdAt: new Date().toISOString(), admins: [{ id: id(), name: String((body.admin as { name: string }).name), email: String((body.admin as { email: string }).email), avatarUrl: null }],
        subscription: { ...d.sub, accountId: id(), plan: p.id, planName: p.name, priceCents: p.priceCents, status: body.trial ? 'TRIAL' : 'ACTIVE' },
      });
      return { adminAlreadyExisted: false };
    }
  }

  // Painel da empresa
  if (path === '/dashboard') return dashboard();

  if (path === '/clients' && method === 'GET') {
    const search = (query.get('search') ?? '').toLowerCase();
    return { clients: d.clients.filter((c) => `${c.name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(search)).map(clientCount) };
  }
  if (path === '/clients' && method === 'POST') {
    const client: Client = { id: id(), name: String(body.name), phone: String(body.phone), email: (body.email as string) || null, birthday: (body.birthday as string) || null, notes: (body.notes as string) || null, whatsappId: null, source: 'STAFF', lastMessageAt: null, unreadCount: 0, createdAt: new Date().toISOString() };
    d.clients.unshift(client);
    return { client };
  }
  if ((r = m(/^\/clients\/([^/]+)$/))) {
    const client = d.clients.find((c) => c.id === r![1]) ?? fail('Cliente não encontrado.', 404);
    if (method === 'DELETE') { d.clients = d.clients.filter((c) => c !== client); d.appointments = d.appointments.filter((a) => a.clientId !== client.id); return undefined; }
    if (method === 'PATCH') {
      const { reminders, ...rest } = body as { reminders?: boolean };
      Object.assign(client, rest, reminders === undefined ? {} : { whatsappOptOutAt: reminders ? null : new Date().toISOString() });
      return { client };
    }
    return { client: { ...client, appointments: d.appointments.filter((a) => a.clientId === client.id).sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)) } };
  }

  if (path === '/services/improve-description') {
    const { name, description } = body as { name: string; description?: string | null };
    const base = description?.trim() || `${name} com atendimento cuidadoso e profissional.`;
    return { description: `${base.replace(/[.!]*$/, '')}. Agende pelo WhatsApp e garanta seu horário! ✨`.slice(0, 300) };
  }
  if (path === '/services' && method === 'GET') return { services: [...d.services].sort((a, b) => a.position - b.position).map(withCount) };
  if (path === '/services' && method === 'POST') {
    if (d.services.some((s) => s.name.toLowerCase() === String(body.name).toLowerCase())) fail('Já existe um serviço com esse nome.', 409);
    const service = { kind: 'SERVICE', active: true, description: null, ...body, id: id(), position: d.services.length } as Service;
    if (service.kind === 'PRODUCT') service.durationMinutes = 0;
    d.services.push(service);
    return { service };
  }
  if ((r = m(/^\/services\/([^/]+)$/))) {
    const service = d.services.find((s) => s.id === r![1]) ?? fail('Serviço não encontrado.', 404);
    if (method === 'DELETE') { d.services = d.services.filter((s) => s !== service); return undefined; }
    Object.assign(service, body);
    return { service };
  }

  if (path === '/appointments/availability') return freeTimes(query.get('date')!, (query.get('serviceIds') ?? '').split(',').filter(Boolean), query.get('excludeId') ?? undefined);
  if (path === '/appointments' && method === 'GET') {
    const from = query.get('from') ?? '0000';
    const to = query.get('to') ?? '9999';
    return { appointments: d.appointments.filter((a) => a.date >= from && a.date <= to).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)) };
  }
  if (path === '/appointments' && method === 'POST') {
    const appointment = makeAppointment(body as never);
    d.appointments.push(appointment);
    return { appointment };
  }
  if ((r = m(/^\/appointments\/([^/]+)\/status$/))) {
    const a = d.appointments.find((x) => x.id === r![1]) ?? fail('Agendamento não encontrado.', 404);
    a.status = body.status as AppointmentStatus;
    a.confirmedAt = a.status === 'CONFIRMED' ? new Date().toISOString() : a.status === 'SCHEDULED' ? null : a.confirmedAt;
    return { appointment: a };
  }
  if ((r = m(/^\/appointments\/([^/]+)$/))) {
    const index = d.appointments.findIndex((x) => x.id === r![1]);
    if (index < 0) fail('Agendamento não encontrado.', 404);
    if (method === 'DELETE') { d.appointments.splice(index, 1); return undefined; }
    const current = d.appointments[index];
    const next = makeAppointment({
      serviceIds: (body.serviceIds as string[]) ?? current.items.map((i) => i.serviceId!),
      date: (body.date as string) ?? current.date, startTime: (body.startTime as string) ?? current.startTime,
      staffId: body.staffId === undefined ? current.staffId : (body.staffId as string), notes: body.notes === undefined ? current.notes : (body.notes as string),
    }, current);
    d.appointments[index] = next;
    return { appointment: next };
  }

  if (path === '/conversations') {
    const list: Conversation[] = d.clients.filter((c) => c.lastMessageAt).sort((a, b) => b.lastMessageAt!.localeCompare(a.lastMessageAt!)).map((c) => {
      const last = (d.messages[c.id] ?? []).at(-1);
      return { id: c.id, name: c.name, phone: c.phone, whatsappId: c.whatsappId, lastMessageAt: c.lastMessageAt!, unreadCount: c.unreadCount, lastMessage: last ? { text: last.text, sender: last.sender, createdAt: last.createdAt } : null, withStaff: c.id === 'c2' };
    });
    return { conversations: list };
  }
  if ((r = m(/^\/conversations\/([^/]+)\/reply$/))) {
    const client = d.clients.find((c) => c.id === r![1])!;
    (d.messages[client.id] ??= []).push({ id: id(), text: String(body.text), sender: 'STAFF', staffName: 'Você (demonstração)', createdAt: new Date().toISOString() });
    client.lastMessageAt = new Date().toISOString();
    return { bot: { paused: true, pausedUntil: new Date(Date.now() + d.settings.humanTimeoutMinutes * 60000).toISOString(), waitingForStaff: false } };
  }
  if ((r = m(/^\/conversations\/([^/]+)\/resume-bot$/))) return { bot: { paused: false, pausedUntil: null, waitingForStaff: false } };
  if ((r = m(/^\/conversations\/([^/]+)$/))) {
    const client = d.clients.find((c) => c.id === r![1]) ?? fail('Cliente não encontrado.', 404);
    client.unreadCount = 0;
    const paused = client.id === 'c2';
    return { client, messages: d.messages[client.id] ?? [], bot: { paused, pausedUntil: paused ? new Date(Date.now() + 20 * 60000).toISOString() : null, waitingForStaff: false } };
  }

  if (path === '/users' && method === 'GET') return { users: d.members };
  if (path === '/users/pending') return { users: d.pending };
  if (path === '/users' && method === 'POST') {
    if (d.members.length >= d.sub.maxEmployees + 1) fail(`O plano ${d.sub.planName} permite o administrador e até ${d.sub.maxEmployees} funcionários ativos por empresa.`, 403);
    const member: Member = { membershipId: id(), id: id(), name: String(body.name), email: String(body.email), phone: (body.phone as string) || null, avatarUrl: null, role: body.role as Member['role'], active: true, createdAt: new Date().toISOString() };
    d.members.push(member);
    return { user: member };
  }
  if ((r = m(/^\/users\/([^/]+)\/(approve|reject)$/))) {
    const member = d.pending.find((p) => p.membershipId === r![1]) ?? fail('Pedido não encontrado.', 404);
    d.pending = d.pending.filter((p) => p !== member);
    if (r[2] === 'approve') { const approved = { ...member, role: body.role as Member['role'] }; d.members.push(approved); return { user: approved }; }
    return undefined;
  }
  if ((r = m(/^\/users\/([^/]+)$/))) {
    const member = d.members.find((x) => x.membershipId === r![1]) ?? fail('Usuário não encontrado.', 404);
    if (method === 'DELETE') { d.members = d.members.filter((x) => x !== member); return undefined; }
    Object.assign(member, body);
    return { user: member };
  }

  if (path === '/settings' && method === 'GET') {
    return { settings: d.settings, company: { ...DEMO_COMPANIES[Math.max(0, d.companyIdx)], document: null, phone: '(31) 3333-4444', email: 'contato@studioaurora.com', inviteCode: 'AURORA26' } };
  }
  if (path === '/settings' && method === 'PUT') { Object.assign(d.settings, body); return { settings: d.settings }; }
  if (path === '/settings/company') return { company: { ...DEMO_COMPANIES[Math.max(0, d.companyIdx)], ...body, inviteCode: 'AURORA26' } };
  if (path === '/settings/invite-code') return { inviteCode: Math.random().toString(36).slice(2, 10).toUpperCase() };

  if (path === '/whatsapp/status') return whatsappStatus();
  if (path === '/whatsapp/connect') { d.whatsappSince = Date.now(); return whatsappStatus(); }
  if (path === '/whatsapp/disconnect') { d.whatsappSince = 0; d.settings.whatsappConnected = false; d.settings.whatsappPhone = null; return whatsappStatus(); }
  if (path === '/whatsapp/test') return { message: 'Mensagem de teste enviada (demonstração).' };
  if (path === '/whatsapp/flow' || path.startsWith('/whatsapp/flows')) return demoFlows(d, path, method, body);
  if (path === '/whatsapp/ai') return { used: 0, limit: 1500, available: true, transcription: true, allowed: d.sub.ai };
  if (path === '/whatsapp/flow/understand') return demoUnderstand(body as { flow: FlowNode; text: string });
  if (path === '/privacy/consent') return undefined;
  if (path === '/privacy/requests' && method === 'GET') return { requests: [] };
  if (path === '/privacy/requests') return { request: { id: id(), type: (body as { type: string }).type, message: null, status: 'OPEN', response: null, createdAt: new Date().toISOString(), resolvedAt: null } };
  if (path === '/privacy/me/export') return { generatedAt: new Date().toISOString(), note: 'Demonstração: dados fictícios.', account: { name: 'Você (demonstração)' } };
  if (path === '/survey' && method === 'GET') return { eligible: false, status: 'done' };
  if (path.startsWith('/survey')) return { status: 'done' };
  if (path === '/whatsapp/simulate') return demoSimulate(body as { simId: string | null; text: string; flow: FlowNode; profileName?: string });

  return fail('Recurso indisponível no modo demonstração.', 404);
}

export async function demoRequest<T>(path: string, init: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const url = new URL(path, 'http://demo');
  const body = init.body ? JSON.parse(String(init.body)) : {};
  try {
    return route(init.method ?? 'GET', url.pathname, url.searchParams, body) as T;
  } catch (err) {
    if (err instanceof DemoError) throw { demo: true, status: err.status, message: err.message };
    throw err;
  }
}
