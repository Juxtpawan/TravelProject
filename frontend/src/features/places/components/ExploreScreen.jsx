import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../api/placesApi';
import DestinationSearch from './DestinationSearch';
import CommonsPlaceImage from '../../place-images/components/CommonsPlaceImage';

export default function ExplorePage() {
  const [destinations, setDestinations] = useState([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationError, setDestinationError] = useState('');
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
    <div className="app-container pb-16 pt-6 sm:pt-10">
      <section className="relative isolate overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border border-pine/20">
        <img
          src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"
          alt="Explore travel destinations"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0d281f]/95 via-[#1b3d30]/85 to-black/60" />
        <div className="p-6 sm:p-10 lg:p-12 text-white">
          <p className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-widest text-[#d5efad]">
            <Compass size={16} /> Explore destinations
          </p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl lg:text-5xl drop-shadow-md">
            Where do you want to go?
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-white/90 leading-relaxed drop-shadow">
            Search a city, region, state, or country to open its travel guide, curated places, and map.
          </p>
          <div className="mt-6 max-w-2xl rounded-2xl border border-white/20 bg-white/95 p-2 sm:p-2.5 shadow-2xl backdrop-blur-md">
            <DestinationSearch onSearch={openDestination} />
          </div>
        </div>
      </section>

      <section className="pt-10 sm:pt-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-pine"><Sparkles size={16} /> Pick a starting point</p>
            <h2 className="mt-1 text-2xl font-extrabold text-pine sm:text-3xl">Destinations in the guide</h2>
          </div>
          <span className="text-sm font-semibold text-[#738078]">{destinations.length} destinations</span>
        </div>

        {destinationsLoading ? (
          <p className="py-8 text-sm text-[#66736b]">Loading destinations…</p>
        ) : destinationError ? (
          <p role="alert" className="rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{destinationError}</p>
        ) : destinations.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <div className="rounded-lg border border-dashed border-[#cfd9d1] bg-[#f7faf7] p-6 text-sm text-[#66736b]">
            Search any major destination above. Destinations already in the guide will also appear here.
          </div>
        )}
      </section>
    </div>
  );
}
