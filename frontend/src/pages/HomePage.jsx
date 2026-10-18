import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../features/places';
import DestinationSearch from '../features/places/components/DestinationSearch';
import CommonsPlaceImage from '../features/place-images/components/CommonsPlaceImage';

export default function HomePage() {
  const [destinations, setDestinations] = useState([]);
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
      <section className="relative isolate mx-auto min-h-90 max-w-360 overflow-visible sm:rounded-b-lg">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#17382d] via-[#42604b] to-[#9a6945]" />
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[#10261f]/70 via-[#10261f]/35 to-[#10261f]/10" />
        <div className="app-container relative flex min-h-90 items-center py-12">
          <div className="max-w-2xl text-white">
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#d5efad]">
              <Sparkles size={16} /> Make your trip planned and organized
            </p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              Plan your trip with ease.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/90 sm:text-lg">
              Explore places travelers love, then turn the good ideas into a trip that is yours.
            </p>
            <div className="mt-7 max-w-xl rounded-lg bg-white p-2 shadow-[0_16px_50px_rgba(0,0,0,0.22)]">
              <DestinationSearch onSearch={openDestination} />
            </div>
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-white/60 underline-offset-4 hover:decoration-white"
            >
              Browse all destinations <ArrowRight size={16} />
            </button>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      alt={destination.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      fallback={<span className="grid h-full w-full place-items-center bg-[#1b3d30] text-[#9fc7b3]"><MapPin size={28} /></span>}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#1b3d30] to-[#2e5d4a] text-white">
                      <MapPin size={28} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-opacity group-hover:from-black/95" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                    <span className="block truncate text-lg font-black tracking-wide text-white drop-shadow-md sm:text-xl">
                      {destination.name}
                    </span>
                    {destination.country && (
                      <span className="block text-xs font-semibold text-white/80 drop-shadow mt-0.5">
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
