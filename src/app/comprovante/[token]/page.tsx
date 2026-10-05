'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarCheck, Clock, FileX2, MapPin, Phone, Printer, User } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { Empty } from '@/components/ui';
import { bookingApi, errorMessage, type BookingReceipt } from '@/lib/api';
import { STATUS, brDate, duration, longDate, money } from '@/lib/format';

// Comprovante do agendamento feito pelo link do bot: o link vai na confirmação
// do WhatsApp. Mostra a situação atual (se a equipe cancelar, aparece aqui).

const capitalize = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

export default function ReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bookingApi.receipt(token).then(setReceipt).catch((err) => setError(errorMessage(err)));
  }, [token]);

  const header = (
    <header className="row receipt-noprint" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
      <Logo kind="wordmark" height={22} />
      <ThemeToggle />
    </header>
  );

  if (error || !receipt) {
    return (
      <main className="booking-page">
        {header}
        <div className="card">
          {error
            ? <Empty icon={<FileX2 size={22} />} title="Comprovante não encontrado" text={error} />
            : <div className="loading-screen" style={{ minHeight: 240 }}><span className="spinner" /></div>}
        </div>
      </main>
    );
  }

  const status = STATUS[receipt.status];
  const canceled = receipt.status === 'CANCELED';
  const totalMinutes = receipt.items.reduce((sum, i) => sum + i.durationMinutes, 0);

  return (
    <main className="booking-page">
      {header}
      <div className="card receipt">
        <div className="card-body stack">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="eyebrow">Comprovante de agendamento</div>
              <h1 style={{ fontSize: 22, marginTop: 6 }}>{receipt.company.name}</h1>
            </div>
            <span className={`badge ${status.badge}`}>{status.label}</span>
          </div>

          <div className="booking-summary">
            <div><CalendarCheck size={16} /><span><strong>{capitalize(longDate(receipt.date))}</strong></span></div>
            <div><Clock size={16} /><span>{receipt.startTime} às {receipt.endTime} · {duration(totalMinutes)}</span></div>
            {receipt.company.address && <div><MapPin size={16} /><span>{receipt.company.address}</span></div>}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Serviço</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={`${item.name}-${i}`}>
                    <td>{item.name}<small className="muted" style={{ display: 'block' }}>{duration(item.durationMinutes)}</small></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{item.priceCents > 0 ? money(item.priceCents) : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="mono" style={{ textAlign: 'right' }}><strong>{receipt.totalCents > 0 ? money(receipt.totalCents) : 'Sob consulta'}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="receipt-grid">
            <div><small className="muted">Cliente</small><span><User size={14} />{receipt.client.name ?? 'Cliente'}</span><span className="muted">{receipt.client.phone}</span></div>
            <div><small className="muted">Contato da empresa</small>{receipt.company.phone ? <span><Phone size={14} />{receipt.company.phone}</span> : <span className="muted">—</span>}</div>
            <div><small className="muted">Código</small><span className="mono">{receipt.code}</span></div>
            <div><small className="muted">Agendado em</small><span>{brDate(receipt.createdAt.slice(0, 10))}</span></div>
          </div>

          {canceled
            ? <p className="muted">Este agendamento foi cancelado. Para marcar outro horário, fale com a empresa pelo WhatsApp.</p>
            : <p className="muted">Para remarcar ou cancelar, responda a mensagem da empresa no WhatsApp.</p>}

          <button type="button" className="btn btn-outline receipt-noprint" onClick={() => window.print()}><Printer size={16} />Imprimir ou salvar em PDF</button>
        </div>
      </div>
      <small className="muted receipt-noprint" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>Agenda on-line por Sysora</small>
    </main>
  );
}
