'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, HandCoins, Pencil, Plus, Receipt, RefreshCw, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { ConfirmDialog, Empty, Field, FormError, Loading, Modal, PageHead, Switch, useToast } from '@/components/ui';
import { adminApi, errorMessage, type Expense, type ExpenseCategory, type ExpensesSummary } from '@/lib/api';
import { brDate, centsToMoneyInput, maskMoney, money, parseMoney } from '@/lib/format';

// Gastos da Sysora: os cadastrados aqui (em reais, únicos ou mensais) + o gasto
// estimado da IA, convertido de dólar pela cotação salva nesta página.

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  infraestrutura: 'Infraestrutura',
  ferramentas: 'Ferramentas',
  marketing: 'Marketing',
  impostos: 'Impostos e taxas',
  pessoal: 'Pessoal',
  outros: 'Outros',
};

const FEATURE_LABEL: Record<string, string> = {
  sora: 'Sora (fluxo e chat)',
  bot: 'IA do atendimento',
  servico: 'Melhorar com IA (catálogo)',
  audio: 'Transcrição de áudios',
};

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (month: string, short = false) => {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', short ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const usd = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 1 ? 4 : 2 });

function whenLabel(e: Expense) {
  if (!e.recurring) return brDate(e.date);
  const from = monthLabel(e.date.slice(0, 7), true);
  return e.endDate ? `Mensal · ${from} a ${monthLabel(e.endDate.slice(0, 7), true)}` : `Mensal · desde ${from}`;
}

function ExpenseModal({ expense, month, onClose, onSaved }: { expense: Expense | null; month: string; onClose: () => void; onSaved: (message: string) => void }) {
  // Novo gasto no mês aberto: hoje, se for o mês atual; senão, o dia 1 do mês.
  const defaultDate = month === thisMonth() ? new Date().toLocaleDateString('sv-SE') : `${month}-01`;
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    category: expense?.category ?? ('infraestrutura' as ExpenseCategory),
    amount: expense ? centsToMoneyInput(expense.amountCents) : '',
    date: expense?.date ?? defaultDate,
    endMonth: expense?.endDate?.slice(0, 7) ?? '',
    notes: expense?.notes ?? '',
  });
  const [recurring, setRecurring] = useState(expense?.recurring ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amountCents = parseMoney(form.amount);
    if (amountCents <= 0) return setError('Informe o valor do gasto.');
    setError(null);
    setBusy(true);
    const input = {
      description: form.description.trim(),
      category: form.category,
      amountCents,
      date: form.date,
      recurring,
      endDate: recurring && form.endMonth ? `${form.endMonth}-01` : null,
      notes: form.notes.trim() || null,
    };
    try {
      if (expense) await adminApi.updateExpense(expense.id, input);
      else await adminApi.createExpense(input);
      onSaved(expense ? 'Gasto atualizado.' : 'Gasto cadastrado.');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={expense ? 'Editar gasto' : 'Novo gasto'}
      description="Valores em reais. Gastos mensais entram em todo mês até você encerrar."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="expense-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="expense-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Descrição"><input className="input" required minLength={2} maxLength={120} value={form.description} onChange={set('description')} placeholder="Ex.: Servidor Render, domínio, Supabase" /></Field>
        <div className="grid-2">
          <Field label="Valor (R$)"><input className="input" inputMode="numeric" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: maskMoney(e.target.value) }))} placeholder="0,00" /></Field>
          <Field label="Categoria">
            <select className="input" value={form.category} onChange={set('category')}>
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
        </div>
        <Switch checked={recurring} onChange={setRecurring} label="Gasto mensal" description="Assinaturas e serviços que se repetem todo mês (servidor, banco de dados, ferramentas)." />
        <div className="grid-2">
          <Field label={recurring ? 'Começa em' : 'Data'}><input className="input" type="date" required value={form.date} onChange={set('date')} /></Field>
          {recurring && (
            <Field label="Último mês (opcional)" hint="Vazio = continua todo mês.">
              <input className="input" type="month" value={form.endMonth} min={form.date.slice(0, 7)} onChange={set('endMonth')} />
            </Field>
          )}
        </div>
        <Field label="Observação (opcional)"><textarea className="input" rows={2} maxLength={500} value={form.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  );
}

export default function MasterExpensesPage() {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<ExpensesSummary | null>(null);
  const [rate, setRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.expenses(month)
      .then((d) => { setData(d); setRate(String(d.rate).replace('.', ',')); })
      .catch((err) => toast(errorMessage(err), true));
  }, [month, toast]);
  useEffect(load, [load]);

  async function saveRate(e: FormEvent) {
    e.preventDefault();
    const value = Number(rate.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || value > 100) return toast('Informe a cotação em reais, ex.: 5,45.', true);
    setSavingRate(true);
    try {
      await adminApi.updateSettings({ usdBrlRate: value });
      toast('Cotação atualizada.');
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setSavingRate(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await adminApi.deleteExpense(removing.id);
      toast('Gasto excluído.');
      setRemoving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Loading />;

  const result = data.revenueCents - data.totals.totalCents;
  const metrics = [
    { label: 'Gasto total no mês', value: money(data.totals.totalCents), hint: 'cadastrados + IA', icon: HandCoins },
    { label: 'Gastos cadastrados', value: money(data.totals.manualCents), hint: `${data.expenses.length} ${data.expenses.length === 1 ? 'lançamento' : 'lançamentos'}`, icon: Receipt },
    { label: 'IA', value: money(data.ai.brlCents), hint: `${usd(data.ai.usd)} · US$ 1 = ${money(Math.round(data.rate * 100))}`, icon: Sparkles },
    { label: 'Resultado', value: money(result), hint: `receita mensal atual ${money(data.revenueCents)}`, icon: TrendingUp },
  ];

  return (
    <>
      <PageHead
        eyebrow="Painel master"
        title="Gastos"
        text="O que a Sysora gasta por mês: os gastos que você cadastra e o gasto estimado da IA, em reais."
        actions={<>
          <button type="button" className="btn btn-outline" onClick={load}><RefreshCw size={15} />Atualizar</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Novo gasto</button>
        </>}
      />

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button type="button" className="icon-btn bordered" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
        <strong style={{ minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</strong>
        <button type="button" className="icon-btn bordered" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        {month !== thisMonth() && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(thisMonth())}>Mês atual</button>}
      </div>

      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ padding: '18px 22px' }}><div><h3>Gastos cadastrados</h3><p>Os únicos deste mês e os mensais que estão valendo.</p></div></div>
        {data.expenses.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Descrição</th><th className="hide-mobile">Categoria</th><th className="hide-mobile">Quando</th><th style={{ textAlign: 'right' }}>Valor</th><th /></tr></thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.description}</strong>
                      {e.notes && <small style={{ display: 'block' }}>{e.notes}</small>}
                    </td>
                    <td className="hide-mobile"><span className="badge plain">{CATEGORY_LABEL[e.category] ?? e.category}</span></td>
                    <td className="hide-mobile muted">{whenLabel(e)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(e.amountCents)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="icon-btn" onClick={() => setEditing(e)} aria-label="Editar"><Pencil size={16} /></button>
                      <button type="button" className="icon-btn" onClick={() => setRemoving(e)} aria-label="Excluir"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Receipt size={22} />}
            title="Nenhum gasto neste mês"
            text="Cadastre servidor, banco de dados, domínio, ferramentas e o que mais a Sysora pagar."
            action={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Novo gasto</button>}
          />
        )}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad stack">
          <div><h3>IA no mês</h3><small>Estimado pelos tokens de cada chamada (o valor oficial fica no console de cada fornecedor).</small></div>
          {data.ai.byFeature.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Uso</th><th>Chamadas</th><th style={{ textAlign: 'right' }}>Gasto</th></tr></thead>
                <tbody>
                  {data.ai.byFeature.map((f) => (
                    <tr key={f.feature}>
                      <td>{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                      <td>{f.calls}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(f.brlCents)}<small style={{ display: 'block' }}>{usd(f.usd)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Nenhuma chamada à IA neste mês.</p>}
          <form className="row" style={{ alignItems: 'flex-end', gap: 8 }} onSubmit={saveRate}>
            <Field label="Cotação do dólar (R$ por US$ 1)" hint="Usada para converter todo o gasto da IA, inclusive dos meses anteriores.">
              <input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="5,45" />
            </Field>
            <button className="btn btn-primary" disabled={savingRate}>{savingRate ? <span className="spinner" /> : 'Salvar'}</button>
          </form>
        </div>

        <div className="card card-pad stack">
          <div><h3>Últimos 6 meses</h3><small>Cadastrados + IA, mês a mês.</small></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Mês</th><th style={{ textAlign: 'right' }}>Cadastrados</th><th style={{ textAlign: 'right' }}>IA</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {[...data.history].reverse().map((h) => (
                  <tr key={h.month} style={h.month === month ? { fontWeight: 600 } : undefined}>
                    <td>{monthLabel(h.month, true)}</td>
                    <td style={{ textAlign: 'right' }}>{money(h.manualCents)}</td>
                    <td style={{ textAlign: 'right' }}>{money(h.aiCents)}</td>
                    <td style={{ textAlign: 'right' }}>{money(h.manualCents + h.aiCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <ExpenseModal
          expense={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); toast(message); load(); }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir gasto?"
          message={removing.recurring
            ? `“${removing.description}” sai de todos os meses, inclusive dos anteriores. Para só parar de contar daqui pra frente, edite e defina o último mês.`
            : `“${removing.description}” (${money(removing.amountCents)}) será excluído.`}
          confirmLabel="Excluir"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
