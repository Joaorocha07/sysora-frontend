import { demoMode, demoRequest } from './demo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

// ============ Tipos ============
export type Role = 'ADMIN' | 'EMPLOYEE';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW';
export type Source = 'BOT' | 'STAFF';
export type MessageSender = 'CLIENT' | 'BOT' | 'STAFF';

// avatarUrl: foto do Google (nula para quem só entra com e-mail e senha).
export type AuthUser = { id: string; name: string; email: string; isSuperAdmin: boolean; avatarUrl: string | null };
export type AuthCompany = { id: string; name: string; slug: string };
// available = false: funcionário de empresa com o plano vencido (não pode entrar nela).
export type CompanyChoice = AuthCompany & { role: Role; available?: boolean };
export type MembershipStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';
// Equipe do usuário no perfil (pedidos aprovados, pendentes e recusados).
export type MyMembership = {
  membershipId: string; company: { id: string; name: string; active: boolean }; role: Role; status: MembershipStatus;
  active: boolean; planActive: boolean; requestedAt: string; decidedAt: string | null;
};
export type PlanId = 'INICIAL' | 'AVANCADO';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type Subscription = {
  accountId: string; plan: PlanId; planName: string; priceCents: number; status: SubscriptionStatus;
  trialEndsAt: string | null; paidUntil: string | null; active: boolean; maxCompanies: number; maxEmployees: number;
  // Recursos de IA liberados: plano Avançado pago (o teste grátis não tem IA).
  ai: boolean;
  // Cortesia (teste, parceiro): plano liberado sem cobrança, fora da receita do painel master.
  complimentary?: boolean;
};
export type PlanInfo = { id: PlanId; name: string; priceCents: number; maxCompanies: number; maxEmployees: number; features: string[] };
export type Session = {
  accessToken: string; user: AuthUser; company: AuthCompany | null; role: Role | null; subscription: Subscription | null;
  // Aviso do backend (ex.: levado para outra empresa porque o plano da atual venceu).
  notice?: string;
};
export type LoginResponse = Session | { status: 'select-company'; preAuthToken: string; companies: CompanyChoice[] };
// Login com Google de um e-mail sem conta: o token conclui o cadastro sem senha.
export type GoogleLoginResponse = LoginResponse | { status: 'signup-required'; signupToken: string; email: string; name: string; avatarUrl: string | null };

export type Member = { membershipId: string; id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; role: Role; active: boolean; createdAt: string };

export type Client = {
  id: string; name: string; phone: string; email: string | null; birthday: string | null; notes: string | null;
  whatsappId: string | null; source: Source; lastMessageAt: string | null; unreadCount: number; createdAt: string;
  // Respondeu "PARAR": não recebe lembretes automáticos pelo WhatsApp.
  whatsappOptOutAt?: string | null;
  _count?: { appointments: number };
};

// SERVICE: tem duração e ocupa horário. PRODUCT: pronta entrega, sem duração (0).
export type ServiceKind = 'SERVICE' | 'PRODUCT';
export type Service = {
  id: string; kind: ServiceKind; name: string; description: string | null; durationMinutes: number; priceCents: number;
  active: boolean; position: number; _count?: { appointments: number };
  // Produto que é conta de acesso (códigos por e-mail): o bot entrega o código dela.
  accessEmail?: string | null;
};

export type AppointmentItem = { id: string; serviceId: string | null; kind: ServiceKind; name: string; durationMinutes: number; priceCents: number };
export type Appointment = {
  id: string; clientId: string; staffId: string | null; date: string; startTime: string; endTime: string;
  status: AppointmentStatus; source: Source; notes: string | null; totalCents: number;
  reminderSentAt: string | null; hourReminderSentAt: string | null; confirmedAt: string | null; createdAt: string;
  items: AppointmentItem[];
  client: { id: string; name: string; phone: string; whatsappId: string | null };
  staff: { id: string; name: string } | null;
};
export type ClientDetail = Client & { appointments: Appointment[] };

export type Message = { id: string; text: string; sender: MessageSender; staffName: string | null; createdAt: string };
export type BotState = { paused: boolean; pausedUntil: string | null; waitingForStaff: boolean };
export type Conversation = {
  id: string; name: string; phone: string; whatsappId: string | null; lastMessageAt: string; unreadCount: number;
  lastMessage: { text: string; sender: MessageSender; createdAt: string } | null; withStaff: boolean;
};

export type Settings = {
  openingTime: string; closingTime: string; workDays: number[]; slotMinutes: number; slotCapacity: number;
  lunchEnabled: boolean; lunchStart: string; lunchEnd: string;
  whatsappConnected: boolean; whatsappPhone: string | null;
  // "Receber código" (códigos por e-mail): liberado pelo admin master.
  emailCodesEnabled?: boolean;
  // Assinaturas dos clientes (menu Assinaturas, no lugar da Agenda): liberado pelo admin master.
  clientSubscriptionsEnabled?: boolean;
  botEnabled: boolean; autoCreateClient: boolean; askName: boolean; botAiEnabled: boolean; transcribeAudio: boolean;
  greetingMessage: string; handoffMessage: string; confirmationMessage: string;
  reminderEnabled: boolean; reminderTime: string; reminderMessage: string;
  hourReminderEnabled: boolean; hourReminderMinutes: number; hourReminderMessage: string;
  pauseOnStaffReply: boolean; humanTimeoutMinutes: number; humanEndMessage: string;
};
// address: endereço de atendimento (vai na confirmação e no comprovante do agendamento pelo link).
export type CompanyProfile = { id: string; name: string; slug: string; document: string | null; phone: string | null; email: string | null; address?: string | null; inviteCode: string };

// Número conectado pela API oficial do WhatsApp (Cloud API da Meta).
export type WhatsAppTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'MISSING' | string;
export type WhatsAppCloudInfo = {
  phone: string | null; verifiedName: string | null; wabaId: string; phoneNumberId: string; coexistence: boolean;
  // Conexão manual: a empresa usa o próprio app da Meta.
  manual: boolean; appId: string | null; webhook: WhatsAppWebhookSetup | null; lastWebhookAt: string | null;
  // Situação na Meta (nulo = não foi possível consultar).
  health: { paymentConfigured: boolean | null; nameStatus: string | null; qualityRating: string | null; businessVerification: string | null };
  templates: { name: string; label: string; status: WhatsAppTemplateStatus }[];
  lastError: string | null; lastErrorAt: string | null; connectedAt: string; managerUrl: string;
};
export type WhatsAppStatus = {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected'; qr: string | null; phone: string | null; error: string | null;
  // cloud = API oficial; qr = QR Code (WhatsApp Web); null = nada conectado.
  provider: 'cloud' | 'qr' | null; cloud: WhatsAppCloudInfo | null;
};
export type WhatsAppCloudConfig = { enabled: boolean; appId: string | null; configId: string | null; graphVersion: string };
export type WhatsAppOnboardInput = { code: string; wabaId: string; phoneNumberId: string; businessId?: string | null; coexistence: boolean };
export type WhatsAppWebhookSetup = { url: string; verifyToken: string; fields: string[] };
type UsageCount = { total: number; billable: number };
export type WhatsAppUsage = {
  month: string; freeLimit: number; freeUsed: number;
  service: UsageCount; utility: UsageCount; marketing: UsageCount; authentication: UsageCount;
  estimatedCents: number; prices: Record<'service' | 'utility' | 'marketing' | 'authentication', number>;
};

// Fluxo do chatbot (aba "Fluxo do bot"): árvore de menus a partir das boas-vindas.
// 'link': agenda pela página do link pessoal (/agendar/[token]) em vez da conversa.
export type FlowAction = 'agendar' | 'link' | 'meus' | 'servicos' | 'equipe' | 'codigo' | 'trocar';
export type FlowNodeType = 'menu' | 'message' | 'action' | 'end';
export type FlowNode = {
  id: string; label: string; type: FlowNodeType; messages: string[]; together: boolean;
  prompt?: string; options?: FlowNode[]; action?: FlowAction; next?: 'menu' | 'parent';
};
// A empresa guarda até `max` fluxos; um fica em uso no WhatsApp (active).
export type BotFlowSummary = { id: string; name: string; active: boolean; updatedAt: string };
export type BotFlow = BotFlowSummary & { flow: FlowNode };
export type BotFlowList = { flows: BotFlowSummary[]; max: number };
// Modelos do botão "+": do zero, o padrão ou o de agendamento pelo link.
export type FlowTemplate = 'vazio' | 'padrao' | 'link';
export type SoraUsage = { used: number; limit: number; enabled: boolean; allowed: boolean };
// IA do atendimento (entende texto livre e áudios no WhatsApp).
export type BotAiStatus = { used: number; limit: number; available: boolean; transcription: boolean; allowed: boolean };
export type BotAiUnderstood = {
  optionId: string | null; intent: string; answer: string | null;
  services: string[]; date: string | null; time: string | null; usage: BotAiStatus;
};
// Sora com conversas salvas (menu Sora e painel do Fluxo do bot).
export type SoraCatalogChange = {
  op: 'create' | 'update'; id: string | null; kind: ServiceKind; name: string; description: string | null;
  priceCents: number | null; durationMinutes: number | null; active: boolean | null;
};
export type SoraConversation = { id: string; title: string; source: 'chat' | 'fluxo'; createdAt: string; updatedAt: string; _count?: { messages: number } };
export type SoraStoredMessage = {
  id: string; role: 'user' | 'assistant'; text: string; createdAt: string;
  payload: { flow?: FlowNode | null; catalog?: SoraCatalogChange[] | null; catalogAppliedAt?: string } | null;
};
export type SoraSendResult = {
  conversation: SoraConversation; messages: SoraStoredMessage[]; flow: FlowNode | null; catalog: SoraCatalogChange[] | null;
  usage: { used: number; limit: number };
};

export type Dashboard = {
  clients: number; newClientsMonth: number; todayCount: number; monthAppointments: number; monthCompleted: number;
  monthRevenueCents: number; botAppointmentsMonth: number; unreadMessages: number; servicesCount: number; pendingUsers: number; hoursReviewed: boolean;
  whatsapp: { whatsappConnected: boolean; whatsappPhone: string | null; botEnabled: boolean };
  today: Appointment[]; upcoming: Appointment[]; week: { date: string; count: number }[];
};

export type AdminCompany = {
  id: string; name: string; slug: string; document: string | null; phone: string | null; email: string | null;
  subscription: Subscription; active: boolean; selfSignup: boolean; inviteCode: string; createdAt: string; whatsappConnected: boolean; whatsappPhone: string | null;
  emailCodesEnabled?: boolean;
  clientSubscriptionsEnabled?: boolean;
  users: number; admins: { id: string; name: string; email: string; avatarUrl: string | null }[]; clients: number; appointments: number; services: number;
};
// Pessoa cadastrada na Sysora (painel master > Usuários).
export type AdminUser = {
  id: string; name: string; email: string; phone: string | null; avatarUrl: string | null;
  isSuperAdmin: boolean; active: boolean; google: boolean; lastLoginAt: string | null; createdAt: string;
  companies: { id: string; name: string; companyActive: boolean; role: Role; status: 'PENDING' | 'ACTIVE'; active: boolean }[];
};
export type AdminStats = {
  companies: number; accounts: number; payingAccounts: number; trialAccounts: number; mrrCents: number; complimentaryAccounts?: number;
  users: number; clients: number; appointmentsThisMonth: number; whatsappConnected: number;
};
export type AccountOverview = {
  subscription: Subscription; plans: PlanInfo[]; canCreateCompany: boolean;
  companies: { id: string; name: string; active: boolean; users: number; whatsappConnected: boolean; whatsappPhone: string | null }[];
};

// ============ Cliente HTTP ============
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (!(err instanceof ApiError)) return err instanceof TypeError ? 'Não foi possível conectar ao servidor.' : fallback;
  // Erro de validação: mostra a primeira mensagem de campo, que é mais útil que "Dados inválidos".
  const fields = (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  const first = fields && Object.values(fields).flat()[0];
  return first || err.message;
}

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } | null = null;
  try { body = await res.json(); } catch { /* corpo vazio */ }
  return new ApiError(res.status, body?.error?.code || 'UNKNOWN', body?.error?.message || 'Ocorreu um erro inesperado. Tente novamente.', body?.error?.details);
}

// Várias requisições com token vencido ao mesmo tempo compartilham um único refresh.
let refreshPromise: Promise<Session | null> | null = null;
let onSessionChange: ((session: Session | null) => void) | null = null;
// Assinatura vencida (HTTP 402): o app recarrega a sessão para mostrar o aviso.
let onSubscriptionBlocked: (() => void) | null = null;
export const subscribeSubscriptionBlocked = (fn: typeof onSubscriptionBlocked) => { onSubscriptionBlocked = fn; };
export const subscribeSession = (fn: typeof onSessionChange) => { onSessionChange = fn; };

// Aviso para a tela de login quando a sessão é encerrada pelo backend (ex.:
// funcionário de empresa com o plano vencido). Fica no sessionStorage para
// sobreviver ao redirecionamento.
const LOGIN_NOTICE_KEY = 'sysora:login-notice';
export function takeLoginNotice(): string | null {
  try {
    const notice = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    sessionStorage.removeItem(LOGIN_NOTICE_KEY);
    return notice;
  } catch {
    return null;
  }
}
function saveLoginNotice(message: string) {
  try { sessionStorage.setItem(LOGIN_NOTICE_KEY, message); } catch { /* sem storage: só não mostra o aviso */ }
}

// Aviso dentro do app (ex.: levado para outra empresa). Se ninguém estiver
// ouvindo ainda (app carregando), fica guardado até o AppShell assinar.
let onNotice: ((message: string) => void) | null = null;
let pendingNotice: string | null = null;
export const subscribeNotice = (fn: typeof onNotice) => {
  onNotice = fn;
  if (fn && pendingNotice) { fn(pendingNotice); pendingNotice = null; }
};
function emitNotice(message: string) {
  if (onNotice) onNotice(message);
  else pendingNotice = message;
}

// Banco em manutenção (backend responde 503 DATABASE_NOT_READY, ver
// lib/schemaGuard.ts no backend): mostra o aviso (MaintenanceBanner) e não
// derruba a sessão de ninguém. Some sozinho na primeira resposta normal.
const MAINTENANCE_CODE = 'DATABASE_NOT_READY';
let maintenance = false;
const maintenanceListeners = new Set<(on: boolean) => void>();
export const isMaintenance = () => maintenance;
export function subscribeMaintenance(fn: (on: boolean) => void) {
  maintenanceListeners.add(fn);
  return () => { maintenanceListeners.delete(fn); };
}
function setMaintenance(on: boolean) {
  if (maintenance === on) return;
  maintenance = on;
  maintenanceListeners.forEach((fn) => fn(on));
}
const isMaintenanceError = (err: unknown) => err instanceof ApiError && err.code === MAINTENANCE_CODE;

function silentRefresh(): Promise<Session | null> {
  refreshPromise ??= authApi.refresh()
    .then((session) => { onSessionChange?.(session); return session; })
    .catch((err) => {
      if (isMaintenanceError(err)) return null;
      setAccessToken(null); onSessionChange?.(null); return null;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  // Modo demonstração: responde com dados fictícios, sem backend.
  if (demoMode()) {
    try {
      return await demoRequest<T>(path, init);
    } catch (err) {
      const demo = err as { demo?: boolean; status: number; message: string };
      if (demo?.demo) throw new ApiError(demo.status, 'DEMO', demo.message);
      throw err;
    }
  }

  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await silentRefresh()) return request<T>(path, init, false);
  }
  if (res.status === 402) onSubscriptionBlocked?.();
  if (!res.ok) {
    const error = await parseError(res);
    if (error.code === MAINTENANCE_CODE) setMaintenance(true);
    // Funcionário de empresa com o plano vencido:
    // - no login e na troca de empresa, o erro só aparece na tela;
    // - no refresh, não há outra empresa disponível: encerra a sessão e leva o aviso para o login;
    // - numa tela qualquer (venceu com o sistema aberto), renova a sessão: o backend
    //   leva para outra empresa com o plano em dia, se houver (ver refreshSession).
    if (error.code === 'COMPANY_SUBSCRIPTION_INACTIVE') {
      if (path === '/auth/refresh') {
        saveLoginNotice(error.message);
        setAccessToken(null);
        onSessionChange?.(null);
      } else if (!path.startsWith('/auth/')) {
        void silentRefresh();
      }
    }
    throw error;
  }
  setMaintenance(false);
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  const notice = (data as { notice?: unknown } | null)?.notice;
  if (path === '/auth/refresh' && typeof notice === 'string') emitNotice(notice);
  return data;
}

const get = <T>(path: string) => request<T>(path);
const send = <T>(method: string, path: string, body?: unknown) => request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const qs = (params: Record<string, string | undefined | null>) => {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

function keep(session: Session): Session {
  setAccessToken(session.accessToken);
  return session;
}

// ============ Endpoints ============
// Cadastro com e-mail e senha, ou com o googleToken do login com Google.
type Credentials = { email: string; password: string } | { googleToken: string };
// acceptTerms: aceite dos Termos de Uso e da Política de Privacidade (LGPD), obrigatório no backend.
export type RegisterCompanyInput = { plan: PlanId; companyName: string; name: string; phone?: string | null; acceptTerms: true } & Credentials;
export type RegisterEmployeeInput = { inviteCode: string; name: string; phone?: string | null; acceptTerms: true } & Credentials;

export const authApi = {
  signupConfig: () => get<{ companySignup: boolean }>('/auth/signup-config'),
  register: async (input: RegisterCompanyInput) => keep(await send<Session>('POST', '/auth/register', input)),
  registerEmployee: (input: RegisterEmployeeInput) => send<{ message: string }>('POST', '/auth/register-employee', input),
  lookupInvite: (code: string) => get<{ name: string; subscriptionActive: boolean }>(`/auth/invite/${encodeURIComponent(code)}`),
  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await send<LoginResponse>('POST', '/auth/login', { email, password });
    return 'accessToken' in result ? keep(result) : result;
  },
  // intent 'join': veio do cadastro de funcionário (convite); conta existente também conclui o pedido.
  async google(accessToken: string, intent?: 'login' | 'join'): Promise<GoogleLoginResponse> {
    const result = await send<GoogleLoginResponse>('POST', '/auth/google', { accessToken, intent });
    return 'accessToken' in result ? keep(result) : result;
  },
  loginCompany: async (preAuthToken: string, companyId: string) => keep(await send<Session>('POST', '/auth/login/company', { preAuthToken, companyId })),
  refresh: async () => keep(await send<Session>('POST', '/auth/refresh')),
  switchCompany: async (companyId: string | null) => keep(await send<Session>('POST', '/auth/switch-company', { companyId })),
  companies: () => get<{ companies: CompanyChoice[] }>('/auth/companies').then((r) => r.companies),
  memberships: () => get<{ memberships: MyMembership[] }>('/auth/memberships').then((r) => r.memberships),
  logout: async () => { try { await send('POST', '/auth/logout'); } finally { setAccessToken(null); } },
  forgotPassword: (email: string) => send<{ message: string }>('POST', '/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => send<{ message: string }>('POST', '/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) => send<{ message: string }>('POST', '/auth/change-password', { currentPassword, newPassword }),
};

export type CompanyInput = { name: string; document?: string | null; phone?: string | null; email?: string | null };
export type AccountInput = { plan?: PlanId; status?: SubscriptionStatus; trialEndsAt?: string | null; paidUntil?: string | null; complimentary?: boolean };
// Configurações da plataforma, editadas pelo admin master.
// usdBrlRate: cotação do dólar (R$ por US$ 1) para o gasto da IA em reais (página Gastos).
export type PlatformSettings = { publicSignupEnabled: boolean; aiCreditCents: number; usdBrlRate: number };
// Gastos com IA (Sora), estimados pelos tokens de cada chamada.
export type AiUsageSummary = {
  configured: boolean; model: string; monthlyLimitPerCompany: number;
  creditUsd: number; spentUsd: number; remainingUsd: number; calls: number;
  month: { spentUsd: number; calls: number; inputTokens: number; outputTokens: number };
  byCompany: { companyId: string | null; name: string; calls: number; spentUsd: number }[];
  recent: { id: string; company: string; feature: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; createdAt: string }[];
};
// Gastos da Sysora (painel master): cadastrados em reais + IA convertida pela cotação.
export type ExpenseCategory = 'infraestrutura' | 'ferramentas' | 'marketing' | 'impostos' | 'pessoal' | 'outros';
// date: dia do gasto (único) ou início (mensal). endDate: último mês do mensal (nulo = continua).
export type Expense = {
  id: string; description: string; category: ExpenseCategory; amountCents: number;
  date: string; recurring: boolean; endDate: string | null; notes: string | null;
};
export type ExpenseInput = Omit<Expense, 'id'>;
export type ExpensesSummary = {
  month: string; rate: number; revenueCents: number; expenses: Expense[];
  ai: { usd: number; brlCents: number; byFeature: { feature: string; calls: number; usd: number; brlCents: number }[] };
  totals: { manualCents: number; aiCents: number; totalCents: number };
  history: { month: string; manualCents: number; aiCents: number }[];
};
export const adminApi = {
  stats: () => get<AdminStats>('/admin/stats'),
  settings: () => get<{ settings: PlatformSettings }>('/admin/settings').then((r) => r.settings),
  updateSettings: (input: Partial<PlatformSettings>) =>
    send<{ settings: PlatformSettings }>('PATCH', '/admin/settings', input).then((r) => r.settings),
  aiUsage: () => get<AiUsageSummary>('/admin/ai-usage'),
  expenses: (month: string) => get<ExpensesSummary>(`/admin/expenses?month=${month}`),
  createExpense: (input: ExpenseInput) => send<{ expense: Expense }>('POST', '/admin/expenses', input).then((r) => r.expense),
  updateExpense: (id: string, input: Partial<ExpenseInput>) => send<{ expense: Expense }>('PATCH', `/admin/expenses/${id}`, input).then((r) => r.expense),
  deleteExpense: (id: string) => send('DELETE', `/admin/expenses/${id}`),
  users: () => get<{ users: AdminUser[] }>('/admin/users').then((r) => r.users),
  companies: () => get<{ companies: AdminCompany[] }>('/admin/companies').then((r) => r.companies),
  createCompany: (input: CompanyInput & { plan: PlanId; trial: boolean; admin: { name: string; email: string; password: string } }) =>
    send<{ adminAlreadyExisted: boolean }>('POST', '/admin/companies', input),
  updateCompany: (id: string, input: Partial<CompanyInput> & { active?: boolean; emailCodesEnabled?: boolean; clientSubscriptionsEnabled?: boolean }) =>
    send('PATCH', `/admin/companies/${id}`, input),
  // confirmName: nome da empresa digitado (trava do backend contra exclusão por engano).
  deleteCompany: (id: string, confirmName: string) => send('DELETE', `/admin/companies/${id}`, { confirmName }),
  updateAccount: (accountId: string, input: AccountInput) =>
    send<{ subscription: Subscription }>('PATCH', `/admin/accounts/${accountId}`, input).then((r) => r.subscription),
  registerPayment: (accountId: string) =>
    send<{ subscription: Subscription }>('POST', `/admin/accounts/${accountId}/payment`).then((r) => r.subscription),
  surveys: () => get<SurveySummary>('/admin/surveys'),
  privacy: () => get<AdminPrivacy>('/admin/privacy/requests'),
  resolvePrivacy: (id: string, response: string) => send('POST', `/admin/privacy/requests/${id}/resolve`, { response }),
  whatsapp: () => get<WhatsAppPlatformSetup>('/admin/whatsapp'),
  whatsappCheck: () => send<WhatsAppPlatformCheck>('POST', '/admin/whatsapp/check'),
  whatsappWebhook: () => send<WhatsAppPlatformCheck>('POST', '/admin/whatsapp/webhook'),
};

// App da Meta da Sysora (painel master → WhatsApp oficial).
export type WhatsAppPlatformSetup = {
  enabled: boolean;
  config: { appId: string | null; appSecretSet: boolean; configId: string | null; verifyTokenSet: boolean; publicApiUrl: string | null; graphVersion: string };
  webhook: { url: string; verifyToken: string | null; fields: string[] };
  companies: { official: number; qr: number };
};
export type WhatsAppPlatformCheck = {
  app: { ok: boolean; name: string | null; error: string | null };
  webhook: { configured: boolean; callbackUrl: string | null; urlMatches: boolean; missingFields: string[]; error?: string } | null;
};

export const accountApi = {
  get: () => get<AccountOverview>('/account'),
  createCompany: (name: string) => send<{ company: AuthCompany }>('POST', '/account/companies', { name }).then((r) => r.company),
  changePlan: (plan: PlanId) => send<{ subscription: Subscription }>('PATCH', '/account/plan', { plan }).then((r) => r.subscription),
};

export type MpSubscriptionStatus = {
  mpStatus: 'authorized' | 'paused' | 'cancelled' | null;
  nextPaymentDate: string | null;
  lastFourDigits: string | null;
};

export type PixData = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
};

export const subscriptionsApi = {
  checkout: (body: { cardTokenId: string; payerEmail: string; plan: PlanId; installments?: number; paymentMethodId?: string }) =>
    send<{ subscription: Subscription; pending: boolean }>('POST', '/subscriptions/checkout', body),
  cancel: () =>
    send<{ subscription: Subscription }>('POST', '/subscriptions/cancel').then((r) => r.subscription),
  status: () => get<MpSubscriptionStatus>('/subscriptions/status'),
  generatePix: (body: { plan: PlanId; payerEmail: string }) =>
    send<PixData>('POST', '/subscriptions/pix', body),
  pixStatus: (paymentId: string) =>
    get<{ paid: boolean }>(`/subscriptions/pix/${paymentId}/status`),
};

export type MemberInput = { name: string; email: string; phone?: string | null; password: string; role: Role };
export const usersApi = {
  list: () => get<{ users: Member[] }>('/users').then((r) => r.users),
  create: (input: MemberInput) => send<{ user: Member }>('POST', '/users', input).then((r) => r.user),
  update: (membershipId: string, input: Partial<Omit<MemberInput, 'email'>> & { active?: boolean }) =>
    send<{ user: Member }>('PATCH', `/users/${membershipId}`, input).then((r) => r.user),
  remove: (membershipId: string) => send('DELETE', `/users/${membershipId}`),
  pending: () => get<{ users: Member[] }>('/users/pending').then((r) => r.users),
  approve: (membershipId: string, role: Role) => send<{ user: Member }>('POST', `/users/${membershipId}/approve`, { role }).then((r) => r.user),
  reject: (membershipId: string) => send('POST', `/users/${membershipId}/reject`),
};

// Caixa de e-mail de onde o bot tira os códigos (aba Códigos por e-mail).
export type EmailInbox = {
  id: string; label: string; email: string; senders: string; active: boolean; lastError: string | null; createdAt: string; clientIds: string[];
};
export type FoundEmailCode = { code: string | null; link: string | null; subject: string; from: string; receivedAt: string };
export type EmailInboxInput = { label: string; email: string; appPassword: string; senders?: string };
export const emailCodesApi = {
  list: () => send<{ inboxes: EmailInbox[]; defaultSenders: string; windowMinutes: number }>('GET', '/email-codes'),
  create: (input: EmailInboxInput) => send<{ inbox: EmailInbox }>('POST', '/email-codes', input).then((r) => r.inbox),
  update: (id: string, input: Partial<Omit<EmailInboxInput, 'email'>> & { active?: boolean }) =>
    send<{ inbox: EmailInbox }>('PATCH', `/email-codes/${id}`, input).then((r) => r.inbox),
  remove: (id: string) => send('DELETE', `/email-codes/${id}`),
  test: (id: string) => send<{ found: FoundEmailCode | null }>('POST', `/email-codes/${id}/test`).then((r) => r.found),
  setInboxClients: (id: string, ids: string[]) => send<{ inbox: EmailInbox }>('PUT', `/email-codes/${id}/clients`, { ids }).then((r) => r.inbox),
  setClientInboxes: (clientId: string, ids: string[]) => send('PUT', `/email-codes/clients/${clientId}`, { ids }),
};

// Assinatura de um cliente (produto vendido por mês). Cada registro é um
// período pago: data da compra e vencimento (AAAA-MM-DD). Na lista, o período
// atual de cada cliente e quantos ele já pagou (periods).
export type ClientSubscription = {
  id: string; clientId: string; serviceId: string | null; name: string; priceCents: number;
  startDate: string; dueDate: string; source: Source; notes: string | null; canceledAt: string | null; createdAt: string;
  client: { id: string; name: string; phone: string };
  service: { id: string; name: string; accessEmail: string | null } | null;
  periods?: number;
};
export type ClientSubscriptionInput = {
  clientId: string; serviceId?: string | null; name?: string; priceCents?: number; startDate: string; dueDate?: string; months?: number; notes?: string | null;
};
export const clientSubscriptionsApi = {
  list: () => get<{ subscriptions: ClientSubscription[] }>('/client-subscriptions').then((r) => r.subscriptions),
  ofClient: (clientId: string) => get<{ subscriptions: ClientSubscription[] }>(`/client-subscriptions/client/${clientId}`).then((r) => r.subscriptions),
  create: (input: ClientSubscriptionInput) => send<{ subscription: ClientSubscription }>('POST', '/client-subscriptions', input).then((r) => r.subscription),
  renew: (id: string, input: { startDate?: string; months?: number; priceCents?: number; notes?: string | null }) =>
    send<{ subscription: ClientSubscription }>('POST', `/client-subscriptions/${id}/renew`, input).then((r) => r.subscription),
  update: (id: string, input: Partial<Pick<ClientSubscriptionInput, 'name' | 'priceCents' | 'startDate' | 'dueDate' | 'notes'>>) =>
    send<{ subscription: ClientSubscription }>('PATCH', `/client-subscriptions/${id}`, input).then((r) => r.subscription),
  cancel: (id: string) => send<{ subscription: ClientSubscription }>('POST', `/client-subscriptions/${id}/cancel`).then((r) => r.subscription),
  remove: (id: string) => send('DELETE', `/client-subscriptions/${id}`),
};

// Página pública do link de agendamento mandado pelo bot (sem login).
export type PublicBooking = {
  company: { name: string; phone: string | null; address: string | null };
  // name nulo: o cliente ainda não informou o nome (a página pergunta).
  client: { name: string | null; phone: string };
  services: { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number }[];
  hours: { openingTime: string; closingTime: string; workDays: number[] };
  expiresAt: string;
};
export type PublicBookingResult = { date: string; startTime: string; endTime: string; totalCents: number; services: string[] };
// notified: a confirmação foi para o WhatsApp do cliente (empresa conectada).
// Comprovante do agendamento pelo link (página /comprovante/[token]).
export type BookingReceipt = {
  code: string; status: AppointmentStatus; date: string; startTime: string; endTime: string; totalCents: number;
  items: { name: string; durationMinutes: number; priceCents: number }[];
  client: { name: string | null; phone: string };
  company: { name: string; phone: string | null; address: string | null };
  createdAt: string;
};
export const bookingApi = {
  get: (token: string) => get<PublicBooking>(`/booking/${encodeURIComponent(token)}`),
  days: (token: string, serviceIds: string[]) =>
    get<{ days: string[] }>(`/booking/${encodeURIComponent(token)}/days${qs({ services: serviceIds.join(',') })}`).then((r) => r.days),
  times: (token: string, serviceIds: string[], date: string) =>
    get<{ times: string[] }>(`/booking/${encodeURIComponent(token)}/times${qs({ services: serviceIds.join(','), date })}`).then((r) => r.times),
  book: (token: string, input: { serviceIds: string[]; date: string; time: string; name?: string }) =>
    send<{ appointment: PublicBookingResult; notified: boolean; receiptUrl: string; address: string | null }>('POST', `/booking/${encodeURIComponent(token)}`, input),
  receipt: (token: string) => get<BookingReceipt>(`/booking/receipt/${encodeURIComponent(token)}`),
};

export type ClientInput = { name: string; phone: string; email?: string | null; birthday?: string | null; notes?: string | null; reminders?: boolean };
export const clientsApi = {
  list: (search?: string) => get<{ clients: Client[] }>(`/clients${qs({ search })}`).then((r) => r.clients),
  get: (id: string) => get<{ client: ClientDetail }>(`/clients/${id}`).then((r) => r.client),
  create: (input: ClientInput) => send<{ client: Client }>('POST', '/clients', input).then((r) => r.client),
  update: (id: string, input: Partial<ClientInput>) => send<{ client: Client }>('PATCH', `/clients/${id}`, input).then((r) => r.client),
  remove: (id: string) => send('DELETE', `/clients/${id}`),
};

export type ServiceInput = { kind?: ServiceKind; name: string; description?: string | null; durationMinutes: number; priceCents: number; active?: boolean; position?: number; accessEmail?: string | null };
export const servicesApi = {
  list: () => get<{ services: Service[] }>('/services').then((r) => r.services),
  create: (input: ServiceInput) => send<{ service: Service }>('POST', '/services', input).then((r) => r.service),
  update: (id: string, input: Partial<ServiceInput>) => send<{ service: Service }>('PATCH', `/services/${id}`, input).then((r) => r.service),
  remove: (id: string) => send('DELETE', `/services/${id}`),
  // Texto sugerido pela IA para a descrição (não salva nada).
  improveDescription: (input: { kind?: ServiceKind; name: string; description?: string | null; priceCents?: number; durationMinutes?: number }) =>
    send<{ description: string }>('POST', '/services/improve-description', input).then((r) => r.description),
};

export type AppointmentInput = {
  clientId: string; serviceIds: string[]; date: string; startTime: string;
  staffId?: string | null; notes?: string | null; ignoreConflicts?: boolean;
};
export const appointmentsApi = {
  list: (params: { from?: string; to?: string; status?: AppointmentStatus; clientId?: string }) =>
    get<{ appointments: Appointment[] }>(`/appointments${qs(params)}`).then((r) => r.appointments),
  availability: (date: string, serviceIds: string[], excludeId?: string) =>
    get<{ times: string[]; duration: number }>(`/appointments/availability${qs({ date, serviceIds: serviceIds.join(','), excludeId })}`),
  create: (input: AppointmentInput) => send<{ appointment: Appointment }>('POST', '/appointments', input).then((r) => r.appointment),
  update: (id: string, input: Partial<Omit<AppointmentInput, 'clientId'>>) =>
    send<{ appointment: Appointment }>('PATCH', `/appointments/${id}`, input).then((r) => r.appointment),
  setStatus: (id: string, status: AppointmentStatus) =>
    send<{ appointment: Appointment }>('POST', `/appointments/${id}/status`, { status }).then((r) => r.appointment),
  remove: (id: string) => send('DELETE', `/appointments/${id}`),
};

// Pelo WhatsApp oficial a equipe só escreve até 24 h depois da última mensagem do cliente.
export type ConversationChannel = { official: boolean; windowEndsAt: string | null; canReply: boolean; hiddenNumber: boolean };

export const conversationsApi = {
  list: () => get<{ conversations: Conversation[] }>('/conversations').then((r) => r.conversations),
  get: (clientId: string) => get<{ client: Client; messages: Message[]; bot: BotState; channel: ConversationChannel }>(`/conversations/${clientId}`),
  reply: (clientId: string, text: string) => send<{ bot: BotState }>('POST', `/conversations/${clientId}/reply`, { text }),
  resumeBot: (clientId: string) => send<{ bot: BotState }>('POST', `/conversations/${clientId}/resume-bot`),
};

export const dashboardApi = { get: () => get<Dashboard>('/dashboard') };

// Pesquisa inicial (todo usuário de empresa). status: done = respondeu;
// dismissed = escolheu responder depois; pending = ainda não viu o convite.
export type SurveyStatus = { eligible: boolean; status: 'done' | 'dismissed' | 'pending' };
export type SurveyAnswers = {
  sources: string[]; sourceOther?: string | null; business: string; businessOther?: string | null;
  teamSize: string; features: string[]; featuresOther?: string | null; comment?: string | null;
};
// LGPD: consentimento de cookies e direitos do titular (Minha conta → Privacidade).
export type PrivacyRequest = {
  id: string; type: string; message: string | null; status: 'OPEN' | 'DONE'; response: string | null; createdAt: string; resolvedAt: string | null;
};
export const privacyApi = {
  consent: (input: { consentId: string; analytics: boolean; marketing: boolean; policyVersion: string }) => send<void>('POST', '/privacy/consent', input),
  exportMyData: () => get<Record<string, unknown>>('/privacy/me/export'),
  requests: () => get<{ requests: PrivacyRequest[] }>('/privacy/requests').then((r) => r.requests),
  createRequest: (type: string, message: string | null) => send<{ request: PrivacyRequest; alreadyOpen?: boolean }>('POST', '/privacy/requests', { type, message }),
};
export type AdminPrivacyRequest = PrivacyRequest & { dueAt: string; user: { name: string; email: string; companies: string[] } };
export type AdminPrivacy = { requests: AdminPrivacyRequest[]; consents: { total: number; analytics: number; marketing: number } };

export const surveyApi = {
  status: () => get<SurveyStatus>('/survey'),
  submit: (answers: SurveyAnswers) => send<{ status: 'done' }>('POST', '/survey', answers),
  dismiss: () => send<{ status: 'dismissed' }>('POST', '/survey/dismiss'),
};

type Tally = { id: string; count: number }[];
export type SurveySummary = {
  total: number; users: number; dismissed: number;
  sources: Tally; business: Tally; teamSize: Tally; features: Tally;
  responses: (SurveyAnswers & { id: string; createdAt: string; user: { name: string; email: string }; company: string | null })[];
};

export const settingsApi = {
  get: () => get<{ settings: Settings; company: CompanyProfile }>('/settings'),
  update: (input: Partial<Settings>) => send<{ settings: Settings }>('PUT', '/settings', input).then((r) => r.settings),
  updateCompany: (input: Partial<Pick<CompanyProfile, 'name' | 'document' | 'phone' | 'email' | 'address'>>) =>
    send<{ company: CompanyProfile }>('PATCH', '/settings/company', input).then((r) => r.company),
  regenerateInviteCode: () => send<{ inviteCode: string }>('POST', '/settings/invite-code').then((r) => r.inviteCode),
};

export const whatsappApi = {
  status: () => get<WhatsAppStatus>('/whatsapp/status'),
  connect: () => send<WhatsAppStatus>('POST', '/whatsapp/connect'),
  disconnect: () => send<WhatsAppStatus>('POST', '/whatsapp/disconnect'),
  test: (to: string) => send<{ message: string }>('POST', '/whatsapp/test', { to }),
  cloudConfig: () => get<WhatsAppCloudConfig>('/whatsapp/cloud/config'),
  cloudOnboard: (input: WhatsAppOnboardInput) => send<WhatsAppStatus>('POST', '/whatsapp/cloud/onboard', input),
  cloudUsage: () => get<WhatsAppUsage>('/whatsapp/cloud/usage'),
  cloudTemplates: () => send<WhatsAppStatus>('POST', '/whatsapp/cloud/templates'),
  // Fluxo em uso (o que o WhatsApp está usando).
  flow: () => get<BotFlow>('/whatsapp/flow'),
  flows: () => get<BotFlowList>('/whatsapp/flows'),
  getFlow: (id: string) => get<BotFlow>(`/whatsapp/flows/${id}`),
  createFlow: (template: FlowTemplate, name?: string) => send<BotFlow>('POST', '/whatsapp/flows', { template, name }),
  saveFlow: (id: string, input: { flow?: FlowNode; name?: string }) => send<BotFlow>('PUT', `/whatsapp/flows/${id}`, input),
  activateFlow: (id: string) => send<BotFlowList>('POST', `/whatsapp/flows/${id}/activate`),
  deleteFlow: (id: string) => send<BotFlowList>('DELETE', `/whatsapp/flows/${id}`),
  // IA do atendimento: status/uso e o que ela entenderia de uma mensagem (simulador).
  ai: () => get<BotAiStatus>('/whatsapp/ai'),
  understand: (flow: FlowNode, text: string, nodeId?: string) => send<BotAiUnderstood>('POST', '/whatsapp/flow/understand', { flow, text, nodeId }),
  // Conversa com o bot de verdade, sem gravar nem enviar nada (ver whatsapp.simulator.ts).
  // Sem flow, o backend usa o fluxo salvo (o mesmo do WhatsApp).
  simulate: (input: { simId: string | null; text: string; flow?: FlowNode; profileName?: string }) =>
    send<{ simId: string; replies: string[]; step: string | null; inactive: boolean }>('POST', '/whatsapp/simulate', input),
};

// Sora: conversas salvas, catálogo e fluxo. O fluxo que ela devolve é
// rascunho (quem salva é whatsappApi.saveFlow); o catálogo só entra com applyCatalog.
// Fluxo proposto no menu Sora, levado para o editor (sessionStorage) como rascunho.
export const SORA_FLOW_DRAFT_KEY = 'sysora:sora-flow-draft';

export const soraApi = {
  usage: () => get<SoraUsage>('/sora/usage'),
  conversations: () => get<{ conversations: SoraConversation[] }>('/sora/conversations').then((r) => r.conversations),
  conversation: (id: string) => get<{ conversation: SoraConversation; messages: SoraStoredMessage[] }>(`/sora/conversations/${id}`),
  remove: (id: string) => send('DELETE', `/sora/conversations/${id}`),
  send: (input: { conversationId: string | null; text: string; mode: 'chat' | 'fluxo'; flow?: FlowNode }) => send<SoraSendResult>('POST', '/sora/messages', input),
  applyCatalog: (messageId: string) => send<{ created: string[]; updated: string[] }>('POST', `/sora/messages/${messageId}/apply-catalog`),
};
