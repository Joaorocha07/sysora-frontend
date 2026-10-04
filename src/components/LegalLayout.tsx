'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { openCookiePreferences } from '@/lib/consent';
import { LEGAL, LEGAL_UPDATED_AT } from '@/lib/legal';

const DOCS = [
  { href: '/privacidade', label: 'Política de Privacidade' },
  { href: '/termos', label: 'Termos de Uso' },
  { href: '/cookies', label: 'Política de Cookies' },
];

// Links legais para rodapés (página inicial, login, páginas legais).
export function LegalLinks({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 14 }}>
      {DOCS.map((d) => <Link key={d.href} href={d.href}>{d.label.replace('Política de ', '')}</Link>)}
      <button type="button" onClick={openCookiePreferences}>Preferências de cookies</button>
    </span>
  );
}

export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="legal">
      <div className="legal-top">
        <Link href="/"><Logo kind="wordmark" height={26} /></Link>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/" className="btn btn-ghost btn-sm"><ArrowLeft size={15} />Voltar ao site</Link>
          <ThemeToggle />
        </div>
      </div>
      <article>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13 }}>Última atualização: {LEGAL_UPDATED_AT}</p>
        <nav className="legal-nav" aria-label="Documentos legais">
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} className={`chip${pathname === d.href ? ' on' : ''}`}>{d.label}</Link>
          ))}
        </nav>
        {children}
      </article>
      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} {LEGAL.brand}</span>
        <LegalLinks />
      </footer>
    </div>
  );
}
