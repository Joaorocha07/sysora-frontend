'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bot, Headset, Link2Off, MessageSquareText, QrCode, RefreshCw, Save, Send, Smartphone, Workflow } from 'lucide-react';
import { useShell } from '@/components/AppShell';
import { BotFlowEditor } from '@/components/BotFlowEditor';
import { ConfirmDialog, Field, Loading, PageHead, Switch, useToast } from '@/components/ui';
import { errorMessage, settingsApi, whatsappApi, type Settings, type WhatsAppStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { duration } from '@/lib/format';

type Tab = 'conexao' | 'bot' | 'fluxo' | 'lembretes' | 'equipe';

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'conexao', label: 'Conexão', icon: QrCode },
  { id: 'bot', label: 'Mensagens do bot', icon: Bot },
  { id: 'fluxo', label: 'Fluxo do bot', icon: Workflow },
  { id: 'lembretes', label: 'Lembretes', icon: Bell },
  { id: 'equipe', label: 'Atendimento humano', icon: Headset },
];

const VARS = '{nome}, {empresa}, {servico}, {data} e {hora}';

function formatWaPhone(phone: string | null) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return `+${d}`;
}

function Connection() {
  const toast = useToast();
  const { refreshBadges } = useShell();
  const [state, setState] = useState<WhatsAppStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [testTo, setTestTo] = useState('');
  const previous = useRef<WhatsAppStatus['status'] | null>(null);

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

  return (
    <div className="stack">
      <div className="card card-pad">
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
                <p className="hint">Funciona como o WhatsApp Web: a sessão fica salva e reconecta sozinha se o servidor reiniciar.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDisconnect && (
        <ConfirmDialog
          title="Desconectar o WhatsApp?"
          message="O bot para de atender e os lembretes deixam de ser enviados. Para voltar, será preciso ler um novo QR Code."
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

function BotSettings({ tab, onOpenFlow }: { tab: Exclude<Tab, 'conexao' | 'fluxo'>; onOpenFlow: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    settingsApi.get().then((r) => { setSaved(r.settings); setDraft(r.settings); }).catch((err) => toast(errorMessage(err), true));
  }, [toast]);

  if (!draft || !saved) return <Loading />;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const text = (key: keyof Settings) => ({ value: String(draft[key] ?? ''), onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    if (!draft || !saved) return;
    const changes = Object.fromEntries(Object.entries(draft).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(saved[k as keyof Settings])));
    setBusy(true);
    try {
      const next = await settingsApi.update(changes);
      setSaved(next);
      setDraft(next);
      toast('Configurações salvas.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body stack" style={{ paddingTop: 24 }}>
        {tab === 'bot' && (
          <>
            <Switch checked={draft.botEnabled} onChange={(v) => set('botEnabled', v)} label="Bot ligado" description="Desligado, as mensagens continuam chegando em Conversas, mas ninguém responde automaticamente." />
            <Switch checked={draft.autoCreateClient} onChange={(v) => set('autoCreateClient', v)} label="Cadastrar clientes automaticamente" description="Quem manda mensagem vira cliente. Desligado, o cliente só é cadastrado quando conclui um agendamento." />
            <Switch checked={draft.askName} onChange={(v) => set('askName', v)} label="Perguntar o nome" description="Quando o perfil do WhatsApp não traz um nome, o bot pergunta antes de agendar." />
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
            <Switch checked={draft.pauseOnStaffReply} onChange={(v) => set('pauseOnStaffReply', v)} label="Pausar o bot quando a equipe responder" description="Vale para respostas pelo Sysora e pelo celular." />
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

  return (
    <>
      <PageHead
        eyebrow="WhatsApp"
        title="Conexão e chatbot"
        text={`Conecte o número de ${company?.name ?? 'sua empresa'} e defina como o bot conversa com seus clientes.`}
      />
      <div className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{label}</button>
        ))}
      </div>
      {tab === 'conexao' ? <Connection /> : tab === 'fluxo' ? <BotFlowEditor /> : <BotSettings key={tab} tab={tab} onOpenFlow={() => setTab('fluxo')} />}
      {tab !== 'conexao' && (
        <p className="hint" style={{ marginTop: 14 }}><MessageSquareText size={13} style={{ verticalAlign: -2 }} /> Os horários de atendimento que o bot oferece ficam em Configurações → Horários.</p>
      )}
    </>
  );
}
