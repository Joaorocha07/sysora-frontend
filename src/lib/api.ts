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
export type CompanyChoice = AuthCompany & { role: Role };
export type PlanId = 'INICIAL' | 'AVANCADO';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type Subscription = {
  accountId: string; plan: PlanId; planName: string; priceCents: number; status: SubscriptionStatus;
  trialEndsAt: string | null; paidUntil: string | null; active: boolean; maxCompanies: number; maxEmployees: number;
};
export type PlanInfo = { id: PlanId; name: string; priceCents: number; maxCompanies: number; maxEmployees: number; features: string[] };
export type Session = { accessToken: string; user: AuthUser; company: AuthCompany | null; role: Role | null; subscription: Subscription | null };
export type LoginResponse = Session | { status: 'select-company'; preAuthToken: string; companies: CompanyChoice[] };
// Login com Google de um e-mail sem conta: o token conclui o cadastro sem senha.
export type GoogleLoginResponse = LoginResponse | { status: 'signup-required'; signupToken: string; email: string; name: string; avatarUrl: string | null };

export type Member = { membershipId: string; id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; role: Role; active: boolean; createdAt: string };

export type Client = {
  id: string; name: string; phone: string; email: string | null; birthday: string | null; notes: string | null;
  whatsappId: string | null; source: Source; lastMessageAt: string | null; unreadCount: number; createdAt: string;
  _count?: { appointments: number };
};

export type Service = {
  id: string; name: string; description: string | null; durationMinutes: number; priceCents: number;
  active: boolean; position: number; _count?: { appointments: number };
};

export type AppointmentItem = { id: string; serviceId: string | null; name: string; durationMinutes: number; priceCents: number };
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
  botEnabled: boolean; autoCreateClient: boolean; askName: boolean;
  greetingMessage: string; handoffMessage: string; confirmationMessage: string;
  reminderEnabled: boolean; reminderTime: string; reminderMessage: string;
  hourReminderEnabled: boolean; hourReminderMinutes: number; hourReminderMessage: string;
  pauseOnStaffReply: boolean; humanTimeoutMinutes: number; humanEndMessage: string;
};
export type CompanyProfile = { id: string; name: string; slug: string; document: string | null; phone: string | null; email: string | null; inviteCode: string };

export type WhatsAppStatus = { status: 'disconnected' | 'connecting' | 'qr' | 'connected'; qr: string | null; phone: string | null; error: string | null };

export type Dashboard = {
  clients: number; newClientsMonth: number; todayCount: number; monthAppointments: number; monthCompleted: number;
  monthRevenueCents: number; botAppointmentsMonth: number; unreadMessages: number; servicesCount: number; pendingUsers: number;
  whatsapp: { whatsappConnected: boolean; whatsappPhone: string | null; botEnabled: boolean };
  today: Appointment[]; upcoming: Appointment[]; week: { date: string; count: number }[];
};

export type AdminCompany = {
  id: string; name: string; slug: string; document: string | null; phone: string | null; email: string | null;
  subscription: Subscription; active: boolean; selfSignup: boolean; inviteCode: string; createdAt: string; whatsappConnected: boolean; whatsappPhone: string | null;
  users: number; admins: { id: string; name: string; email: string; avatarUrl: string | null }[]; clients: number; appointments: number; services: number;
};
// Pessoa cadastrada no Sysora (painel master > Usuários).
export type AdminUser = {
  id: string; name: string; email: string; phone: string | null; avatarUrl: string | null;
  isSuperAdmin: boolean; active: boolean; google: boolean; lastLoginAt: string | null; createdAt: string;
  companies: { id: string; name: string; companyActive: boolean; role: Role; status: 'PENDING' | 'ACTIVE'; active: boolean }[];
};
export type AdminStats = {
  companies: number; accounts: number; payingAccounts: number; trialAccounts: number; mrrCents: number;
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
// Assinatura vencida (HTTP 402): o app leva o usuário para a tela de assinatura.
let onSubscriptionBlocked: (() => void) | null = null;
export const subscribeSubscriptionBlocked = (fn: typeof onSubscriptionBlocked) => { onSubscriptionBlocked = fn; };
export const subscribeSession = (fn: typeof onSessionChange) => { onSessionChange = fn; };

function silentRefresh(): Promise<Session | null> {
  refreshPromise ??= authApi.refresh()
    .then((session) => { onSessionChange?.(session); return session; })
    .catch(() => { setAccessToken(null); onSessionChange?.(null); return null; })
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
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
export type RegisterCompanyInput = { plan: PlanId; companyName: string; name: string; phone?: string | null } & Credentials;
export type RegisterEmployeeInput = { inviteCode: string; name: string; phone?: string | null } & Credentials;

export const authApi = {
  signupConfig: () => get<{ companySignup: boolean }>('/auth/signup-config'),
  register: async (input: RegisterCompanyInput) => keep(await send<Session>('POST', '/auth/register', input)),
  registerEmployee: (input: RegisterEmployeeInput) => send<{ message: string }>('POST', '/auth/register-employee', input),
  lookupInvite: (code: string) => get<{ name: string }>(`/auth/invite/${encodeURIComponent(code)}`),
  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await send<LoginResponse>('POST', '/auth/login', { email, password });
    return 'accessToken' in result ? keep(result) : result;
  },
  async google(accessToken: string): Promise<GoogleLoginResponse> {
    const result = await send<GoogleLoginResponse>('POST', '/auth/google', { accessToken });
    return 'accessToken' in result ? keep(result) : result;
  },
  loginCompany: async (preAuthToken: string, companyId: string) => keep(await send<Session>('POST', '/auth/login/company', { preAuthToken, companyId })),
  refresh: async () => keep(await send<Session>('POST', '/auth/refresh')),
  switchCompany: async (companyId: string | null) => keep(await send<Session>('POST', '/auth/switch-company', { companyId })),
  companies: () => get<{ companies: CompanyChoice[] }>('/auth/companies').then((r) => r.companies),
  logout: async () => { try { await send('POST', '/auth/logout'); } finally { setAccessToken(null); } },
  forgotPassword: (email: string) => send<{ message: string }>('POST', '/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => send<{ message: string }>('POST', '/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) => send<{ message: string }>('POST', '/auth/change-password', { currentPassword, newPassword }),
};

export type CompanyInput = { name: string; document?: string | null; phone?: string | null; email?: string | null };
export type AccountInput = { plan?: PlanId; status?: SubscriptionStatus; trialEndsAt?: string | null; paidUntil?: string | null };
export const adminApi = {
  stats: () => get<AdminStats>('/admin/stats'),
  users: () => get<{ users: AdminUser[] }>('/admin/users').then((r) => r.users),
  companies: () => get<{ companies: AdminCompany[] }>('/admin/companies').then((r) => r.companies),
  createCompany: (input: CompanyInput & { plan: PlanId; trial: boolean; admin: { name: string; email: string; password: string } }) =>
    send<{ adminAlreadyExisted: boolean }>('POST', '/admin/companies', input),
  updateCompany: (id: string, input: Partial<CompanyInput> & { active?: boolean }) => send('PATCH', `/admin/companies/${id}`, input),
  deleteCompany: (id: string) => send('DELETE', `/admin/companies/${id}`),
  updateAccount: (accountId: string, input: AccountInput) =>
    send<{ subscription: Subscription }>('PATCH', `/admin/accounts/${accountId}`, input).then((r) => r.subscription),
  registerPayment: (accountId: string) =>
    send<{ subscription: Subscription }>('POST', `/admin/accounts/${accountId}/payment`).then((r) => r.subscription),
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

export const subscriptionsApi = {
  checkout: (body: { cardTokenId: string; payerEmail: string; plan: PlanId }) =>
    send<{ subscription: Subscription }>('POST', '/subscriptions/checkout', body).then((r) => r.subscription),
  cancel: () =>
    send<{ subscription: Subscription }>('POST', '/subscriptions/cancel').then((r) => r.subscription),
  status: () => get<MpSubscriptionStatus>('/subscriptions/status'),
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

export type ClientInput = { name: string; phone: string; email?: string | null; birthday?: string | null; notes?: string | null };
export const clientsApi = {
  list: (search?: string) => get<{ clients: Client[] }>(`/clients${qs({ search })}`).then((r) => r.clients),
  get: (id: string) => get<{ client: ClientDetail }>(`/clients/${id}`).then((r) => r.client),
  create: (input: ClientInput) => send<{ client: Client }>('POST', '/clients', input).then((r) => r.client),
  update: (id: string, input: Partial<ClientInput>) => send<{ client: Client }>('PATCH', `/clients/${id}`, input).then((r) => r.client),
  remove: (id: string) => send('DELETE', `/clients/${id}`),
};

export type ServiceInput = { name: string; description?: string | null; durationMinutes: number; priceCents: number; active?: boolean; position?: number };
export const servicesApi = {
  list: () => get<{ services: Service[] }>('/services').then((r) => r.services),
  create: (input: ServiceInput) => send<{ service: Service }>('POST', '/services', input).then((r) => r.service),
  update: (id: string, input: Partial<ServiceInput>) => send<{ service: Service }>('PATCH', `/services/${id}`, input).then((r) => r.service),
  remove: (id: string) => send('DELETE', `/services/${id}`),
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

export const conversationsApi = {
  list: () => get<{ conversations: Conversation[] }>('/conversations').then((r) => r.conversations),
  get: (clientId: string) => get<{ client: Client; messages: Message[]; bot: BotState }>(`/conversations/${clientId}`),
  reply: (clientId: string, text: string) => send<{ bot: BotState }>('POST', `/conversations/${clientId}/reply`, { text }),
  resumeBot: (clientId: string) => send<{ bot: BotState }>('POST', `/conversations/${clientId}/resume-bot`),
};

export const dashboardApi = { get: () => get<Dashboard>('/dashboard') };

export const settingsApi = {
  get: () => get<{ settings: Settings; company: CompanyProfile }>('/settings'),
  update: (input: Partial<Settings>) => send<{ settings: Settings }>('PUT', '/settings', input).then((r) => r.settings),
  updateCompany: (input: Partial<Pick<CompanyProfile, 'name' | 'document' | 'phone' | 'email'>>) =>
    send<{ company: CompanyProfile }>('PATCH', '/settings/company', input).then((r) => r.company),
  regenerateInviteCode: () => send<{ inviteCode: string }>('POST', '/settings/invite-code').then((r) => r.inviteCode),
};

export const whatsappApi = {
  status: () => get<WhatsAppStatus>('/whatsapp/status'),
  connect: () => send<WhatsAppStatus>('POST', '/whatsapp/connect'),
  disconnect: () => send<WhatsAppStatus>('POST', '/whatsapp/disconnect'),
  test: (to: string) => send<{ message: string }>('POST', '/whatsapp/test', { to }),
};
