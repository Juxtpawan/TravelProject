import { useEffect, useRef, useState } from 'react';
import { ENV } from '../../../config/env';
import { getPlaceImage } from '../api/placeImagesApi';

/** Loads a CC0/Public Domain Commons image only when its container enters the viewport. */
export default function CommonsPlaceImage({ placeId, category = 'attraction', destination, name = '', alt = '', className = '', fallback = null, transparentFallback = false, background = false }) {
  const hostRef = useRef(null);
  const [image, setImage] = useState(null);

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
  </span>;
}
