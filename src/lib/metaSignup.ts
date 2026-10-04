import type { WhatsAppCloudConfig, WhatsAppOnboardInput } from './api';

// Cadastro incorporado da Meta (Embedded Signup) para conectar o WhatsApp
// oficial: abre o popup do Facebook, onde a empresa entra com a conta dela,
// escolhe ou cria a conta do WhatsApp Business e verifica o número. O popup
// devolve um código de autorização (callback do FB.login) e, por mensagem
// entre janelas, os IDs da conta e do número. Os dois vão para o backend
// (POST /whatsapp/cloud/onboard), que conclui a conexão.

type FacebookSdk = {
  init: (options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: { authResponse?: { code?: string } | null }) => void, options: object) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

// O usuário fechou o popup: não é erro para mostrar em vermelho.
export class SignupCancelled extends Error {}

let sdk: Promise<FacebookSdk> | null = null;

function loadSdk(appId: string, version: string): Promise<FacebookSdk> {
  sdk ??= new Promise<FacebookSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB!);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdk = null;
      reject(new Error('Não foi possível abrir a Meta. Verifique a internet ou se algum bloqueador de anúncios está barrando o Facebook.'));
    };
    document.body.appendChild(script);
  });
  return sdk;
}

type SessionInfo = { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; business_id?: string; error_message?: string; current_step?: string } };

export async function startWhatsAppSignup(config: WhatsAppCloudConfig, coexistence: boolean): Promise<WhatsAppOnboardInput> {
  if (!config.enabled || !config.appId || !config.configId) throw new Error('A conexão oficial ainda não está disponível neste servidor.');
  const FB = await loadSdk(config.appId, config.graphVersion);

  return new Promise((resolve, reject) => {
    let code: string | null = null;
    let session: Omit<WhatsAppOnboardInput, 'code'> | null = null;
    let settled = false;

    const cleanup = () => window.removeEventListener('message', onMessage);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    // O código e os IDs chegam por caminhos diferentes, em qualquer ordem.
    const finish = () => {
      if (settled || !code || !session) return;
      settled = true;
      cleanup();
      resolve({ code, ...session });
    };

    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return;
      let info: SessionInfo;
      try {
        info = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (info?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if ((info.event === 'FINISH' || info.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') && info.data?.waba_id && info.data.phone_number_id) {
        session = {
          wabaId: info.data.waba_id,
          phoneNumberId: info.data.phone_number_id,
          businessId: info.data.business_id ?? null,
          coexistence: info.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        };
        finish();
      } else if (info.event === 'FINISH_ONLY_WABA') {
        fail(new Error('A conta do WhatsApp foi criada, mas nenhum número foi adicionado. Conecte de novo e escolha ou cadastre o número.'));
      } else if (info.event === 'CANCEL') {
        fail(new SignupCancelled('Conexão cancelada. Nada foi alterado.'));
      } else if (info.event === 'ERROR') {
        fail(new Error(`A Meta informou um erro: ${info.data?.error_message ?? 'tente novamente.'}`));
      }
    }
    window.addEventListener('message', onMessage);

    // O callback do FB.login não pode ser assíncrono.
    FB.login((response) => {
      code = response.authResponse?.code ?? null;
      if (!code) {
        // Fechou o popup: espera um pouco pela mensagem de CANCEL, que diz em que etapa parou.
        setTimeout(() => fail(new SignupCancelled('Conexão cancelada. Nada foi alterado.')), 1500);
        return;
      }
      finish();
      setTimeout(() => fail(new Error('A Meta não devolveu os dados do número. Tente conectar de novo.')), 15_000);
    }, {
      config_id: config.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        sessionInfoVersion: '3',
        // Número que já está no app WhatsApp Business e continua nele (coexistência).
        ...(coexistence ? { featureType: 'whatsapp_business_app_onboarding' } : {}),
      },
    });
  });
}
