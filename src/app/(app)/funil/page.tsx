'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, Settings2, Trash2, Trophy } from 'lucide-react';
import { TagChips, useStages, useTags } from '@/components/Crm';
import { Avatar, FormError, Loading, Modal, PageHead, useToast } from '@/components/ui';
import { errorMessage, pipelineApi, type PipelineCard, type PipelineStage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/format';

// Cartões por coluna na tela (o resto aparece como "+N"; a busca encontra todos).
const PER_COLUMN = 80;

export default function FunilPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { reload: reloadStages } = useStages();
  const { tags } = useTags();
  const [stages, setStages] = useState<PipelineStage[] | null>(null);
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [search, setSearch] = useState('');
  const [tagId, setTagId] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    pipelineApi.get()
      .then((data) => { setStages(data.stages); setCards(data.clients); setTotal(data.total); setLimit(data.limit); })
      .catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  async function move(clientId: string, stageId: string) {
    const card = cards.find((c) => c.id === clientId);
    if (!card || card.stageId === stageId) return;
    const before = card.stageId;
    setCards((all) => all.map((c) => (c.id === clientId ? { ...c, stageId } : c)));
    try {
      await pipelineApi.move(clientId, stageId);
    } catch (err) {
      setCards((all) => all.map((c) => (c.id === clientId ? { ...c, stageId: before } : c)));
      toast(errorMessage(err), true);
    }
  }

  function onDrop(e: DragEvent, stageId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragging;
    setOver(null);
    setDragging(null);
    if (id) void move(id, stageId);
  }

  if (!stages) return <Loading />;

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const visible = cards.filter((c) =>
    (!tagId || c.tagIds.includes(tagId)) &&
    (!term || c.name.toLowerCase().includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))));
  const won = stages.filter((s) => s.won).map((s) => s.id);
  const wonCount = cards.filter((c) => won.includes(c.stageId)).length;

  return (
    <>
      <PageHead
        eyebrow="Funil de vendas"
        title="Acompanhe cada cliente"
        text={`Arraste os cartões entre as etapas (ou troque a etapa no próprio cartão). ${wonCount} ${wonCount === 1 ? 'cliente fechado' : 'clientes fechados'} de ${cards.length}.`}
        actions={isAdmin ? <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}><Settings2 size={16} />Etapas</button> : undefined}
      />

      <div className="row-wrap" style={{ marginBottom: 16 }}>
        <div className="input-icon" style={{ width: 'min(360px, 100%)' }}>
          <Search size={16} />
          <input className="input" placeholder="Buscar cliente no funil" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {Boolean(tags?.length) && (
          <select className="select" style={{ width: 'auto' }} value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Filtrar por etiqueta">
            <option value="">Todas as etiquetas</option>
            {tags!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {total > limit && <small className="muted">Mostrando os {limit} clientes com conversa mais recente (de {total}).</small>}
      </div>

      <div className="board">
        {stages.map((stage) => {
          const inStage = visible.filter((c) => c.stageId === stage.id);
          return (
            <section
              key={stage.id}
              className={`board-col${over === stage.id ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== stage.id) setOver(stage.id); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => onDrop(e, stage.id)}
              aria-label={stage.name}
            >
              <div className="board-col-head">
                {stage.won && <Trophy size={15} />}
                <strong title={stage.name}>{stage.name}</strong>
                <span>{inStage.length}</span>
              </div>
              <div className="board-col-body">
                {inStage.slice(0, PER_COLUMN).map((c) => (
                  <div
                    key={c.id}
                    className={`board-card${dragging === c.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDragging(c.id); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                  >
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <Link href={`/clientes/${c.id}`} className="person" draggable={false} style={{ flex: 1, minWidth: 0 }}>
                        <Avatar name={c.name} size="sm" />
                        <span style={{ minWidth: 0 }}><strong>{c.name}</strong><small>{c.phone}</small></span>
                      </Link>
                      {c.unreadCount > 0 && <span className="unread" title="Mensagens não lidas">{c.unreadCount}</span>}
                    </div>
                    <TagChips ids={c.tagIds} max={3} />
                    <div className="board-card-foot">
                      <span>{c.lastMessageAt ? relativeTime(c.lastMessageAt) : 'Sem conversa'}</span>
                      {/* Mover sem arrastar (celular e teclado). */}
                      <select className="select stage-select" style={{ height: 26, fontSize: 11, maxWidth: 120 }} value={c.stageId} onChange={(e) => move(c.id, e.target.value)} aria-label={`Mover ${c.name} para`}>
                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {inStage.length > PER_COLUMN && <div className="board-more">+{inStage.length - PER_COLUMN} clientes (use a busca)</div>}
                {!inStage.length && <div className="board-empty">Arraste clientes para cá</div>}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <StagesModal
          stages={stages}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); toast('Etapas salvas.'); load(); void reloadStages(); }}
        />
      )}
    </>
  );
}

type Draft = { id?: string; name: string; won: boolean; key: string };

function StagesModal({ stages, onClose, onSaved }: { stages: PipelineStage[]; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<Draft[]>(stages.map((s) => ({ id: s.id, name: s.name, won: s.won, key: s.id })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removed = stages.filter((s) => !list.some((d) => d.id === s.id));

  const update = (key: string, patch: Partial<Draft>) => setList((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const shift = (index: number, by: number) => setList((all) => {
    const next = [...all];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    return next;
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await pipelineApi.saveStages(list.map(({ id, name, won }) => ({ id, name: name.trim(), won })));
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Etapas do funil"
      description="A primeira etapa recebe os clientes novos. Marque com o troféu a etapa de venda fechada."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || list.some((d) => !d.name.trim())}>{saving && <span className="spinner" />}Salvar etapas</button>
      </>}
    >
      <div className="stack-sm">
        {list.map((d, i) => (
          <div key={d.key} className="stage-row">
            <div className="row" style={{ gap: 2 }}>
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => shift(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
              <button type="button" className="icon-btn" disabled={i === list.length - 1} onClick={() => shift(i, 1)} aria-label="Descer"><ArrowDown size={15} /></button>
            </div>
            <input className="input" value={d.name} maxLength={40} onChange={(e) => update(d.key, { name: e.target.value })} aria-label={`Nome da etapa ${i + 1}`} />
            <button type="button" className={`icon-btn${d.won ? ' bordered' : ''}`} onClick={() => update(d.key, { won: !d.won })} aria-pressed={d.won} title="Venda fechada" aria-label="Venda fechada" style={d.won ? undefined : { color: 'var(--faint)' }}>
              <Trophy size={15} />
            </button>
            <button type="button" className="icon-btn" disabled={list.length <= 2} onClick={() => setList((all) => all.filter((x) => x.key !== d.key))} aria-label="Apagar etapa"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      {list.length < 10 && (
        <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }} onClick={() => setList((all) => [...all, { name: '', won: false, key: `new-${Date.now()}` }])}>
          <Plus size={15} />Nova etapa
        </button>
      )}
      {removed.length > 0 && (
        <p className="muted" style={{ fontSize: 13 }}>Os clientes de {removed.map((s) => `"${s.name}"`).join(', ')} vão para a primeira etapa.</p>
      )}
      <FormError message={error} />
    </Modal>
  );
}
