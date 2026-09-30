'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { startDemo, type DemoMode } from './demo';
import { authApi, subscribeSession, type LoginResponse, type RegisterCompanyInput, type Subscription, type AuthCompany, type AuthUser, type CompanyChoice, type Role, type Session } from './api';
import type { GoogleSignup } from './supabase';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: Status;
  user: AuthUser | null;
  company: AuthCompany | null;
  role: Role | null;
  isAdmin: boolean;
  subscription: Subscription | null;
  // Modo demonstração: navega pelo sistema com dados fictícios, sem backend.
  enterDemo: (mode: DemoMode) => Promise<Session>;
  // Recarrega a sessão (ex.: depois de trocar de plano).
  reloadSession: () => Promise<void>;
  // Login de quem tem acesso a várias empresas: aguardando a escolha.
  pendingCompanies: CompanyChoice[] | null;
  login: (email: string, password: string) => Promise<Session | 'select-company'>;
  // Login com o access token do Supabase (volta do Google). E-mail sem conta
  // devolve os dados para concluir o cadastro.
  loginWithGoogle: (accessToken: string) => Promise<Session | 'select-company' | GoogleSignup>;
  chooseCompany: (companyId: string) => Promise<Session>;
  switchCompany: (companyId: string | null) => Promise<Session>;
  // Cadastro de uma empresa nova: já entra como administrador.
  registerCompany: (input: RegisterCompanyInput) => Promise<Session>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Para onde ir depois do login.
export function homeFor(session: Pick<Session, 'user' | 'company'>): string {
  if (!session.company) return session.user.isSuperAdmin ? '/master' : '/login';
  return '/painel';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState<{ token: string; companies: CompanyChoice[] } | null>(null);

  const apply = useCallback((next: Session | null) => {
    setSession(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  useEffect(() => {
    subscribeSession(apply);
    authApi.refresh().then(apply).catch(() => apply(null));
    return () => subscribeSession(null);
  }, [apply]);

  const startSession = useCallback((result: LoginResponse) => {
    if ('accessToken' in result) {
      apply(result);
      setPending(null);
      return result;
    }
    setPending({ token: result.preAuthToken, companies: result.companies });
    return 'select-company' as const;
  }, [apply]);

  const login = useCallback(async (email: string, password: string) => startSession(await authApi.login(email, password)), [startSession]);

  const loginWithGoogle = useCallback(async (accessToken: string) => {
    const result = await authApi.google(accessToken);
    if ('status' in result && result.status === 'signup-required') {
      setPending(null);
      return { signupToken: result.signupToken, email: result.email, name: result.name, avatarUrl: result.avatarUrl };
    }
    return startSession(result);
  }, [startSession]);

  const chooseCompany = useCallback(async (companyId: string) => {
    if (!pending) throw new Error('Faça login novamente.');
    const next = await authApi.loginCompany(pending.token, companyId);
    setPending(null);
    apply(next);
    return next;
  }, [pending, apply]);

  const switchCompany = useCallback(async (companyId: string | null) => {
    const next = await authApi.switchCompany(companyId);
    apply(next);
    return next;
  }, [apply]);

  const registerCompany = useCallback(async (input: RegisterCompanyInput) => {
    const next = await authApi.register(input);
    setPending(null);
    apply(next);
    return next;
  }, [apply]);

  const enterDemo = useCallback(async (mode: DemoMode) => {
    startDemo(mode);
    const next = await authApi.refresh();
    setPending(null);
    apply(next);
    return next;
  }, [apply]);

  const reloadSession = useCallback(async () => {
    try { apply(await authApi.refresh()); } catch { /* mantém a sessão atual */ }
  }, [apply]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* encerra a sessão local mesmo se falhar */ }
    setPending(null);
    apply(null);
  }, [apply]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user: session?.user ?? null,
    company: session?.company ?? null,
    role: session?.role ?? null,
    isAdmin: session?.role === 'ADMIN',
    subscription: session?.subscription ?? null,
    pendingCompanies: pending?.companies ?? null,
    login, loginWithGoogle, chooseCompany, switchCompany, registerCompany, enterDemo, reloadSession, logout,
  }), [status, session, pending, login, loginWithGoogle, chooseCompany, switchCompany, registerCompany, enterDemo, reloadSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.');
  return ctx;
}
