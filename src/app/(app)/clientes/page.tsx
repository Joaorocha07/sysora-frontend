'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Download, FileUp, Plus, Search, Users } from 'lucide-react';
import ClientFormModal from '@/components/ClientFormModal';
import { TagChips, useStages, useTags } from '@/components/Crm';
import { Avatar, Empty, Field, FormError, Loading, Modal, PageHead, useToast } from '@/components/ui';
import { clientsApi, errorMessage, type Client, type ClientImportResult, type ClientImportRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadFile, guessColumns, parseCsv, toCsv, type ColumnMap } from '@/lib/csv';
import { brDate, relativeTime, today } from '@/lib/format';

function Clientes() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { tags } = useTags();
  const { stages } = useStages();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [tagId, setTagId] = useState(params.get('etiqueta') ?? '');
  const [stageId, setStageId] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    clientsApi.listWithTotal(search || undefined, { tagId: tagId || undefined, stageId: stageId || undefined })
      .then((r) => { setClients(r.clients); setTotal(r.total ?? r.clients.length); })
      .catch((err) => toast(errorMessage(err), true));
  }, [search, tagId, stageId, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await clientsApi.exportAll();
      const csv = toCsv(
        ['Nome', 'Telefone', 'E-mail', 'Aniversário', 'Etiquetas', 'Etapa do funil', 'Agendamentos', 'Origem', 'Cadastro', 'Última conversa', 'Observações'],
        rows.map((c) => [
          c.name, c.phone, c.email, c.birthday ? brDate(c.birthday) : '', c.tags.join(', '), c.stage ?? '', c.appointments,
          c.source === 'BOT' ? 'WhatsApp' : 'Manual', brDate(c.createdAt.slice(0, 10)), c.lastMessageAt ? brDate(c.lastMessageAt.slice(0, 10)) : '', c.notes,
        ]),
      );
      downloadFile(`clientes-${today()}.csv`, csv);
      toast(`${rows.length} ${rows.length === 1 ? 'cliente exportado' : 'clientes exportados'}.`);
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setExporting(false);
    }
  }

  const filtering = Boolean(search || tagId || stageId);

  return (
    <>
      <PageHead
        eyebrow="Clientes"
        title="Seus clientes"
        text="Cadastrados pela equipe ou automaticamente pelo bot quando mandam mensagem no WhatsApp."
        actions={<>
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={exporting}>{exporting ? <span className="spinner" /> : <Download size={16} />}<span className="hide-mobile">Exportar</span></button>
          {isAdmin && <button type="button" className="btn btn-outline" onClick={() => setImporting(true)}><FileUp size={16} /><span className="hide-mobile">Importar</span></button>}
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Novo cliente</button>
        </>}
      />

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 18, flexWrap: 'wrap' }}>
          <div className="row-wrap" style={{ flex: 1 }}>
            <div className="input-icon" style={{ width: 'min(420px, 100%)' }}>
              <Search size={16} />
              <input className="input" placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {Boolean(tags?.length) && (
              <select className="select" style={{ width: 'auto' }} value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Filtrar por etiqueta">
                <option value="">Todas as etiquetas</option>
                {tags!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {Boolean(stages?.length) && (
              <select className="select" style={{ width: 'auto' }} value={stageId} onChange={(e) => setStageId(e.target.value)} aria-label="Filtrar por etapa do funil">
                <option value="">Todas as etapas</option>
                {stages!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          {clients && <small className="hide-mobile">{total} {total === 1 ? 'cliente' : 'clientes'}{total > clients.length ? ` (mostrando ${clients.length})` : ''}</small>}
        </div>

        {clients === null ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><span className="spinner" /></div>
        ) : clients.length === 0 ? (
          <Empty
            icon={<Users size={22} />}
            title={filtering ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            text={filtering ? 'Tente outro nome, telefone ou filtro.' : 'Cadastre o primeiro cliente, importe uma planilha ou conecte o WhatsApp para o bot cadastrar automaticamente.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th className="hide-mobile">Etiquetas</th><th className="hide-mobile">Origem</th><th className="hide-mobile">Agendamentos</th><th className="hide-mobile">Cadastro</th><th>Última conversa</th></tr>
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
                    <td className="hide-mobile"><TagChips tags={c.tags} max={3} /></td>
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
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { load(); }} />}
    </>
  );
}

// ============ Importar planilha ============
const FIELDS: { id: keyof ColumnMap; label: string; required?: boolean }[] = [
  { id: 'name', label: 'Nome', required: true },
  { id: 'phone', label: 'Telefone', required: true },
  { id: 'email', label: 'E-mail' },
  { id: 'birthday', label: 'Aniversário' },
  { id: 'tags', label: 'Etiquetas' },
  { id: 'notes', label: 'Observações' },
];
const MAX_ROWS = 2000;

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { tags, reload } = useTags();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [tagId, setTagId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClientImportResult | null>(null);

  async function readFile(file: File) {
    setError(null);
    setResult(null);
    const text = await file.text();
    const [head, ...body] = parseCsv(text);
    if (!head || !body.length) { setError('Não encontramos linhas nessa planilha. Salve como CSV com uma linha de cabeçalho.'); return; }
    setFileName(file.name);
    setHeader(head);
    setRows(body);
    setMap(guessColumns(head));
  }

  const cell = (row: string[], field: keyof ColumnMap) => (map[field] === undefined ? '' : row[map[field]!] ?? '');
  const ready = map.name !== undefined && map.phone !== undefined && rows.length > 0 && rows.length <= MAX_ROWS;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const clients: ClientImportRow[] = rows.map((r) => ({
        name: cell(r, 'name'),
        phone: cell(r, 'phone'),
        email: cell(r, 'email'),
        birthday: cell(r, 'birthday'),
        notes: cell(r, 'notes'),
        tags: cell(r, 'tags').split(/[,;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 10),
      }));
      const res = await clientsApi.importMany(clients, tagId || null);
      setResult(res);
      await reload();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Modal title="Importação concluída" onClose={onClose} footer={<button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>}>
        <p><strong>{result.created}</strong> {result.created === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}.{result.skippedCount ? ` ${result.skippedCount} ${result.skippedCount === 1 ? 'linha ficou' : 'linhas ficaram'} de fora:` : ''}</p>
        {result.skipped.length > 0 && (
          <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}>
            <table className="table">
              <thead><tr><th>Linha</th><th>Nome</th><th>Motivo</th></tr></thead>
              <tbody>{result.skipped.map((s) => <tr key={s.line}><td className="mono">{s.line}</td><td>{s.name}</td><td className="muted">{s.reason}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      wide
      title="Importar clientes"
      description="Planilha em CSV (no Excel: Salvar como → CSV). Telefones que já estão cadastrados ficam de fora."
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!ready || busy}>{busy && <span className="spinner" />}Importar {rows.length ? `${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}` : ''}</button>
      </>}
    >
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
      <button type="button" className="btn btn-outline" style={{ justifySelf: 'start' }} onClick={() => fileRef.current?.click()}>
        <FileUp size={16} />{fileName ? `Trocar arquivo (${fileName})` : 'Escolher arquivo CSV'}
      </button>
      {!fileName && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifySelf: 'start' }}
          onClick={() => downloadFile('modelo-clientes.csv', toCsv(['Nome', 'Telefone', 'E-mail', 'Aniversário', 'Etiquetas', 'Observações'], [['Maria Souza', '(11) 98888-7777', 'maria@email.com', '15/03/1990', 'VIP, Retorno', 'Prefere sábado']]))}
        >
          <Download size={15} />Baixar planilha modelo
        </button>
      )}

      {header.length > 0 && (
        <>
          <div className="grid-3">
            {FIELDS.map((f) => (
              <Field key={f.id} label={`${f.label}${f.required ? ' *' : ''}`}>
                <select className="select" value={map[f.id] ?? ''} onChange={(e) => setMap({ ...map, [f.id]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">{f.required ? 'Escolha a coluna' : 'Não importar'}</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                </select>
              </Field>
            ))}
          </div>
          {Boolean(tags?.length) && (
            <Field label="Etiqueta para todos os importados (opcional)">
              <select className="select" value={tagId} onChange={(e) => setTagId(e.target.value)}>
                <option value="">Nenhuma</option>
                {tags!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 16 }}>
            <table className="table">
              <thead><tr>{FIELDS.filter((f) => map[f.id] !== undefined).map((f) => <th key={f.id}>{f.label}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{FIELDS.filter((f) => map[f.id] !== undefined).map((f) => <td key={f.id} className="muted">{cell(r, f.id) || '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="muted">Prévia das primeiras {Math.min(5, rows.length)} de {rows.length} linhas.{rows.length > MAX_ROWS ? ` Importe até ${MAX_ROWS} por vez: divida a planilha.` : ''}</small>
        </>
      )}
      <FormError message={error} />
    </Modal>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Clientes />
    </Suspense>
  );
}
