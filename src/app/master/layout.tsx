'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { Avatar, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user, logout } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !user?.isSuperAdmin) router.replace('/painel');
  }, [status, user, router]);

  if (status !== 'authenticated' || !user?.isSuperAdmin) return <Loading />;

  return (
    <div className="landing" style={{ minHeight: '100vh' }}>
      <header className="lp-nav">
        <Logo kind="wordmark" className="word" />
        <span className="badge solid"><ShieldCheck size={13} />Admin master</span>
        <div className="spacer" />
        <ThemeToggle />
        <div className="row hide-mobile" style={{ gap: 10 }}>
          <Avatar name={user.name} size="sm" />
          <div><strong style={{ display: 'block', fontSize: 13 }}>{user.name}</strong><small>{user.email}</small></div>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={async () => { await logout(); router.replace('/login'); }}><LogOut size={15} />Sair</button>
      </header>
      <main className="lp-wrap" style={{ padding: '40px 0 64px' }}>{children}</main>
    </div>
  );
}
