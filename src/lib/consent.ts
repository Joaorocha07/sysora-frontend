// Consentimento de cookies (LGPD). A escolha fica neste navegador e é
// registrada no backend (prova do consentimento). Cookies necessários (login,
// segurança, preferências, pagamento) não dependem da escolha. Antes de
// carregar qualquer script de estatísticas ou marketing, confira hasConsent().
import { privacyApi } from './api';
import { COOKIE_POLICY_VERSION } from './legal';

export type ConsentCategory = 'analytics' | 'marketing';
export type Consent = { id: string; version: string; analytics: boolean; marketing: boolean; decidedAt: string };

const KEY = 'sysora-consent';
export const CONSENT_EVENT = 'sysora-consent-change';
export const PREFERENCES_EVENT = 'sysora-cookie-preferences';

export function readConsent(): Consent | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Consent | null;
    // Política mudou: pede a escolha de novo.
    return value && value.version === COOKIE_POLICY_VERSION ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: { analytics: boolean; marketing: boolean }): Consent {
  const previous = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Consent | null; } catch { return null; } })();
  const consent: Consent = {
    id: previous?.id ?? crypto.randomUUID(),
    version: COOKIE_POLICY_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    decidedAt: new Date().toISOString(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(consent)); } catch { /* navegação privada */ }
  privacyApi.consent({ consentId: consent.id, analytics: consent.analytics, marketing: consent.marketing, policyVersion: consent.version }).catch(() => {});
  window.dispatchEvent(new Event(CONSENT_EVENT));
  return consent;
}

export const hasConsent = (category: ConsentCategory) => Boolean(readConsent()?.[category]);

// Abre a janela de preferências de cookies (links "Preferências de cookies").
export const openCookiePreferences = () => window.dispatchEvent(new Event(PREFERENCES_EVENT));
