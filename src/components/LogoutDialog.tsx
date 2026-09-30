'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from './ui';
import { useAuth } from '@/lib/auth';

// Confirmação antes de encerrar a sessão (usada em todos os perfis).
export default function LogoutDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    await logout();
    router.replace('/login');
  }

  return (
    <ConfirmDialog
      title="Sair da conta?"
      message="Você vai precisar entrar novamente com seu e-mail e senha para acessar o Sysora."
      confirmLabel="Sair"
      danger
      busy={busy}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
