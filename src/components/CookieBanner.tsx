'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { Modal, Switch } from './ui';
import { PREFERENCES_EVENT, readConsent, saveConsent } from '@/lib/consent';

// Aviso de cookies (LGPD): aparece na primeira visita (ou quando a política
// muda) até a pessoa escolher. "Preferências de cookies" (rodapé, Minha conta)
// reabre a escolha. Os cookies necessários funcionam sempre; os opcionais só
// com permissão (lib/consent.ts).
export default function CookieBanner() {
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Lido só no navegador: a página do servidor nunca mostra o aviso.
    setShow(!readConsent());
    const open = () => {
      const current = readConsent();
      setAnalytics(Boolean(current?.analytics));
      setMarketing(Boolean(current?.marketing));
      setEditing(true);
    };
    window.addEventListener(PREFERENCES_EVENT, open);
    return () => window.removeEventListener(PREFERENCES_EVENT, open);
  }, []);

  function decide(choice: { analytics: boolean; marketing: boolean }) {
    saveConsent(choice);
    setShow(false);
    setEditing(false);
  }

  return (
    <>
      {show && !editing && (
        <div className="cookie-banner" role="region" aria-label="Aviso de cookies">
          <Cookie size={22} className="cookie-banner-icon" aria-hidden />
          <p>
            Usamos cookies e armazenamento local <strong>necessários</strong> para o login, a segurança e as suas preferências. Com a sua permissão,
            também podemos usar cookies <strong>opcionais</strong> de estatísticas e marketing. Saiba mais na{' '}
            <Link href="/cookies">Política de Cookies</Link> e na <Link href="/privacidade">Política de Privacidade</Link>.
          </p>
          <div className="cookie-banner-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAnalytics(false); setMarketing(false); setEditing(true); }}>Personalizar</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => decide({ analytics: false, marketing: false })}>Só os necessários</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => decide({ analytics: true, marketing: true })}>Aceitar todos</button>
          </div>
        </div>
      )}

      {editing && (
        <Modal
          title="Preferências de cookies"
          description="Escolha o que a Sysora pode usar neste navegador. Você pode mudar quando quiser pelo link “Preferências de cookies”."
          onClose={() => setEditing(false)}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => decide({ analytics: false, marketing: false })}>Só os necessários</button>
            <button type="button" className="btn btn-primary" onClick={() => decide({ analytics, marketing })}>Salvar escolha</button>
          </>}
        >
          <div className="stack">
            <Switch
              checked
              disabled
              onChange={() => {}}
              label="Necessários (sempre ativos)"
              description="Mantêm você conectado, protegem a conta, guardam o tema escolhido e permitem o pagamento seguro. Sem eles o sistema não funciona."
            />
            <Switch
              checked={analytics}
              onChange={setAnalytics}
              label="Estatísticas"
              description="Ajudam a entender, de forma agregada, como o site é usado, para melhorar a Sysora."
            />
            <Switch
              checked={marketing}
              onChange={setMarketing}
              label="Marketing"
              description="Permitem medir campanhas e mostrar anúncios da Sysora mais relevantes em outros sites."
            />
            <small className="muted">
              Hoje a Sysora não usa cookies de estatísticas nem de marketing. Se passar a usar, eles só serão ativados com a sua permissão.
              Detalhes na <Link href="/cookies" style={{ textDecoration: 'underline' }}>Política de Cookies</Link>.
            </small>
          </div>
        </Modal>
      )}
    </>
  );
}
