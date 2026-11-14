import { useEffect, useState } from 'react';
import { ENV } from '../../config/env';
import { getPlaceImage } from '../place-images/api/placeImagesApi';
import { lookupDestination } from '../places/api/placesApi';

export default function TripDestinationHeaderBackground({ placeId, destinationId, destinationName, latitude, longitude, imageOverride = '' }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (imageOverride) {
      setImageUrl(imageOverride);
      return undefined;
    }
    setImageUrl('');
    if (!destinationName) return undefined;
    let active = true;
    const loadImage = async () => {
      let googlePlaceId = placeId && !placeId.startsWith('local:') ? placeId : '';
      if (!googlePlaceId) {
        try {
          const lookup = await lookupDestination(destinationName);
          googlePlaceId = lookup?.destination?.google_place_id || '';
        } catch {
          // Keep using the saved destination ID if the name lookup is unavailable.
        }
      }
      const imagePlaceId = googlePlaceId || placeId || (destinationId ? `local:${destinationId}` : '');
      if (!imagePlaceId) return;
      const image = await getPlaceImage(imagePlaceId, 'destination', destinationName, destinationName, {
        placeName: destinationName,
        latitude,
        longitude,
      });
      if (!active || !image?.url) return;
      setImageUrl(`${ENV.API_URL.replace(/\/$/, '')}${image.url}`);
    };
    loadImage().catch(() => {});
    return () => { active = false; };
  }, [placeId, destinationId, destinationName, latitude, longitude, imageOverride]);

  if (!imageUrl) return null;
  return <>
    <img src={imageUrl} alt="" aria-hidden="true" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-center" />
    <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/45 to-black/30" />
    <span aria-hidden="true" className="absolute inset-0 bg-black/10" />
  </>;
}
