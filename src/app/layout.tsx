import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import CookieBanner from '@/components/CookieBanner';
import MaintenanceBanner from '@/components/MaintenanceBanner';

const title = 'Sysora | Clientes, agenda e WhatsApp no automático';
const description = 'Cadastro de clientes, serviços e agendamentos com um chatbot de WhatsApp que atende, agenda e lembra seus clientes sozinho.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: 'Sysora', locale: 'pt_BR', type: 'website' },
  // App instalável (manifest.ts): no iPhone, "Adicionar à Tela de Início" abre sem a barra do Safari.
  // Ícones da aba e do iPhone: src/app/icon.png e src/app/apple-icon.png (convenção do Next).
  appleWebApp: { capable: true, title: 'Sysora', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f3' },
    { media: '(prefers-color-scheme: dark)', color: '#080808' },
  ],
};

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura.
const themeScript = `(function(){var t;try{t=localStorage.getItem('sysora-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Extensões do navegador podem injetar atributos no body antes da hidratação. */}
      <body suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            {children}
            <CookieBanner />
            <MaintenanceBanner />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
