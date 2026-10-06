import Link from 'next/link';
import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Termos de Uso | Sysora' };

export default function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        Estes Termos regulam o uso da {LEGAL.brand}, oferecida por {LEGAL.company}, CNPJ {LEGAL.document}. Ao criar uma conta ou usar o sistema, você concorda com eles
        e com a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A {LEGAL.brand} é um sistema on-line para empresas organizarem clientes, serviços, produtos e agendamentos, com um chatbot de WhatsApp que atende,
        agenda e envia lembretes aos clientes da empresa.
      </p>

      <h2>2. Conta e acesso</h2>
      <ul>
        <li>Você deve informar dados verdadeiros e mantê-los atualizados.</li>
        <li>O acesso é pessoal. Guarde sua senha em segurança e avise-nos se suspeitar de uso indevido.</li>
        <li>O administrador da empresa decide quem entra na equipe e o papel de cada pessoa, e responde pelos acessos que concede.</li>
      </ul>

      <h2>3. Teste grátis, planos e pagamento</h2>
      <ul>
        <li>Novas empresas têm 1 mês de teste grátis no plano Inicial, sem cartão.</li>
        <li>Depois do teste, o uso continua com a assinatura de um plano, paga pelo Mercado Pago. Os valores e recursos de cada plano ficam na página de planos.</li>
        <li>Sem pagamento, o acesso fica limitado à consulta dos dados e o bot deixa de responder, até a regularização.</li>
        <li>Você pode cancelar quando quiser, na tela Assinatura. O acesso segue até o fim do período já pago.</li>
      </ul>

      <h2>4. WhatsApp e mensagens aos clientes</h2>
      <ul>
        <li>A empresa é responsável pelo número de WhatsApp conectado e pelas mensagens enviadas em seu nome, inclusive as do bot.</li>
        <li>A empresa deve ter base legal para tratar os dados dos seus clientes e enviar mensagens a eles, e deve respeitar as políticas do WhatsApp e da Meta. É proibido usar a {LEGAL.brand} para spam ou mensagens não solicitadas.</li>
        <li>Na conexão oficial do WhatsApp, a Meta cobra as mensagens direto da empresa, conforme a tabela dela.</li>
      </ul>

      <h2>5. Inteligência artificial</h2>
      <p>
        Nos planos pagos, a Sora (IA) ajuda a montar o fluxo do bot e o catálogo; no plano Avançado, recursos de IA também interpretam mensagens, transcrevem áudios e sugerem textos. As respostas podem conter erros: revise o que for importante.
        A empresa continua responsável pelo atendimento aos seus clientes.
      </p>

      <h2>6. Uso proibido</h2>
      <ul>
        <li>Violar leis, direitos de terceiros ou a privacidade de outras pessoas.</li>
        <li>Tentar acessar dados de outras empresas, burlar a segurança ou sobrecarregar o sistema.</li>
        <li>Revender ou copiar o sistema sem autorização.</li>
      </ul>
      <p>Podemos suspender contas que descumprirem estes Termos, avisando sempre que possível.</p>

      <h2>7. Dados</h2>
      <p>
        Os dados que a empresa cadastra pertencem a ela. A {LEGAL.brand} trata esses dados como operadora, só para prestar o serviço, conforme a
        <Link href="/privacidade"> Política de Privacidade</Link>.
      </p>

      <h2>8. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para manter o sistema disponível e seguro, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (internet, WhatsApp,
        provedores). Na medida permitida por lei, a {LEGAL.brand} não responde por lucros cessantes ou danos indiretos causados por essas interrupções.
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>A marca, o sistema e o conteúdo da {LEGAL.brand} são protegidos. Estes Termos dão apenas o direito de uso durante a assinatura.</p>

      <h2>10. Mudanças e contato</h2>
      <p>
        Podemos atualizar estes Termos, avisando mudanças relevantes com antecedência. Dúvidas: {LEGAL.dpoEmail}. Fica eleito o foro de {LEGAL.forum},
        salvo regra legal em contrário (por exemplo, o foro do consumidor).
      </p>
    </LegalLayout>
  );
}
