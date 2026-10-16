import type { TagColor } from './api';

// Cores das etiquetas. Os ids ficaram dos tons antigos (são o que fica salvo
// no banco e o que o backend aceita); só o nome e a cor mudaram.
export const TAG_COLORS: { id: TagColor; label: string; hex: string }[] = [
  { id: 'graphite', label: 'Vermelho', hex: '#ef4444' },
  { id: 'stone', label: 'Laranja', hex: '#f97316' },
  { id: 'sand', label: 'Amarelo', hex: '#eab308' },
  { id: 'clay', label: 'Verde', hex: '#22c55e' },
  { id: 'moss', label: 'Turquesa', hex: '#14b8a6' },
  { id: 'sage', label: 'Azul', hex: '#3b82f6' },
  { id: 'mist', label: 'Roxo', hex: '#8b5cf6' },
  { id: 'plum', label: 'Rosa', hex: '#ec4899' },
];

export const tagHex = (color: string) => TAG_COLORS.find((c) => c.id === color)?.hex ?? TAG_COLORS[0].hex;
