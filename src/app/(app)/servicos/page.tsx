'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Clock, Package, Pencil, Plus, Sparkles, Tags, Trash2, Undo2 } from 'lucide-react';
import { ConfirmDialog, Empty, Field, FormError, Modal, PageHead, Switch, useToast } from '@/components/ui';
import { errorMessage, servicesApi, type Service, type ServiceKind } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AiPlanBadge, useAiPlan } from '@/components/AiPlanLock';
import { centsToMoneyInput, duration, maskMoney, money, parseMoney } from '@/lib/format';

const DURATIONS = [15, 30, 45, 60, 90, 120];

type Filter = 'ALL' | ServiceKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'SERVICE', label: 'Serviços' },
  { id: 'PRODUCT', label: 'Produtos' },
];

const KINDS: { id: ServiceKind; label: string; text: string }[] = [
  { id: 'SERVICE', label: 'Serviço (com horário)', text: 'Ocupa um horário na agenda. Ex.: corte, maquiagem, consulta.' },
  { id: 'PRODUCT', label: 'Produto (entrega na hora)', text: 'Não tem duração. Entra junto num agendamento ou a equipe vende pela conversa. Ex.: pomada, shampoo.' },
];

function ServiceModal({ service, initialKind = 'SERVICE', onClose, onSaved }: { service?: Service | null; initialKind?: ServiceKind; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<ServiceKind>(service?.kind ?? initialKind);
  const product = kind === 'PRODUCT';
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [minutes, setMinutes] = useState(service?.durationMinutes || 60);
  const [price, setPrice] = useState(service ? centsToMoneyInput(service.priceCents) : '');
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
        kind, name, description: description || null, priceCents: parseMoney(price) || undefined, durationMinutes: product ? undefined : Number(minutes) || undefined,
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
      const input = { kind, name, description: description || null, durationMinutes: product ? 0 : Number(minutes), priceCents: parseMoney(price), active };
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
      title={service ? (product ? 'Editar produto' : 'Editar serviço') : product ? 'Novo produto' : 'Novo serviço'}
      description={product
        ? 'Produtos aparecem no catálogo do bot com preço e descrição. O cliente pode levar junto num agendamento ou pedir para comprar: a equipe finaliza pela conversa.'
        : 'O bot oferece os serviços ativos no WhatsApp e usa a duração para encontrar horários livres.'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="service-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="service-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Tipo">
          <div className="segmented" style={{ width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap' }}>
            {KINDS.map((k) => <button key={k.id} type="button" className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>)}
          </div>
          <small className="hint" style={{ marginTop: 6, display: 'block' }}>{KINDS.find((k) => k.id === kind)!.text}</small>
        </Field>
        <Field label={product ? 'Nome do produto' : 'Nome do serviço'}>
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={product ? 'Ex.: Pomada modeladora, Shampoo, Óleo para barba' : 'Ex.: Consulta, Corte, Aula experimental'} />
        </Field>
        <div className="stack" style={{ gap: 8 }}>
          <Field label="Descrição (opcional)" hint={`Aparece para o cliente quando ele pede a lista de ${product ? 'produtos' : 'serviços'} no WhatsApp.`}>
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
        {!product && (
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
        )}
        <Field label="Preço" hint="Deixe em branco ou 0 para “valor sob consulta”.">
          <div className="input-icon"><span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>R$</span>
            <input className="input" style={{ paddingLeft: 46 }} inputMode="numeric" value={price} onChange={(e) => setPrice(maskMoney(e.target.value))} placeholder="0,00" aria-label="Preço em reais" />
          </div>
        </Field>
        <Switch
          checked={active}
          onChange={setActive}
          label={product ? 'Produto ativo' : 'Serviço ativo'}
          description={product ? 'Produtos inativos não aparecem no catálogo do bot nem para novos agendamentos.' : 'Serviços inativos não aparecem para o bot nem para novos agendamentos.'}
        />
      </form>
    </Modal>
  );
}

export default function ServicosPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<Service | ServiceKind | null>(null);
  const creating = editing === 'SERVICE' || editing === 'PRODUCT';
  const [removing, setRemoving] = useState<Service | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const visible = (services ?? []).filter((s) => filter === 'ALL' || s.kind === filter);
  const count = (f: Filter) => (services ?? []).filter((s) => f === 'ALL' || s.kind === f).length;

  const load = useCallback(() => {
    servicesApi.list().then(setServices).catch((err) => toast(errorMessage(err), true));
  }, [toast]);
  useEffect(load, [load]);

  // Troca de lugar com o vizinho na lista que está aparecendo (com filtro, só
  // entre os itens do mesmo tipo); a ordem geral é a que o bot usa.
  async function move(item: Service, delta: number) {
    if (!services) return;
    const neighbor = visible[visible.indexOf(item) + delta];
    if (!neighbor) return;
    const list = [...services];
    list.splice(list.indexOf(item), 1);
    list.splice(services.indexOf(neighbor), 0, item);
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
      toast(removing.kind === 'PRODUCT' ? 'Produto excluído.' : 'Serviço excluído.');
      setRemoving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Catálogo"
        title="Serviços e produtos"
        text="O que sua empresa oferece. A ordem aqui é a ordem em que o bot apresenta as opções no WhatsApp."
        actions={isAdmin && <>
          <button type="button" className="btn btn-outline" onClick={() => setEditing('PRODUCT')}><Package size={16} />Novo produto</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('SERVICE')}><Plus size={16} />Novo serviço</button>
        </>}
      />

      {Boolean(services?.length) && (
        <div className="segmented" style={{ marginBottom: 16 }}>
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {f.label} <span className="muted" style={{ fontWeight: 500 }}>{count(f.id)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        {services === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : !services.length ? (
          <Empty
            icon={<Tags size={22} />}
            title="Catálogo vazio"
            text="Cadastre seus serviços com duração e preço para liberar os agendamentos pelo sistema e pelo bot. Se vende produtos, cadastre também: eles aparecem no catálogo do bot."
            action={isAdmin && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('SERVICE')}><Plus size={15} />Cadastrar serviço</button>}
          />
        ) : !visible.length ? (
          <Empty
            icon={filter === 'PRODUCT' ? <Package size={22} /> : <Tags size={22} />}
            title={filter === 'PRODUCT' ? 'Nenhum produto cadastrado' : 'Nenhum serviço cadastrado'}
            text={filter === 'PRODUCT'
              ? 'Produtos de pronta entrega aparecem no catálogo do bot e podem entrar junto num agendamento.'
              : 'Serviços têm duração e liberam os agendamentos pelo sistema e pelo bot.'}
            action={isAdmin && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(filter === 'PRODUCT' ? 'PRODUCT' : 'SERVICE')}>
                <Plus size={15} />{filter === 'PRODUCT' ? 'Cadastrar produto' : 'Cadastrar serviço'}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{isAdmin && <th style={{ width: 70 }}>Ordem</th>}<th>Nome</th><th>Duração</th><th>Preço</th><th className="hide-mobile">Agendamentos</th><th>Status</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={s.id}>
                    {isAdmin && (
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === 0} onClick={() => move(s, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                          <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === visible.length - 1} onClick={() => move(s, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
                        </div>
                      </td>
                    )}
                    <td>
                      <strong>{s.name}</strong>
                      {s.kind === 'PRODUCT' && <span className="badge plain soft" style={{ marginLeft: 8 }}><Package size={12} />Produto</span>}
                      {s.description && <small style={{ display: 'block', maxWidth: 380 }}>{s.description}</small>}
                    </td>
                    <td>
                      {s.kind === 'PRODUCT'
                        ? <span className="muted">Entrega na hora</span>
                        : <span className="row" style={{ gap: 6 }}><Clock size={14} className="muted" />{duration(s.durationMinutes)}</span>}
                    </td>
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
          service={creating ? null : editing}
          initialKind={creating ? editing : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { toast(creating ? 'Item cadastrado.' : 'Item atualizado.'); setEditing(null); load(); }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={removing.kind === 'PRODUCT' ? 'Excluir produto?' : 'Excluir serviço?'}
          message={`"${removing.name}" sai do catálogo. Agendamentos já feitos continuam com o nome e o valor da época. Se quiser só esconder do bot, desative em vez de excluir.`}
          confirmLabel="Excluir"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
