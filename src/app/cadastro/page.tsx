'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, CheckCircle2, KeyRound, Lock, Mail, Phone, User, Users } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import Logo from '@/components/Logo';
import { Field, FormError } from '@/components/ui';
import { authApi, errorMessage, type PlanId } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { maskPhone, money } from '@/lib/format';
import { PLANS, TRIAL_DAYS } from '@/lib/plans';

type Kind = 'empresa' | 'equipe';

function PasswordFields({ password, confirm, onPassword, onConfirm }: { password: string; confirm: string; onPassword: (v: string) => void; onConfirm: (v: string) => void }) {
  return (
    <div className="grid-2">
      <Field label="Senha" hint="Mínimo de 8 caracteres.">
        <div className="input-icon"><Lock size={17} /><input className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => onPassword(e.target.value)} /></div>
      </Field>
      <Field label="Confirme a senha">
        <div className="input-icon"><Lock size={17} /><input className="input" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => onConfirm(e.target.value)} /></div>
      </Field>
    </div>
  );
}

// Dono de empresa: escolhe o plano e começa o teste grátis já logado.
function CompanyForm({ initialPlan }: { initialPlan: PlanId }) {
  const router = useRouter();
  const { registerCompany } = useAuth();
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [form, setForm] = useState({ companyName: '', name: '', email: '', phone: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(value) : value }));

  useEffect(() => { authApi.signupConfig().then((c) => setOpen(c.companySignup)).catch(() => setOpen(true)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('As senhas não conferem.');
    setError(null);
    setBusy(true);
    try {
      const session = await registerCompany({ plan, companyName: form.companyName, name: form.name, email: form.email, phone: form.phone || null, password: form.password });
      router.replace(homeFor(session));
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível concluir o cadastro.'));
      setBusy(false);
    }
  }

  if (open === false) {
    return <FormError message="O cadastro de novas empresas está fechado no momento. Fale com a equipe do Sysora." />;
  }

  return (
    <form className="stack" onSubmit={submit}>
      <FormError message={error} />
      <Field label="Plano" hint={`${TRIAL_DAYS} dias grátis para testar. Você pode trocar de plano depois.`}>
        <div className="plan-picker">
          {PLANS.map((p) => (
            <button key={p.id} type="button" className={`plan-option${plan === p.id ? ' on' : ''}`} onClick={() => setPlan(p.id)}>
              <strong>{p.name} · {money(p.priceCents).replace(',00', '')}/mês</strong>
              <small>{p.maxCompanies === 1 ? '1 empresa' : `Até ${p.maxCompanies} empresas`} · admin + {p.maxEmployees} funcionários</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Nome da empresa">
        <div className="input-icon"><Building2 size={17} /><input className="input" required minLength={2} value={form.companyName} onChange={(e) => set('companyName')(e.target.value)} placeholder="Ex.: Studio Aurora" /></div>
      </Field>
      <div className="grid-2">
        <Field label="Seu nome">
          <div className="input-icon"><User size={17} /><input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} /></div>
        </Field>
        <Field label="WhatsApp / telefone">
          <div className="input-icon"><Phone size={17} /><input className="input" inputMode="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="(11) 99999-9999" /></div>
        </Field>
      </div>
      <Field label="E-mail de acesso">
        <div className="input-icon"><Mail size={17} /><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="voce@empresa.com.br" /></div>
      </Field>
      <PasswordFields password={form.password} confirm={form.confirm} onPassword={set('password')} onConfirm={set('confirm')} />
      <label className="row" style={{ alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
        <span className="muted">Li e aceito os termos de uso e a política de privacidade do Sysora.</span>
      </label>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <span className="spinner" /> : <>Começar teste grátis <ArrowRight size={17} /></>}
      </button>
    </form>
  );
}

// Funcionário: pede acesso com o código que o administrador passou.
function EmployeeForm({ initialCode }: { initialCode: string }) {
  const [form, setForm] = useState({ inviteCode: initialCode, name: '', email: '', phone: '', password: '', confirm: '' });
  const [company, setCompany] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: key === 'phone' ? maskPhone(value) : key === 'inviteCode' ? value.toUpperCase() : value }));

  // Mostra o nome da empresa assim que o código fica completo.
  useEffect(() => {
    const code = form.inviteCode.replace(/[^A-Z0-9]/g, '');
    setCompany(null);
    if (code.length < 6) return;
    const timer = setTimeout(() => { authApi.lookupInvite(code).then((r) => setCompany(r.name)).catch(() => setCompany('')); }, 350);
    return () => clearTimeout(timer);
  }, [form.inviteCode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('As senhas não conferem.');
    setError(null);
    setBusy(true);
    try {
      const result = await authApi.registerEmployee({ inviteCode: form.inviteCode, name: form.name, email: form.email, phone: form.phone || null, password: form.password });
      setDone(result.message);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível enviar o pedido.'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="stack">
        <div className="empty-icon"><CheckCircle2 size={24} /></div>
        <div>
          <h2>Pedido enviado</h2>
          <p className="muted" style={{ marginTop: 6 }}>{done}</p>
        </div>
        <Link href="/login" className="btn btn-primary btn-lg btn-block">Ir para o login</Link>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <FormError message={error} />
      <Field label="Código da empresa" hint={company ? <>Empresa: <strong style={{ color: 'var(--ink)' }}>{company}</strong></> : company === '' ? 'Código não encontrado. Confira com o administrador.' : 'Peça o código ao administrador da empresa (fica na tela Equipe).'}>
        <div className="input-icon"><KeyRound size={17} /><input className="input" required value={form.inviteCode} onChange={(e) => set('inviteCode')(e.target.value)} placeholder="Ex.: K7M2Q9XA" style={{ letterSpacing: '.12em', fontWeight: 600 }} /></div>
      </Field>
      <div className="grid-2">
        <Field label="Seu nome">
          <div className="input-icon"><User size={17} /><input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} /></div>
        </Field>
        <Field label="Telefone">
          <div className="input-icon"><Phone size={17} /><input className="input" inputMode="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="opcional" /></div>
        </Field>
      </div>
      <Field label="E-mail" hint="Já tem conta no Sysora em outra empresa? Use o mesmo e-mail e a mesma senha.">
        <div className="input-icon"><Mail size={17} /><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} /></div>
      </Field>
      <PasswordFields password={form.password} confirm={form.confirm} onPassword={set('password')} onConfirm={set('confirm')} />
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || company === ''}>
        {busy ? <span className="spinner" /> : 'Pedir acesso'}
      </button>
    </form>
  );
}

function SignupPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { status, user, company } = useAuth();
  const initialCode = params.get('codigo') ?? '';
  const [kind, setKind] = useState<Kind>(params.get('tipo') === 'equipe' || initialCode ? 'equipe' : 'empresa');
  const initialPlan: PlanId = params.get('plano') === 'avancado' ? 'AVANCADO' : 'INICIAL';

  // Já logado: vai para o sistema.
  useEffect(() => {
    if (status === 'authenticated' && user) router.replace(homeFor({ user, company }));
  }, [status, user, company, router]);

  return (
    <div className="auth-card" style={{ width: 'min(520px, 100%)' }}>
      <Link href="/"><Logo kind="wordmark" className="logo" /></Link>
      <div>
        <h1>{kind === 'empresa' ? 'Crie a conta da sua empresa' : 'Entre na equipe'}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {kind === 'empresa'
            ? `Teste grátis por ${TRIAL_DAYS} dias. Conecte o WhatsApp e deixe o bot agendar por você.`
            : 'Informe o código da empresa. O administrador aprova o seu acesso.'}
        </p>
      </div>
      <div className="segmented" style={{ width: '100%' }}>
        <button type="button" style={{ flex: 1 }} className={kind === 'empresa' ? 'on' : ''} onClick={() => setKind('empresa')}><Building2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Sou dono(a)</button>
        <button type="button" style={{ flex: 1 }} className={kind === 'equipe' ? 'on' : ''} onClick={() => setKind('equipe')}><Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Sou da equipe</button>
      </div>
      {kind === 'empresa' ? <CompanyForm initialPlan={initialPlan} /> : <EmployeeForm initialCode={initialCode} />}
      <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Já tem conta? <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Entrar</Link></p>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<span className="spinner" />}>
        <SignupPage />
      </Suspense>
    </AuthLayout>
  );
}
