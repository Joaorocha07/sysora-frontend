'use client';

import { useEffect, useState } from 'react';
import AccountForm from '@/components/AccountForm';
import { Loading, PageHead, Switch, useToast } from '@/components/ui';
import { adminApi, errorMessage, type PlatformSettings } from '@/lib/api';

// Configurações da plataforma (valem para todo o Sysora) e a conta do admin master.
export default function MasterSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.settings().then(setSettings).catch((err) => toast(errorMessage(err), true));
  }, [toast]);

  async function update(input: Partial<PlatformSettings>) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...input });
    setSaving(true);
    try {
      setSettings(await adminApi.updateSettings(input));
      toast('Configuração salva.');
    } catch (err) {
      setSettings(previous);
      toast(errorMessage(err), true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="Painel master" title="Configurações" text="Regras que valem para todo o Sysora e a sua conta de admin master." />

      <div className="stack" style={{ maxWidth: 560 }}>
        <div className="card card-pad stack">
          <div><h3>Cadastro pelo site</h3><small>Quem pode criar uma conta nova no Sysora.</small></div>
          <div className="divider" />
          {!settings ? <Loading /> : (
            <Switch
              checked={settings.publicSignupEnabled}
              onChange={(publicSignupEnabled) => update({ publicSignupEnabled })}
              disabled={saving}
              label="Empresas podem se cadastrar sozinhas"
              description="Ligado, qualquer pessoa cria a empresa em /cadastro e começa o teste grátis. Desligado, só você cria empresas aqui no painel. O pedido de acesso de funcionários com o código da empresa continua funcionando."
            />
          )}
        </div>

        <h3 style={{ marginTop: 8 }}>Minha conta</h3>
        <AccountForm />
      </div>
    </>
  );
}
