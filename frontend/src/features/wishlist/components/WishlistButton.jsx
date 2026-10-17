import { useState } from 'react';
import { Heart } from 'lucide-react';
import { OverlayLayout } from '../../../shared/components/overlay-layout';
import useWishlist from '../hooks/useWishlist';
import useWishlistAccount from '../hooks/useWishlistAccount';
import WishlistOverlayContent from './WishlistOverlayContent';

export default function WishlistButton({ appearance = 'default', open: controlledOpen, onOpenChange, onShowInGuide }) {
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
      className={`inline-flex items-center justify-center rounded-full border font-bold backdrop-blur-md transition focus:outline-none focus-visible:ring-2 ${appearance === 'overlay' ? 'h-8 w-8 border-white/35 bg-black/20 text-white hover:bg-black/40 focus-visible:ring-white' : 'h-10 w-10 border-[#dce4de] bg-white text-pine hover:bg-[#f7faf7] focus-visible:ring-pine'}`}
    >
      <Heart size={appearance === 'overlay' ? 15 : 17} />
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
