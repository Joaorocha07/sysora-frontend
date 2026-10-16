'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Download, Smartphone } from 'lucide-react';
import { useToast } from './ui';
import { ApiError, errorMessage, pushApi, type PushScope } from '@/lib/api';
import { canInstall, currentSubscription, isIos, isStandalone, onInstallChange, promptInstall, pushSupported, subscribePush } from '@/lib/pwa';

// Minha conta: instalar o Sysora como app e ligar as notificações de mensagens neste aparelho.
export default function AppNotifications() {
  const toast = useToast();
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [config, setConfig] = useState<{ enabled: boolean; publicKey: string | null } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [scope, setScope] = useState<PushScope>('all');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setInstallable(canInstall());
    const off = onInstallChange(() => { setInstallable(canInstall()); setStandalone(isStandalone()); });
    if (!pushSupported()) { setPermission('unsupported'); return off; }
    setPermission(Notification.permission);
    pushApi.config().then(setConfig).catch(() => setConfig({ enabled: false, publicKey: null }));
    currentSubscription().then(async (sub) => {
      if (!sub) return;
      const status = await pushApi.status(sub.endpoint);
      setSubscribed(status.subscribed);
      if (status.scope) setScope(status.scope);
    }).catch(() => {});
    return off;
  }, []);

  async function enable(nextScope = scope) {
    if (!config?.publicKey) return;
    setBusy(true);
    try {
      const sub = await subscribePush(config.publicKey);
      setPermission(Notification.permission);
      const result = await pushApi.subscribe(sub.toJSON(), nextScope, !subscribed);
      setSubscribed(true);
      setScope(result.scope);
      if (!subscribed) toast('Notificações ligadas neste aparelho. Enviamos uma de teste.');
    } catch (err) {
      setPermission(pushSupported() ? Notification.permission : 'unsupported');
      const ours = err instanceof Error && err.message.startsWith('As notificações');
      toast(ours ? (err as Error).message : err instanceof ApiError ? errorMessage(err) : 'Não foi possível ligar as notificações neste navegador.', true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast('Notificações desligadas neste aparelho.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (await promptInstall()) toast('Sysora instalado. Ele abre direto, como um aplicativo.');
  }

  const blocked = permission === 'denied';
  const ios = isIos();

  return (
    <div className="card" style={{ marginTop: 20, maxWidth: 560 }}>
      <div className="card-head"><div><h2>App e notificações</h2><p>Use o Sysora como aplicativo e seja avisado quando um cliente mandar mensagem.</p></div></div>
      <div className="card-body stack">
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <span className="metric-icon"><Smartphone size={17} /></span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block' }}>Instalar o app</strong>
            <small>
              {standalone
                ? 'Você já está usando o Sysora instalado.'
                : installable
                  ? 'Abre direto, sem barra do navegador, e fica no menu iniciar ou na tela do celular.'
                  : ios
                    ? 'No iPhone: abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".'
                    : 'No Chrome ou Edge, use o ícone de instalar na barra de endereço. No Android: menu ⋮ → "Instalar app".'}
            </small>
          </div>
          {installable && !standalone && <button type="button" className="btn btn-sm btn-primary" onClick={install}><Download size={15} />Instalar</button>}
        </div>

        <div className="divider" />

        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <span className="metric-icon">{subscribed ? <Bell size={17} /> : <BellOff size={17} />}</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block' }}>Notificações de mensagens</strong>
            <small>
              {permission === 'unsupported'
                ? ios ? 'No iPhone, as notificações funcionam depois de adicionar o Sysora à Tela de Início (iOS 16.4 ou mais novo).' : 'Este navegador não aceita notificações.'
                : config && !config.enabled
                  ? 'As notificações ainda não foram configuradas no servidor.'
                  : blocked
                    ? 'Bloqueadas neste navegador. Clique no cadeado ao lado do endereço, libere "Notificações" e recarregue a página.'
                    : subscribed
                      ? 'Ligadas neste aparelho. Chegam mesmo com o Sysora fechado (no celular, com o app instalado).'
                      : 'Desligadas neste aparelho. Cada aparelho (computador, celular) liga as suas.'}
            </small>
            {subscribed && (
              <div className="segmented" style={{ marginTop: 10 }}>
                <button type="button" className={scope === 'all' ? 'on' : ''} disabled={busy} onClick={() => void enable('all')}>Toda mensagem de cliente</button>
                <button type="button" className={scope === 'handoff' ? 'on' : ''} disabled={busy} onClick={() => void enable('handoff')}>Só quando pedir a equipe</button>
              </div>
            )}
          </div>
          {permission !== 'unsupported' && config?.enabled && !blocked && (
            subscribed
              ? <button type="button" className="btn btn-sm btn-outline" onClick={disable} disabled={busy}>{busy && <span className="spinner" />}Desligar</button>
              : <button type="button" className="btn btn-sm btn-primary" onClick={() => void enable()} disabled={busy}>{busy && <span className="spinner" />}<Bell size={15} />Ligar</button>
          )}
        </div>
      </div>
    </div>
  );
}
