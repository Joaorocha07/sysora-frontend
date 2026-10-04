'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, ExternalLink, RefreshCw, ShieldCheck, Webhook, X } from 'lucide-react';
import { CopyField } from '@/components/WhatsAppOfficial';
import { Loading, PageHead, useToast } from '@/components/ui';
import { adminApi, errorMessage, type WhatsAppPlatformCheck, type WhatsAppPlatformSetup } from '@/lib/api';

// Passo a passo para deixar o WhatsApp oficial funcionando na Sysora: o app da
// Meta da Sysora, que todas as empresas usam pelo popup "Conectar com a Meta".
// Mostra o que já está no .env do backend e confere o app e o webhook na Meta.

const ext = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{label}<ExternalLink size={11} style={{ marginLeft: 3, verticalAlign: -1 }} /></a>
);
const code = (text: string) => <code className="code">{text}</code>;

type StepState = 'done' | 'pending' | 'manual';
type Step = { title: string; state: StepState; body: ReactNode; extra?: ReactNode };

function EnvRow({ name, ok, value }: { name: string; ok: boolean; value?: string | null }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span className="row" style={{ gap: 8 }}>
        <span className={`check${ok ? ' done' : ''}`} style={{ width: 20, height: 20 }}>{ok ? <Check size={12} /> : <X size={12} />}</span>
        {code(name)}
      </span>
      <span className="muted" style={{ textAlign: 'right', wordBreak: 'break-all' }}>{ok ? value ?? 'preenchido' : 'vazio'}</span>
    </div>
  );
}

export default function MasterWhatsAppPage() {
  const toast = useToast();
  const [setup, setSetup] = useState<WhatsAppPlatformSetup | null>(null);
  const [check, setCheck] = useState<WhatsAppPlatformCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const runCheck = useCallback(async () => {
    setChecking(true);
    try { setCheck(await adminApi.whatsappCheck()); } catch (err) { toast(errorMessage(err), true); } finally { setChecking(false); }
  }, [toast]);

  useEffect(() => {
    adminApi.whatsapp()
      .then((s) => { setSetup(s); if (s.config.appId && s.config.appSecretSet) void runCheck(); })
      .catch((err) => toast(errorMessage(err), true));
  }, [runCheck, toast]);

  async function configureWebhook() {
    setConfiguring(true);
    try {
      setCheck(await adminApi.whatsappWebhook());
      toast('Webhook configurado na Meta.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setConfiguring(false);
    }
  }

  if (!setup) return <Loading />;
  const { config, webhook } = setup;
  const appOk = Boolean(config.appId && config.appSecretSet && check?.app.ok);
  const httpsOk = Boolean(config.publicApiUrl?.startsWith('https://'));
  const hook = check?.webhook;
  const webhookOk = Boolean(hook?.configured && hook.urlMatches && !hook.missingFields.length);

  const steps: Step[] = [
    {
      title: 'Verificar a empresa na Meta',
      state: 'manual',
      body: (
        <>
          Em {ext('https://business.facebook.com/settings/security', 'Configurações do negócio → Central de segurança')}, clique em <strong>Iniciar verificação</strong> e envie o
          cartão CNPJ ou o certificado do MEI. Use o mesmo nome e endereço do CNPJ (um site com domínio próprio ajuda). A análise leva até 14 dias úteis; dá para seguir os próximos passos enquanto isso.
        </>
      ),
    },
    {
      title: 'Criar o app da Meta da Sysora',
      state: appOk ? 'done' : 'pending',
      body: (
        <>
          Em {ext('https://developers.facebook.com/apps', 'developers.facebook.com → Meus apps')}, clique em <strong>Criar app</strong>, escolha o caso de uso <strong>“Conectar-se com clientes pelo WhatsApp”</strong> e
          vincule ao portfólio da empresa verificada. Em <strong>Configurações do app → Básico</strong>, preencha a <strong>URL da política de privacidade</strong> e o ícone, e copie para o {code('.env')} do backend:
          {' '}{code('META_APP_ID')} (ID do app) e {code('META_APP_SECRET')} (Chave secreta). Reinicie o backend.
        </>
      ),
      extra: check?.app.error ? <p className="form-error">{check.app.error}</p> : check?.app.ok ? <small className="muted">Meta confirmou o app “{check.app.name}”.</small> : null,
    },
    {
      title: 'Configurar o popup (cadastro incorporado)',
      state: config.configId ? 'done' : 'pending',
      body: (
        <>
          No app, abra <strong>Facebook Login for Business → Configurações</strong>: ative <strong>Login com o SDK do JavaScript</strong> e, em <strong>Domínios permitidos para o SDK do JavaScript</strong>,
          adicione {code(origin || 'o domínio do site')} (e o domínio de produção). Depois, em <strong>Configurações → Criar configuração</strong>, escolha o tipo <strong>WhatsApp Embedded Signup</strong> com as
          permissões {code('whatsapp_business_management')} e {code('whatsapp_business_messaging')}. Copie o ID da configuração para {code('META_CONFIG_ID')} e reinicie o backend.
        </>
      ),
    },
    {
      title: 'Publicar o backend com https',
      state: httpsOk ? 'done' : 'pending',
      body: (
        <>
          A Meta só entrega mensagens em um endereço https público. Publique o backend e coloque o endereço em {code('PUBLIC_API_URL')} (ex.: {code('https://api.seudominio.com.br')}).
          Para testar no computador, use um túnel: {code('cloudflared tunnel --url http://localhost:3333')}. Reinicie o backend depois de mudar.
        </>
      ),
    },
    {
      title: 'Ligar o webhook do WhatsApp',
      state: webhookOk ? 'done' : 'pending',
      body: (
        <>
          Clique em <strong>Configurar automaticamente</strong>: a Sysora cadastra a URL, o token de verificação e os campos no app da Meta. Se preferir fazer à mão, em
          <strong> WhatsApp → Configuração → Webhook</strong> cole os dados abaixo e assine os campos {webhook.fields.map((f, i) => <span key={f}>{i ? ', ' : ''}{code(f)}</span>)}.
        </>
      ),
      extra: (
        <div className="stack" style={{ gap: 10 }}>
          <div className="grid-2">
            <CopyField label="URL de callback" value={webhook.url} />
            {webhook.verifyToken ? <CopyField label="Token de verificação" value={webhook.verifyToken} /> : <p className="form-error">Preencha {code('META_WEBHOOK_VERIFY_TOKEN')} no .env.</p>}
          </div>
          {hook && !webhookOk && (
            <small className="muted">
              {!hook.configured ? 'A Meta ainda não tem webhook do WhatsApp neste app.'
                : !hook.urlMatches ? `O webhook na Meta aponta para ${hook.callbackUrl}, não para este backend.`
                  : `Faltam os campos: ${hook.missingFields.join(', ')}.`}
            </small>
          )}
          <div className="row-wrap">
            <button type="button" className="btn btn-primary btn-sm" onClick={configureWebhook} disabled={configuring || !appOk || !httpsOk || !webhook.verifyToken}>
              {configuring ? <span className="spinner" /> : <Webhook size={14} />}Configurar automaticamente
            </button>
            {(!appOk || !httpsOk) && <small className="hint">Conclua os passos 2 e 4 antes.</small>}
          </div>
        </div>
      ),
    },
    {
      title: 'Testar com uma empresa sua',
      state: setup.companies.official > 0 ? 'done' : 'pending',
      body: (
        <>
          Enquanto o app está em <strong>modo de desenvolvimento</strong>, só quem tem função no app (você e os testadores em <strong>Funções do app</strong>) consegue usar o popup.
          Entre em uma empresa sua na Sysora → <strong>WhatsApp</strong> → <strong>Conectar com a Meta</strong>, conecte um número e mande um “oi” para ele.
        </>
      ),
    },
    {
      title: 'Pedir o acesso avançado (App Review)',
      state: 'manual',
      body: (
        <>
          Em <strong>Revisão do app → Permissões e recursos</strong>, peça <strong>Acesso avançado</strong> a {code('whatsapp_business_messaging')} e {code('whatsapp_business_management')}.
          A Meta pede dois vídeos: um enviando uma mensagem pela Sysora (tela de Conversas) e outro mostrando os templates criados (tela WhatsApp → Templates dos lembretes).
          Se a Meta pedir a <strong>verificação de acesso</strong> de provedor de tecnologia, conclua também. Precisa da empresa já verificada (passo 1).
        </>
      ),
    },
    {
      title: 'Colocar o app em modo “Ao vivo”',
      state: 'manual',
      body: <>Com o acesso aprovado, alterne o app para <strong>Ao vivo</strong> no topo do painel da Meta. A partir daí qualquer cliente da Sysora conecta o próprio número sozinho pelo popup.</>,
    },
  ];
  const done = steps.filter((s) => s.state === 'done').length;
  const auto = steps.filter((s) => s.state !== 'manual').length;

  return (
    <>
      <PageHead
        eyebrow="Painel master"
        title="WhatsApp oficial"
        text="Configuração do app da Meta da Sysora. Depois de pronta, cada cliente conecta o próprio número sozinho, pelo botão “Conectar com a Meta”."
        actions={<button type="button" className="btn btn-outline" onClick={runCheck} disabled={checking || !config.appId}>{checking ? <span className="spinner" /> : <RefreshCw size={15} />}Verificar com a Meta</button>}
      />

      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="card card-pad stack">
          <div className="row" style={{ gap: 10 }}>
            <ShieldCheck size={20} />
            <h3>{setup.enabled ? 'Liberado para os clientes' : 'Ainda não liberado'}</h3>
          </div>
          <small className="muted">
            {setup.enabled
              ? 'O botão “Conectar com a Meta” aparece na tela WhatsApp de todas as empresas. Antes do modo “Ao vivo”, só funciona para quem tem função no app.'
              : 'Os clientes veem um aviso e só conseguem conectar pelo QR Code. Preencha o .env abaixo e reinicie o backend.'}
          </small>
          <div className="divider" />
          <div style={{ display: 'grid', gap: 8 }}>
            <EnvRow name="META_APP_ID" ok={Boolean(config.appId)} value={config.appId} />
            <EnvRow name="META_APP_SECRET" ok={config.appSecretSet} />
            <EnvRow name="META_CONFIG_ID" ok={Boolean(config.configId)} value={config.configId} />
            <EnvRow name="META_WEBHOOK_VERIFY_TOKEN" ok={config.verifyTokenSet} />
            <EnvRow name="PUBLIC_API_URL" ok={httpsOk} value={config.publicApiUrl} />
          </div>
          <small className="hint">Esses valores ficam no .env do backend (não dá para editar por aqui, por segurança). Depois de mudar, reinicie o backend.</small>
        </div>

        <div className="card card-pad stack">
          <h3>Empresas conectadas</h3>
          <div className="row" style={{ gap: 24 }}>
            <div><strong style={{ fontSize: 28, fontFamily: 'var(--display)' }}>{setup.companies.official}</strong><small className="muted" style={{ display: 'block' }}>pelo WhatsApp oficial</small></div>
            <div><strong style={{ fontSize: 28, fontFamily: 'var(--display)' }}>{setup.companies.qr}</strong><small className="muted" style={{ display: 'block' }}>pelo QR Code</small></div>
          </div>
          <small className="muted">Cada empresa paga as mensagens direto para a Meta (cartão no WhatsApp Manager dela). Versão da API: {config.graphVersion}.</small>
        </div>
      </div>

      <div className="card card-pad stack">
        <div>
          <h3>Passo a passo</h3>
          <small className="muted">{done} de {auto} etapas conferidas automaticamente. As etapas sem marcação são feitas no site da Meta.</small>
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          {steps.map((s, i) => (
            <div key={s.title} className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <span className={`check${s.state === 'done' ? ' done' : ''}`} title={s.state === 'manual' ? 'Feito no site da Meta' : undefined}>
                {s.state === 'done' ? <Check size={14} /> : <small style={{ fontWeight: 700 }}>{i + 1}</small>}
              </span>
              <div className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                <strong>{s.title}{s.state === 'manual' && <span className="badge plain soft" style={{ marginLeft: 8 }}>no site da Meta</span>}</strong>
                <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{s.body}</span>
                {s.extra}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
