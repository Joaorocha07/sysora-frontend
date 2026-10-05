'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquarePlus, Send, Sparkles, Trash2, Workflow } from 'lucide-react';
import { AiPlanNotice, useAiPlan } from '@/components/AiPlanLock';
import { SoraCatalogCard } from '@/components/SoraCatalogCard';
import { ConfirmDialog, PageHead, useToast } from '@/components/ui';
import { SORA_FLOW_DRAFT_KEY, errorMessage, soraApi, type SoraConversation, type SoraStoredMessage, type SoraUsage } from '@/lib/api';

// Menu Sora: conversa com a IA para tirar dúvidas, cadastrar serviços e
// produtos e montar o fluxo do bot. As conversas ficam salvas (inclusive as
// feitas no Fluxo do bot). Catálogo só entra quando o dono confirma; fluxo
// abre no editor como rascunho.

const IDEAS = [
  'Cadastre meus serviços: corte R$ 50 (40 min), barba R$ 35 (30 min) e combo corte + barba R$ 75 (1h)',
  'Crie um bot para mim',
  'Como funcionam os lembretes de agendamento?',
];

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function SoraPage() {
  const toast = useToast();
  const router = useRouter();
  const ai = useAiPlan();
  const [usage, setUsage] = useState<SoraUsage | null>(null);
  const [conversations, setConversations] = useState<SoraConversation[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [messages, setMessages] = useState<SoraStoredMessage[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [removing, setRemoving] = useState<SoraConversation | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(() => { soraApi.conversations().then(setConversations).catch(() => {}); }, []);
  useEffect(() => {
    soraApi.usage().then(setUsage).catch(() => setUsage({ used: 0, limit: 0, enabled: false, allowed: false }));
    loadList();
  }, [loadList]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [messages, busy, pending]);

  async function open(id: string) {
    if (id === current) return;
    setCurrent(id);
    setError(null);
    setLoadingChat(true);
    try {
      setMessages((await soraApi.conversation(id)).messages);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setLoadingChat(false);
    }
  }

  function startNew() {
    setCurrent(null);
    setMessages([]);
    setError(null);
  }

  async function ask(message: string) {
    const content = message.trim();
    if (!content || busy) return;
    setText('');
    setError(null);
    setPending(content);
    setBusy(true);
    try {
      const r = await soraApi.send({ conversationId: current, text: content, mode: 'chat' });
      setCurrent(r.conversation.id);
      setMessages((m) => [...m, ...r.messages]);
      setUsage((u) => (u ? { ...u, ...r.usage } : u));
      loadList();
    } catch (err) {
      setError(errorMessage(err));
      setText(content);
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(text);
  }

  function openFlow(message: SoraStoredMessage) {
    try { sessionStorage.setItem(SORA_FLOW_DRAFT_KEY, JSON.stringify(message.payload?.flow)); } catch { /* sem storage: abre o editor sem o rascunho */ }
    router.push('/whatsapp?aba=fluxo');
  }

  async function remove() {
    if (!removing) return;
    try {
      await soraApi.remove(removing.id);
      if (removing.id === current) startNew();
      setConversations((list) => list.filter((c) => c.id !== removing.id));
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setRemoving(null);
    }
  }

  const limitReached = Boolean(usage && usage.used >= usage.limit);
  const blocked = !ai || !usage?.enabled || limitReached;

  return (
    <>
      <PageHead
        eyebrow="Assistente de IA"
        title="Sora"
        text="Converse para tirar dúvidas, cadastrar serviços e produtos e montar o fluxo do bot. Nada muda no sistema sem você confirmar."
      />
      {!ai && <div style={{ marginBottom: 14 }}><AiPlanNotice feature="Sora, a assistente de IA" /></div>}

      <div className="sora-page">
        <aside className="card sora-list">
          <button type="button" className="btn btn-primary btn-block" onClick={startNew}><MessageSquarePlus size={16} />Nova conversa</button>
          <span className="eyebrow">Histórico</span>
          {!conversations.length && <small className="muted">As conversas com a Sora aparecem aqui, inclusive as do Fluxo do bot.</small>}
          <div className="sora-list-items">
            {conversations.map((c) => (
              <div key={c.id} className={`sora-list-item${c.id === current ? ' on' : ''}`}>
                <button type="button" onClick={() => void open(c.id)}>
                  <span>{c.title}</span>
                  <small>{when(c.updatedAt)}{c.source === 'fluxo' && <> · <Workflow size={11} style={{ verticalAlign: -1 }} /> Fluxo do bot</>}</small>
                </button>
                <button type="button" className="icon-btn" aria-label="Apagar conversa" onClick={() => setRemoving(c)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <section className="card sora-main">
          <div className="sora-head">
            <span className="sora-mark"><Sparkles size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{conversations.find((c) => c.id === current)?.title ?? 'Nova conversa'}</strong>
              <small style={{ display: 'block' }} className="muted">Catálogo: você confirma antes de cadastrar. Fluxo: abre no editor para revisar e salvar.</small>
            </div>
            {usage?.enabled && <small className="muted">{usage.used}/{usage.limit} no mês</small>}
          </div>

          <div className="sora-thread" ref={chatRef}>
            {loadingChat && <div className="flow-system"><span className="spinner" /> Carregando conversa…</div>}
            {!loadingChat && !messages.length && !pending && (
              <div className="sora-empty">
                <p className="muted">Oi! Eu sou a Sora. Posso cadastrar seu catálogo, montar o bot do WhatsApp e tirar dúvidas sobre a Sysora. Experimente:</p>
                <div className="sora-ideas">
                  {IDEAS.map((idea) => <button key={idea} type="button" className="chip" disabled={busy || blocked} onClick={() => void ask(idea)}>{idea}</button>)}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`bubble${m.role === 'user' ? ' own' : ''}`}>
                {m.text}
                {m.role === 'assistant' && m.payload?.catalog?.length ? (
                  <SoraCatalogCard
                    messageId={m.id}
                    changes={m.payload.catalog}
                    appliedAt={m.payload.catalogAppliedAt}
                    onApplied={(appliedAt) => setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, payload: { ...x.payload, catalogAppliedAt: appliedAt } } : x)))}
                  />
                ) : null}
                {m.role === 'assistant' && m.payload?.flow && (
                  <div className="sora-catalog">
                    <strong>Fluxo do bot pronto para revisar</strong>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openFlow(m)}><Workflow size={14} />Abrir no Fluxo do bot</button>
                  </div>
                )}
              </div>
            ))}
            {pending && <div className="bubble own">{pending}</div>}
            {busy && <div className="bubble"><span className="spinner" /> Pensando…</div>}
            {error && <div className="flow-system">{error}</div>}
          </div>

          <form className="sora-input" onSubmit={submit}>
            <textarea
              className="textarea"
              rows={2}
              maxLength={2000}
              value={text}
              disabled={busy || blocked}
              placeholder={limitReached ? 'Limite de pedidos do mês atingido.' : !usage?.enabled && usage ? 'A Sora ainda não está configurada neste servidor.' : 'Ex.: cadastre o produto Pomada modeladora por R$ 39,90'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
            />
            <button className="btn btn-primary" disabled={busy || blocked || !text.trim()} aria-label="Enviar para a Sora"><Send size={16} /></button>
          </form>
        </section>
      </div>

      {removing && (
        <ConfirmDialog
          title="Apagar conversa?"
          message={`"${removing.title}" sai do histórico. O que já foi cadastrado ou salvo continua no sistema.`}
          confirmLabel="Apagar"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
