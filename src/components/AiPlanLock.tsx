'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// IA no atendimento (texto livre, áudio, teste com IA) e descrições com IA: só no
// plano Avançado pago (subscription.ai, lib/plans.ts -> hasAi no backend).
export function useAiPlan(): boolean {
  return Boolean(useAuth().subscription?.ai);
}

// Sora: qualquer plano pago, com limite mensal por plano (hasSora no backend).
// O teste grátis não tem IA.
export function useSoraPlan(): boolean {
  return Boolean(useAuth().subscription?.sora);
}

export function AiPlanBadge({ paid }: { paid?: boolean }) {
  return <span className="ai-plan-badge"><Lock size={11} />{paid ? 'Plano pago' : 'Avançado'}</span>;
}

// Explica o bloqueio e leva o administrador para a tela de assinatura.
// paid: recurso de qualquer plano pago (Sora), bloqueado só no teste grátis.
export function AiPlanNotice({ feature, compact, paid }: { feature: string; compact?: boolean; paid?: boolean }) {
  const { isAdmin, subscription } = useAuth();
  const trial = subscription?.status === 'TRIAL';
  return (
    <div className={`ai-plan-notice${compact ? ' compact' : ''}`}>
      <Lock size={compact ? 13 : 16} />
      {paid ? (
        <span>
          <strong>{feature}</strong> faz parte dos planos pagos
          {trial ? '. No teste grátis, você monta e escreve tudo manualmente.' : '.'}
        </span>
      ) : (
        <span>
          <strong>{feature}</strong> faz parte do plano <strong>Avançado</strong>
          {trial ? '. No teste grátis, que é o do plano Inicial, você monta e escreve tudo manualmente.' : '.'}
        </span>
      )}
      {isAdmin && <Link href="/assinatura" className="btn btn-primary btn-sm">Ver planos</Link>}
    </div>
  );
}

// Uso da Sora no mês, em porcentagem do limite do plano.
export const soraPercent = (used: number, limit: number) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);
