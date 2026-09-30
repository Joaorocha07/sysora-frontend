import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// O Supabase só é usado para o login com Google (OAuth). Depois de voltar do
// Google, o access token do Supabase vai para o backend, que emite a sessão
// do Sysora; a sessão do Supabase no navegador é descartada em seguida.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const googleLoginEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error('Login com Google não configurado.');
  // PKCE: o Google volta para /auth/callback com um ?code= trocado lá mesmo.
  client ??= createClient(url, key, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, persistSession: true },
  });
  return client;
}

// Só aceita caminhos internos em ?next= (nada de redirecionar para outro site).
export function safeNext(next: string | null | undefined, fallback = '/login'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export async function startGoogleLogin(next: string) {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

// E-mail confirmado pelo Google sem conta no Sysora: guardado até o
// cadastro (empresa ou pedido de acesso) ser concluído.
export type GoogleSignup = { signupToken: string; email: string; name: string; avatarUrl: string | null };
const SIGNUP_KEY = 'sysora-google-signup';

export function saveGoogleSignup(data: GoogleSignup) {
  try { sessionStorage.setItem(SIGNUP_KEY, JSON.stringify(data)); } catch { /* navegação privada */ }
}

export function readGoogleSignup(): GoogleSignup | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_KEY);
    return raw ? (JSON.parse(raw) as GoogleSignup) : null;
  } catch {
    return null;
  }
}

export function clearGoogleSignup() {
  try { sessionStorage.removeItem(SIGNUP_KEY); } catch { /* navegação privada */ }
}
