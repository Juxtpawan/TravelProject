import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../features/places';
import DestinationSearch from '../features/places/components/DestinationSearch';

const heroImage = 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=2000&q=85';

export default function HomePage() {
  const [destinations, setDestinations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getDestinations()
      .then(setDestinations)
      .catch(() => setDestinations([]));
  }, []);

  const openDestination = (destination) => navigate(`/locations/${encodeURIComponent(destination.slug)}`);

  return (
    <div className="pb-16">
      <section className="relative isolate mx-auto min-h-90 max-w-360 overflow-visible sm:rounded-b-lg">
        <img
          src={heroImage}
          alt="Colorful coastal villages overlooking the Mediterranean"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-[#10261f]/85 via-[#10261f]/55 to-[#10261f]/10" />
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.slice(0, 6).map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  onClick={() => openDestination(destination)}
                  className="group flex min-h-24 items-center justify-between gap-4 rounded-lg border border-[#e4eae5] bg-white p-4 text-left transition hover:border-[#87c4a0] hover:bg-[#f7fbf8]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-badge-bg text-pine"><MapPin size={19} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-pine">{destination.name}</span>
                      <span className="mt-1 block text-sm text-[#68766e]">
                        {destination.places_count || 0} places{destination.state ? ` · ${destination.state}` : ''}
                      </span>
                    </span>
                  </span>
                  <ArrowRight size={17} className="shrink-0 text-[#8b9990] transition group-hover:translate-x-1 group-hover:text-pine" />
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
