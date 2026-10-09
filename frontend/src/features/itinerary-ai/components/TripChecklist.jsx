import { useState } from 'react';
import { CalendarDays, Check, Heart, LoaderCircle, MapPin, PlaneTakeoff, Sparkles, Users } from 'lucide-react';

const checklistFields = [
  { id: 'destination', label: 'WHERE TO', hint: "Tell me where you'd like to go", icon: MapPin },
  { id: 'origin', label: 'WHERE FROM', hint: 'Your starting city or airport', icon: PlaneTakeoff },
  { id: 'travelers', label: "WHO'S COMING", hint: "I'll ask who's travelling with you", icon: Users },
  { id: 'dates', label: "WHEN YOU'D GO", hint: "I'll ask when you'd like to travel", icon: CalendarDays },
  { id: 'preferences', label: "WHAT YOU'RE AFTER", hint: 'Interests, pace, and budget', icon: Heart },
];

const generationSteps = [
  ['validate_trip', 'Check trip details'],
  ['resolve_destination', 'Resolve destination'],
  ['load_places', 'Load verified places'],
  ['draft_itinerary', 'Build day-by-day plan'],
  ['validate_itinerary', 'Check stops and schedule'],
  ['calculate_routes', 'Order nearby stops'],
  ['save_trip', 'Save trip'],
];

function formatDates(brief) {
  if (brief.startDate && brief.endDate) {
    const options = { month: 'short', day: 'numeric' };
    const start = new Date(`${brief.startDate}T00:00:00`).toLocaleDateString(undefined, options);
    const end = new Date(`${brief.endDate}T00:00:00`).toLocaleDateString(undefined, { ...options, year: 'numeric' });
    return `${start} - ${end}`;
  }
  if (brief.durationDays) return `${brief.durationDays} days · dates still needed`;
  return brief.dateFlexibility || '';
}

function getFieldValue(id, brief) {
  if (id === 'travelers' && brief.travelers) {
    const { adults, childrenAges = [] } = brief.travelers;
    const type = brief.travelers.type ? `${brief.travelers.type[0].toUpperCase()}${brief.travelers.type.slice(1)} · ` : '';
    return `${type}${adults} adult${adults === 1 ? '' : 's'}${childrenAges.length ? `, ${childrenAges.length} children` : ''}`;
  }
  if (id === 'dates') return formatDates(brief);
  if (id === 'preferences') {
    return [brief.interests?.join(', '), brief.pace, brief.budget].filter(Boolean).join(' · ');
  }
  return brief[id] || '';
}

export default function TripChecklist({ brief, destinations, canGenerate, isGenerating, generationStages = [], tripResult, onSelectDestination, onGenerate, onOpenTrip }) {
  const [expanded, setExpanded] = useState(true);
  const skippedSlots = brief.skippedSlots || [];
  const completedCount = checklistFields.filter(({ id }) => Boolean(getFieldValue(id, brief)) || skippedSlots.includes(id)).length;
  const capturedCount = checklistFields.filter(({ id }) => Boolean(getFieldValue(id, brief))).length;
  const progress = (completedCount / checklistFields.length) * 100;

  return (
    <aside className="overflow-hidden rounded-lg border border-gray bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <span>
          <span className="block text-xs font-extrabold tracking-[0.08em] text-pine">TRIP CHECKLIST</span>
          <span className="mt-1 block text-xs text-text-secondary">{capturedCount} of 5 captured{completedCount > capturedCount ? ` · ${completedCount - capturedCount} skipped` : ''}</span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray text-pine">
          {expanded ? <span aria-hidden="true">−</span> : <span aria-hidden="true">+</span>}
        </span>
      </button>
      <div className="h-1 bg-gray" role="progressbar" aria-label="Trip brief progress" aria-valuemin={0} aria-valuemax={5} aria-valuenow={completedCount}>
        <div className="h-full bg-pine transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      {expanded && (
        <div className="p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-badge-bg text-lg font-extrabold text-pine">
              {completedCount}/5
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-secondary">Your trip is taking shape</p>
              <p className="mt-1 text-sm text-text-secondary">Share what you know. The rest can wait.</p>
            </div>
          </div>

          <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-border-default">
            {checklistFields.map(({ id, label, hint, icon: Icon }) => {
              const value = getFieldValue(id, brief);
              const skipped = !value && skippedSlots.includes(id);
              const complete = Boolean(value) || skipped;
              return (
                <li key={id} className="relative flex gap-3">
                  <span className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-white ${complete ? 'border-pine text-pine' : 'border-dashed border-border-strong text-text-secondary'}`}>
                    {complete ? <Check size={14} strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />}
                  </span>
                  <div className="min-w-0 pb-1">
                    <p className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.08em] text-text-secondary">
                      <Icon size={14} />{label}
                    </p>
                    <p className={`mt-1 text-sm leading-5 ${complete ? 'font-semibold text-pine' : 'text-text-secondary'}`}>
                      {value || (skipped ? 'Skipped for now' : hint)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {!brief.destination && destinations.length > 0 && (
            <div className="mt-6 border-t border-gray pt-4">
              <p className="text-xs font-bold text-text-secondary">A few places to start</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {destinations.slice(0, 4).map(destination => (
                  <button
                    key={destination.id}
                    type="button"
                    onClick={() => onSelectDestination(destination.name)}
                    className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-pine transition hover:border-pine hover:bg-badge-bg"
                  >
                    {destination.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-lg bg-bg-subtle p-4 text-center">
            {tripResult ? (
              <>
                <p className="text-sm font-bold text-pine">Your draft is ready</p>
                <p className="mt-1 text-xs text-text-secondary">{tripResult.totalItems} verified stops across {tripResult.numDays} days</p>
                <button type="button" onClick={onOpenTrip} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-pine px-4 text-sm font-bold text-white hover:bg-pine/90">
                  Open itinerary <MapPin size={15} />
                </button>
              </>
            ) : isGenerating ? (
              <div role="status" aria-live="polite" className="text-left">
                <div className="flex items-center gap-2 text-sm font-bold text-pine"><LoaderCircle size={16} className="animate-spin" />Building your itinerary</div>
                <ol className="mt-4 space-y-2.5">
                  {generationSteps.map(([id, label]) => {
                    const stage = generationStages.find(item => item.id === id);
                    return (
                      <li key={id} className={`flex items-center gap-2 text-xs ${stage?.status === 'complete' ? 'font-semibold text-pine' : stage?.status === 'active' ? 'font-semibold text-pine' : 'text-text-secondary'}`}>
                        {stage?.status === 'complete'
                          ? <Check size={14} />
                          : stage?.status === 'active'
                            ? <LoaderCircle size={14} className="animate-spin" />
                            : <span className="ml-1 mr-1 h-2 w-2 rounded-full bg-border-strong" />}
                        {stage?.label || label}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-pine px-4 text-sm font-bold text-white transition hover:bg-pine/90 disabled:cursor-not-allowed disabled:bg-text-secondary"
                >
                  <Sparkles size={16} />{isGenerating ? 'Building your trip…' : 'Generate my trip'}
                </button>
                <p className="mt-3 text-xs leading-5 text-text-secondary">
                  {canGenerate
                    ? 'I’ll turn your brief into a real, editable itinerary.'
                    : 'Share a destination and exact dates to unlock your first draft. You can skip the other details.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
