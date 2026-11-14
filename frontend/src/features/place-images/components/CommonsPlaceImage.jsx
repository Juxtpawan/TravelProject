import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { ENV } from '../../../config/env';
import { getPlaceImage } from '../api/placeImagesApi';

const GENERIC_IMAGE_WORDS = new Set(['the', 'and', 'for', 'from', 'hotel', 'resort', 'restaurant', 'cafe', 'coffee', 'shop', 'museum', 'temple', 'church', 'park', 'fort', 'palace', 'beach', 'attraction', 'landmark']);

function googleCoordinate(location, key) {
  const value = typeof location?.[key] === 'function' ? location[key]() : location?.[key];
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function imageMatchesPlace(image, name, destination, category) {
  if (!image?.url || image.matchType === 'related' || image.matchType === 'representative') return false;
  if (image.matchType === 'google-geosearch') return true;
  if (category === 'destination' && image.matchType === 'wikipedia-lead') return true;
  if (category === 'attraction' && image.matchType === 'wikipedia-lead') return true;
  const tokens = (value) => String(value || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, '').split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2);
  const destinationWords = new Set(tokens(destination));
  const expected = [...new Set(tokens(name).filter((word) => !GENERIC_IMAGE_WORDS.has(word) && (category === 'destination' || !destinationWords.has(word))))];
  const titleWords = new Set(tokens(image.title));
  if (!expected.length) return false;
  return expected.filter((word) => titleWords.has(word)).length / expected.length >= 0.6;
}

/** Loads a geotagged, nearby CC0/Public Domain Wikimedia Commons photo. */
export default function CommonsPlaceImage({ placeId, category = 'attraction', destination, name = '', latitude, longitude, formattedAddress = '', primaryType = '', alt = '', className = '', fallback = null, transparentFallback = false, background = false, hideIfMissing = false, rounded = true }) {
  const hostRef = useRef(null);
  const placesLibrary = useMapsLibrary('places');
  const [image, setImage] = useState(null);
  const [commonsSettled, setCommonsSettled] = useState(false);
  const [commonsFailed, setCommonsFailed] = useState(false);
  const isConfident = imageMatchesPlace(image, name, destination, category);

  useEffect(() => {
    setImage(null);
    setCommonsSettled(false);
    setCommonsFailed(false);
    if (!placeId || !destination) return undefined;
    let active = true;
    const load = async () => {
      let locationContext = {
        placeName: name || destination || '',
        formattedAddress,
        primaryType,
        latitude: latitude !== undefined && latitude !== null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: longitude !== undefined && longitude !== null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      };
      if ((!Number.isFinite(locationContext.latitude) || !Number.isFinite(locationContext.longitude)) && placesLibrary?.Place) {
        try {
          const place = new placesLibrary.Place({ id: placeId });
          await place.fetchFields({ fields: ['location'] });
          locationContext = {
            placeName: name || destination || '',
            formattedAddress,
            primaryType,
            latitude: googleCoordinate(place.location, 'lat'),
            longitude: googleCoordinate(place.location, 'lng'),
          };
        } catch {
          // Without Google coordinates, the backend safely returns no Commons match.
        }
      }
      try {
        const result = await getPlaceImage(placeId, category, destination, name, locationContext);
        if (active) { setImage(result); setCommonsSettled(true); }
      } catch {
        if (active) { setImage(null); setCommonsSettled(true); }
      }
    };
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
    }, { rootMargin: '240px' });
    observer.observe(host);
    return () => { active = false; observer.disconnect(); };
  }, [placeId, category, destination, name, latitude, longitude, formattedAddress, primaryType, placesLibrary]);

  const src = isConfident && !commonsFailed ? `${ENV.API_URL.replace(/\/$/, '')}${image.url}` : '';
  const hasPhoto = Boolean(src);
  const noPhotoAvailable = hideIfMissing && commonsSettled && !hasPhoto;
  if (noPhotoAvailable) return null;
  return <span ref={hostRef} className={`${background ? 'absolute inset-0 z-0 block overflow-hidden' : `relative grid place-items-center overflow-hidden ${rounded ? 'rounded-lg' : ''}`} ${transparentFallback && !hasPhoto ? 'bg-transparent' : 'bg-[#edf3ee] text-[#9aa79d]'} ${className}`}>
    {fallback && !hasPhoto && <span aria-hidden="true" className="absolute inset-0 grid place-items-center">{fallback}</span>}
    {src && <img src={src} alt={alt} loading="eager" onError={() => setCommonsFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
  </span>;
}
