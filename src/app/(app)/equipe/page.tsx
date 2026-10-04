'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, Link2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserCog, X } from 'lucide-react';
import { useShell } from '@/components/AppShell';
import { Avatar, ConfirmDialog, Empty, Field, FormError, Modal, PageHead, Switch, useToast } from '@/components/ui';
import { errorMessage, settingsApi, usersApi, type Member, type Role } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, maskPhone, relativeTime } from '@/lib/format';

function MemberModal({ member, onClose, onSaved }: { member?: Member | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [role, setRole] = useState<Role>(member?.role ?? 'EMPLOYEE');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(member?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (member) {
        await usersApi.update(member.membershipId, { name, phone: phone || null, role, active, ...(password ? { password } : {}) });
      } else {
        await usersApi.create({ name, email, phone: phone || null, role, password });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={member ? 'Editar usuário' : 'Novo usuário'}
      description={member ? member.email : 'A pessoa entra na Sysora com este e-mail e a senha definida aqui.'}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="member-form" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Salvar</button>
      </>}
    >
      <form id="member-form" className="stack" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Nome completo"><input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {!member && <Field label="E-mail de acesso"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <div className="grid-2">
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="opcional" /></Field>
          <Field label="Perfil">
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="EMPLOYEE">Funcionário</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </Field>
        </div>
        <Field label={member ? 'Nova senha (opcional)' : 'Senha inicial'} hint="Mínimo de 8 caracteres. Compartilhe com a pessoa de forma segura.">
          <input className="input" type="password" autoComplete="new-password" minLength={8} required={!member} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {member && <Switch checked={active} onChange={setActive} label="Acesso ativo" description="Usuários inativos não conseguem entrar nesta empresa." />}
        <div className="phone-preview">
          <strong style={{ fontSize: 13 }}>O que cada perfil pode fazer</strong>
          <small><b>Funcionário:</b> agenda, clientes, conversas e consulta de serviços.</small>
          <small><b>Administrador:</b> tudo do funcionário, mais WhatsApp e bot, serviços, equipe e configurações.</small>
        </div>
      </form>
    </Modal>
  );
}

export default function EquipePage() {
  const { user, subscription } = useAuth();
  const { refreshBadges } = useShell();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [pending, setPending] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // O plano libera o administrador + maxEmployees funcionários.
  const maxEmployees = subscription?.maxEmployees ?? null;

  const load = useCallback(() => {
    usersApi.list().then(setMembers).catch((err) => toast(errorMessage(err), true));
    usersApi.pending().then(setPending).catch(() => {});
  }, [toast]);
  useEffect(() => {
    load();
    settingsApi.get().then((r) => setInviteCode(r.company.inviteCode)).catch(() => {});
  }, [load]);

  const inviteLink = inviteCode && typeof window !== 'undefined' ? `${window.location.origin}/cadastro?codigo=${inviteCode}` : '';

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copiado.`);
    } catch {
      toast('Não foi possível copiar. Selecione e copie manualmente.', true);
    }
  }

  async function regenerate() {
    try {
      setInviteCode(await settingsApi.regenerateInviteCode());
      toast('Novo código gerado. O anterior deixou de funcionar.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setRegenerating(false);
    }
  }

  async function decide(member: Member, approve: boolean, role: Role = 'EMPLOYEE') {
    try {
      if (approve) await usersApi.approve(member.membershipId, role);
      else await usersApi.reject(member.membershipId);
      toast(approve ? `${member.name} agora faz parte da equipe.` : 'Pedido recusado.');
      load();
      refreshBadges();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await usersApi.remove(removing.membershipId);
      toast('Usuário removido da equipe.');
      setRemoving(null);
      load();
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }

  const activeCount = members?.filter((m) => m.active).length ?? 0;
  // Funcionários ocupando vaga: todos os ativos menos o administrador (dono).
  const employeeCount = Math.max(0, activeCount - 1);
  const full = maxEmployees !== null && employeeCount >= maxEmployees;

  return (
    <>
      <PageHead
        eyebrow="Equipe"
        title="Usuários da empresa"
        text={maxEmployees !== null
          ? `${employeeCount} de ${maxEmployees} funcionários no plano ${subscription?.planName} (o administrador não conta).${full && subscription?.plan === 'INICIAL' ? ' No Avançado são até 5.' : ''}`
          : 'Administradores e funcionários com acesso ao sistema.'}
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')} disabled={full} title={full ? 'Limite de funcionários do plano atingido' : undefined}><Plus size={16} />Novo usuário</button>}
      />

      {inviteCode && (
        <div className="card card-pad row-wrap" style={{ gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3>Convide sua equipe</h3>
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Quem se cadastra com este código aparece aqui para você aprovar. Você também pode enviar o link direto.</p>
          </div>
          <span className="invite-code">
            {inviteCode}
            <button type="button" className="icon-btn" onClick={() => copy(inviteCode, 'Código')} aria-label="Copiar código"><Copy size={16} /></button>
          </span>
          <div className="row">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => copy(inviteLink, 'Link')}><Link2 size={15} />Copiar link</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRegenerating(true)}><RefreshCw size={15} />Gerar outro</button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div><h2>Pedidos de acesso</h2><p>Pessoas que se cadastraram com o código da empresa</p></div></div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <tbody>
                {pending.map((p) => (
                  <tr key={p.membershipId}>
                    <td><div className="person"><Avatar name={p.name} src={p.avatarUrl} /><div style={{ minWidth: 0 }}><strong>{p.name}</strong><small>{p.email}{p.phone ? ` · ${p.phone}` : ''}</small></div></div></td>
                    <td className="hide-mobile muted">pedido {relativeTime(p.createdAt)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => decide(p, false)}><X size={15} />Recusar</button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => decide(p, true, 'ADMIN')}>Aprovar como admin</button>
                      <button type="button" className="btn btn-sm btn-primary" style={{ marginLeft: 6 }} onClick={() => decide(p, true)}><Check size={15} />Aprovar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        {members === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : !members.length ? (
          <Empty icon={<UserCog size={22} />} title="Nenhum usuário" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Usuário</th><th>Perfil</th><th className="hide-mobile">Telefone</th><th>Acesso</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.membershipId}>
                    <td><div className="person"><Avatar name={m.name} src={m.avatarUrl} inverse={m.role === 'ADMIN'} /><div style={{ minWidth: 0 }}><strong>{m.name}{m.id === user?.id && <small style={{ display: 'inline', marginLeft: 6 }}>(você)</small>}</strong><small>{m.email}</small></div></div></td>
                    <td><span className={`badge ${m.role === 'ADMIN' ? 'solid' : ''}`}>{m.role === 'ADMIN' ? <ShieldCheck size={12} /> : null}{ROLE_LABELS[m.role]}</span></td>
                    <td className="hide-mobile muted">{m.phone || '—'}</td>
                    <td><span className={`badge ${m.active ? 'soft' : 'strike'}`}>{m.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="icon-btn" onClick={() => setEditing(m)} aria-label="Editar"><Pencil size={16} /></button>
                      {m.id !== user?.id && <button type="button" className="icon-btn" onClick={() => setRemoving(m)} aria-label="Remover"><Trash2 size={16} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 14 }}><KeyRound size={13} style={{ verticalAlign: -2 }} /> Cada pessoa pode trocar a própria senha em Minha conta ou pelo “Esqueci minha senha” na tela de login.</p>

      {editing && (
        <MemberModal
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { toast(editing === 'new' ? 'Usuário criado.' : 'Usuário atualizado.'); setEditing(null); load(); }}
        />
      )}
      {regenerating && (
        <ConfirmDialog
          title="Gerar um novo código?"
          message="O código atual deixa de funcionar. Use isso se ele foi compartilhado com quem não devia. Pedidos já enviados continuam aqui."
          confirmLabel="Gerar novo código"
          onConfirm={regenerate}
          onClose={() => setRegenerating(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remover da equipe?"
          message={`${removing.name} perde o acesso a esta empresa. Os agendamentos atribuídos a essa pessoa continuam na agenda.`}
          confirmLabel="Remover"
          danger
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
