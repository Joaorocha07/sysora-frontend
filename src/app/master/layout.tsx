'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Building2, ChevronDown, ClipboardList, HandCoins, LogOut, Menu, MessageCircle, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import Logo from '@/components/Logo';
import LogoutDialog from '@/components/LogoutDialog';
import ThemeToggle from '@/components/ThemeToggle';
import { Avatar, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { firstName } from '@/lib/format';

const MASTER_NAV = [
  { href: '/master', label: 'Empresas e assinaturas', icon: Building2 },
  { href: '/master/usuarios', label: 'Usuários', icon: Users },
  { href: '/master/ia', label: 'IA (Sora)', icon: Sparkles },
  { href: '/master/gastos', label: 'Gastos', icon: HandCoins },
  { href: '/master/whatsapp', label: 'WhatsApp oficial', icon: MessageCircle },
  { href: '/master/pesquisas', label: 'Pesquisa inicial', icon: ClipboardList },
  { href: '/master/privacidade', label: 'Privacidade (LGPD)', icon: ShieldCheck },
  { href: '/master/configuracoes', label: 'Configurações', icon: Settings },
];

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !user?.isSuperAdmin) router.replace('/painel');
  }, [status, user, router]);

  useEffect(() => { setNavOpen(false); setMenuOpen(false); }, [pathname]);

  function signOut() {
    setMenuOpen(false);
    setConfirmingLogout(true);
  }

  if (status !== 'authenticated' || !user?.isSuperAdmin) return <Loading />;

  const current = MASTER_NAV.find((n) => pathname === n.href);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo kind="icon" tone="white" className="icon" />
          <Logo kind="wordmark" tone="white" className="word" />
        </div>
        <div className="nav-label">Admin master</div>
        <nav className="nav">
          {MASTER_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : ''}><Icon size={18} />{label}</Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <div style={{ minWidth: 0 }}>
              <strong>{user.name}</strong>
              <small>Admin master</small>
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
            <span className="hide-mobile">Master</span>
            <span className="hide-mobile">/</span>
            <strong>{current?.label ?? 'Sysora'}</strong>
          </div>
          <div className="spacer" />
          <span className="badge solid hide-mobile"><ShieldCheck size={13} />Admin master</span>
          <ThemeToggle />
          <div className="dropdown">
            <button type="button" className="row" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setMenuOpen((v) => !v)} aria-label="Conta">
              <Avatar name={user.name} src={user.avatarUrl} />
              <span className="hide-mobile" style={{ fontWeight: 600 }}>{firstName(user.name)}</span>
              <ChevronDown size={15} className="hide-mobile" />
            </button>
            {menuOpen && (
              <div className="menu">
                <div style={{ padding: '8px 12px 10px' }}>
                  <strong style={{ display: 'block' }}>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <div className="divider" />
                <Link href="/master/configuracoes"><Settings size={16} />Minha conta</Link>
                <button type="button" onClick={signOut}><LogOut size={16} />Sair</button>
              </div>
            )}
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
      {confirmingLogout && <LogoutDialog onClose={() => setConfirmingLogout(false)} />}
    </div>
  );
}
