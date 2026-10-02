import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanInfo } from '@/lib/api';
import { money } from '@/lib/format';
import { TRIAL_DAYS } from '@/lib/plans';

// Cartão de plano: destaque (preto) no Avançado.
export default function PlanCard({ plan, action, current }: { plan: PlanInfo; action?: ReactNode; current?: boolean }) {
  const featured = plan.id === 'AVANCADO';
  return (
    <article className={`price-card${featured ? ' featured' : ''}`}>
      {current ? <span className="badge solid tag">Seu plano</span> : featured && <span className="badge plain tag">Mais completo</span>}
      <div>
        <h3 style={{ fontSize: 22 }}>{plan.name}</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          {featured ? 'Para quem tem mais de uma unidade, uma equipe maior ou quer atendimento com IA.' : 'Para começar a atender e agendar no automático.'}
        </p>
      </div>
      <div className="price">
        <strong>{money(plan.priceCents).replace(',00', '')}</strong>
        <small>/mês</small>
      </div>
      <ul>
        {plan.features.map((f) => <li key={f}><Check size={16} />{f}</li>)}
      </ul>
      {/* lib/plans.ts (backend) -> hasAi: a IA só libera com o plano pago. */}
      {featured && <small className="muted">Os recursos de IA são liberados a partir do primeiro pagamento. O teste grátis de {TRIAL_DAYS} dias é o do plano Inicial.</small>}
      {action}
    </article>
  );
}
