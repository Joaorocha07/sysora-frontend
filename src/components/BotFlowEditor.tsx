'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Clock, CornerDownLeft, Flag, Hand, ImageOff, KeyRound, Link2, ListTree, MessageSquare, PenLine, Play, Plus, RotateCcw, Save, Send,
  Sparkles, Tag, Trash2, TriangleAlert, Undo2, Zap,
} from 'lucide-react';
import { ConfirmDialog, Field, Loading, Modal, useToast } from '@/components/ui';
import { useConfirmLeave, useUnsavedChanges } from '@/components/UnsavedChanges';
import { AiPlanBadge, AiPlanNotice, soraPercent, useAiPlan, useSoraPlan } from '@/components/AiPlanLock';
import {
  SORA_FLOW_DRAFT_KEY, errorMessage, servicesApi, settingsApi, soraApi, whatsappApi,
  type BotFlow, type BotFlowSummary, type FlowAction, type FlowNode, type FlowNodeType, type FlowTemplate, type Service, type Settings, type SoraStoredMessage, type SoraUsage,
} from '@/lib/api';
import { SoraCatalogCard } from '@/components/SoraCatalogCard';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';

// Editor visual do fluxo do bot: a árvore de menus vira um fluxograma da
// esquerda para a direita. Clicar numa etapa abre o editor; o simulador ao
// lado mostra a conversa como o cliente vai receber. Regras iguais às do
// backend (sysora-backend/src/modules/whatsapp/whatsapp.flow.ts).
// As funções do sistema puxam uma seta para um resumo dos dados reais que
// usam (serviços, horários). O fluxo pode ser montado à mão ou conversando
// com a Sora (IA), que devolve um rascunho para revisar antes de salvar.
// A empresa guarda até 5 fluxos (barra "Seus fluxos"); o que está em uso é o
// que o WhatsApp usa, os outros ficam guardados para testar e trocar.

const MAX_OPTIONS = 9;
const MAX_MESSAGES = 5;
const MAX_DEPTH = 6;
const BACK_OPTION = '0) Voltar ao menu principal';

const TYPES: Record<FlowNodeType, { label: string; hint: string; icon: typeof Zap }> = {
  menu: { label: 'Submenu', hint: 'Mostra novas opções para o cliente escolher.', icon: ListTree },
  message: { label: 'Mensagem', hint: 'Envia um texto e volta para um menu.', icon: MessageSquare },
  action: { label: 'Função do sistema', hint: 'Agendamento, horários do cliente, serviços ou equipe.', icon: Zap },
  end: { label: 'Encerrar', hint: 'Envia uma despedida e finaliza o atendimento.', icon: Flag },
};

const ACTIONS: Record<FlowAction, { label: string; flow: string; sample: string }> = {
  agendar: { label: 'Agendar um horário', flow: 'Serviço → dia → horário → agendado', sample: 'Qual serviço você deseja? Responda com o número:\n\n1) Corte\n2) Escova\n…' },
  link: { label: 'Agendar pelo link', flow: 'Manda o link pessoal da agenda; o cliente escolhe serviço, dia e horário na página', sample: 'Para agendar, toque no link abaixo e escolha o serviço, o dia e o horário que ficam melhor para você:\n\nhttps://sysora.com.br/agendar/…' },
  meus: { label: 'Meus agendamentos', flow: 'Confirmar, remarcar ou cancelar', sample: 'Seu próximo horário: Corte na sexta, 10/10 às 14:00.\n\n1) Confirmar presença\n2) Remarcar\n3) Cancelar' },
  servicos: { label: 'Serviços e valores', flow: 'Lista serviços e produtos com preços', sample: 'Nossos serviços:\n\n• Corte: R$ 50,00 (30 min)\n…' },
  equipe: { label: 'Falar com a equipe', flow: 'Bot pausa e a equipe assume', sample: '(mensagem de transferência da aba Atendimento humano)' },
  codigo: { label: 'Receber código de acesso', flow: 'Busca o código no e-mail liberado para o cliente', sample: 'Seu código:\n\n*482913*\n(recebido às 14:32)' },
  trocar: { label: 'Não consigo gerar imagem', flow: 'Troca o cliente para outra conta e manda o código', sample: 'Troquei a sua conta. Seu acesso continua até 03/11/2026.\n\nSua nova conta é:\n*conta@gmail.com*' },
};

const newId = () => Math.random().toString(36).slice(2, 10);

// Dados reais mostrados ao lado das funções do sistema.
type FlowData = { services: Service[]; settings: Settings | null };
const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// [1,2,3,4,5,6] -> "Seg a Sáb"; dias soltos -> "Seg, Qua, Sex".
function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (!sorted.length) return 'Nenhum dia';
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return consecutive && sorted.length > 2 ? `${SHORT_DAYS[sorted[0]]} a ${SHORT_DAYS[sorted[sorted.length - 1]]}` : sorted.map((d) => SHORT_DAYS[d]).join(', ');
}

function mapTree(root: FlowNode, id: string, fn: (node: FlowNode) => FlowNode): FlowNode {
  if (root.id === id) return fn(root);
  if (!root.options) return root;
  return { ...root, options: root.options.map((child) => mapTree(child, id, fn)) };
}

function findWithParent(root: FlowNode, id: string, parent: FlowNode | null = null, depth = 0): { node: FlowNode; parent: FlowNode | null; depth: number } | null {
  if (root.id === id) return { node: root, parent, depth };
  for (const child of root.options ?? []) {
    const found = findWithParent(child, id, root, depth + 1);
    if (found) return found;
  }
  return null;
}

// Só os campos que valem para o tipo escolhido (o backend recusa menu sem opções etc.).
function clean(node: FlowNode): FlowNode {
  const base = { id: node.id, label: node.label.trim(), type: node.type, messages: node.messages.map((m) => m.trim()).filter(Boolean), together: node.together };
  if (node.type === 'menu') return { ...base, prompt: node.prompt?.trim() || 'Responda com o número:', options: (node.options ?? []).map(clean) };
  if (node.type === 'action') return { ...base, action: node.action ?? 'agendar' };
  if (node.type === 'message') return { ...base, next: node.next ?? 'menu' };
  return base;
}

function problemsOf(node: FlowNode, isRoot: boolean): string[] {
  const list: string[] = [];
  if (!isRoot && !node.label.trim()) list.push('Falta o texto da opção.');
  if (node.type === 'menu' && !node.options?.length) list.push('Adicione ao menos uma opção.');
  if (node.type === 'message' && !node.messages.some((m) => m.trim())) list.push('Escreva ao menos uma mensagem.');
  return list;
}

function allProblems(root: FlowNode): { id: string; label: string; problem: string }[] {
  const out: { id: string; label: string; problem: string }[] = [];
  const walk = (node: FlowNode, isRoot: boolean) => {
    problemsOf(node, isRoot).forEach((problem) => out.push({ id: node.id, label: isRoot ? 'Boas-vindas' : node.label || 'Opção sem nome', problem }));
    if (node.type === 'menu') node.options?.forEach((c) => walk(c, false));
  };
  walk(root, true);
  return out;
}

type Vars = { nome: string; empresa: string };
const fill = (text: string, vars: Vars) => text.replace(/\{(nome|empresa)\}/gi, (_, k: string) => vars[k.toLowerCase() as keyof Vars]);

function menuText(menu: FlowNode, isRoot: boolean, vars: Vars) {
  return [
    fill(menu.prompt || 'Responda com o número:', vars),
    (menu.options ?? []).map((o, i) => `${i + 1}) ${fill(o.label || '…', vars)}`).join('\n'),
    !isRoot && BACK_OPTION,
  ].filter(Boolean).join('\n\n');
}

type Bubble = { text: string; system?: boolean };

// O que o cliente recebe ao entrar na etapa e em qual menu ele fica depois.
function bubblesOf(root: FlowNode, node: FlowNode, parent: FlowNode | null, vars: Vars): { bubbles: Bubble[]; menu: FlowNode | null } {
  const messages = node.messages.filter((m) => m.trim()).map((m) => fill(m, vars));
  const pack = (parts: string[]): Bubble[] => (node.together ? (parts.length ? [{ text: parts.join('\n\n') }] : []) : parts.map((text) => ({ text })));
  if (node.type === 'menu') return { bubbles: pack([...messages, menuText(node, node.id === root.id, vars)]), menu: node };
  if (node.type === 'message') {
    const target = node.next === 'parent' && parent ? parent : root;
    return { bubbles: pack([...messages, menuText(target, target.id === root.id, vars)]), menu: target };
  }
  if (node.type === 'end') return { bubbles: [...pack(messages), { text: 'Atendimento finalizado. Uma nova mensagem do cliente recomeça pelas boas-vindas.', system: true }], menu: null };
  const sample = ACTIONS[node.action ?? 'agendar'].sample;
  const bubbles = node.together ? [{ text: [...messages, sample].join('\n\n') }] : [...messages.map((text) => ({ text })), { text: sample }];
  return { bubbles: [...bubbles, { text: `Daqui em diante o sistema conduz: ${ACTIONS[node.action ?? 'agendar'].flow}.`, system: true }], menu: null };
}

export function BotFlowEditor() {
  const toast = useToast();
  const { company } = useAuth();
  // Sora: planos pagos. Teste com texto livre (IA do atendimento): só no Avançado pago.
  const ai = useAiPlan();
  const sora = useSoraPlan();
  const [saved, setSaved] = useState<FlowNode | null>(null);
  const [flow, setFlow] = useState<FlowNode | null>(null);
  // Fluxos da empresa e o que está aberto no editor.
  const [flows, setFlows] = useState<BotFlowSummary[]>([]);
  const [maxFlows, setMaxFlows] = useState(5);
  const [current, setCurrent] = useState<BotFlowSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmLeave = useConfirmLeave();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'manual' | 'sora'>('manual');
  const [data, setData] = useState<FlowData>({ services: [], settings: null });
  // Fluxo antes da última mudança da Sora, para desfazer.
  const [beforeSora, setBeforeSora] = useState<FlowNode | null>(null);

  // Abre um fluxo no editor.
  const open = (r: BotFlow) => {
    const { flow: tree, ...summary } = r;
    setCurrent(summary);
    setSaved(tree);
    setFlow(tree);
    setEditing(null);
    setBeforeSora(null);
  };
  const currentRef = useRef<BotFlowSummary | null>(null);
  currentRef.current = current;

  useEffect(() => {
    whatsappApi.flows().then(async (list) => {
      setFlows(list.flows);
      setMaxFlows(list.max);
      const active = list.flows.find((f) => f.active) ?? list.flows[0];
      const r = await whatsappApi.getFlow(active.id);
      open(r);
      // Veio do menu Sora com um fluxo proposto: abre como rascunho (não salvo) no fluxo em uso.
      let draft: FlowNode | null = null;
      try {
        const raw = sessionStorage.getItem(SORA_FLOW_DRAFT_KEY);
        sessionStorage.removeItem(SORA_FLOW_DRAFT_KEY);
        draft = raw ? (JSON.parse(raw) as FlowNode) : null;
      } catch { /* sem storage */ }
      setFlow(draft ?? r.flow);
      if (draft) toast('Fluxo da Sora aberto como rascunho. Revise e clique em Salvar fluxo.');
    }).catch((err) => toast(errorMessage(err), true));
    Promise.all([servicesApi.list(), settingsApi.get()])
      .then(([services, r]) => setData({ services: services.filter((s) => s.active), settings: r.settings }))
      .catch(() => {});
    // open só usa setters do estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const vars = useMemo<Vars>(() => ({ nome: 'Maria', empresa: company?.name ?? 'Sua empresa' }), [company?.name]);

  const dirty = Boolean(flow && saved) && JSON.stringify(flow) !== JSON.stringify(saved);
  // Fluxo mudado em outro lugar (outra aba, outra pessoa): ao voltar para a
  // tela sem alterações pendentes, recarrega o salvo, para o editor e o teste
  // serem fiéis ao que o WhatsApp usa.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible' || dirtyRef.current) return;
      const openId = currentRef.current?.id;
      if (!openId) return;
      whatsappApi.flows().then((list) => setFlows(list.flows)).catch(() => {});
      whatsappApi.getFlow(openId).then((r) => {
        if (dirtyRef.current || currentRef.current?.id !== r.id) return;
        setSaved((prev) => (JSON.stringify(prev) === JSON.stringify(r.flow) ? prev : r.flow));
        setFlow((prev) => (JSON.stringify(prev) === JSON.stringify(r.flow) ? prev : r.flow));
        setCurrent({ id: r.id, name: r.name, active: r.active, updatedAt: r.updatedAt });
      }).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  // Inclui o rascunho da Sora: sair sem salvar pede confirmação (UnsavedChanges).
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  useUnsavedChanges(dirty, () => saveRef.current());

  if (!flow || !saved || !current) return <Loading />;
  const problems = allProblems(flow);
  const editTarget = editing ? findWithParent(flow, editing) : null;

  function addOption(menuId: string) {
    const id = newId();
    setFlow((f) => f && mapTree(f, menuId, (m) => ({ ...m, options: [...(m.options ?? []), { id, label: '', type: 'message', messages: [''], together: true, next: 'menu' }] })));
    setEditing(id);
  }

  async function save(): Promise<boolean> {
    if (!flow || !current) return false;
    if (problems.length) {
      toast(`${problems[0].label}: ${problems[0].problem}`, true);
      return false;
    }
    setBusy(true);
    try {
      const r = await whatsappApi.saveFlow(current.id, { flow: clean(flow) });
      setSaved(r.flow); setFlow(r.flow);
      toast(r.active ? 'Fluxo salvo. O bot já está usando a nova versão.' : 'Fluxo salvo. Para o bot usar, clique em “Usar no WhatsApp”.');
      return true;
    } catch (err) {
      toast(errorMessage(err), true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  saveRef.current = save;

  // Troca de fluxo: com alterações não salvas, pergunta antes (UnsavedChanges).
  function switchTo(id: string) {
    if (id === current?.id) return;
    confirmLeave(() => {
      whatsappApi.getFlow(id).then(open).catch((err) => toast(errorMessage(err), true));
    });
  }

  async function createFlow(template: FlowTemplate, name: string) {
    setBusy(true);
    try {
      const r = await whatsappApi.createFlow(template, name);
      setFlows((list) => [...list, { id: r.id, name: r.name, active: r.active, updatedAt: r.updatedAt }]);
      open(r);
      setCreating(false);
      toast('Fluxo criado. Monte as etapas e salve; depois clique em “Usar no WhatsApp”.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  // Coloca o fluxo aberto em uso no WhatsApp (salvando antes, se preciso).
  async function activate() {
    if (!current) return;
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      const list = await whatsappApi.activateFlow(current.id);
      setFlows(list.flows);
      setCurrent((c) => c && { ...c, active: true });
      toast(`“${current.name}” agora é o fluxo do WhatsApp.`);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function rename(name: string) {
    if (!current) return;
    setBusy(true);
    try {
      const r = await whatsappApi.saveFlow(current.id, { name });
      setFlows((list) => list.map((f) => (f.id === r.id ? { ...f, name: r.name } : f)));
      setCurrent((c) => c && { ...c, name: r.name });
      setRenaming(false);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!current) return;
    setBusy(true);
    try {
      const list = await whatsappApi.deleteFlow(current.id);
      setFlows(list.flows);
      const active = list.flows.find((f) => f.active) ?? list.flows[0];
      open(await whatsappApi.getFlow(active.id));
      toast('Fluxo apagado.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="stack">
      <div className="card card-pad stack-sm">
        <div>
          <h3>Seus fluxos</h3>
          <p className="muted" style={{ marginTop: 4 }}>Até {maxFlows} fluxos. O que está <strong>em uso</strong> é o que o bot usa no WhatsApp; os outros ficam guardados para você testar e trocar quando quiser.</p>
        </div>
        <div className="flow-tabs" role="tablist">
          {flows.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={f.id === current.id} className={`flow-tab${f.id === current.id ? ' on' : ''}`} onClick={() => switchTo(f.id)}>
              {f.active && <span className="flow-tab-dot" title="Em uso no WhatsApp" />}
              {f.name}
              {f.active && <small>em uso</small>}
            </button>
          ))}
          {flows.length < maxFlows && (
            <button type="button" className="flow-tab add" onClick={() => confirmLeave(() => setCreating(true))} title="Criar um fluxo novo"><Plus size={15} />Novo fluxo</button>
          )}
        </div>
        <div className="row-wrap">
          {current.active
            ? <span className="badge plain solid"><CheckCircle2 size={13} />Em uso no WhatsApp</span>
            : <button type="button" className="btn btn-primary btn-sm" onClick={activate} disabled={busy || problems.length > 0} title={problems.length ? 'Ajuste o fluxo antes de usar' : undefined}><CheckCircle2 size={14} />Usar no WhatsApp</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(true)} disabled={busy}><PenLine size={14} />Renomear</button>
          {!current.active && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} />Apagar</button>}
        </div>
      </div>

      <div className="card card-pad stack">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3>{current.name}: como o bot conversa</h3>
            <p className="muted" style={{ marginTop: 4 }}>Clique numa etapa para editar. Cada opção de um menu vira um número que o cliente responde. Use {'{nome}'} e {'{empresa}'} nos textos.</p>
            <div className="segmented" style={{ marginTop: 12, width: 'fit-content' }}>
              <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Montar manual</button>
              <button type="button" className={mode === 'sora' ? 'on' : ''} onClick={() => setMode('sora')}><Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Criar com a Sora{!sora && <AiPlanBadge paid />}</button>
            </div>
          </div>
          <div className="row-wrap">
            {dirty && <small>Alterações não salvas</small>}
            <button type="button" className="btn btn-outline" disabled={!dirty || busy} onClick={() => setFlow(saved)}>Descartar</button>
            <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? <span className="spinner" /> : <Save size={16} />}Salvar fluxo</button>
          </div>
        </div>
        <div className="flow-legend">
          {(Object.keys(TYPES) as FlowNodeType[]).map((t) => {
            const Icon = TYPES[t].icon;
            return <span key={t} className={`flow-type t-${t}`}><Icon size={13} />{TYPES[t].label}</span>;
          })}
        </div>
      </div>

      {mode === 'sora' && !sora && (
        <div className="card card-pad"><AiPlanNotice paid feature="A Sora, IA que monta o fluxo para você," /></div>
      )}

      {mode === 'sora' && sora && (
        <SoraPanel
          flow={flow}
          problems={problems}
          canUndo={Boolean(beforeSora)}
          onDraft={(next) => { setBeforeSora(flow); setFlow(next); setEditing(null); }}
          onUndo={() => { if (beforeSora) { setFlow(beforeSora); setBeforeSora(null); } }}
        />
      )}

      <div className="flow-layout">
        <div className="card flow-canvas">
          <FlowBranch node={flow} index={null} isRoot depth={0} data={data} onEdit={setEditing} onAdd={addOption} />
        </div>
        {/* Fluxo guardado (fora de uso): o teste usa o fluxo desta tela, não o do WhatsApp. */}
        <Simulator key={`${current.id}:${JSON.stringify(flow)}`} root={flow} draft={dirty || !current.active} vars={vars} ai={ai} />
      </div>

      {dirty && (
        <div className="flow-savebar">
          <span>{problems.length ? `Falta ajustar: ${problems[0].label}` : 'Alterações não salvas'}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setFlow(saved)}>Descartar</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : <Save size={14} />}Salvar fluxo</button>
        </div>
      )}

      {editTarget && (
        <NodeEditor
          root={flow}
          node={editTarget.node}
          parent={editTarget.parent}
          depth={editTarget.depth}
          vars={vars}
          codesEnabled={Boolean(data.settings?.emailCodesEnabled)}
          onClose={() => setEditing(null)}
          onApply={(next) => { setFlow((f) => f && mapTree(f, next.id, () => next)); setEditing(null); }}
          onRemove={() => {
            const parentId = editTarget.parent?.id;
            if (!parentId) return;
            setFlow((f) => f && mapTree(f, parentId, (m) => ({ ...m, options: m.options?.filter((o) => o.id !== editTarget.node.id) })));
            setEditing(null);
          }}
          onMove={(dir) => {
            const parentId = editTarget.parent?.id;
            if (!parentId) return;
            setFlow((f) => f && mapTree(f, parentId, (m) => {
              const options = [...(m.options ?? [])];
              const i = options.findIndex((o) => o.id === editTarget.node.id);
              const j = i + dir;
              if (j < 0 || j >= options.length) return m;
              [options[i], options[j]] = [options[j], options[i]];
              return { ...m, options };
            }));
          }}
        />
      )}

      {creating && <NewFlowModal busy={busy} onClose={() => setCreating(false)} onCreate={createFlow} />}
      {renaming && <RenameFlowModal name={current.name} busy={busy} onClose={() => setRenaming(false)} onSave={rename} />}
      {confirmDelete && (
        <ConfirmDialog
          title={`Apagar “${current.name}”?`}
          message="O fluxo some da lista. O fluxo em uso no WhatsApp não muda."
          confirmLabel="Apagar"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

// ---------- Novo fluxo e renomear ----------

const NEW_FLOW_TEMPLATES: { id: FlowTemplate; label: string; hint: string; icon: typeof Zap }[] = [
  { id: 'vazio', label: 'Do zero', hint: 'Só as boas-vindas e uma opção. Você monta o resto.', icon: Plus },
  { id: 'padrao', label: 'Padrão', hint: 'Agendar pela conversa, meus agendamentos, serviços e equipe.', icon: ListTree },
  { id: 'link', label: 'Agendamento pelo link', hint: 'Igual ao padrão, mas agendar manda o link da agenda.', icon: Link2 },
];

function NewFlowModal({ busy, onClose, onCreate }: { busy: boolean; onClose: () => void; onCreate: (template: FlowTemplate, name: string) => void }) {
  const [template, setTemplate] = useState<FlowTemplate>('vazio');
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); onCreate(template, name.trim()); };
  return (
    <Modal
      title="Novo fluxo"
      description="O fluxo novo fica guardado até você clicar em “Usar no WhatsApp”."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="new-flow" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Criar fluxo</button>
      </>}
    >
      <form id="new-flow" className="stack" onSubmit={submit}>
        <Field label="Nome do fluxo"><input className="input" maxLength={40} value={name} placeholder={template === 'vazio' ? 'Ex.: Promoção de dezembro' : NEW_FLOW_TEMPLATES.find((t) => t.id === template)!.label} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="field">
          <span>Começar de</span>
          <div className="stack-sm">
            {NEW_FLOW_TEMPLATES.map(({ id, label, hint, icon: Icon }) => (
              <button key={id} type="button" className={`booking-option${template === id ? ' on' : ''}`} onClick={() => setTemplate(id)} aria-pressed={template === id}>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <span className="metric-icon" style={{ flex: 'none' }}><Icon size={16} /></span>
                  <span style={{ minWidth: 0 }}><strong>{label}</strong><small>{hint}</small></span>
                </span>
                <span className="booking-check">{template === id && <CheckCircle2 size={14} />}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function RenameFlowModal({ name, busy, onClose, onSave }: { name: string; busy: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const submit = (e: FormEvent) => { e.preventDefault(); if (value.trim()) onSave(value.trim()); };
  return (
    <Modal
      title="Renomear fluxo"
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="rename-flow" className="btn btn-primary" disabled={busy || !value.trim()}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="rename-flow" onSubmit={submit}>
        <Field label="Nome do fluxo"><input className="input" required maxLength={40} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

function FlowBranch({ node, index, isRoot, depth, data, onEdit, onAdd }: {
  node: FlowNode; index: number | null; isRoot?: boolean; depth: number; data: FlowData; onEdit: (id: string) => void; onAdd: (menuId: string) => void;
}) {
  const isMenu = node.type === 'menu';
  return (
    <div className="flow-branch">
      <FlowCard node={node} index={index} isRoot={isRoot} onEdit={onEdit} />
      {node.type === 'action' && (
        <div className="flow-data-link t-action">
          <ActionData action={node.action ?? 'agendar'} data={data} />
        </div>
      )}
      {isMenu && (
        <div className="flow-children">
          {(node.options ?? []).map((child, i) => (
            <div key={child.id} className="flow-child">
              <FlowBranch node={child} index={i + 1} depth={depth + 1} data={data} onEdit={onEdit} onAdd={onAdd} />
            </div>
          ))}
          {(node.options?.length ?? 0) < MAX_OPTIONS && (
            <div className="flow-child">
              <button type="button" className="flow-add" onClick={() => onAdd(node.id)}><Plus size={15} />Adicionar opção</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlowCard({ node, index, isRoot, onEdit }: { node: FlowNode; index: number | null; isRoot?: boolean; onEdit: (id: string) => void }) {
  const type = TYPES[node.type];
  const Icon = type.icon;
  const messages = node.messages.filter((m) => m.trim());
  const problems = problemsOf(node, Boolean(isRoot));

  let footer: ReactNode = null;
  if (node.type === 'message') footer = <><CornerDownLeft size={12} />{node.next === 'parent' ? 'Volta ao menu anterior' : 'Volta ao menu principal'}</>;
  else if (node.type === 'end') footer = <><Flag size={12} />Fim da conversa</>;
  else if (node.type === 'action') footer = <><Zap size={12} />{ACTIONS[node.action ?? 'agendar'].flow}</>;

  return (
    <button type="button" className={`flow-card t-${node.type}${problems.length ? ' invalid' : ''}`} onClick={() => onEdit(node.id)}>
      <span className="flow-card-head">
        {index !== null && <span className="flow-num">{index}</span>}
        <span className={`flow-type t-${node.type}`}><Icon size={12} />{isRoot ? 'Boas-vindas' : type.label}</span>
        {messages.length > 1 && <span className="flow-mode">{node.together ? 'juntas' : 'separadas'}</span>}
      </span>
      <strong>{isRoot ? 'Início da conversa' : node.label || 'Opção sem nome'}</strong>
      {messages[0] && <span className="flow-msg">{messages[0]}</span>}
      {messages.length > 1 && <small>+{messages.length - 1} mensage{messages.length > 2 ? 'ns' : 'm'}</small>}
      {node.type === 'action' && !messages.length && <span className="flow-msg">{ACTIONS[node.action ?? 'agendar'].label}</span>}
      {problems.length > 0 && <span className="flow-warn"><TriangleAlert size={12} />{problems[0]}</span>}
      {footer && <span className="flow-foot">{footer}</span>}
    </button>
  );
}

// Resumo curto dos dados reais que a função usa, ao lado da caixa (pela seta).
function ActionData({ action, data }: { action: FlowAction; data: FlowData }) {
  const { settings } = data;
  // Agendar só oferece serviços; a lista de valores mostra também os produtos.
  const booking = action === 'agendar' || action === 'link';
  const services = booking ? data.services.filter((s) => s.kind !== 'PRODUCT') : data.services;
  const firstServices = services.slice(0, 3);
  const more = services.length - firstServices.length;
  const hours = settings && (
    <li><span>{daysLabel(settings.workDays)}</span><span>{settings.openingTime}–{settings.closingTime}</span></li>
  );
  const noServices = <span>Nenhum serviço ativo. <Link href="/servicos">Cadastrar serviços</Link></span>;

  if (booking) {
    return (
      <div className="flow-data">
        {action === 'link' && <strong><Link2 size={13} />Link pessoal da agenda (vale 7 dias)</strong>}
        <strong><CalendarDays size={13} />{action === 'link' ? 'Na página: serviço → dia → horário' : 'Serviço → dia → horário'}</strong>
        {services.length ? (
          <ul>
            {firstServices.map((s) => <li key={s.id}><span>{s.name}</span><span>{s.durationMinutes} min</span></li>)}
            {more > 0 && <li><span>+{more} serviço{more > 1 ? 's' : ''}</span><span /></li>}
          </ul>
        ) : noServices}
        {settings && (
          <>
            <strong><Clock size={13} />Horários livres</strong>
            <ul>
              {hours}
              {settings.lunchEnabled && <li><span>Almoço</span><span>{settings.lunchStart}–{settings.lunchEnd}</span></li>}
            </ul>
          </>
        )}
        <span><Link href="/servicos">Catálogo</Link> · <Link href="/configuracoes?aba=horarios">Horários</Link></span>
      </div>
    );
  }
  if (action === 'servicos') {
    return (
      <div className="flow-data">
        <strong><Tag size={13} />Lista enviada ao cliente</strong>
        {services.length ? (
          <ul>
            {firstServices.map((s) => <li key={s.id}><span>{s.name}</span><span>{money(s.priceCents)}</span></li>)}
            {more > 0 && <li><span>+{more} serviço{more > 1 ? 's' : ''}</span><span /></li>}
          </ul>
        ) : noServices}
        <Link href="/servicos">Editar catálogo e preços</Link>
      </div>
    );
  }
  if (action === 'meus') {
    return (
      <div className="flow-data">
        <strong><CalendarDays size={13} />Próximo horário do cliente</strong>
        <ul><li><span>1) Confirmar presença</span><span /></li><li><span>2) Remarcar</span><span /></li><li><span>3) Cancelar</span><span /></li></ul>
      </div>
    );
  }
  if (action === 'trocar') {
    return (
      <div className="flow-data">
        <strong><ImageOff size={13} />Troca de conta</strong>
        <span>Passa o cliente para a conta com menos clientes, mantém o vencimento e atualiza a agenda.</span>
      </div>
    );
  }
  if (action === 'codigo') {
    return (
      <div className="flow-data">
        <strong><KeyRound size={13} />Código mais recente do e-mail</strong>
        <span>Só para clientes com acesso liberado à caixa de e-mail.</span>
        <span>Configure na aba Códigos por e-mail.</span>
      </div>
    );
  }
  return (
    <div className="flow-data">
      <strong><Hand size={13} />Bot pausa, equipe assume</strong>
      {settings?.handoffMessage && <span className="flow-msg">{settings.handoffMessage}</span>}
      <span>Configure em Atendimento humano.</span>
    </div>
  );
}

const SORA_IDEAS = [
  'Monte um fluxo completo para o meu negócio, com agendar, preços, endereço e falar com a equipe',
  'Deixe as mensagens mais simpáticas e com emojis',
  'Adicione uma opção com as formas de pagamento',
];

// Mensagem na tela: as salvas (com id) e os avisos locais de erro.
type SoraChatMessage = { id?: string; role: 'user' | 'assistant'; text: string; changed?: boolean; error?: boolean; payload?: SoraStoredMessage['payload'] };

// Chat com a Sora: cada pedido manda o fluxo atual; a resposta pode trazer um
// fluxo novo (entra no fluxograma como rascunho) e mudanças no catálogo (o dono
// confirma). A conversa fica salva no histórico do menu Sora.
function SoraPanel({ flow, problems, canUndo, onDraft, onUndo }: {
  flow: FlowNode; problems: { label: string; problem: string }[]; canUndo: boolean;
  onDraft: (flow: FlowNode) => void; onUndo: () => void;
}) {
  const [usage, setUsage] = useState<SoraUsage | null>(null);
  const [chat, setChat] = useState<SoraChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { soraApi.usage().then(setUsage).catch(() => setUsage({ used: 0, limit: 0, enabled: false, allowed: false })); }, []);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [chat, busy]);

  const disabled = !usage?.enabled;
  const limitReached = Boolean(usage && usage.used >= usage.limit);

  async function ask(message: string) {
    const content = message.trim();
    if (!content || busy) return;
    if (problems.length) {
      setChat((c) => [...c, { role: 'assistant', text: `Antes, resolva o aviso em "${problems[0].label}": ${problems[0].problem}`, error: true }]);
      return;
    }
    setChat((c) => [...c, { role: 'user', text: content }]);
    setText('');
    setBusy(true);
    try {
      const r = await soraApi.send({ conversationId, text: content, mode: 'fluxo', flow: clean(flow) });
      setConversationId(r.conversation.id);
      const reply = r.messages[r.messages.length - 1];
      setChat((c) => [...c, { id: reply.id, role: 'assistant', text: reply.text, changed: Boolean(r.flow), payload: reply.payload }]);
      if (r.flow) onDraft(r.flow);
      setUsage((u) => (u ? { ...u, ...r.usage } : u));
    } catch (err) {
      setChat((c) => [...c, { role: 'assistant', text: errorMessage(err), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(text);
  }

  return (
    <div className="card card-pad sora">
      <div className="sora-head">
        <span className="sora-mark"><Sparkles size={17} /></span>
        <div style={{ flex: 1 }}>
          <strong>Sora</strong>
          <small style={{ display: 'block' }} className="muted">Descreva o atendimento que você quer e eu monto o fluxo. Você revisa no fluxograma antes de salvar.</small>
        </div>
        {canUndo && <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo}><Undo2 size={14} />Desfazer última mudança</button>}
        {usage?.enabled && <small className="muted">{soraPercent(usage.used, usage.limit)}% do limite do mês · <Link href="/sora">histórico</Link></small>}
      </div>

      {disabled ? (
        <p className="muted">{usage ? 'A Sora ainda não está configurada neste servidor. Use o modo manual por enquanto.' : 'Carregando a Sora…'}</p>
      ) : (
        <>
          {(chat.length > 0 || busy) && (
            <div className="sora-chat" ref={chatRef}>
              {chat.map((m, i) => (
                <div key={i} className={`bubble${m.role === 'user' ? ' own' : ''}`}>
                  {m.text}
                  {m.changed && <small>Fluxograma atualizado (ainda não salvo)</small>}
                  {m.id && (m.payload?.catalog?.length || m.payload?.clients?.length) ? <SoraCatalogCard messageId={m.id} changes={m.payload.catalog ?? []} clients={m.payload.clients ?? []} appliedAt={m.payload.catalogAppliedAt} /> : null}
                </div>
              ))}
              {busy && <div className="bubble"><span className="spinner" /> Montando…</div>}
            </div>
          )}
          {chat.length === 0 && (
            <div className="sora-ideas">
              {SORA_IDEAS.map((idea) => <button key={idea} type="button" className="chip" disabled={busy || limitReached} onClick={() => ask(idea)}>{idea}</button>)}
            </div>
          )}
          <form className="sora-input" onSubmit={submit}>
            <textarea
              className="textarea"
              rows={2}
              maxLength={2000}
              value={text}
              disabled={busy || limitReached}
              placeholder={limitReached ? 'Limite de pedidos do mês atingido. Use o modo manual.' : 'Ex.: Sou uma barbearia. Quero agendar, ver preços, endereço e falar com o barbeiro, com linguagem descontraída.'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
            />
            <button className="btn btn-primary" disabled={busy || limitReached || !text.trim()} aria-label="Enviar para a Sora"><Send size={16} /></button>
          </form>
        </>
      )}
    </div>
  );
}

function NodeEditor({ root, node, parent, depth, vars, codesEnabled, onClose, onApply, onRemove, onMove }: {
  root: FlowNode; node: FlowNode; parent: FlowNode | null; depth: number; vars: Vars; codesEnabled: boolean;
  onClose: () => void; onApply: (node: FlowNode) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState<FlowNode>(node);
  const isRoot = !parent;
  const set = (patch: Partial<FlowNode>) => setDraft((d) => ({ ...d, ...patch }));
  const position = parent?.options?.findIndex((o) => o.id === node.id) ?? -1;

  function setType(type: FlowNodeType) {
    set({
      type,
      options: type === 'menu' ? draft.options ?? [] : draft.options,
      prompt: type === 'menu' ? draft.prompt ?? 'Escolha uma opção:' : draft.prompt,
      action: type === 'action' ? draft.action ?? 'agendar' : draft.action,
      next: type === 'message' ? draft.next ?? 'menu' : draft.next,
      label: !draft.label && type === 'action' ? ACTIONS[draft.action ?? 'agendar'].label : draft.label,
    });
  }

  const setMessage = (i: number, text: string) => set({ messages: draft.messages.map((m, j) => (j === i ? text : m)) });
  // Simula com o draft no lugar do nó salvo, para a prévia refletir a edição.
  const previewRoot = isRoot ? draft : mapTree(root, draft.id, () => draft);
  const previewParent = parent ? findWithParent(previewRoot, parent.id)?.node ?? parent : null;
  const preview = bubblesOf(previewRoot, draft, previewParent, vars).bubbles;
  const problems = problemsOf(draft, isRoot);

  return (
    <Modal
      wide
      title={isRoot ? 'Boas-vindas e menu principal' : `Opção ${position + 1}${parent && parent.id !== root.id ? ` de “${parent.label}”` : ''}`}
      description={isRoot ? 'Primeiras mensagens de toda conversa, seguidas do menu principal.' : TYPES[draft.type].hint}
      onClose={onClose}
      footer={<>
        {!isRoot && (
          <>
            <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={onRemove}><Trash2 size={15} />Excluir</button>
            <button type="button" className="icon-btn bordered" title="Mover para cima" disabled={position <= 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-btn bordered" title="Mover para baixo" disabled={position >= (parent?.options?.length ?? 0) - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(clean(draft))}>Aplicar</button>
      </>}
    >
      <div className="flow-editor">
        <div className="stack">
          {!isRoot && (
            <>
              <Field label="Texto da opção" hint="Como a opção aparece no menu (o número é colocado sozinho).">
                <input className="input" maxLength={60} value={draft.label} placeholder="Ex.: Endereço e horário" onChange={(e) => set({ label: e.target.value })} />
              </Field>
              <div className="field">
                <span>O que acontece quando o cliente escolhe</span>
                <div className="flow-type-pick">
                  {(Object.keys(TYPES) as FlowNodeType[]).map((t) => {
                    const Icon = TYPES[t].icon;
                    const blocked = t === 'menu' && depth >= MAX_DEPTH;
                    return (
                      <button key={t} type="button" className={`t-${t}${draft.type === t ? ' on' : ''}`} disabled={blocked} onClick={() => setType(t)}>
                        <Icon size={16} /><strong>{TYPES[t].label}</strong><small>{TYPES[t].hint}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {draft.type === 'action' && (
            <Field label="Função">
              <select className="select" value={draft.action ?? 'agendar'} onChange={(e) => set({ action: e.target.value as FlowAction })}>
                {(Object.keys(ACTIONS) as FlowAction[]).filter((a) => !['codigo', 'trocar'].includes(a) || codesEnabled || draft.action === a).map((a) => <option key={a} value={a}>{ACTIONS[a].label} — {ACTIONS[a].flow}</option>)}
              </select>
            </Field>
          )}

          <div className="field">
            <span>{draft.type === 'action' ? 'Mensagens antes da função (opcional)' : draft.type === 'end' ? 'Mensagens de despedida' : isRoot ? 'Mensagens de boas-vindas' : 'Mensagens'}</span>
            <div className="stack" style={{ gap: 8 }}>
              {draft.messages.map((m, i) => (
                <div key={i} className="flow-msg-row">
                  <textarea className="textarea" rows={3} maxLength={1000} value={m} placeholder={isRoot ? 'Olá, {nome}! Bem-vindo(a) à {empresa}.' : 'Digite a mensagem…'} onChange={(e) => setMessage(i, e.target.value)} />
                  <button type="button" className="icon-btn" title="Remover mensagem" onClick={() => set({ messages: draft.messages.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </div>
              ))}
              {draft.messages.length < MAX_MESSAGES && (
                <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ messages: [...draft.messages, ''] })}><Plus size={14} />Adicionar mensagem</button>
              )}
            </div>
          </div>

          <div className="field">
            <span>Como enviar</span>
            <div className="segmented">
              <button type="button" className={draft.together ? 'on' : ''} onClick={() => set({ together: true })}>Tudo junto</button>
              <button type="button" className={!draft.together ? 'on' : ''} onClick={() => set({ together: false })}>Mensagens separadas</button>
            </div>
            <small>{draft.together ? 'Tudo vai num único balão' : 'Cada mensagem vai num balão'}{draft.type === 'menu' || draft.type === 'message' ? ', e o menu também.' : '.'}</small>
          </div>

          {draft.type === 'menu' && (
            <Field label="Pergunta do menu" hint={`As opções (${draft.options?.length ?? 0}) são editadas no fluxograma, pelo botão “Adicionar opção”.`}>
              <input className="input" maxLength={300} value={draft.prompt ?? ''} placeholder="Como posso te ajudar? Responda com o número:" onChange={(e) => set({ prompt: e.target.value })} />
            </Field>
          )}

          {draft.type === 'message' && (
            <Field label="Depois da mensagem">
              <select className="select" value={draft.next ?? 'menu'} onChange={(e) => set({ next: e.target.value as 'menu' | 'parent' })}>
                <option value="menu">Mostrar o menu principal</option>
                {parent && parent.id !== root.id && <option value="parent">Mostrar o menu anterior (“{parent.label}”)</option>}
              </select>
            </Field>
          )}

          {problems.length > 0 && <p className="form-error"><TriangleAlert size={13} style={{ verticalAlign: -2 }} /> {problems.join(' ')}</p>}
        </div>

        <div className="phone-preview flow-preview">
          <small className="eyebrow">Prévia no WhatsApp</small>
          {!isRoot && <div className="bubble own">{draft.label || '…'}</div>}
          {preview.map((b, i) => <div key={i} className={b.system ? 'flow-system' : 'bubble'}>{b.text}</div>)}
        </div>
      </div>
    </Modal>
  );
}

// "Testar conversa" com o bot de verdade (POST /whatsapp/simulate): mesmo
// motor do WhatsApp, com o fluxo desta tela (mesmo sem salvar), o catálogo e os
// horários livres reais da agenda. Nada é salvo e nenhuma mensagem é enviada.
type SimTurn = { own?: string; bubbles: Bubble[] };

// Opções numeradas da última mensagem do bot, para responder com um toque.
function quickReplies(text: string): { value: string; label: string }[] {
  return [...text.matchAll(/^(\d{1,2})\) (.+)$/gm)].map((m) => ({ value: m[1], label: `${m[1]}) ${m[2]}` }));
}

// draft: há alterações não salvas. Só então o teste usa o fluxo desta tela;
// sem elas, o backend usa o fluxo salvo, exatamente o do WhatsApp.
function Simulator({ root, draft, vars, ai }: { root: FlowNode; draft: boolean; vars: Vars; ai: boolean }) {
  const [simId, setSimId] = useState<string | null>(null);
  const [chat, setChat] = useState<SimTurn[]>([]);
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [chat, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setTyped('');
    setSending(true);
    setChat((c) => [...c, { own: message, bubbles: [] }]);
    try {
      const r = await whatsappApi.simulate({ simId, text: message, ...(draft ? { flow: clean(root) } : {}), profileName: vars.nome });
      setSimId(r.simId);
      const bubbles: Bubble[] = r.inactive
        ? [{ text: 'A assinatura da empresa não está ativa: no WhatsApp, o bot não responde os clientes.', system: true }]
        : r.replies.length
          ? r.replies.map((t) => ({ text: t }))
          : [{ text: 'O bot não respondeu (no WhatsApp ele ficaria em silêncio).', system: true }];
      const human = r.step === 'HUMAN';
      if (human && !handoff) {
        bubbles.push({ text: 'Conversa passada para a equipe. No WhatsApp, o bot fica em silêncio até alguém responder em Conversas ou o tempo de atendimento humano acabar.', system: true });
      }
      setHandoff(human);
      setChat((c) => [...c.slice(0, -1), { own: message, bubbles }]);
    } catch (err) {
      setChat((c) => [...c.slice(0, -1), { own: message, bubbles: [{ text: errorMessage(err), system: true }] }]);
    } finally {
      setSending(false);
    }
  }

  function restart() {
    setSimId(null);
    setChat([]);
    setHandoff(false);
  }

  const last = [...chat].reverse().find((t) => t.bubbles.some((b) => !b.system));
  const lastText = last?.bubbles.filter((b) => !b.system).map((b) => b.text).join('\n') ?? '';
  const chips = handoff ? [] : quickReplies(lastText);

  return (
    <div className="card flow-sim">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong><Play size={14} style={{ verticalAlign: -2 }} /> Testar conversa</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart} disabled={sending}><RotateCcw size={13} />Recomeçar</button>
      </div>
      <small className="muted">
        É o bot de verdade, com o catálogo, a agenda e as regras do seu plano. Nada é salvo e nenhuma mensagem é enviada.
        {' '}<strong>{draft ? 'Testando o rascunho (alterações ainda não salvas).' : 'Testando o fluxo salvo, igual ao WhatsApp.'}</strong>
        {' '}{ai ? 'IA ligada: entende mensagens escritas livremente.' : 'Sem IA no seu plano: o bot entende números e palavras-chave.'}
      </small>
      <div className="phone-preview flow-sim-chat" ref={chatRef}>
        {!chat.length && <div className="flow-system">Mande uma mensagem como se fosse o cliente (ex.: “oi”).</div>}
        {chat.map((turn, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {turn.own && <div className="bubble own">{turn.own}</div>}
            {turn.bubbles.map((b, j) => <div key={j} className={b.system ? 'flow-system' : 'bubble'}>{b.text}</div>)}
          </div>
        ))}
        {sending && <div className="bubble" style={{ opacity: 0.7 }}><span className="spinner" style={{ width: 12, height: 12, marginRight: 6, verticalAlign: -2 }} />digitando...</div>}
      </div>
      <div className="chips">
        {!chat.length && <button type="button" className="chip" onClick={() => void send('oi')} disabled={sending}>oi</button>}
        {chips.map((c) => <button key={c.value} type="button" className="chip" onClick={() => void send(c.value)} disabled={sending}>{c.label}</button>)}
        {handoff && <button type="button" className="chip" onClick={restart}>Nova conversa</button>}
      </div>
      <form className="flow-sim-input" onSubmit={(e: FormEvent) => { e.preventDefault(); void send(typed); }}>
        <input
          className="input"
          maxLength={600}
          value={typed}
          placeholder={ai ? 'Escreva como o cliente: “queria marcar um corte amanhã”' : 'Escreva como o cliente (número da opção ou palavra)'}
          onChange={(e) => setTyped(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="icon-btn bordered" title="Enviar" disabled={!typed.trim() || sending}>{sending ? <span className="spinner" /> : <Send size={15} />}</button>
      </form>
      {!ai && <AiPlanNotice compact feature="Entender mensagens escritas do jeito do cliente (IA)" />}
    </div>
  );
}
