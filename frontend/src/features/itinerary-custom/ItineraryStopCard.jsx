import { useState } from 'react';
import { BadgeCheck, Check, Clock3, Edit3, ExternalLink, LoaderCircle, MapPin, Search, Trash2, Wallet, X } from 'lucide-react';
import PlaceSearch from '../places/components/PlaceSearch';
import PlaceImagePicker from '../../shared/components/place-image-picker/PlaceImagePicker';

const toTimeInput = (value) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : '');

function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return 'Time not set';
  return [startTime, endTime].filter(Boolean).join(' – ');
}

export default function ItineraryStopCard({
  item,
  dayCount,
  destinationSlug,
  readOnly = false,
  onViewMap,
  onSave,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState({
    placeId: item.place_id,
    placeName: item.title || item.place_name || '',
    dayIndex: Number(item.day_index ?? 0),
    startTime: toTimeInput(item.start_time),
    endTime: toTimeInput(item.end_time),
    note: item.note || '',
    estimatedCost: item.estimated_cost || '',
    costCurrency: item.cost_currency || 'INR',
    bookingUrl: item.booking_url || '',
  });

  const beginEditing = () => {
    setDraft({
      placeId: item.place_id,
      placeName: item.title || item.place_name || '',
      dayIndex: Number(item.day_index ?? 0),
      startTime: toTimeInput(item.start_time),
      endTime: toTimeInput(item.end_time),
      note: item.note || '',
      estimatedCost: item.estimated_cost || '',
      costCurrency: item.cost_currency || 'INR',
      bookingUrl: item.booking_url || '',
    });
    setStatus('');
    setShowPlaceSearch(false);
    setIsDeleting(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setShowPlaceSearch(false);
    setStatus('');
  };

  const saveStop = async (event) => {
    event.preventDefault();
    if (!draft.placeId) {
      setStatus('Choose a place before saving.');
      return;
    }
    if (draft.endTime && !draft.startTime) {
      setStatus('Add a start time before the end time.');
      return;
    }
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setStatus('End time must be later than start time.');
      return;
    }

    setStatus('saving');
    try {
      await onSave(item.id, {
        placeId: draft.placeId,
        dayIndex: Number(draft.dayIndex),
        startTime: draft.startTime || null,
        endTime: draft.endTime || null,
        note: draft.note.trim(),
        estimatedCost: draft.estimatedCost,
        costCurrency: draft.costCurrency,
        bookingUrl: draft.bookingUrl.trim(),
      });
      setIsEditing(false);
      setStatus('');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'This stop could not be saved.');
    }
  };

  const deleteStop = async () => {
    setStatus('deleting');
    try {
      await onDelete(item.id);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'This stop could not be removed.');
      setIsDeleting(false);
    }
  };

  const canViewMap = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
  const toggleVisited = async () => {
    setStatus('saving');
    try {
      await onSave(item.id, { visitedAt: item.visited_at ? null : new Date().toISOString() });
      setStatus('');
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Visit status could not be updated.');
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {isEditing ? (
        <form onSubmit={saveStop} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-pine">Edit stop</p>
            <button type="button" onClick={cancelEditing} aria-label="Cancel editing stop" className="grid h-8 w-8 place-items-center rounded-full text-[#66736b] transition hover:bg-[#f1f6f2] hover:text-pine"><X size={16} /></button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-[#526158]">Place</label>
              <button type="button" onClick={() => setShowPlaceSearch(value => !value)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-green-ink transition hover:bg-[#edf7ef]"><Search size={13} />Change</button>
            </div>
            <p className="mt-1 rounded-lg bg-[#f6f9f7] px-2.5 py-2 text-sm font-semibold text-pine">{draft.placeName || 'Choose a place'}</p>
            {showPlaceSearch && <div className="mt-2"><PlaceSearch destinationSlug={destinationSlug} inlineResults onResultClick={(place) => {
              setDraft(current => ({ ...current, placeId: place.id, placeName: place.name }));
              setShowPlaceSearch(false);
            }} /></div>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-[#526158]">Day
              <select value={draft.dayIndex} onChange={event => setDraft(current => ({ ...current, dayIndex: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15">
                {Array.from({ length: dayCount }, (_, index) => <option key={index} value={index}>Day {index + 1}</option>)}
              </select>
            </label>
            <div aria-hidden="true" />
            <label className="text-xs font-semibold text-[#526158]">Start time
              <input type="time" value={draft.startTime} onChange={event => setDraft(current => ({ ...current, startTime: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
            </label>
            <label className="text-xs font-semibold text-[#526158]">End time
              <input type="time" value={draft.endTime} onChange={event => setDraft(current => ({ ...current, endTime: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
            </label>
          </div>

          <label className="block text-xs font-semibold text-[#526158]">Notes
            <textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} maxLength={1000} rows={3} placeholder="Booking details, reminders, or a useful tip" className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-pine outline-none placeholder:text-[#7b8980] focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
          </label>

          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <label className="text-xs font-semibold text-[#526158]">Estimated cost
              <input type="number" min="0" step="0.01" value={draft.estimatedCost} onChange={event => setDraft(current => ({ ...current, estimatedCost: event.target.value }))} placeholder="0.00" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
            </label>
            <label className="text-xs font-semibold text-[#526158]">Currency
              <select value={draft.costCurrency} onChange={event => setDraft(current => ({ ...current, costCurrency: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15">{['INR','USD','EUR','GBP','CAD','AUD','JPY'].map(code => <option key={code}>{code}</option>)}</select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-[#526158]">Booking or reference link (optional)
            <input type="url" value={draft.bookingUrl} onChange={event => setDraft(current => ({ ...current, bookingUrl: event.target.value }))} maxLength={1000} placeholder="https://" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15" />
          </label>

          {status && status !== 'saving' && <p role="alert" className="text-xs font-medium text-[#a13a31]">{status}</p>}
          <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-3">
            <button type="button" onClick={cancelEditing} disabled={status === 'saving'} className="min-h-10 rounded-lg px-3 text-sm font-bold text-[#526158] transition hover:bg-[#f2f6f3] disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={status === 'saving'} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-pine px-3 text-sm font-bold text-white transition hover:bg-[#003d27] disabled:opacity-60">
              {status === 'saving' ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{status === 'saving' ? 'Saving' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-pine">{item.title || item.place_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#66736b]">
                <span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatTimeRange(item.start_time, item.end_time)}</span>
                {item.category && <span className="capitalize">{item.category}</span>}
                {item.estimated_cost && <span className="inline-flex items-center gap-1"><Wallet size={12}/>{item.cost_currency || 'INR'} {item.estimated_cost}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {!readOnly && <PlaceImagePicker placeId={item.google_place_id || ''} name={item.title || item.place_name} latitude={item.lat ?? item.latitude} longitude={item.lng ?? item.longitude} category={item.category === 'restaurant' ? 'restaurant' : 'attraction'} onSelect={photoUrl => onSave(item.id, { photoUrl })} buttonLabel={`Add photo for ${item.title || item.place_name}`} />}
              <button type="button" onClick={() => onViewMap(item)} disabled={!canViewMap} aria-label={`View ${item.title || item.place_name} on map`} title="View map" className="grid h-8 w-8 place-items-center rounded-full text-pine transition hover:bg-[#edf7ef] disabled:cursor-not-allowed disabled:opacity-35"><MapPin size={15} /></button>
              {!readOnly && <button type="button" onClick={beginEditing} aria-label={`Edit ${item.title || item.place_name}`} title="Edit stop" className="grid h-8 w-8 place-items-center rounded-full text-pine transition hover:bg-[#edf7ef]"><Edit3 size={15} /></button>}
            </div>
          </div>
          {item.photo_url && <img src={item.photo_url} alt={`Photo of ${item.title || item.place_name}`} loading="lazy" className="mt-3 max-h-44 w-full rounded-lg object-cover" />}
          {item.note && <p className="mt-2 border-t border-[#edf1ee] pt-2 text-xs leading-5 text-[#526158]">{item.note}</p>}
          {item.booking_url && <a href={item.booking_url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-ink hover:underline"><ExternalLink size={12}/>Booking link</a>}

          {!readOnly && <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#edf1ee] pt-2">
            <button type="button" onClick={toggleVisited} disabled={status === 'saving'} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${item.visited_at ? 'bg-[#e8efea] text-green-ink' : 'bg-[#f4f7f5] text-[#526158] hover:bg-[#e8efea]'}`}><BadgeCheck size={14}/>{item.visited_at ? 'Visited' : 'Mark as visited'}</button>
            {item.visited_at && <span className="text-[11px] text-[#718077]">{new Date(item.visited_at).toLocaleDateString()}</span>}
          </div>}

          {!readOnly && (isDeleting ? (
            <div className="mt-3 rounded-lg bg-[#fff5f3] p-2.5">
              <p className="text-xs font-semibold text-[#7d2f28]">Remove this stop from the itinerary?</p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsDeleting(false)} disabled={status === 'deleting'} className="min-h-8 rounded-md px-2.5 text-xs font-bold text-[#6d554f] hover:bg-white">Keep</button>
                <button type="button" onClick={deleteStop} disabled={status === 'deleting'} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#a13a31] px-2.5 text-xs font-bold text-white hover:bg-[#842e27] disabled:opacity-60">{status === 'deleting' && <LoaderCircle size={13} className="animate-spin" />}Remove</button>
              </div>
            </div>
          ) : <button type="button" onClick={() => setIsDeleting(true)} className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[#8c4a43] transition hover:text-[#a13a31]"><Trash2 size={13} />Remove</button>)}
          {status && status !== 'deleting' && <p role="alert" className="mt-2 text-xs font-medium text-[#a13a31]">{status}</p>}
        </>
      )}
    </article>
  );
}
