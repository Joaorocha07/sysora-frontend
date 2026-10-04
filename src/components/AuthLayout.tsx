/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Bot, CalendarCheck, Users, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { LegalLinks } from './LegalLayout';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

// Textos da lateral escura. Padrão: apresentação da Sysora (login e cadastro).
export type AuthSide = { title: string; text: string; items: { icon: LucideIcon; text: string }[] };

const DEFAULT_SIDE: AuthSide = {
  title: 'Atendimento no automático, do primeiro “oi” ao horário marcado.',
  text: 'Clientes, serviços e agenda da sua empresa em um só lugar, com um chatbot de WhatsApp que trabalha por você.',
  items: [
    { icon: Bot, text: 'Bot que agenda pelo WhatsApp' },
    { icon: Users, text: 'Clientes cadastrados automaticamente' },
    { icon: CalendarCheck, text: 'Lembretes e confirmação de presença' },
  ],
};

export default function AuthLayout({ children, side = DEFAULT_SIDE }: { children: ReactNode; side?: AuthSide }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <img src="/brand/sysora-icon-white.png" alt="" className="art" aria-hidden />
        <Link href="/"><Logo kind="wordmark" tone="white" height={28} /></Link>
        <div>
          <h2>{side.title}</h2>
          <p>{side.text}</p>
          <ul>
            {side.items.map(({ icon: Icon, text }) => <li key={text}><span><Icon size={15} /></span>{text}</li>)}
          </ul>
        </div>
        <small className="auth-legal" style={{ color: '#5c5c5c', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <span>© {new Date().getFullYear()} Sysora</span>
          <LegalLinks />
        </small>
      </aside>
      <main className="auth-main">
        <div style={{ position: 'fixed', top: 20, right: 20 }}><ThemeToggle /></div>
        {children}
      </main>
    </div>
  );
}
