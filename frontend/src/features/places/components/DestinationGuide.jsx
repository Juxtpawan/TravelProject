import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { APILoadingStatus, AdvancedMarker, InfoWindow, Map as GoogleMap, useApiLoadingStatus, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { ArrowLeft, BedDouble, BookOpen, Compass, Map as MapIcon, MapPin, Utensils, Landmark, LoaderCircle, Star } from 'lucide-react';
import { getDestinationGuide, resolveDestination } from '../api/placesApi';
import { ENV } from '../../../config/env';

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
    evidenceQuote: entity.evidence_quote || '',
    source: entity.source_domain || entity.source_url || 'Travel guide',
    sourceUrl: entity.source_url || '',
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
  }, [map, fitKey, center?.lat, center?.lng]);
  return null;
}

function PlaceMarker({ place, category, selected, onClick }) {
  return (
    <AdvancedMarker
      position={{ lat: Number(place.latitude), lng: Number(place.longitude) }}
      title={`${category.title}: ${place.name}`}
      zIndex={selected ? 1000 : undefined}
      onClick={onClick}
    >
      <NumberedPin number={place.markerNumber} category={category} selected={selected} />
    </AdvancedMarker>
  );
}

function NumberedPin({ number, category, selected = false, small = false }) {
  const pinPath = 'M24 2C11.85 2 2 11.85 2 24c0 14.3 20.3 32.9 21.17 33.68a1.25 1.25 0 0 0 1.66 0C25.7 56.9 46 38.3 46 24 46 11.85 36.15 2 24 2Z';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 60"
      className={`${small ? 'h-9 w-7' : 'h-14 w-11'} overflow-visible drop-shadow-md transition-transform ${selected ? 'scale-110' : 'hover:scale-105'}`}
    >
      <path d={pinPath} fill="white" />
      <path d={pinPath} fill={category.border} transform="translate(2 2) scale(.917)" />
      <path d={pinPath} fill={category.color} transform="translate(4 4) scale(.833)" />
      <text x="24" y={small ? '26' : '29'} textAnchor="middle" dominantBaseline="central" fill="#000000" fontSize={small ? '19' : '24'} fontWeight="900" fontFamily="inherit">
        {number}
      </text>
    </svg>
  );
}

function destinationCenter(destination) {
  const lat = Number(destination?.latitude);
  const lng = Number(destination?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: 20, lng: 0 };
}

export default function DestinationPage() {
  const { slug } = useParams();
  const mapsStatus = useApiLoadingStatus();
  const placesLibrary = useMapsLibrary('places');
  const [guide, setGuide] = useState(null);
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [activeCategory, setActiveCategory] = useState('attraction');
  const [googleResults, setGoogleResults] = useState({});
  const [searchingCategory, setSearchingCategory] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cardRefs = useRef(new Map());
  const crawlPollCount = useRef(0);
  const [crawlPollTick, setCrawlPollTick] = useState(0);
  const destination = guide?.destination;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setGuide(null);
    setDestinationDetails(null);
    crawlPollCount.current = 0;
    setCrawlPollTick(0);
    setGoogleResults({});
    setSelectedId(null);
    setDescriptionExpanded(false);
    setActiveCategory('attraction');
    getDestinationGuide(slug)
      .then((result) => { if (active) setGuide(result); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.status === 404 ? 'This destination is not saved yet. Search for it and choose a suggested destination first.' : 'We could not load this destination guide. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    const status = guide?.crawler?.status;
    if (!['queued', 'pending'].includes(status) || crawlPollCount.current >= 8) return undefined;
    const timer = setTimeout(async () => {
      crawlPollCount.current += 1;
      try {
        const refreshed = await getDestinationGuide(slug);
        setGuide(refreshed);
      } catch {
        // Keep the guide usable if the optional crawler service is temporarily down.
      }
      setCrawlPollTick((tick) => tick + 1);
    }, 7000);
    return () => clearTimeout(timer);
  }, [slug, guide?.crawler?.status, crawlPollTick]);

  useEffect(() => {
    const placeId = guide?.destination?.google_place_id;
    if (!placesLibrary || !placeId || destinationDetails?.placeId === placeId) return undefined;
    const geoTime = Date.parse(guide.destination.geo_cached_at || '');
    const geoAge = Date.now() - geoTime;
    const geoIsFresh = Number.isFinite(geoTime) && geoAge >= 0 && geoAge < 30 * 24 * 60 * 60 * 1000;
    if (geoIsFresh && guide.destination.latitude != null && guide.destination.longitude != null) {
      setDestinationDetails({
        placeId,
        name: guide.destination.name,
        address: '',
        location: { lat: Number(guide.destination.latitude), lng: Number(guide.destination.longitude) },
      });
      return undefined;
    }
    let active = true;
    const place = new placesLibrary.Place({ id: placeId });
    place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] })
      .then(() => {
        if (!active) return;
        const location = place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
        setDestinationDetails({
          placeId,
          name: place.displayName?.text || guide.destination.name,
          address: place.formattedAddress || '',
          location,
        });
        if (location) resolveDestination(guide.destination.name, placeId, location).catch(() => {});
      })
      .catch(() => { if (active) setDestinationDetails({ placeId, location: null }); });
    return () => { active = false; };
  }, [placesLibrary, guide?.destination?.google_place_id, guide?.destination?.name, guide?.destination?.geo_cached_at, guide?.destination?.latitude, guide?.destination?.longitude, destinationDetails?.placeId]);

  const savedPlaces = useMemo(() => (guide?.places || []).map((place) => ({
    ...place,
    id: place.google_place_id || place.id,
    category: normalizedCategory(place.category),
    formattedAddress: place.formatted_address || place.address || '',
    source: place.source_name || 'TravelProject guide',
  })), [guide?.places]);
  const crawlerEntities = guide?.crawler?.entities || EMPTY_ENTITIES;

  const localCategoryPlaces = useMemo(() => savedPlaces.filter((place) => place.category === activeCategory)
    .map((place) => attachGuideContent(place, crawlerEntities)), [savedPlaces, crawlerEntities, activeCategory]);
  const category = categories.find((item) => item.key === activeCategory) || categories[0];
  const cachedGooglePlaces = googleResults[activeCategory] || [];
  const places = useMemo(() => {
    const localIds = new Set(localCategoryPlaces.map((place) => place.id));
    const combined = [...localCategoryPlaces, ...cachedGooglePlaces.filter((place) => !localIds.has(place.id))].slice(0, 20);
    return combined.map((place, index) => ({ ...place, markerNumber: index + 1, category: activeCategory }));
  }, [localCategoryPlaces, cachedGooglePlaces, activeCategory]);
  const hasSavedCenter = destination?.latitude != null && destination?.longitude != null
    && Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude));
  const destinationLocation = destinationDetails?.location || (hasSavedCenter ? destinationCenter(destination) : null);
  const initialMapCenter = destinationLocation || { lat: 20, lng: 0 };
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
    setSearchingCategory(true);
    const center = destinationLocation;
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
    }).finally(() => { if (active) setSearchingCategory(false); });
    return () => { active = false; };
  }, [placesLibrary, destination?.google_place_id, destinationLocation?.lat, destinationLocation?.lng, activeCategory, category, localCategoryPlaces.length, googleResults, crawlerEntities]);

  const selectPlace = useCallback((place) => {
    setSelectedId(place.id);
  }, []);

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
    <main className="relative h-full min-h-0 overflow-hidden bg-[#f7f9f7] p-2 sm:p-3">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[1600px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:grid-rows-[auto_minmax(0,1fr)]">
        <header className="row-start-1 flex min-w-0 items-center gap-3 rounded-lg border border-[#e2e8e3] bg-white px-4 py-3 sm:px-6 xl:col-start-1 xl:row-start-1">
          <Link to="/explore" aria-label="Back to Explore" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#526158] hover:bg-[#f1f5f2]"><ArrowLeft size={19} /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pine"><Compass size={13} />Destination guide</div>
            <h1 className="truncate text-xl font-extrabold text-pine sm:text-2xl">{destinationDetails?.name || destination.name}</h1>
            <p className="truncate text-xs text-[#748078]">{destinationDetails?.address || [destination.state, destination.country].filter(Boolean).join(' · ') || 'Explore places nearby'}</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-[#657269] sm:flex"><MapPin size={15} />{places.length} places</div>
        </header>

        <section className={`${mobileView === 'list' ? 'flex' : 'hidden'} row-start-2 min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#e2e8e3] bg-[#f7f9f7] xl:col-start-1 xl:row-start-2 xl:flex`} aria-label={`${category.title} list`}>
          <div className="shrink-0 border-b border-[#e5ebe6] bg-white px-5 py-4 sm:px-7">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-pine">Explore {destination.name}</p><h2 className="mt-1 text-2xl font-extrabold text-pine">{category.title}</h2></div>
              <span className="shrink-0 text-sm text-[#718077]">Top {places.length}</span>
            </div>
            {destination.description && <div className="mt-2 max-w-3xl">
              <p className={`text-sm leading-5 text-[#68766e] ${descriptionExpanded ? '' : 'line-clamp-3'}`}>{destination.description}</p>
              {destination.description.length > 180 && <button type="button" onClick={() => setDescriptionExpanded((expanded) => !expanded)} className="mt-1 text-xs font-bold text-pine underline underline-offset-2">{descriptionExpanded ? 'Show less' : 'Read more'}</button>}
            </div>}
            <p className="mt-2 text-xs text-[#68766e]">Ranked guide picks · select a place to see its marker.</p>
            <nav className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Guide categories">
              {categories.map(({ key, title, Icon, color }) => {
                const count = savedPlaces.filter((place) => place.category === key).length;
                return <button key={key} type="button" onClick={() => { setActiveCategory(key); setSelectedId(null); setSearchingCategory(false); }} aria-pressed={activeCategory === key}
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
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-pine">{place.source || 'View on map'} <MapPin size={12} /></span>
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

        <section className={`${mobileView === 'map' ? 'block' : 'hidden'} relative row-start-2 min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8e3] bg-[#e9efea] xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:block`} aria-label="Map of places">
          {mapsStatus === APILoadingStatus.LOADED ? <>
            <GoogleMap id="destination-guide-map" mapId={ENV.GOOGLE_MAP_ID} defaultCenter={initialMapCenter} defaultZoom={12} gestureHandling="greedy" mapTypeControl={false} streetViewControl={false} fullscreenControl={false} className="h-full min-h-0 w-full">
              <FitPlaces places={mapPlaces} center={destinationLocation} />
              {mapPlaces.map((place) => {
                const placeCategory = categories.find((item) => item.key === place.category) || categories[0];
                return <PlaceMarker key={place.id} place={place} category={placeCategory} selected={selectedId === place.id} onClick={() => { setActiveCategory(place.category); selectPlace(place); }} />;
              })}
              {selectedPlace && <InfoWindow position={{ lat: Number(selectedPlace.latitude), lng: Number(selectedPlace.longitude) }} onCloseClick={() => setSelectedId(null)}>
                <div className="max-w-56 p-1"><p className="font-bold text-pine">{selectedPlace.name}</p></div>
              </InfoWindow>}
            </GoogleMap>
            <div className="absolute bottom-4 left-4 hidden rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg xl:block">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#69766e]">Map categories</p>
              <div className="flex flex-wrap gap-x-3 gap-y-2">{categories.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#526158]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.title}</span>)}</div>
            </div>
          </> : <div className="grid h-full min-h-0 place-items-center p-6 text-center">
            <div className="max-w-md rounded-xl border border-[#dce5dd] bg-white p-6 shadow-sm">
              <MapPin size={26} className="mx-auto text-pine" />
              <h2 className="mt-3 font-bold text-pine">{mapsStatus === APILoadingStatus.FAILED || mapsStatus === APILoadingStatus.AUTH_FAILURE ? 'Google Maps is unavailable' : 'Loading Google Maps…'}</h2>
              {(mapsStatus === APILoadingStatus.FAILED || mapsStatus === APILoadingStatus.AUTH_FAILURE) && <p className="mt-2 text-sm leading-6 text-[#68766e]">Check your internet connection and confirm that the Maps JavaScript API is enabled and your API key allows this site. Your place list is still available.</p>}
            </div>
          </div>}
        </section>
      </div>
      <button type="button" onClick={() => setMobileView((view) => view === 'list' ? 'map' : 'list')} className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-white shadow-xl transition hover:bg-green-deep xl:hidden" aria-label={mobileView === 'list' ? 'Show map' : 'Show list'}>
        {mobileView === 'list' ? <><MapIcon size={17} />Show map</> : <><BookOpen size={17} />Show list</>}
      </button>
    </main>
  );
}
