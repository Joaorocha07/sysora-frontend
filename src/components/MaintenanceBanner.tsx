'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { isMaintenance, subscribeMaintenance } from '@/lib/api';

// Faixa no topo quando o backend está em manutenção (banco desatualizado,
// 503 DATABASE_NOT_READY). Os dados não são alterados enquanto ela aparece.
export default function MaintenanceBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isMaintenance());
    return subscribeMaintenance(setOn);
  }, []);
  if (!on) return null;
  return (
    <div className="maintenance-banner" role="status">
      <Wrench size={16} />
      <span><strong>Sistema em manutenção.</strong> Algumas telas podem não carregar agora. Tente de novo em alguns minutos.</span>
    </div>
  );
}
