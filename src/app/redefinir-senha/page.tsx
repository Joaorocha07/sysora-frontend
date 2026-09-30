'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import Logo from '@/components/Logo';
import { Field, FormError } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'Link inválido. Peça um novo em "Esqueci minha senha".');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('As senhas não conferem.');
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <Link href="/"><Logo kind="wordmark" className="logo" /></Link>
      {done ? (
        <>
          <div className="empty-icon"><CheckCircle2 size={24} /></div>
          <div>
            <h1>Senha alterada</h1>
            <p className="muted" style={{ marginTop: 8 }}>Pronto! Agora é só entrar com a nova senha.</p>
          </div>
          <Link href="/login" className="btn btn-primary btn-lg btn-block">Ir para o login</Link>
        </>
      ) : (
        <>
          <div>
            <h1>Criar nova senha</h1>
            <p className="muted" style={{ marginTop: 8 }}>Use pelo menos 8 caracteres.</p>
          </div>
          <FormError message={error} />
          <Field label="Nova senha">
            <div className="input-icon"><Lock size={17} /><input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
          </Field>
          <Field label="Confirme a senha">
            <div className="input-icon"><Lock size={17} /><input className="input" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
          </Field>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !token}>{busy ? <span className="spinner" /> : 'Salvar nova senha'}</button>
          <Link href="/login" className="btn btn-ghost"><ArrowLeft size={16} /> Voltar para o login</Link>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<span className="spinner" />}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
