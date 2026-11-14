import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import { getPublicSharedTrip } from '../features/trips/api/tripsApi';

export default function SharedTripPage() {
  const { tripId, token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    getPublicSharedTrip(tripId, token).then(value => { if (live) setData(value); }).catch(err => { if (live) setError(err?.response?.data?.error || 'This shared trip could not be opened.'); });
    return () => { live = false; };
  }, [tripId, token]);

  if (error) return <main className="app-container py-16 text-center"><h1 className="text-2xl font-extrabold text-pine">Trip link unavailable</h1><p className="mt-2 text-sm text-[#66736b]">{error}</p></main>;
  if (!data) return <main className="app-container py-16 text-center text-sm text-[#66736b]">Loading shared trip…</main>;
  const { trip, items } = data;
  const dayCount = Math.max(1, Math.floor((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1);
  return <main className="app-container max-w-4xl py-8 sm:py-12">
    <section className="rounded-3xl border border-[#dce8df] bg-white p-5 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-green-ink">Shared trip · View only</p>
      <h1 className="mt-2 text-3xl font-extrabold text-pine sm:text-4xl">{trip.title || `Trip to ${trip.destination_name}`}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#66736b]"><span className="inline-flex items-center gap-1.5"><MapPin size={15} />{trip.destination_name}</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />{new Date(`${trip.start_date}T00:00:00`).toLocaleDateString()} – {new Date(`${trip.end_date}T00:00:00`).toLocaleDateString()}</span></p>
    </section>
    <div className="mt-6 space-y-4">{Array.from({ length: dayCount }, (_, dayIndex) => <section key={dayIndex} className="rounded-2xl border border-[#e1e9e3] bg-white p-4 sm:p-5">
      <h2 className="text-lg font-bold text-pine">Day {dayIndex + 1}</h2>
      <ul className="mt-3 space-y-2">{items.filter(item => Number(item.day_index) === dayIndex).map(item => <li key={item.id} className="flex items-start gap-3 rounded-xl bg-[#f7faf8] p-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6f2e9] text-green-ink"><MapPin size={15} /></span><span><span className="block text-sm font-semibold text-pine">{item.place_name}</span><span className="mt-0.5 block text-xs text-[#66736b]">{item.start_time || item.category || 'Stop'}</span></span></li>)}</ul>
      {!items.some(item => Number(item.day_index) === dayIndex) && <p className="mt-3 text-sm text-[#66736b]">No places added yet.</p>}
    </section>)}</div>
  </main>;
}
