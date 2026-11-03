import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A modal dialog: closes on Escape, keeps Tab focus inside and gives focus back when it closes. */
export function Dialog({ label, onClose, className, children }: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // Read while rendering: autoFocus inside the dialog moves focus before effects run.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const inside = panel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const node = panel.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      // Only once the dialog is really gone; a Strict Mode re-run keeps the node.
      setTimeout(() => { if (!node?.isConnected) opener?.focus?.(); });
    };
  }, [opener]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div ref={panel} className={cn('bg-white rounded-lg shadow-xl w-full h-[85vh] flex flex-col overflow-hidden', className)}>{children}</div>
    </div>
  );
}
