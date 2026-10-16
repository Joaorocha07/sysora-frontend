'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, MessageSquareReply, Pencil, Plus, Repeat2, Search, Sparkles, Tags, Trash2, Undo2, X, Zap } from 'lucide-react';
import { AiPlanBadge, useAiPlan } from '@/components/AiPlanLock';
import { ColorPicker, SCHEDULED_STATUS, ScheduleMessageModal, TagChip, scheduledWhen, useTags } from '@/components/Crm';
import { useUnsavedChanges } from '@/components/UnsavedChanges';
import { Avatar, ConfirmDialog, Empty, Field, FormError, Loading, Modal, PageHead, Switch, useToast } from '@/components/ui';
import {
  clientsApi, errorMessage, followUpApi, quickRepliesApi, reactivationApi, scheduledMessagesApi, tagsApi,
  type Client, type FollowUpStep, type QuickReply, type Reactivation, type ScheduledMessage, type ScheduledStatus, type Tag, type TagColor,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/format';

type Tab = 'respostas' | 'etiquetas' | 'agendadas' | 'follow-up';
const TABS: { id: Tab; label: string; icon: typeof Zap }[] = [
  { id: 'respostas', label: 'Respostas rápidas', icon: Zap },
  { id: 'etiquetas', label: 'Etiquetas', icon: Tags },
  { id: 'agendadas', label: 'Mensagens agendadas', icon: CalendarClock },
  { id: 'follow-up', label: 'Follow-up', icon: Repeat2 },
];

function Atendimento() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('aba'))?.id ?? 'respostas') as Tab;
  return (
    <>
      <PageHead eyebrow="Atendimento" title="Ferramentas do atendimento" text="Textos prontos para o chat, etiquetas dos clientes, mensagens programadas e o follow-up automático." />
      <div className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => router.replace(`/atendimento?aba=${id}`)}>
            <Icon size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{label}
          </button>
        ))}
      </div>
      {tab === 'respostas' && <QuickRepliesTab />}
      {tab === 'etiquetas' && <TagsTab />}
      {tab === 'agendadas' && <ScheduledTab />}
      {tab === 'follow-up' && <FollowUpTab />}
    </>
  );
}

// ============ Respostas rápidas ============
function QuickRepliesTab() {
  const toast = useToast();
  const [replies, setReplies] = useState<QuickReply[] | null>(null);
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [removing, setRemoving] = useState<QuickReply | null>(null);

  const load = useCallback(() => { quickRepliesApi.list().then(setReplies).catch((err) => toast(errorMessage(err), true)); }, [toast]);
  useEffect(load, [load]);

  async function remove() {
    if (!removing) return;
    try {
      await quickRepliesApi.remove(removing.id);
      setReplies((all) => (all ?? []).filter((r) => r.id !== removing.id));
      toast('Resposta apagada.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Respostas rápidas</h2><p>No chat, clique no raio ou digite / e o atalho. {'{nome}'} vira o primeiro nome do cliente.</p></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={15} />Nova resposta</button>
      </div>
      {replies === null ? (
        <div className="loading-screen" style={{ minHeight: 160 }}><span className="spinner" /></div>
      ) : replies.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead><tr><th>Título</th><th className="hide-mobile">Atalho</th><th>Mensagem</th><th /></tr></thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong></td>
                  <td className="hide-mobile">{r.shortcut ? <code>/{r.shortcut}</code> : <span className="faint">—</span>}</td>
                  <td className="muted" style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="icon-btn" onClick={() => setEditing(r)} aria-label="Editar"><Pencil size={15} /></button>
                    <button type="button" className="icon-btn" onClick={() => setRemoving(r)} aria-label="Apagar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<MessageSquareReply size={22} />}
          title="Nenhuma resposta rápida"
          text="Crie textos que a equipe manda sempre: endereço, formas de pagamento, tabela de preços, boas-vindas."
          action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={15} />Criar a primeira</button>}
        />
      )}
      {editing && (
        <QuickReplyModal
          reply={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast('Resposta salva.'); load(); }}
        />
      )}
      {removing && <ConfirmDialog title="Apagar resposta rápida?" message={`"${removing.title}" sai da lista do chat.`} confirmLabel="Apagar" danger onConfirm={remove} onClose={() => setRemoving(null)} />}
    </div>
  );
}

const toShortcut = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24);

function QuickReplyModal({ reply, onClose, onSaved }: { reply: QuickReply | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(reply?.title ?? '');
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? '');
  const [text, setText] = useState(reply?.text ?? '');
  const [touched, setTouched] = useState(Boolean(reply?.shortcut));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiPlan = useAiPlan();
  const [request, setRequest] = useState('');
  const [writing, setWriting] = useState(false);
  // Título e texto antes da IA, para desfazer.
  const [beforeAi, setBeforeAi] = useState<{ title: string; text: string } | null>(null);
  const aiRequest = request.trim() || title.trim();

  async function writeWithAi() {
    setError(null);
    setWriting(true);
    try {
      const result = await quickRepliesApi.write({ request: aiRequest, draft: text.trim() || null });
      setBeforeAi({ title, text });
      if (!title.trim()) {
        setTitle(result.title);
        if (!touched) setShortcut(toShortcut(result.title));
      }
      setText(result.text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWriting(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = { title: title.trim(), shortcut: shortcut || null, text: text.trim() };
      if (reply) await quickRepliesApi.update(reply.id, input);
      else await quickRepliesApi.create(input);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={reply ? 'Editar resposta rápida' : 'Nova resposta rápida'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="quick-form" className="btn btn-primary" disabled={saving || !title.trim() || !text.trim()}>{saving && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="quick-form" className="stack" onSubmit={submit}>
        <div className="ai-compose">
          <Field label="Criar com IA" hint={aiPlan ? 'A IA usa o nome, o endereço, os horários e o catálogo da empresa. O que ela não souber fica entre [colchetes] para você completar.' : undefined}>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                value={request}
                maxLength={300}
                disabled={!aiPlan || writing}
                placeholder="Sobre o que é a mensagem? Ex.: endereço e horário de funcionamento"
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (aiRequest.length >= 3) void writeWithAi(); } }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
                onClick={writeWithAi}
                disabled={!aiPlan || writing || aiRequest.length < 3}
                title={!aiPlan ? 'Disponível no plano Avançado' : aiRequest.length < 3 ? 'Diga sobre o que é a mensagem' : undefined}
              >
                {writing ? <span className="spinner" /> : <Sparkles size={15} />}
                <span className="hide-mobile">{text.trim() ? 'Melhorar com IA' : 'Criar com IA'}</span>
                {!aiPlan && <AiPlanBadge />}
              </button>
            </div>
          </Field>
          {!aiPlan && <small>Disponível no plano Avançado. No teste grátis e no plano Inicial, escreva a mensagem manualmente.</small>}
          {beforeAi && !writing && (
            <div className="row" style={{ gap: 8 }}>
              <small style={{ flex: 1 }}>Texto escrito pela IA. Revise antes de salvar.</small>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTitle(beforeAi.title); setText(beforeAi.text); setBeforeAi(null); }}><Undo2 size={14} />Desfazer</button>
            </div>
          )}
        </div>
        <div className="grid-2">
          <Field label="Título">
            <input className="input" value={title} maxLength={60} placeholder="Ex.: Endereço" onChange={(e) => { setTitle(e.target.value); if (!touched) setShortcut(toShortcut(e.target.value)); }} required />
          </Field>
          <Field label="Atalho (opcional)" hint={shortcut ? `No chat: /${shortcut}` : 'Sem atalho, aparece só pelo botão.'}>
            <input className="input" value={shortcut} maxLength={24} placeholder="endereco" onChange={(e) => { setTouched(true); setShortcut(toShortcut(e.target.value)); }} />
          </Field>
        </div>
        <Field label="Mensagem" hint="Use {nome} para o primeiro nome do cliente.">
          <textarea className="textarea" rows={6} value={text} maxLength={4096} disabled={writing} onChange={(e) => { setText(e.target.value); setBeforeAi(null); }} placeholder="Oi, {nome}! Estamos na Rua das Flores, 120 — Centro. Funcionamos de terça a sábado, das 9h às 19h." required />
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

// ============ Etiquetas ============
function TagsTab() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { tags, reload } = useTags();
  const [editing, setEditing] = useState<Tag | 'new' | null>(null);
  const [removing, setRemoving] = useState<Tag | null>(null);

  async function remove() {
    if (!removing) return;
    try {
      await tagsApi.remove(removing.id);
      await reload();
      toast('Etiqueta apagada.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Etiquetas</h2><p>Organize os clientes (ex.: VIP, Orçamento, Retorno). Filtre por elas em Clientes, Conversas e no Funil.</p></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={15} />Nova etiqueta</button>
      </div>
      {tags === null ? (
        <div className="loading-screen" style={{ minHeight: 160 }}><span className="spinner" /></div>
      ) : tags.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead><tr><th>Etiqueta</th><th>Clientes</th><th /></tr></thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td><TagChip tag={t} /></td>
                  <td className="mono"><Link href={`/clientes?etiqueta=${t.id}`} style={{ textDecoration: 'underline' }}>{t._count?.clients ?? 0}</Link></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="icon-btn" onClick={() => setEditing(t)} aria-label="Editar"><Pencil size={15} /></button>
                    {isAdmin && <button type="button" className="icon-btn" onClick={() => setRemoving(t)} aria-label="Apagar"><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<Tags size={22} />} title="Nenhuma etiqueta" text="Crie aqui ou direto no chat e na ficha do cliente." />
      )}
      {editing && (
        <TagModal tag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); toast('Etiqueta salva.'); }} />
      )}
      {removing && (
        <ConfirmDialog
          title="Apagar etiqueta?"
          message={`"${removing.name}" sai de ${removing._count?.clients ?? 0} ${removing._count?.clients === 1 ? 'cliente' : 'clientes'}. Os clientes continuam cadastrados.`}
          confirmLabel="Apagar"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function TagModal({ tag, onClose, onSaved }: { tag: Tag | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<TagColor>(tag?.color ?? 'graphite');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (tag) await tagsApi.update(tag.id, { name: name.trim(), color });
      else await tagsApi.create({ name: name.trim(), color });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={tag ? 'Editar etiqueta' : 'Nova etiqueta'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="tag-form" className="btn btn-primary" disabled={saving || !name.trim()}>{saving && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="tag-form" className="stack" onSubmit={submit}>
        <Field label="Nome"><input className="input" value={name} maxLength={30} placeholder="Ex.: VIP" onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Cor"><ColorPicker value={color} onChange={setColor} /></Field>
        <div className="row"><small>Prévia:</small><TagChip tag={{ id: 'preview', name: name.trim() || 'Etiqueta', color }} /></div>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

// ============ Mensagens agendadas ============
const STATUS_FILTERS: { id: ScheduledStatus | 'ALL'; label: string }[] = [
  { id: 'PENDING', label: 'Agendadas' },
  { id: 'SENT', label: 'Enviadas' },
  { id: 'FAILED', label: 'Com falha' },
  { id: 'ALL', label: 'Todas' },
];

function ScheduledTab() {
  const toast = useToast();
  const [status, setStatus] = useState<ScheduledStatus | 'ALL'>('PENDING');
  const [messages, setMessages] = useState<ScheduledMessage[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  const load = useCallback(() => {
    setMessages(null);
    scheduledMessagesApi.list(status === 'ALL' ? {} : { status })
      .then((list) => setMessages(status === 'PENDING' ? list : [...list].reverse()))
      .catch((err) => toast(errorMessage(err), true));
  }, [status, toast]);
  useEffect(load, [load]);

  async function cancel(m: ScheduledMessage) {
    try {
      await scheduledMessagesApi.cancel(m.id);
      toast('Mensagem cancelada.');
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  async function remove(m: ScheduledMessage) {
    try {
      await scheduledMessagesApi.remove(m.id);
      setMessages((all) => (all ?? []).filter((x) => x.id !== m.id));
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
    <ReactivationCard onScheduled={load} />
    <div className="card">
      <div className="card-head">
        <div><h2>Mensagens agendadas</h2><p>A equipe programa e o WhatsApp conectado envia no dia e hora marcados.</p></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setClient(null); setCreating(true); }}><Plus size={15} />Agendar mensagem</button>
      </div>
      <div className="card-body" style={{ paddingBottom: 12 }}>
        <div className="segmented">
          {STATUS_FILTERS.map((f) => <button key={f.id} type="button" className={status === f.id ? 'on' : ''} onClick={() => setStatus(f.id)}>{f.label}</button>)}
        </div>
      </div>
      {messages === null ? (
        <div className="loading-screen" style={{ minHeight: 160 }}><span className="spinner" /></div>
      ) : messages.length ? (
        <div className="sched-list">
          {messages.map((m) => (
            <div key={m.id} className="sched-item">
              <div className="sched-when">
                <strong>{scheduledWhen(m.sendAt).split(' às ')[1]}</strong>
                <small>{scheduledWhen(m.sendAt).split(' às ')[0]}</small>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <Link href={`/clientes/${m.client.id}`} style={{ fontWeight: 600 }}>{m.client.name}</Link>
                  <span className={`badge ${SCHEDULED_STATUS[m.status].badge}`}>{SCHEDULED_STATUS[m.status].label}</span>
                </div>
                <p>{m.text}</p>
                <small>{m.error ? `Motivo: ${m.error}` : `Por ${m.createdByName}`}</small>
              </div>
              <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                {m.status === 'PENDING' ? (
                  <>
                    <button type="button" className="icon-btn" onClick={() => setEditing(m)} aria-label="Editar"><Pencil size={15} /></button>
                    <button type="button" className="icon-btn" onClick={() => cancel(m)} aria-label="Cancelar envio" title="Cancelar envio"><X size={16} /></button>
                  </>
                ) : (
                  <button type="button" className="icon-btn" onClick={() => remove(m)} aria-label="Apagar do histórico"><Trash2 size={15} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<CalendarClock size={22} />} title={status === 'PENDING' ? 'Nada agendado' : 'Nenhuma mensagem aqui'} text="Agende também direto do chat, pelo ícone do relógio." />
      )}

      {(creating || editing) && (
        <ScheduleMessageModal
          message={editing}
          client={client}
          picker={editing ? undefined : <ClientPicker value={client} onChange={setClient} />}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); toast('Mensagem agendada.'); load(); }}
        />
      )}
    </div>
    </div>
  );
}

// ============ Reativação de clientes sumidos ============
const REACTIVATION_DAYS = [15, 30, 45, 60, 90, 180];

function ReactivationCard({ onScheduled }: { onScheduled: () => void }) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const aiPlan = useAiPlan();
  const [data, setData] = useState<Reactivation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [request, setRequest] = useState('');
  const [writing, setWriting] = useState(false);
  const [beforeAi, setBeforeAi] = useState<string | null>(null);

  const apply = (r: Reactivation) => { setData(r); setEnabled(r.enabled); setDays(r.days); setMessage(r.message); };
  useEffect(() => { reactivationApi.get().then(apply).catch((err) => toast(errorMessage(err), true)); }, [toast]);

  const dirty = Boolean(data) && (enabled !== data!.enabled || days !== data!.days || message !== data!.message);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await reactivationApi.save({ enabled, days, message: message.trim() });
      apply(r);
      toast(r.enabled ? 'Reativação ligada.' : 'Reativação salva.');
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled, days, message, toast]);
  useUnsavedChanges(isAdmin && dirty, save);

  async function writeWithAi() {
    setError(null);
    setWriting(true);
    try {
      const text = await reactivationApi.write({ request: request.trim() || null, draft: message.trim() || null, days });
      setBeforeAi(message);
      setMessage(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWriting(false);
    }
  }

  if (!data) return <div className="card"><div className="loading-screen" style={{ minHeight: 120 }}><span className="spinner" /></div></div>;

  const example = message
    .replace(/\{nome\}/g, 'Maria')
    .replace(/\{empresa\}/g, 'sua empresa')
    .replace(/\{link\}/g, 'https://www.sysora.com.br/agendar/…');

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Reativar clientes sumidos</h2>
          <p>O bot convida para agendar, com o link pessoal de agendamento, quem não manda mensagem há um tempo.</p>
        </div>
      </div>
      <div className="card-body stack">
        {data.official && (
          <div className="ai-plan-notice">
            <span>Pelo <strong>WhatsApp oficial</strong>, a Meta só deixa mandar texto livre até 24 horas depois da última mensagem do cliente, então a reativação não funciona nessa conexão. Use a lista abaixo para agendar mensagens uma a uma quando o cliente voltar a falar.</span>
          </div>
        )}
        <Switch
          checked={enabled}
          disabled={!isAdmin || data.official}
          onChange={setEnabled}
          label="Mandar convite para agendar"
          description={`Até ${data.dailyLimit} por dia, uma por minuto, só em dia e horário de atendimento. Só para quem já conversou com a empresa pelo WhatsApp, sem horário marcado nem atendimento no período, e que não respondeu PARAR. A mesma pessoa só recebe de novo depois do mesmo prazo.`}
        />
        <Field label="Quem não manda mensagem há">
          <select className="select" style={{ maxWidth: 220 }} value={days} disabled={!isAdmin} onChange={(e) => setDays(Number(e.target.value))}>
            {REACTIVATION_DAYS.map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </Field>

        {isAdmin && (
          <div className="ai-compose">
            <Field label="Gerar mensagem com IA" hint={aiPlan ? 'Opcional: diga o tom ou um motivo (ex.: novidade no cardápio de serviços). A IA não inventa promoção.' : undefined}>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={request} maxLength={300} disabled={!aiPlan || writing} placeholder="Opcional. Ex.: convite carinhoso, sem formalidade" onChange={(e) => setRequest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void writeWithAi(); } }} />
                <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={writeWithAi} disabled={!aiPlan || writing} title={!aiPlan ? 'Disponível no plano Avançado' : undefined}>
                  {writing ? <span className="spinner" /> : <Sparkles size={15} />}<span className="hide-mobile">{message.trim() ? 'Melhorar com IA' : 'Gerar com IA'}</span>{!aiPlan && <AiPlanBadge />}
                </button>
              </div>
            </Field>
            {!aiPlan && <small>Disponível no plano Avançado. No teste grátis e no plano Inicial, escreva a mensagem manualmente.</small>}
            {beforeAi !== null && !writing && (
              <div className="row" style={{ gap: 8 }}>
                <small style={{ flex: 1 }}>Mensagem escrita pela IA. Revise e salve para valer.</small>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMessage(beforeAi); setBeforeAi(null); }}><Undo2 size={14} />Desfazer</button>
              </div>
            )}
          </div>
        )}

        <Field label="Mensagem" hint="{nome} = primeiro nome, {empresa} = nome da empresa, {link} = link pessoal para o cliente escolher o horário (obrigatório). No fim vai sempre: “Para não receber mais lembretes, responda PARAR.”">
          <textarea className="textarea" rows={4} maxLength={1000} value={message} disabled={!isAdmin || writing} onChange={(e) => { setMessage(e.target.value); setBeforeAi(null); }} />
        </Field>
        {message.trim() && (
          <div className="flow-preview" style={{ maxWidth: 420 }}>
            <div className="bubble bot" style={{ alignSelf: 'flex-start' }}>{example}<small>Exemplo do que o cliente recebe</small></div>
          </div>
        )}

        <div className="mini-stats" style={{ marginTop: 0 }}>
          <div><small>Sem mandar mensagem há {data.days}+ dias</small><strong>{data.candidates}</strong></div>
          <div><small>Convites hoje</small><strong>{data.sentToday} / {data.dailyLimit}</strong></div>
          <div><small>Convites nos últimos 30 dias</small><strong>{data.sent30}</strong></div>
        </div>
        {days !== data.days && <small className="muted">Salve para ver a lista com {days} dias.</small>}

        {data.preview.length > 0 && (
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowList((s) => !s)}>{showList ? 'Esconder clientes' : `Ver clientes (${Math.min(data.preview.length, data.candidates)}${data.candidates > data.preview.length ? ` de ${data.candidates}` : ''})`}</button>
            {showList && (
              <div className="react-list">
                {data.preview.map((c) => (
                  <div key={c.id} className="row">
                    <Avatar name={c.name} size="sm" />
                    <Link href={`/clientes/${c.id}`} style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block' }}>{c.name}</strong>
                      <small>{c.phone} · última mensagem {relativeTime(c.lastInboundAt)}</small>
                    </Link>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setScheduleFor({ id: c.id, name: c.name })}><CalendarClock size={14} /><span className="hide-mobile">Agendar mensagem</span></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <FormError message={error} />
        {isAdmin ? (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>{saving && <span className="spinner" />}Salvar reativação</button>
          </div>
        ) : <small className="muted">Só o administrador altera a reativação.</small>}
      </div>

      {scheduleFor && (
        <ScheduleMessageModal
          client={scheduleFor}
          onClose={() => setScheduleFor(null)}
          onSaved={() => { setScheduleFor(null); toast('Mensagem agendada.'); onScheduled(); }}
        />
      )}
    </div>
  );
}

// Busca de cliente para agendar mensagem fora do chat.
function ClientPicker({ value, onChange }: { value: Client | null; onChange: (client: Client | null) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Client[]>([]);

  useEffect(() => {
    if (value) return;
    const timer = setTimeout(() => {
      clientsApi.list(search.trim() || undefined).then((list) => setResults(list.filter((c) => c.whatsappId).slice(0, 6))).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [search, value]);

  if (value) {
    return (
      <Field label="Cliente">
        <div className="row card" style={{ padding: '10px 14px', boxShadow: 'none' }}>
          <Avatar name={value.name} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}><strong>{value.name}</strong><small style={{ display: 'block' }}>{value.phone}</small></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Trocar</button>
        </div>
      </Field>
    );
  }
  return (
    <Field label="Cliente">
      <div className="input-icon"><Search size={16} /><input className="input" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="stack-sm" style={{ marginTop: 6 }}>
        {results.map((c) => (
          <button key={c.id} type="button" className="row card" style={{ padding: '8px 12px', boxShadow: 'none', textAlign: 'left' }} onClick={() => onChange(c)}>
            <Avatar name={c.name} size="sm" />
            <span style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{c.name}</strong><small>{c.phone}</small></span>
          </button>
        ))}
        {!results.length && <small className="muted">Nenhum cliente com WhatsApp encontrado.</small>}
      </div>
    </Field>
  );
}

// ============ Follow-up ============
type Unit = 'min' | 'h' | 'd';
const UNIT_MINUTES: Record<Unit, number> = { min: 1, h: 60, d: 1440 };
const splitDelay = (minutes: number): { amount: number; unit: Unit } =>
  minutes % 1440 === 0 ? { amount: minutes / 1440, unit: 'd' } : minutes % 60 === 0 ? { amount: minutes / 60, unit: 'h' } : { amount: minutes, unit: 'min' };

const SUGGESTED: FollowUpStep[] = [
  { delayMinutes: 120, text: 'Oi, {nome}! Ficou alguma dúvida? Se quiser, já te ajudo a escolher um horário.' },
  { delayMinutes: 1440, text: '{nome}, passando para saber se ainda tem interesse. É só responder por aqui!' },
];

function FollowUpTab() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [saved, setSaved] = useState<{ enabled: boolean; steps: FollowUpStep[] } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState<FollowUpStep[]>([]);
  const [max, setMax] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiPlan = useAiPlan();
  const [request, setRequest] = useState('');
  const [writing, setWriting] = useState(false);
  // Mensagens antes da IA, para desfazer.
  const [beforeAi, setBeforeAi] = useState<FollowUpStep[] | null>(null);

  async function writeWithAi() {
    setError(null);
    setWriting(true);
    try {
      // Sem etapas: cria duas (2 horas e 1 dia) para a IA preencher.
      const base = steps.length ? steps : [{ delayMinutes: 120, text: '' }, { delayMinutes: 1440, text: '' }];
      const texts = await followUpApi.write({ request: request.trim() || null, steps: base });
      setBeforeAi(steps);
      setSteps(base.map((s, i) => ({ ...s, text: texts[i] ?? s.text })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWriting(false);
    }
  }

  useEffect(() => {
    followUpApi.get().then((c) => {
      const clean = c.steps.map(({ delayMinutes, text }) => ({ delayMinutes, text }));
      setSaved({ enabled: c.enabled, steps: clean });
      setEnabled(c.enabled);
      setSteps(clean.length ? clean : SUGGESTED);
      setMax(c.maxSteps);
    }).catch((err) => toast(errorMessage(err), true));
  }, [toast]);

  const dirty = Boolean(saved) && JSON.stringify({ enabled, steps }) !== JSON.stringify({ enabled: saved!.enabled, steps: saved!.steps.length ? saved!.steps : SUGGESTED });

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await followUpApi.save({ enabled, steps: steps.map((s) => ({ delayMinutes: s.delayMinutes, text: s.text.trim() })) });
      const clean = result.steps.map(({ delayMinutes, text }) => ({ delayMinutes, text }));
      setSaved({ enabled: result.enabled, steps: clean });
      setSteps(clean.length ? clean : SUGGESTED);
      toast(result.enabled ? 'Follow-up ligado.' : 'Follow-up salvo.');
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled, steps, toast]);

  useUnsavedChanges(isAdmin && dirty, save);

  if (!saved) return <Loading />;

  const update = (i: number, patch: Partial<FollowUpStep>) => {
    setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    if (patch.text !== undefined) setBeforeAi(null);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Follow-up automático</h2><p>Mensagens para quem parou de responder, contadas a partir da última mensagem do cliente.</p></div>
      </div>
      <div className="card-body stack">
        <Switch
          checked={enabled}
          disabled={!isAdmin}
          onChange={setEnabled}
          label="Mandar follow-up pelo WhatsApp"
          description="Só para conversas em que a última mensagem foi do bot ou da equipe. Não vai para quem tem horário marcado, está na etapa de venda fechada do funil, está sendo atendido pela equipe, arquivou a conversa ou respondeu PARAR."
        />
        {isAdmin && (
          <div className="ai-compose">
            <Field
              label="Gerar mensagens com IA"
              hint={aiPlan ? `A IA escreve ${steps.length > 1 ? `as ${steps.length} mensagens` : steps.length ? 'a mensagem' : '2 mensagens (2 horas e 1 dia)'}, cada uma combinando com o tempo de espera. Se já houver texto, ela melhora. Opcional: diga o contexto.` : undefined}
            >
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  value={request}
                  maxLength={300}
                  disabled={!aiPlan || writing}
                  placeholder="Opcional. Ex.: clientes que pediram orçamento de coloração"
                  onChange={(e) => setRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void writeWithAi(); } }}
                />
                <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={writeWithAi} disabled={!aiPlan || writing} title={!aiPlan ? 'Disponível no plano Avançado' : undefined}>
                  {writing ? <span className="spinner" /> : <Sparkles size={15} />}
                  <span className="hide-mobile">{steps.some((s) => s.text.trim()) ? 'Melhorar com IA' : 'Gerar com IA'}</span>
                  {!aiPlan && <AiPlanBadge />}
                </button>
              </div>
            </Field>
            {!aiPlan && <small>Disponível no plano Avançado. No teste grátis e no plano Inicial, escreva as mensagens manualmente.</small>}
            {beforeAi && !writing && (
              <div className="row" style={{ gap: 8 }}>
                <small style={{ flex: 1 }}>Mensagens escritas pela IA. Revise e salve para valer.</small>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSteps(beforeAi); setBeforeAi(null); }}><Undo2 size={14} />Desfazer</button>
              </div>
            )}
          </div>
        )}
        {steps.map((s, i) => {
          const { amount, unit } = splitDelay(s.delayMinutes);
          return (
            <div key={i} className="follow-step">
              <div className="follow-step-head">
                <span className="step-n">{i + 1}</span>
                <div className="delay-input">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={amount}
                    disabled={!isAdmin}
                    onChange={(e) => update(i, { delayMinutes: Math.max(1, Number(e.target.value) || 1) * UNIT_MINUTES[unit] })}
                    aria-label="Tempo"
                  />
                  <select className="select" value={unit} disabled={!isAdmin} onChange={(e) => update(i, { delayMinutes: amount * UNIT_MINUTES[e.target.value as Unit] })} aria-label="Unidade">
                    <option value="min">minutos</option>
                    <option value="h">horas</option>
                    <option value="d">dias</option>
                  </select>
                  <small>sem resposta do cliente</small>
                </div>
                <span className="spacer" />
                {isAdmin && <button type="button" className="icon-btn" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="Tirar mensagem"><Trash2 size={15} /></button>}
              </div>
              <textarea className="textarea" rows={3} value={s.text} maxLength={1000} disabled={!isAdmin || writing} onChange={(e) => update(i, { text: e.target.value })} />
            </div>
          );
        })}
        {isAdmin && steps.length < max && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ justifySelf: 'start' }}
            onClick={() => setSteps((all) => [...all, { delayMinutes: (all[all.length - 1]?.delayMinutes ?? 60) * 2, text: '' }])}
          >
            <Plus size={15} />Mais uma mensagem
          </button>
        )}
        <small className="muted">Use {'{nome}'} para o primeiro nome e {'{empresa}'} para o nome da empresa. Pelo WhatsApp oficial, o follow-up só sai dentro de 24 horas da última mensagem do cliente (regra da Meta). Ao ligar, conversas que já estavam paradas não recebem nada.</small>
        <FormError message={error} />
        {isAdmin ? (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>{saving && <span className="spinner" />}Salvar follow-up</button>
          </div>
        ) : (
          <small className="muted">Só o administrador altera o follow-up.</small>
        )}
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Atendimento />
    </Suspense>
  );
}
