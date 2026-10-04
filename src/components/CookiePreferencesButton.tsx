'use client';

import { openCookiePreferences } from '@/lib/consent';

// Link "Preferências de cookies" para páginas renderizadas no servidor.
export default function CookiePreferencesButton({ label = 'abrir as preferências de cookies' }: { label?: string }) {
  return (
    <button type="button" onClick={openCookiePreferences} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--ink)', textDecoration: 'underline', cursor: 'pointer' }}>
      {label}
    </button>
  );
}
