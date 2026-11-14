import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../api/placesApi';
import DestinationSearch from './DestinationSearch';
import CommonsPlaceImage from '../../place-images/components/CommonsPlaceImage';
import { HERO_IMAGES, useHeroImageIndex } from '../../../shared/heroImages';

export default function ExplorePage() {
  const [destinations, setDestinations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationError, setDestinationError] = useState('');
  const heroImageIndex = useHeroImageIndex();
  const navigate = useNavigate();

  useEffect(() => {
    let current = true;
    getDestinations()
      .then((data) => { if (current) setDestinations(data); })
      .catch(() => { if (current) setDestinationError('Destinations could not be loaded. Check the API connection and try again.'); })
      .finally(() => { if (current) setDestinationsLoading(false); });
    return () => { current = false; };
  }, []);

  const openDestination = (destination) => {
    if (destination?.slug) navigate(`/locations/${encodeURIComponent(destination.slug)}`);
  };

  return (
    <div className="app-container pb-10 pt-4 sm:pb-16 sm:pt-8 lg:pt-10">
      <section className="explore-hero relative isolate min-h-[22rem] w-full overflow-hidden rounded-xl border border-[#e1ebe4] shadow-lg sm:min-h-[24rem] sm:rounded-3xl">
        {HERO_IMAGES.map((image, index) => (
          <img
            key={image.src}
            src={image.src}
            srcSet={image.srcSet}
            sizes="(min-width: 1344px) 1216px, (min-width: 1024px) calc(100vw - 64px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
            alt=""
            aria-hidden="true"
            fetchPriority={index === heroImageIndex ? 'high' : 'auto'}
            decoding="async"
            className={`absolute inset-0 z-0 h-full w-full max-w-full object-cover transition-opacity duration-1000 ${heroImageIndex === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-r from-[#004f32]/12 via-transparent to-transparent" />
        <div className="explore-hero-content relative z-20 flex min-h-[22rem] items-center p-3 sm:min-h-[24rem] sm:p-6 md:p-8 lg:p-10">
          <div className="w-full max-w-3xl rounded-2xl border border-white/70 bg-white/95 p-4 text-pine shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-7 md:p-8">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-green-ink sm:text-sm sm:tracking-widest">
            <Compass size={16} /> Explore destinations
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black text-pine [text-wrap:balance] min-[400px]:text-4xl sm:text-4xl lg:text-5xl">
            Where do you want to go?
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base sm:leading-relaxed">
            Search a city, region, state, or country to open its travel guide, curated places, and map.
          </p>
          <div className="mt-5 max-w-2xl rounded-xl border border-[#e2eee6] bg-[#f7fbf8] p-1.5 shadow-sm sm:mt-6 sm:rounded-2xl sm:p-2.5">
            <DestinationSearch onSearch={openDestination} />
          </div>
          </div>
        </div>
      </section>

      <section className="pt-10 sm:pt-12">
        <div className="mb-5 flex flex-col items-start gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-pine"><Sparkles size={16} /> Pick a starting point</p>
            <h2 className="mt-1 text-xl font-extrabold text-pine min-[400px]:text-2xl sm:text-3xl">Destinations in the guide</h2>
          </div>
          <span className="text-xs font-semibold text-[#738078] sm:text-sm">{destinations.length} destinations</span>
        </div>

        {destinationsLoading ? (
          <p className="py-8 text-sm text-[#66736b]">Loading destinations…</p>
        ) : destinationError ? (
          <p role="alert" className="rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{destinationError}</p>
        ) : destinations.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {destinations.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => openDestination(destination)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine text-left cursor-pointer"
              >
                {destination.google_place_id ? (
                  <CommonsPlaceImage
                    placeId={destination.google_place_id}
                    category="destination"
                    destination={destination.name}
                    name={destination.name}
                    latitude={destination.latitude}
                    longitude={destination.longitude}
                    alt={destination.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallback={<span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#e7f7ef] via-white to-[#faf1ed]"><span className="grid h-14 w-14 place-items-center rounded-full border border-white/80 bg-white/75 text-green-ink shadow-md"><MapPin size={26} /></span></span>}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#e7f7ef] via-white to-[#faf1ed]">
                    <span className="grid h-14 w-14 place-items-center rounded-full border border-white/80 bg-white/75 text-green-ink shadow-md"><MapPin size={26} /></span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex flex-col bg-white/95 px-3 py-2.5 text-left shadow-[0_-8px_24px_rgba(20,40,30,0.08)] backdrop-blur-sm transition-colors group-hover:bg-white sm:px-4 sm:py-3">
                  <span className="block truncate text-sm font-extrabold tracking-tight text-pine min-[400px]:text-base sm:text-lg">
                    {destination.name}
                  </span>
                  {destination.country && (
                    <span className="mt-0.5 block truncate text-[10px] font-medium text-[#68756f] sm:text-xs">
                      {destination.country}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#cfd9d1] bg-[#f7faf7] p-6 text-sm text-[#66736b]">
            Search any major destination above. Destinations already in the guide will also appear here.
          </div>
        )}
      </section>
    </div>
  );
}
