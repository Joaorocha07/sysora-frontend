/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {
  ArrowRight, Bell, Bot, Building2, CalendarCheck, CalendarDays, Check, LayoutDashboard, MessageCircle,
  ShieldCheck, Sparkles, UserCog, Users, Wrench,
} from 'lucide-react';
import { LegalLinks } from '@/components/LegalLayout';
import Logo from '@/components/Logo';
import PlanCard from '@/components/PlanCard';
import { money } from '@/lib/format';
import { PLANS, TRIAL_LABEL } from '@/lib/plans';
import ThemeToggle from '@/components/ThemeToggle';

const features = [
  { icon: Bot, title: 'Chatbot que agenda sozinho', text: 'O bot responde no WhatsApp, mostra os serviços, oferece dias e horários livres e confirma o agendamento. Sem ninguém da equipe precisar tocar no celular.', dark: true },
  { icon: Users, title: 'Cadastro automático de clientes', text: 'Quem manda mensagem vira cliente no sistema, com nome, telefone e todo o histórico da conversa e dos atendimentos.' },
  { icon: CalendarDays, title: 'Agenda inteligente', text: 'Visão semanal e diária, respeitando horário de funcionamento, intervalo de almoço, duração de cada serviço e atendimentos simultâneos.' },
  { icon: Wrench, title: 'Cadastro de serviços', text: 'Nome, descrição, duração e preço. O bot usa esse catálogo para oferecer as opções e calcular o tempo de cada agendamento.' },
  { icon: Bell, title: 'Lembretes e confirmação', text: 'Mensagem na véspera e pouco antes do horário. O cliente confirma, remarca ou cancela respondendo com um número.' },
  { icon: MessageCircle, title: 'Atendimento humano quando precisar', text: 'A equipe acompanha as conversas e responde pelo sistema. O bot pausa com aquele cliente e volta sozinho depois.' },
];

const steps = [
  { title: 'Conecte o WhatsApp', text: 'Conecte o número pela API oficial da Meta em poucos cliques. Quem usa o WhatsApp Business continua atendendo pelo celular.' },
  { title: 'Cadastre seus serviços', text: 'Defina o que você oferece, quanto tempo leva e quanto custa. Configure dias e horários de atendimento.' },
  { title: 'O bot atende', text: 'Clientes mandam “oi” e recebem o menu: agendar, ver horários, conhecer os serviços ou falar com a equipe.' },
  { title: 'Tudo cai no sistema', text: 'Clientes, agendamentos e conversas ficam organizados no painel, prontos para a sua equipe acompanhar.' },
];

const roles = [
  {
    icon: Building2, badge: 'Administrador', title: 'O dono de cada empresa',
    items: ['Conecta o WhatsApp e configura o bot', 'Cadastra serviços, horários e equipe', 'No Avançado, gerencia até 2 empresas', 'Tudo que o funcionário faz'],
  },
  {
    icon: UserCog, badge: 'Funcionário', title: 'A equipe do dia a dia',
    items: ['Consulta e organiza a agenda', 'Cadastra e atualiza clientes', 'Responde as conversas do WhatsApp', 'Marca atendimentos como concluídos'],
  },
];

// Diferenças entre os planos (tabela da seção Planos). true/false = tem ou não.
const [INICIAL, AVANCADO] = PLANS;
const perMonthYearly = (cents: number) => `${money(Math.round(cents / 12))}/mês`;
const comparison: { label: string; inicial: string | boolean; avancado: string | boolean }[] = [
  { label: 'Preço mensal', inicial: money(INICIAL.priceCents), avancado: money(AVANCADO.priceCents) },
  { label: 'No plano anual (pagamento único)', inicial: perMonthYearly(INICIAL.yearlyPriceCents), avancado: perMonthYearly(AVANCADO.yearlyPriceCents) },
  { label: 'Empresas', inicial: '1', avancado: `Até ${AVANCADO.maxCompanies}` },
  { label: 'Números de WhatsApp', inicial: '1', avancado: '1 por empresa' },
  { label: 'Equipe por empresa', inicial: `Administrador + ${INICIAL.maxEmployees}`, avancado: `Administrador + ${AVANCADO.maxEmployees}` },
  { label: 'Chatbot que cadastra e agenda', inicial: true, avancado: true },
  { label: 'Agenda, clientes e serviços ilimitados', inicial: true, avancado: true },
  { label: 'Lembretes e confirmação de presença', inicial: true, avancado: true },
  { label: 'Sora: IA que monta o fluxo do bot', inicial: 'Uso básico no mês', avancado: 'Mais que o dobro de uso' },
  { label: 'Bot entende mensagens escritas do jeito do cliente', inicial: false, avancado: true },
  { label: 'Bot entende áudios', inicial: false, avancado: true },
  { label: 'Descrições de serviços com IA', inicial: false, avancado: true },
  { label: 'Troca rápida entre as empresas', inicial: false, avancado: true },
  { label: 'Suporte prioritário', inicial: false, avancado: true },
];

function CompareCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={18} aria-label="Incluído" />;
  if (value === false) return <span className="muted" aria-label="Não incluído">—</span>;
  return <>{value}</>;
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="lp-nav">
        <Logo kind="wordmark" className="word" />
        <nav>
          <a href="#recursos">Recursos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#acessos">Acessos</a>
        </nav>
        <div className="spacer" />
        <ThemeToggle />
        <Link href="/login" className="btn btn-ghost btn-sm hide-mobile">Entrar</Link>
        <Link href="/cadastro" className="btn btn-primary btn-sm">Teste grátis <ArrowRight size={15} /></Link>
      </header>

      <main className="lp-wrap">
        <section className="hero">
          <div>
            <div className="hero-pill"><b>Novo</b> Chatbot de WhatsApp integrado</div>
            <h1>Seus clientes e sua agenda, <em>no automático.</em></h1>
            <p className="lead">
              A Sysora é um sistema de cadastro de clientes e agendamentos com um chatbot conectado ao WhatsApp
              da sua empresa. Ele conversa, cadastra, agenda e lembra seus clientes, enquanto você cuida do que importa.
            </p>
            <div className="cta">
              <Link href="/cadastro" className="btn btn-primary btn-lg">Testar {TRIAL_LABEL} grátis <ArrowRight size={17} /></Link>
              <a href="#planos" className="btn btn-outline btn-lg">Ver planos</a>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div className="mock" aria-hidden>
              <div className="mock-head">
                <img src="/brand/sysora-icon-white.png" alt="" />
                <div><strong>Sua empresa</strong><small>online · atendimento automático</small></div>
              </div>
              <div className="mock-chat">
                <div className="bubble">Oi! Queria marcar um horário</div>
                <div className="bubble own">Olá, Ana! Bem-vinda. Como posso te ajudar?{'\n\n'}1) Agendar um horário{'\n'}2) Meus agendamentos{'\n'}3) Serviços e valores{'\n'}4) Falar com a equipe</div>
                <div className="bubble">Quero agendar uma consulta</div>
                <div className="bubble own">Próximos dias com horário livre:{'\n\n'}1) amanhã (quinta){'\n'}2) sexta-feira{'\n'}3) sábado</div>
                <div className="bubble">Sexta às 14h dá certo?</div>
                <div className="bubble own">Agendado! Sexta às 14:00. Até lá, Ana! ✅</div>
              </div>
            </div>
            <div className="mock-float">
              <span className="metric-icon"><CalendarCheck size={18} /></span>
              <div><strong style={{ display: 'block', fontSize: 14 }}>Novo agendamento</strong><small>criado pelo bot às 21:47</small></div>
            </div>
          </div>
        </section>

        <div className="logos-strip">
          {['Clínicas', 'Salões e barbearias', 'Estúdios', 'Consultórios', 'Pet shops', 'Academias', 'Prestadores de serviço'].map((t) => (
            <span key={t} className="badge plain">{t}</span>
          ))}
        </div>

        <section className="section" id="recursos">
          <div className="section-head">
            <span className="eyebrow">Recursos</span>
            <h2>Tudo o que o atendimento precisa, em um só lugar.</h2>
            <p>Feito para empresas que vivem de agenda e atendem pelo WhatsApp. Cada empresa tem o seu espaço, com seus dados, sua equipe e o seu número.</p>
          </div>
          <div className="features">
            {features.map(({ icon: Icon, title, text, dark }) => (
              <article key={title} className={`feature${dark ? ' dark' : ''}`}>
                <span className="metric-icon"><Icon size={21} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="como-funciona">
          <div className="section-head">
            <span className="eyebrow">Como funciona</span>
            <h2>Da conexão ao primeiro agendamento em minutos.</h2>
            <p>Conexão oficial com o WhatsApp, sem risco de bloqueio do número: você entra com a sua conta da Meta e o bot começa a atender na hora.</p>
          </div>
          <div className="flow">
            {steps.map((s) => (
              <div key={s.title} className="flow-step">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="planos">
          <div className="section-head">
            <span className="eyebrow">Planos</span>
            <h2>Um preço justo para atender no automático.</h2>
            <p>Comece com {TRIAL_LABEL} grátis, sem cartão, e troque de plano quando quiser. O Inicial custa menos do que um único cliente que o bot deixa de perder por mês.</p>
          </div>
          <div className="pricing">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                action={<Link href={plan.id === 'AVANCADO' ? '/cadastro?plano=avancado' : '/cadastro?plano=inicial'} className="btn btn-primary btn-lg btn-block">Começar teste grátis</Link>}
              />
            ))}
          </div>

          <div className="plan-compare">
            <h3>Compare os planos</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Recurso</th><th>{INICIAL.name}</th><th>{AVANCADO.name}</th></tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td><CompareCell value={row.inicial} /></td>
                      <td><CompareCell value={row.avancado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="muted">Os recursos de IA são liberados a partir do primeiro pagamento; o teste grátis de {TRIAL_LABEL} é sem IA.</small>
          </div>
        </section>

        <section className="section" id="acessos">
          <div className="section-head">
            <span className="eyebrow">Acessos</span>
            <h2>Dois níveis de acesso, cada um com o que precisa.</h2>
            <p>Os dados de cada empresa ficam separados, e cada pessoa da equipe vê apenas o que o seu papel permite.</p>
          </div>
          <div className="roles">
            {roles.map(({ icon: Icon, badge, title, items }) => (
              <article key={badge} className="role-card">
                <span className="badge solid"><Icon size={13} />{badge}</span>
                <h3 style={{ fontSize: 20 }}>{title}</h3>
                <ul>{items.map((i) => <li key={i}><Check size={16} />{i}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <img src="/brand/sysora-icon-white.png" alt="" aria-hidden className="logo-on-light" />
          <img src="/brand/sysora-icon-black.png" alt="" aria-hidden className="logo-on-dark" />
          <div>
            <h2>Coloque sua agenda para trabalhar por você.</h2>
            <p>Clientes, serviços, agendamentos e WhatsApp conectados. <Sparkles size={14} style={{ verticalAlign: -2 }} /></p>
          </div>
          <div className="row-wrap">
            <Link href="/cadastro" className="btn btn-lg">Criar minha conta <ArrowRight size={17} /></Link>
          </div>
        </section>

        <footer className="lp-footer">
          <Logo kind="wordmark" />
          <div className="row-wrap" style={{ gap: 18 }}>
            <span className="row"><ShieldCheck size={15} /> WhatsApp oficial</span>
            <span className="row"><LayoutDashboard size={15} /> Multiempresa</span>
          </div>
          <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
            <LegalLinks className="lp-legal" />
            <span>© {new Date().getFullYear()} Sysora. Todos os direitos reservados.</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
