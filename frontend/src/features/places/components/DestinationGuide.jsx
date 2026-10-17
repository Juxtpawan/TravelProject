import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, BedDouble, BookOpen, Compass, Heart, MapPin, PanelLeftClose, Utensils, Landmark, LoaderCircle, Sparkles } from 'lucide-react';
import { getDestinationGuide, resolveDestination } from '../api/placesApi';
import { searchGoogleGuidePlaces, storeGooglePlaceIds } from '../api/googlePlaces';
import { createTrip } from '../../trips/api/tripsApi';
import { useAuth } from '../../auth';
import { InteractiveMap, NumberedPin, NumberedPlaceMarker } from '../../maps';
import { WishlistButton, WishlistCollectionPicker, useWishlist, useWishlistAccount } from '../../wishlist';
import CommonsPlaceImage from '../../place-images/components/CommonsPlaceImage';
import MapWorkspaceLayout from '../../../layouts/MapWorkspaceLayout';
import WorkspaceRailControls from '../../../shared/components/workspace-rail/WorkspaceRailControls';
import ProjectName from '../../../shared/components/project-name/ProjectName';
import DateRangePicker from '../../../shared/components/date-range-picker/DateRangePicker';
import PlaceDetailsPanel from './PlaceDetailsPanel';

const categories = [
  { key: 'attraction', title: 'Places to visit', sectionTitle: 'Where to go', singular: 'place to visit', Icon: Landmark, color: 'var(--color-green-medium)', border: 'var(--color-pine)', types: ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark', 'park', 'zoo', 'aquarium', 'amusement_park', 'place_of_worship'] },
  { key: 'restaurant', title: 'Restaurants', sectionTitle: 'Where to eat', singular: 'restaurant', Icon: Utensils, color: '#e46432', border: '#b84620', types: ['restaurant'] },
  { key: 'hotel', title: 'Hotels', sectionTitle: 'Where to stay', singular: 'hotel', Icon: BedDouble, color: '#3972c6', border: '#24549d', types: ['hotel'] },
];
const EMPTY_ENTITIES = [];

const normalizedCategory = (category = '') => {
  const value = category.toLowerCase();
  if (['restaurant', 'cafe', 'bar', 'eat', 'drink'].includes(value)) return 'restaurant';
  if (['hotel', 'lodging', 'sleep'].includes(value)) return 'hotel';
  return 'attraction';
};

function attachGuideContent(place, entities = []) {
  const placeId = place.google_place_id || (place.source === 'Google Maps' ? place.id : null);
  if (!placeId) return place;
  const entity = entities.find((candidate) =>
    (candidate.google_place_id || candidate.place_id || candidate.placeId) === placeId
    && normalizedCategory(candidate.entity_type) === normalizedCategory(place.category));
  return entity ? {
    ...place,
    summary: entity.why_go || entity.summary || place.summary,
    tips: Array.isArray(entity.tips) ? entity.tips : [],
  } : place;
}

function FitPlaces({ places, center }) {
  const map = useMap('destination-guide-map');
  const fitKey = places.map((place) => place.id).join('|');
  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const points = places.map((place) => ({ lat: Number(place.latitude), lng: Number(place.longitude) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!points.length && center) {
      map.setCenter(center);
      map.setZoom(12);
    } else if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
    } else if (points.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    }
  }, [map, places, fitKey, center]);
  return null;
}

function destinationCenter(destination) {
  const lat = Number(destination?.latitude);
  const lng = Number(destination?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: 20, lng: 0 };
}

export default function DestinationPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: sessionLoading } = useAuth();
  const placesLibrary = useMapsLibrary('places');
  const [guideState, setGuideState] = useState({ slug: null, guide: null, error: '' });
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [activeCategory, setActiveCategory] = useState('attraction');
  const [requestedCategories, setRequestedCategories] = useState({ attraction: true });
  const [placesPanelExpanded, setPlacesPanelExpanded] = useState(true);
  const [googleResults, setGoogleResults] = useState({});
  const [categorySearchErrors, setCategorySearchErrors] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [mapCenter, setMapCenter] = useState({ lat: 20, lng: 0 });
  const [mapZoom, setMapZoom] = useState(12);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [planError, setPlanError] = useState('');
  const createTripInFlight = useRef(false);
  const resumedTripKey = useRef('');
  const [saveRequest, setSaveRequest] = useState(null);
  const { activeList, hasPlaceInList, setPlaceSaved } = useWishlist();
  const { isLoading: authLoading, requireAccount } = useWishlistAccount();
  const wishlist = useMemo(() => activeList.items.filter((item) => item.provider === 'google'), [activeList]);
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const syncedGooglePlaceIds = useRef(new Set());
  const googleSearchRequests = useRef(new Set());
  const currentSlug = useRef(slug);
  currentSlug.current = slug;
  const crawlPollCount = useRef(0);
  const [crawlPollTick, setCrawlPollTick] = useState(0);
  const guide = guideState.slug === slug ? guideState.guide : null;
  const loading = guideState.slug !== slug;
  const error = guideState.slug === slug ? guideState.error : '';
  const destination = guide?.destination;

  const createDestinationTrip = useCallback(async (tripDates) => {
    if (!destination || createTripInFlight.current) return;
    createTripInFlight.current = true;
    setCreatingTrip(true);
    setPlanError('');
    try {
      const result = await createTrip({
        destinationId: destination.id,
        destinationName: destination.name,
        title: destination.name,
        startDate: tripDates.startDate,
        endDate: tripDates.endDate,
      });
      if (!result.success || !result.id) throw new Error('Your trip could not be created. Please try again.');
      navigate(`/trips/${result.id}`, { state: { from: `/locations/${slug}` } });
    } catch (requestError) {
      setPlanError(requestError.response?.data?.error || requestError.message || 'Your trip could not be created. Please try again.');
      createTripInFlight.current = false;
      setCreatingTrip(false);
    }
  }, [destination, navigate, slug]);

  const handlePlanTrip = (event) => {
    event.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Choose your trip dates before planning.');
      return;
    }
    if (!destination) return;
    const tripDates = { startDate, endDate };
    if (!user) {
      const returnQuery = new URLSearchParams({ planStart: startDate, planEnd: endDate });
      navigate('/auth/login', {
        state: { from: `/locations/${slug}?${returnQuery.toString()}` },
      });
      return;
    }
    createDestinationTrip(tripDates);
  };

  useEffect(() => {
    const returnQuery = new URLSearchParams(location.search);
    const pendingStartDate = returnQuery.get('planStart');
    const pendingEndDate = returnQuery.get('planEnd');
    const pendingTrip = pendingStartDate && pendingEndDate && destination
      ? { destinationId: destination.id, destinationName: destination.name, startDate: pendingStartDate, endDate: pendingEndDate }
      : null;
    if (sessionLoading || !user || !destination || !pendingTrip || pendingTrip.destinationId !== destination.id) return;
    const key = `${pendingTrip.destinationId}:${pendingTrip.startDate}:${pendingTrip.endDate}`;
    if (resumedTripKey.current === key) return;
    resumedTripKey.current = key;
    setStartDate(pendingTrip.startDate);
    setEndDate(pendingTrip.endDate);
    createDestinationTrip(pendingTrip);
  }, [sessionLoading, createDestinationTrip, destination, location.search, user]);

  useEffect(() => {
    let active = true;
    crawlPollCount.current = 0;
    getDestinationGuide(slug)
      .then((result) => {
        if (!active) return;
        setGuideState({ slug, guide: result, error: '' });
        setDestinationDetails(null);
        setGoogleResults({});
        setCategorySearchErrors({});
        setSelectedId(null);
        setActiveCategory('attraction');
        setRequestedCategories({ attraction: true });
        setShowWishlistOnly(false);
        setCrawlPollTick(0);
        const location = destinationCenter(result.destination);
        if (result.destination?.latitude != null && result.destination?.longitude != null) setMapCenter(location);
      })
      .catch((requestError) => {
        if (active) setGuideState({
          slug,
          guide: null,
          error: requestError.response?.status === 404 ? 'This destination is not saved yet. Search for it and choose a suggested destination first.' : 'We could not load this destination guide. Please try again.',
        });
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    const restoreForMobile = () => {
      if (window.innerWidth < 729) setPlacesPanelExpanded(true);
    };
    window.addEventListener('resize', restoreForMobile);
    return () => window.removeEventListener('resize', restoreForMobile);
  }, []);

  useEffect(() => {
    const status = guide?.crawler?.status;
    if (!['queued', 'pending'].includes(status) || crawlPollCount.current >= 8) return undefined;
    const timer = setTimeout(async () => {
      crawlPollCount.current += 1;
      try {
        const refreshed = await getDestinationGuide(slug);
        setGuideState({ slug, guide: refreshed, error: '' });
      } catch {
        // Keep the guide usable if the optional crawler service is temporarily down.
      }
      setCrawlPollTick((tick) => tick + 1);
    }, 7000);
    return () => clearTimeout(timer);
  }, [slug, guide?.crawler?.status, crawlPollTick]);

  useEffect(() => {
    const placeId = destination?.google_place_id;
    if (!placesLibrary || !placeId || destinationDetails?.placeId === placeId) return undefined;
    const geoTime = Date.parse(destination.geo_cached_at || '');
    const geoAge = Date.now() - geoTime;
    const geoIsFresh = Number.isFinite(geoTime) && geoAge >= 0 && geoAge < 30 * 24 * 60 * 60 * 1000;
    if (geoIsFresh && destination.latitude != null && destination.longitude != null) return undefined;
    let active = true;
    const place = new placesLibrary.Place({ id: placeId });
    place.fetchFields({ fields: ['location'] })
      .then(() => {
        if (!active) return;
        const location = place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
        setDestinationDetails({
          placeId,
          location,
        });
        if (location) {
          setMapCenter(location);
          resolveDestination(destination.name, placeId, location).catch(() => {});
        }
      })
      .catch(() => { if (active) setDestinationDetails({ placeId, location: null }); });
    return () => { active = false; };
  }, [placesLibrary, destination?.google_place_id, destination?.name, destination?.geo_cached_at, destination?.latitude, destination?.longitude, destinationDetails?.placeId]);

  const savedPlaces = useMemo(() => (guide?.places || []).map((place) => ({
    ...place,
    id: place.google_place_id || place.id,
    category: normalizedCategory(place.category),
    formattedAddress: place.formatted_address || place.address || '',
  })), [guide?.places]);
  const crawlerEntities = guide?.crawler?.entities || EMPTY_ENTITIES;

  const categoryPlaces = useMemo(() => Object.fromEntries(categories.map(({ key }) => {
    const localPlaces = savedPlaces.filter((place) => place.category === key)
      .map((place) => attachGuideContent(place, crawlerEntities));
    const liveGooglePlaces = googleResults[key] || EMPTY_ENTITIES;
    const googleById = new Map(liveGooglePlaces.map((place) => [String(place.id), place]));
    // Prefer live Places name/address/coordinates for matching IDs while
    // retaining crawler descriptions and other app-authored guide content.
    const enrichedLocalPlaces = localPlaces.map((place) => {
      const googlePlace = googleById.get(String(place.id));
      if (!googlePlace) return place;
      googleById.delete(String(place.id));
      return {
        ...place,
        name: googlePlace.name || place.name,
        formattedAddress: googlePlace.formattedAddress || place.formattedAddress,
        latitude: googlePlace.latitude ?? place.latitude,
        longitude: googlePlace.longitude ?? place.longitude,
        source: 'Google Maps',
      };
    });
    const combined = [...enrichedLocalPlaces, ...googleById.values()].slice(0, 20);
    return [key, combined.map((place, index) => ({ ...place, markerNumber: index + 1, category: key }))];
  })), [savedPlaces, crawlerEntities, googleResults]);
  const destinationLatitude = destination?.latitude;
  const destinationLongitude = destination?.longitude;
  const hasSavedCenter = destinationLatitude != null && destinationLongitude != null
    && Number.isFinite(Number(destinationLatitude)) && Number.isFinite(Number(destinationLongitude));
  const savedCenter = useMemo(() => hasSavedCenter
    ? { lat: Number(destinationLatitude), lng: Number(destinationLongitude) }
    : null, [hasSavedCenter, destinationLatitude, destinationLongitude]);
  const destinationLocation = destinationDetails?.location || savedCenter;
  const searchingCategories = useMemo(() => new Set(categories.filter(({ key }) => requestedCategories[key] && placesLibrary && destination?.google_place_id
    && destinationLocation && googleResults[key] === undefined
    && savedPlaces.filter((place) => place.category === key).length < 20).map(({ key }) => key)),
  [requestedCategories, placesLibrary, destination?.google_place_id, destinationLocation, googleResults, savedPlaces]);
  const mapPlaces = useMemo(() => {
    const allResults = Object.values(googleResults).flat();
    const unique = new Map();
    [...savedPlaces, ...allResults].forEach((place) => {
      if (place.latitude != null && place.longitude != null && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)) && !unique.has(place.id)) unique.set(place.id, place);
    });
    return categories.flatMap((item) => [...unique.values()].filter((place) => place.category === item.key)
      .map((place, index) => ({ ...place, markerNumber: index + 1 })));
  }, [savedPlaces, googleResults]);
  const selectedPlace = mapPlaces.find((place) => place.id === selectedId);
  const wishlistIds = useMemo(() => new Set(wishlist.map((place) => String(place.id))), [wishlist]);
  const activeWishlistIds = useMemo(() => new Set(activeList.items
    .filter((place) => place.provider === 'google')
    .map((place) => String(place.id))), [activeList, slug]);
  const getVisibleCategoryPlaces = key => showWishlistOnly
    ? categoryPlaces[key].filter((place) => wishlistIds.has(String(place.id)))
    : categoryPlaces[key];

  const openWishlistPicker = useCallback((place, anchorElement) => {
    setSaveRequest({ place, anchorElement });
  }, []);

  const handleQuickSave = useCallback((place, anchorElement) => {
    if (requireAccount()) return;
    const destinationInfo = { slug, name: destination?.name || '' };
    const wasSavedToActiveList = hasPlaceInList(activeList.id, place, slug);
    setPlaceSaved(activeList.id, place, destinationInfo, !wasSavedToActiveList);

    toast.custom((toastItem) => <div role="status" className="flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-lg border border-[#dce5de] bg-white px-2.5 py-1.5 text-[11px] text-[#263a30] shadow-md">
      <span className="min-w-0 flex-1 truncate font-semibold leading-4">{wasSavedToActiveList ? `${place.name} removed from ${activeList.name}` : `${place.name} saved to ${activeList.name}`}</span>
      <button type="button" onClick={() => { setPlaceSaved(activeList.id, place, destinationInfo, wasSavedToActiveList); toast.dismiss(toastItem.id); }} className="min-h-6 shrink-0 rounded-full px-1.5 text-[11px] font-bold text-pine transition hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">Undo</button>
      <button type="button" onClick={() => { openWishlistPicker(place, anchorElement); toast.dismiss(toastItem.id); }} className="min-h-6 shrink-0 rounded-full bg-pine px-1.5 text-[11px] font-bold text-white transition hover:bg-pine/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">Choose wishlist</button>
    </div>, { id: 'wishlist-save-feedback', duration: 3000 });
  }, [activeList.id, activeList.name, destination?.name, hasPlaceInList, openWishlistPicker, requireAccount, setPlaceSaved, slug]);

  useEffect(() => {
    if (!placesLibrary || !destination?.google_place_id || !destinationLocation) return undefined;
    const center = { lat: destinationLocation.lat, lng: destinationLocation.lng };
    categories.forEach(({ key }) => {
      if (!requestedCategories[key] || googleResults[key] !== undefined) return;
      const requestKey = `${slug}:${key}`;
      if (googleSearchRequests.current.has(requestKey)) return;
      const localCount = savedPlaces.filter((place) => place.category === key).length;
      if (localCount >= 20) {
        setGoogleResults((current) => ({ ...current, [key]: [] }));
        return;
      }

      googleSearchRequests.current.add(requestKey);
      setCategorySearchErrors((current) => ({ ...current, [key]: '' }));
      searchGoogleGuidePlaces(
        placesLibrary,
        key,
        destination.name,
        center,
        Math.max(1, 20 - localCount),
      ).then((mapped) => {
        const unseenIds = mapped.map((place) => place.id).filter((id) => !syncedGooglePlaceIds.current.has(id));
        unseenIds.forEach((id) => syncedGooglePlaceIds.current.add(id));
        if (user && unseenIds.length) storeGooglePlaceIds(unseenIds).catch(() => {});
        if (currentSlug.current === slug) {
          setGoogleResults((current) => ({
            ...current,
            [key]: mapped.map((place) => attachGuideContent(place, crawlerEntities)),
          }));
        }
      }).catch((searchError) => {
        console.error(`[Places] ${key} text search failed`, searchError);
        if (currentSlug.current === slug) {
          setGoogleResults((current) => ({ ...current, [key]: [] }));
          setCategorySearchErrors((current) => ({
            ...current,
            [key]: 'Could not load these results. Check the Maps API configuration and try again.',
          }));
        }
      }).finally(() => googleSearchRequests.current.delete(requestKey));
    });
    return undefined;
  }, [requestedCategories, placesLibrary, destination?.google_place_id, destination?.name, destinationLocation, googleResults, savedPlaces, crawlerEntities, slug, user?.id]);

  const selectPlace = useCallback((place) => {
    setSelectedId(place.id);
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapCenter({ lat, lng });
      setMapZoom(15);
    }
    if (window.innerWidth < 768) setMobileView('map');
  }, []);

  const zoomToSelectedPlace = useCallback(() => {
    if (!selectedPlace) return;
    const lat = Number(selectedPlace.latitude);
    const lng = Number(selectedPlace.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setMapCenter({ lat, lng });
    setMapZoom(17);
  }, [selectedPlace]);

  if (loading) return <div className="grid h-full place-items-center text-sm text-[#68766e]">Loading destination guide…</div>;
  if (error || !destination) return <div className="mx-auto grid h-full max-w-xl content-center justify-items-center gap-4 px-6 text-center">
    <p className="text-[#9b3e32]">{error || 'Destination not found.'}</p>
    <Link to="/explore" className="rounded-full bg-btn-primary-bg px-5 py-2.5 text-sm font-bold text-btn-primary-text">Back to Explore</Link>
  </div>;

  const crawlerStatus = guide?.crawler?.status;
  const guideFacts = guide?.crawler?.facts || [];
  const sourceCounts = guide?.crawler?.sourceStatus?.source_status_counts || {};
  const sourcesInProgress = Number(sourceCounts.PENDING || 0) + Number(sourceCounts.FETCHED || 0);

  return (
    <>
    <MapWorkspaceLayout
      hero={<section className="relative flex min-h-[300px] flex-col overflow-hidden rounded-t-2xl rounded-b-none bg-[#34483f] text-white shadow-lg sm:min-h-[320px]">
        {destination?.google_place_id && <CommonsPlaceImage placeId={destination.google_place_id} category="destination" destination={destination.name} name={destination.name} alt="" className="h-full w-full opacity-40" transparentFallback background />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071611]/70 via-[#071611]/40 to-[#071611]/75" />
        <header className="relative z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-7 sm:py-4">
          <Link to="/explore" aria-label="Back to Explore" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white backdrop-blur-md transition hover:bg-black/40">
            <ArrowLeft size={15} />
          </Link>
          <ProjectName className="text-center text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_2px_10px_rgba(0,0,0,0.9)]" />
          <div className="ml-auto flex items-center gap-2">
            <WishlistButton appearance="overlay" onShowInGuide={() => setShowWishlistOnly(true)} />
            <button type="button" onClick={() => setPlacesPanelExpanded(false)} aria-label="Collapse places panel" title="Collapse places panel"
              className="hidden h-8 items-center justify-center gap-1.5 rounded-full border border-white/35 bg-black/20 px-2.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/40 min-[729px]:inline-flex">
              <PanelLeftClose size={15} />
            </button>
          </div>
        </header>
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 shrink-0 flex-col items-center justify-center px-5 pb-7 pt-2 text-center sm:px-10 sm:pb-8">
          <h1 className="text-3xl uppercase font-extrabold leading-tight tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_2px_12px_rgba(0,0,0,0.95)] sm:text-4xl">{location.state?.googleDisplayName || destination.name}</h1>
          {[destination.state, destination.country].filter(Boolean).length > 0 && <p className="mt-3 text-sm font-medium text-[#fffdf7] [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:text-base">{[destination.state, destination.country].filter(Boolean).join(' · ')}</p>}
          {destination.description && <p className="mt-4 max-w-4xl rounded-xl px-4 py-3 text-justify text-sm leading-6 text-white [text-shadow:0_1px_3px_rgba(0,0,0,1),0_1px_8px_rgba(0,0,0,0.95)] sm:px-5 sm:py-4 sm:text-base sm:leading-7">{destination.description}</p>}
          <form onSubmit={handlePlanTrip} className="mx-auto mt-3 flex w-fit max-w-full items-center gap-1 rounded-full border border-white/25 bg-[#17261f]/65 p-1 text-left shadow-md backdrop-blur-md sm:mt-4 sm:gap-1.5">
            <div className="min-w-0">
              <DateRangePicker compact startDate={startDate} endDate={endDate} onStartChange={value => { setStartDate(value); setPlanError(''); }} onEndChange={value => { setEndDate(value); setPlanError(''); }} />
            </div>
            <button type="submit" disabled={creatingTrip || authLoading || sessionLoading}
              className="group inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-[#fff1c9] to-[#ffe4a3] px-3.5 text-xs font-extrabold text-[#34483f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-10 sm:px-4">
              {creatingTrip ? <><LoaderCircle size={15} className="animate-spin" />Starting…</> : <>Plan trip<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>
          {planError && <p role="alert" className="mt-1 text-[11px] font-semibold text-rose-100">{planError}</p>}
          <Link to="/ai" className="group mt-1.5 inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Sparkles size={13} className="text-amber-200" />Rather plan with AI?<span className="underline underline-offset-2">Try the AI planner</span><ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>}

      sidebar={placesPanelExpanded && <div className="relative w-full min-w-0">
        <section className="flex min-w-0 flex-col overflow-visible rounded-t-none rounded-b-lg border border-[#e2e8e3] bg-[#f7f9f7]" aria-label="Destination guide">
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#e5ebe6] bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#e2e9e3] bg-gradient-to-r from-[#f0f7f1] via-white to-[#fff8eb] px-3 py-2.5 sm:px-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e2efe4] text-pine shadow-sm"><Sparkles size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold tracking-tight text-pine sm:text-[15px]">Find your {destinationDetails?.name || destination.name} favorites</p>
                <p className="truncate text-[11px] font-medium text-[#758279] sm:text-xs">Places to see, food to try, stays to save</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#66766b] ring-1 ring-[#e3ebe4] sm:text-[11px]">
                {Object.values(categoryPlaces).reduce((total, places) => total + places.length, 0)} nearby
              </span>
            </div>
            <nav className="app-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Guide categories">
              {categories.map(({ key, title, Icon, color }) => {
                const count = getVisibleCategoryPlaces(key).length;
                return <button key={key} type="button" onClick={() => {
                  setActiveCategory(key);
                  setRequestedCategories((current) => current[key] ? current : { ...current, [key]: true });
                  setShowWishlistOnly(false);
                }} aria-pressed={activeCategory === key}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${activeCategory === key ? 'border-green-medium bg-badge-bg text-pine' : 'border-[#e0e7e1] bg-white text-[#59675e] hover:bg-[#f7faf7]'}`}>
                  <Icon size={15} style={{ color }} />{title}<span className="text-[10px] opacity-65">{count || ''}</span>
                </button>;
              })}
            </nav>
          </div>
          <div className="px-4 pb-6 pt-4 sm:px-6">
            {categories.filter(({ key }) => key === activeCategory).map((categoryItem) => {
              const sectionPlaces = getVisibleCategoryPlaces(categoryItem.key);
              const isSearching = searchingCategories.has(categoryItem.key);
              const unmatchedEntities = crawlerEntities.filter((entity) => normalizedCategory(entity.entity_type) === categoryItem.key
                && !categoryPlaces[categoryItem.key].some((place) =>
                  (entity.google_place_id || entity.place_id || entity.placeId)
                  && (place.google_place_id || place.id) === (entity.google_place_id || entity.place_id || entity.placeId))).slice(0, 6);
              return <section key={categoryItem.key} id={`guide-section-${categoryItem.key}`} className="scroll-mt-20 border-b border-[#e3e9e4] py-5 last:border-b-0" aria-labelledby={`guide-heading-${categoryItem.key}`}>
                <header className="mb-3 flex items-center gap-2">
                  <categoryItem.Icon size={18} style={{ color: categoryItem.color }} />
                  <h2 id={`guide-heading-${categoryItem.key}`} className="text-base font-extrabold text-pine">{categoryItem.sectionTitle}</h2>
                  <span className="text-xs font-semibold text-[#7b877f]">{sectionPlaces.length}</span>
                </header>
                {isSearching && <div className="mb-3 flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-[#68766e]"><LoaderCircle size={16} className="animate-spin text-pine" />Finding popular {categoryItem.title.toLowerCase()}…</div>}
                {categorySearchErrors[categoryItem.key] && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-[#68531e]">
                  <span>{categorySearchErrors[categoryItem.key]}</span>
                  <button type="button" onClick={() => {
                    setCategorySearchErrors((current) => ({ ...current, [categoryItem.key]: '' }));
                    setGoogleResults((current) => {
                      const next = { ...current };
                      delete next[categoryItem.key];
                      return next;
                    });
                    setActiveCategory(categoryItem.key);
                  }} className="shrink-0 rounded-full bg-white px-3 py-1.5 font-bold text-pine shadow-sm ring-1 ring-amber-200 hover:bg-amber-100">Try again</button>
                </div>}
                {sectionPlaces.length > 0 && <ol className="space-y-3">
              {sectionPlaces.map((place) => {
                const placeCategory = categoryItem;
                return <li key={place.id}>
                  <article className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${selectedId === place.id ? 'border-green-medium ring-1 ring-green-medium/20' : 'border-[#e0e7e1]'}`}>
                  <button type="button" onClick={() => { setActiveCategory(categoryItem.key); selectPlace(place); }} onFocus={() => { setActiveCategory(categoryItem.key); setSelectedId(place.id); }} aria-pressed={selectedId === place.id}
                    className="group flex w-full gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium">
                    <span className="flex h-11 w-8 shrink-0 items-center justify-center" aria-label={`Map marker ${place.markerNumber}`}>
                      <NumberedPin number={place.markerNumber} category={placeCategory} small />
                    </span>
                    <CommonsPlaceImage placeId={place.google_place_id || (place.source === 'Google Maps' ? place.id : '')} category={placeCategory.key} destination={destination?.name || ''} name={place.name} alt={place.name} className="h-24 w-28 shrink-0 sm:w-32" fallback={<placeCategory.Icon size={25} />} />
                    <span className="min-w-0 flex-1 py-1">
                      <span className="block line-clamp-2 font-extrabold leading-5 text-pine">{place.name}</span>
                      {place.formattedAddress && <span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#748078]">{place.formattedAddress}</span>}
                      {place.source === 'Google Maps' && <span translate="no" className="mt-1 inline-flex rounded-full border border-[#e3e9e4] bg-[#f8faf8] px-2 py-0.5 text-xs font-normal text-[#5e5e5e]">Google Maps</span>}
                      {place.summary && <span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#59675e]">{place.summary}</span>}
                      {place.tips?.length > 0 && <span className="mt-1 block line-clamp-1 text-[11px] text-[#738078]">Tip: {place.tips[0]}</span>}
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-pine">View on map <MapPin size={12} /></span>
                    </span>
                  </button>
                  <div className="flex justify-end border-t border-[#edf1ed] px-3 py-2">
                    <button type="button" disabled={authLoading} onClick={(event) => handleQuickSave(place, event.currentTarget)} aria-pressed={activeWishlistIds.has(String(place.id))} aria-label={activeWishlistIds.has(String(place.id)) ? `Remove ${place.name} from ${activeList.name}` : `Save ${place.name} to ${activeList.name}`} title={activeWishlistIds.has(String(place.id)) ? 'Remove from wishlist' : `Save to ${activeList.name}`}
                      className={`grid h-9 w-9 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine ${activeWishlistIds.has(String(place.id)) ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'text-[#59675e] hover:bg-[#f7faf7]'}`}>
                      <Heart size={17} className={activeWishlistIds.has(String(place.id)) ? 'fill-rose-500 text-rose-500' : ''} />
                    </button>
                  </div>
                  </article>
                </li>
              })}
            </ol>}
                {!sectionPlaces.length && !isSearching && !showWishlistOnly && googleResults[categoryItem.key] !== undefined && <div className="rounded-xl border border-dashed border-[#cfd9d1] bg-white p-5 text-center">
                  <p className="text-sm font-semibold text-[#68766e]">No {categoryItem.title.toLowerCase()} found yet.</p>
                  <p className="mt-1 text-xs leading-5 text-[#718077]">Saved guide entries and nearby map results will appear here when available.</p>
                </div>}
                {unmatchedEntities.length > 0 && <div className="mt-4 rounded-xl border border-[#e0e7e1] bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-pine"><Compass size={16} className="text-[#7955bf]" />More guide suggestions</div>
                  <p className="mt-1 text-xs leading-5 text-[#718077]">These suggestions still need a map-place match, so they are not numbered map markers.</p>
                  <ul className="mt-3 space-y-2">
                    {unmatchedEntities.map((entity, index) => <li key={entity.id || `${entity.name}-${index}`} className="rounded-lg bg-[#f7faf7] p-3">
                      <p className="text-sm font-bold text-pine">{entity.name}</p>
                      {(entity.why_go || entity.summary) && <p className="mt-1 text-xs leading-5 text-[#68766e]">{entity.why_go || entity.summary}</p>}
                      {entity.source_url && <a href={entity.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-semibold text-pine underline">Read source</a>}
                    </li>)}
                  </ul>
                </div>}
              </section>;
            })}
            {showWishlistOnly && !categoryPlaces[activeCategory]?.some((place) => wishlistIds.has(String(place.id))) && <div className="rounded-xl border border-dashed border-[#cfd9d1] bg-white p-6 text-center">
              <Heart className="mx-auto text-[#8a9a8e]" size={26} />
              <h3 className="mt-3 font-bold text-pine">Your wishlist is empty</h3>
              <p className="mt-1 text-sm leading-6 text-[#718077]">Use the heart buttons to save places, restaurants, and hotels for your trip.</p>
            </div>}
            {guideFacts.length > 0 && <section className="mt-6 rounded-xl border border-[#e0e7e1] bg-white p-4" aria-label="Travel guide research">
              <div className="flex items-center gap-2 text-sm font-bold text-pine"><BookOpen size={16} className="text-pine" />Travel guide notes</div>
              <div className="mt-3 space-y-3">
                {guideFacts.slice(0, 3).map((fact, index) => <article key={fact.id || `${fact.title}-${index}`} className="border-t border-[#edf1ed] pt-3 first:border-0 first:pt-0">
                  {fact.title && <h3 className="text-sm font-bold text-pine">{fact.title}</h3>}
                  {fact.summary && <p className="mt-1 text-sm leading-5 text-[#68766e]">{fact.summary}</p>}
                  {fact.source_url && <a className="mt-2 inline-block text-xs font-semibold text-pine underline" href={fact.source_url} target="_blank" rel="noreferrer">Source: {fact.source_name || 'Travel guide'}</a>}
                </article>)}
              </div>
            </section>}
          </div>
          {!(crawlerStatus === 'unavailable' && !guideFacts.length && !crawlerEntities.length) && <div role="status" className="shrink-0 border-t border-[#e3e9e4] bg-white px-5 py-3 text-xs text-[#738078] sm:px-7">
            {crawlerStatus === 'queued' || crawlerStatus === 'pending' ? <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin text-pine" />Finding sources and extracting travel-guide details in the background{sourcesInProgress > 0 ? ` · ${sourcesInProgress} source${sourcesInProgress === 1 ? '' : 's'} processing` : ''}.</span> : guideFacts.length || crawlerEntities.length ? `${guideFacts.length + crawlerEntities.length} guide details are available from crawler sources.` : 'Guide details are collected from saved places and current map results.'}
          </div>}
        </section>
      </div>}
      collapsedSidebar={<WorkspaceRailControls backTo="/explore" backLabel="Back to Explore" expandLabel="Expand List" onExpand={() => setPlacesPanelExpanded(true)} />}

      map={<div className="relative h-full min-h-0 min-w-0" aria-label="Map of places">
          <InteractiveMap id="destination-guide-map" mapCenter={mapCenter} setMapCenter={setMapCenter} mapZoom={mapZoom} setMapZoom={setMapZoom} overlayOpen={Boolean(selectedPlace)} gestureHandling="cooperative">
            <FitPlaces places={mapPlaces} center={destinationLocation} />
            {mapPlaces.map((place) => {
              const placeCategory = categories.find((item) => item.key === place.category) || categories[0];
              return <NumberedPlaceMarker key={place.id}
                position={{ lat: Number(place.latitude), lng: Number(place.longitude) }}
                title={place.name}
                number={place.markerNumber}
                category={placeCategory}
                selected={selectedId === place.id}
                onClick={() => { setActiveCategory(place.category); selectPlace(place); }}
              />;
            })}
          </InteractiveMap>
          {selectedPlace && <PlaceDetailsPanel
            key={selectedPlace.id}
            place={selectedPlace}
            category={categories.find((item) => item.key === selectedPlace.category) || categories[0]}
            onClose={() => setSelectedId(null)}
            onZoomToPlace={zoomToSelectedPlace}
          />}
        </div>}
      mobileView={mobileView}
      onToggleView={() => setMobileView((view) => view === 'list' ? 'map' : 'list')}
      sidebarExpanded={placesPanelExpanded}
      onExpandSidebar={() => setPlacesPanelExpanded(true)}
      collapsedHeaderOnly
      hideMobileHeader
    />
    {saveRequest && <WishlistCollectionPicker place={saveRequest.place} anchorElement={saveRequest.anchorElement} destination={{ slug, name: destination.name }} onClose={() => setSaveRequest(null)} />}
    </>
  );
}
