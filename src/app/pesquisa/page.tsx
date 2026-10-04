'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Heart, ListChecks, Timer } from 'lucide-react';
import AuthLayout, { type AuthSide } from '@/components/AuthLayout';
import Logo from '@/components/Logo';
import { FormError, Loading } from '@/components/ui';
import { errorMessage, surveyApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { firstName } from '@/lib/format';
import { SURVEY_BUSINESS, SURVEY_FEATURES, SURVEY_SOURCES, SURVEY_TEAM, type SurveyOption } from '@/lib/survey';

// Pesquisa inicial de todo usuário de empresa (convite no login ou aviso no
// painel). Uma pergunta por etapa, no mesmo layout do login.

const SIDE: AuthSide = {
  title: 'Queremos conhecer o seu negócio.',
  text: 'Com as suas respostas, a gente prioriza o que realmente faz diferença no dia a dia da sua empresa.',
  items: [
    { icon: Timer, text: 'Leva menos de 3 minutos' },
    { icon: ListChecks, text: 'São só 4 perguntas de marcar' },
    { icon: Heart, text: 'Ajuda a melhorar a Sysora para você' },
  ],
};

type Answers = {
  sources: string[]; sourceOther: string; business: string; businessOther: string;
  teamSize: string; features: string[]; featuresOther: string; comment: string;
};
const EMPTY: Answers = { sources: [], sourceOther: '', business: '', businessOther: '', teamSize: '', features: [], featuresOther: '', comment: '' };
const STEPS = 4;

function Options({ options, selected, multiple, onToggle }: { options: SurveyOption[]; selected: string[]; multiple?: boolean; onToggle: (id: string) => void }) {
  return (
    <div className={`survey-options${multiple ? '' : ' single'}`} role={multiple ? 'group' : 'radiogroup'}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SurveyPage() {
  const router = useRouter();
  const { status, user, company } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Para quem está dentro de uma empresa (o admin master não responde).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !company) router.replace(user?.isSuperAdmin ? '/master' : '/login');
  }, [status, company, user, router]);

  if (status !== 'authenticated' || !company) return <Loading />;

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const toggle = (key: 'sources' | 'features', id: string) =>
    setAnswers((a) => ({ ...a, [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id] }));

  const valid = [
    answers.sources.length > 0 && (!answers.sources.includes('outro') || answers.sourceOther.trim().length > 0),
    Boolean(answers.business) && (answers.business !== 'outro' || answers.businessOther.trim().length > 0),
    Boolean(answers.teamSize),
    answers.features.length > 0,
  ][step];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await surveyApi.submit({
        sources: answers.sources, sourceOther: answers.sourceOther || null,
        business: answers.business, businessOther: answers.businessOther || null,
        teamSize: answers.teamSize,
        features: answers.features, featuresOther: answers.featuresOther || null,
        comment: answers.comment || null,
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!valid) return;
    if (step < STEPS - 1) setStep(step + 1);
    else void submit();
  }

  // "Responder depois": o painel continua lembrando.
  async function later() {
    await surveyApi.dismiss().catch(() => {});
    router.replace('/painel');
  }

  if (done) {
    return (
      <AuthLayout side={SIDE}>
        <div className="auth-card survey">
          <Logo kind="wordmark" className="logo" />
          <CheckCircle2 size={44} />
          <div>
            <h1>Obrigado, {firstName(user?.name ?? '')}!</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Suas respostas já chegaram para a nossa equipe. Elas vão ajudar a decidir as próximas novidades da Sysora.
            </p>
          </div>
          <Link href="/painel" className="btn btn-primary">Ir para o painel <ArrowRight size={16} /></Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout side={SIDE}>
      <div className="auth-card survey">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Logo kind="wordmark" className="logo" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={later}>Responder depois</button>
        </div>

        <div className="stack-sm">
          <small className="muted">Pergunta {step + 1} de {STEPS}</small>
          <div className="survey-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1}>
            <div style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
          </div>
        </div>

        {step === 0 && (
          <>
            <div>
              <h1>Como você conheceu a Sysora?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Pode marcar mais de uma opção.</p>
            </div>
            <Options options={SURVEY_SOURCES} selected={answers.sources} multiple onToggle={(id) => toggle('sources', id)} />
            {answers.sources.includes('outro') && (
              <input className="input" maxLength={200} autoFocus value={answers.sourceOther} onChange={(e) => set('sourceOther', e.target.value)} placeholder="Conte onde foi" />
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h1>Qual é o ramo da sua empresa?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Escolha o que mais se parece com o seu negócio.</p>
            </div>
            <Options options={SURVEY_BUSINESS} selected={[answers.business]} onToggle={(id) => set('business', id)} />
            {answers.business === 'outro' && (
              <input className="input" maxLength={200} autoFocus value={answers.businessOther} onChange={(e) => set('businessOther', e.target.value)} placeholder="Com o que você trabalha?" />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h1>Quantas pessoas trabalham com você?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Contando com você.</p>
            </div>
            <Options options={SURVEY_TEAM} selected={[answers.teamSize]} onToggle={(id) => set('teamSize', id)} />
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h1>O que não pode faltar no seu sistema?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Marque tudo o que ajudaria no dia a dia, mesmo que ainda não exista na Sysora.</p>
            </div>
            <Options options={SURVEY_FEATURES} selected={answers.features} multiple onToggle={(id) => toggle('features', id)} />
            {answers.features.includes('outro') && (
              <input className="input" maxLength={200} autoFocus value={answers.featuresOther} onChange={(e) => set('featuresOther', e.target.value)} placeholder="Qual funcionalidade?" />
            )}
            <textarea
              className="textarea"
              maxLength={1000}
              value={answers.comment}
              onChange={(e) => set('comment', e.target.value)}
              placeholder="Quer contar mais alguma coisa? Uma ideia, uma dificuldade… (opcional)"
            />
          </>
        )}

        <FormError message={error} />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          {step > 0
            ? <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={16} />Voltar</button>
            : <span />}
          <button type="button" className="btn btn-primary" onClick={next} disabled={!valid || busy}>
            {busy && <span className="spinner" />}
            {step < STEPS - 1 ? <>Continuar <ArrowRight size={16} /></> : 'Enviar respostas'}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
