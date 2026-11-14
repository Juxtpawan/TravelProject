import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../features/places';
import DestinationSearch from '../features/places/components/DestinationSearch';
import CommonsPlaceImage from '../features/place-images/components/CommonsPlaceImage';
import { HERO_IMAGES, useHeroImageIndex } from '../shared/heroImages';

export default function HomePage() {
  const [destinations, setDestinations] = useState([]);
  const heroImageIndex = useHeroImageIndex();
  const navigate = useNavigate();

  useEffect(() => {
    getDestinations()
      .then(setDestinations)
      .catch(() => setDestinations([]));
  }, []);

  const openDestination = (destination, googleDisplayName) => navigate(
    `/locations/${encodeURIComponent(destination.slug)}`,
    googleDisplayName ? { state: { googleDisplayName } } : undefined,
  );

  return (
    <div className="pb-16">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="home-hero relative isolate mx-auto w-full max-w-[80rem] overflow-hidden sm:rounded-b-lg">
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-[#faf1ed]" />
        {HERO_IMAGES.map((image, index) => (
          <img
            key={image.src}
            src={image.src}
            srcSet={image.srcSet}
            sizes="(min-width: 1280px) 1280px, 100vw"
            alt=""
            aria-hidden="true"
            fetchPriority={index === heroImageIndex ? 'high' : 'auto'}
            decoding="async"
            className={`absolute inset-0 z-10 h-full w-full max-w-full object-cover transition-opacity duration-1000 ${heroImageIndex === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div aria-hidden="true" className="absolute inset-0 z-20 bg-gradient-to-r from-[#004f32]/12 via-transparent to-transparent" />
        <div className="home-hero-content app-container relative z-30 flex min-h-[25rem] items-center py-5 sm:min-h-[22rem] sm:py-8 lg:min-h-[25rem] lg:py-10">
          <div className="max-w-2xl rounded-2xl border border-white/75 bg-white/95 p-4 text-pine shadow-xl backdrop-blur-md sm:rounded-3xl sm:p-7 md:p-8">
            <p className="mb-3 inline-flex max-w-full items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-green-ink sm:mb-4 sm:text-sm sm:tracking-[0.14em]">
              <Sparkles size={16} className="shrink-0" /> <span>Make your trip planned and organized</span>
            </p>
            <h1 className="max-w-xl text-3xl font-extrabold leading-[1.08] text-pine min-[400px]:text-4xl sm:text-5xl">
              Plan your trip with ease.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary sm:mt-4 sm:text-lg sm:leading-7">
              Explore places travelers love, then turn the good ideas into a trip that is yours.
            </p>
            <div className="mt-5 max-w-xl rounded-xl border border-[#e2eee6] bg-[#f7fbf8] p-1.5 shadow-sm sm:mt-7 sm:rounded-2xl sm:p-2">
              <DestinationSearch onSearch={openDestination} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Destination Cards ────────────────────────────────── */}
      <div className="app-container">
        <section className="py-12 sm:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-pine">A good place to begin</p>
              <h2 className="mt-1 text-2xl font-extrabold text-pine sm:text-3xl">Explore places worth the trip</h2>
            </div>
            <button onClick={() => navigate('/explore')} className="hidden items-center gap-1 text-sm font-bold text-pine hover:underline sm:inline-flex">
              See all <ArrowRight size={16} />
            </button>
          </div>

          {destinations.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {destinations.slice(0, 6).map((destination) => (
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
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-[#cfd9d1] bg-[#f7faf7] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-pine">Your destination guide is getting ready</h3>
                <p className="mt-1 text-sm text-[#68766e]">Search the places already in the guide or open Explore to see what is available.</p>
              </div>
              <button onClick={() => navigate('/explore')} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-btn-primary-bg px-5 py-2.5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">
                Explore now <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
