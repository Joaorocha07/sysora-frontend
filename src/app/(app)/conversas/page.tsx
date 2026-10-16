'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Bot, CalendarClock, Clock, Headset, MessageCircle, Search, Send, UserRound, Zap } from 'lucide-react';
import { useShell } from '@/components/AppShell';
import { ClientTagsButton, ScheduleMessageModal, StageSelect, TagChip, TagChips, useStages, useTags } from '@/components/Crm';
import { Avatar, Empty, Loading, useToast } from '@/components/ui';
import {
  conversationsApi, errorMessage, quickRepliesApi,
  type BotState, type Client, type Conversation, type ConversationChannel, type Message, type QuickReply, type TagRef,
} from '@/lib/api';
import { clock, firstName, longDate, relativeTime, toIsoDate } from '@/lib/format';

type Filter = 'todas' | 'nao-lidas' | 'equipe' | 'arquivadas';

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get('cliente');
  const toast = useToast();
  const { refreshBadges } = useShell();
  const { tags } = useTags();
  const { stages } = useStages();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [tagId, setTagId] = useState('');
  const [stageId, setStageId] = useState('');

  const loadList = useCallback(() => {
    conversationsApi.list().then(setList).catch(() => {});
  }, []);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, 10_000);
    return () => clearInterval(timer);
  }, [loadList]);

  const all = list ?? [];
  const firstStage = stages?.[0]?.id;
  const counts = {
    unread: all.filter((c) => !c.archivedAt && c.unreadCount > 0).length,
    staff: all.filter((c) => !c.archivedAt && c.withStaff).length,
    archived: all.filter((c) => c.archivedAt).length,
  };
  const term = search.toLowerCase();
  const filtered = all.filter((c) => {
    if (filter === 'arquivadas' ? !c.archivedAt : c.archivedAt) return false;
    if (filter === 'nao-lidas' && !c.unreadCount) return false;
    if (filter === 'equipe' && !c.withStaff) return false;
    if (tagId && !c.tagIds?.includes(tagId)) return false;
    if (stageId && (c.stageId ?? firstStage) !== stageId) return false;
    return `${c.name} ${c.phone}`.toLowerCase().includes(term);
  });
  const open = (id: string) => router.push(`/conversas?cliente=${id}`);
  const chip = (id: Filter, label: string, count?: number) => (
    <button type="button" className={`chip${filter === id ? ' on' : ''}`} onClick={() => setFilter(id)}>
      {label}{count ? <b>{count}</b> : null}
    </button>
  );

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
        <div className="inbox-filters">
          {chip('todas', 'Todas')}
          {chip('nao-lidas', 'Não lidas', counts.unread)}
          {chip('equipe', 'Com a equipe', counts.staff)}
          {chip('arquivadas', 'Arquivadas', counts.archived)}
          {Boolean(tags?.length) && (
            <select className="select" value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Filtrar por etiqueta">
              <option value="">Etiqueta</option>
              {tags!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {Boolean(stages?.length) && (
            <select className="select" value={stageId} onChange={(e) => setStageId(e.target.value)} aria-label="Filtrar por etapa">
              <option value="">Etapa</option>
              {stages!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
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
                <TagChips ids={c.tagIds} max={2} />
              </div>
              {c.unreadCount > 0 && <span className="unread">{c.unreadCount}</span>}
            </button>
          ))}
          {!filtered.length && (
            <Empty
              icon={<MessageCircle size={22} />}
              title={all.length ? 'Nada por aqui' : 'Nenhuma conversa'}
              text={all.length ? 'Nenhuma conversa com esses filtros.' : 'Quando clientes mandarem mensagem no WhatsApp conectado, as conversas aparecem aqui.'}
            />
          )}
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

// Texto da resposta rápida com {nome} trocado pelo primeiro nome do cliente.
const fillReply = (text: string, name: string) => text.replace(/\{nome\}/gi, firstName(name));

function Chat({ clientId, onBack, onActivity, onError }: { clientId: string; onBack: () => void; onActivity: () => void; onError: (message: string) => void }) {
  const toast = useToast();
  const { tags: allTags } = useTags();
  const [client, setClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bot, setBot] = useState<BotState | null>(null);
  const [channel, setChannel] = useState<ConversationChannel | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickIndex, setQuickIndex] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async (first = false) => {
    try {
      const data = await conversationsApi.get(clientId);
      setClient(data.client);
      setMessages(data.messages);
      setBot(data.bot);
      setChannel(data.channel);
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

  useEffect(() => { quickRepliesApi.list().then(setReplies).catch(() => {}); }, []);

  // Rola para o fim quando chegam mensagens novas.
  useEffect(() => {
    if (messages.length !== lastCount.current) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
    lastCount.current = messages.length;
  }, [messages]);

  // "/atalho" no começo do texto abre as respostas rápidas filtradas.
  const slash = /^\/(\S*)$/.exec(text)?.[1]?.toLowerCase() ?? null;
  const showQuick = quickOpen || slash !== null;
  const quickList = useMemo(() => {
    if (slash === null) return replies;
    return replies.filter((r) => (r.shortcut ?? '').startsWith(slash) || r.title.toLowerCase().includes(slash));
  }, [replies, slash]);

  function pickReply(reply: QuickReply) {
    setText(fillReply(reply.text, client?.name ?? ''));
    setQuickOpen(false);
    setQuickIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

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
    if (showQuick && quickList.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setQuickIndex((i) => (i + step + quickList.length) % quickList.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickReply(quickList[Math.min(quickIndex, quickList.length - 1)]);
        return;
      }
    }
    if (e.key === 'Escape' && showQuick) {
      setQuickOpen(false);
      if (slash !== null) setText('');
      return;
    }
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

  async function toggleArchive() {
    if (!client) return;
    try {
      const { archivedAt } = await conversationsApi.archive(clientId, !client.archivedAt);
      setClient({ ...client, archivedAt });
      toast(archivedAt ? 'Conversa arquivada. Ela volta sozinha quando o cliente escrever.' : 'Conversa desarquivada.');
      onActivity();
    } catch (err) {
      onError(errorMessage(err));
    }
  }

  function setTags(tags: TagRef[]) {
    if (!client) return;
    setClient({ ...client, tagIds: tags.map((t) => t.id) });
    onActivity();
  }

  if (!client) return <div className="chat" style={{ display: 'grid', placeItems: 'center' }}><span className="spinner" /></div>;

  // Sem o canal (resposta antiga do servidor), vale só ter WhatsApp vinculado.
  const canReply = channel ? channel.canReply : Boolean(client.whatsappId);
  const windowEnds = channel?.windowEndsAt ? new Date(channel.windowEndsAt) : null;
  const windowOpen = Boolean(windowEnds && windowEnds.getTime() > Date.now());
  const closedReason = !client.whatsappId
    ? 'Cliente sem WhatsApp vinculado'
    : channel?.hiddenNumber
      ? 'O WhatsApp não mostrou o número deste cliente. Informe o telefone na ficha para poder responder.'
      : channel?.official && !windowOpen
        ? 'Passaram 24 horas desde a última mensagem do cliente. Pelo WhatsApp oficial, você poderá responder quando ele escrever de novo.'
        : null;
  // Aviso quando faltam menos de 3 horas para a janela de resposta fechar.
  const closingSoon = channel?.official && windowOpen && windowEnds!.getTime() - Date.now() < 3 * 60 * 60 * 1000;
  const clientTags = (allTags ?? []).filter((t) => client.tagIds?.includes(t.id));

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
        {client.whatsappId && (
          <button type="button" className="icon-btn bordered" onClick={() => setScheduling(true)} aria-label="Agendar mensagem" title="Agendar mensagem"><CalendarClock size={16} /></button>
        )}
        <button type="button" className="icon-btn bordered" onClick={toggleArchive} aria-label={client.archivedAt ? 'Desarquivar' : 'Arquivar'} title={client.archivedAt ? 'Desarquivar' : 'Arquivar'}>
          {client.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
        </button>
        <Link href={`/clientes/${client.id}`} className="btn btn-sm btn-outline"><UserRound size={15} /><span className="hide-mobile">Ficha</span></Link>
      </div>

      <div className="chat-tags">
        <StageSelect clientId={client.id} value={client.stageId} onSaved={(stageId) => { setClient({ ...client, stageId }); onActivity(); }} />
        {clientTags.map((t) => (
          <TagChip key={t.id} tag={t} />
        ))}
        <ClientTagsButton clientId={client.id} value={client.tagIds ?? []} onSaved={setTags} compact />
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

      {(closedReason || closingSoon) && client.whatsappId && (
        <div className="bot-state">
          <Clock size={16} />
          <span style={{ flex: 1 }}>
            {closedReason ?? `Você pode responder até ${clock(windowEnds!.toISOString())}. Depois disso, só quando o cliente escrever de novo (regra do WhatsApp oficial).`}
          </span>
          {channel?.hiddenNumber && <Link href={`/clientes/${client.id}`} className="btn btn-sm btn-outline">Abrir ficha</Link>}
        </div>
      )}

      <form className="chat-foot" onSubmit={send}>
        {showQuick && canReply && (
          <div className="quick-menu" role="listbox" aria-label="Respostas rápidas">
            <div className="menu-label">Respostas rápidas</div>
            {quickList.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === quickIndex}
                className={i === quickIndex ? 'on' : ''}
                onMouseEnter={() => setQuickIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); pickReply(r); }}
              >
                <strong>{r.title}{r.shortcut && <code>/{r.shortcut}</code>}</strong>
                <small>{fillReply(r.text, client.name)}</small>
              </button>
            ))}
            {!quickList.length && (
              <p className="muted" style={{ padding: '6px 12px 10px', fontSize: 13 }}>
                {replies.length ? 'Nenhuma resposta com esse atalho.' : <>Nenhuma resposta rápida ainda. <Link href="/atendimento" style={{ textDecoration: 'underline' }}>Criar agora</Link></>}
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          className="icon-btn bordered"
          style={{ width: 44, height: 44, flexShrink: 0 }}
          disabled={!canReply}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setQuickOpen((o) => !o); setQuickIndex(0); inputRef.current?.focus(); }}
          aria-label="Respostas rápidas"
          title="Respostas rápidas (ou digite /)"
        >
          <Zap size={17} />
        </button>
        <textarea
          ref={inputRef}
          className="textarea"
          rows={1}
          placeholder={canReply ? 'Mensagem (/ para respostas rápidas)' : client.whatsappId ? 'Não é possível responder agora' : 'Cliente sem WhatsApp vinculado'}
          value={text}
          disabled={!canReply}
          onChange={(e) => { setText(e.target.value); setQuickIndex(0); }}
          onKeyDown={onKey}
          onBlur={() => setQuickOpen(false)}
        />
        <button className="btn btn-primary" style={{ width: 44, padding: 0 }} disabled={!text.trim() || sending || !canReply} aria-label="Enviar">
          {sending ? <span className="spinner" /> : <Send size={17} />}
        </button>
      </form>

      {scheduling && (
        <ScheduleMessageModal
          client={client}
          onClose={() => setScheduling(false)}
          onSaved={(m) => { setScheduling(false); toast(`Mensagem agendada para ${new Date(m.sendAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`); }}
        />
      )}
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
