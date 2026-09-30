'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowUpRight, Building2, CalendarDays, ChevronDown, CreditCard, Eye, LayoutDashboard, LogOut, Menu, MessageCircle, QrCode,
  Settings, ShieldCheck, Sparkles, Users, UserCog, Wrench, X,
} from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { Avatar, Loading, useToast } from './ui';
import { authApi, conversationsApi, errorMessage, subscribeSubscriptionBlocked, usersApi, whatsappApi, type CompanyChoice, type Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { demoMode } from '@/lib/demo';
import { ROLE_LABELS, firstName } from '@/lib/format';

// Dias até o fim do teste grátis (arredondado para cima).
const daysUntil = (date: string | null) => (date ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)) : 0);

function SubscriptionBar({ subscription, isAdmin }: { subscription: Subscription; isAdmin: boolean }) {
  if (!subscription.active) {
    return (
      <div className="sub-bar alert">
        <AlertTriangle size={16} />
        <span>{subscription.status === 'TRIAL' ? 'Seu teste grátis terminou.' : 'Sua assinatura está vencida.'} {isAdmin ? 'Escolha um plano para continuar usando o Sysora e o bot.' : 'Avise o administrador da empresa.'}</span>
        {isAdmin && <Link href="/assinatura">Ver planos</Link>}
      </div>
    );
  }
  if (subscription.status === 'TRIAL') {
    const days = daysUntil(subscription.trialEndsAt);
    return (
      <div className="sub-bar">
        <Sparkles size={16} />
        <span>Teste grátis do plano <strong>{subscription.planName}</strong>: {days === 0 ? 'termina hoje' : `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`}.</span>
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
  { href: '/servicos', label: 'Serviços', icon: Wrench },
];
const ADMIN_NAV: NavItem[] = [
  { href: '/whatsapp', label: 'WhatsApp', icon: QrCode, adminOnly: true },
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
  const { status, user, company, role, isAdmin, subscription, switchCompany, logout, reloadSession } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState<'company' | 'user' | null>(null);
  const [companies, setCompanies] = useState<CompanyChoice[]>([]);
  const [unread, setUnread] = useState(0);
  const [pendingUsers, setPendingUsers] = useState(0);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);

  const current = ALL_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const forbidden = Boolean(current?.adminOnly && !isAdmin);
  // Assinatura vencida: só a tela de assinatura (o admin master sempre passa, para dar suporte).
  const blocked = Boolean(subscription && !subscription.active && !user?.isSuperAdmin && pathname !== '/assinatura');

  useEffect(() => { setDemo(Boolean(demoMode())); }, [status]);

  // Proteção das rotas: sem sessão -> login; admin master fora de empresa -> painel master.
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !company) router.replace(user?.isSuperAdmin ? '/master' : '/login');
    else if (status === 'authenticated' && forbidden) router.replace('/painel');
    else if (status === 'authenticated' && blocked) router.replace('/assinatura');
  }, [status, company, user, forbidden, blocked, router]);

  // A API recusou por assinatura vencida (ex.: venceu com o sistema aberto).
  useEffect(() => {
    subscribeSubscriptionBlocked(() => { void reloadSession().then(() => router.replace('/assinatura')); });
    return () => subscribeSubscriptionBlocked(null);
  }, [reloadSession, router]);

  const refreshBadges = useCallback(() => {
    if (blocked) return;
    conversationsApi.list().then((list) => setUnread(list.reduce((sum, c) => sum + c.unreadCount, 0))).catch(() => {});
    whatsappApi.status().then((s) => setWhatsappConnected(s.status === 'connected')).catch(() => {});
    if (isAdmin) usersApi.pending().then((list) => setPendingUsers(list.length)).catch(() => {});
  }, [blocked, isAdmin]);

  useEffect(() => {
    if (status !== 'authenticated' || !company) return;
    refreshBadges();
    authApi.companies().then(setCompanies).catch(() => {});
    const timer = setInterval(refreshBadges, 30_000);
    return () => clearInterval(timer);
  }, [status, company, refreshBadges]);

  useEffect(() => { setNavOpen(false); setMenu(null); }, [pathname]);

  async function goToCompany(companyId: string | null) {
    setMenu(null);
    try {
      const session = await switchCompany(companyId);
      router.push(session.company ? '/painel' : '/master');
      if (session.company) toast(`Agora em ${session.company.name}`);
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  if (status !== 'authenticated' || !company || !user || forbidden || blocked) return <Loading />;

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
                <p>Leia o QR Code e deixe o bot atender, cadastrar e agendar por você.</p>
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
                      <button key={c.id} type="button" onClick={() => goToCompany(c.id)} disabled={c.id === company.id}>
                        <Building2 size={16} />{c.name}{c.id === company.id && <small style={{ marginLeft: 'auto' }}>atual</small>}
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
    </ShellContext.Provider>
  );
}
