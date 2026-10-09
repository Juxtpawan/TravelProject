import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, MapPin, Sparkles } from 'lucide-react';
import { getDestinations } from '../api/placesApi';
import DestinationSearch from './DestinationSearch';

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
    <div className="app-container pb-16 pt-8 sm:pt-12">
      <section className="border-b border-[#e5eae6] pb-9">
        <p className="flex items-center gap-2 text-sm font-bold text-pine"><Compass size={16} /> Explore destinations</p>
        <h1 className="mt-2 text-3xl font-extrabold text-pine sm:text-4xl">Where do you want to go?</h1>
        <p className="mt-2 max-w-2xl text-[#66736b]">Search a city, region, state, or country to open its travel guide, curated places, and map.</p>
        <div className="mt-6 max-w-2xl rounded-xl border border-[#e4eae5] bg-[#f7faf7] p-2 sm:p-3">
          <DestinationSearch onSearch={openDestination} />
        </div>
      </section>

      <section className="pt-9">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-pine"><Sparkles size={16} /> Pick a starting point</p>
            <h2 className="mt-1 text-2xl font-extrabold text-pine">Destinations in the guide</h2>
          </div>
          <span className="text-sm text-[#738078]">{destinations.length} destinations</span>
        </div>

        {destinationsLoading ? (
          <p className="py-8 text-sm text-[#66736b]">Loading destinations…</p>
        ) : destinationError ? (
          <p role="alert" className="rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{destinationError}</p>
        ) : destinations.length ? (
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <button key={destination.id} type="button" onClick={() => openDestination(destination)} className="group flex min-h-24 items-center justify-between gap-3 border-b border-[#e8ede9] py-4 text-left">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-badge-bg text-pine"><MapPin size={19} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-pine">{destination.name}</span>
                    <span className="mt-1 block text-sm text-[#718077]">{destination.places_count || 0} places{destination.country ? ` · ${destination.country}` : ''}</span>
                  </span>
                </span>
                <ArrowRight size={17} className="shrink-0 text-[#8b9990] transition group-hover:translate-x-1 group-hover:text-pine" />
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
