'use client';

import { AlertCircle, Check, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initials } from '@/lib/format';

// ============ Modal ============
export function Modal({ title, description, onClose, children, footer, wide }: {
  title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Guarda o onClose mais recente sem reexecutar o efeito (o foco inicial só acontece uma vez).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal aria-label={title} ref={ref}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger, busy, onConfirm, onClose }: {
  title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Voltar</button>
      <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
        {busy && <span className="spinner" />}{confirmLabel}
      </button>
    </>}>
      <p className="muted">{message}</p>
    </Modal>
  );
}

// ============ Campos ============
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (value: boolean) => void; label: string; description?: ReactNode; disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
      <span className="switch-text"><strong>{label}</strong>{description && <small>{description}</small>}</span>
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="form-error" role="alert"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{message}</div>;
}

// ============ Diversos ============
// Com `src` (foto do Google) mostra a foto; sem ela, ou se não carregar, as iniciais.
export function Avatar({ name, size, inverse, src }: { name: string; size?: 'sm' | 'lg'; inverse?: boolean; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const photo = src && !failed;
  return (
    <span className={`avatar${size ? ` ${size}` : ''}${inverse && !photo ? ' inverse' : ''}${photo ? ' photo' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Carregando...' }: { label?: string }) {
  return <div className="loading-screen"><div className="row"><span className="spinner" /> {label}</div></div>;
}

export function PageHead({ eyebrow, title, text, actions }: { eyebrow?: string; title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  );
}

// ============ Toasts ============
type Toast = { id: number; text: string; error?: boolean };
const ToastContext = createContext<(text: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { id, text, error }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            {t.error ? <AlertCircle size={17} /> : <Check size={17} />}{t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
