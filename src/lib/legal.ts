// Dados legais usados nas páginas de Privacidade, Termos e Cookies.
// PREENCHA antes de publicar: razão social, CNPJ, endereço e o contato do
// encarregado pelo tratamento de dados (DPO, art. 41 da LGPD).
export const LEGAL = {
  brand: 'Sysora',
  company: '[Razão social da empresa]',
  document: '[CNPJ]',
  address: '[Endereço completo]',
  dpoName: '[Nome do encarregado de dados]',
  dpoEmail: '[e-mail de privacidade, ex.: privacidade@seudominio.com.br]',
  forum: '[Cidade/UF do foro]',
};

// Versões (data da última alteração). Mudou um documento? Atualize aqui e no
// backend (src/lib/legal.ts): o aviso de cookies aparece de novo para todos.
export const TERMS_VERSION = '2026-10-04';
export const COOKIE_POLICY_VERSION = '2026-10-04';
export const LEGAL_UPDATED_AT = '04/10/2026';

// Pedidos do titular (art. 18 da LGPD), em "Minha conta → Privacidade".
export const PRIVACY_REQUEST_TYPES = {
  CORRECTION: 'Corrigir dados incompletos, inexatos ou desatualizados',
  DELETION: 'Excluir minha conta e meus dados pessoais',
  INFO_SHARING: 'Saber com quem meus dados são compartilhados',
  REVOKE_CONSENT: 'Revogar um consentimento',
  ACCESS: 'Confirmar e acessar os dados que vocês têm sobre mim',
  OTHER: 'Outro pedido sobre os meus dados',
} as const;
export type PrivacyRequestType = keyof typeof PRIVACY_REQUEST_TYPES;
