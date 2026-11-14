import { useState } from 'react';
import { Bookmark, ChevronRight } from 'lucide-react';
import { OverlayLayout } from '../../../shared/components/overlay-layout';
import useWishlist from '../hooks/useWishlist';
import useWishlistAccount from '../hooks/useWishlistAccount';
import WishlistOverlayContent from './WishlistOverlayContent';

export default function WishlistButton({ appearance = 'default', open: controlledOpen, onOpenChange, onShowInGuide, compact = false, label }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const { allItems } = useWishlist();
  const { isLoading, requireAccount } = useWishlistAccount();

  return <>
    <button
      type="button"
      onClick={() => { if (!requireAccount()) setOpen(!open); }}
      disabled={isLoading}
      aria-label="Open wishlist"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={label
        ? 'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-[#35433d] transition hover:bg-[#f5f8f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium disabled:opacity-50'
        : `inline-flex h-10 w-10 items-center justify-center rounded-full border font-bold backdrop-blur-md transition focus:outline-none focus-visible:ring-2 ${appearance === 'overlay' ? 'border-white/35 bg-black/20 text-white hover:bg-black/40 focus-visible:ring-white' : 'border-[#dce4de] bg-white text-pine hover:bg-[#f7faf7] focus-visible:ring-pine'}`}
    >
      {label ? <>
        <span className="flex min-w-0 items-center gap-2.5"><Bookmark size={17} aria-hidden="true" /><span>{label}</span></span>
        <ChevronRight size={16} className="text-[#718077]" aria-hidden="true" />
      </> : <Bookmark size={17} />}
    </button>
    {open && <OverlayLayout
      title="Wishlists"
      onClose={() => setOpen(false)}
      headerActions={<span className="text-xs font-semibold text-[#718077]">{allItems.length} saved</span>}
    >
      <WishlistOverlayContent onShowInGuide={onShowInGuide ? () => { onShowInGuide(); setOpen(false); } : undefined} onClose={() => setOpen(false)} />
    </OverlayLayout>}
  </>;
}
