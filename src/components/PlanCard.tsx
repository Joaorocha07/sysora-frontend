import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanInfo } from '@/lib/api';
import { money } from '@/lib/format';

// Cartão de plano: destaque (preto) no Avançado.
export default function PlanCard({ plan, action, current }: { plan: PlanInfo; action?: ReactNode; current?: boolean }) {
  const featured = plan.id === 'AVANCADO';
  return (
    <article className={`price-card${featured ? ' featured' : ''}`}>
      {current ? <span className="badge solid tag">Seu plano</span> : featured && <span className="badge plain tag">Mais completo</span>}
      <div>
        <h3 style={{ fontSize: 22 }}>{plan.name}</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          {featured ? 'Para quem tem mais de uma unidade ou uma equipe maior.' : 'Para começar a atender e agendar no automático.'}
        </p>
      </div>
      <div className="price">
        <strong>{money(plan.priceCents).replace(',00', '')}</strong>
        <small>/mês</small>
      </div>
      <ul>
        {plan.features.map((f) => <li key={f}><Check size={16} />{f}</li>)}
      </ul>
      {action}
    </article>
  );
}
