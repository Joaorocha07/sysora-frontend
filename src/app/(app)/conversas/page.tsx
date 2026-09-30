'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Bot, Headset, MessageCircle, Search, Send, UserRound } from 'lucide-react';
import { useShell } from '@/components/AppShell';
import { Avatar, Empty, Loading, useToast } from '@/components/ui';
import { conversationsApi, errorMessage, type BotState, type Client, type Conversation, type Message } from '@/lib/api';
import { clock, longDate, relativeTime, toIsoDate } from '@/lib/format';

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get('cliente');
  const toast = useToast();
  const { refreshBadges } = useShell();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [search, setSearch] = useState('');

  const loadList = useCallback(() => {
    conversationsApi.list().then(setList).catch(() => {});
  }, []);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, 10_000);
    return () => clearInterval(timer);
  }, [loadList]);

  const filtered = (list ?? []).filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const open = (id: string) => router.push(`/conversas?cliente=${id}`);

  if (!list) return <Loading />;

  return (
    <div className={`card inbox${activeId ? ' has-chat' : ''}`}>
      <div className="inbox-list">
        <div className="search">
          <div className="input-icon">
            <Search size={16} />
            <input className="input" placeholder="Buscar conversa" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="inbox-items">
          {filtered.map((c) => (
            <button key={c.id} type="button" className={`inbox-item${c.id === activeId ? ' on' : ''}`} onClick={() => open(c.id)}>
              <Avatar name={c.name} />
              <div className="meta">
                <strong>{c.name}<span>{relativeTime(c.lastMessageAt)}</span></strong>
                <p>
                  {c.withStaff && <Headset size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                  {c.lastMessage ? `${c.lastMessage.sender === 'CLIENT' ? '' : c.lastMessage.sender === 'BOT' ? 'Bot: ' : 'Você: '}${c.lastMessage.text}` : ''}
                </p>
              </div>
              {c.unreadCount > 0 && <span className="unread">{c.unreadCount}</span>}
            </button>
          ))}
          {!filtered.length && <Empty icon={<MessageCircle size={22} />} title="Nenhuma conversa" text="Quando clientes mandarem mensagem no WhatsApp conectado, as conversas aparecem aqui." />}
        </div>
      </div>

      {activeId ? (
        <Chat key={activeId} clientId={activeId} onBack={() => router.push('/conversas')} onActivity={() => { loadList(); refreshBadges(); }} onError={(m) => toast(m, true)} />
      ) : (
        <div className="chat" style={{ display: 'grid', placeItems: 'center' }}>
          <Empty icon={<MessageCircle size={22} />} title="Selecione uma conversa" text="Acompanhe o que o bot está conversando e assuma o atendimento quando precisar." />
        </div>
      )}
    </div>
  );
}

function Chat({ clientId, onBack, onActivity, onError }: { clientId: string; onBack: () => void; onActivity: () => void; onError: (message: string) => void }) {
  const [client, setClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bot, setBot] = useState<BotState | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async (first = false) => {
    try {
      const data = await conversationsApi.get(clientId);
      setClient(data.client);
      setMessages(data.messages);
      setBot(data.bot);
      if (first) onActivity();
    } catch (err) {
      if (first) onError(errorMessage(err));
    }
  }, [clientId, onActivity, onError]);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Rola para o fim quando chegam mensagens novas.
  useEffect(() => {
    if (messages.length !== lastCount.current) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
    lastCount.current = messages.length;
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const result = await conversationsApi.reply(clientId, text.trim());
      setBot(result.bot);
      setText('');
      await load();
      onActivity();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  async function resume() {
    try {
      setBot((await conversationsApi.resumeBot(clientId)).bot);
    } catch (err) {
      onError(errorMessage(err));
    }
  }

  if (!client) return <div className="chat" style={{ display: 'grid', placeItems: 'center' }}><span className="spinner" /></div>;

  let lastDay = '';
  return (
    <div className="chat">
      <div className="chat-head">
        <button type="button" className="icon-btn bordered menu-back" onClick={onBack} aria-label="Voltar"><ArrowLeft size={17} /></button>
        <Avatar name={client.name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block' }}>{client.name}</strong>
          <small>{client.phone}</small>
        </div>
        <Link href={`/clientes/${client.id}`} className="btn btn-sm btn-outline"><UserRound size={15} /><span className="hide-mobile">Ficha</span></Link>
      </div>

      {bot && (
        <div className="bot-state">
          {bot.paused ? <Headset size={16} /> : <Bot size={16} />}
          <span style={{ flex: 1 }}>
            {bot.paused
              ? bot.waitingForStaff
                ? 'O cliente pediu para falar com a equipe. O bot está em silêncio aguardando vocês.'
                : `Equipe atendendo. O bot volta sozinho às ${bot.pausedUntil ? clock(bot.pausedUntil) : ''} se ninguém responder.`
              : 'O bot está atendendo. Ao responder, ele pausa com este cliente.'}
          </span>
          {bot.paused && <button type="button" className="btn btn-sm btn-outline" onClick={resume}>Devolver ao bot</button>}
        </div>
      )}

      <div className="chat-body" ref={bodyRef}>
        {messages.map((m) => {
          const day = toIsoDate(new Date(m.createdAt));
          const sep = day !== lastDay ? <div key={`d-${day}`} className="day-sep">{longDate(day)}</div> : null;
          lastDay = day;
          const kind = m.sender === 'CLIENT' ? '' : m.sender === 'BOT' ? ' bot' : ' own';
          return [
            sep,
            <div key={m.id} className={`bubble${kind}`}>
              {m.text}
              <small>{m.sender === 'BOT' ? 'Bot · ' : m.sender === 'STAFF' ? `${m.staffName ?? 'Equipe'} · ` : ''}{clock(m.createdAt)}</small>
            </div>,
          ];
        })}
        {!messages.length && <p className="muted" style={{ margin: 'auto' }}>Nenhuma mensagem ainda.</p>}
      </div>

      <form className="chat-foot" onSubmit={send}>
        <textarea
          className="textarea"
          rows={1}
          placeholder={client.whatsappId ? 'Escreva uma mensagem (Enter envia)' : 'Cliente sem WhatsApp vinculado'}
          value={text}
          disabled={!client.whatsappId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="btn btn-primary" style={{ width: 44, padding: 0 }} disabled={!text.trim() || sending || !client.whatsappId} aria-label="Enviar">
          {sending ? <span className="spinner" /> : <Send size={17} />}
        </button>
      </form>
    </div>
  );
}

export default function ConversasPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inbox />
    </Suspense>
  );
}
