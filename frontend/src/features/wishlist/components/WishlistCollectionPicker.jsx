import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import { DEFAULT_WISHLIST_ID } from '../api/wishlistStorage';
import useWishlist from '../hooks/useWishlist';

const POPOVER_WIDTH = 448;

export default function WishlistCollectionPicker({ place, destination, anchorElement, onClose }) {
  const { lists, togglePlace, hasPlaceInList, createList } = useWishlist();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const [position, setPosition] = useState({ top: 16, left: 16 });
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const nameInputId = useId();
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      if (previousFocusRef.current instanceof HTMLElement && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      const mobile = window.matchMedia('(max-width: 639px)').matches;
      setIsMobile(mobile);
      if (mobile) return;

      const anchor = anchorElement?.isConnected ? anchorElement.getBoundingClientRect() : null;
      const panelHeight = panelRef.current?.getBoundingClientRect().height || 420;
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32);
      const left = anchor
        ? Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16))
        : Math.max(16, (window.innerWidth - width) / 2);
      const below = anchor ? anchor.bottom + 8 : (window.innerHeight - panelHeight) / 2;
      const top = Math.max(16, Math.min(below + panelHeight <= window.innerHeight - 16 ? below : (anchor ? anchor.top - panelHeight - 8 : below), window.innerHeight - panelHeight - 16));
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorElement, showCreateForm, lists.length]);

  const handleCreate = (event) => {
    event.preventDefault();
    const result = createList(newListName, place, destination, { selectNewList: true });
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] ${isMobile ? 'bg-[#14251d]/45 backdrop-blur-[2px]' : 'bg-black/10 sm:bg-transparent'}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={isMobile ? undefined : { top: position.top, left: position.left, width: `min(${POPOVER_WIDTH}px, calc(100vw - 2rem))` }}
        className={isMobile
          ? 'absolute inset-x-0 bottom-0 flex max-h-[88dvh] min-h-0 flex-col overflow-hidden rounded-t-3xl border border-[#e0e7e1] bg-[#f8faf8] pb-[env(safe-area-inset-bottom)] text-[#263a30] shadow-2xl'
          : 'fixed flex max-h-[min(36rem,calc(100dvh-2rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e0e7e1] bg-[#f8faf8] text-[#263a30] shadow-2xl'}
      >
        {isMobile && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#cbd6ce]" />}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#e5ebe6] bg-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-extrabold text-pine">Save to a wishlist</h2>
            <p className="mt-0.5 truncate text-xs text-[#718077]">{place.name}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close wishlist chooser" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#dce4de] text-[#526158] transition hover:bg-[#f2f5f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-pine">
            <X size={17} />
          </button>
        </header>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#718077]">Your lists</p>
          <ul className="divide-y divide-[#edf1ed] overflow-hidden rounded-2xl border border-[#e0e7e1] bg-white">
            {lists.map((list) => {
              const checked = hasPlaceInList(list.id, place, destination.slug);
              return <li key={list.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => togglePlace(list.id, place, destination)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f7faf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine"
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? 'border-pine bg-pine text-white' : 'border-[#bdc9c0] bg-white text-transparent'}`}><Check size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#263a30]">{list.name}</span>
                    <span className="mt-0.5 block text-xs text-[#718077]">{list.items.length} saved</span>
                  </span>
                {list.id === DEFAULT_WISHLIST_ID && <span className="rounded-full bg-[#edf4ef] px-2 py-1 text-[10px] font-bold text-pine">Default</span>}
                </button>
              </li>;
            })}
          </ul>

          {showCreateForm ? <form onSubmit={handleCreate} className="mt-4 rounded-2xl border border-[#dce5de] bg-white p-4">
            <label htmlFor={nameInputId} className="block text-sm font-bold text-pine">Name your list</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id={nameInputId}
                autoFocus
                maxLength={48}
                value={newListName}
                onChange={(event) => { setNewListName(event.target.value); setError(''); }}
                placeholder="Weekend in Jaipur"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#d4ded6] px-3 text-sm outline-none focus:border-pine focus:ring-2 focus:ring-pine/10"
              />
              <button type="submit" className="h-11 shrink-0 rounded-xl bg-pine px-4 text-sm font-bold text-white transition hover:bg-pine/90">Create and save</button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs font-medium text-[#a13a31]">{error}</p>}
          </form> : <button type="button" onClick={() => setShowCreateForm(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-pine transition hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">
            <Plus size={17} />Create a new list
          </button>}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[#e5ebe6] bg-white px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className="min-h-10 min-w-24 rounded-full bg-pine px-5 text-sm font-bold text-white transition hover:bg-pine/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pine">Done</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
