import type { PlanInfo } from './api';

// Plano anual: pagamento único de 12 meses com desconto sobre 12 mensalidades
// (igual a YEARLY_DISCOUNT_PERCENT no backend).
export const YEARLY_DISCOUNT_PERCENT = 20;
const yearly = (priceCents: number) => Math.round((priceCents * 12 * (100 - YEARLY_DISCOUNT_PERCENT)) / 100);

// Mesmo catálogo de sysora-backend/src/lib/plans.ts (landing, cadastro e modo demonstração).
// Ao mudar preços ou limites, atualize os dois arquivos.
export const PLANS: PlanInfo[] = [
  {
    id: 'INICIAL',
    name: 'Inicial',
    priceCents: 9700,
    yearlyPriceCents: yearly(9700),
    maxCompanies: 1,
    maxEmployees: 2,
    ai: false,
    soraBudgetUsd: 3,
    features: [
      '1 empresa com 1 número de WhatsApp',
      'Administrador + até 2 funcionários',
      'Chatbot que cadastra e agenda',
      'Agenda, clientes e serviços ilimitados',
      'Lembretes e confirmação de presença',
      'Sora: IA que monta o fluxo do bot (uso básico no mês)',
    ],
  },
  {
    id: 'AVANCADO',
    name: 'Avançado',
    priceCents: 19700,
    yearlyPriceCents: yearly(19700),
    maxCompanies: 2,
    maxEmployees: 5,
    ai: true,
    soraBudgetUsd: 8,
    features: [
      'Até 2 empresas, cada uma com o seu WhatsApp',
      'Administrador + até 5 funcionários por empresa',
      'Tudo do plano Inicial',
      'IA no WhatsApp: entende mensagens escritas e áudios',
      'Sora com mais que o dobro de uso no mês',
      'Descrições de serviços com IA',
      'Troca rápida entre as empresas',
      'Suporte prioritário',
    ],
  },
];

// Teste grátis: 30 dias (1 mês), igual ao backend (lib/plans.ts).
export const TRIAL_DAYS = 30;
export const TRIAL_LABEL = '1 mês';
