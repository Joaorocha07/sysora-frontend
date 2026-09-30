# Sysora — Frontend

Interface do Sysora em Next.js 15 (App Router), React 19 e TypeScript, com ícones Lucide e CSS próprio (`src/app/globals.css`). A identidade é só preto e branco, com componentes arredondados, fontes DM Sans e Manrope, e tema claro e escuro.

## Rodando

```sh
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:3333/api
npm run dev                   # http://localhost:3000
```

Verificação: `npm run typecheck` e `npm run build`.

## Rotas

| Rota | Quem acessa | Conteúdo |
| --- | --- | --- |
| `/` | público | Apresentação do produto |
| `/login`, `/esqueci-senha`, `/redefinir-senha` | público | Acesso e botões do modo demonstração |
| `/cadastro` | público | Cadastro da empresa (escolha de plano e teste grátis) ou pedido de acesso de funcionário (código de convite) |
| `/assinatura` | empresa (admin gerencia) | Plano, status, troca de plano e empresas da conta (segunda empresa no Avançado) |
| `/master` | admin master | Empresas, planos, suspensão e “Entrar” em uma empresa |
| `/painel` | empresa | Indicadores, agenda do dia e próximos horários |
| `/agenda` | empresa | Visão por semana ou dia, novo agendamento com horários livres, confirmar, concluir, remarcar e cancelar |
| `/clientes`, `/clientes/[id]` | empresa | Cadastro, ficha, histórico e total gasto |
| `/conversas` | empresa | Conversas do WhatsApp; responder assume o atendimento no lugar do bot |
| `/servicos` | empresa (edição só admin) | Catálogo com duração, preço e ordem |
| `/whatsapp` | admin | QR Code, teste de envio e mensagens do bot, lembretes e atendimento humano |
| `/equipe` | admin | Administradores e funcionários |
| `/configuracoes` | admin (funcionário vê só “Minha conta”) | Empresa, horários de funcionamento e senha |

## Modo demonstração

Os botões "Painel da empresa" e "Painel master" no login ligam `src/lib/demo.ts`: uma API falsa no navegador, com dados fictícios gerados a partir da data de hoje. Ela serve para ver o layout sem backend. O `request()` de `src/lib/api.ts` desvia para ela enquanto `localStorage['sysora-demo']` estiver definido.

`NEXT_PUBLIC_SUPPORT_URL` (opcional) é o link do botão "Assinar agora" na tela de assinatura, por exemplo um WhatsApp de vendas ou uma página de pagamento.

## Marca

As logos originais ficam na raiz deste projeto. Versões recortadas e com fundo transparente estão em `public/brand/`:

- `sysora-icon-*` e `sysora-wordmark-*`, nas cores `white` e `black`.
- O componente `Logo` escolhe a versão certa conforme o tema.

Os ícones do app (`src/app/icon.png` e `apple-icon.png`) foram gerados a partir do símbolo.
# sysora-frontend
