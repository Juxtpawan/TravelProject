import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Reusable responsive overlay shell for full-screen shared surfaces. */
export default function OverlayLayout({ title, onClose, headerActions, children, labelledBy }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const generatedId = useId();
  const titleId = labelledBy || `overlay-title-${generatedId.replaceAll(':', '')}`;
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-full items-stretch justify-center bg-[#14251d]/50 backdrop-blur-sm sm:items-center sm:p-4 landscape:p-0 sm:landscape:p-2"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full max-h-full w-full min-h-0 flex-col overflow-hidden bg-[#f8f9fa] text-[#263a30] sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-2xl sm:shadow-2xl landscape:sm:max-h-[calc(100dvh-1rem)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e2e9e4] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-extrabold text-pine sm:text-xl">{title}</h2>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label={`Close ${title}`}
              title="Close"
              className="grid h-9 w-9 place-items-center rounded-full border border-[#dce4de] bg-white text-[#35433d] transition hover:bg-[#f2f5f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-pine"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
