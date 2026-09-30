import type { AppointmentStatus, Role } from './api';

const pad = (n: number) => String(n).padStart(2, '0');

export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toIsoDate(new Date());
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
// Segunda-feira da semana da data.
export const startOfWeek = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return addDays(iso, -((d.getDay() + 6) % 7));
};

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const weekday = (iso: string) => new Date(`${iso}T12:00:00`).getDay();
export const brDate = (iso: string) => iso.split('-').reverse().join('/');
export const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (toIsoDate(date) === today()) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (toIsoDate(date) === addDays(today(), -1)) return 'ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const clock = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "150,00" / "150" -> 15000
export function parseMoney(value: string): number {
  const clean = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const number = Number(clean);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export const duration = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? pad(minutes % 60) : ''}`;

export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Só palavras que começam com letra: "Você (demonstração)" -> "V", não "V(".
export const initials = (name: string) =>
  name.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export const ROLE_LABELS: Record<Role, string> = { ADMIN: 'Administrador', EMPLOYEE: 'Funcionário' };

// Status em preto e branco: o estilo do selo diferencia (sólido, contorno, pontilhado...).
export const STATUS: Record<AppointmentStatus, { label: string; badge: string }> = {
  SCHEDULED: { label: 'Agendado', badge: '' },
  CONFIRMED: { label: 'Confirmado', badge: 'solid' },
  COMPLETED: { label: 'Concluído', badge: 'soft' },
  CANCELED: { label: 'Cancelado', badge: 'strike' },
  NO_SHOW: { label: 'Não compareceu', badge: 'dashed' },
};
