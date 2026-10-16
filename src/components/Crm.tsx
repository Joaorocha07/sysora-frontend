'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, Check, Plus, Search, Sparkles, StickyNote, Tag as TagIcon, Trash2, Undo2 } from 'lucide-react';
import { AiPlanBadge, useAiPlan } from './AiPlanLock';
import { Empty, Field, FormError, Modal, useToast } from './ui';
import {
  clientsApi, errorMessage, pipelineApi, scheduledMessagesApi, tagsApi,
  type ClientNote, type PipelineStage, type ScheduledMessage, type Tag, type TagColor, type TagRef,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TAG_COLORS, tagHex } from '@/lib/tags';
import { brDate, clock, relativeTime, toIsoDate } from '@/lib/format';

// ============ Etiquetas e etapas compartilhadas entre as telas ============
// Uma carga só por empresa; quem cria/edita chama reload() e todas as telas atualizam.
function sharedStore<T>(load: () => Promise<T>) {
  let value: T | null = null;
  let owner: string | null = null;
  let pending: Promise<void> | null = null;
  const listeners = new Set<(v: T | null) => void>();
  const reload = () => {
    const forCompany = owner;
    pending = load()
      .then((v) => { if (owner !== forCompany) return; value = v; listeners.forEach((fn) => fn(v)); })
      .catch(() => {})
      .finally(() => { pending = null; });
    return pending;
  };
  return function useStore(companyId: string | null) {
    const [state, setState] = useState<T | null>(owner === companyId ? value : null);
    useEffect(() => {
      listeners.add(setState);
      if (companyId && owner !== companyId) {
        // Trocou de empresa: descarta o que era da outra.
        owner = companyId;
        value = null;
        listeners.forEach((fn) => fn(null));
        void reload();
      } else if (value === null && !pending && companyId) {
        void reload();
      } else {
        setState(value);
      }
      return () => { listeners.delete(setState); };
    }, [companyId]);
    return { value: state, reload };
  };
}

const useTagStore = sharedStore(() => tagsApi.list());
const useStageStore = sharedStore(() => pipelineApi.stages());

export function useTags() {
  const { company } = useAuth();
  const { value, reload } = useTagStore(company?.id ?? null);
  return { tags: value, reload };
}
export function useStages() {
  const { company } = useAuth();
  const { value, reload } = useStageStore(company?.id ?? null);
  return { stages: value, reload };
}

// ============ Etiqueta ============
export function TagChip({ tag, onRemove }: { tag: TagRef; onRemove?: () => void }) {
  return (
    <span className="tag colored" style={{ '--tag': tagHex(tag.color) } as CSSProperties}>
      <i />
      {tag.name}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Tirar ${tag.name}`}>×</button>}
    </span>
  );
}

// Etiquetas pelos ids (lista de conversas e funil), na ordem alfabética.
export function TagChips({ ids, tags, max = 3 }: { ids?: string[]; tags?: TagRef[]; max?: number }) {
  const { tags: all } = useTags();
  const list = tags ?? (all ?? []).filter((t) => ids?.includes(t.id));
  if (!list.length) return null;
  return (
    <span className="tag-list">
      {list.slice(0, max).map((t) => <TagChip key={t.id} tag={t} />)}
      {list.length > max && <span className="tag more">+{list.length - max}</span>}
    </span>
  );
}

export function ColorPicker({ value, onChange }: { value: TagColor; onChange: (color: TagColor) => void }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Cor">
      {TAG_COLORS.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={value === c.id} title={c.label} className={value === c.id ? 'on' : ''} style={{ background: c.hex }} onClick={() => onChange(c.id)}>
          {value === c.id && <Check size={13} />}
        </button>
      ))}
    </div>
  );
}

// Lista com busca para marcar etiquetas; cria uma nova com o texto digitado.
function TagPicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { tags, reload } = useTags();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const term = search.trim();
  const shown = (tags ?? []).filter((t) => t.name.toLowerCase().includes(term.toLowerCase()));
  const exact = (tags ?? []).some((t) => t.name.toLowerCase() === term.toLowerCase());

  async function create() {
    if (!term || creating) return;
    setCreating(true);
    try {
      const color = TAG_COLORS[(tags?.length ?? 0) % TAG_COLORS.length].id;
      const tag = await tagsApi.create({ name: term, color });
      await reload();
      onToggle(tag.id);
      setSearch('');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="tag-picker">
      <div className="input-icon">
        <Search size={15} />
        <input
          className="input"
          autoFocus
          placeholder="Buscar ou criar etiqueta"
          value={search}
          maxLength={30}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!exact) void create(); else if (shown[0]) onToggle(shown[0].id); } }}
        />
      </div>
      <div className="tag-picker-list">
        {shown.map((t) => (
          <button key={t.id} type="button" onClick={() => onToggle(t.id)}>
            <span className={`check${selected.includes(t.id) ? ' done' : ''}`}>{selected.includes(t.id) && <Check size={12} />}</span>
            <i style={{ background: tagHex(t.color) }} />
            <span style={{ flex: 1 }}>{t.name}</span>
          </button>
        ))}
        {term && !exact && (
          <button type="button" onClick={create} disabled={creating}>
            {creating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Plus size={15} />}
            Criar &quot;{term}&quot;
          </button>
        )}
        {!shown.length && !term && <p className="muted" style={{ padding: '8px 12px', fontSize: 13 }}>Nenhuma etiqueta ainda. Digite para criar.</p>}
      </div>
    </div>
  );
}

// Botão que abre o seletor e salva as etiquetas do cliente.
export function ClientTagsButton({ clientId, value, onSaved, compact }: { clientId: string; value: string[]; onSaved: (tags: TagRef[]) => void; compact?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function toggle(id: string) {
    const next = value.includes(id) ? value.filter((t) => t !== id) : [...value, id];
    try {
      onSaved(await clientsApi.setTags(clientId, next));
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <TagIcon size={15} />{compact ? <span className="hide-mobile">Etiquetas</span> : 'Etiquetas'}
      </button>
      {open && <div className="menu" style={{ width: 280 }}><TagPicker selected={value} onToggle={toggle} /></div>}
    </div>
  );
}

// ============ Etapa do funil ============
export function StageSelect({ clientId, value, onSaved }: { clientId: string; value: string | null | undefined; onSaved: (stageId: string) => void }) {
  const { stages } = useStages();
  const toast = useToast();
  if (!stages?.length) return null;
  const current = value ?? stages[0].id;
  return (
    <select
      className="select stage-select"
      value={current}
      aria-label="Etapa do funil"
      onChange={async (e) => {
        const stageId = e.target.value;
        try {
          await pipelineApi.move(clientId, stageId);
          onSaved(stageId);
        } catch (err) {
          toast(errorMessage(err), true);
        }
      }}
    >
      {stages.map((s: PipelineStage) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

// ============ Mensagem agendada ============
const pad = (n: number) => String(n).padStart(2, '0');
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function ScheduleMessageModal({ client, message, defaultDate, onClose, onSaved, picker }: {
  client?: { id: string; name: string } | null;
  message?: ScheduledMessage | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (message: ScheduledMessage) => void;
  // Escolha do cliente (tela de mensagens agendadas, sem cliente definido).
  picker?: ReactNode;
}) {
  const start = message ? new Date(message.sendAt) : new Date(Date.now() + 60 * 60 * 1000);
  if (!message) start.setMinutes(0, 0, 0);
  const [date, setDate] = useState(defaultDate && !message ? defaultDate : toIsoDate(start));
  const [time, setTime] = useState(localTime(start));
  const [text, setText] = useState(message?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = message?.clientId ?? client?.id ?? null;
  const aiPlan = useAiPlan();
  const [request, setRequest] = useState('');
  const [writing, setWriting] = useState(false);
  // Texto antes da IA, para desfazer.
  const [beforeAi, setBeforeAi] = useState<string | null>(null);

  async function writeWithAi() {
    if (!clientId) { setError('Escolha o cliente primeiro.'); return; }
    setError(null);
    setWriting(true);
    try {
      const sendAt = date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
      const result = await scheduledMessagesApi.write({ clientId, request: request.trim(), draft: text.trim() || null, sendAt });
      setBeforeAi(text);
      setText(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWriting(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Escolha o cliente.'); return; }
    setSaving(true);
    setError(null);
    try {
      const sendAt = new Date(`${date}T${time}:00`).toISOString();
      const saved = message
        ? await scheduledMessagesApi.update(message.id, { text: text.trim(), sendAt })
        : await scheduledMessagesApi.create({ clientId, text: text.trim(), sendAt });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={message ? 'Editar mensagem agendada' : 'Agendar mensagem'}
      description={client || message ? `Para ${message?.client.name ?? client?.name}, pelo WhatsApp conectado.` : 'Ela sai pelo WhatsApp conectado no dia e hora escolhidos.'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="schedule-form" className="btn btn-primary" disabled={saving || !text.trim() || !clientId}>
          {saving && <span className="spinner" />}<CalendarClock size={16} />{message ? 'Salvar' : 'Agendar'}
        </button>
      </>}
    >
      <form id="schedule-form" className="stack" onSubmit={submit}>
        {picker}
        <div className="grid-2">
          <Field label="Dia"><input className="input" type="date" value={date} min={toIsoDate(new Date())} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="Hora"><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
        </div>
        <div className="ai-compose">
          <Field label="Gerar com IA" hint={aiPlan ? 'A IA usa o nome do cliente, o próximo horário marcado, a data do envio e os dados da empresa. O que ela não souber fica entre [colchetes].' : undefined}>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                value={request}
                maxLength={300}
                disabled={!aiPlan || writing}
                placeholder="Sobre o que é? Ex.: lembrar do retorno e oferecer horário"
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (request.trim().length >= 3 && clientId) void writeWithAi(); } }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
                onClick={writeWithAi}
                disabled={!aiPlan || writing || request.trim().length < 3 || !clientId}
                title={!aiPlan ? 'Disponível no plano Avançado' : !clientId ? 'Escolha o cliente primeiro' : request.trim().length < 3 ? 'Diga sobre o que é a mensagem' : undefined}
              >
                {writing ? <span className="spinner" /> : <Sparkles size={15} />}
                <span className="hide-mobile">{text.trim() ? 'Melhorar com IA' : 'Gerar com IA'}</span>
                {!aiPlan && <AiPlanBadge />}
              </button>
            </div>
          </Field>
          {!aiPlan && <small>Disponível no plano Avançado. No teste grátis e no plano Inicial, escreva a mensagem manualmente.</small>}
          {beforeAi !== null && !writing && (
            <div className="row" style={{ gap: 8 }}>
              <small style={{ flex: 1 }}>Texto escrito pela IA. Revise antes de agendar.</small>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setText(beforeAi); setBeforeAi(null); }}><Undo2 size={14} />Desfazer</button>
            </div>
          )}
        </div>
        <Field label="Mensagem" hint="Se o WhatsApp estiver desconectado na hora, a mensagem tenta sair por até 6 horas.">
          <textarea className="textarea" rows={5} value={text} maxLength={4096} disabled={writing} onChange={(e) => { setText(e.target.value); setBeforeAi(null); }} placeholder="Ex.: Oi! Passando para lembrar que a promoção termina amanhã." required />
        </Field>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

export const SCHEDULED_STATUS: Record<ScheduledMessage['status'], { label: string; badge: string }> = {
  PENDING: { label: 'Agendada', badge: '' },
  SENT: { label: 'Enviada', badge: 'solid' },
  FAILED: { label: 'Falhou', badge: 'dashed' },
  CANCELED: { label: 'Cancelada', badge: 'strike' },
};

export const scheduledWhen = (iso: string) => `${brDate(toIsoDate(new Date(iso)))} às ${clock(iso)}`;

// ============ Anotações da ficha do cliente ============
export function ClientNotesCard({ clientId }: { clientId: string }) {
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const [notes, setNotes] = useState<ClientNote[] | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { clientsApi.notes(clientId).then(setNotes).catch(() => setNotes([])); }, [clientId]);
  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const note = await clientsApi.addNote(clientId, text.trim());
      setNotes((all) => [note, ...(all ?? [])]);
      setText('');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(note: ClientNote) {
    try {
      await clientsApi.removeNote(clientId, note.id);
      setNotes((all) => (all ?? []).filter((n) => n.id !== note.id));
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  return (
    <div className="card">
      <div className="card-head"><div><h2>Anotações</h2><p>Histórico do que a equipe registrou sobre o cliente</p></div></div>
      <form className="card-body stack-sm" onSubmit={add} style={{ paddingBottom: 12 }}>
        <textarea className="textarea" rows={2} placeholder="Ex.: Prefere horários depois das 18h. Pediu orçamento de coloração." value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" disabled={saving || !text.trim()}>{saving && <span className="spinner" />}<Plus size={15} />Anotar</button>
        </div>
      </form>
      {notes === null ? (
        <div className="loading-screen" style={{ minHeight: 80 }}><span className="spinner" /></div>
      ) : notes.length ? (
        <div className="notes">
          {notes.map((n) => (
            <div key={n.id} className="note">
              <p>{n.text}</p>
              <small>{n.authorName} · {relativeTime(n.createdAt)}</small>
              {(isAdmin || n.authorId === user?.id) && (
                <button type="button" className="icon-btn" onClick={() => remove(n)} aria-label="Apagar anotação"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<StickyNote size={22} />} title="Nenhuma anotação" text="Registre preferências, combinados e o que foi conversado." />
      )}
    </div>
  );
}
