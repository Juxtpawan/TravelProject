import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Plus, Route } from 'lucide-react';
import { useAuth } from '../../auth';
import { getDestinations } from '../../places/api/placesApi';
import { createTrip, getTrips } from '../api/tripsApi';

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAiMode = searchParams.get('mode') === 'ai';
  const [trips, setTrips] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(isAiMode);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const loading = authLoading || Boolean(user?.id && loadedUserId !== user.id);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;

    let current = true;
    Promise.all([getTrips(), getDestinations()])
      .then(([loadedTrips, availableDestinations]) => {
        if (!current) return;
        setTrips(loadedTrips);
        setDestinations(availableDestinations);
        setDestinationId((currentId) => currentId || availableDestinations[0]?.id || '');
      })
      .catch(() => { if (current) setError('Trips could not be loaded. Please try again.'); })
      .finally(() => { if (current) setLoadedUserId(user.id); });

    return () => { current = false; };
  }, [authLoading, user?.id]);

  const handleCreateTrip = async (event) => {
    event.preventDefault();
    if (!user?.id) return navigate('/auth/login');
    if (endDate < startDate) {
      setError('The return date must be after the departure date.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data = await createTrip({
        destinationId,
        title: title.trim(),
        startDate,
        endDate,
      });
      if (!data.success) throw new Error(data.error || 'Trip could not be created.');
      const destination = destinations.find((item) => item.id === destinationId);
      setTrips((currentTrips) => [...currentTrips, {
        id: data.id,
        title: title.trim(),
        destination_name: destination?.name,
        start_date: startDate,
        end_date: endDate,
      }]);
      setIsModalOpen(false);
      setTitle('');
      setStartDate('');
      setEndDate('');
      if (isAiMode) navigate(`/trips/${data.id}?mode=ai`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Trip could not be created.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="app-container py-16 text-sm text-[#66736b]">Loading your trips…</div>;
  }

  if (!user) {
    return (
      <div className="app-container py-16">
        <section className="mx-auto max-w-xl border-y border-[#e5eae6] py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-badge-bg text-pine"><Route size={24} /></span>
          <h1 className="mt-4 text-2xl font-extrabold text-pine">Your trips start here</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#66736b]">Sign in to keep your plans, places, and day-by-day itineraries together.</p>
          <Link to="/auth/login" state={{ from: isAiMode ? '/trips?mode=ai' : '/trips' }} className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-btn-primary-bg px-6 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">Sign in to continue</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container pb-16 pt-8 sm:pt-12">
      <div className="flex flex-col justify-between gap-5 border-b border-[#e5eae6] pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-pine">Your travel plans</p>
          <h1 className="mt-1 text-3xl font-extrabold text-pine sm:text-4xl">My trips</h1>
          <p className="mt-2 text-sm text-[#66736b]">Keep the places, dates, and details for every getaway together.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setIsModalOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-btn-primary-bg px-5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">
          <Plus size={17} /> Plan a trip
        </button>
      </div>

      {error && !isModalOpen && <p role="alert" className="mt-5 rounded-lg bg-[#fff4f1] p-4 text-sm text-[#9b3e32]">{error}</p>}

      {trips.length ? (
        <div className="divide-y divide-[#e5eae6]">
          {trips.map((trip) => (
            <article key={trip.id} className="flex flex-col justify-between gap-4 py-6 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm text-[#66736b]"><MapPin size={15} className="text-pine" />{trip.destination_name || 'Destination'}</p>
                <h2 className="mt-1 truncate text-xl font-bold text-pine">{trip.title}</h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#66736b]"><CalendarDays size={15} />{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</p>
              </div>
              <Link to={`/trips/${trip.id}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#cdd9d0] px-4 text-sm font-bold text-pine hover:bg-[#f3faf5]">
                Open itinerary <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-badge-bg text-pine"><MapPin size={23} /></span>
          <h2 className="mt-4 text-xl font-extrabold text-pine">No trips planned yet</h2>
          <p className="mt-2 text-sm text-[#66736b]">Start with a destination and build your itinerary as you go.</p>
          <button type="button" onClick={() => setIsModalOpen(true)} className="mt-5 text-sm font-bold text-pine hover:underline">Create your first trip</button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#10261f]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-trip-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-bold text-pine">Start planning</p>
              <h2 id="create-trip-title" className="mt-1 text-2xl font-extrabold text-pine">Create a trip</h2>
            </div>
            {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff4f1] p-3 text-sm text-[#9b3e32]">{error}</p>}
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <label className="block text-sm font-semibold text-[#35433d]">
                Trip name
                <input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A week in the mountains" className="mt-1.5 h-11 w-full rounded-md border border-[#d6dfd8] px-3 font-normal outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
              </label>
              <label className="block text-sm font-semibold text-[#35433d]">
                Destination
                <select required value={destinationId} onChange={(event) => setDestinationId(event.target.value)} disabled={!destinations.length} className="mt-1.5 h-11 w-full rounded-md border border-[#d6dfd8] bg-white px-3 font-normal outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15">
                  <option value="" disabled>{destinations.length ? 'Choose a destination' : 'No destinations available'}</option>
                  {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}{destination.state ? `, ${destination.state}` : ''}</option>)}
                </select>
              </label>
              {!destinations.length && <p className="text-xs text-[#9b5c30]">Add destinations to the guide before creating a trip.</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#35433d]">
                  Start date
                  <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-[#d6dfd8] px-3 font-normal outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
                </label>
                <label className="block text-sm font-semibold text-[#35433d]">
                  End date
                  <input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-[#d6dfd8] px-3 font-normal outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-[#e8ede9] pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 rounded-full px-4 text-sm font-bold text-[#526158] hover:bg-[#f2f5f2]">Cancel</button>
                <button type="submit" disabled={saving || !destinations.length} className="h-10 rounded-full bg-btn-primary-bg px-5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Creating…' : 'Create trip'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}