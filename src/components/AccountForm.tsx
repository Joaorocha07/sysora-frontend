'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Avatar, Field, FormError, useToast, PasswordInput } from './ui';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Minha conta: dados de quem está logado e troca de senha. Usado na empresa
// (Configurações) e no painel master.
export default function AccountForm() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setError('As senhas novas não conferem.');
    setError(null);
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      toast('Senha alterada.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit} style={{ maxWidth: 560 }}>
      <div className="person">
        {user && <Avatar name={user.name} src={user.avatarUrl} size="lg" />}
        <div style={{ minWidth: 0 }}><h3>{user?.name}</h3><small>{user?.email}</small></div>
      </div>
      <div className="divider" />
      <FormError message={error} />
      <Field label="Senha atual" hint="Criou a conta pelo Google? Defina uma senha em “Esqueci minha senha”, na tela de login.">
        <PasswordInput required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres."><PasswordInput required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Confirme a nova senha"><PasswordInput required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <KeyRound size={16} />}Alterar senha</button>
      </div>
    </form>
  );
}
