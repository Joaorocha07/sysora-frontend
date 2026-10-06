'use client';

import { useState } from 'react';
import { Check, Package, Tag, Trash2, UserRound } from 'lucide-react';
import { ConfirmDialog, useToast } from './ui';
import { errorMessage, soraApi, type SoraCatalogChange, type SoraClientChange } from '@/lib/api';
import { duration, money } from '@/lib/format';

const OP_LABEL = { create: 'Novo', update: 'Alterar', delete: 'Excluir' } as const;

// Mudanças no catálogo e nos clientes propostas pela Sora numa resposta. Só
// entram no sistema quando o dono confirma; se houver exclusão, ainda aparece
// um "Tem certeza?" antes, porque excluir não tem volta.
export function SoraCatalogCard({ messageId, changes = [], clients = [], appliedAt, onApplied }: {
  messageId: string; changes?: SoraCatalogChange[]; clients?: SoraClientChange[]; appliedAt?: string | null; onApplied?: (appliedAt: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(appliedAt ?? null);
  const [confirming, setConfirming] = useState(false);

  const deletions = [
    ...changes.filter((c) => c.op === 'delete').map((c) => c.name),
    ...clients.filter((c) => c.op === 'delete').map((c) => c.name),
  ];
  const deletesClients = clients.some((c) => c.op === 'delete');
  const total = changes.length + clients.length;
  const onlyCatalogCreates = !clients.length && changes.every((c) => c.op === 'create');

  async function apply() {
    setBusy(true);
    try {
      const r = await soraApi.applyCatalog(messageId);
      const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
      const parts = [
        r.created.length && plural(r.created.length, 'cadastrado'),
        r.updated.length && plural(r.updated.length, 'atualizado'),
        r.deleted?.length && plural(r.deleted.length, 'excluído'),
      ].filter(Boolean);
      toast(`${parts.join(', ') || 'Nada mudou'}.${r.skipped?.length ? ` Não encontrei: ${r.skipped.join(', ')}.` : ''}`, Boolean(r.skipped?.length && !parts.length));
      const now = new Date().toISOString();
      setApplied(now);
      setConfirming(false);
      onApplied?.(now);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sora-catalog">
      <strong>{total} {total > 1 ? 'mudanças' : 'mudança'} para confirmar</strong>
      <ul>
        {changes.map((c, i) => (
          <li key={`s${i}`} className={c.op === 'delete' ? 'is-delete' : undefined}>
            {c.op === 'delete' ? <Trash2 size={13} /> : c.kind === 'PRODUCT' ? <Package size={13} /> : <Tag size={13} />}
            <span>
              <b>{OP_LABEL[c.op]}:</b> {c.name}
              {c.op === 'delete'
                ? <small> · {c.kind === 'PRODUCT' ? 'produto' : 'serviço'} será excluído de vez</small>
                : <small> · {c.priceCents ? money(c.priceCents) : 'sem preço'}{c.kind === 'SERVICE' ? ` · ${duration(c.durationMinutes ?? 60)}` : ' · produto'}{c.active === false ? ' · inativo' : ''}</small>}
              {c.op !== 'delete' && c.description && <small style={{ display: 'block' }}>{c.description}</small>}
            </span>
          </li>
        ))}
        {clients.map((c, i) => (
          <li key={`c${i}`} className={c.op === 'delete' ? 'is-delete' : undefined}>
            {c.op === 'delete' ? <Trash2 size={13} /> : <UserRound size={13} />}
            <span>
              <b>{OP_LABEL[c.op]} cliente:</b> {c.name}
              {c.op === 'delete'
                ? <small> · apaga também os agendamentos e as conversas</small>
                : <small>{[c.phone, c.email].filter(Boolean).map((v) => ` · ${v}`).join('')}</small>}
              {c.op !== 'delete' && c.notes && <small style={{ display: 'block' }}>{c.notes}</small>}
            </span>
          </li>
        ))}
      </ul>
      {applied
        ? <small className="row" style={{ gap: 6 }}><Check size={14} />Aplicado em {new Date(applied).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
        : (
          <button
            type="button"
            className={`btn btn-sm ${deletions.length ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => (deletions.length ? setConfirming(true) : void apply())}
            disabled={busy}
          >
            {busy && <span className="spinner" />}
            {deletions.length ? 'Confirmar e excluir' : onlyCatalogCreates ? 'Cadastrar no catálogo' : 'Confirmar mudanças'}
          </button>
        )}
      {confirming && (
        <ConfirmDialog
          title="Tem certeza?"
          danger
          busy={busy}
          confirmLabel={deletions.length > 1 ? `Excluir ${deletions.length} itens` : 'Excluir'}
          message={(
            <>
              {/* O ConfirmDialog já envolve a mensagem num <p>: aqui só elementos de linha. */}
              Isto exclui de vez: <strong>{deletions.join(', ')}</strong>. Não dá para desfazer.
              {deletesClients && <span style={{ display: 'block', marginTop: 8 }}>Os agendamentos e as conversas desses clientes também serão apagados.</span>}
            </>
          )}
          onConfirm={() => void apply()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
