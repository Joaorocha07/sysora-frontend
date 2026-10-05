import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Comprovante pessoal do cliente: fora dos buscadores.
export const metadata: Metadata = { title: 'Comprovante de agendamento', robots: { index: false, follow: false } };

export default function ReceiptLayout({ children }: { children: ReactNode }) {
  return children;
}
