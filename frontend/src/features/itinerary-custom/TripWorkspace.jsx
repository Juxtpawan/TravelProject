import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, LoaderCircle, MoreVertical, PanelLeftClose, Settings2, Share2, UsersRound, X, Copy, Trash2, Search } from 'lucide-react';
import ItineraryMap from './ItineraryMap';
import ItinerarySidebar from './ItinerarySidebar';
import TripDestinationHeaderBackground from './TripDestinationHeaderBackground';
import PlaceImagePicker from '../../shared/components/place-image-picker/PlaceImagePicker';
import MapWorkspaceLayout from '../../layouts/MapWorkspaceLayout';
import TripNotificationsButton from '../../shared/components/header/TripNotificationsButton';
import { useAuth } from '../auth';
import { addTripItineraryItem, createTripShareLink, deleteTripItineraryItem, generateTripItinerary, getTripCollaborators, getTripShareLinks, getTrips, getTripItinerary, optimizeTripItineraryDay, reorderTripItinerary, removeTripCollaborator, revokeTripShareLink, saveTripNotes, searchTripInviteUsers, updateTripItineraryItem } from '../trips/api/tripsApi';

const MANALI_CENTER = { lat: 32.2432, lng: 77.1892 };
const normalizeItineraryItems = (rawItems) => (Array.isArray(rawItems) ? rawItems : []).map(item => ({
  ...item,
  lat: item.latitude,
  lng: item.longitude,
  title: item.place_name,
}));

/**
 * TripDetailsPage — Phase 4+5+6 combined.
 *
 * Architecture:
 *   ┌─────────────────────────────┐
 *   │  TripDetailsPage (state)    │
 *   │  ┌───────────┬───────────┐  │
 *   │  │Itinerary  │ Itinerary │  │
 *   │  │Sidebar    │  Map      │  │
 *   │  │(your file)│(your file)│  │
 *   │  └───────────┴───────────┘  │
 *   └─────────────────────────────┘
 *
 * State lives here so both child components stay in sync.
 */
export default function TripDetailsPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const originPath = typeof location.state?.from === 'string'
    && location.state.from.startsWith('/')
    && !location.state.from.startsWith('//')
    ? location.state.from
    : null;
  const backPath = location.state?.fromProfile ? '/profile' : originPath || '/trips';
  const backLabel = location.state?.fromProfile
    ? 'Back to profile'
    : originPath?.startsWith('/locations/') ? 'Back to destination' : 'Back to my trips';
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // ── Responsive layout state ───────────────────────────────────────────────
  const [isLandscape, setIsLandscape] = useState(window.innerWidth >= 729);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'map'
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(true);

  // ── Map state ─────────────────────────────────────────────────────────────
  const [mapCenter, setMapCenter] = useState(MANALI_CENTER);
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [userLocation, setUserLocation] = useState(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [trip, setTrip] = useState(null);
  const [destinationImageSelection, setDestinationImageSelection] = useState({ tripId: null, image: null });
  const selectedDestinationImage = destinationImageSelection.tripId === tripId ? destinationImageSelection.image : null;
  const [tripNotes, setTripNotes] = useState('');
  const [tripNotesHeight, setTripNotesHeight] = useState(64);
  const tripNotesRef = useRef(null);
  const [tripNotesStatus, setTripNotesStatus] = useState('idle');
  const [items, setItems] = useState([]);
  const [loadedTripId, setLoadedTripId] = useState(null);
  const [loadError, setLoadError] = useState('');

  // ── AI Panel state ────────────────────────────────────────────────────────
  const [showAiPanel, setShowAiPanel] = useState(() => searchParams.get('mode') === 'ai');
  const [showTripMenu, setShowTripMenu] = useState(false);
  const [showTripSettings, setShowTripSettings] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareRole, setShareRole] = useState('editor');
  const [inviteeQuery, setInviteeQuery] = useState('');
  const [inviteeUser, setInviteeUser] = useState(null);
  const [inviteeResults, setInviteeResults] = useState([]);
  const [inviteeSearching, setInviteeSearching] = useState(false);
  const inviteSearchTimer = useRef(null);
  const inviteSearchVersion = useRef(0);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLinkId, setShareLinkId] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [tripmates, setTripmates] = useState([]);
  const [shareLinks, setShareLinks] = useState([]);
  const [aiStyle, setAiStyle] = useState('balanced');
  const [aiBudget, setAiBudget] = useState('mid');
  const [aiLoading, setAiLoading] = useState(false);
  const loading = authLoading || Boolean(user?.id && loadedTripId !== tripId);

  // ── Responsive resize listener ────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= 729);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resizeTripNotes = useCallback(() => {
    const textarea = tripNotesRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.max(64, textarea.scrollHeight + 2);
    textarea.style.height = `${nextHeight}px`;
    setTripNotesHeight(current => current === nextHeight ? current : nextHeight);
  }, []);

  useLayoutEffect(() => {
    resizeTripNotes();
    window.addEventListener('resize', resizeTripNotes);
    return () => window.removeEventListener('resize', resizeTripNotes);
  }, [resizeTripNotes, tripNotes]);

  // ── Load trip + itinerary from backend ───────────────────────────────────
  useEffect(() => {
    if (authLoading || !user?.id) return undefined;

    let current = true;
    const loadAll = async () => {
      try {
        const [trips, rawItems] = await Promise.all([getTrips(), getTripItinerary(tripId)]);
        if (!current) return;
        const found = trips.find(t => t.id === tripId);
        setTrip(found || null);
        setTripNotes(found?.notes || '');
        setTripNotesStatus('idle');

        // Normalise: ItineraryMap uses item.lat / item.lng
        // Our DB returns item.latitude / item.longitude
        const normalised = normalizeItineraryItems(rawItems);
        setItems(Array.isArray(normalised) ? normalised : []);

        // Centre map on first item if it has coords
        if (normalised[0]?.lat) {
          setMapCenter({ lat: normalised[0].lat, lng: normalised[0].lng });
        }
      } catch (err) {
        console.error('Failed to load trip:', err);
        if (current) setLoadError('This trip could not be loaded. Check your connection and try again.');
      } finally {
        if (current) setLoadedTripId(tripId);
      }
    };
    loadAll();
    return () => { current = false; };
  }, [authLoading, tripId, user?.id]);

  useEffect(() => {
    if (loadedTripId !== tripId || !trip || trip.trip_role === 'viewer' || tripNotes === (trip.notes || '')) return undefined;
    const timeoutId = window.setTimeout(async () => {
      setTripNotesStatus('saving');
      try {
        await saveTripNotes(tripId, tripNotes);
        setTripNotesStatus('saved');
        setTrip((current) => current?.id === tripId ? { ...current, notes: tripNotes } : current);
      } catch {
        setTripNotesStatus('error');
      }
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [loadedTripId, trip, tripId, tripNotes]);

  const handleSelectDay = useCallback(dayIndex => {
    setSelectedDay(dayIndex);
    setSelectedItem(null);
    const firstStop = items.find(item => Number(item.day_index ?? 0) === dayIndex);
    if (firstStop && Number.isFinite(Number(firstStop.lat)) && Number.isFinite(Number(firstStop.lng))) {
      setMapCenter({ lat: Number(firstStop.lat), lng: Number(firstStop.lng) });
      setMapZoom(13);
    }
  }, [items]);

  const refreshItinerary = useCallback(async () => {
    const rawItems = await getTripItinerary(tripId);
    setItems(normalizeItineraryItems(rawItems));
  }, [tripId]);

  const addItineraryStop = async (dayIndex, place) => {
    const orderIndex = items.filter(item => Number(item.day_index ?? 0) === dayIndex).length;
    await addTripItineraryItem(tripId, {
      ...(place.source === 'google' ? { googlePlace: {
        googlePlaceId: place.google_place_id,
        name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
      } } : { placeId: place.id }),
      dayIndex,
      orderIndex,
      startTime: null,
      endTime: null,
      note: '',
    });
    await refreshItinerary();
    setSelectedDay(dayIndex);
    toast.success(`${place.name} added to Day ${dayIndex + 1}`);
  };

  const saveItineraryStop = async (itemId, updates) => {
    await updateTripItineraryItem(tripId, itemId, updates);
    await refreshItinerary();
    toast.success('Itinerary stop updated');
  };

  const deleteItineraryStop = async (itemId) => {
    await deleteTripItineraryItem(tripId, itemId);
    setSelectedItem(current => current?.id === itemId ? null : current);
    await refreshItinerary();
    toast.success('Stop removed from itinerary');
  };

  const reorderItineraryDay = async (dayIndex, orderedIds) => {
    const dayItems = items.filter(item => Number(item.day_index ?? 0) === dayIndex);
    const reordered = orderedIds.map(id => dayItems.find(item => item.id === id)).filter(Boolean);
    const remaining = dayItems.filter(item => !orderedIds.includes(item.id));
    const all = [...reordered, ...remaining];
    await reorderTripItinerary(tripId, all.map((item, orderIndex) => ({ id: item.id, dayIndex, orderIndex })));
    await refreshItinerary();
  };

  const optimizeItineraryDay = async (dayIndex) => {
    try {
      const result = await optimizeTripItineraryDay(tripId, dayIndex);
      await refreshItinerary();
      toast.success(result.source === 'google_routes' ? 'Route optimized with live travel estimates' : 'Stops reordered by nearby locations');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'This day could not be optimized.');
    }
  };

  const shareTrip = () => {
    if (!trip) return;
    setShareUrl('');
    setShareLinkId('');
    setShareRole('editor');
    setInviteeQuery('');
    setInviteeUser(null);
    setInviteeResults([]);
    setShowShareDialog(true);
    if (trip.trip_role === 'owner') Promise.all([getTripCollaborators(tripId), getTripShareLinks(tripId)]).then(([people, links]) => { setTripmates(people); setShareLinks(links); }).catch(() => { setTripmates([]); setShareLinks([]); });
  };

  const createShareLink = async () => {
    setShareLoading(true);
    try {
      const result = await createTripShareLink(tripId, shareRole, inviteeUser?.id || '');
      const url = new URL(result.path, window.location.origin).toString();
      setShareUrl(url);
      setShareLinkId(result.id);
      if (trip?.trip_role === 'owner') setShareLinks(await getTripShareLinks(tripId));
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`${shareRole === 'editor' ? 'Edit invite' : 'View-only link'} copied`);
      } catch { toast.success('Link created. Copy it below to share.'); }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'The trip link could not be created.');
    } finally { setShareLoading(false); }
  };

  const removeTripmate = async userId => {
    try {
      await removeTripCollaborator(tripId, userId);
      setTripmates(current => current.filter(person => person.user_id !== userId));
      toast.success('Tripmate removed');
    } catch { toast.error('Tripmate could not be removed.'); }
  };

  const revokeLink = async linkId => {
    try {
      await revokeTripShareLink(tripId, linkId);
      setShareLinks(current => current.filter(link => link.id !== linkId));
      if (shareLinkId === linkId) { setShareLinkId(''); setShareUrl(''); }
      toast.success('Link revoked');
    } catch { toast.error('The link could not be revoked.'); }
  };

  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }
    catch { toast.error('Link could not be copied'); }
  };

  const searchInvitees = query => {
    setInviteeQuery(query);
    setInviteeUser(null);
    setInviteeResults([]);
    window.clearTimeout(inviteSearchTimer.current);
    const version = ++inviteSearchVersion.current;
    if (query.trim().replace(/^@/, '').length < 2) { setInviteeSearching(false); return; }
    setInviteeSearching(true);
    inviteSearchTimer.current = window.setTimeout(async () => {
      try {
        const users = await searchTripInviteUsers(query.trim());
        if (version === inviteSearchVersion.current) setInviteeResults(users);
      } catch {
        if (version === inviteSearchVersion.current) setInviteeResults([]);
      } finally {
        if (version === inviteSearchVersion.current) setInviteeSearching(false);
      }
    }, 250);
  };

  const handleGenerateAI = async () => {
    if (trip?.trip_role === 'viewer') return;
    setAiLoading(true);
    try {
      const data = await generateTripItinerary(tripId, { style: aiStyle, budget: aiBudget });
      if (data.success) {
        const normalised = normalizeItineraryItems(data.itinerary);
        setItems(normalised);
        setShowAiPanel(false);
        toast.success(`✨ AI drafted ${normalised.length} stops!`);
      } else {
        toast.error(data.error || 'AI generation failed');
      }
    } catch {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (!loading && (!user || !trip)) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-pine">{loadError ? 'Trip unavailable' : 'Trip not found'}</h1>
          <p className="mt-2 text-sm text-[#66736b]">{loadError || 'This trip may have been removed or belong to another account.'}</p>
          <button onClick={() => navigate(backPath)} className="mt-5 rounded-full bg-btn-primary-bg px-5 py-2.5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">{backLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MapWorkspaceLayout
        flush
        stickyNav
        scrollHeaderWithSidebar
        headerBackdrop={<TripDestinationHeaderBackground placeId={trip?.destination_google_place_id || ''} destinationId={trip?.destination_id} destinationName={trip?.destination_name || trip?.title} latitude={trip?.destination_latitude} longitude={trip?.destination_longitude} imageOverride={selectedDestinationImage} />}
        header={<div className="relative z-20 flex min-w-0 flex-col items-stretch gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button type="button" onClick={() => navigate(backPath)} aria-label={backLabel} title={backLabel}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/95 text-pine shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:h-9 sm:w-9">
                <ArrowLeft size={14} />
              </button>
              <span className="text-white/70">|</span>
              {trip && <PlaceImagePicker placeId={trip.destination_google_place_id || ''} destinationId={trip.destination_id} destinationName={trip.destination_name || trip.title} latitude={trip.destination_latitude} longitude={trip.destination_longitude} onSelect={image => setDestinationImageSelection({ tripId, image })} buttonClassName="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/70 bg-white/95 text-pine shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:h-9 sm:w-9" buttonIconSize={14} />}
            </div>
            <div className="relative z-40 flex shrink-0 items-center gap-1 sm:gap-2">
              <TripNotificationsButton compact size="small" />
              <div className="relative">
                <button type="button" onClick={() => setShowTripMenu(value => !value)} aria-label="Trip menu" title="Trip menu" aria-expanded={showTripMenu} className="inline-grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/95 text-pine shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:h-9 sm:w-9">
                  <MoreVertical size={14} />
                </button>
                {showTripMenu && <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-[#dce5de] bg-white p-1.5 text-pine shadow-xl">
                  <button type="button" onClick={() => { setShowTripMenu(false); setShowTripSettings(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-[#f2f7f3]">
                    <Settings2 size={15} /> Trip settings
                  </button>
                </div>}
              </div>
              {isLandscape && <button type="button" onClick={() => setIsItineraryExpanded(false)} aria-label="Collapse itinerary list" title="Collapse itinerary list"
                className="hidden h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-white/70 bg-white/95 px-2 text-[10px] font-semibold text-pine shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium min-[729px]:inline-flex">
                <PanelLeftClose size={14} />
              </button>}
            </div>
          </div>
          <div className="z-30 mx-auto flex w-full max-w-xl min-w-0 flex-col items-center">
            <h1 className="w-full whitespace-normal break-words text-center font-sans text-[1.375rem] font-extrabold leading-tight tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.75)] sm:text-[1.625rem] min-[729px]:text-[2rem]">
              {trip ? `Trip to ${trip.destination_name || trip.title}` : 'Trip Planner'}
            </h1>
          </div>
          {trip?.trip_role !== 'viewer' && <div className="z-20 mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-1">
            <textarea
              ref={tripNotesRef}
              aria-label="Trip notes"
              placeholder="Add notes for your trip…"
              value={tripNotes}
              maxLength={4000}
              rows={2}
              onChange={(event) => { setTripNotes(event.target.value); setTripNotesStatus('editing'); }}
              className="box-border min-h-16 w-full resize-none overflow-hidden rounded-lg border border-[#cfe0d2] bg-white px-3 py-2.5 text-sm leading-5 text-pine shadow-md outline-none placeholder:text-[#718077] focus:border-green-medium focus:ring-2 focus:ring-green-medium/15"
              style={{ height: `${tripNotesHeight}px` }}
            />
            <span className="inline-flex min-h-3 items-center gap-1 text-[11px] leading-3 text-white drop-shadow" aria-live="polite">
              {tripNotesStatus === 'saving' && <><LoaderCircle size={10} className="animate-spin" />Saving notes…</>}
              {tripNotesStatus === 'saved' && <><Check size={10} />Notes saved</>}
              {tripNotesStatus === 'error' && 'Notes could not be saved'}
              {tripNotesStatus === 'editing' && 'Notes save automatically'}
            </span>
          </div>}
          {trip?.trip_role === 'owner' && <div className="flex w-full justify-end gap-1.5 sm:gap-2">
            <button type="button" onClick={shareTrip} aria-label="Share trip" title="Share trip" className="inline-flex h-8 items-center gap-1 rounded-full border border-white/80 bg-white/95 px-2 text-[10px] font-bold text-pine shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[11px]">
              <Share2 size={13} aria-hidden="true" />Share
            </button>
            <button type="button" onClick={shareTrip} aria-label="Invite tripmates" title="Invite tripmates" className="inline-flex h-8 items-center gap-1 rounded-full bg-green-medium px-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#008f5b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2 sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[11px]">
              <UsersRound size={13} aria-hidden="true" />Invite
            </button>
          </div>}
        </div>}
        auxiliary={showAiPanel && trip?.trip_role !== 'viewer' && <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#d3e8d8] bg-[#f1f8f3] p-4">
          <div>
            <label className="block text-xs font-semibold text-[#17633f] mb-1">Travel Style</label>
            <select value={aiStyle} onChange={e => setAiStyle(e.target.value)}
              className="text-sm border border-[#bdd7c4] rounded-lg px-2 py-1.5 bg-white">
              <option value="relaxed">🧘 Relaxed</option>
              <option value="balanced">⚖️ Balanced</option>
              <option value="adventure">🏔️ Adventure</option>
              <option value="food">🍜 Food Focused</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#17633f] mb-1">Budget</label>
            <select value={aiBudget} onChange={e => setAiBudget(e.target.value)}
              className="text-sm border border-[#bdd7c4] rounded-lg px-2 py-1.5 bg-white">
              <option value="budget">💰 Budget</option>
              <option value="mid">💳 Mid-range</option>
              <option value="luxury">💎 Luxury</option>
            </select>
          </div>
          <button onClick={handleGenerateAI} disabled={aiLoading}
            className="bg-btn-primary-bg text-btn-primary-text text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-btn-primary-bg-hover transition disabled:opacity-60">
            {aiLoading ? '✨ Generating…' : '✨ Generate Itinerary'}
          </button>
          <p className="text-xs text-[#8b6637] self-center">This replaces your current itinerary.</p>
        </div>}
        sidebar={loading ? <div className="flex h-full items-center justify-center text-slate-500">
            Loading…
          </div> :
              <ItinerarySidebar
                key={`${tripId}:${trip.trip_role}`}
                workspaceClassName="border-t-0"
                scrollInParent
                showList
                backTo={backPath}
                backLabel={backLabel}
                isLandscape={isLandscape}
                isItineraryExpanded={isItineraryExpanded}
                setIsItineraryExpanded={setIsItineraryExpanded}
                tripId={tripId}
                destinationName={trip.destination_name || trip.title}
                destinationSlug={trip.destination_slug}
                destinationLatitude={trip.destination_latitude}
                destinationLongitude={trip.destination_longitude}
                items={items}
                dayCount={Math.max(1, Math.round((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1)}
                onSelectDay={handleSelectDay}
                setMapCenter={setMapCenter}
                setMapZoom={setMapZoom}
                setSelectedItem={setSelectedItem}
                setMobileView={setMobileView}
                budget={aiBudget}
                onBudgetChange={setAiBudget}
                 startDate={trip.start_date}
                departureDate={trip.end_date}
                endDate={trip.end_date}
                 readOnly={trip.trip_role === 'viewer'}
                 onAddStop={addItineraryStop}
                 onSaveStop={saveItineraryStop}
                 onDeleteStop={deleteItineraryStop}
                 onReorderDay={reorderItineraryDay}
                 onOptimizeDay={optimizeItineraryDay}
               />}
        map={!loading && <ItineraryMap
          showMap
          mapCenter={mapCenter}
          setMapCenter={setMapCenter}
          mapZoom={mapZoom}
          setMapZoom={setMapZoom}
          items={items.filter(item => Number(item.day_index ?? 0) === selectedDay)}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
        />}
        mobileView={mobileView}
        onToggleView={() => setMobileView(view => view === 'list' ? 'map' : 'list')}
        hideMobileHeader
        sidebarExpanded={isItineraryExpanded}
      />
      {showShareDialog && trip && <div className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setShowShareDialog(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="trip-invite-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 text-pine shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-green-ink">Plan together</p><h2 id="trip-invite-title" className="mt-1 text-xl font-extrabold sm:text-2xl">Invite tripmates</h2><p className="mt-1 text-sm text-[#66736b]">{trip.destination_name || trip.title}</p></div>
            <button type="button" onClick={() => setShowShareDialog(false)} aria-label="Close invite tripmates" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-[#f2f7f3]"><X size={18} /></button>
          </div>
          {trip.trip_role === 'owner' ? <>
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#f1f6f2] p-1">
              <button type="button" onClick={() => { setShareRole('editor'); setShareUrl(''); setShareLinkId(''); }} aria-pressed={shareRole === 'editor'} className={`min-h-10 rounded-lg px-2 text-sm font-bold transition ${shareRole === 'editor' ? 'bg-white text-pine shadow-sm' : 'text-[#66736b]'}`}>Can edit</button>
              <button type="button" onClick={() => { setShareRole('viewer'); setShareUrl(''); setShareLinkId(''); }} aria-pressed={shareRole === 'viewer'} className={`min-h-10 rounded-lg px-2 text-sm font-bold transition ${shareRole === 'viewer' ? 'bg-white text-pine shadow-sm' : 'text-[#66736b]'}`}>View only</button>
            </div>
            {shareRole === 'editor' && <div className="mt-4">
              <label htmlFor="tripmate-search" className="block text-sm font-semibold text-pine">Search tripmate profile</label>
              {inviteeUser ? <div className="mt-1.5 flex min-h-12 items-center gap-3 rounded-xl border border-[#b9d5c0] bg-[#f3f8f4] px-3 py-2">
                {inviteeUser.avatar_url ? <img src={inviteeUser.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e2eee5] text-xs font-bold text-pine">{(inviteeUser.name || inviteeUser.username || '?').slice(0, 1).toUpperCase()}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{inviteeUser.name || `@${inviteeUser.username}`}</span><span className="block truncate text-xs text-[#66736b]">@{inviteeUser.username}</span></span>
                <button type="button" onClick={() => { setInviteeUser(null); setInviteeQuery(''); setInviteeResults([]); setShareUrl(''); }} aria-label="Remove selected tripmate" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#66736b] hover:bg-white"><X size={15} /></button>
              </div> : <div className="relative mt-1.5">
                <div className="flex h-11 items-center gap-2 rounded-xl border border-[#d6dfd8] bg-white px-3 focus-within:border-green-medium focus-within:ring-2 focus-within:ring-green-medium/15"><Search size={16} className="shrink-0 text-[#718077]" /><input id="tripmate-search" value={inviteeQuery} onChange={event => { searchInvitees(event.target.value); setShareUrl(''); }} autoComplete="off" placeholder="Search by username or name" aria-autocomplete="list" aria-expanded={inviteeResults.length > 0} className="min-w-0 flex-1 bg-transparent text-sm font-normal text-pine outline-none focus-visible:outline-none placeholder:text-[#7b8980]" /></div>
                {(inviteeSearching || (inviteeQuery.trim().replace(/^@/, '').length >= 2 && !inviteeResults.length)) && <div className="px-2 pt-1.5 text-xs text-[#66736b]">{inviteeSearching ? 'Searching profiles…' : 'No matching profiles found.'}</div>}
                {inviteeResults.length > 0 && <ul role="listbox" aria-label="Matching tripmate profiles" className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#e0e8e1] bg-white p-1 shadow-lg">{inviteeResults.map(person => <li key={person.id}><button type="button" role="option" aria-selected="false" onClick={() => { setInviteeUser(person); setInviteeQuery(''); setInviteeResults([]); setShareUrl(''); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#f2f7f3]">
                  {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e2eee5] text-xs font-bold text-pine">{(person.name || person.username || '?').slice(0, 1).toUpperCase()}</span>}
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-pine">{person.name || `@${person.username}`}</span><span className="block truncate text-xs text-[#66736b]">@{person.username}</span></span>
                </button></li>)}</ul>}
              </div>}
            </div>}
            <p className="mt-2 text-xs leading-5 text-[#66736b]">{shareRole === 'editor' ? 'Choose a profile. They’ll sign in and request access; you approve them before they can edit.' : 'Anyone with the link can view the trip overview and itinerary without an account. Notes and reservations stay private.'}</p>
            <button type="button" onClick={createShareLink} disabled={shareLoading || (shareRole === 'editor' && !inviteeUser?.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-bold text-white transition hover:bg-[#003d27] disabled:opacity-60">
              {shareLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Share2 size={16} />}{shareLoading ? 'Creating link…' : `Create ${shareRole === 'editor' ? 'edit invite' : 'view-only link'}`}
            </button>
            {shareUrl && <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#dce5de] bg-[#f8faf8] p-2"><input readOnly value={shareUrl} aria-label="Trip invite link" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-[#526158] outline-none" /><button type="button" onClick={copyShareUrl} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#cfdcd2] bg-white px-3 text-xs font-bold hover:bg-[#f1f6f2]"><Copy size={13} />Copy</button></div>}
            <div className="mt-5 border-t border-[#e7ede8] pt-4">
              <h3 className="text-sm font-extrabold">Manage tripmates</h3>
              {tripmates.length === 0 ? <p className="mt-2 text-xs text-[#66736b]">No one has joined this trip yet.</p> : <ul className="mt-2 space-y-2">{tripmates.map(person => <li key={person.user_id} className="flex items-center gap-3 rounded-xl bg-[#f7faf8] px-3 py-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.name || person.username || person.email}</span><span className="block truncate text-xs text-[#66736b]">{person.email} · {person.status === 'pending' ? 'Request pending' : person.role === 'editor' ? 'Can edit' : 'View only'}</span></span><button type="button" onClick={() => removeTripmate(person.user_id)} aria-label={`Remove ${person.name || person.email}`} title="Remove tripmate" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#718077] hover:bg-white hover:text-[#a13a31]"><Trash2 size={14} /></button></li>)}</ul>}
            </div>
            <div className="mt-4 border-t border-[#e7ede8] pt-4">
              <h3 className="text-sm font-extrabold">Active links</h3>
              {shareLinks.length === 0 ? <p className="mt-2 text-xs text-[#66736b]">No active links.</p> : <ul className="mt-2 space-y-2">{shareLinks.map(link => <li key={link.id} className="flex items-center gap-3 rounded-xl bg-[#f7faf8] px-3 py-2.5"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{link.role === 'editor' ? 'Can edit' : 'View only'}</span><span className="block truncate text-xs text-[#66736b]">{link.target_email || link.target_username || 'Anyone with the link'}</span></span><button type="button" onClick={() => revokeLink(link.id)} aria-label="Revoke link" title="Revoke link" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#718077] hover:bg-white hover:text-[#a13a31]"><Trash2 size={14} /></button></li>)}</ul>}
            </div>
          </> : <p className="mt-5 rounded-xl bg-[#f7faf8] p-4 text-sm text-[#66736b]">Only the trip owner can create invite links or manage tripmates.</p>}
        </section>
      </div>}
      {showTripSettings && trip && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) setShowTripSettings(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="trip-settings-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 text-pine shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wider text-green-ink">Trip settings</p><h2 id="trip-settings-title" className="mt-1 text-xl font-extrabold">{trip.title || trip.destination_name}</h2></div>
            <button type="button" onClick={() => setShowTripSettings(false)} aria-label="Close trip settings" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-pine"><X size={17} /></button>
          </div>
          <dl className="mt-5 space-y-3 rounded-xl bg-[#f7faf8] p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Destination</dt><dd className="text-right font-semibold">{trip.destination_name || trip.title}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Starts</dt><dd className="text-right font-semibold">{trip.start_date ? new Date(`${trip.start_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not set'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Ends</dt><dd className="text-right font-semibold">{trip.end_date ? new Date(`${trip.end_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not set'}</dd></div>
          </dl>
        </section>
      </div>}
    </>
  );
}
