'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, CalendarDays, Clock, CornerDownLeft, Flag, Hand, ListTree, MessageSquare, PenLine, Play, Plus, RotateCcw, Save, Send,
  Sparkles, Tag, Trash2, TriangleAlert, Undo2, Zap,
} from 'lucide-react';
import { ConfirmDialog, Field, Loading, Modal, useToast } from '@/components/ui';
import { useUnsavedChanges } from '@/components/UnsavedChanges';
import { AiPlanBadge, AiPlanNotice, useAiPlan } from '@/components/AiPlanLock';
import {
  errorMessage, servicesApi, settingsApi, whatsappApi,
  type FlowAction, type FlowNode, type FlowNodeType, type Service, type Settings, type SoraMessage, type SoraUsage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';

// Editor visual do fluxo do bot: a árvore de menus vira um fluxograma da
// esquerda para a direita. Clicar numa etapa abre o editor; o simulador ao
// lado mostra a conversa como o cliente vai receber. Regras iguais às do
// backend (sysora-backend/src/modules/whatsapp/whatsapp.flow.ts).
// As funções do sistema puxam uma seta para um resumo dos dados reais que
// usam (serviços, horários). O fluxo pode ser montado à mão ou conversando
// com a Sora (IA), que devolve um rascunho para revisar antes de salvar.

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
  meus: { label: 'Meus agendamentos', flow: 'Confirmar, remarcar ou cancelar', sample: 'Seu próximo horário: Corte na sexta, 10/10 às 14:00.\n\n1) Confirmar presença\n2) Remarcar\n3) Cancelar' },
  servicos: { label: 'Serviços e valores', flow: 'Lista serviços com preços', sample: 'Nossos serviços:\n\n• Corte: R$ 50,00 (30 min)\n…' },
  equipe: { label: 'Falar com a equipe', flow: 'Bot pausa e a equipe assume', sample: '(mensagem de transferência da aba Atendimento humano)' },
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
  // Sora e teste com texto livre: só no plano Avançado pago.
  const ai = useAiPlan();
  const [saved, setSaved] = useState<FlowNode | null>(null);
  const [flow, setFlow] = useState<FlowNode | null>(null);
  const [custom, setCustom] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<'manual' | 'sora'>('manual');
  const [data, setData] = useState<FlowData>({ services: [], settings: null });
  // Fluxo antes da última mudança da Sora, para desfazer.
  const [beforeSora, setBeforeSora] = useState<FlowNode | null>(null);

  useEffect(() => {
    whatsappApi.flow().then((r) => { setSaved(r.flow); setFlow(r.flow); setCustom(r.custom); }).catch((err) => toast(errorMessage(err), true));
    Promise.all([servicesApi.list(), settingsApi.get()])
      .then(([services, r]) => setData({ services: services.filter((s) => s.active), settings: r.settings }))
      .catch(() => {});
  }, [toast]);

  const vars = useMemo<Vars>(() => ({ nome: 'Maria', empresa: company?.name ?? 'Sua empresa' }), [company?.name]);

  const dirty = Boolean(flow && saved) && JSON.stringify(flow) !== JSON.stringify(saved);
  // Inclui o rascunho da Sora: sair sem salvar pede confirmação (UnsavedChanges).
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  useUnsavedChanges(dirty, () => saveRef.current());

  if (!flow || !saved) return <Loading />;
  const problems = allProblems(flow);
  const editTarget = editing ? findWithParent(flow, editing) : null;

  function addOption(menuId: string) {
    const id = newId();
    setFlow((f) => f && mapTree(f, menuId, (m) => ({ ...m, options: [...(m.options ?? []), { id, label: '', type: 'message', messages: [''], together: true, next: 'menu' }] })));
    setEditing(id);
  }

  async function save(): Promise<boolean> {
    if (!flow) return false;
    if (problems.length) {
      toast(`${problems[0].label}: ${problems[0].problem}`, true);
      return false;
    }
    setBusy(true);
    try {
      const r = await whatsappApi.saveFlow(clean(flow));
      setSaved(r.flow); setFlow(r.flow); setCustom(r.custom);
      toast('Fluxo salvo. O bot já está usando a nova versão.');
      return true;
    } catch (err) {
      toast(errorMessage(err), true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  saveRef.current = save;

  async function reset() {
    setBusy(true);
    try {
      const r = await whatsappApi.resetFlow();
      setSaved(r.flow); setFlow(r.flow); setCustom(r.custom);
      toast('Fluxo padrão restaurado.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="stack">
      <div className="card card-pad stack">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3>Como o bot conversa</h3>
            <p className="muted" style={{ marginTop: 4 }}>Clique numa etapa para editar. Cada opção de um menu vira um número que o cliente responde. Use {'{nome}'} e {'{empresa}'} nos textos.</p>
            <div className="segmented" style={{ marginTop: 12, width: 'fit-content' }}>
              <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Montar manual</button>
              <button type="button" className={mode === 'sora' ? 'on' : ''} onClick={() => setMode('sora')}><Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Criar com a Sora{!ai && <AiPlanBadge />}</button>
            </div>
          </div>
          <div className="row-wrap">
            {custom && <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy}><RotateCcw size={15} />Restaurar padrão</button>}
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

      {mode === 'sora' && !ai && (
        <div className="card card-pad"><AiPlanNotice feature="A Sora, IA que monta o fluxo para você," /></div>
      )}

      {mode === 'sora' && ai && (
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
        <Simulator key={JSON.stringify(flow)} root={flow} vars={vars} ai={ai} />
      </div>

      {editTarget && (
        <NodeEditor
          root={flow}
          node={editTarget.node}
          parent={editTarget.parent}
          depth={editTarget.depth}
          vars={vars}
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

      {confirmReset && (
        <ConfirmDialog
          title="Restaurar o fluxo padrão?"
          message="Seus menus e mensagens personalizados serão apagados e o bot volta ao menu padrão (agendar, meus agendamentos, serviços e equipe)."
          confirmLabel="Restaurar"
          danger
          busy={busy}
          onConfirm={reset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
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
  const { services, settings } = data;
  const firstServices = services.slice(0, 3);
  const more = services.length - firstServices.length;
  const hours = settings && (
    <li><span>{daysLabel(settings.workDays)}</span><span>{settings.openingTime}–{settings.closingTime}</span></li>
  );
  const noServices = <span>Nenhum serviço ativo. <Link href="/servicos">Cadastrar serviços</Link></span>;

  if (action === 'agendar') {
    return (
      <div className="flow-data">
        <strong><CalendarDays size={13} />Serviço → dia → horário</strong>
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
        <span><Link href="/servicos">Serviços</Link> · <Link href="/configuracoes?aba=horarios">Horários</Link></span>
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
        <Link href="/servicos">Editar serviços e preços</Link>
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

type SoraChatMessage = SoraMessage & { changed?: boolean; error?: boolean };

// Chat com a Sora: cada pedido manda a conversa e o fluxo atual; a resposta
// pode trazer um fluxo novo, que entra no fluxograma como rascunho.
function SoraPanel({ flow, problems, canUndo, onDraft, onUndo }: {
  flow: FlowNode; problems: { label: string; problem: string }[]; canUndo: boolean;
  onDraft: (flow: FlowNode) => void; onUndo: () => void;
}) {
  const [usage, setUsage] = useState<SoraUsage | null>(null);
  const [chat, setChat] = useState<SoraChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { whatsappApi.soraUsage().then(setUsage).catch(() => setUsage({ used: 0, limit: 0, enabled: false, allowed: false })); }, []);
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
    // Só a conversa de verdade vai para a Sora (sem os avisos locais de erro).
    const history = [...chat.filter((m) => !m.error), { role: 'user' as const, text: content }];
    setChat((c) => [...c, { role: 'user', text: content }]);
    setText('');
    setBusy(true);
    try {
      const r = await whatsappApi.askSora(history.map(({ role, text: t }) => ({ role, text: t })), clean(flow));
      setChat((c) => [...c, { role: 'assistant', text: r.reply, changed: Boolean(r.flow) }]);
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
        {usage?.enabled && <small className="muted">{usage.used}/{usage.limit} no mês</small>}
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

function NodeEditor({ root, node, parent, depth, vars, onClose, onApply, onRemove, onMove }: {
  root: FlowNode; node: FlowNode; parent: FlowNode | null; depth: number; vars: Vars;
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
                {(Object.keys(ACTIONS) as FlowAction[]).map((a) => <option key={a} value={a}>{ACTIONS[a].label} — {ACTIONS[a].flow}</option>)}
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

// Testa o fluxo clicando nas opções, como se fosse o cliente. Também dá para
// escrever do jeito do cliente: a IA do atendimento (backend) diz o que entendeu.
function Simulator({ root, vars, ai }: { root: FlowNode; vars: Vars; ai: boolean }) {
  const toast = useToast();
  const start = () => bubblesOf(root, root, null, vars);
  const [chat, setChat] = useState<{ bubbles: Bubble[]; own?: string }[]>(() => [{ bubbles: start().bubbles }]);
  const [menu, setMenu] = useState<FlowNode | null>(root);
  const [typed, setTyped] = useState('');
  const [thinking, setThinking] = useState(false);

  function choose(option: FlowNode, index: number, own = String(index + 1), note?: string) {
    if (!menu) return;
    const result = bubblesOf(root, option, menu, vars);
    setChat((c) => [...c, { own, bubbles: [...(note ? [{ text: note, system: true }] : []), ...result.bubbles] }]);
    setMenu(result.menu);
  }

  async function sendTyped(e: FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!text || !menu || thinking) return;
    const options = menu.options ?? [];
    const byNumber = /^\d$/.test(text) ? options[Number(text) - 1] : undefined;
    if (byNumber) { setTyped(''); choose(byNumber, Number(text) - 1); return; }
    if (text === '0' && menu.id !== root.id) { setTyped(''); back(); return; }

    setThinking(true);
    try {
      const r = await whatsappApi.understand(clean(root), text, menu.id === root.id ? undefined : menu.id);
      setTyped('');
      const option = options.find((o) => o.id === r.optionId);
      const details = [r.services.length && `serviço: ${r.services.join(' + ')}`, r.date && `dia: ${r.date.split('-').reverse().join('/')}`, r.time && `horário: ${r.time}`].filter(Boolean);
      if (option) {
        const note = `IA entendeu: “${option.label}”${details.length ? ` (${details.join(', ')})` : ''}.${details.length && option.action === 'agendar' ? ' No WhatsApp o bot já usa esses dados e agenda direto se o horário estiver livre.' : ''}`;
        choose(option, options.indexOf(option), text, note);
      } else {
        const reply = r.answer ? `${r.answer}\n\n${menuText(menu, menu.id === root.id, vars)}` : `Não entendi.\n\n${menuText(menu, menu.id === root.id, vars)}`;
        setChat((c) => [...c, { own: text, bubbles: [{ text: reply }] }]);
      }
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setThinking(false);
    }
  }

  function back() {
    setChat((c) => [...c, { own: '0', bubbles: [{ text: menuText(root, true, vars) }] }]);
    setMenu(root);
  }

  function restart() {
    setChat([{ bubbles: start().bubbles }]);
    setMenu(root);
  }

  return (
    <div className="card flow-sim">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong><Play size={14} style={{ verticalAlign: -2 }} /> Testar conversa</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}><RotateCcw size={13} />Recomeçar</button>
      </div>
      <div className="phone-preview flow-sim-chat">
        {chat.map((turn, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {turn.own && <div className="bubble own">{turn.own}</div>}
            {turn.bubbles.map((b, j) => <div key={j} className={b.system ? 'flow-system' : 'bubble'}>{b.text}</div>)}
          </div>
        ))}
      </div>
      <div className="chips">
        {menu ? (
          <>
            {(menu.options ?? []).map((o, i) => <button key={o.id} type="button" className="chip" onClick={() => choose(o, i)}>{i + 1}) {fill(o.label || '…', vars)}</button>)}
            {menu.id !== root.id && <button type="button" className="chip" onClick={back}>0) Voltar</button>}
          </>
        ) : (
          <button type="button" className="chip" onClick={restart}>Nova conversa</button>
        )}
      </div>
      {menu && !ai && <AiPlanNotice compact feature="Testar mensagens escritas como o cliente (IA)" />}
      {menu && ai && (
        <form className="flow-sim-input" onSubmit={sendTyped}>
          <input className="input" maxLength={600} value={typed} placeholder="Ou escreva como o cliente: “queria marcar um corte”" onChange={(e) => setTyped(e.target.value)} disabled={thinking} />
          <button type="submit" className="icon-btn bordered" title="Enviar" disabled={!typed.trim() || thinking}>{thinking ? <span className="spinner" /> : <Send size={15} />}</button>
        </form>
      )}
    </div>
  );
}
