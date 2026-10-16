import type { MetadataRoute } from 'next';

// App instalável (PWA): "Instalar" no Chrome/Edge do computador e "Adicionar à tela inicial" no celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sysora',
    short_name: 'Sysora',
    description: 'Clientes, agenda e WhatsApp no automático.',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Conversas', url: '/conversas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Agenda', url: '/agenda', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
