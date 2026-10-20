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
    priceCents: 2990,
    yearlyPriceCents: yearly(2990),
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
      'Link de agendamento para mandar ao cliente',
      'Funil de vendas, etiquetas e respostas rápidas',
      'Follow-up, mensagens agendadas e reativação de clientes',
      'App no celular com notificações',
      'Sora: IA que monta o fluxo do bot (uso básico no mês)',
    ],
  },
  {
    id: 'AVANCADO',
    name: 'Avançado',
    priceCents: 6990,
    yearlyPriceCents: yearly(6990),
    maxCompanies: 2,
    maxEmployees: 5,
    ai: true,
    soraBudgetUsd: 8,
    features: [
      'Até 2 empresas, cada uma com o seu WhatsApp',
      'Administrador + até 5 funcionários por empresa',
      'Tudo do plano Inicial',
      'Atendimento com IA: o bot entende mensagens escritas e áudios',
      'Mensagens criadas com IA: respostas rápidas, follow-up, agendadas e reativação',
      'Descrições de serviços com IA',
      'Sora com mais que o dobro de uso no mês',
      'Troca rápida entre as empresas',
      'Suporte prioritário',
    ],
  },
];

// Teste grátis: 30 dias (1 mês), igual ao backend (lib/plans.ts).
export const TRIAL_DAYS = 30;
export const TRIAL_LABEL = '1 mês';
