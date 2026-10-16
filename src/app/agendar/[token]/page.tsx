'use client';

import { useParams } from 'next/navigation';
import BookingFlow from '@/components/BookingFlow';

// Agendamento pelo link pessoal (o bot manda no WhatsApp ou o dono gera em
// "Link de agendamento"). O cliente já vem identificado (nome e telefone).
export default function BookingPage() {
  const { token } = useParams<{ token: string }>();
  return <BookingFlow token={token} mode="personal" />;
}
