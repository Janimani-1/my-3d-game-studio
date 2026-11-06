import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { translate, formatNumber, type Lang, type MsgKey } from '../core/i18n';

// ---------- i18n context ----------
export interface I18n {
  lang: Lang;
  t: (k: MsgKey, vars?: Record<string, string | number>) => string;
  n: (v: number, digits?: number) => string;
}
export const I18nCtx = createContext<I18n>({ lang: 'fa', t: (k) => translate('fa', k), n: (v) => String(v) });
export const useI18n = () => useContext(I18nCtx);
export function makeI18n(lang: Lang): I18n {
  return { lang, t: (k, v) => translate(lang, k, v), n: (v, d = 0) => formatNumber(lang, v, d) };
}

// ---------- Toasts ----------
export type ToastKind = 'info' | 'ok' | 'warn' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}
interface UiApi {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (message: string, opts?: { danger?: boolean; okLabel?: string }) => Promise<boolean>;
  prompt: (message: string, initial: string) => Promise<string | null>;
}
export const UiCtx = createContext<UiApi>({
  toast: () => {},
  confirm: async () => false,
  prompt: async () => null,
});
export const useUi = () => useContext(UiCtx);

interface DialogState {
  message: string;
  input?: string;
  danger?: boolean;
  okLabel?: string;
  resolve: (v: { ok: boolean; value?: string }) => void;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.filter((x) => x.text !== text), { id, kind, text }].slice(-3));
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const confirm = useCallback(
    (message: string, opts?: { danger?: boolean; okLabel?: string }) =>
      new Promise<boolean>((resolve) => setDialog({ message, ...opts, resolve: (r) => resolve(r.ok) })),
    [],
  );
  const prompt = useCallback(
    (message: string, initial: string) =>
      new Promise<string | null>((resolve) => setDialog({ message, input: initial, resolve: (r) => resolve(r.ok ? r.value ?? '' : null) })),
    [],
  );

  useEffect(() => {
    if (dialog?.input !== undefined) setTimeout(() => inputRef.current?.select(), 30);
  }, [dialog]);

  const close = (ok: boolean) => {
    if (!dialog) return;
    dialog.resolve({ ok, value: inputRef.current?.value });
    setDialog(null);
  };

  return (
    <UiCtx.Provider value={{ toast, confirm, prompt }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`} onClick={() => setToasts((ts) => ts.filter((y) => y.id !== x.id))}>
            {x.text}
          </div>
        ))}
      </div>
      {dialog && (
        <div className="modal-back" onClick={() => close(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="modal-msg">{dialog.message}</p>
            {dialog.input !== undefined && (
              <input
                ref={inputRef}
                className="text-input"
                defaultValue={dialog.input}
                maxLength={120}
                onKeyDown={(e) => e.key === 'Enter' && close(true)}
                data-testid="dialog-input"
              />
            )}
            <div className="modal-actions">
              <button className="btn" onClick={() => close(false)} data-testid="dialog-cancel">
                {t('cancel')}
              </button>
              <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} data-testid="dialog-ok">
                {dialog.okLabel ?? t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiCtx.Provider>
  );
}

export function ComingLater({ items }: { items: string[] }) {
  const { t } = useI18n();
  return (
    <section className="card coming">
      <h3>
        {t('comingLater')} <span className="badge">{t('comingLater')}</span>
      </h3>
      <p className="muted small">{t('comingLaterNote')}</p>
      <ul className="coming-list">
        {items.map((x) => (
          <li key={x}>
            <span className="lock" aria-hidden>
              ⏳
            </span>{' '}
            {x}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Save a file. In a normal browser tab this is a regular <a download>.
 * Inside the claude.ai preview frame, downloads are blocked, so the host's optional
 * "downloads" capability is used when present (the viewer confirms each save).
 */
export async function downloadBlob(blob: Blob, name: string): Promise<void> {
  const host = (window as any).claude;
  if (isFramed && host?.use) {
    try {
      const dl = await Promise.race([host.use('downloads'), new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (dl) {
        await (dl as any).save({ filename: name, data: blob });
        return;
      }
    } catch {
      /* declined or unavailable → fall back below */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const isFramed = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
