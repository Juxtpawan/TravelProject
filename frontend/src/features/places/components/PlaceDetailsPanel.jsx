import { MapPin, Star, X, ZoomIn } from 'lucide-react';
import { NumberedPin } from '../../maps';

/** Destination place details shown over the map. */
export default function PlaceDetailsPanel({ place, category, onClose, onZoomToPlace }) {
  const reviewCount = place.user_rating_count || place.userRatingCount;

  return (
    <section aria-label={`${place.name} details`} className="absolute inset-x-3 bottom-3 z-20 flex h-[38%] max-h-[38%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl sm:inset-x-4 sm:bottom-4">
      <header className="flex min-w-0 items-center gap-1.5 border-b border-slate-100 p-1.5 sm:p-2">
        {place.photoUrl && <img src={place.photoUrl} alt="" className="h-8 w-10 shrink-0 rounded-md object-cover sm:h-10 sm:w-12" />}
        <span className="shrink-0 scale-90"><NumberedPin number={place.markerNumber} category={category} small /></span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-extrabold text-pine">{place.name}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#68766e]">
            <span>{category.title}</span>
            {place.rating != null && <span className="inline-flex items-center gap-1 font-semibold"><Star size={12} className="fill-[#e7a82d] text-[#e7a82d]" />{place.rating}{reviewCount ? ` · ${Number(reviewCount).toLocaleString()} reviews` : ''}</span>}
          </div>
          {place.formattedAddress && <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#718077]"><MapPin size={12} className="shrink-0" />{place.formattedAddress}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onZoomToPlace} aria-label={`Zoom to ${place.name}`} title="Zoom to this place" className="grid h-7 w-7 place-items-center rounded-full bg-[#edf5ef] text-pine transition hover:bg-[#dcece0]"><ZoomIn size={14} /></button>
          <button type="button" onClick={onClose} aria-label="Close place details" title="Close" className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-pine transition hover:bg-slate-200"><X size={14} /></button>
        </div>
      </header>

      <div className="min-h-0 overflow-y-auto px-4 py-3 text-sm leading-5 text-[#526158] sm:px-5">
        <p>{place.summary || place.description || 'Explore this place and its surroundings.'}</p>
        {place.tips?.length > 0 && <div className="mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-pine">Travel notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{place.tips.slice(0, 3).map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}</ul>
        </div>}
      </div>
    </section>
  );
}
