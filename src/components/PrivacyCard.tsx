'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Cookie, Download, ShieldCheck } from 'lucide-react';
import { Field, FormError, useToast } from './ui';
import { errorMessage, privacyApi, type PrivacyRequest } from '@/lib/api';
import { openCookiePreferences } from '@/lib/consent';
import { PRIVACY_REQUEST_TYPES, type PrivacyRequestType } from '@/lib/legal';

// "Minha conta → Privacidade e seus dados": direitos do titular (art. 18 da
// LGPD). Baixar os dados é na hora; os outros pedidos vão para o admin master,
// que responde em até 15 dias.

const when = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function PrivacyCard() {
  const toast = useToast();
  const [requests, setRequests] = useState<PrivacyRequest[] | null>(null);
  const [type, setType] = useState<PrivacyRequestType>('CORRECTION');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { privacyApi.requests().then(setRequests).catch(() => setRequests([])); }, []);

  async function download() {
    setDownloading(true);
    try {
      const data = await privacyApi.exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-sysora-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setDownloading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (type === 'DELETION' && !message.trim()) {
      setError('Conte o motivo ou o que deve ser excluído, para atendermos certo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await privacyApi.createRequest(type, message.trim() || null);
      toast(r.alreadyOpen ? 'Você já tem um pedido desse tipo em andamento.' : 'Pedido enviado. Respondemos em até 15 dias.');
      setMessage('');
      setRequests(await privacyApi.requests());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad stack" style={{ marginTop: 20 }}>
      <div className="row" style={{ gap: 10 }}>
        <ShieldCheck size={20} />
        <div>
          <h3>Privacidade e seus dados</h3>
          <small className="muted">Seus direitos pela LGPD. Veja a <Link href="/privacidade" style={{ textDecoration: 'underline' }}>Política de Privacidade</Link>.</small>
        </div>
      </div>

      <div className="row-wrap">
        <button type="button" className="btn btn-outline" onClick={download} disabled={downloading}>
          {downloading ? <span className="spinner" /> : <Download size={15} />}Baixar meus dados
        </button>
        <button type="button" className="btn btn-ghost" onClick={openCookiePreferences}><Cookie size={15} />Preferências de cookies</button>
      </div>
      <small className="muted">O arquivo traz os dados da sua conta (perfil, empresas, aceites e pedidos). Os dados dos clientes das empresas são exportados pela própria empresa.</small>

      <div className="divider" />

      <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
        <FormError message={error} />
        <Field label="Fazer um pedido sobre os seus dados">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as PrivacyRequestType)}>
            {(Object.keys(PRIVACY_REQUEST_TYPES) as PrivacyRequestType[]).map((t) => <option key={t} value={t}>{PRIVACY_REQUEST_TYPES[t]}</option>)}
          </select>
        </Field>
        {type === 'DELETION' && (
          <p className="form-error" style={{ margin: 0 }}>
            Ao excluir a conta você perde o acesso. Se você for o único administrador de uma empresa, os dados dela (clientes, agenda) também serão excluídos.
            Dados que a lei manda guardar (pagamentos, registros de acesso) ficam pelo prazo legal.
          </p>
        )}
        <Field label="Detalhes" hint="Conte o que precisa. Ex.: qual dado corrigir e o valor certo.">
          <textarea className="textarea" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Enviar pedido</button>
        </div>
      </form>

      {Boolean(requests?.length) && (
        <div className="stack-sm">
          <strong style={{ fontSize: 14 }}>Seus pedidos</strong>
          {requests!.map((r) => (
            <div key={r.id} className="phone-preview" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{PRIVACY_REQUEST_TYPES[r.type as PrivacyRequestType] ?? r.type}</strong>
                <span className={`badge ${r.status === 'DONE' ? 'solid' : ''}`}>{r.status === 'DONE' ? 'Respondido' : 'Em andamento'}</span>
              </div>
              <small className="muted">Enviado em {when(r.createdAt)}{r.status === 'OPEN' ? ' · resposta em até 15 dias' : ''}</small>
              {r.response && <small><strong>Resposta:</strong> {r.response}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
