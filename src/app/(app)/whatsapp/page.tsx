'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bot, Check, Headset, KeyRound, Link2Off, MessageSquareText, QrCode, RefreshCw, Save, Send, ShieldCheck, Smartphone, TriangleAlert, Workflow } from 'lucide-react';
import { useShell } from '@/components/AppShell';
import { BotFlowEditor } from '@/components/BotFlowEditor';
import { EmailCodes } from '@/components/EmailCodes';
import { ConfirmDialog, Field, Loading, PageHead, Switch, useToast } from '@/components/ui';
import { useConfirmLeave, useUnsavedChanges } from '@/components/UnsavedChanges';
import { AiPlanNotice, useAiPlan } from '@/components/AiPlanLock';
import { OfficialConnect, OfficialConnected, formatWaPhone } from '@/components/WhatsAppOfficial';
import { errorMessage, settingsApi, whatsappApi, type BotAiStatus, type Settings, type WhatsAppCloudConfig, type WhatsAppStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { duration } from '@/lib/format';

type Tab = 'conexao' | 'bot' | 'fluxo' | 'lembretes' | 'equipe' | 'codigos';

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'conexao', label: 'Conexão', icon: QrCode },
  { id: 'bot', label: 'Mensagens do bot', icon: Bot },
  { id: 'fluxo', label: 'Fluxo do bot', icon: Workflow },
  { id: 'lembretes', label: 'Lembretes', icon: Bell },
  { id: 'equipe', label: 'Atendimento humano', icon: Headset },
  // Só nas empresas liberadas pelo admin master (settings.emailCodesEnabled).
  { id: 'codigos', label: 'Códigos por e-mail', icon: KeyRound },
];

const VARS = '{nome}, {empresa}, {servico}, {data} e {hora}';

// O que a Sysora já faz para o número conectado por QR Code não ser bloqueado
// (backend: whatsapp.safety.ts) e o que depende da empresa.
const AUTO_PROTECTIONS = [
  'O bot mostra “digitando...” e responde em poucos segundos, como uma pessoa.',
  'Os envios são espaçados, inclusive os lembretes: nada de rajadas.',
  'Se outro robô entrar em conversa sem fim com o número, o bot fica em silêncio.',
  'Lembrete para quem nunca escreveu para a empresa só sai se o número tiver WhatsApp, e no máximo 20 por dia.',
  'Quem responde PARAR deixa de receber lembretes automáticos.',
];
const OWNER_TIPS = [
  'Use um número com histórico. Número novo: use normalmente no celular por 1 a 2 semanas antes de conectar.',
  'Prefira o WhatsApp Business no celular, com foto, nome e descrição da empresa.',
  'Não use o número para propaganda, listas de transmissão ou mensagens para quem não é cliente.',
  'Peça para os clientes salvarem o número: contato salvo quase nunca denuncia.',
];

function NumberProtection({ officialAvailable }: { officialAvailable: boolean }) {
  return (
    <div className="card card-pad stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="metric-icon"><ShieldCheck size={18} /></span>
        <div>
          <strong style={{ display: 'block' }}>Proteção do número</strong>
          <small className="muted">A conexão por QR Code não é oficial da Meta, e o WhatsApp pode restringir números que agem como robô. O risco cai muito com os cuidados abaixo.</small>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Automático na Sysora</span>
          {AUTO_PROTECTIONS.map((t) => <small key={t} className="row" style={{ gap: 8, alignItems: 'flex-start' }}><Check size={15} style={{ flexShrink: 0, marginTop: 2 }} />{t}</small>)}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Depende de você</span>
          {OWNER_TIPS.map((t) => <small key={t} className="row" style={{ gap: 8, alignItems: 'flex-start' }}><TriangleAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />{t}</small>)}
        </div>
      </div>
      {officialAvailable && <small className="muted">Muitos clientes por dia? A conexão oficial da Meta não corre esse risco: desconecte o QR Code para ver essa opção.</small>}
    </div>
  );
}

function Connection() {
  const toast = useToast();
  const { refreshBadges } = useShell();
  const [state, setState] = useState<WhatsAppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [testTo, setTestTo] = useState('');
  const previous = useRef<WhatsAppStatus['status'] | null>(null);
  // App da Meta da Sysora configurado (painel master → WhatsApp oficial)? Sem ele, só o QR Code.
  const [cloudConfig, setCloudConfig] = useState<WhatsAppCloudConfig | null>(null);

  useEffect(() => { whatsappApi.cloudConfig().then(setCloudConfig).catch(() => {}); }, []);

  const load = useCallback(() => whatsappApi.status().then(setState).catch(() => {}), []);

  // Enquanto conecta ou mostra o QR, consulta o status a cada 3 s.
  useEffect(() => {
    void load();
    const waiting = state?.status === 'qr' || state?.status === 'connecting';
    const timer = setInterval(load, waiting ? 3_000 : 15_000);
    return () => clearInterval(timer);
  }, [load, state?.status]);

  useEffect(() => {
    if (!state) return;
    if (previous.current && previous.current !== 'connected' && state.status === 'connected') {
      toast('WhatsApp conectado! O bot já está atendendo.');
      refreshBadges();
    }
    previous.current = state.status;
  }, [state, toast, refreshBadges]);

  async function connect() {
    setBusy(true);
    try { setState(await whatsappApi.connect()); } catch (err) { toast(errorMessage(err), true); } finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try {
      setState(await whatsappApi.disconnect());
      toast('WhatsApp desconectado.');
      refreshBadges();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
      setConfirmDisconnect(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try { toast((await whatsappApi.test(testTo)).message); } catch (err) { toast(errorMessage(err), true); } finally { setBusy(false); }
  }

  if (!state) return <Loading />;
  const connected = state.status === 'connected';
  const official = state.provider === 'cloud' && state.cloud;
  // Nada conectado e a API oficial liberada: oferece ela primeiro e o QR Code como alternativa.
  const choosing = !state.provider && state.status === 'disconnected' && Boolean(cloudConfig?.enabled);

  return (
    <div className="stack">
      {official && <OfficialConnected state={state} onChange={setState} onDisconnect={() => setConfirmDisconnect(true)} busy={busy} />}
      {choosing && cloudConfig && <OfficialConnect config={cloudConfig} onConnected={setState} />}
      {choosing && <div className="eyebrow" style={{ marginTop: 8 }}>Ou conecte pelo QR Code (WhatsApp Web)</div>}
      {!official && <div className="card card-pad">
        <div className="qr-box">
          <div className="qr-frame">
            {state.status === 'qr' && state.qr ? (
              <img src={state.qr} alt="QR Code para conectar o WhatsApp" />
            ) : (
              <div className="placeholder">
                {connected ? <Smartphone size={42} color="#111" /> : state.status === 'connecting' ? <span className="spinner" style={{ width: 32, height: 32, color: '#111' }} /> : <QrCode size={42} color="#111" />}
                <span>{connected ? 'Aparelho conectado' : state.status === 'connecting' ? 'Preparando conexão...' : 'Clique em “Gerar QR Code”'}</span>
              </div>
            )}
          </div>

          <div className="stack">
            <div>
              <div className="status-line">
                <span className={`status-dot${connected ? ' on' : state.status !== 'disconnected' ? ' wait' : ''}`} />
                {connected ? 'Conectado' : state.status === 'qr' ? 'Aguardando leitura do QR Code' : state.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </div>
              {connected && <h2 style={{ marginTop: 10, fontSize: 24 }}>{formatWaPhone(state.phone)}</h2>}
              {state.error && <p className="form-error" style={{ marginTop: 12 }}>{state.error}</p>}
            </div>

            {connected ? (
              <>
                <p className="muted">O bot está respondendo as mensagens deste número. O WhatsApp continua funcionando normalmente no celular: quando alguém da equipe responde por lá, o bot pausa com aquele cliente.</p>
                <div className="row-wrap">
                  <input className="input" style={{ width: 240 }} placeholder="5511999999999" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <button type="button" className="btn btn-outline" onClick={sendTest} disabled={busy || testTo.replace(/\D/g, '').length < 10}><Send size={15} />Enviar teste</button>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmDisconnect(true)} disabled={busy}><Link2Off size={15} />Desconectar</button>
                </div>
              </>
            ) : (
              <>
                <ol className="steps">
                  <li><span>Abra o <strong>WhatsApp</strong> no celular da empresa.</span></li>
                  <li><span>Toque em <strong>Mais opções</strong> (⋮) ou <strong>Configurações</strong> e depois em <strong>Aparelhos conectados</strong>.</span></li>
                  <li><span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.</span></li>
                </ol>
                <div className="row-wrap">
                  <button type="button" className="btn btn-primary" onClick={connect} disabled={busy || state.status === 'connecting'}>
                    {busy ? <span className="spinner" /> : state.status === 'qr' ? <RefreshCw size={16} /> : <QrCode size={16} />}
                    {state.status === 'qr' ? 'Aguardando leitura...' : 'Gerar QR Code'}
                  </button>
                  {state.status !== 'disconnected' && <button type="button" className="btn btn-ghost" onClick={() => setConfirmDisconnect(true)}>Cancelar</button>}
                </div>
                <p className="hint">
                  Funciona como o WhatsApp Web: a sessão fica salva e reconecta sozinha se o servidor reiniciar.
                  {choosing ? ' Não é uma conexão oficial da Meta: o WhatsApp pode restringir números conectados assim.' : ''}
                </p>
              </>
            )}
          </div>
        </div>
      </div>}

      {!official && <NumberProtection officialAvailable={Boolean(cloudConfig?.enabled)} />}

      {confirmDisconnect && (
        <ConfirmDialog
          title="Desconectar o WhatsApp?"
          message={official
            ? 'O bot para de atender por este número e os lembretes deixam de ser enviados. O número e a conta continuam seus no WhatsApp Manager; para voltar, é só conectar de novo.'
            : 'O bot para de atender e os lembretes deixam de ser enviados. Para voltar, será preciso ler um novo QR Code.'}
          confirmLabel="Desconectar"
          danger
          busy={busy}
          onConfirm={disconnect}
          onClose={() => setConfirmDisconnect(false)}
        />
      )}
    </div>
  );
}

function BotSettings({ tab, onOpenFlow }: { tab: Exclude<Tab, 'conexao' | 'fluxo' | 'codigos'>; onOpenFlow: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<BotAiStatus | null>(null);
  const aiPlan = useAiPlan();

  useEffect(() => {
    settingsApi.get().then((r) => { setSaved(r.settings); setDraft(r.settings); }).catch((err) => toast(errorMessage(err), true));
    whatsappApi.ai().then(setAi).catch(() => {});
  }, [toast]);

  const dirty = Boolean(draft && saved) && JSON.stringify(draft) !== JSON.stringify(saved);
  // Salvar pelo aviso de "alterações não salvas" (ao sair da aba ou da página).
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  useUnsavedChanges(dirty, () => saveRef.current());

  if (!draft || !saved) return <Loading />;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const text = (key: keyof Settings) => ({ value: String(draft[key] ?? ''), onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) });

  async function save(): Promise<boolean> {
    if (!draft || !saved) return false;
    const changes = Object.fromEntries(Object.entries(draft).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(saved[k as keyof Settings])));
    setBusy(true);
    try {
      const next = await settingsApi.update(changes);
      setSaved(next);
      setDraft(next);
      toast('Configurações salvas.');
      return true;
    } catch (err) {
      toast(errorMessage(err), true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  saveRef.current = save;

  return (
    <div className="card">
      <div className="card-body stack" style={{ paddingTop: 24 }}>
        {tab === 'bot' && (
          <>
            <Switch checked={draft.botEnabled} onChange={(v) => set('botEnabled', v)} label="Bot ligado" description="Desligado, as mensagens continuam chegando em Conversas, mas ninguém responde automaticamente." />
            <Switch checked={draft.autoCreateClient} onChange={(v) => set('autoCreateClient', v)} label="Cadastrar clientes automaticamente" description="Quem manda mensagem vira cliente. Desligado, o cliente só é cadastrado quando conclui um agendamento." />
            <Switch checked={draft.askName} onChange={(v) => set('askName', v)} label="Perguntar o nome" description="Quando o perfil do WhatsApp não traz um nome, o bot pergunta antes de agendar." />
            <div className="divider" />
            {!aiPlan && <AiPlanNotice feature="O bot que entende mensagens escritas e áudios" />}
            <Switch
              disabled={!aiPlan}
              checked={aiPlan && draft.botAiEnabled}
              onChange={(v) => set('botAiEnabled', v)}
              label="Entender mensagens escritas (IA)"
              description={ai && !ai.available
                ? 'A IA ainda não está configurada no servidor. Sem ela, o cliente responde pelos números.'
                : `O cliente pode escrever do jeito dele ("queria marcar um corte amanhã às 14h") e o bot entende, escolhe a opção e agenda. Também responde dúvidas com os dados da empresa.${ai ? ` Usado este mês: ${ai.used} de ${ai.limit} mensagens.` : ''}`}
            />
            <Switch
              disabled={!aiPlan}
              checked={aiPlan && draft.transcribeAudio}
              onChange={(v) => set('transcribeAudio', v)}
              label="Ouvir áudios"
              description={ai && !ai.transcription
                ? 'A transcrição ainda não está configurada no servidor. Sem ela, o bot pede para o cliente escrever.'
                : 'Áudios do cliente viram texto, aparecem transcritos em Conversas e o bot responde como se ele tivesse digitado.'}
            />
            <div className="divider" />
            <Field label="Confirmação do agendamento" hint={`Enviada quando o cliente conclui o agendamento. Use ${VARS}.`}><textarea className="textarea" {...text('confirmationMessage')} /></Field>
            <div className="phone-preview">
              <small className="eyebrow">Boas-vindas e menu</small>
              <p className="muted">As mensagens de boas-vindas, o menu e as opções do bot são montados na aba <strong>Fluxo do bot</strong>.</p>
              <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }} onClick={onOpenFlow}><Workflow size={14} />Abrir o fluxo do bot</button>
            </div>
          </>
        )}

        {tab === 'lembretes' && (
          <>
            <Switch checked={draft.reminderEnabled} onChange={(v) => set('reminderEnabled', v)} label="Lembrete na véspera" description="Pede para o cliente confirmar, remarcar ou cancelar respondendo 1, 2 ou 3." />
            {draft.reminderEnabled && (
              <div className="grid-2">
                <Field label="Enviar a partir de"><input className="input" type="time" {...text('reminderTime')} /></Field>
                <div />
              </div>
            )}
            <Field label="Mensagem da véspera" hint={`Use ${VARS}. As opções de confirmação são adicionadas no final.`}><textarea className="textarea" {...text('reminderMessage')} /></Field>
            <div className="divider" />
            <Switch checked={draft.hourReminderEnabled} onChange={(v) => set('hourReminderEnabled', v)} label="Aviso pouco antes do horário" description="Se o cliente ainda não confirmou, também pede confirmação." />
            {draft.hourReminderEnabled && (
              <Field label="Antecedência" hint={duration(draft.hourReminderMinutes)}>
                <select className="select" value={draft.hourReminderMinutes} onChange={(e) => set('hourReminderMinutes', Number(e.target.value))}>
                  {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{duration(m)} antes</option>)}
                </select>
              </Field>
            )}
            <Field label="Mensagem do aviso" hint={`Use ${VARS}.`}><textarea className="textarea" {...text('hourReminderMessage')} /></Field>
          </>
        )}

        {tab === 'equipe' && (
          <>
            <Field label="Transferência para a equipe" hint="Quando o cliente escolhe “Falar com a equipe”. O bot fica em silêncio até alguém responder."><textarea className="textarea" {...text('handoffMessage')} /></Field>
            <Switch checked={draft.pauseOnStaffReply} onChange={(v) => set('pauseOnStaffReply', v)} label="Pausar o bot quando a equipe responder" description="Vale para respostas pela Sysora e pelo celular." />
            <Field label="Encerrar o atendimento humano após" hint="Sem mensagens da equipe nesse período, o bot encerra o atendimento e volta a responder.">
              <select className="select" value={draft.humanTimeoutMinutes} onChange={(e) => set('humanTimeoutMinutes', Number(e.target.value))}>
                {[10, 15, 30, 60, 120, 240, 480, 1440].map((m) => <option key={m} value={m}>{duration(m)}</option>)}
              </select>
            </Field>
            <Field label="Mensagem de encerramento" hint="Use {nome}."><textarea className="textarea" {...text('humanEndMessage')} /></Field>
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {dirty && <small>Alterações não salvas</small>}
          <button type="button" className="btn btn-outline" disabled={!dirty || busy} onClick={() => setDraft(saved)}>Descartar</button>
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? <span className="spinner" /> : <Save size={16} />}Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const { company } = useAuth();
  const [tab, setTab] = useState<Tab>('conexao');
  const [codesEnabled, setCodesEnabled] = useState(false);
  useEffect(() => { settingsApi.get().then((r) => setCodesEnabled(Boolean(r.settings.emailCodesEnabled))).catch(() => {}); }, []);
  const confirmLeave = useConfirmLeave();
  // Trocar de aba descarta o rascunho da aba atual: pergunta antes, se houver.
  const openTab = (next: Tab) => { if (next !== tab) confirmLeave(() => setTab(next)); };

  return (
    <>
      <PageHead
        eyebrow="WhatsApp"
        title="Conexão e chatbot"
        text={`Conecte o número de ${company?.name ?? 'sua empresa'} e defina como o bot conversa com seus clientes.`}
      />
      <div className="tabs">
        {TABS.filter((t) => t.id !== 'codigos' || codesEnabled).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => openTab(id)}><Icon size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{label}</button>
        ))}
      </div>
      {tab === 'conexao' ? <Connection /> : tab === 'fluxo' ? <BotFlowEditor /> : tab === 'codigos' ? <EmailCodes onOpenFlow={() => openTab('fluxo')} /> : <BotSettings key={tab} tab={tab} onOpenFlow={() => openTab('fluxo')} />}
      {tab !== 'conexao' && tab !== 'codigos' && (
        <p className="hint" style={{ marginTop: 14 }}><MessageSquareText size={13} style={{ verticalAlign: -2 }} /> Os horários de atendimento que o bot oferece ficam em Configurações → Horários.</p>
      )}
    </>
  );
}
