import { useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { ArrowLeftRight, LoaderCircle, MapPin, Route, Trash2, Undo2 } from 'lucide-react';
import { PlaceSearch } from '../places';

function ItinerarySidebar({ 
  workspaceClassName = '',
  showList, isLandscape, isItineraryExpanded, setIsItineraryExpanded, 
  items, dayCount, destinationSlug, onAddPlace, addingPlace,
  onOptimizeDay, optimizingDay, optimizationMessage,
  setMapCenter, setMapZoom, setSelectedItem, setMobileView, selectedDay, onSelectDay,
  onUpdateItem, onMoveItem, onRemoveItem, removedItem, onUndoRemove, onReplaceItem
}) {
  const placesLibrary = useMapsLibrary('places');
  const [replacingItemId, setReplacingItemId] = useState('');
  const [timeDrafts, setTimeDrafts] = useState({});
  const dayItems = items.filter(item => Number(item.day_index ?? 0) === selectedDay);

  const handleLocationClick = (item) => {
    if (!item.lat || !item.lng) return;

    setMapCenter({ lat: item.lat, lng: item.lng });
    setMapZoom(16);
    if (!isLandscape) setMobileView('map');

    // On-demand places lookup logic
    const googlePlaceId = item.google_place_id || item.placeId;
    if (googlePlaceId && placesLibrary) {
      const service = new placesLibrary.PlacesService(document.createElement('div'));
      service.getDetails(
        {
          placeId: googlePlaceId,
          fields: ['name', 'formatted_address', 'wheelchair_accessible_entrance', 'editorial_summary', 'reviews', 'photos', 'opening_hours']
        },
        (place, status) => {
          if (status === placesLibrary.PlacesServiceStatus.OK && place) {
            setSelectedItem({
              ...item,
              title: place.name || item.title,
              address: place.formatted_address,
              accessible: place.wheelchair_accessible_entrance ? 'Accessible entrance' : null,
              about: place.editorial_summary?.overview,
              isOpen: place.opening_hours?.isOpen(),
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
              reviews: place.reviews ? place.reviews.slice(0, 2) : []
            });
          } else {
            setSelectedItem(item);
          }
        }
      );
    } else {
      setSelectedItem(item);
    }
  };

  return (
    <div className={`h-full min-h-0 min-w-0 overflow-y-auto p-6 flex flex-col justify-between transition-all duration-300 ease-in-out relative rounded-lg border border-slate-200 ${workspaceClassName}
      ${showList ? 'flex' : 'hidden'}
      ${isLandscape ? (isItineraryExpanded ? 'w-full' : 'w-16') : 'w-full'}`}
    >
      {isItineraryExpanded || !isLandscape ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-pine">Edit Your Itinerary</h2>
            {isLandscape && (
              <button
                onClick={() => setIsItineraryExpanded(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-200 text-pine hover:bg-slate-300 rounded-lg transition"
              >
                Collapse List 📑
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-6">Plan your trip layout and track stops seamlessly.</p>

          <div className="mb-4 flex items-center gap-3">
            <label className="text-xs font-bold text-text-secondary" htmlFor="itinerary-day">Showing</label>
            <select id="itinerary-day" value={selectedDay} onChange={event => onSelectDay(Number(event.target.value))} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-pine">
              {Array.from({ length: dayCount }, (_, day) => <option key={day} value={day}>Day {day + 1}</option>)}
            </select>
            <span className="text-xs text-text-secondary">{dayItems.length} stops</span>
          </div>
          
          <div className="space-y-3 mb-6">
            {dayItems.map((item) => (
              <article
                key={item.id} 
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-pine">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Day {(item.day_index ?? 0) + 1}{item.start_time ? ` · ${item.start_time}` : ''}</p>
                  </div>
                  <button type="button" onClick={() => handleLocationClick(item)} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-pine hover:underline">
                    <MapPin size={14} /> View map
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <label className="sr-only" htmlFor={`time-${item.id}`}>Start time for {item.title}</label>
                  <input
                    id={`time-${item.id}`}
                    type="time"
                    value={timeDrafts[item.id] ?? item.start_time ?? '09:00'}
                    onChange={event => setTimeDrafts(current => ({ ...current, [item.id]: event.target.value }))}
                    onBlur={event => {
                      const value = event.target.value;
                      if (value && value !== item.start_time) {
                        Promise.resolve(onUpdateItem(item.id, { startTime: value })).then(saved => {
                          setTimeDrafts(current => {
                            const next = { ...current };
                            if (saved) delete next[item.id];
                            else next[item.id] = item.start_time || '09:00';
                            return next;
                          });
                        });
                      }
                    }}
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs text-pine"
                  />
                  <label className="sr-only" htmlFor={`move-${item.id}`}>Move {item.title} to another day</label>
                  <select id={`move-${item.id}`} value={item.day_index ?? 0} onChange={event => onMoveItem(item.id, Number(event.target.value))} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-pine">
                    {Array.from({ length: dayCount }, (_, day) => <option key={day} value={day}>Day {day + 1}</option>)}
                  </select>
                  <button type="button" onClick={() => setReplacingItemId(item.id)} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-pine hover:bg-bg-subtle"><ArrowLeftRight size={13} />Replace</button>
                  <button type="button" onClick={() => onRemoveItem(item)} aria-label={`Remove ${item.title}`} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 size={13} />Remove</button>
                </div>
              </article>
            ))}
            {!dayItems.length && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Day {selectedDay + 1} has no stops yet. Search below to add one.</p>}
          </div>
          {removedItem && (
            <p role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-pine">
              <span>Removed {removedItem.title}</span>
              <button type="button" onClick={onUndoRemove} className="inline-flex items-center gap-1 font-bold underline underline-offset-2"><Undo2 size={13} />Undo</button>
            </p>
          )}
        </div>
      ) : (
        <div onClick={() => setIsItineraryExpanded(true)} className="absolute inset-0 bg-slate-900/5 cursor-pointer flex items-center justify-center hover:bg-slate-900/10 transition">
          <span className="transform -rotate-90 whitespace-nowrap tracking-wider font-bold text-slate-600 text-xs">EXPAND ITINERARY</span>
        </div>
      )}

      {(isItineraryExpanded || !isLandscape) && (
        <div className="border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-pine">{replacingItemId ? 'Replace stop' : 'Add a stop'}</h3>
              <p className="mt-1 text-xs text-slate-500">Search saved places for this destination</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex h-10 flex-1 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-pine">Adding to Day {selectedDay + 1}</span>
            <button
              type="button"
              onClick={() => onOptimizeDay(selectedDay)}
              disabled={optimizingDay === selectedDay || items.filter(item => Number(item.day_index ?? 0) === selectedDay).length < 2}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong px-3 text-xs font-bold text-pine hover:bg-badge-bg disabled:cursor-not-allowed disabled:opacity-45"
            >
              {optimizingDay === selectedDay ? <LoaderCircle size={14} className="animate-spin" /> : <Route size={14} />}
              {optimizingDay === selectedDay ? 'Optimizing' : 'Optimize day'}
            </button>
          </div>
          {optimizationMessage && <p role="status" className="mt-2 text-xs leading-5 text-text-secondary">{optimizationMessage}</p>}
          <PlaceSearch
            destinationSlug={destinationSlug}
            inlineResults
            onResultClick={place => replacingItemId
              ? Promise.resolve(onReplaceItem(place, replacingItemId)).then(saved => { if (saved) setReplacingItemId(''); })
              : onAddPlace(place, selectedDay)}
          />
          {replacingItemId && <button type="button" onClick={() => setReplacingItemId('')} className="mt-2 text-xs font-semibold text-text-secondary underline">Cancel replacement</button>}
          {addingPlace && <p role="status" className="mt-2 text-xs font-medium text-pine">Adding stop…</p>}
        </div>
      )}
    </div>
  );
}

export default ItinerarySidebar;
