'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Building2, Clock, KeyRound, Save } from 'lucide-react';
import AccountForm from '@/components/AccountForm';
import MyTeams from '@/components/MyTeams';
import { Field, FormError, Loading, PageHead, Switch, useToast, DocumentInput } from '@/components/ui';
import { errorMessage, settingsApi, type CompanyProfile, type Settings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { WEEKDAYS, maskPhone } from '@/lib/format';

type Tab = 'empresa' | 'horarios' | 'conta';

function CompanyForm({ company, onSaved }: { company: CompanyProfile; onSaved: (c: CompanyProfile) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: company.name, document: company.document ?? '', phone: company.phone ?? '', email: company.email ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSaved(await settingsApi.updateCompany({ name: form.name, document: form.document || null, phone: form.phone || null, email: form.email || null }));
      toast('Dados da empresa salvos.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit}>
      <FormError message={error} />
      <Field label="Nome da empresa" hint="Aparece nas mensagens do bot pelo marcador {empresa}."><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="CNPJ ou CPF"><DocumentInput value={form.document} onChange={(document) => setForm({ ...form, document })} /></Field>
        <Field label="Telefone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} /></Field>
      </div>
      <Field label="E-mail"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <div className="row-wrap">
        <Link href="/assinatura" className="badge plain soft">Ver plano e assinatura</Link>
        <span className="badge plain soft">Código de convite: {company.inviteCode}</span>
        <div className="spacer" />
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <Save size={16} />}Salvar</button>
      </div>
    </form>
  );
}

function HoursForm({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleDay = (day: number) => set('workDays', draft.workDays.includes(day) ? draft.workDays.filter((d) => d !== day) : [...draft.workDays, day].sort());

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { openingTime, closingTime, workDays, slotMinutes, slotCapacity, lunchEnabled, lunchStart, lunchEnd } = draft;
      onSaved(await settingsApi.update({ openingTime, closingTime, workDays, slotMinutes, slotCapacity, lunchEnabled, lunchStart, lunchEnd }));
      toast('Horários salvos.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit}>
      <FormError message={error} />
      <p className="muted">Estes horários valem para o bot oferecer vagas no WhatsApp e para as sugestões de horário na agenda.</p>
      <Field label="Dias de atendimento">
        <div className="chips">
          {WEEKDAYS.map((label, day) => (
            <button key={label} type="button" className={`chip${draft.workDays.includes(day) ? ' on' : ''}`} onClick={() => toggleDay(day)}>{label}</button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Abre às"><input className="input" type="time" required value={draft.openingTime} onChange={(e) => set('openingTime', e.target.value)} /></Field>
        <Field label="Fecha às"><input className="input" type="time" required value={draft.closingTime} onChange={(e) => set('closingTime', e.target.value)} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Intervalo entre horários" hint="De quanto em quanto tempo o bot oferece horários (ex.: 09:00, 09:30...).">
          <select className="select" value={draft.slotMinutes} onChange={(e) => set('slotMinutes', Number(e.target.value))}>
            {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </Field>
        <Field label="Atendimentos ao mesmo tempo" hint="Quantos clientes podem ser atendidos no mesmo horário (ex.: nº de profissionais).">
          <input className="input" type="number" min={1} max={50} value={draft.slotCapacity} onChange={(e) => set('slotCapacity', Number(e.target.value))} />
        </Field>
      </div>
      <Switch checked={draft.lunchEnabled} onChange={(v) => set('lunchEnabled', v)} label="Intervalo de almoço" description="Nenhum atendimento é marcado dentro desse período." />
      {draft.lunchEnabled && (
        <div className="grid-2">
          <Field label="Início"><input className="input" type="time" value={draft.lunchStart} onChange={(e) => set('lunchStart', e.target.value)} /></Field>
          <Field label="Fim"><input className="input" type="time" value={draft.lunchEnd} onChange={(e) => set('lunchEnd', e.target.value)} /></Field>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <Save size={16} />}Salvar horários</button>
      </div>
    </form>
  );
}

function SettingsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = isAdmin ? ((params.get('aba') as Tab | null) ?? 'empresa') : 'conta';
  const [data, setData] = useState<{ settings: Settings; company: CompanyProfile } | null>(null);

  useEffect(() => { if (isAdmin) settingsApi.get().then(setData).catch(() => {}); }, [isAdmin]);

  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = isAdmin
    ? [{ id: 'empresa', label: 'Empresa', icon: Building2 }, { id: 'horarios', label: 'Horários', icon: Clock }, { id: 'conta', label: 'Minha conta', icon: KeyRound }]
    : [{ id: 'conta', label: 'Minha conta', icon: KeyRound }];

  return (
    <>
      <PageHead eyebrow="Configurações" title={isAdmin ? 'Configurações da empresa' : 'Minha conta'} />
      <div className="tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => router.replace(`/configuracoes?aba=${id}`)}>
            <Icon size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{label}
          </button>
        ))}
      </div>
      {tab === 'conta' ? <><AccountForm /><MyTeams /></> : !data ? <Loading /> : tab === 'empresa'
        ? <CompanyForm company={data.company} onSaved={(company) => setData({ ...data, company })} />
        : <HoursForm settings={data.settings} onSaved={(settings) => setData({ ...data, settings })} />}
    </>
  );
}

export default function ConfiguracoesPage() {
  return <Suspense fallback={<Loading />}><SettingsPage /></Suspense>;
}
