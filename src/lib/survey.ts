// Perguntas da pesquisa inicial (tela /pesquisa) e rótulos das respostas
// (painel master). O backend guarda só os ids; "outro" vem com texto livre.

export type SurveyOption = { id: string; label: string };

export const SURVEY_SOURCES: SurveyOption[] = [
  { id: 'indicacao', label: 'Indicação de alguém' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'anuncio', label: 'Anúncio (Google, Facebook ou Instagram)' },
  { id: 'google', label: 'Pesquisa no Google' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'evento', label: 'Evento ou feira' },
  { id: 'outro', label: 'Outro' },
];

export const SURVEY_BUSINESS: SurveyOption[] = [
  { id: 'barbearia', label: 'Barbearia' },
  { id: 'salao', label: 'Salão de beleza' },
  { id: 'estetica', label: 'Estética e maquiagem' },
  { id: 'unhas', label: 'Manicure e nail designer' },
  { id: 'saude', label: 'Clínica ou consultório' },
  { id: 'odonto', label: 'Odontologia' },
  { id: 'terapia', label: 'Psicologia e terapias' },
  { id: 'fitness', label: 'Academia ou personal' },
  { id: 'pet', label: 'Pet shop e veterinária' },
  { id: 'tatuagem', label: 'Tatuagem e piercing' },
  { id: 'aulas', label: 'Aulas e cursos' },
  { id: 'servicos', label: 'Assistência e serviços técnicos' },
  { id: 'agencia', label: 'Agência ou marketing' },
  { id: 'outro', label: 'Outro' },
];

export const SURVEY_TEAM: SurveyOption[] = [
  { id: 'so-eu', label: 'Só eu' },
  { id: '2-3', label: '2 a 3 pessoas' },
  { id: '4-10', label: '4 a 10 pessoas' },
  { id: '11-30', label: '11 a 30 pessoas' },
  { id: '30+', label: 'Mais de 30 pessoas' },
];

export const SURVEY_FEATURES: SurveyOption[] = [
  { id: 'whatsapp', label: 'Agendamento pelo WhatsApp' },
  { id: 'lembretes', label: 'Lembretes e confirmação automática' },
  { id: 'link', label: 'Agendamento por link ou site' },
  { id: 'pix', label: 'Pagamento ou sinal pelo Pix' },
  { id: 'financeiro', label: 'Controle financeiro' },
  { id: 'comissao', label: 'Comissão dos profissionais' },
  { id: 'estoque', label: 'Estoque de produtos' },
  { id: 'fidelidade', label: 'Fidelidade e pacotes' },
  { id: 'relatorios', label: 'Relatórios e indicadores' },
  { id: 'nota', label: 'Emissão de nota fiscal' },
  { id: 'marketing', label: 'Promoções e mensagens de aniversário' },
  { id: 'google-agenda', label: 'Integração com o Google Agenda' },
  { id: 'outro', label: 'Outro' },
];

const ALL: Record<string, SurveyOption[]> = { sources: SURVEY_SOURCES, business: SURVEY_BUSINESS, teamSize: SURVEY_TEAM, features: SURVEY_FEATURES };

export const surveyLabel = (question: keyof typeof ALL, id: string) => ALL[question].find((o) => o.id === id)?.label ?? id;
