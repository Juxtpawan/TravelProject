import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { ArrowLeft, BedDouble, BookOpen, Compass, MapPin, PanelLeftClose, Utensils, Landmark, LoaderCircle, Star } from 'lucide-react';
import { getDestinationGuide, resolveDestination } from '../api/placesApi';
import { InteractiveMap, NumberedPin, NumberedPlaceMarker } from '../../maps';
import MapWorkspaceLayout from '../../../layouts/MapWorkspaceLayout';
import PlaceDetailsPanel from './PlaceDetailsPanel';

const categories = [
  { key: 'attraction', title: 'Things to do', singular: 'place to visit', Icon: Landmark, color: 'var(--color-green-medium)', border: 'var(--color-pine)', types: ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark', 'park', 'zoo', 'aquarium', 'amusement_park', 'place_of_worship'] },
  { key: 'restaurant', title: 'Restaurants', singular: 'restaurant', Icon: Utensils, color: '#e46432', border: '#b84620', types: ['restaurant'] },
  { key: 'hotel', title: 'Hotels', singular: 'hotel', Icon: BedDouble, color: '#3972c6', border: '#24549d', types: ['hotel'] },
  { key: 'activity', title: 'Experiences', singular: 'experience', Icon: Compass, color: '#7955bf', border: '#59399a', types: [] },
];
const EMPTY_ENTITIES = [];

const normalizedCategory = (category = '') => {
  const value = category.toLowerCase();
  if (['restaurant', 'cafe', 'bar', 'eat', 'drink'].includes(value)) return 'restaurant';
  if (['hotel', 'lodging', 'sleep'].includes(value)) return 'hotel';
  if (['activity', 'activities', 'experience', 'do'].includes(value)) return 'activity';
  return 'attraction';
};

function normalizePlaceName(name = '') {
  return String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function attachGuideContent(place, entities = []) {
  const name = normalizePlaceName(place.name);
  if (!name) return place;
  const entity = entities.find((candidate) => {
    if (normalizedCategory(candidate.entity_type) !== normalizedCategory(place.category)) return false;
    const candidateName = normalizePlaceName(candidate.name);
    return candidateName && (candidateName === name || (Math.min(candidateName.length, name.length) >= 8 && (candidateName.includes(name) || name.includes(candidateName))));
  });
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
  const placesLibrary = useMapsLibrary('places');
  const [guideState, setGuideState] = useState({ slug: null, guide: null, error: '' });
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [activeCategory, setActiveCategory] = useState('attraction');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [googleResults, setGoogleResults] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [mapCenter, setMapCenter] = useState({ lat: 20, lng: 0 });
  const [mapZoom, setMapZoom] = useState(12);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const cardRefs = useRef(new Map());
  const crawlPollCount = useRef(0);
  const [crawlPollTick, setCrawlPollTick] = useState(0);
  const guide = guideState.slug === slug ? guideState.guide : null;
  const loading = guideState.slug !== slug;
  const error = guideState.slug === slug ? guideState.error : '';
  const destination = guide?.destination;

  useEffect(() => {
    let active = true;
    crawlPollCount.current = 0;
    getDestinationGuide(slug)
      .then((result) => {
        if (!active) return;
        setGuideState({ slug, guide: result, error: '' });
        setDestinationDetails(null);
        setGoogleResults({});
        setSelectedId(null);
        setDescriptionExpanded(false);
        setActiveCategory('attraction');
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
    place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] })
      .then(() => {
        if (!active) return;
        const location = place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
        setDestinationDetails({
          placeId,
          name: place.displayName?.text || destination.name,
          address: place.formattedAddress || '',
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

  const localCategoryPlaces = useMemo(() => savedPlaces.filter((place) => place.category === activeCategory)
    .map((place) => attachGuideContent(place, crawlerEntities)), [savedPlaces, crawlerEntities, activeCategory]);
  const category = categories.find((item) => item.key === activeCategory) || categories[0];
  const cachedGooglePlaces = googleResults[activeCategory] || EMPTY_ENTITIES;
  const places = useMemo(() => {
    const localIds = new Set(localCategoryPlaces.map((place) => place.id));
    const combined = [...localCategoryPlaces, ...cachedGooglePlaces.filter((place) => !localIds.has(place.id))].slice(0, 20);
    return combined.map((place, index) => ({ ...place, markerNumber: index + 1, category: activeCategory }));
  }, [localCategoryPlaces, cachedGooglePlaces, activeCategory]);
  const destinationLatitude = destination?.latitude;
  const destinationLongitude = destination?.longitude;
  const hasSavedCenter = destinationLatitude != null && destinationLongitude != null
    && Number.isFinite(Number(destinationLatitude)) && Number.isFinite(Number(destinationLongitude));
  const savedCenter = useMemo(() => hasSavedCenter
    ? { lat: Number(destinationLatitude), lng: Number(destinationLongitude) }
    : null, [hasSavedCenter, destinationLatitude, destinationLongitude]);
  const destinationLocation = destinationDetails?.location || savedCenter;
  const searchingCategory = Boolean(placesLibrary && destination?.google_place_id && destinationLocation
    && googleResults[activeCategory] === undefined && localCategoryPlaces.length < 20 && category.types.length);
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

  useEffect(() => {
    if (!placesLibrary || !destination?.google_place_id || !destinationLocation || googleResults[activeCategory] !== undefined) return undefined;
    if (localCategoryPlaces.length >= 20 || !category.types.length) return undefined;
    let active = true;
    const center = { lat: destinationLocation.lat, lng: destinationLocation.lng };
    placesLibrary.Place.searchNearby({
      locationRestriction: { center, radius: 20000 },
      maxResultCount: Math.max(1, 20 - localCategoryPlaces.length),
      rankPreference: placesLibrary.SearchNearbyRankPreference.POPULARITY,
      includedPrimaryTypes: category.types,
      fields: ['id', 'displayName', 'location', 'formattedAddress', 'businessStatus', 'photos'],
    }).then((response) => {
      const mapped = (response.places || []).filter((place) => place.businessStatus !== 'CLOSED_PERMANENTLY').map((place) => {
        const photo = place.photos?.[0];
        return attachGuideContent({
          id: place.id,
          google_place_id: place.id,
          name: place.displayName?.text || category.singular,
          category: activeCategory,
          latitude: place.location?.lat(),
          longitude: place.location?.lng(),
          formattedAddress: place.formattedAddress || '',
          photoUrl: photo?.getURI({ maxWidth: 720, maxHeight: 480 }),
          photoAttributions: photo?.authorAttributions || [],
          source: 'Google Maps',
        }, crawlerEntities);
      });
      if (active) setGoogleResults((current) => ({ ...current, [activeCategory]: mapped }));
    }).catch(() => {
      if (active) setGoogleResults((current) => ({ ...current, [activeCategory]: [] }));
    });
    return () => { active = false; };
  }, [placesLibrary, destination?.google_place_id, destinationLocation, activeCategory, category, localCategoryPlaces.length, googleResults, crawlerEntities]);

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

  useEffect(() => {
    const card = cardRefs.current.get(selectedId);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, activeCategory, places]);

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
    <MapWorkspaceLayout
      header={<div className={`flex min-w-0 items-center gap-3 ${sidebarExpanded ? '' : 'md:justify-center'}`}>
          <Link to="/explore" aria-label="Back to Explore" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#526158] hover:bg-[#f1f5f2]"><ArrowLeft size={19} /></Link>
          <div className={`min-w-0 flex-1 ${sidebarExpanded ? '' : 'md:hidden'}`}>

            <h1 className="truncate uppercase text-xl font-extrabold text-pine sm:text-2xl">{destinationDetails?.name || destination.name}</h1>
            <p className="truncate text-xs text-[#748078]">{destinationDetails?.address || [destination.state, destination.country].filter(Boolean).join(' · ') || 'Explore places nearby'}</p>
          </div>
      </div>}

      sidebar={<div className="relative h-full w-full min-h-0 min-w-0">
        <section className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#e2e8e3] bg-[#f7f9f7] ${sidebarExpanded ? '' : 'md:hidden'}`} aria-label={`${category.title} list`}>
          <div className="shrink-0 border-b border-[#e5ebe6] bg-white px-5 py-4 sm:px-7">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-pine">Explore {destination.name}</p><h2 className="mt-1 text-2xl font-extrabold text-pine">{category.title}</h2></div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-[#718077]">Top {places.length}</span>
                <button type="button" onClick={() => setSidebarExpanded(false)} aria-label="Collapse places list" title="Collapse places list"
                  className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-[#dfe7e1] px-2.5 text-xs font-semibold text-pine transition hover:bg-[#f3f7f4] md:inline-flex">
                  <PanelLeftClose size={15} />Collapse List
                </button>
              </div>
            </div>
            {destination.description && <div className="mt-2 max-w-3xl">
              <p className={`text-sm leading-5 text-[#68766e] ${descriptionExpanded ? '' : 'line-clamp-3'}`}>{destination.description}</p>
              {destination.description.length > 180 && <button type="button" onClick={() => setDescriptionExpanded((expanded) => !expanded)} className="mt-1 text-xs font-bold text-pine underline underline-offset-2">{descriptionExpanded ? 'Show less' : 'Read more'}</button>}
            </div>}
            <p className="mt-2 text-xs text-[#68766e]">Ranked guide picks · select a place to see its marker.</p>
            <nav className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Guide categories">
              {categories.map(({ key, title, Icon, color }) => {
                const count = savedPlaces.filter((place) => place.category === key).length;
                return <button key={key} type="button" onClick={() => { setActiveCategory(key); setSelectedId(null); }} aria-pressed={activeCategory === key}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${activeCategory === key ? 'border-green-medium bg-badge-bg text-pine' : 'border-[#e0e7e1] bg-white text-[#59675e] hover:bg-[#f7faf7]'}`}>
                  <Icon size={15} style={{ color }} />{title}<span className="text-[10px] opacity-65">{count || ''}</span>
                </button>;
              })}
            </nav>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:px-6 sm:pb-24">
            {searchingCategory && <div className="mb-3 flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-[#68766e]"><LoaderCircle size={16} className="animate-spin text-pine" />Finding popular {category.title.toLowerCase()}…</div>}
            {places.length ? <ol className="space-y-3">
              {places.map((place) => (
                <li key={place.id} ref={(node) => { if (node) cardRefs.current.set(place.id, node); else cardRefs.current.delete(place.id); }}>
                  <article className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${selectedId === place.id ? 'border-green-medium ring-1 ring-green-medium/20' : 'border-[#e0e7e1]'}`}>
                  <button type="button" onClick={() => selectPlace(place)} onFocus={() => setSelectedId(place.id)} aria-pressed={selectedId === place.id}
                    className="group flex w-full gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium">
                    <span className="flex h-11 w-8 shrink-0 items-center justify-center" aria-label={`Map marker ${place.markerNumber}`}>
                      <NumberedPin number={place.markerNumber} category={category} small />
                    </span>
                    {place.photoUrl ? <img src={place.photoUrl} alt="" loading="lazy" className="h-24 w-28 shrink-0 rounded-lg object-cover sm:w-32" /> : <span className="grid h-24 w-28 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#9aa79d] sm:w-32"><category.Icon size={25} /></span>}
                    <span className="min-w-0 flex-1 py-1">
                      <span className="block line-clamp-2 font-extrabold leading-5 text-pine">{place.name}</span>
                      {place.rating && <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#56645b]"><Star size={13} className="fill-[#e7a82d] text-[#e7a82d]" />{place.rating}{place.user_rating_count ? ` (${place.user_rating_count})` : ''}</span>}
                      {place.formattedAddress && <span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#748078]">{place.formattedAddress}</span>}
                      {place.summary && <span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#59675e]">{place.summary}</span>}
                      {place.tips?.length > 0 && <span className="mt-1 block line-clamp-1 text-[11px] text-[#738078]">Tip: {place.tips[0]}</span>}
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-pine">View on map <MapPin size={12} /></span>
                    </span>
                  </button>
                  {place.photoAttributions?.map((attribution) => <a key={attribution.uri || attribution.displayName} href={attribution.uri || place.photoUrl} target="_blank" rel="noreferrer" className="block truncate px-3 pb-2 text-[10px] text-[#748078] underline">Photo: {attribution.displayName}</a>)}
                  </article>
                </li>
              ))}
            </ol> : !searchingCategory ? <div className="rounded-xl border border-dashed border-[#cfd9d1] bg-white p-6 text-center">
              <category.Icon className="mx-auto text-[#8a9a8e]" size={28} />
              <h3 className="mt-3 font-bold text-pine">No {category.title.toLowerCase()} saved yet</h3>
              <p className="mt-1 text-sm leading-6 text-[#718077]">We’ll show saved guide entries here. Google results appear when available for this area.</p>
            </div> : null}
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
            {crawlerEntities.length > 0 && <section className="mt-4 rounded-xl border border-[#e0e7e1] bg-white p-4" aria-label="Unmatched travel guide suggestions">
              <div className="flex items-center gap-2 text-sm font-bold text-pine"><Compass size={16} className="text-[#7955bf]" />More guide suggestions</div>
              <p className="mt-1 text-xs leading-5 text-[#718077]">These suggestions still need a map-place match, so they are not numbered map markers.</p>
              <ul className="mt-3 space-y-2">
                {crawlerEntities.filter((entity) => normalizedCategory(entity.entity_type) === activeCategory
                  && !places.some((place) => normalizePlaceName(place.name) === normalizePlaceName(entity.name)))
                  .slice(0, 6).map((entity, index) => <li key={entity.id || `${entity.name}-${index}`} className="rounded-lg bg-[#f7faf7] p-3">
                    <p className="text-sm font-bold text-pine">{entity.name}</p>
                    {(entity.why_go || entity.summary) && <p className="mt-1 text-xs leading-5 text-[#68766e]">{entity.why_go || entity.summary}</p>}
                    {entity.source_url && <a href={entity.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-semibold text-pine underline">Read source</a>}
                  </li>)}
              </ul>
            </section>}
          </div>
          {!(crawlerStatus === 'unavailable' && !guideFacts.length && !crawlerEntities.length) && <div role="status" className="shrink-0 border-t border-[#e3e9e4] bg-white px-5 py-3 text-xs text-[#738078] sm:px-7">
            {crawlerStatus === 'queued' || crawlerStatus === 'pending' ? <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin text-pine" />Finding sources and extracting travel-guide details in the background{sourcesInProgress > 0 ? ` · ${sourcesInProgress} source${sourcesInProgress === 1 ? '' : 's'} processing` : ''}.</span> : guideFacts.length || crawlerEntities.length ? `${guideFacts.length + crawlerEntities.length} guide details are available from crawler sources.` : 'Guide details are collected from saved places and current map results.'}
          </div>}
        </section>
        {!sidebarExpanded && <button type="button" onClick={() => setSidebarExpanded(true)} aria-label="Expand places list" title="Expand places list"
          className="absolute inset-0 z-10 hidden cursor-pointer items-center justify-center rounded-lg bg-slate-900/5 transition hover:bg-slate-900/10 md:flex">
          <span className="transform -rotate-90 whitespace-nowrap tracking-wider font-bold text-slate-600 text-xs">EXPAND VIEW</span>
        </button>}
      </div>}

      map={<div className="relative h-full min-h-0 min-w-0" aria-label="Map of places">
          <InteractiveMap id="destination-guide-map" mapCenter={mapCenter} setMapCenter={setMapCenter} mapZoom={mapZoom} setMapZoom={setMapZoom} overlayOpen={Boolean(selectedPlace)}>
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
      sidebarExpanded={sidebarExpanded}
      collapsedHeaderOnly
      hideMobileHeader
    />
  );
}
