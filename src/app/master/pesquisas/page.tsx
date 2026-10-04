'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Empty, Loading, PageHead, useToast } from '@/components/ui';
import { adminApi, errorMessage, type SurveySummary } from '@/lib/api';
import { surveyLabel } from '@/lib/survey';

// Respostas da pesquisa inicial: quantos responderam, totais por pergunta e as
// últimas respostas, para orientar marketing e próximas funcionalidades.

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function Bars({ title, question, items, total }: { title: string; question: 'sources' | 'business' | 'teamSize' | 'features'; items: SurveySummary['sources']; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card card-pad stack">
      <h3>{title}</h3>
      {!items.length ? <small className="muted">Sem respostas ainda.</small> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((i) => (
            <div key={i.id} style={{ display: 'grid', gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                <span>{surveyLabel(question, i.id)}</span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{i.count} · {Math.round((i.count / Math.max(1, total)) * 100)}%</span>
              </div>
              <div className="survey-progress"><div style={{ width: `${(i.count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MasterSurveysPage() {
  const toast = useToast();
  const [data, setData] = useState<SurveySummary | null>(null);

  useEffect(() => { adminApi.surveys().then(setData).catch((err) => toast(errorMessage(err), true)); }, [toast]);

  if (!data) return <Loading />;

  return (
    <>
      <PageHead eyebrow="Painel master" title="Pesquisa inicial" text="O que os usuários das empresas responderam ao entrar na Sysora." />

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card metric"><div className="metric-top">Responderam</div><strong>{data.total}</strong><small>de {data.users} usuários</small></div>
        <div className="card metric"><div className="metric-top">Deixaram para depois</div><strong>{data.dismissed}</strong><small>veem o aviso no painel</small></div>
        <div className="card metric"><div className="metric-top">Taxa de resposta</div><strong>{data.users ? Math.round((data.total / data.users) * 100) : 0}%</strong><small>entre os usuários ativos</small></div>
      </div>

      {!data.total ? (
        <div className="card"><Empty icon={<ClipboardList size={22} />} title="Nenhuma resposta ainda" text="As respostas aparecem aqui assim que os usuários responderem a pesquisa." /></div>
      ) : (
        <>
          <div className="grid-2" style={{ alignItems: 'start', marginBottom: 20 }}>
            <Bars title="Como conheceram a Sysora" question="sources" items={data.sources} total={data.total} />
            <Bars title="Ramo da empresa" question="business" items={data.business} total={data.total} />
            <Bars title="Tamanho da equipe" question="teamSize" items={data.teamSize} total={data.total} />
            <Bars title="O que querem num sistema" question="features" items={data.features} total={data.total} />
          </div>

          <div className="card">
            <div className="card-head"><div><h2>Últimas respostas</h2><p>Mais recentes primeiro</p></div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Quem</th><th>Ramo e equipe</th><th>Conheceu por</th><th>Quer no sistema</th><th>Comentário</th></tr></thead>
                <tbody>
                  {data.responses.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.user.name}</strong><small style={{ display: 'block' }}>{r.company ?? r.user.email}</small><small className="muted">{when(r.createdAt)}</small></td>
                      <td>{r.business === 'outro' ? r.businessOther ?? 'Outro' : surveyLabel('business', r.business)}<small style={{ display: 'block' }}>{surveyLabel('teamSize', r.teamSize)}</small></td>
                      <td>{r.sources.map((s) => (s === 'outro' ? r.sourceOther ?? 'Outro' : surveyLabel('sources', s))).join(', ')}</td>
                      <td style={{ maxWidth: 280 }}>{r.features.map((f) => (f === 'outro' ? r.featuresOther ?? 'Outro' : surveyLabel('features', f))).join(', ')}</td>
                      <td style={{ maxWidth: 260 }}><small>{r.comment ?? '—'}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
