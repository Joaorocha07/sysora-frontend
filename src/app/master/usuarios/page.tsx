'use client';

import { useEffect, useState } from 'react';
import { Clock, Hourglass, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Avatar, Empty, Loading, PageHead, useToast } from '@/components/ui';
import { adminApi, errorMessage, type AdminUser } from '@/lib/api';
import { brDate, relativeTime, ROLE_LABELS } from '@/lib/format';

type Filter = 'todos' | 'admins' | 'funcionarios' | 'pendentes' | 'google';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'admins', label: 'Administradores' },
  { id: 'funcionarios', label: 'Funcionários' },
  { id: 'pendentes', label: 'Aguardando' },
  { id: 'google', label: 'Google' },
];

const isPending = (u: AdminUser) => u.companies.some((c) => c.status === 'PENDING');

function matches(u: AdminUser, filter: Filter) {
  if (filter === 'admins') return u.isSuperAdmin || u.companies.some((c) => c.role === 'ADMIN' && c.status === 'ACTIVE');
  if (filter === 'funcionarios') return u.companies.some((c) => c.role === 'EMPLOYEE' && c.status === 'ACTIVE');
  if (filter === 'pendentes') return isPending(u);
  if (filter === 'google') return u.google;
  return true;
}

const DAY = 86_400_000;

// Todas as pessoas cadastradas no Sysora: donos, administradores e funcionários de todas as empresas.
export default function MasterUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  useEffect(() => {
    adminApi.users().then(setUsers).catch((err) => { toast(errorMessage(err), true); setUsers([]); });
  }, [toast]);

  if (!users) return <Loading />;

  const term = search.trim().toLowerCase();
  const filtered = users.filter((u) => matches(u, filter)
    && `${u.name} ${u.email} ${u.phone ?? ''} ${u.companies.map((c) => c.name).join(' ')}`.toLowerCase().includes(term));

  const metrics = [
    { label: 'Pessoas cadastradas', value: users.length, hint: `${users.filter((u) => u.companies.some((c) => c.role === 'ADMIN')).length} administradores`, icon: Users },
    { label: 'Entraram com Google', value: users.filter((u) => u.google).length, hint: 'conta vinculada ao Google', icon: UserCheck },
    { label: 'Aguardando aprovação', value: users.filter(isPending).length, hint: 'pedidos de acesso a empresas', icon: Hourglass },
    { label: 'Ativos na semana', value: users.filter((u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 7 * DAY).length, hint: 'entraram nos últimos 7 dias', icon: Clock },
  ];

  return (
    <>
      <PageHead eyebrow="Painel master" title="Usuários" text="Todas as pessoas cadastradas no Sysora, as empresas de cada uma e como entram no sistema." />

      <div className="metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}<span className="metric-icon"><Icon size={17} /></span></div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head row-wrap" style={{ paddingBottom: 18 }}>
          <div className="input-icon" style={{ width: 'min(420px, 100%)' }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar por nome, e-mail, telefone ou empresa" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="segmented" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
        {!filtered.length ? (
          <Empty icon={<Users size={22} />} title={search || filter !== 'todos' ? 'Ninguém encontrado' : 'Nenhuma pessoa cadastrada'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pessoa</th><th>Empresas</th><th className="hide-mobile">Acesso</th><th className="hide-mobile">Último acesso</th><th className="hide-mobile">Cadastro</th></tr></thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <Avatar name={u.name} src={u.avatarUrl} inverse={u.isSuperAdmin} />
                        <div style={{ minWidth: 0 }}>
                          <strong>{u.name}{!u.active && <small style={{ display: 'inline', marginLeft: 6 }}>(inativo)</small>}</strong>
                          <small>{u.email}{u.phone ? ` · ${u.phone}` : ''}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {u.isSuperAdmin && <span className="badge solid"><ShieldCheck size={12} />Admin master</span>}
                        {u.companies.map((c) => (
                          <span
                            key={c.id}
                            className={`badge ${c.status === 'PENDING' ? 'dashed' : !c.active || !c.companyActive ? 'strike' : 'plain'}`}
                            title={c.status === 'PENDING' ? 'Aguardando aprovação do administrador' : !c.active ? 'Acesso desativado' : !c.companyActive ? 'Empresa desativada' : undefined}
                          >
                            {c.name} · {c.status === 'PENDING' ? 'aguardando' : ROLE_LABELS[c.role]}
                          </span>
                        ))}
                        {!u.isSuperAdmin && !u.companies.length && <span className="muted">Sem empresa</span>}
                      </div>
                    </td>
                    <td className="hide-mobile">{u.google ? <span className="badge plain">Google</span> : <span className="muted">E-mail e senha</span>}</td>
                    <td className="hide-mobile">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : <span className="muted">nunca</span>}</td>
                    <td className="hide-mobile">{brDate(u.createdAt.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
