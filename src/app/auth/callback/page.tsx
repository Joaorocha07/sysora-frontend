'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import Logo from '@/components/Logo';
import { FormError } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { stopDemo } from '@/lib/demo';
import { safeNext, saveGoogleSignup, supabase } from '@/lib/supabase';

// Volta do Google: troca o ?code= pela sessão do Supabase, entrega o access
// token ao backend e descarta a sessão do Supabase.
function GoogleCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // O modo de desenvolvimento do React roda o efeito duas vezes, e o código só vale uma.
    if (started.current) return;
    started.current = true;
    const next = safeNext(params.get('next'));

    (async () => {
      const code = params.get('code');
      if (!code) {
        setError(params.get('error_description') || 'O login com Google foi cancelado.');
        return;
      }
      const client = supabase();
      try {
        const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) throw new Error('Não foi possível confirmar o login com o Google. Tente novamente.');
        stopDemo();
        // Veio do cadastro "Sou da equipe": quem já tem conta também pede acesso à empresa do convite.
        const joining = next.startsWith('/cadastro') && new URLSearchParams(next.split('?')[1] ?? '').get('tipo') === 'equipe';
        const result = await loginWithGoogle(data.session.access_token, joining ? 'join' : 'login');
        if (result === 'select-company') {
          router.replace('/login');
        } else if ('signupToken' in result) {
          saveGoogleSignup(result);
          router.replace(next.startsWith('/cadastro') ? next : '/cadastro');
        } else {
          router.replace(homeFor(result));
        }
      } catch (err) {
        setError(err instanceof ApiError || err instanceof TypeError ? errorMessage(err) : (err as Error).message);
      } finally {
        await client.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    })();
  }, [params, router, loginWithGoogle]);

  if (!error) return <span className="spinner" />;

  return (
    <div className="auth-card">
      <Logo kind="wordmark" className="logo" />
      <h1>Não foi possível entrar</h1>
      <FormError message={error} />
      <Link href="/login" className="btn btn-primary btn-lg btn-block"><ArrowLeft size={16} /> Voltar para o login</Link>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<span className="spinner" />}>
        <GoogleCallback />
      </Suspense>
    </AuthLayout>
  );
}
