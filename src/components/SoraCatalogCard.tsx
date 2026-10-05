'use client';

import { useState } from 'react';
import { Check, Package, Tag } from 'lucide-react';
import { useToast } from './ui';
import { errorMessage, soraApi, type SoraCatalogChange } from '@/lib/api';
import { duration, money } from '@/lib/format';

// Mudanças no catálogo propostas pela Sora numa resposta. Só entram no
// sistema quando o dono clica em "Cadastrar no catálogo".
export function SoraCatalogCard({ messageId, changes, appliedAt, onApplied }: {
  messageId: string; changes: SoraCatalogChange[]; appliedAt?: string | null; onApplied?: (appliedAt: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(appliedAt ?? null);

  async function apply() {
    setBusy(true);
    try {
      const r = await soraApi.applyCatalog(messageId);
      const parts = [r.created.length && `${r.created.length} cadastrado${r.created.length > 1 ? 's' : ''}`, r.updated.length && `${r.updated.length} atualizado${r.updated.length > 1 ? 's' : ''}`].filter(Boolean);
      toast(`Catálogo: ${parts.join(' e ') || 'nada mudou'}.`);
      const now = new Date().toISOString();
      setApplied(now);
      onApplied?.(now);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sora-catalog">
      <strong>{changes.length} {changes.length > 1 ? 'mudanças' : 'mudança'} no catálogo</strong>
      <ul>
        {changes.map((c, i) => (
          <li key={i}>
            {c.kind === 'PRODUCT' ? <Package size={13} /> : <Tag size={13} />}
            <span>
              <b>{c.op === 'create' ? 'Novo' : 'Alterar'}:</b> {c.name}
              <small> · {c.priceCents ? money(c.priceCents) : 'sem preço'}{c.kind === 'SERVICE' ? ` · ${duration(c.durationMinutes ?? 60)}` : ' · produto'}{c.active === false ? ' · inativo' : ''}</small>
              {c.description && <small style={{ display: 'block' }}>{c.description}</small>}
            </span>
          </li>
        ))}
      </ul>
      {applied
        ? <small className="row" style={{ gap: 6 }}><Check size={14} />Aplicado no catálogo em {new Date(applied).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
        : <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={busy}>{busy && <span className="spinner" />}Cadastrar no catálogo</button>}
    </div>
  );
}
