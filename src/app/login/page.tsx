'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, ChevronRight, Lock, Mail } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import { Avatar, Field, FormError } from '@/components/ui';
import { errorMessage, takeLoginNotice } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';

export default function LoginPage() {
  const router = useRouter();
  const { status, user, company, login, chooseCompany, pendingCompanies } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Volta do login com Google com várias empresas: a escolha já está pendente.
  const [choosing, setChoosing] = useState(() => pendingCompanies !== null);

  // Já logado: vai direto para a área certa.
  useEffect(() => {
    if (status === 'authenticated' && user && !choosing) router.replace(homeFor({ user, company }));
  }, [status, user, company, choosing, router]);

  // Sessão encerrada pelo backend (ex.: plano da empresa vencido): mostra o motivo.
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const notice = takeLoginNotice();
    if (notice) setError(notice);
  }, [status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(email, password);
      if (result === 'select-company') setChoosing(true);
      else router.replace(homeFor(result));
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível entrar.'));
    } finally {
      setBusy(false);
    }
  }

  async function pick(companyId: string) {
    setError(null);
    setBusy(true);
    try {
      const session = await chooseCompany(companyId);
      router.replace(homeFor(session));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (choosing && pendingCompanies) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <Logo kind="wordmark" className="logo" />
          <div>
            <h1>Escolha a empresa</h1>
            <p className="muted" style={{ marginTop: 8 }}>Seu acesso está vinculado a mais de uma empresa.</p>
          </div>
          <FormError message={error} />
          <div className="stack-sm">
            {pendingCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                className="company-choice"
                onClick={() => pick(c.id)}
                disabled={busy || c.available === false}
                style={c.available === false ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
              >
                <Avatar name={c.name} />
                <div>
                  <strong style={{ display: 'block' }}>{c.name}</strong>
                  <small>
                    {ROLE_LABELS[c.role]}
                    {c.available === false && ' · Plano vencido: peça ao administrador para renovar'}
                  </small>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setChoosing(false)}><ArrowLeft size={16} /> Voltar</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <Link href="/"><Logo kind="wordmark" className="logo" /></Link>
        <div>
          <h1>Bem-vindo de volta</h1>
          <p className="muted" style={{ marginTop: 8 }}>Entre com o e-mail e a senha cadastrados pela sua empresa.</p>
        </div>
        <FormError message={error} />
        <GoogleButton />
        <Field label="E-mail">
          <div className="input-icon">
            <Mail size={17} />
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
          </div>
        </Field>
        <Field label="Senha">
          <div className="input-icon">
            <Lock size={17} />
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
          </div>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: -8 }}>
          <Link href="/esqueci-senha" className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Esqueci minha senha</Link>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : <>Entrar <ArrowRight size={17} /></>}
        </button>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
          <Building2 size={14} style={{ verticalAlign: -2 }} /> Ainda não tem conta?{' '}
          <Link href="/cadastro" style={{ color: 'var(--ink)', fontWeight: 600 }}>Cadastre sua empresa</Link> ou{' '}
          <Link href="/cadastro?tipo=equipe" style={{ color: 'var(--ink)', fontWeight: 600 }}>entre na equipe</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
