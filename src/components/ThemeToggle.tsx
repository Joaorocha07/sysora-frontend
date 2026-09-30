'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

// O tema inicial é aplicado por um script no <head> (layout.tsx) antes da
// pintura, para não piscar. Aqui só alternamos e guardamos a escolha.
export default function ThemeToggle({ className = 'icon-btn bordered' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sysora-theme', next); } catch { /* navegação privada */ }
    setTheme(next);
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title="Alternar tema">
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
