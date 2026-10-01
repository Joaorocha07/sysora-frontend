'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { Avatar, useToast } from './ui';
import { authApi, errorMessage, type MyMembership } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';

// Minhas equipes: em quais empresas o usuário está e a situação de cada pedido
// de acesso (aprovado, pendente, recusado). Útil para quem trabalha em mais de
// uma empresa.

// Ex.: "em 01/10 às 12:39".
function when(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `em ${date} às ${time}`;
}

function situation(m: MyMembership): { label: string; cls: string; detail: string } {
  if (m.status === 'PENDING') return { label: 'Pendente', cls: 'dashed', detail: `Pedido enviado ${when(m.requestedAt)}. Aguardando o administrador.` };
  if (m.status === 'REJECTED') {
    return { label: 'Recusado', cls: 'strike', detail: `Recusado ${when(m.decidedAt ?? m.requestedAt)}. Se foi engano, peça acesso de novo pelo convite.` };
  }
  if (!m.active || !m.company.active) return { label: 'Desativado', cls: 'strike', detail: 'Seu acesso a esta empresa está desativado.' };
  if (!m.planActive && m.role !== 'ADMIN') return { label: 'Aprovado', cls: 'soft', detail: 'O plano desta empresa está vencido. Peça ao administrador para renovar.' };
  return { label: 'Aprovado', cls: 'solid', detail: m.decidedAt ? `Aprovado ${when(m.decidedAt)}.` : 'Você faz parte desta equipe.' };
}

export default function MyTeams() {
  const { company, switchCompany } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<MyMembership[] | null>(null);

  useEffect(() => { authApi.memberships().then(setItems).catch(() => setItems([])); }, []);

  async function enter(m: MyMembership) {
    try {
      await switchCompany(m.company.id);
      router.push('/painel');
      toast(`Agora em ${m.company.name}`);
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  if (!items?.length) return null;

  return (
    <div className="card card-pad stack" style={{ maxWidth: 560, marginTop: 20 }}>
      <div className="card-head">
        <div><h2><Users size={17} style={{ verticalAlign: -3, marginRight: 6 }} />Minhas equipes</h2><p>Empresas em que você trabalha e seus pedidos de acesso</p></div>
      </div>
      <div className="stack-sm">
        {items.map((m) => {
          const s = situation(m);
          const current = m.company.id === company?.id;
          const canEnter = !current && m.status === 'ACTIVE' && m.active && m.company.active && (m.planActive || m.role === 'ADMIN');
          return (
            <div key={m.membershipId} className="person" style={{ alignItems: 'center', gap: 12 }}>
              <Avatar name={m.company.name} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block' }}>
                  {m.company.name}
                  {current && <small style={{ display: 'inline', marginLeft: 6 }}>(atual)</small>}
                </strong>
                <small>{ROLE_LABELS[m.role]} · {s.detail}</small>
              </div>
              <span className={`badge ${s.cls}`}>{s.label}</span>
              {canEnter && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => enter(m)} aria-label={`Entrar em ${m.company.name}`}>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
