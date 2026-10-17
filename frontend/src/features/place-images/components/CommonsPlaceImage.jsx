import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { ENV } from '../../../config/env';
import { getPlaceImage } from '../api/placeImagesApi';

/** Loads a licensed Commons image only when its container enters the viewport. */
export default function CommonsPlaceImage({ placeId, category = 'attraction', destination, name = '', alt = '', className = '', fallback = null, transparentFallback = false, background = false }) {
  const hostRef = useRef(null);
  const [image, setImage] = useState(null);
  const [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => {
    if (!placeId || !destination) return undefined;
    let active = true;
    const load = () => getPlaceImage(placeId, category, destination, name)
      .then((result) => { if (active) setImage(result); })
      .catch(() => { if (active) setImage(null); });
    const host = hostRef.current;
    if (!host || !('IntersectionObserver' in window)) {
      load();
      return () => { active = false; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '0px' });
    observer.observe(host);
    return () => { active = false; observer.disconnect(); };
  }, [placeId, category, destination, name]);

  if (!image?.url) return <span ref={hostRef} className={`${background ? 'absolute inset-0 z-0' : 'grid place-items-center rounded-lg'} ${transparentFallback ? 'bg-transparent' : 'bg-[#edf3ee] text-[#9aa79d]'} ${className}`} aria-hidden="true">{fallback}</span>;
  const src = `${ENV.API_URL.replace(/\/$/, '')}${image.url}`;
  return <span ref={hostRef} className={`${background ? 'absolute inset-0 z-0 block overflow-hidden' : 'relative block overflow-hidden rounded-lg'} ${className}`}>
    <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    {image.matchType === 'representative' && <span className="absolute bottom-1 left-1 max-w-[70%] truncate rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white">Representative photo</span>}
    <button
      type="button"
      aria-label="View image credit and license"
      title="Image credit and license"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); setCreditsOpen(true); }}
      className="absolute bottom-1 right-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-black/65 text-white shadow-sm hover:bg-black/85"
    ><Info size={12} aria-hidden="true" /></button>
    {creditsOpen && createPortal(
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" onClick={() => setCreditsOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="commons-credit-title" className="w-full max-w-sm rounded-xl bg-white p-4 text-left shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="commons-credit-title" className="text-sm font-bold text-pine">Image credit</h2>
            <button type="button" aria-label="Close image credit" onClick={() => setCreditsOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#647268] hover:bg-[#edf3ee]"><X size={15} /></button>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#273a30]">{image.title?.replace(/^File:/i, '') || 'Wikimedia Commons image'}</p>
          <p className="mt-1 text-xs leading-5 text-[#627168]">{image.creator ? `Photo by ${image.creator}. ` : ''}{image.license || 'License information'} · Wikimedia Commons{image.matchType === 'representative' ? ' · Representative category photo, not a verified photo of this specific venue' : image.matchType === 'related' ? ' · Related photo for this category and destination' : ''}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-pine">
            {image.sourceUrl && <a href={image.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="underline underline-offset-2">Source file</a>}
            {image.licenseUrl && <a href={image.licenseUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="underline underline-offset-2">License terms</a>}
          </div>
        </section>
      </div>,
      document.body,
    )}
  </span>;
}
