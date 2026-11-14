import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Compass, MapPin, PanelLeftClose, Utensils, Landmark, LoaderCircle, Sparkles } from 'lucide-react';
import { getDestinationGuide, resolveDestination } from '../api/placesApi';
import { googleGuideSearchErrorMessage, isGoogleGuideSearchQuotaBlocked, searchGoogleGuidePlaces, storeGooglePlaceIds } from '../api/googlePlaces';
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
import './DestinationGuide.css';
import GoogleMapsAttribution from '../../../shared/components/google-maps-attribution/GoogleMapsAttribution';
import GoogleGMark from '../../../shared/components/google-g-mark/GoogleGMark';
import PlaceRating from '../../../shared/components/place-rating/PlaceRating';

const categories = [
  { key: 'attraction', title: 'Places to visit', sectionTitle: 'Top places to visit', singular: 'place to visit', Icon: Landmark, color: 'var(--color-green-medium)', border: 'var(--color-green-medium)', types: ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark', 'park', 'zoo', 'aquarium', 'amusement_park', 'place_of_worship'] },
  { key: 'restaurant', title: 'Restaurants', sectionTitle: 'Top places to eat', singular: 'restaurant', Icon: Utensils, color: '#e46432', border: '#b84620', types: ['restaurant'] },
];
const EMPTY_ENTITIES = [];

function GooglePlacePhoto({ place, Icon }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [photo, setPhoto] = useState(null);
  const placesLibrary = useMapsLibrary('places');
  useEffect(() => {
    const element = hostRef.current;
    if (!placesLibrary?.Place || !place.google_place_id || !element) return undefined;
    let active = true;
    const load = async () => {
      try {
        const candidate = new placesLibrary.Place({ id: place.google_place_id });
        await candidate.fetchFields({ fields: ['photos'] });
        const result = candidate.photos?.[0];
        const uri = result?.getURI?.({ maxWidth: 640, maxHeight: 480 });
        if (active && uri) setPhoto({ uri, authors: result.authorAttributions || [], mapsUri: result.googleMapsURI || '' });
        else if (active) setFailed(true);
      } catch {
        if (active) setFailed(true);
      }
    };
    if (!('IntersectionObserver' in window)) load();
    else {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: '160px' });
      observer.observe(element);
      return () => { active = false; observer.disconnect(); };
    }
    return () => { active = false; };
  }, [placesLibrary, place.google_place_id]);
  const authors = photo?.authors || [];
  return <span className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-[#edf3ee] text-[#9aa79d] sm:w-32">
    <span ref={hostRef} className="absolute inset-0" aria-hidden="true" />
    {photo?.uri && !failed
      ? <img src={photo.uri} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      : <span className="grid h-full w-full place-items-center"><Icon size={25} /></span>}
    {photo && <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-[9px] text-white">
      {authors.map((author, index) => <span key={`${author.displayName}-${index}`}>
        {index > 0 && ', '}{author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName || 'Photo credit'}</a> : author.displayName || 'Photo credit'}
      </span>)}
      {photo.mapsUri && <a aria-label="View photo in Google Maps" className="ml-1 inline-block align-middle" href={photo.mapsUri} target="_blank" rel="noreferrer"><GoogleMapsAttribution /></a>}
    </span>}
  </span>;
}

const normalizedCategory = (category = '') => {
  const value = category.toLowerCase();
  if (['restaurant', 'cafe', 'bar', 'eat', 'drink'].includes(value)) return 'restaurant';
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
    mentionSource: entity.source_url || '',
    mentionSourceName: entity.source_name || '',
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
  const { slug, category: routeCategory } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: sessionLoading } = useAuth();
  const placesLibrary = useMapsLibrary('places');
  const [guideState, setGuideState] = useState({ slug: null, guide: null, error: '' });
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [activeCategory, setActiveCategory] = useState('attraction');
  const [requestedCategories, setRequestedCategories] = useState({ attraction: false, restaurant: false });
  const [expandedCategories, setExpandedCategories] = useState({ attraction: false, restaurant: false });
  const [loadingMoreCategories, setLoadingMoreCategories] = useState({});
  const [loadedMoreCategories, setLoadedMoreCategories] = useState({});
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
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
  const handledSavedPlace = useRef('');
  useEffect(() => { currentSlug.current = slug; }, [slug]);
  const crawlPollCount = useRef(0);
  const [crawlPollTick, setCrawlPollTick] = useState(0);
  const guide = guideState.slug === slug ? guideState.guide : null;
  const loading = guideState.slug !== slug;
  const error = guideState.slug === slug ? guideState.error : '';
  const destination = guide?.destination;
  const visibleCategories = routeCategory ? categories.filter((item) => item.key === routeCategory) : categories;

  const effectiveActiveCategory = categories.some((item) => item.key === routeCategory) ? routeCategory : activeCategory;

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
        setRequestedCategories({ attraction: true, restaurant: true });
        setExpandedCategories({ attraction: false, restaurant: false });
        setLoadingMoreCategories({});
        setLoadedMoreCategories({});
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
        type: googlePlace.type || place.type,
        primaryTypeDisplayName: googlePlace.primaryTypeDisplayName || place.primaryTypeDisplayName,
        rating: googlePlace.rating ?? place.rating,
        userRatingCount: googlePlace.userRatingCount ?? place.userRatingCount,
        latitude: googlePlace.latitude ?? place.latitude,
        longitude: googlePlace.longitude ?? place.longitude,
        source: 'Google Maps',
      };
    });
    const combined = [...enrichedLocalPlaces, ...googleById.values()].slice(0, 50);
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
    .map((place) => String(place.id))), [activeList]);
  const getVisibleCategoryPlaces = key => showWishlistOnly
    ? categoryPlaces[key].filter((place) => wishlistIds.has(String(place.id)))
    : categoryPlaces[key];

  const requestGoogleCategory = (key) => {
    if (isGoogleGuideSearchQuotaBlocked()) {
      setGoogleResults((current) => ({ ...current, [key]: [] }));
      setCategorySearchErrors((current) => ({ ...current, [key]: googleGuideSearchErrorMessage({ code: 'GUIDE_SEARCH_QUOTA_BLOCKED' }) }));
      return;
    }
    setCategorySearchErrors((current) => ({ ...current, [key]: '' }));
    setGoogleResults((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setRequestedCategories((current) => ({ ...current, [key]: true }));
  };

  const toggleCategoryExpanded = async (key) => {
    const willExpand = !expandedCategories[key];
    setExpandedCategories((current) => ({ ...current, [key]: willExpand }));
    if (!willExpand || loadedMoreCategories[key] || loadingMoreCategories[key]
      || !requestedCategories[key] || !placesLibrary || !destination?.google_place_id || !destinationLocation) return;

    if (isGoogleGuideSearchQuotaBlocked()) {
      setCategorySearchErrors((current) => ({ ...current, [key]: googleGuideSearchErrorMessage({ code: 'GUIDE_SEARCH_QUOTA_BLOCKED' }) }));
      return;
    }

    const existing = googleResults[key] || [];
    if (categoryPlaces[key].length >= 50) {
      setLoadedMoreCategories((current) => ({ ...current, [key]: true }));
      return;
    }

    setLoadingMoreCategories((current) => ({ ...current, [key]: true }));
    try {
      const variants = [await searchGoogleGuidePlaces(
        placesLibrary, key, destination.name,
        { lat: destinationLocation.lat, lng: destinationLocation.lng }, 20, 1,
      )];
      const merged = new Map(existing.map((place) => [String(place.id), place]));
      variants.flat().forEach((place) => {
        if (!merged.has(String(place.id))) merged.set(String(place.id), place);
      });
      const localIds = new Set(savedPlaces.filter((place) => place.category === key).map((place) => String(place.id)));
      const ranked = [...merged.values()].sort((a, b) => (b.rating || 0) - (a.rating || 0)
        || (b.userRatingCount || 0) - (a.userRatingCount || 0));
      const results = ranked.filter((place) => !localIds.has(String(place.id))).slice(0, Math.max(0, 50 - localIds.size));
      const knownIds = new Set([...localIds, ...existing.map((place) => String(place.id))]);
      const unseenIds = results.map((place) => place.id).filter((id) => !knownIds.has(String(id)) && !syncedGooglePlaceIds.current.has(id));
      unseenIds.forEach((id) => syncedGooglePlaceIds.current.add(id));
      if (user?.id && unseenIds.length) storeGooglePlaceIds(unseenIds).catch(() => {});
      setGoogleResults((current) => ({ ...current, [key]: results.map((place) => attachGuideContent(place, crawlerEntities)) }));
      setLoadedMoreCategories((current) => ({ ...current, [key]: true }));
    } catch (searchError) {
      if (!isGoogleGuideSearchQuotaBlocked()) console.error(`[Places] Could not load more ${key} results`, searchError);
      setCategorySearchErrors((current) => ({ ...current, [key]: googleGuideSearchErrorMessage(searchError) }));
    } finally {
      setLoadingMoreCategories((current) => ({ ...current, [key]: false }));
    }
  };

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
      <button type="button" onClick={() => { openWishlistPicker(place, anchorElement); toast.dismiss(toastItem.id); }} className="min-h-6 shrink-0 rounded-full bg-btn-primary-bg px-1.5 text-[11px] font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">Choose wishlist</button>
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
        if (user?.id && unseenIds.length) storeGooglePlaceIds(unseenIds).catch(() => {});
        if (currentSlug.current === slug) {
          setGoogleResults((current) => ({
            ...current,
            [key]: mapped.map((place) => attachGuideContent(place, crawlerEntities)),
          }));
        }
      }).catch((searchError) => {
        if (!isGoogleGuideSearchQuotaBlocked()) console.error(`[Places] ${key} text search failed`, searchError);
        if (currentSlug.current === slug) {
          setGoogleResults((current) => ({ ...current, [key]: [] }));
          setCategorySearchErrors((current) => ({
            ...current,
            [key]: googleGuideSearchErrorMessage(searchError),
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

  useEffect(() => {
    const requestedId = location.state?.selectedPlaceId;
    if (!requestedId || !placesLibrary?.Place || handledSavedPlace.current === `${slug}:${requestedId}`) return;
    const matched = mapPlaces.find((place) => String(place.id) === String(requestedId));
    if (matched) {
      handledSavedPlace.current = `${slug}:${requestedId}`;
      selectPlace(matched);
      return;
    }
    const settled = categories.every(({ key }) => !requestedCategories[key] || googleResults[key] !== undefined
      || savedPlaces.filter((place) => place.category === key).length >= 20);
    if (!settled) return;
    handledSavedPlace.current = `${slug}:${requestedId}`;
    let active = true;
    const loadSavedPlace = async () => {
      try {
        const result = new placesLibrary.Place({ id: requestedId });
        await result.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'editorialSummary', 'primaryTypeDisplayName'] });
        const locationValue = result.location;
        if (!active || !locationValue) return;
        const category = normalizedCategory(location.state?.selectedPlaceCategory || 'attraction');
        const savedPlace = {
          id: requestedId,
          google_place_id: requestedId,
          name: (typeof result.displayName === 'string' ? result.displayName : result.displayName?.text) || 'Saved place',
          category,
          latitude: locationValue.lat(),
          longitude: locationValue.lng(),
          formattedAddress: result.formattedAddress || '',
          description: typeof result.editorialSummary === 'string' ? result.editorialSummary : result.editorialSummary?.text || '',
          type: typeof result.primaryTypeDisplayName === 'string' ? result.primaryTypeDisplayName : result.primaryTypeDisplayName?.text || '',
          rating: result.rating ?? null,
          userRatingCount: result.userRatingCount ?? 0,
          source: 'Google Maps',
        };
        setGoogleResults((current) => ({
          ...current,
          [category]: [...(current[category] || []).filter((place) => place.id !== requestedId), savedPlace],
        }));
        selectPlace(savedPlace);
      } catch {
        // Keep the destination guide open if Google no longer resolves this saved ID.
      }
    };
    loadSavedPlace();
    return () => { active = false; };
  }, [location.state?.selectedPlaceId, location.state?.selectedPlaceCategory, placesLibrary, slug, mapPlaces, googleResults, requestedCategories, savedPlaces, selectPlace]);

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
  const googleGuideQuotaBlocked = isGoogleGuideSearchQuotaBlocked();

  return (
    <>
    <MapWorkspaceLayout
      flush
      stickyHeader={<header className="sticky top-0 z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[#e3ede6] bg-white px-3 shadow-sm sm:px-7">
        <Link to="/explore" aria-label="Back to Explore" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d9e7de] bg-[#f5faf7] text-pine transition hover:bg-[#e8f7f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium/70">
          <ArrowLeft size={15} />
        </Link>
        <div className="flex min-w-0 items-center justify-center gap-2">
          <ProjectName className="truncate text-center text-pine" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <WishlistButton onShowInGuide={() => setShowWishlistOnly(true)} />
          <button type="button" onClick={() => setPlacesPanelExpanded(false)} aria-label="Collapse places panel" title="Collapse places panel"
            className="hidden h-8 items-center justify-center gap-1.5 rounded-full border border-[#d9e7de] bg-[#f5faf7] px-2.5 text-xs font-semibold text-pine transition hover:bg-[#e8f7f0] min-[729px]:inline-flex">
            <PanelLeftClose size={15} />
          </button>
        </div>
      </header>}
      hero={<section className="relative flex min-h-[320px] flex-col overflow-hidden bg-[#faf1ed] text-pine shadow-md sm:min-h-[360px]">
        {destination?.google_place_id && <CommonsPlaceImage placeId={destination.google_place_id} category="destination" destination={destination.name} name={destination.name} latitude={destination.latitude} longitude={destination.longitude} alt="" className="h-full w-full" transparentFallback background />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#062b1d]/20 via-transparent to-[#062b1d]/25" />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 shrink-0 flex-col items-center justify-center px-3 py-5 text-center sm:px-8 sm:py-7">
          <div className="w-full max-w-5xl bg-transparent px-2 py-4 text-pine sm:px-8 sm:py-6">
          <div className="mx-auto w-fit max-w-full rounded-[1.75rem] border border-white/30 bg-white/30 px-5 py-5 text-[#004f32] shadow-[0_18px_50px_rgba(0,30,18,0.2),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:px-8 sm:py-6">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-[#004f32] sm:text-5xl">{location.state?.googleDisplayName || destination.name}</h1>
          {[destination.state, destination.country].filter(Boolean).length > 0 && <p className="mt-2 text-sm font-semibold tracking-wide text-[#365b49] sm:text-base">{[destination.state, destination.country].filter(Boolean).join(' · ')}</p>}
          {destination.description && <>
            <p className={`mx-auto mt-4 max-w-4xl px-1 text-justify text-sm leading-6 text-[#365b49] sm:px-3 sm:text-base sm:leading-7 ${descriptionExpanded ? '' : 'line-clamp-3'}`}>{destination.description}</p>
            {destination.description.length > 240 && <button type="button" onClick={() => setDescriptionExpanded((expanded) => !expanded)} className="mt-1 text-xs font-extrabold text-[#004f32] underline decoration-[#004f32]/35 underline-offset-4 transition hover:decoration-[#004f32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
              {descriptionExpanded ? 'Show less' : 'Read the destination story'}
            </button>}
          </>}
          </div>
          <form onSubmit={handlePlanTrip} className="mx-auto mt-4 flex w-fit max-w-full items-center gap-1.5 rounded-2xl border border-white/55 bg-white/85 p-1.5 text-left shadow-lg shadow-[#062b1d]/15 backdrop-blur-xl sm:gap-2">
            <div className="min-w-0">
              <DateRangePicker compact startDate={startDate} endDate={endDate} onStartChange={value => { setStartDate(value); setPlanError(''); }} onEndChange={value => { setEndDate(value); setPlanError(''); }} />
            </div>
            <button type="submit" disabled={creatingTrip || authLoading || sessionLoading}
              className="group inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-btn-primary-bg px-4 text-xs font-extrabold text-btn-primary-text shadow-sm transition hover:-translate-y-0.5 hover:bg-btn-primary-bg-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-100 sm:min-h-10 sm:px-5">
              {creatingTrip ? <><LoaderCircle size={15} className="animate-spin" />Starting…</> : <>Plan trip<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>
          {planError && <p role="alert" className="mt-2 text-[11px] font-semibold text-[#9b3e32]">{planError}</p>}
          <Link to="/ai" className="group mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-white/35 bg-white/25 px-4 text-xs font-bold text-[#004f32] shadow-[0_8px_24px_rgba(0,30,18,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
            <Sparkles size={13} className="text-[#9a6b00]" />Rather plan with AI?<span className="underline underline-offset-2">Try the AI planner</span><ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          </div>
        </div>
      </section>}

      sidebar={placesPanelExpanded && <div className="relative w-full min-w-0">
        <section className="flex min-w-0 flex-col overflow-visible border border-[#e2e8e3] bg-[#f5f8f5]" aria-label="Destination guide">
          <div className="shrink-0 border-b border-[#e5ebe6] bg-white/90 px-3 py-3 backdrop-blur sm:px-5">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#e2e9e3] bg-gradient-to-r from-[#e8f4ed] via-white to-[#f5f0df] px-3 py-3 sm:px-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d7eee1] text-pine shadow-sm"><Sparkles size={18} /></span>
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold tracking-tight text-pine sm:text-[15px]">Find your {destinationDetails?.name || destination.name} favorites</p>
              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#66766b] ring-1 ring-[#e3ebe4] sm:text-[11px]">
                {Object.values(categoryPlaces).reduce((total, places) => total + places.length, 0)} places
              </span>
            </div>
            {routeCategory && <Link to={`/locations/${encodeURIComponent(slug)}`} className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-pine hover:underline"><ArrowLeft size={14} />All destination highlights</Link>}
            <nav className={`app-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${routeCategory ? 'hidden' : ''}`} aria-label="Guide categories">
              {categories.map(({ key, title, Icon, color }) => {
                const count = getVisibleCategoryPlaces(key).length;
                return <button key={key} type="button" onClick={() => {
                  setActiveCategory(key);
                  setShowWishlistOnly(false);
                  const el = document.getElementById(`guide-section-${key}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }} aria-pressed={effectiveActiveCategory === key}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${effectiveActiveCategory === key ? 'border-green-medium bg-badge-bg text-pine' : 'border-[#e0e7e1] bg-white text-[#59675e] hover:bg-[#f7faf7]'}`}>
                  <Icon size={15} style={{ color }} />{title}<span className="text-[10px] opacity-65">{count || ''}</span>
                </button>;
              })}
            </nav>
          </div>
          <div className="px-2 pb-2 pt-2 sm:px-3">
            {visibleCategories.map((categoryItem) => {
               const sectionPlaces = getVisibleCategoryPlaces(categoryItem.key);
               const isExpanded = expandedCategories[categoryItem.key];
               const displayedPlaces = isExpanded ? sectionPlaces : sectionPlaces.slice(0, 5);
               const hasMore = sectionPlaces.length > 5;
               const isSearching = searchingCategories.has(categoryItem.key);
               const canSearchLivePlaces = !showWishlistOnly && !isSearching && !categorySearchErrors[categoryItem.key]
                 && googleResults[categoryItem.key] === undefined && sectionPlaces.length < 20
                 && placesLibrary && destination?.google_place_id && destinationLocation;
               const unmatchedEntities = crawlerEntities.filter((entity) => normalizedCategory(entity.entity_type) === categoryItem.key
                && !categoryPlaces[categoryItem.key].some((place) =>
                  (entity.google_place_id || entity.place_id || entity.placeId)
                  && (place.google_place_id || place.id) === (entity.google_place_id || entity.place_id || entity.placeId))).slice(0, 6);
              return <section key={categoryItem.key} id={`guide-section-${categoryItem.key}`} className="scroll-mt-20 border-b border-[#e3e9e4] py-2 last:border-b-0" aria-labelledby={`guide-heading-${categoryItem.key}`}>
                <header className="mb-1.5 flex items-center gap-3 rounded-xl border border-[#e4ebe5] bg-white px-3 py-2 sm:px-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1f6f2]" style={{ color: categoryItem.color }}><categoryItem.Icon size={18} /></span>
                  <h2 id={`guide-heading-${categoryItem.key}`} className="min-w-0 flex-1 text-base font-extrabold text-pine">{categoryItem.sectionTitle}</h2>
                  <span className="rounded-full bg-[#f3f6f3] px-2.5 py-1 text-xs font-bold text-[#68766e]">{sectionPlaces.length}</span>
                </header>
                {isSearching && <div className="mb-3 flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-[#68766e]"><LoaderCircle size={16} className="animate-spin text-pine" />Finding popular {categoryItem.title.toLowerCase()}…</div>}
                {categorySearchErrors[categoryItem.key] && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-[#68531e]">
                  <span>{categorySearchErrors[categoryItem.key]}</span>
                  {!googleGuideQuotaBlocked && <button type="button" onClick={() => { setActiveCategory(categoryItem.key); requestGoogleCategory(categoryItem.key); }} className="shrink-0 rounded-full bg-white px-3 py-1.5 font-bold text-pine shadow-sm ring-1 ring-amber-200 hover:bg-amber-100">Try again</button>}
                </div>}
                {sectionPlaces.length > 0 && <ol className="space-y-1.5">
              {displayedPlaces.map((place) => {
                const placeCategory = categoryItem;
                return <li key={place.id}>
                  <article data-selected={selectedId === place.id} className={`guide-place-card overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 ${selectedId === place.id ? 'border-green-medium' : 'border-[#e0e7e1]'}`}>
                  <div className="flex min-w-0 items-stretch gap-2 p-2.5 sm:gap-3 sm:p-3">
                    <button type="button" onClick={() => { setActiveCategory(categoryItem.key); selectPlace(place); }} onFocus={() => { setActiveCategory(categoryItem.key); setSelectedId(place.id); }} aria-pressed={selectedId === place.id}
                      className="guide-place-trigger group flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left focus-visible:outline-none sm:gap-3">
                      <span className="flex h-11 w-8 shrink-0 items-center justify-center" aria-label={`Map marker ${place.markerNumber}`}>
                        <NumberedPin number={place.markerNumber} category={placeCategory} small />
                      </span>
                      <span className="min-w-0 flex-1 py-1">
                        <span className="block line-clamp-2 text-base font-extrabold leading-5 text-pine">{place.name}</span>
                        {place.rating > 0 && <span className="mt-1 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-5 text-[#59675e]">
                          {place.source === 'Google Maps' && <GoogleGMark className="mr-0.5" title="Rating from Google Maps" />}
                          <PlaceRating rating={place.rating} />
                          <span className="font-bold text-[#35443b]">{Number(place.rating).toFixed(1)}</span>
                          {place.userRatingCount > 0 && <span>{Number(place.userRatingCount).toLocaleString()} reviews</span>}
                        </span>}
                        {(place.type || place.primaryTypeDisplayName) && <span className="mt-1 block text-[13px] font-semibold capitalize leading-5 text-[#66736b]">{place.type || (typeof place.primaryTypeDisplayName === 'string' ? place.primaryTypeDisplayName : place.primaryTypeDisplayName?.text)}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button type="button" disabled={authLoading} onClick={(event) => handleQuickSave(place, event.currentTarget)} aria-pressed={activeWishlistIds.has(String(place.id))} aria-label={activeWishlistIds.has(String(place.id)) ? `Remove ${place.name} from ${activeList.name}` : `Save ${place.name} to ${activeList.name}`} title={activeWishlistIds.has(String(place.id)) ? 'Remove from wishlist' : `Save to ${activeList.name}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-btn-primary-bg px-2.5 text-[11px] font-bold text-btn-primary-text shadow-sm transition hover:bg-btn-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2">
                        <Bookmark size={14} className={activeWishlistIds.has(String(place.id)) ? 'fill-current text-btn-primary-text' : ''} />{activeWishlistIds.has(String(place.id)) ? 'Saved' : 'Save'}
                      </button>
                      {placeCategory.key === 'restaurant' ? (
                        <GooglePlacePhoto key={place.id} place={place} Icon={placeCategory.Icon} />
                      ) : <CommonsPlaceImage placeId={place.google_place_id || (place.source === 'Google Maps' ? place.id : '')} category={placeCategory.key} destination={destination?.name || ''} name={place.name} latitude={place.latitude} longitude={place.longitude} formattedAddress={place.formattedAddress} primaryType={place.type || place.primaryTypeDisplayName} alt="" className="h-20 w-20 rounded-xl sm:h-24 sm:w-28" fallback={<placeCategory.Icon size={25} />} />}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[#edf1ed] px-2.5 py-1.5 sm:px-3">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-[#748078]">
                      {place.formattedAddress && <><MapPin size={12} className="shrink-0" /><span className="truncate">{place.formattedAddress}</span></>}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                    </div>
                  </div>
                  </article>
                </li>
              })}
            </ol>}
                {canSearchLivePlaces && <button type="button" onClick={() => requestGoogleCategory(categoryItem.key)} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#cfe0d2] bg-white px-3 text-xs font-bold text-pine transition hover:border-green-medium hover:bg-[#edf7ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"><GoogleGMark title="Search with Google Maps" />Find more places with Google</button>}
                {hasMore && <button type="button" onClick={() => toggleCategoryExpanded(categoryItem.key)} className="mt-2 text-[11px] font-medium text-[#7b8580] underline-offset-2 hover:text-[#59675e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">
                  {loadingMoreCategories[categoryItem.key] ? 'Finding more…' : isExpanded ? 'Show less' : 'Show more'}
                </button>}
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
              <Bookmark className="mx-auto text-[#8a9a8e]" size={26} />
              <h3 className="mt-3 font-bold text-pine">Your wishlist is empty</h3>
              <p className="mt-1 text-sm leading-6 text-[#718077]">Use the bookmark buttons to save places and restaurants for your trip.</p>
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
      collapsedSidebar={<WorkspaceRailControls backTo="/explore" backLabel="Back to Explore" expandLabel="Expand List" onBack={() => setPlacesPanelExpanded(true)} onExpand={() => setPlacesPanelExpanded(true)} />}

      map={<div className="relative h-full min-h-0 w-full min-w-0" aria-label="Map of places">
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
            destinationName={destination.name}
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
