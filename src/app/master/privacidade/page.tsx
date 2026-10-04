'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Empty, Loading, PageHead, useToast } from '@/components/ui';
import { adminApi, errorMessage, type AdminPrivacy, type AdminPrivacyRequest } from '@/lib/api';
import { PRIVACY_REQUEST_TYPES, type PrivacyRequestType } from '@/lib/legal';

// LGPD: pedidos dos titulares (art. 18) e escolhas de cookies. Responda em até
// 15 dias (art. 19, II). Exclusão de conta: apague pelo painel (usuário ou
// empresa) e registre a resposta aqui.

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function RequestCard({ request, onResolved }: { request: AdminPrivacyRequest; onResolved: () => void }) {
  const toast = useToast();
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const open = request.status === 'OPEN';
  const late = open && new Date(request.dueAt).getTime() < Date.now();

  async function resolve() {
    setBusy(true);
    try {
      await adminApi.resolvePrivacy(request.id, response);
      toast('Pedido marcado como atendido.');
      onResolved();
    } catch (err) {
      toast(errorMessage(err), true);
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <strong>{PRIVACY_REQUEST_TYPES[request.type as PrivacyRequestType] ?? request.type}</strong>
        <span className={`badge ${open ? (late ? 'strike' : '') : 'solid'}`}>
          {open ? (late ? `Atrasado (prazo ${day(request.dueAt)})` : `Responder até ${day(request.dueAt)}`) : `Atendido em ${day(request.resolvedAt!)}`}
        </span>
      </div>
      <small className="muted">
        {request.user.name} · {request.user.email}{request.user.companies.length ? ` · ${request.user.companies.join(', ')}` : ''} · pedido em {day(request.createdAt)}
      </small>
      {request.message && <p style={{ margin: 0, fontSize: 14 }}>“{request.message}”</p>}
      {open ? (
        <>
          <textarea className="textarea" maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Resposta ao titular (o que foi feito). Ela aparece para a pessoa em Minha conta → Privacidade." />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !response.trim()} onClick={resolve}>{busy && <span className="spinner" />}Marcar como atendido</button>
          </div>
        </>
      ) : (
        <small><strong>Resposta:</strong> {request.response}</small>
      )}
    </div>
  );
}

export default function MasterPrivacyPage() {
  const toast = useToast();
  const [data, setData] = useState<AdminPrivacy | null>(null);
  const load = useCallback(() => { adminApi.privacy().then(setData).catch((err) => toast(errorMessage(err), true)); }, [toast]);
  useEffect(load, [load]);

  if (!data) return <Loading />;
  const open = data.requests.filter((r) => r.status === 'OPEN');
  const late = open.filter((r) => new Date(r.dueAt).getTime() < Date.now());

  return (
    <>
      <PageHead
        eyebrow="Painel master"
        title="Privacidade (LGPD)"
        text="Pedidos dos titulares sobre os próprios dados. A LGPD dá 15 dias para a resposta completa."
      />

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card metric"><div className="metric-top">Pedidos em aberto</div><strong>{open.length}</strong><small>{late.length ? `${late.length} com prazo vencido` : 'nenhum atrasado'}</small></div>
        <div className="card metric"><div className="metric-top">Escolhas de cookies</div><strong>{data.consents.total}</strong><small>navegadores registrados</small></div>
        <div className="card metric"><div className="metric-top">Aceitaram opcionais</div><strong>{data.consents.analytics}</strong><small>estatísticas · {data.consents.marketing} marketing</small></div>
      </div>

      <small className="muted" style={{ display: 'block', marginBottom: 14 }}>
        Exclusão de conta: remova o usuário ou a empresa pelo painel e registre aqui o que foi feito. Documentos públicos:{' '}
        <Link href="/privacidade" style={{ textDecoration: 'underline' }}>Privacidade</Link> · <Link href="/termos" style={{ textDecoration: 'underline' }}>Termos</Link> · <Link href="/cookies" style={{ textDecoration: 'underline' }}>Cookies</Link>.
      </small>

      {!data.requests.length ? (
        <div className="card"><Empty icon={<ShieldCheck size={22} />} title="Nenhum pedido ainda" text="Os pedidos feitos em Minha conta → Privacidade aparecem aqui." /></div>
      ) : (
        <div className="stack">{data.requests.map((r) => <RequestCard key={r.id} request={r} onResolved={load} />)}</div>
      )}
    </>
  );
}
