'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Clock, Pencil, Plus, Sparkles, Trash2, Undo2, Wrench } from 'lucide-react';
import { ConfirmDialog, Empty, Field, FormError, Modal, PageHead, Switch, useToast } from '@/components/ui';
import { errorMessage, servicesApi, type Service } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AiPlanBadge, useAiPlan } from '@/components/AiPlanLock';
import { duration, money, parseMoney } from '@/lib/format';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function ServiceModal({ service, onClose, onSaved }: { service?: Service | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [minutes, setMinutes] = useState(service?.durationMinutes ?? 60);
  const [price, setPrice] = useState(service ? (service.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [active, setActive] = useState(service?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  // Texto antes da IA, para desfazer.
  const [beforeAi, setBeforeAi] = useState<string | null>(null);
  const aiPlan = useAiPlan();

  async function improve() {
    setError(null);
    setImproving(true);
    try {
      const text = await servicesApi.improveDescription({
        name, description: description || null, priceCents: parseMoney(price) || undefined, durationMinutes: Number(minutes) || undefined,
      });
      setBeforeAi(description);
      setDescription(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setImproving(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = { name, description: description || null, durationMinutes: Number(minutes), priceCents: parseMoney(price), active };
      if (service) await servicesApi.update(service.id, input);
      else await servicesApi.create(input);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={service ? 'Editar serviço' : 'Novo serviço'}
      description="O bot oferece os serviços ativos no WhatsApp e usa a duração para encontrar horários livres."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="service-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="service-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Nome do serviço"><input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Consulta, Corte, Aula experimental" /></Field>
        <div className="stack" style={{ gap: 8 }}>
          <Field label="Descrição (opcional)" hint="Aparece para o cliente quando ele pede a lista de serviços no WhatsApp.">
            <textarea className="textarea" maxLength={300} style={{ minHeight: 72 }} value={description} disabled={improving} onChange={(e) => { setDescription(e.target.value); setBeforeAi(null); }} />
          </Field>
          <div className="row-wrap" style={{ gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={improve} disabled={!aiPlan || improving || !name.trim()} title={!aiPlan ? 'Disponível no plano Avançado' : name.trim() ? undefined : 'Preencha o nome do serviço primeiro'}>
              {improving ? <span className="spinner" /> : <Sparkles size={14} />}{description.trim() ? 'Melhorar com IA' : 'Escrever com IA'}{!aiPlan && <AiPlanBadge />}
            </button>
            {!aiPlan && <small>Disponível no plano Avançado. No teste grátis e no plano Inicial, escreva a descrição manualmente.</small>}
            {beforeAi !== null && !improving && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDescription(beforeAi); setBeforeAi(null); }}><Undo2 size={14} />Desfazer</button>
            )}
          </div>
        </div>
        <Field label="Duração">
          <div className="row-wrap">
            <div className="chips">
              {DURATIONS.map((d) => <button key={d} type="button" className={`chip${minutes === d ? ' on' : ''}`} onClick={() => setMinutes(d)}>{duration(d)}</button>)}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" type="number" min={5} max={600} step={5} style={{ width: 96 }} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
              <small>min</small>
            </div>
          </div>
        </Field>
        <Field label="Preço" hint="Deixe em branco ou 0 para “valor sob consulta”.">
          <div className="input-icon"><span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>R$</span>
            <input className="input" style={{ paddingLeft: 46 }} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
          </div>
        </Field>
        <Switch checked={active} onChange={setActive} label="Serviço ativo" description="Serviços inativos não aparecem para o bot nem para novos agendamentos." />
      </form>
    </Modal>
  );
}

export default function ServicosPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);

  const load = useCallback(() => {
    servicesApi.list().then(setServices).catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  async function move(index: number, delta: number) {
    if (!services) return;
    const list = [...services];
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    setServices(list);
    try {
      await Promise.all(list.map((s, position) => (s.position === position ? null : servicesApi.update(s.id, { position }))));
      load();
    } catch (err) {
      toast(errorMessage(err), true);
      load();
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await servicesApi.remove(removing.id);
      toast('Serviço excluído.');
      setRemoving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Serviços"
        title="Catálogo de serviços"
        text="O que sua empresa oferece. A ordem aqui é a ordem em que o bot apresenta as opções no WhatsApp."
        actions={isAdmin && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Novo serviço</button>}
      />

      <div className="card">
        {services === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : !services.length ? (
          <Empty
            icon={<Wrench size={22} />}
            title="Nenhum serviço cadastrado"
            text="Cadastre seus serviços com duração e preço para liberar os agendamentos pelo sistema e pelo bot."
            action={isAdmin && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={15} />Cadastrar serviço</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{isAdmin && <th style={{ width: 70 }}>Ordem</th>}<th>Serviço</th><th>Duração</th><th>Preço</th><th className="hide-mobile">Agendamentos</th><th>Status</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={s.id}>
                    {isAdmin && (
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                          <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === services.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
                        </div>
                      </td>
                    )}
                    <td><strong>{s.name}</strong>{s.description && <small style={{ display: 'block', maxWidth: 380 }}>{s.description}</small>}</td>
                    <td><span className="row" style={{ gap: 6 }}><Clock size={14} className="muted" />{duration(s.durationMinutes)}</span></td>
                    <td className="mono">{s.priceCents ? money(s.priceCents) : <span className="muted">Sob consulta</span>}</td>
                    <td className="hide-mobile mono">{s._count?.appointments ?? 0}</td>
                    <td><span className={`badge ${s.active ? 'solid' : 'dashed'}`}>{s.active ? 'Ativo' : 'Inativo'}</span></td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="icon-btn" onClick={() => setEditing(s)} aria-label="Editar"><Pencil size={16} /></button>
                        <button type="button" className="icon-btn" onClick={() => setRemoving(s)} aria-label="Excluir"><Trash2 size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ServiceModal
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { toast(editing === 'new' ? 'Serviço cadastrado.' : 'Serviço atualizado.'); setEditing(null); load(); }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir serviço?"
          message={`"${removing.name}" sai do catálogo. Agendamentos já feitos continuam com o nome e o valor da época. Se quiser só esconder do bot, desative o serviço.`}
          confirmLabel="Excluir"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
