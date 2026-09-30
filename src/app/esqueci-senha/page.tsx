'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import Logo from '@/components/Logo';
import { Field, FormError } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <Link href="/"><Logo kind="wordmark" className="logo" /></Link>
        {sent ? (
          <>
            <div className="empty-icon"><MailCheck size={24} /></div>
            <div>
              <h1>Confira seu e-mail</h1>
              <p className="muted" style={{ marginTop: 8 }}>Se <strong>{email}</strong> estiver cadastrado, você vai receber um link para criar uma nova senha. O link vale por 30 minutos.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1>Esqueceu a senha?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>
            </div>
            <FormError message={error} />
            <Field label="E-mail">
              <div className="input-icon">
                <Mail size={17} />
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
              </div>
            </Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : 'Enviar link'}</button>
          </>
        )}
        <Link href="/login" className="btn btn-ghost"><ArrowLeft size={16} /> Voltar para o login</Link>
      </form>
    </AuthLayout>
  );
}
