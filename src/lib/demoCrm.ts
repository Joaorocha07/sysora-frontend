// Modo demonstração: etiquetas, funil, respostas rápidas, anotações, mensagens
// agendadas, follow-up e insights do atendimento, em memória (ver demo.ts).
import type { Client, ClientNote, Insights, Message, PipelineStage, QuickReply, ScheduledMessage, Tag, TagColor } from './api';

type State = {
  tags: Tag[];
  links: Record<string, string[]>;
  stages: PipelineStage[];
  stageOf: Record<string, string>;
  archived: Record<string, string>;
  replies: QuickReply[];
  notes: ClientNote[];
  scheduled: ScheduledMessage[];
  followUp: { enabled: boolean; steps: { delayMinutes: number; text: string }[] };
  reactivation: { enabled: boolean; days: number; message: string };
  openEnabled: boolean;
  openToken: string;
};

const states = new WeakMap<Client[], State>();
let seq = 1;
const id = () => `crm-${seq++}`;
const now = () => new Date().toISOString();
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const ahead = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

function state(clients: Client[]): State {
  let s = states.get(clients);
  if (s) return s;
  const tag = (name: string, color: TagColor): Tag => ({ id: id(), name, color, createdAt: ago(9000) });
  const tags = [tag('VIP', 'graphite'), tag('Retorno', 'sage'), tag('Orçamento', 'sand'), tag('Indicação', 'mist')];
  const stages: PipelineStage[] = ['Novo contato', 'Em conversa', 'Proposta enviada', 'Agendado', 'Fechado'].map((name, position) => ({ id: `st${position + 1}`, name, position, won: position === 4 }));
  const pick = (i: number) => clients[i]?.id;
  s = {
    tags,
    links: { [pick(0)]: [tags[0].id, tags[1].id], [pick(1)]: [tags[2].id], [pick(3)]: [tags[0].id], [pick(4)]: [tags[3].id], [pick(6)]: [tags[2].id] },
    stages,
    stageOf: { [pick(0)]: 'st5', [pick(1)]: 'st3', [pick(2)]: 'st2', [pick(3)]: 'st4', [pick(4)]: 'st2', [pick(5)]: 'st4', [pick(8)]: 'st5', [pick(9)]: 'st3' },
    archived: {},
    replies: [
      { id: id(), title: 'Endereço', shortcut: 'endereco', text: 'Oi, {nome}! Estamos na Rua das Flores, 120 — Centro. Funcionamos de segunda a sábado, das 9h às 18h.', createdAt: ago(5000), updatedAt: ago(5000) },
      { id: id(), title: 'Formas de pagamento', shortcut: 'pagamento', text: 'Aceitamos Pix, cartão de crédito (até 3x) e débito.', createdAt: ago(5000), updatedAt: ago(5000) },
      { id: id(), title: 'Agradecimento', shortcut: 'obrigado', text: 'Obrigada pela visita, {nome}! Qualquer coisa é só chamar por aqui.', createdAt: ago(5000), updatedAt: ago(5000) },
    ],
    notes: [
      { id: id(), clientId: pick(0), authorId: 'u2', authorName: 'Paula Ribeiro', text: 'Pediu para lembrar do retorno daqui a 30 dias.', createdAt: ago(60 * 26) },
    ],
    scheduled: [],
    followUp: { enabled: false, steps: [{ delayMinutes: 120, text: 'Oi, {nome}! Ficou alguma dúvida? Se quiser, já te ajudo a escolher um horário.' }] },
    openEnabled: false,
    openToken: 'demo-studio',
    reactivation: { enabled: false, days: 30, message: 'Oi, {nome}! Faz um tempinho que a gente não se fala. Que tal marcar um horário? É só escolher o melhor dia por aqui: {link}' },
  };
  const c = (i: number) => ({ id: clients[i].id, name: clients[i].name, phone: clients[i].phone, whatsappId: clients[i].whatsappId });
  s.scheduled = [
    { id: id(), clientId: clients[1].id, text: 'Oi, Bruno! O orçamento que você pediu vale até sexta. Quer reservar um horário?', sendAt: ahead(60 * 20), status: 'PENDING', sentAt: null, error: null, createdByName: 'Paula Ribeiro', createdAt: ago(30), client: c(1) },
    { id: id(), clientId: clients[0].id, text: 'Ana, passando para lembrar do seu retorno. Posso marcar?', sendAt: ago(60 * 30), status: 'SENT', sentAt: ago(60 * 30), error: null, createdByName: 'Você (demonstração)', createdAt: ago(60 * 50), client: c(0) },
  ];
  states.set(clients, s);
  return s;
}

const tagsOf = (s: State, clientId: string) => s.tags.filter((t) => s.links[clientId]?.includes(t.id)).map(({ id: tid, name, color }) => ({ id: tid, name, color }));

// Campos de etiqueta/etapa/arquivo que o backend manda junto com o cliente.
export function withCrm<T extends { id: string }>(clients: Client[], client: T) {
  const s = state(clients);
  return { ...client, tags: tagsOf(s, client.id), tagIds: s.links[client.id] ?? [], stageId: s.stageOf[client.id] ?? null, archivedAt: s.archived[client.id] ?? null };
}

export function demoClientFilter(clients: Client[], query: URLSearchParams) {
  const s = state(clients);
  const tagId = query.get('tagId');
  const stageId = query.get('stageId');
  return (c: Client) => (!tagId || Boolean(s.links[c.id]?.includes(tagId))) && (!stageId || (s.stageOf[c.id] ?? s.stages[0].id) === stageId);
}

const NONE = Symbol('none');
type Fail = (message: string, status?: number) => never;

export function demoCrm(
  clients: Client[], messages: Record<string, Message[]>, method: string, path: string, query: URLSearchParams, body: Record<string, unknown>, fail: Fail,
): unknown | typeof NONE {
  const s = state(clients);
  const m = (re: RegExp) => path.match(re);
  let r: RegExpMatchArray | null;
  const clientRef = (cid: string) => {
    const c = clients.find((x) => x.id === cid) ?? fail('Cliente não encontrado.', 404);
    return { id: c.id, name: c.name, phone: c.phone, whatsappId: c.whatsappId };
  };

  // Etiquetas
  if (path === '/tags' && method === 'GET') return { tags: s.tags.map((t) => ({ ...t, _count: { clients: Object.values(s.links).filter((l) => l.includes(t.id)).length } })) };
  if (path === '/tags' && method === 'POST') {
    if (s.tags.some((t) => t.name.toLowerCase() === String(body.name).toLowerCase())) fail('Já existe uma etiqueta com esse nome.', 409);
    const tag: Tag = { id: id(), name: String(body.name), color: (body.color as TagColor) ?? 'graphite', createdAt: now() };
    s.tags.push(tag);
    return { tag: { ...tag, _count: { clients: 0 } } };
  }
  if ((r = m(/^\/tags\/([^/]+)$/))) {
    const tag = s.tags.find((t) => t.id === r![1]) ?? fail('Etiqueta não encontrada.', 404);
    if (method === 'DELETE') { s.tags = s.tags.filter((t) => t !== tag); for (const k of Object.keys(s.links)) s.links[k] = s.links[k].filter((t) => t !== tag.id); return undefined; }
    Object.assign(tag, body);
    return { tag };
  }
  if ((r = m(/^\/clients\/([^/]+)\/tags$/))) {
    s.links[r[1]] = (body.tagIds as string[]).filter((t) => s.tags.some((x) => x.id === t));
    return { tags: tagsOf(s, r[1]) };
  }

  // Anotações
  if ((r = m(/^\/clients\/([^/]+)\/notes$/))) {
    if (method === 'GET') return { notes: s.notes.filter((n) => n.clientId === r![1]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    const note: ClientNote = { id: id(), clientId: r[1], authorId: 'demo-user', authorName: 'Você (demonstração)', text: String(body.text), createdAt: now() };
    s.notes.push(note);
    return { note };
  }
  if ((r = m(/^\/clients\/([^/]+)\/notes\/([^/]+)$/))) { s.notes = s.notes.filter((n) => n.id !== r![2]); return undefined; }

  // Planilha
  if (path === '/clients/export') {
    return { clients: clients.map((c) => ({ ...c, stage: s.stages.find((st) => st.id === (s.stageOf[c.id] ?? 'st1'))?.name ?? null, tags: tagsOf(s, c.id).map((t) => t.name), appointments: 0 })) };
  }
  if (path === '/clients/import') {
    const rows = body.clients as { name: string; phone: string; email?: string }[];
    let created = 0;
    const skipped: { line: number; name: string; reason: string }[] = [];
    rows.forEach((row, i) => {
      if (!row.name || row.phone.replace(/\D/g, '').length < 8) { skipped.push({ line: i + 2, name: row.name || row.phone, reason: row.name ? 'Telefone inválido' : 'Sem nome' }); return; }
      clients.push({ id: id(), name: row.name, phone: row.phone, email: row.email || null, birthday: null, notes: null, whatsappId: null, source: 'STAFF', lastMessageAt: null, unreadCount: 0, createdAt: now() });
      created += 1;
    });
    return { created, skipped, skippedCount: skipped.length };
  }

  // Funil
  if (path === '/pipeline/stages' && method === 'GET') return { stages: s.stages };
  if (path === '/pipeline' && method === 'GET') {
    return {
      stages: s.stages,
      clients: clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone, stageId: s.stageOf[c.id] ?? s.stages[0].id, lastMessageAt: c.lastMessageAt, unreadCount: c.unreadCount, createdAt: c.createdAt, tagIds: s.links[c.id] ?? [] })),
      total: clients.length,
      limit: 1000,
    };
  }
  if (path === '/pipeline/stages') {
    s.stages = (body.stages as { id?: string; name: string; won: boolean }[]).map((st, position) => ({ id: st.id ?? id(), name: st.name, won: st.won, position }));
    for (const k of Object.keys(s.stageOf)) if (!s.stages.some((st) => st.id === s.stageOf[k])) delete s.stageOf[k];
    return { stages: s.stages };
  }
  if (path === '/pipeline/move') { s.stageOf[String(body.clientId)] = String(body.stageId); return { ok: true }; }

  // Conversas arquivadas
  if ((r = m(/^\/conversations\/([^/]+)\/archive$/))) {
    if (body.archived) s.archived[r[1]] = now(); else delete s.archived[r[1]];
    return { archivedAt: s.archived[r[1]] ?? null };
  }

  // Respostas rápidas
  if (path === '/quick-replies' && method === 'GET') return { replies: [...s.replies].sort((a, b) => a.title.localeCompare(b.title)) };
  if (path === '/quick-replies') {
    const reply: QuickReply = { id: id(), title: String(body.title), shortcut: (body.shortcut as string) || null, text: String(body.text), createdAt: now(), updatedAt: now() };
    s.replies.push(reply);
    return { reply };
  }
  if ((r = m(/^\/quick-replies\/([^/]+)$/))) {
    if (method === 'DELETE') { s.replies = s.replies.filter((x) => x.id !== r![1]); return undefined; }
    const reply = s.replies.find((x) => x.id === r![1]) ?? fail('Resposta rápida não encontrada.', 404);
    Object.assign(reply, body, { updatedAt: now() });
    return { reply };
  }

  // Mensagens agendadas
  if (path === '/scheduled-messages' && method === 'GET') {
    const status = query.get('status');
    const clientId = query.get('clientId');
    return { messages: s.scheduled.filter((x) => (!status || x.status === status) && (!clientId || x.clientId === clientId)).sort((a, b) => a.sendAt.localeCompare(b.sendAt)) };
  }
  if (path === '/scheduled-messages') {
    if (Date.parse(String(body.sendAt)) < Date.now() + 60_000) fail('Escolha um horário a partir de daqui a 1 minuto.');
    const message: ScheduledMessage = {
      id: id(), clientId: String(body.clientId), text: String(body.text), sendAt: String(body.sendAt), status: 'PENDING', sentAt: null, error: null,
      createdByName: 'Você (demonstração)', createdAt: now(), client: clientRef(String(body.clientId)),
    };
    s.scheduled.push(message);
    return { message };
  }
  if ((r = m(/^\/scheduled-messages\/([^/]+)\/cancel$/))) {
    const message = s.scheduled.find((x) => x.id === r![1]) ?? fail('Mensagem agendada não encontrada.', 404);
    message.status = 'CANCELED';
    return { message };
  }
  if ((r = m(/^\/scheduled-messages\/([^/]+)$/))) {
    if (method === 'DELETE') { s.scheduled = s.scheduled.filter((x) => x.id !== r![1]); return undefined; }
    const message = s.scheduled.find((x) => x.id === r![1]) ?? fail('Mensagem agendada não encontrada.', 404);
    Object.assign(message, body);
    return { message };
  }

  // Follow-up
  if (path === '/follow-up' && method === 'GET') return { ...s.followUp, maxSteps: 3 };
  if (path === '/follow-up') { s.followUp = body as State['followUp']; return { ...s.followUp, maxSteps: 3 }; }

  // Links de agendamento (na demonstração, as páginas públicas não abrem).
  if (path === '/booking-links/client') {
    const c = clientRef(String(body.clientId));
    return { url: `${location.origin}/agendar/demo-${c.id}`, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), client: c };
  }
  if (path.startsWith('/booking-links/open')) {
    if (path.endsWith('/regenerate')) s.openToken = `demo${Math.random().toString(36).slice(2, 8)}`;
    if (method === 'PUT') s.openEnabled = Boolean(body.enabled);
    return { enabled: s.openEnabled, url: `${location.origin}/reservar/${s.openToken}` };
  }

  // Reativação de clientes sumidos
  if (path === '/reactivation') {
    if (method === 'PUT') s.reactivation = { ...s.reactivation, ...(body as Partial<State['reactivation']>) };
    const preview = clients.filter((c) => !c.lastMessageAt).slice(0, 5).map((c, i) => ({ id: c.id, name: c.name, phone: c.phone, lastInboundAt: ago(60 * 24 * (35 + i * 9)) }));
    return { ...s.reactivation, dailyLimit: 20, official: false, candidates: preview.length, preview, sentToday: 0, sent30: 3 };
  }

  // Notificações: indisponíveis sem servidor.
  if (path === '/push/config') return { enabled: false, publicKey: null };

  if (path === '/dashboard/insights') return insights(clients, s, Number(query.get('days')) || 7);

  return NONE;
}
demoCrm.NONE = NONE;

// Números de exemplo com o mesmo formato do backend.
function insights(clients: Client[], s: State, days: number): Insights {
  const scale = days / 7;
  const heat = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, h) => {
    if (h < 7 || h > 22) return h === 23 && dow % 2 ? 1 : 0;
    const peak = Math.exp(-((h - 11) ** 2) / 8) * 6 + Math.exp(-((h - 19) ** 2) / 6) * 4;
    return Math.round(peak * (dow === 0 ? 0.3 : dow === 6 ? 0.7 : 1) * scale);
  }));
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const inbound = Math.round(18 + 10 * Math.sin(i / 1.7) + (d.getDay() === 0 ? -12 : 0));
    return { date: d.toLocaleDateString('en-CA'), inbound: Math.max(2, inbound), outbound: Math.max(3, Math.round(inbound * 1.35)) };
  });
  const inbound = daily.reduce((a, b) => a + b.inbound, 0);
  const outbound = daily.reduce((a, b) => a + b.outbound, 0);
  const contact = (c: Client, minutes: number) => ({ id: c.id, name: c.name, phone: c.phone, firstAt: ago(minutes) });
  const counts = s.stages.map((st) => ({ id: st.id, name: st.name, won: st.won, count: clients.filter((c) => (s.stageOf[c.id] ?? s.stages[0].id) === st.id).length }));
  return {
    days,
    totals: { inbound, bot: Math.round(outbound * 0.78), staff: Math.round(outbound * 0.22), leads: Math.round(9 * scale) + 3, newLeads: Math.round(4 * scale) + 1 },
    daily,
    heat,
    hours: { openingTime: '09:00', closingTime: '18:00', workDays: [1, 2, 3, 4, 5, 6] },
    response: { bot: { median: 3, avg: 4, count: Math.round(outbound * 0.6) }, staff: { median: 420, avg: 780, count: Math.round(outbound * 0.2) } },
    engagement: [
      { bucket: '1', count: 2 }, { bucket: '2', count: 3 }, { bucket: '3-5', count: Math.round(5 * scale) }, { bucket: '6-10', count: Math.round(3 * scale) }, { bucket: '11+', count: 1 },
    ],
    todayLeads: clients.slice(0, 2).map((c, i) => contact(c, 40 + i * 70)),
    todayCount: 2,
    ghosts: clients.slice(7, 9).map((c, i) => contact(c, 60 * 30 + i * 400)),
    ghostCount: 2,
    retention: { active: 7, cold: 2, inactive: 2, lost: 1 },
    funnel: counts,
  };
}
