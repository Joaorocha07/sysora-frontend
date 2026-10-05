import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Link pessoal do cliente: fora dos buscadores.
export const metadata: Metadata = { title: 'Agendar horário', robots: { index: false, follow: false } };

export default function BookingLayout({ children }: { children: ReactNode }) {
  return children;
}
