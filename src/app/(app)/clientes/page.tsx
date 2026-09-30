'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, Plus, Search, Users } from 'lucide-react';
import ClientFormModal from '@/components/ClientFormModal';
import { Avatar, Empty, PageHead, useToast } from '@/components/ui';
import { clientsApi, errorMessage, type Client } from '@/lib/api';
import { brDate, relativeTime } from '@/lib/format';

export default function ClientesPage() {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      clientsApi.list(search || undefined).then(setClients).catch((err) => toast(errorMessage(err), true));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, toast]);

  return (
    <>
      <PageHead
        eyebrow="Clientes"
        title="Seus clientes"
        text="Cadastrados pela equipe ou automaticamente pelo bot quando mandam mensagem no WhatsApp."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Novo cliente</button>}
      />

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 18 }}>
          <div className="input-icon" style={{ width: 'min(420px, 100%)' }}>
            <Search size={16} />
            <input className="input" placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {clients && <small className="hide-mobile">{clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}</small>}
        </div>

        {clients === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : clients.length === 0 ? (
          <Empty
            icon={<Users size={22} />}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            text={search ? 'Tente outro nome ou telefone.' : 'Cadastre o primeiro cliente ou conecte o WhatsApp para o bot cadastrar automaticamente.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th className="hide-mobile">Origem</th><th className="hide-mobile">Agendamentos</th><th className="hide-mobile">Cadastro</th><th>Última conversa</th></tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/clientes/${c.id}`)}>
                    <td>
                      <div className="person">
                        <Avatar name={c.name} />
                        <div style={{ minWidth: 0 }}><strong>{c.name}</strong><small>{c.phone}</small></div>
                      </div>
                    </td>
                    <td className="hide-mobile">{c.source === 'BOT' ? <span className="badge plain soft"><Bot size={13} />WhatsApp</span> : <span className="badge plain">Manual</span>}</td>
                    <td className="hide-mobile mono">{c._count?.appointments ?? 0}</td>
                    <td className="hide-mobile muted">{brDate(c.createdAt.slice(0, 10))}</td>
                    <td>
                      <div className="row">
                        <span className="muted">{c.lastMessageAt ? relativeTime(c.lastMessageAt) : '—'}</span>
                        {c.unreadCount > 0 && <span className="unread">{c.unreadCount}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <ClientFormModal
          onClose={() => setCreating(false)}
          onSaved={(c) => { setCreating(false); toast('Cliente cadastrado.'); router.push(`/clientes/${c.id}`); }}
        />
      )}
    </>
  );
}
