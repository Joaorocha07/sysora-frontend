'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowUpRight, Building2, CalendarDays, ChevronDown, ClipboardList, CreditCard, Eye, LayoutDashboard, LogOut, Menu, MessageCircle, QrCode,
  Settings, ShieldCheck, Sparkles, Tags, Users, UserCog, X,
} from 'lucide-react';
import Logo from './Logo';
import LogoutDialog from './LogoutDialog';
import ThemeToggle from './ThemeToggle';
import { useConfirmLeave } from './UnsavedChanges';
import { Avatar, Loading, Modal, useToast } from './ui';
import {
  authApi, conversationsApi, errorMessage, subscribeNotice, subscribeSubscriptionBlocked, surveyApi, usersApi, whatsappApi, type CompanyChoice, type Subscription,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { demoMode } from '@/lib/demo';
import { ROLE_LABELS, firstName } from '@/lib/format';

// Dias até o fim do teste grátis (arredondado para cima).
// Dias inteiros que faltam (6,1 dias → 6); no último dia mostra "termina hoje".
// Conta dias do calendário (hoje → dia do fim), não blocos de 24h: no dia em que termina, mostra "termina hoje".
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysUntil = (date: string | null) => (date ? Math.max(0, Math.round((startOfDay(new Date(date)) - startOfDay(new Date())) / 86_400_000)) : 0);
const shortDate = (date: string | null) => (date ? new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

function SubscriptionBar({ subscription, isAdmin }: { subscription: Subscription; isAdmin: boolean }) {
  if (!subscription.active) {
    return (
      <div className="sub-bar alert">
        <AlertTriangle size={16} />
        <span>{subscription.status === 'TRIAL' ? 'Seu teste grátis terminou.' : 'Sua assinatura está vencida.'} Você pode consultar seus dados, mas cadastrar, editar e o bot do WhatsApp estão pausados. {isAdmin ? 'Assine um plano para liberar tudo.' : 'Avise o administrador da empresa.'}</span>
        {isAdmin && <Link href="/assinatura">Ver planos</Link>}
      </div>
    );
  }
  if (subscription.status === 'TRIAL') {
    const days = daysUntil(subscription.trialEndsAt);
    return (
      <div className="sub-bar">
        <Sparkles size={16} />
        <span>Teste grátis do plano <strong>{subscription.planName}</strong>: {days === 0 ? 'termina hoje' : `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`} (até {shortDate(subscription.trialEndsAt)}).</span>
        {isAdmin && <Link href="/assinatura">Assinar agora</Link>}
      </div>
    );
  }
  if (subscription.status === 'PAST_DUE') {
    return (
      <div className="sub-bar">
        <AlertTriangle size={16} />
        <span>Pagamento pendente. Regularize para não interromper o bot.</span>
        {isAdmin && <Link href="/assinatura">Ver assinatura</Link>}
      </div>
    );
  }
  return null;
}

type NavItem = { href: string; label: string; icon: typeof Users; adminOnly?: boolean };

const MAIN_NAV: NavItem[] = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/conversas', label: 'Conversas', icon: MessageCircle },
  { href: '/servicos', label: 'Catálogo', icon: Tags },
];
const ADMIN_NAV: NavItem[] = [
  { href: '/whatsapp', label: 'WhatsApp', icon: QrCode, adminOnly: true },
  { href: '/sora', label: 'Sora', icon: Sparkles, adminOnly: true },
  { href: '/equipe', label: 'Equipe', icon: UserCog, adminOnly: true },
  // Funcionários também abrem esta tela (aba Minha conta), mas ela só aparece no menu do admin.
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  // Liberada mesmo com a assinatura vencida (é onde o cliente regulariza).
  { href: '/assinatura', label: 'Assinatura', icon: CreditCard },
];
const ALL_NAV = [...MAIN_NAV, ...ADMIN_NAV];

// Contadores do menu, compartilhados com as páginas (ex.: conversa lida).
type ShellState = { unread: number; pendingUsers: number; whatsappConnected: boolean | null; refreshBadges: () => void };
const ShellContext = createContext<ShellState>({ unread: 0, pendingUsers: 0, whatsappConnected: null, refreshBadges: () => {} });
export const useShell = () => useContext(ShellContext);

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { status, user, company, role, isAdmin, subscription, switchCompany, reloadSession } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState<'company' | 'user' | null>(null);
  const [companies, setCompanies] = useState<CompanyChoice[]>([]);
  const [unread, setUnread] = useState(0);
  const [pendingUsers, setPendingUsers] = useState(0);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  // Convite da pesquisa inicial: aparece uma vez, no login (depois, só o aviso no painel).
  const [surveyInvite, setSurveyInvite] = useState(false);
  const confirmLeave = useConfirmLeave();

  const current = ALL_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const forbidden = Boolean(current?.adminOnly && !isAdmin);

  useEffect(() => { setDemo(Boolean(demoMode())); }, [status]);

  // Proteção das rotas: sem sessão -> login; admin master fora de empresa -> painel master.
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !company) router.replace(user?.isSuperAdmin ? '/master' : '/login');
    else if (status === 'authenticated' && forbidden) router.replace('/painel');
  }, [status, company, user, forbidden, router]);

  // A API recusou uma alteração por assinatura vencida (ex.: venceu com o sistema
  // aberto): recarrega a sessão para a barra de aviso aparecer. A própria tela
  // mostra a mensagem de erro do backend.
  useEffect(() => {
    subscribeSubscriptionBlocked(() => { void reloadSession(); });
    return () => subscribeSubscriptionBlocked(null);
  }, [reloadSession]);

  // O plano da empresa atual venceu e o backend levou o funcionário para outra
  // empresa com o plano em dia: avisa e volta ao painel da empresa nova.
  useEffect(() => {
    subscribeNotice((message) => {
      toast(message, true);
      router.replace('/painel');
    });
    return () => subscribeNotice(null);
  }, [toast, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !company || pathname === '/pesquisa') return;
    surveyApi.status().then((r) => setSurveyInvite(r.eligible && r.status === 'pending')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, company?.id]);

  // Fechar o convite (agora ou depois) conta como visto: daqui em diante só o aviso no painel.
  const closeSurveyInvite = (answer: boolean) => {
    setSurveyInvite(false);
    surveyApi.dismiss().catch(() => {});
    if (answer) router.push('/pesquisa');
  };

  const refreshBadges = useCallback(() => {
    conversationsApi.list().then((list) => setUnread(list.reduce((sum, c) => sum + c.unreadCount, 0))).catch(() => {});
    whatsappApi.status().then((s) => setWhatsappConnected(s.status === 'connected')).catch(() => {});
    if (isAdmin) usersApi.pending().then((list) => setPendingUsers(list.length)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (status !== 'authenticated' || !company) return;
    refreshBadges();
    authApi.companies().then(setCompanies).catch(() => {});
    const timer = setInterval(refreshBadges, 30_000);
    return () => clearInterval(timer);
  }, [status, company, refreshBadges]);

  useEffect(() => { setNavOpen(false); setMenu(null); }, [pathname]);

  function goToCompany(companyId: string | null) {
    setMenu(null);
    confirmLeave(() => { void switchTo(companyId); });
  }

  async function switchTo(companyId: string | null) {
    try {
      const session = await switchCompany(companyId);
      router.push(session.company ? '/painel' : '/master');
      if (session.company) toast(`Agora em ${session.company.name}`);
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  function signOut() {
    setMenu(null);
    confirmLeave(() => setConfirmingLogout(true));
  }

  if (status !== 'authenticated' || !company || !user || forbidden) return <Loading />;

  const canSwitch = user.isSuperAdmin || companies.length > 1;
  const navLink = ({ href, label, icon: Icon }: NavItem) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link key={href} href={href} className={active ? 'active' : ''}>
        <Icon size={18} />{label}
        {href === '/conversas' && unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
        {href === '/equipe' && pendingUsers > 0 && <span className="count" title="Pedidos de acesso">{pendingUsers}</span>}
        {href === '/whatsapp' && whatsappConnected !== null && <span className={`dot${whatsappConnected ? ' on' : ''}`} title={whatsappConnected ? 'Conectado' : 'Desconectado'} />}
      </Link>
    );
  };

  return (
    <ShellContext.Provider value={{ unread, pendingUsers, whatsappConnected, refreshBadges }}>
      <div className={`shell${navOpen ? ' nav-open' : ''}`}>
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Logo kind="icon" tone="white" className="icon" />
            <Logo kind="wordmark" tone="white" className="word" />
          </div>
          <div className="nav-label">Principal</div>
          <nav className="nav">{MAIN_NAV.map(navLink)}</nav>
          {isAdmin && (
            <>
              <div className="nav-label">Gestão</div>
              <nav className="nav">{ADMIN_NAV.map(navLink)}</nav>
            </>
          )}
          <div className="sidebar-bottom">
            {isAdmin && whatsappConnected === false && (
              <div className="wa-card">
                <span className="wa-icon"><MessageCircle size={17} /></span>
                <strong>Conecte o WhatsApp</strong>
                <p>Conecte o número pelo WhatsApp oficial e deixe o bot atender, cadastrar e agendar por você.</p>
                <Link href="/whatsapp">Conectar agora <ArrowUpRight size={14} /></Link>
              </div>
            )}
            <div className="sidebar-user">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div style={{ minWidth: 0 }}>
                <strong>{user.name}</strong>
                <small>{user.isSuperAdmin ? 'Admin master' : role ? ROLE_LABELS[role] : ''}</small>
              </div>
              <button type="button" className="icon-btn" onClick={signOut} aria-label="Sair" title="Sair"><LogOut size={17} /></button>
            </div>
          </div>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <button type="button" className="icon-btn bordered menu-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Menu">
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="crumbs">
              <span className="hide-mobile">{company.name}</span>
              <span className="hide-mobile">/</span>
              <strong>{current?.label ?? 'Sysora'}</strong>
            </div>
            <div className="spacer" />

            {canSwitch && (
              <div className="dropdown">
                <button type="button" className="company-pill" onClick={() => setMenu(menu === 'company' ? null : 'company')}>
                  <span className="hide-mobile">{company.name}</span>
                  <Avatar name={company.name} size="sm" inverse />
                  <ChevronDown size={15} />
                </button>
                {menu === 'company' && (
                  <div className="menu">
                    <div className="menu-label">Trocar de empresa</div>
                    {companies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => goToCompany(c.id)}
                        disabled={c.id === company.id || c.available === false}
                        title={c.available === false ? 'O plano desta empresa está vencido. Peça ao administrador dela para renovar.' : undefined}
                      >
                        <Building2 size={16} />{c.name}
                        {c.id === company.id
                          ? <small style={{ marginLeft: 'auto' }}>atual</small>
                          : c.available === false && <small style={{ marginLeft: 'auto' }}>plano vencido</small>}
                      </button>
                    ))}
                    {user.isSuperAdmin && (
                      <>
                        <div className="divider" />
                        <button type="button" onClick={() => goToCompany(null)}><ShieldCheck size={16} />Painel master</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <ThemeToggle />
            <div className="dropdown">
              <button type="button" className="row" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-label="Conta">
                <Avatar name={user.name} src={user.avatarUrl} />
                <span className="hide-mobile" style={{ fontWeight: 600 }}>{firstName(user.name)}</span>
                <ChevronDown size={15} className="hide-mobile" />
              </button>
              {menu === 'user' && (
                <div className="menu">
                  <div style={{ padding: '8px 12px 10px' }}>
                    <strong style={{ display: 'block' }}>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <div className="divider" />
                  <Link href="/configuracoes?aba=conta"><Settings size={16} />Minha conta</Link>
                  <button type="button" onClick={signOut}><LogOut size={16} />Sair</button>
                </div>
              )}
            </div>
          </header>

          {user.isSuperAdmin && (
            <div className="master-banner">
              <ShieldCheck size={16} />
              <span>Você está em <strong>{company.name}</strong> como admin master.</span>
              <button type="button" onClick={() => goToCompany(null)}>Voltar ao master</button>
            </div>
          )}

          {demo && (
            <div className="demo-bar">
              <Eye size={15} />
              <span><strong>Modo demonstração:</strong> dados fictícios, nada é salvo.</span>
              <button type="button" className="btn btn-sm btn-outline" onClick={signOut}>Sair da demonstração</button>
            </div>
          )}
          {subscription && <SubscriptionBar subscription={subscription} isAdmin={isAdmin} />}

          <main className="main">{children}</main>
        </div>
      </div>
      {confirmingLogout && <LogoutDialog onClose={() => setConfirmingLogout(false)} />}
      {surveyInvite && (
        <Modal
          title="Nos ajude a deixar a Sysora com a cara do seu negócio"
          onClose={() => closeSurveyInvite(false)}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => closeSurveyInvite(false)}>Responder depois</button>
            <button type="button" className="btn btn-primary" onClick={() => closeSurveyInvite(true)}>Responder agora</button>
          </>}
        >
          <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
            <span className="metric-icon" style={{ flex: 'none' }}><ClipboardList size={18} /></span>
            <p style={{ lineHeight: 1.6 }}>
              {firstName(user?.name ?? '') ? `${firstName(user?.name ?? '')}, queremos` : 'Queremos'} entender melhor como a sua empresa funciona para trazer recursos que façam diferença no seu dia a dia.
              {' '}São <strong>4 perguntas rápidas</strong>, de marcar: leva menos de 3 minutos.
            </p>
          </div>
        </Modal>
      )}
    </ShellContext.Provider>
  );
}
