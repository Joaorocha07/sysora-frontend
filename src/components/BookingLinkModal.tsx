'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2, MessageCircle, RefreshCw, Search, UserPlus, Users } from 'lucide-react';
import { Avatar, ConfirmDialog, Field, FormError, Modal, Switch, useToast } from './ui';
import { bookingLinksApi, clientsApi, errorMessage, type Client } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { brDate, firstName, maskPhone, toIsoDate } from '@/lib/format';

// "Link de agendamento": o dono gera e manda para o cliente.
// - Para um cliente: link pessoal (já com nome e WhatsApp), 7 dias, uso único.
// - Link aberto: um link da empresa; a pessoa informa nome e WhatsApp na página.

type Target = { id: string; name: string; phone: string; whatsappId: string | null };

// Número para o wa.me (55 + DDD + número), ou nulo se não der para saber.
function waNumber(target: Target): string | null {
  if (target.whatsappId && !target.whatsappId.includes('@')) return target.whatsappId.replace(/\D/g, '');
  const d = target.phone.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

export default function BookingLinkModal({ client, onClose }: { client?: Target | null; onClose: () => void }) {
  const [tab, setTab] = useState<'client' | 'open'>('client');
  return (
    <Modal title="Link de agendamento" description="O cliente abre, escolhe o serviço, o dia e o horário livres e marca sozinho." onClose={onClose} wide>
      {!client && (
        <div className="segmented full">
          <button type="button" className={tab === 'client' ? 'on' : ''} onClick={() => setTab('client')}><Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Para um cliente</button>
          <button type="button" className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}><Link2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Link aberto</button>
        </div>
      )}
      {tab === 'client' || client ? <ClientLink fixed={client ?? null} /> : <OpenLink />}
    </Modal>
  );
}

// ============ Para um cliente ============
function ClientLink({ fixed }: { fixed: Target | null }) {
  const toast = useToast();
  const { company } = useAuth();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [target, setTarget] = useState<Target | null>(fixed);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string; target: Target } | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (target || mode !== 'existing') return;
    const timer = setTimeout(() => {
      clientsApi.list(search.trim() || undefined).then((list) => setResults(list.slice(0, 6))).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [search, target, mode]);

  async function generate(forTarget?: Target) {
    setBusy(true);
    setError(null);
    try {
      let who = forTarget ?? target;
      if (!who) {
        // Novo cliente: cadastra com nome e WhatsApp.
        const created = await clientsApi.create({ name: name.trim(), phone: phone.trim() });
        who = { id: created.id, name: created.name, phone: created.phone, whatsappId: created.whatsappId };
        setTarget(who);
      }
      const result = await bookingLinksApi.forClient(who.id);
      setLink({ url: result.url, expiresAt: result.expiresAt, target: who });
      setMessage(`Oi, ${firstName(who.name)}! Para marcar seu horário${company ? ` na ${company.name}` : ''}, é só escolher o serviço, o dia e a hora por aqui:\n${result.url}\n\nO link vale até ${brDate(toIsoDate(new Date(result.expiresAt)))}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    const number = waNumber(link.target);
    return (
      <div className="stack">
        <div className="row card" style={{ padding: '10px 14px', boxShadow: 'none' }}>
          <Avatar name={link.target.name} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}><strong>{link.target.name}</strong><small style={{ display: 'block' }}>{link.target.phone}</small></div>
          {!fixed && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLink(null); setTarget(null); setName(''); setPhone(''); }}>Outro cliente</button>}
        </div>
        <Field label="Link pessoal" hint={`Já abre com o nome e o WhatsApp do cliente. Vale até ${brDate(toIsoDate(new Date(link.expiresAt)))} e serve para um agendamento.`}>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-outline" style={{ flexShrink: 0 }} onClick={async () => { await copy(link.url); toast('Link copiado.'); }}><Copy size={15} /><span className="hide-mobile">Copiar</span></button>
          </div>
        </Field>
        <Field label="Mensagem">
          <textarea className="textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={async () => { await copy(message); toast('Mensagem copiada.'); }}><Copy size={15} />Copiar mensagem</button>
          {number && (
            <a className="btn btn-primary" href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={15} />Abrir no WhatsApp
            </a>
          )}
        </div>
        {!number && <small className="muted">Não deu para montar o número do WhatsApp deste cliente. Copie a mensagem e mande pelo seu WhatsApp.</small>}
      </div>
    );
  }

  return (
    <div className="stack">
      {!fixed && (
        <div className="segmented">
          <button type="button" className={mode === 'existing' ? 'on' : ''} onClick={() => { setMode('existing'); setError(null); }}>Cliente cadastrado</button>
          <button type="button" className={mode === 'new' ? 'on' : ''} onClick={() => { setMode('new'); setTarget(null); setError(null); }}><UserPlus size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Novo cliente</button>
        </div>
      )}

      {fixed ? (
        <div className="row card" style={{ padding: '10px 14px', boxShadow: 'none' }}>
          <Avatar name={fixed.name} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}><strong>{fixed.name}</strong><small style={{ display: 'block' }}>{fixed.phone}</small></div>
        </div>
      ) : mode === 'existing' ? (
        <Field label="Cliente">
          <div className="input-icon"><Search size={16} /><input className="input" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="stack-sm" style={{ marginTop: 6 }}>
            {results.map((c) => (
              <button key={c.id} type="button" className="row card" style={{ padding: '8px 12px', boxShadow: 'none', textAlign: 'left' }} disabled={busy}
                onClick={() => { const t = { id: c.id, name: c.name, phone: c.phone, whatsappId: c.whatsappId }; setTarget(t); void generate(t); }}>
                <Avatar name={c.name} size="sm" />
                <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block' }}>{c.name}</strong><small>{c.phone}</small></span>
                <Link2 size={15} className="muted" />
              </button>
            ))}
            {!results.length && <small className="muted">Nenhum cliente encontrado. Use "Novo cliente".</small>}
          </div>
        </Field>
      ) : (
        <div className="grid-2">
          <Field label="Nome do cliente"><input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Souza" /></Field>
          <Field label="WhatsApp" hint="Com DDD. O cliente é cadastrado e o link já abre com estes dados.">
            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </Field>
        </div>
      )}

      <FormError message={error} />
      {(fixed || mode === 'new') && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || (!fixed && (name.trim().length < 2 || phone.replace(/\D/g, '').length < 10))}
            onClick={() => void generate(fixed ?? undefined)}
          >
            {busy ? <span className="spinner" /> : <Link2 size={15} />}Gerar link
          </button>
        </div>
      )}
      {busy && mode === 'existing' && !fixed && <div className="row muted"><span className="spinner" />Gerando link…</div>}
    </div>
  );
}

// ============ Link aberto ============
function OpenLink() {
  const toast = useToast();
  const { company, isAdmin } = useAuth();
  const [state, setState] = useState<{ enabled: boolean; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { bookingLinksApi.open().then(setState).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => {
    if (state?.url) setMessage(`Oi! Para marcar seu horário${company ? ` na ${company.name}` : ''}, é só escolher o serviço, o dia e a hora por aqui:\n${state.url}`);
  }, [state?.url, company]);

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(await bookingLinksApi.setOpen(enabled));
      toast(enabled ? 'Link aberto ativado.' : 'Link aberto desativado.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      setState(await bookingLinksApi.regenerateOpen());
      toast('Link novo gerado. O antigo não funciona mais.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setRegenerating(false);
    }
  }

  if (!state) return <div className="loading-screen" style={{ minHeight: 120 }}>{error ? <FormError message={error} /> : <span className="spinner" />}</div>;

  return (
    <div className="stack">
      <Switch
        checked={state.enabled}
        disabled={!isAdmin || busy}
        onChange={(v) => void toggle(v)}
        label="Link aberto de agendamento"
        description="Um link só da empresa, para pôr no Instagram, no status ou mandar para quem ainda não é cliente. A pessoa informa nome e WhatsApp e escolhe o horário. Mesmo WhatsApp = mesmo cadastro."
      />
      {!isAdmin && <small className="muted">Só o administrador liga, desliga ou troca o link aberto.</small>}

      {state.enabled && state.url && (
        <>
          <Field label="Link aberto">
            <div className="row" style={{ gap: 8 }}>
              <input className="input" readOnly value={state.url} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-outline" style={{ flexShrink: 0 }} onClick={async () => { await copy(state.url!); toast('Link copiado.'); }}><Copy size={15} /><span className="hide-mobile">Copiar</span></button>
              <a className="btn btn-outline" style={{ flexShrink: 0 }} href={new URL(state.url).pathname} target="_blank" rel="noreferrer" aria-label="Abrir a página"><ExternalLink size={15} /></a>
            </div>
          </Field>
          <Field label="Mensagem">
            <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
            {isAdmin
              ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRegenerating(true)} disabled={busy}><RefreshCw size={14} />Gerar outro link</button>
              : <span />}
            <div className="row-wrap">
              <button type="button" className="btn btn-outline" onClick={async () => { await copy(message); toast('Mensagem copiada.'); }}><Copy size={15} />Copiar mensagem</button>
              <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />Compartilhar no WhatsApp</a>
            </div>
          </div>
        </>
      )}
      <FormError message={error} />

      {regenerating && (
        <ConfirmDialog
          title="Gerar outro link?"
          message="O link atual para de funcionar na hora. Quem já tem o link antigo vai precisar do novo."
          confirmLabel="Gerar outro link"
          busy={busy}
          onConfirm={() => void regenerate()}
          onClose={() => setRegenerating(false)}
        />
      )}
    </div>
  );
}
