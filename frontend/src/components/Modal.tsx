import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Overlay dialog. The container is capped to the viewport height and
 * the body scrolls internally, so the header + footer (which usually
 * carries the submit button) are always visible no matter how tall
 * the form gets.
 */
export function Modal({ open, title, onClose, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // Prevent the page behind the modal from scrolling while the
    // modal is open — feels more like a native dialog.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className={`flex w-full ${width} max-h-[calc(100vh-2rem)] flex-col rounded-lg bg-white shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — never scrolls */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body — takes remaining space and scrolls internally.
            `min-h-0` is required so `flex-1` can actually shrink
            in a column flex container. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {/* Footer — never scrolls, always visible */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
