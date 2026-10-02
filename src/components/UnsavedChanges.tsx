'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Modal } from './ui';

// Aviso de alterações não salvas. Uma tela com rascunho registra o guarda
// (useUnsavedChanges); enquanto houver pendências, sair por um link interno,
// por uma ação da própria página (useConfirmLeave, ex.: trocar de aba) ou
// fechar/recarregar a aba pede confirmação. "Salvar e continuar" salva e
// segue para onde a pessoa ia.

type Guard = { save: () => Promise<boolean> };
type Ctx = { setGuard: (guard: Guard | null) => void; confirmLeave: (proceed: () => void) => void };

const UnsavedContext = createContext<Ctx>({ setGuard: () => {}, confirmLeave: (proceed) => proceed() });

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guard = useRef<Guard | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const setGuard = useCallback((next: Guard | null) => { guard.current = next; }, []);
  const confirmLeave = useCallback((proceed: () => void) => {
    if (guard.current) setPending(() => proceed);
    else proceed();
  }, []);

  useEffect(() => {
    // Captura antes do <Link> do Next tratar o clique.
    const onClick = (e: MouseEvent) => {
      if (!guard.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return; // site externo: o aviso do navegador cuida
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // âncora na mesma página
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    // Fechar ou recarregar a aba: o navegador mostra o aviso padrão dele.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!guard.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [router]);

  function go(proceed: (() => void) | null) {
    guard.current = null;
    setPending(null);
    proceed?.();
  }

  async function saveAndGo() {
    if (!guard.current) return go(pending);
    setSaving(true);
    const ok = await guard.current.save().catch(() => false);
    setSaving(false);
    // Não salvou (ex.: fluxo com erro): fica na página para corrigir.
    if (ok) go(pending);
    else setPending(null);
  }

  return (
    <UnsavedContext.Provider value={{ setGuard, confirmLeave }}>
      {children}
      {pending && (
        <Modal
          title="Alterações não salvas"
          onClose={() => setPending(null)}
          footer={<>
            <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => setPending(null)} disabled={saving}>Continuar editando</button>
            <button type="button" className="btn btn-outline" onClick={() => go(pending)} disabled={saving}>Sair sem salvar</button>
            <button type="button" className="btn btn-primary" onClick={saveAndGo} disabled={saving}>{saving ? <span className="spinner" /> : <Save size={16} />}Salvar e continuar</button>
          </>}
        >
          <p className="muted">Você fez alterações que ainda não foram salvas. Se sair agora sem salvar, elas serão perdidas.</p>
        </Modal>
      )}
    </UnsavedContext.Provider>
  );
}

// Registra o rascunho da tela. `save` devolve true quando salvou.
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const { setGuard } = useContext(UnsavedContext);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    setGuard(dirty ? { save: () => saveRef.current() } : null);
    return () => setGuard(null);
  }, [dirty, setGuard]);
}

// Para ações da própria página que descartariam o rascunho (trocar de aba, sair da conta).
export const useConfirmLeave = () => useContext(UnsavedContext).confirmLeave;
