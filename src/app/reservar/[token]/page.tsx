'use client';

import { useParams } from 'next/navigation';
import BookingFlow from '@/components/BookingFlow';

// Link aberto de agendamento da empresa: qualquer pessoa informa nome e
// WhatsApp, escolhe o serviço e o horário.
export default function OpenBookingPage() {
  const { token } = useParams<{ token: string }>();
  return <BookingFlow token={token} mode="open" />;
}
