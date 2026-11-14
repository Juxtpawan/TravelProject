import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Plus, Route, X, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WorkspaceRailControls from '../../shared/components/workspace-rail/WorkspaceRailControls';
import TripLogisticsPanel from './TripLogisticsPanel';
import ItineraryDiscoveries from './ItineraryDiscoveries';
import ItineraryStopCard from './ItineraryStopCard';
import PlaceImagePicker from '../../shared/components/place-image-picker/PlaceImagePicker';
import { getTripLogistics, saveTripLogistics } from '../trips/api/tripsApi';

const EMPTY_LOGISTICS = {
  arrival_mode: '', arrival_details: '', arrival_name: '', arrival_number: '', arrival_from: '', arrival_to: '',
  arrival_confirmation: '', arrival_departure_date: '', arrival_departure_time: '',
  arrival_arrival_date: '', arrival_arrival_time: '', arrival_cost: '', arrival_currency: 'INR', arrival_notes: '', arrival_transport_options: '', arrival_items: '[]',
  local_transport: '', local_transport_details: '', transfer_mode: '', transfer_from: '', transfer_to: '', transfer_notes: '', transfer_items: '[]', stay_name: '', stay_details: '',
};
const normalizeLogistics = value => Object.fromEntries(Object.keys(EMPTY_LOGISTICS).map(key => [key, value?.[key] || EMPTY_LOGISTICS[key]]));
const TRIP_SECTIONS = [
  ['explore', 'Explore'], ['arrive', 'Arrive'], ['transfer', 'Transfer'], ['itinerary', 'Itinerary'],
  ['stay', 'Stay'], ['depart', 'Depart'], ['budget', 'Budget'], ['essentials', 'Essentials'],
];

function formatConciseDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  if (!end || Number.isNaN(end.getTime())) {
    return start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const eMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const sYear = start.getFullYear();
  const eYear = end.getFullYear();

  if (sYear !== eYear) {
    return `${sDay} ${sMonth} ${sYear} – ${eDay} ${eMonth} ${eYear}`;
  }
  if (sMonth !== eMonth) {
    return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
  }
  if (sDay === eDay) {
    return `${sDay} ${sMonth}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

function getDayDateString(startDate, dayIndex) {
  if (!startDate) return null;
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + dayIndex);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${day} ${month}`;
}

function TripSection({ id, title, expanded, onToggle, children, compact = false, contentClassName = '', headerRight = null }) {
  return <section id={id} className={`min-w-0 scroll-mt-16 border-b border-[#e7ede8] ${compact ? 'py-1' : 'pb-2.5'}`}>
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`${id}-content`}
      onClick={onToggle}
      className={`group flex w-full items-center text-left text-pine transition-colors ${compact ? 'min-h-11 gap-2 rounded-xl px-2 py-1 hover:bg-[#f3f7f4]' : 'min-h-12 gap-2'}`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-200 ${expanded ? 'rotate-90 bg-[#eef4f0] text-pine' : 'text-[#66736b]'}`}>
        <ChevronRight size={compact ? 14 : 16} />
      </span>
      <div className="flex flex-1 min-w-0 items-center justify-between gap-2 pr-1">
        {typeof title === 'string' ? (
          <h2 className={compact ? 'text-base font-semibold leading-5' : 'text-2xl font-black leading-8'}>{title}</h2>
        ) : (
          title
        )}
        {headerRight}
      </div>
    </button>
    {expanded && <div id={`${id}-content`} className={`${compact ? 'pb-2 pt-2' : 'pb-3'} ${contentClassName || (compact ? 'pl-5' : 'px-1')}`}>{children}</div>}
  </section>;
}

function SortableStopCard({ item, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative ${isDragging ? 'z-10 opacity-70' : ''}`}>
    {!props.readOnly && <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${item.title || item.place_name}`} className="absolute left-1 top-3 z-10 grid h-8 w-7 touch-none place-items-center rounded-md text-[#7a8980] hover:bg-[#edf3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"><GripVertical size={16} /></button>}
    <div className={!props.readOnly ? 'pl-6' : ''}><ItineraryStopCard item={item} {...props} /></div>
  </div>;
}

function ItinerarySidebar({ 
  workspaceClassName = '',
  scrollInParent = false,
  backTo = '/trips', backLabel = 'Back to my trips',
  showList, isLandscape, isItineraryExpanded, setIsItineraryExpanded, 
  destinationSlug, destinationName, destinationLatitude, destinationLongitude, tripId,
  items = [], dayCount = 1, onSelectDay = () => {},
  setMapCenter, setMapZoom, setSelectedItem, setMobileView,
  budget, onBudgetChange, startDate, departureDate, readOnly = false, tripNavTarget = null,
  onAddStop = async () => {}, onSaveStop = async () => {}, onDeleteStop = async () => {}, onOptimizeDay = async () => {}, onReorderDay = async () => {}
}) {
  const [activeTripSection, setActiveTripSection] = useState(readOnly ? 'itinerary' : 'explore');
  const [expandedTripSection, setExpandedTripSection] = useState(readOnly ? 'itinerary' : 'explore');
  const [expandedDays, setExpandedDays] = useState(() => new Set([0]));
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
  const tripTabsRef = useRef(null);
  const pendingSectionNavigationRef = useRef(null);
  const pendingSectionNavigationTimeoutRef = useRef(null);
  const savedLogisticsRef = useRef(EMPTY_LOGISTICS);
  const [tripLogistics, setTripLogistics] = useState(EMPTY_LOGISTICS);
  const [logisticsReadyTripId, setLogisticsReadyTripId] = useState(null);
  const [logisticsSaveStatus, setLogisticsSaveStatus] = useState('idle');

  const conciseDateRange = formatConciseDateRange(startDate, departureDate);

  useEffect(() => {
    if (readOnly) return undefined;
    let active = true;
    getTripLogistics(tripId).then(value => {
      if (!active) return;
      const loaded = normalizeLogistics(value);
      savedLogisticsRef.current = loaded;
      setTripLogistics(loaded);
      setLogisticsReadyTripId(tripId);
      setLogisticsSaveStatus('idle');
    }).catch(() => {
      if (!active) return;
      savedLogisticsRef.current = EMPTY_LOGISTICS;
      setTripLogistics(EMPTY_LOGISTICS);
      setLogisticsReadyTripId(tripId);
    });
    return () => { active = false; };
  }, [tripId, readOnly]);

  useEffect(() => {
    if (readOnly || logisticsReadyTripId !== tripId || JSON.stringify(tripLogistics) === JSON.stringify(savedLogisticsRef.current)) return undefined;
    const pending = { ...tripLogistics };
    const timeout = window.setTimeout(async () => {
      setLogisticsSaveStatus('saving');
      try {
        const saved = normalizeLogistics(await saveTripLogistics(tripId, pending));
        savedLogisticsRef.current = saved;
        setLogisticsSaveStatus('saved');
      } catch {
        setLogisticsSaveStatus('error');
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [tripId, logisticsReadyTripId, tripLogistics, readOnly]);

  useEffect(() => {
    const sections = TRIP_SECTIONS.map(([section]) => document.getElementById(`trip-section-${section}`)).filter(Boolean);
    const observer = new IntersectionObserver(() => {
      const activeLine = (tripNavTarget?.getBoundingClientRect().bottom ?? 0) + 24;
      const current = sections.find(section => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= activeLine && bounds.bottom > activeLine;
      });
      if (!current) return;
      const sectionId = current.id.replace('trip-section-', '');
      if (pendingSectionNavigationRef.current && pendingSectionNavigationRef.current !== sectionId) return;
      if (pendingSectionNavigationRef.current === sectionId) {
        pendingSectionNavigationRef.current = null;
        window.clearTimeout(pendingSectionNavigationTimeoutRef.current);
      }
      setActiveTripSection(sectionId);
    }, { threshold: [0, 0.1, 0.3, 0.6] });
    sections.forEach(section => observer.observe(section));
    return () => {
      observer.disconnect();
      window.clearTimeout(pendingSectionNavigationTimeoutRef.current);
      pendingSectionNavigationRef.current = null;
    };
  }, [tripNavTarget]);

  useEffect(() => {
    const tabs = tripTabsRef.current;
    if (!tabs) return undefined;
    const updateScrollButtons = () => {
      setCanScrollTabsLeft(tabs.scrollLeft > 1);
      setCanScrollTabsRight(tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1);
    };
    updateScrollButtons();
    tabs.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(tabs);
    return () => {
      tabs.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
      observer.disconnect();
    };
  }, []);

  const scrollTabs = direction => {
    const tabs = tripTabsRef.current;
    if (!tabs) return;
    tabs.scrollBy({ left: direction * Math.max(120, tabs.clientWidth * 0.65), behavior: 'smooth' });
  };

  const navigateToTripSection = section => {
    setActiveTripSection(section);
    setExpandedTripSection(section);
    pendingSectionNavigationRef.current = section;
    window.clearTimeout(pendingSectionNavigationTimeoutRef.current);
    pendingSectionNavigationTimeoutRef.current = window.setTimeout(() => {
      pendingSectionNavigationRef.current = null;
    }, 1500);
    document.getElementById(`trip-section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleSection = section => setExpandedTripSection(current => current === section ? null : section);
  const updateTripLogistics = (field, value) => {
    setTripLogistics(current => ({ ...current, [field]: value }));
    setLogisticsSaveStatus('editing');
  };

  const saveArrivalDetails = async arrivalDetails => {
    const pending = { ...tripLogistics, ...arrivalDetails };
    setLogisticsSaveStatus('saving');
    try {
      const saved = normalizeLogistics(await saveTripLogistics(tripId, pending));
      savedLogisticsRef.current = saved;
      setTripLogistics(saved);
      setLogisticsSaveStatus('saved');
    } catch (error) {
      setLogisticsSaveStatus('error');
      throw error;
    }
  };

  const deleteArrivalDetails = async () => {
    const pending = { ...tripLogistics };
    ['arrival_mode', 'arrival_details', ...Object.keys(EMPTY_LOGISTICS).filter(field => field.startsWith('arrival_'))].forEach(field => {
      pending[field] = field === 'arrival_currency' ? 'INR' : '';
    });
    setLogisticsSaveStatus('saving');
    try {
      const saved = normalizeLogistics(await saveTripLogistics(tripId, pending));
      savedLogisticsRef.current = saved;
      setTripLogistics(saved);
      setLogisticsSaveStatus('saved');
    } catch (error) {
      setLogisticsSaveStatus('error');
      throw error;
    }
  };

  const deleteTransferDetails = async () => {
    const pending = { ...tripLogistics, transfer_mode: '', transfer_from: '', transfer_to: '', transfer_notes: '' };
    setLogisticsSaveStatus('saving');
    try {
      const saved = normalizeLogistics(await saveTripLogistics(tripId, pending));
      savedLogisticsRef.current = saved;
      setTripLogistics(saved);
      setLogisticsSaveStatus('saved');
    } catch (error) {
      setLogisticsSaveStatus('error');
      throw error;
    }
  };

  const handleLocationClick = item => {
    if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
    setMapCenter({ lat: Number(item.lat), lng: Number(item.lng) });
    setMapZoom(16);
    if (!isLandscape) setMobileView('map');
    setSelectedItem(item);
  };

  const sectionNavigation = (isItineraryExpanded || !isLandscape) && tripNavTarget && createPortal(
    <nav aria-label="Trip sections" className="w-full border-b border-[#e3eae4] bg-white/95 px-1 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.35)] backdrop-blur sm:px-2">
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" onClick={() => scrollTabs(-1)} aria-label="Scroll trip sections left" aria-hidden={!canScrollTabsLeft} tabIndex={canScrollTabsLeft ? 0 : -1} disabled={!canScrollTabsLeft} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e3eae4] bg-white text-pine shadow-sm transition hover:bg-[#f3f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium ${canScrollTabsLeft ? '' : 'invisible pointer-events-none'}`}><ChevronLeft size={18} aria-hidden="true" /></button>
        <div ref={tripTabsRef} className="app-scrollbar-hidden flex min-w-0 flex-1 snap-x snap-mandatory gap-5 overflow-x-auto" aria-label="Trip planner sections">
          {TRIP_SECTIONS.map(([section, label]) => <button key={section} id={`trip-tab-${section}`} type="button" aria-current={activeTripSection === section ? 'location' : undefined} aria-controls={`trip-section-${section}`} onClick={() => navigateToTripSection(section)} className={`relative min-h-12 shrink-0 snap-start whitespace-nowrap border-b-2 px-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium ${activeTripSection === section ? 'border-[#17633f] text-[#17633f]' : 'border-transparent text-[#66736b] hover:text-pine'}`}>
            {label}
          </button>)}
        </div>
        <button type="button" onClick={() => scrollTabs(1)} aria-label="Scroll trip sections right" aria-hidden={!canScrollTabsRight} tabIndex={canScrollTabsRight ? 0 : -1} disabled={!canScrollTabsRight} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e3eae4] bg-white text-pine shadow-sm transition hover:bg-[#f3f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium ${canScrollTabsRight ? '' : 'invisible pointer-events-none'}`}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </nav>,
    tripNavTarget,
  );
  const sidebarOverflowClass = scrollInParent ? 'overflow-visible' : 'overflow-x-hidden overflow-y-auto overscroll-contain';
  const sidebarHeightClass = scrollInParent ? 'min-h-0' : 'h-full min-h-0';

  return (
    <>
    <div className={`min-w-0 ${sidebarOverflowClass} flex flex-col justify-start transition-all duration-300 ease-in-out relative border border-slate-200 ${workspaceClassName}
      ${showList ? 'flex' : 'hidden'}
      ${isLandscape ? (isItineraryExpanded ? `${sidebarHeightClass} w-full px-4 pb-6 pt-0` : 'h-full min-h-0 w-16 self-stretch rounded-lg border border-slate-200 bg-white text-pine shadow-sm p-0') : `${sidebarHeightClass} w-full px-4 pb-6 pt-0`}`}
    >
      {isItineraryExpanded || !isLandscape ? (
        <>
          <section id="trip-section-explore" className="scroll-mt-16">
            {readOnly ? <div className="border-b border-[#e7ede8] pb-3"><button type="button" aria-expanded={expandedTripSection === 'explore'} onClick={() => toggleSection('explore')} className="flex min-h-12 w-full items-center gap-2 text-left text-pine"><ChevronRight size={16} className={`transition-transform ${expandedTripSection === 'explore' ? 'rotate-90' : ''}`} /><h2 className="text-2xl font-black leading-8">Explore</h2></button>{expandedTripSection === 'explore' && <p className="px-1 pb-3 text-sm text-[#66736b]">Explore content is available in the destination guide.</p>}</div> : <ItineraryDiscoveries destinationSlug={destinationSlug} destinationName={destinationName} expanded={expandedTripSection === 'explore'} onExpandedChange={() => toggleSection('explore')} />}
          </section>
          <TripSection id="trip-section-arrive" title="Arrive" expanded={expandedTripSection === 'arrive'} onToggle={() => toggleSection('arrive')}>
            {readOnly ? <p className="text-sm text-[#66736b]">Travel details are private for this view-only link.</p> : <TripLogisticsPanel section="arrive" details={tripLogistics} onSaveArrival={saveArrivalDetails} onDeleteArrival={deleteArrivalDetails} />}
          </TripSection>
          <TripSection id="trip-section-transfer" title="Transfer" expanded={expandedTripSection === 'transfer'} onToggle={() => toggleSection('transfer')}>
            {readOnly ? <p className="text-sm text-[#66736b]">Travel details are private for this view-only link.</p> : <TripLogisticsPanel section="transfer" details={tripLogistics} onChange={updateTripLogistics} onDeleteTransfer={deleteTransferDetails} saveStatus={logisticsSaveStatus} />}
          </TripSection>
          <TripSection
            id="trip-section-itinerary"
            title="Itinerary"
            expanded={expandedTripSection === 'itinerary'}
            onToggle={() => toggleSection('itinerary')}
            contentClassName="px-0"
            headerRight={conciseDateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0d4] bg-[#edf6ef] px-2.5 py-1 text-xs font-bold text-green-ink shadow-sm">
                <CalendarDays size={12} className="text-pine" />
                <span>{conciseDateRange}</span>
              </span>
            )}
          >
            {Array.from({ length: dayCount }, (_, day) => {
              const dayItems = items.filter(item => Number(item.day_index ?? 0) === day);
              const expanded = expandedDays.has(day);
              const dayDate = getDayDateString(startDate, day);
              return <TripSection
                key={day}
                id={`trip-day-section-${day}`}
                title={
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#cbe1d2] bg-[#eaf3ec] px-2.5 py-0.5 text-xs font-black tracking-wide text-green-ink shadow-2xs">
                      Day {day + 1}
                    </span>
                    {dayDate && (
                      <span className="truncate text-sm font-bold text-pine tracking-tight">
                        {dayDate}
                      </span>
                    )}
                  </div>
                }
                headerRight={
                  dayItems.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#d6e3da] bg-[#f0f6f2] px-2.5 py-0.5 text-xs font-semibold text-green-ink">
                      <MapPin size={11} className="text-pine" />
                      <span>{dayItems.length} {dayItems.length === 1 ? 'stop' : 'stops'}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[#93a299]">
                      0 stops
                    </span>
                  )
                }
                expanded={expanded}
                compact
                contentClassName="px-1"
                onToggle={() => {
                  onSelectDay(day);
                  setExpandedDays(current => {
                    const next = new Set(current);
                    if (next.has(day)) next.delete(day);
                    else next.add(day);
                    return next;
                  });
                }}
              >
                {!readOnly && dayItems.length > 1 && (
                  <div className="mb-2.5 flex justify-end px-1">
                    <button type="button" onClick={() => onOptimizeDay(day)} className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-[#cfe0d4] bg-[#f4f9f5] px-2.5 text-xs font-bold text-green-ink transition hover:bg-[#e7f3ea] active:scale-95 shadow-2xs">
                      <Route size={13} />
                      <span>Optimize route</span>
                    </button>
                  </div>
                )}

                {/* Single unified stop list */}
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                  if (!over || active.id === over.id || readOnly) return;
                  const ids = dayItems.map(item => item.id);
                  const reordered = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
                  onReorderDay(day, reordered);
                }}>
                  <SortableContext items={dayItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {dayItems.map(item => <SortableStopCard key={item.id} item={item} dayCount={dayCount} destinationSlug={destinationSlug} readOnly={readOnly} onViewMap={handleLocationClick} onSave={onSaveStop} onDelete={onDeleteStop} />)}
                    </div>
                  </SortableContext>
                </DndContext>
              </TripSection>;
            })}
          </TripSection>
          <TripSection id="trip-section-stay" title="Stay" expanded={expandedTripSection === 'stay'} onToggle={() => toggleSection('stay')}>
            {readOnly ? <p className="text-sm text-[#66736b]">Accommodation details are private for this view-only link.</p> : <TripLogisticsPanel section="stay" details={tripLogistics} onChange={updateTripLogistics} saveStatus={logisticsSaveStatus} />}
          </TripSection>
          <TripSection id="trip-section-depart" title="Depart" expanded={expandedTripSection === 'depart'} onToggle={() => toggleSection('depart')}>
            <p className="text-sm text-text-secondary">{departureDate ? `Your trip ends ${new Date(`${departureDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}.` : 'Your departure date will appear here.'}</p>
          </TripSection>
          <TripSection id="trip-section-budget" title="Budget" expanded={expandedTripSection === 'budget'} onToggle={() => toggleSection('budget')}>
            <label htmlFor="trip-budget" className="block text-sm font-semibold text-[#526158]">Choose a budget style</label>
            <select id="trip-budget" value={budget} onChange={event => onBudgetChange(event.target.value)} disabled={readOnly} className="mt-1 h-11 w-full max-w-lg rounded-lg border border-slate-200 bg-white px-3 text-sm text-pine outline-none focus:border-green-medium focus:ring-2 focus:ring-green-medium/15 disabled:bg-[#f7faf8] disabled:text-[#66736b]"><option value="budget">Budget</option><option value="mid">Mid-range</option><option value="luxury">Luxury</option></select>
            <p className="mt-2 text-xs text-text-secondary">{readOnly ? 'Budget details are not included in this view-only link.' : 'This preference is used when generating an itinerary.'}</p>
          </TripSection>
          <TripSection id="trip-section-essentials" title="Essentials" expanded={expandedTripSection === 'essentials'} onToggle={() => toggleSection('essentials')}>
            {readOnly ? <p className="text-sm text-[#66736b]">Notes and reservations are private for this view-only link.</p> : <TripLogisticsPanel section="essentials" details={tripLogistics} onChange={updateTripLogistics} saveStatus={logisticsSaveStatus} />}
          </TripSection>
        </>
      ) : (
        <WorkspaceRailControls backTo={backTo} backLabel={backLabel} expandLabel="Expand Itinerary" onBack={() => setIsItineraryExpanded(true)} onExpand={() => setIsItineraryExpanded(true)} className="h-full" />
      )}

    </div>
    {sectionNavigation}
    </>
  );
}

export default ItinerarySidebar;
