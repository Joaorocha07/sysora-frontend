import Link from 'next/link';
import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Política de Privacidade | Sysora' };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <p>
        Esta Política explica como a {LEGAL.brand} ({LEGAL.company}, CNPJ {LEGAL.document}, com sede em {LEGAL.address}) trata dados pessoais,
        de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, “LGPD”). Ela vale para o site, o sistema e o chatbot de WhatsApp da {LEGAL.brand}.
      </p>

      <h2>1. Quem é responsável pelos dados</h2>
      <ul>
        <li>
          <strong>Dados de quem usa a {LEGAL.brand}</strong> (donos, administradores e funcionários das empresas): a {LEGAL.brand} é a <strong>controladora</strong>.
        </li>
        <li>
          <strong>Dados dos clientes das empresas</strong> (pessoas cadastradas na agenda ou que conversam com o bot no WhatsApp de uma empresa): cada empresa é a
          <strong> controladora</strong> e a {LEGAL.brand} atua como <strong>operadora</strong>, tratando esses dados só para prestar o serviço, conforme as instruções da empresa.
          Pedidos sobre esses dados devem ser feitos à empresa com quem a pessoa se relaciona.
        </li>
      </ul>

      <h2>2. Dados que coletamos</h2>
      <h3>Da sua conta</h3>
      <ul>
        <li>Nome, e-mail, telefone e senha (guardada só como código irreversível, nunca em texto).</li>
        <li>Foto e e-mail do Google, se você entrar com o Google.</li>
        <li>Dados da empresa: nome, CPF ou CNPJ, telefone, e-mail, horários de funcionamento, serviços, produtos e configurações do bot.</li>
        <li>Plano, situação da assinatura e histórico de pagamentos. Os dados do cartão são enviados direto ao Mercado Pago e não ficam com a {LEGAL.brand}.</li>
        <li>Respostas da pesquisa inicial (opcional) e pedidos feitos sobre os seus dados.</li>
      </ul>
      <h3>Do uso do sistema</h3>
      <ul>
        <li>Registros de acesso (data, hora e endereço IP), exigidos pelo Marco Civil da Internet (Lei nº 12.965/2014).</li>
        <li>Data do último acesso, data do aceite destes documentos e a sua escolha sobre cookies (o IP dessa escolha é guardado só de forma codificada).</li>
      </ul>
      <h3>Dos clientes das empresas (como operadora)</h3>
      <ul>
        <li>Nome, telefone/WhatsApp, e-mail, aniversário e observações cadastrados pela empresa.</li>
        <li>Agendamentos e o histórico das conversas no WhatsApp com o bot e com a equipe, incluindo a transcrição de áudios quando esse recurso está ligado.</li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <table className="legal-table">
        <thead><tr><th>Finalidade</th><th>Base legal (art. 7º da LGPD)</th></tr></thead>
        <tbody>
          <tr><td>Criar e manter sua conta, prestar o serviço (agenda, bot, lembretes, conversas)</td><td>Execução de contrato (inciso V)</td></tr>
          <tr><td>Cobrar a assinatura e emitir comprovantes</td><td>Execução de contrato e cumprimento de obrigação legal (incisos V e II)</td></tr>
          <tr><td>Guardar registros de acesso e dados fiscais pelo prazo da lei</td><td>Cumprimento de obrigação legal (inciso II)</td></tr>
          <tr><td>Segurança, prevenção a fraudes e suporte</td><td>Legítimo interesse (inciso IX) e proteção ao crédito (inciso X)</td></tr>
          <tr><td>Melhorar o produto com a pesquisa inicial e mensagens sobre a {LEGAL.brand}</td><td>Legítimo interesse (inciso IX), com opção de não participar</td></tr>
          <tr><td>Cookies opcionais de estatísticas e marketing</td><td>Consentimento (inciso I), que pode ser retirado a qualquer momento</td></tr>
        </tbody>
      </table>

      <h2>4. Com quem compartilhamos</h2>
      <p>Não vendemos dados pessoais. Compartilhamos apenas o necessário com fornecedores que nos ajudam a prestar o serviço:</p>
      <table className="legal-table">
        <thead><tr><th>Fornecedor</th><th>Para quê</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Banco de dados e login com Google</td></tr>
          <tr><td>Render e Vercel</td><td>Hospedagem do sistema</td></tr>
          <tr><td>Meta (WhatsApp)</td><td>Enviar e receber as mensagens do WhatsApp da empresa</td></tr>
          <tr><td>Mercado Pago</td><td>Processar os pagamentos das assinaturas</td></tr>
          <tr><td>Google</td><td>Login com a conta Google, se você escolher</td></tr>
          <tr><td>Anthropic e Groq</td><td>Recursos de inteligência artificial do plano Avançado (entender mensagens, transcrever áudios, sugerir textos)</td></tr>
          <tr><td>Provedor de e-mail</td><td>Enviar e-mails do sistema, como a redefinição de senha</td></tr>
        </tbody>
      </table>
      <p>Também podemos compartilhar dados quando a lei exigir ou por ordem de autoridade competente.</p>

      <h2>5. Transferência internacional</h2>
      <p>
        Alguns desses fornecedores guardam ou processam dados fora do Brasil, principalmente nos Estados Unidos. Nesses casos a transferência segue o art. 33 da LGPD,
        com fornecedores que adotam medidas de segurança e cláusulas contratuais de proteção de dados.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e da empresa: enquanto a conta estiver ativa. Depois do encerramento, são excluídos ou anonimizados, exceto o que a lei mandar guardar.</li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet).</li>
        <li>Dados de pagamento e fiscais: pelo prazo exigido pela legislação fiscal e tributária.</li>
        <li>Dados dos clientes das empresas: conforme a empresa (controladora) definir, enquanto ela usar a {LEGAL.brand}.</li>
      </ul>

      <h2>7. Como protegemos</h2>
      <ul>
        <li>Conexão sempre criptografada (HTTPS).</li>
        <li>Senhas guardadas com hash e chaves de integração (WhatsApp, sessões) criptografadas.</li>
        <li>Os dados de cada empresa ficam separados, e cada pessoa vê apenas o que o seu papel permite.</li>
        <li>Banco de dados sem acesso público e acesso interno restrito.</li>
      </ul>
      <p>Se acontecer um incidente de segurança com risco relevante, avisaremos as pessoas afetadas e a ANPD, como manda o art. 48 da LGPD.</p>

      <h2>8. Seus direitos</h2>
      <p>Pelo art. 18 da LGPD, você pode pedir a qualquer momento:</p>
      <ul>
        <li>confirmação de que tratamos seus dados e acesso a eles;</li>
        <li>correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
        <li>portabilidade dos dados;</li>
        <li>eliminação dos dados tratados com consentimento;</li>
        <li>informação sobre com quem compartilhamos seus dados;</li>
        <li>informação sobre a possibilidade de não consentir e as consequências;</li>
        <li>revogação do consentimento.</li>
      </ul>
      <p>
        Se você tem conta, faça os pedidos em <strong>Configurações → Minha conta → Privacidade e seus dados</strong>, onde também dá para baixar uma cópia dos seus dados.
        Você também pode escrever para o nosso encarregado. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>9. Encarregado de dados (DPO)</h2>
      <p>{LEGAL.dpoName}, e-mail: {LEGAL.dpoEmail}.</p>

      <h2>10. Cookies</h2>
      <p>Usamos cookies necessários para o funcionamento e, só com a sua permissão, cookies opcionais. Detalhes na <Link href="/cookies">Política de Cookies</Link>.</p>

      <h2>11. Crianças e adolescentes</h2>
      <p>A {LEGAL.brand} é um sistema para empresas e não se destina a menores de 18 anos.</p>

      <h2>12. Mudanças nesta Política</h2>
      <p>
        Podemos atualizar esta Política. Mudanças relevantes serão avisadas no site ou no sistema, e a data de atualização fica no topo da página.
        Veja também os <Link href="/termos">Termos de Uso</Link>.
      </p>
    </LegalLayout>
  );
}
