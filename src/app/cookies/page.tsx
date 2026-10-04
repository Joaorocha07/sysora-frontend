import Link from 'next/link';
import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';
import CookiePreferencesButton from '@/components/CookiePreferencesButton';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Política de Cookies | Sysora' };

// Lista do que o site usa de verdade. Ao adicionar um script de estatísticas ou
// marketing, inclua aqui e só carregue com hasConsent() (lib/consent.ts).
const NECESSARY = [
  ['sysora_refresh_token', 'Cookie (Sysora)', 'Mantém você conectado com segurança. Não pode ser lido por scripts.', '7 dias'],
  ['sysora-theme', 'Armazenamento local', 'Guarda o tema escolhido (claro ou escuro).', 'Até você limpar o navegador'],
  ['sysora-consent', 'Armazenamento local', 'Guarda a sua escolha sobre cookies.', 'Até a política mudar ou você limpar o navegador'],
  ['Login com Google', 'Armazenamento local (Supabase)', 'Conclui o login ou o cadastro com a conta Google.', 'Apagado logo depois do login'],
  ['Avisos de sessão e cadastro', 'Armazenamento da sessão', 'Mostra avisos do login e continua o cadastro com Google.', 'Até fechar a aba'],
  ['Modo demonstração', 'Armazenamento local e da sessão', 'Usado só se você abrir a demonstração.', 'Até sair da demonstração'],
  ['Mercado Pago', 'Cookies de terceiro', 'Só na tela de pagamento: processar o pagamento e prevenir fraudes.', 'Definido pelo Mercado Pago'],
  ['Meta (Facebook)', 'Cookies de terceiro', 'Só ao conectar o WhatsApp oficial: janela de login da Meta.', 'Definido pela Meta'],
];

export default function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies">
      <p>
        Cookies são pequenos arquivos que um site guarda no seu navegador. O armazenamento local funciona de forma parecida. Esta página explica o que a {LEGAL.brand} usa,
        para quê, e como você controla isso, conforme a LGPD e o guia de cookies da ANPD.
      </p>

      <h2>1. Necessários (sempre ativos)</h2>
      <p>Sem eles o site e o sistema não funcionam: login, segurança, preferências e pagamento. Por isso não dependem de consentimento.</p>
      <div className="table-wrap">
        <table className="legal-table">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Para quê</th><th>Duração</th></tr></thead>
          <tbody>{NECESSARY.map(([name, type, purpose, duration]) => <tr key={name}><td><strong>{name}</strong></td><td>{type}</td><td>{purpose}</td><td>{duration}</td></tr>)}</tbody>
        </table>
      </div>

      <h2>2. Estatísticas e marketing (opcionais)</h2>
      <p>
        Hoje a {LEGAL.brand} <strong>não usa</strong> cookies de estatísticas nem de marketing. Se passar a usar (por exemplo, para medir visitas ou campanhas),
        eles só serão ativados com a sua permissão, e esta página será atualizada com a lista.
      </p>

      <h2>3. Como controlar</h2>
      <ul>
        <li>Mude a sua escolha a qualquer momento: <CookiePreferencesButton />.</li>
        <li>Você também pode apagar ou bloquear cookies nas configurações do navegador. Bloquear os necessários impede o login.</li>
      </ul>

      <h2>4. Mais informações</h2>
      <p>Veja a <Link href="/privacidade">Política de Privacidade</Link> ou fale com o nosso encarregado de dados: {LEGAL.dpoEmail}.</p>
    </LegalLayout>
  );
}
