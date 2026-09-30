/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Bot, CalendarCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <img src="/brand/sysora-icon-white.png" alt="" className="art" aria-hidden />
        <Link href="/"><Logo kind="wordmark" tone="white" height={28} /></Link>
        <div>
          <h2>Atendimento no automático, do primeiro “oi” ao horário marcado.</h2>
          <p>Clientes, serviços e agenda da sua empresa em um só lugar, com um chatbot de WhatsApp que trabalha por você.</p>
          <ul>
            <li><span><Bot size={15} /></span>Bot que agenda pelo WhatsApp</li>
            <li><span><Users size={15} /></span>Clientes cadastrados automaticamente</li>
            <li><span><CalendarCheck size={15} /></span>Lembretes e confirmação de presença</li>
          </ul>
        </div>
        <small style={{ color: '#5c5c5c' }}>© {new Date().getFullYear()} Sysora</small>
      </aside>
      <main className="auth-main">
        <div style={{ position: 'fixed', top: 20, right: 20 }}><ThemeToggle /></div>
        {children}
      </main>
    </div>
  );
}
