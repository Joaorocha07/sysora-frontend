'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// Recursos de IA só no plano Avançado pago (subscription.ai, calculado no
// backend em lib/plans.ts -> hasAi). O teste grátis é o do plano Inicial.
export function useAiPlan(): boolean {
  return Boolean(useAuth().subscription?.ai);
}

export function AiPlanBadge() {
  return <span className="ai-plan-badge"><Lock size={11} />Avançado</span>;
}

// Explica o bloqueio e leva o administrador para a tela de assinatura.
export function AiPlanNotice({ feature, compact }: { feature: string; compact?: boolean }) {
  const { isAdmin, subscription } = useAuth();
  const trial = subscription?.status === 'TRIAL';
  return (
    <div className={`ai-plan-notice${compact ? ' compact' : ''}`}>
      <Lock size={compact ? 13 : 16} />
      <span>
        <strong>{feature}</strong> faz parte do plano <strong>Avançado</strong>
        {trial ? '. No teste grátis, que é o do plano Inicial, você monta e escreve tudo manualmente.' : '.'}
      </span>
      {isAdmin && <Link href="/assinatura" className="btn btn-primary btn-sm">Ver planos</Link>}
    </div>
  );
}
