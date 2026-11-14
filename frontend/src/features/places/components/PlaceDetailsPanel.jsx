import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Clock3, ExternalLink, LoaderCircle, MapPin, Phone, X, ZoomIn } from 'lucide-react';
import { SiGooglemaps, SiTripadvisor } from 'react-icons/si';
import { ENV } from '../../../config/env';
import { useAuth } from '../../auth';
import { NumberedPin } from '../../maps';
import GoogleMapsAttribution from '../../../shared/components/google-maps-attribution/GoogleMapsAttribution';
import GoogleGMark from '../../../shared/components/google-g-mark/GoogleGMark';
import PlaceRating from '../../../shared/components/place-rating/PlaceRating';
import CommonsPlaceImage from '../../place-images/components/CommonsPlaceImage';
import { getPlacePhotos } from '../api/placePhotosApi';
import PlaceImagePicker from '../../../shared/components/place-image-picker/PlaceImagePicker';

const PLACE_DETAILS_FIELDS = [
  'displayName', 'formattedAddress', 'rating', 'userRatingCount', 'editorialSummary', 'reviews', 'primaryTypeDisplayName', 'googleMapsURI',
  'websiteURI', 'nationalPhoneNumber', 'internationalPhoneNumber', 'regularOpeningHours', 'currentOpeningHours',
  'regularSecondaryOpeningHours', 'currentSecondaryOpeningHours', 'priceLevel', 'priceRange', 'businessStatus', 'transitStation',
];

const DETAIL_SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'photos', label: 'Photos' },
  { id: 'mentions', label: 'Mentions' },
];

function formatMoney(money) {
  if (!money?.currencyCode) return '';
  const units = Number(money.units ?? money.amount);
  const nanos = Number(money.nanos || 0);
  if (!Number.isFinite(units)) return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: money.currencyCode, maximumFractionDigits: 2 }).format(units + nanos / 1e9);
  } catch {
    return `${money.currencyCode} ${units + nanos / 1e9}`;
  }
}

function formatPriceRange(range) {
  const start = formatMoney(range?.startPrice);
  const end = formatMoney(range?.endPrice);
  if (start && end) return `${start}–${end}`;
  return start ? `From ${start}` : '';
}

function getRatingDescriptor(value) {
  if (value >= 4.5) return 'Excellent';
  if (value >= 4) return 'Very good';
  if (value >= 3) return 'Good';
  if (value > 0) return 'Rated by visitors';
  return '';
}

function getPhotoUrl(photo) {
  if (!photo?.url) return '';
  try { return new URL(photo.url, ENV.API_URL).toString(); } catch { return ''; }
}

/** Map selection details with live business facts and the signed-in user's photos. */
export default function PlaceDetailsPanel({ place, category, destinationName, onClose, onZoomToPlace }) {
  const { user } = useAuth();
  const placesLibrary = useMapsLibrary('places');
  const [business, setBusiness] = useState(null);
  const [googlePhoto, setGooglePhoto] = useState(null);
  const [googlePhotoLoading, setGooglePhotoLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState('');
  const [activeSection, setActiveSection] = useState('about');
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null);
  const [selectedCommonsPhoto, setSelectedCommonsPhoto] = useState(null);
  const googlePhotoRequestRef = useRef('');
  const userPhotosRequestRef = useRef('');
  const placeId = place.google_place_id || (place.source === 'Google Maps' ? place.id : '');
  const businessLoading = Boolean(placesLibrary?.Place && placeId && !business);

  useEffect(() => {
    setSelectedCommonsPhoto(null);
  }, [placeId]);

  useEffect(() => {
    if (!placesLibrary?.Place || !placeId) return undefined;
    let active = true;
    const loadDetails = async () => {
      setReviewsLoading(true);
      setReviewsError('');
      try {
        const result = new placesLibrary.Place({ id: placeId });
        await result.fetchFields({ fields: PLACE_DETAILS_FIELDS });
        if (!active) return;
        setReviews((result.reviews || []).map((review) => ({
          rating: review.rating ?? null,
          text: typeof review.text === 'string' ? review.text : review.text?.text || '',
          relativeTime: review.relativePublishTimeDescription || '',
          author: review.authorAttribution?.displayName || '',
          authorUri: review.authorAttribution?.uri || '',
          authorPhoto: review.authorAttribution?.photoURI || '',
          mapsUri: review.googleMapsURI || '',
        })));
        setBusiness({
          name: typeof result.displayName === 'string' ? result.displayName : result.displayName?.text,
          address: result.formattedAddress || '',
          description: typeof result.editorialSummary === 'string' ? result.editorialSummary : result.editorialSummary?.text || '',
          type: typeof result.primaryTypeDisplayName === 'string' ? result.primaryTypeDisplayName : result.primaryTypeDisplayName?.text || '',
          rating: result.rating ?? null,
          userRatingCount: result.userRatingCount ?? 0,
          googleMapsURI: result.googleMapsURI || '',
          phone: result.internationalPhoneNumber || result.nationalPhoneNumber || '',
          website: result.websiteURI || '',
          currentHours: result.currentOpeningHours?.weekdayDescriptions || [],
          regularHours: result.regularOpeningHours?.weekdayDescriptions || [],
          currentSecondaryHours: (result.currentSecondaryOpeningHours || []).map((hours) => ({ type: hours.type || '', descriptions: hours.weekdayDescriptions || [] })),
          regularSecondaryHours: (result.regularSecondaryOpeningHours || []).map((hours) => ({ type: hours.type || '', descriptions: hours.weekdayDescriptions || [] })),
          openNow: result.currentOpeningHours?.openNow,
          priceLevel: result.priceLevel || '',
          priceRange: formatPriceRange(result.priceRange),
          businessStatus: result.businessStatus || '',
          transitStation: result.transitStation ?? false,
        });
      } catch {
        if (active) {
          setBusiness({ error: true });
          setReviewsError('Place details and reviews could not be loaded right now.');
        }
      } finally {
        if (active) setReviewsLoading(false);
      }
    };
    loadDetails();
    return () => { active = false; };
  }, [placesLibrary, placeId]);

  useEffect(() => {
    if (activeSection !== 'photos' || !placeId) return undefined;
    const loadPhotos = async () => {
      const tasks = [];
      if (!user) setPhotos([]);
      const userPhotoRequestKey = `${placeId}:${user?.id || ''}`;
      const shouldLoadUserPhotos = Boolean(user && userPhotosRequestRef.current !== userPhotoRequestKey);
      const shouldLoadGooglePhoto = Boolean(placesLibrary?.Place && googlePhotoRequestRef.current !== placeId);
      if (!shouldLoadUserPhotos && !shouldLoadGooglePhoto) return;
      setPhotosLoading(shouldLoadUserPhotos);
      setGooglePhotoLoading(shouldLoadGooglePhoto);
      if (shouldLoadUserPhotos) {
        userPhotosRequestRef.current = userPhotoRequestKey;
        tasks.push(getPlacePhotos(placeId).then((items) => setPhotos(items)).catch(() => setPhotos([])));
      }
      if (shouldLoadGooglePhoto) {
        googlePhotoRequestRef.current = placeId;
        tasks.push((async () => {
        try {
          const result = new placesLibrary.Place({ id: placeId });
          await result.fetchFields({ fields: ['photos'] });
          const photo = result.photos?.[0];
          setGooglePhoto(photo ? {
            url: photo.getURI?.({ maxWidth: 1200, maxHeight: 900 }) || '',
            authors: photo.authorAttributions || [],
            mapsUri: photo.googleMapsURI || '',
          } : null);
        } catch {
          setGooglePhoto(null);
          googlePhotoRequestRef.current = '';
        }
        })());
      }
      await Promise.all(tasks);
      setPhotosLoading(false);
      if (shouldLoadGooglePhoto) setGooglePhotoLoading(false);
    };
    loadPhotos();
    return undefined;
  }, [activeSection, placesLibrary, placeId, user]);

  const description = business?.description || place.description || '';
  const whyGo = place.summary && place.summary !== description ? place.summary : '';
  const address = business?.address || place.formattedAddress || '';
  const rating = business?.rating ?? place.rating;
  const reviewCount = business?.userRatingCount ?? place.userRatingCount;
  const mapsUrl = business?.googleMapsURI || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId || place.id)}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([business?.name || place.name, address].filter(Boolean).join(' '))}`;
  const tripAdvisorSearchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent([business?.name || place.name, address].filter(Boolean).join(' '))}`;
  const rawPlaceType = business?.type || place.type || place.primaryTypeDisplayName;
  const placeType = typeof rawPlaceType === 'string' ? rawPlaceType : rawPlaceType?.text || '';
  const photoCount = photos.length;
  const hasBusinessHours = Boolean(business?.currentHours?.length || business?.regularHours?.length);
  const hasBusinessDetails = Boolean(placeType || rating > 0 || business?.businessStatus || address || hasBusinessHours || business?.website);
  const cardPhotoClass = category.key === 'restaurant'
    ? 'h-24 w-28 rounded-lg sm:w-32'
    : 'h-20 w-20 rounded-xl sm:h-24 sm:w-28';
  const cardPhotoPlaceId = place.google_place_id || (place.source === 'Google Maps' ? place.id : '');
  const featuredReview = reviews.find((review) => review.text);

  const selectSection = (sectionId) => setActiveSection(sectionId);

  const handleTabKeyDown = (event) => {
    const currentIndex = DETAIL_SECTIONS.findIndex(({ id }) => id === activeSection);
    const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % DETAIL_SECTIONS.length
      : event.key === 'ArrowLeft' ? (currentIndex - 1 + DETAIL_SECTIONS.length) % DETAIL_SECTIONS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? DETAIL_SECTIONS.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextSection = DETAIL_SECTIONS[nextIndex].id;
    setActiveSection(nextSection);
    requestAnimationFrame(() => document.getElementById(`place-tab-${nextSection}`)?.focus());
  };

  return (
    <section aria-label={`${place.name} details`} className="absolute inset-x-0 bottom-0 z-20 flex h-1/2 min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white shadow-xl">
      <header className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="shrink-0 scale-90"><NumberedPin number={place.markerNumber} category={category} small /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-pine sm:text-base">{business?.name || place.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onZoomToPlace} aria-label={`Zoom to ${place.name}`} title="Zoom to this place" className="grid h-8 w-8 place-items-center rounded-full bg-[#edf5ef] text-pine transition hover:bg-[#dcece0]"><ZoomIn size={15} /></button>
          <button type="button" onClick={onClose} aria-label="Close place details" title="Close" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-pine transition hover:bg-slate-200"><X size={15} /></button>
        </div>
      </header>

      <nav aria-label="Place detail sections" role="tablist" aria-orientation="horizontal" onKeyDown={handleTabKeyDown} className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 bg-white px-2 py-1 sm:gap-2 sm:px-3">
        {DETAIL_SECTIONS.map(({ id, label }) => <button key={id} id={`place-tab-${id}`} type="button" onClick={() => selectSection(id)}
          role="tab" aria-selected={activeSection === id} aria-controls={`place-${id}-panel`} tabIndex={activeSection === id ? 0 : -1}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none sm:px-3.5 ${activeSection === id ? 'bg-[#004f32] text-white shadow-sm hover:bg-[#003d27]' : 'text-[#647169] hover:bg-[#f1f5f1]'}`}>
          {label}
        </button>)}
      </nav>

      <div className="app-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-2.5 text-[13px] leading-5 text-[#526158] sm:px-4 sm:py-3">
        {activeSection === 'about' && <section id="place-about-panel" className="scroll-mt-2" role="tabpanel" aria-label={`${place.name} about and business information`}>
          <div className="mb-2 flex min-w-0 items-start gap-2.5">
            <div className="min-w-0 flex-1">
              {reviewsLoading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-[#f7faf7] px-3 py-1.5 text-xs text-[#68766e]"><LoaderCircle size={14} className="animate-spin" />Loading a recent review…</p>}
              {reviewsError && <p role="status" className="rounded-lg bg-[#fff7ed] px-3 py-1.5 text-xs leading-5 text-[#805a24]">{reviewsError}</p>}
              {!reviewsLoading && !reviewsError && featuredReview && <article className="rounded-xl border border-[#e2e9e3] bg-white p-2.5 sm:p-3">
                <div className="flex items-center gap-2"><GoogleGMark className="h-5 w-5" title="Google review" /><h3 className="text-sm font-extrabold text-pine">Recent Google review</h3>
                  {featuredReview.rating > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#72500b]"><span aria-hidden="true" className="text-amber-500">★</span>{Number(featuredReview.rating).toFixed(1)}</span>}
                </div>
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-[#405047] sm:text-sm sm:leading-6">{featuredReview.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#718077]">
                  {(featuredReview.author || featuredReview.relativeTime) && <span>{featuredReview.author}{featuredReview.author && featuredReview.relativeTime ? ' · ' : ''}{featuredReview.relativeTime}</span>}
                  {featuredReview.mapsUri && <a href={featuredReview.mapsUri} target="_blank" rel="noreferrer" className="font-semibold text-pine underline underline-offset-2">Read on Google Maps</a>}
                </div>
              </article>}
            </div>
            {cardPhotoPlaceId && destinationName && <CommonsPlaceImage placeId={cardPhotoPlaceId} category={category.key} destination={destinationName} name={place.name} latitude={place.latitude} longitude={place.longitude} formattedAddress={place.formattedAddress || place.formatted_address} primaryType={place.type || place.primaryTypeDisplayName} alt={`${place.name}`} className={`${cardPhotoClass} shrink-0`} hideIfMissing />}
          </div>
          {hasBusinessDetails && <div className="overflow-hidden rounded-xl border border-[#e2e9e3] bg-white divide-y divide-[#edf1ed]">
            {placeType && <div className="px-3 py-2 sm:px-3.5"><span className="inline-flex rounded-full bg-[#edf4ef] px-2.5 py-1 text-xs font-bold capitalize text-pine">{placeType}</span></div>}
            {(rating > 0 || business?.businessStatus) && <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f8fbf8] px-3 py-2 sm:px-3.5">
              <div className="flex min-w-0 items-center gap-2">
                {rating > 0 && <GoogleGMark className="h-6 w-6" title="Rating from Google Maps" />}
                <div className="min-w-0">
                  {rating > 0 ? <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xl font-black leading-none tracking-tight text-[#26382e]">{Number(rating).toFixed(1)}</span>
                      <PlaceRating rating={rating} size="lg" className="text-xl" />
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#647169]">{reviewCount > 0 ? `${Number(reviewCount).toLocaleString()} Google reviews` : 'Google rating'}</p>
                  </> : null}
                </div>
              </div>
              {business?.businessStatus && <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold capitalize ${business.businessStatus === 'OPERATIONAL' ? 'bg-[#e9f5ec] text-[#287344]' : 'bg-[#f8eeec] text-[#9b4c3b]'}`}>
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />{business.businessStatus.replaceAll('_', ' ').toLowerCase()}
              </span>}
            </div>}
            {address && <div className="flex items-start gap-2.5 px-3 py-2 text-xs leading-5 text-[#526158] sm:px-3.5"><MapPin size={15} className="mt-0.5 shrink-0 text-pine" /><span>{address}</span></div>}
            {hasBusinessHours && <section className="px-3 py-2 sm:px-3.5" aria-labelledby="place-hours-title">
              <div className="flex items-center justify-between gap-2"><h3 id="place-hours-title" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-pine"><Clock3 size={14} />Business hours</h3>{businessLoading && <LoaderCircle size={14} className="animate-spin text-[#78867d]" aria-label="Loading opening hours" />}</div>
              {business?.currentHours?.length > 0 ? <details className="mt-2 group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-[#f7faf7] px-2.5 py-2 text-xs font-semibold text-pine [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 truncate">{business.openNow ? 'Open now' : 'Current hours'} · {business.currentHours[0]}</span><span className="shrink-0 text-xs text-[#718077] group-open:hidden">Show times</span><span className="hidden shrink-0 text-xs text-[#718077] group-open:inline">Hide times</span>
                </summary>
                <ul className="mt-1.5 grid gap-x-3 gap-y-0.5 px-1 text-xs leading-5 text-[#59675e] sm:grid-cols-2">{business.currentHours.map((line) => <li key={`current-${line}`} className="border-b border-[#edf1ed] py-1">{line}</li>)}</ul>
              </details> : null}
              {business?.regularHours?.length > 0 && JSON.stringify(business.regularHours) !== JSON.stringify(business.currentHours) && <details className="mt-2 rounded-lg border border-[#e8eee9] px-3 py-2 text-sm"><summary className="cursor-pointer font-semibold text-pine">Regular weekly hours</summary><ul className="mt-2 grid gap-x-3 gap-y-1 text-[#59675e] sm:grid-cols-2">{business.regularHours.map((line) => <li key={`regular-${line}`} className="border-b border-[#edf1ed] py-1">{line}</li>)}</ul></details>}
            </section>}
            {business?.website && <a href={business.website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5 px-3 py-2 text-xs font-semibold text-pine hover:bg-[#f8fbf8] sm:px-3.5"><ExternalLink size={15} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span><span className="shrink-0 text-[11px] text-[#718077]">Website</span></a>}
          </div>}
          {business?.phone && <a href={`tel:${business.phone.replace(/[^+\d]/g, '')}`} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-semibold text-pine hover:underline"><Phone size={14} />{business.phone}</a>}
          {(description || whyGo || businessLoading) && <div className="mt-2 rounded-xl border border-[#e2e9e3] bg-white p-3">
            <h3 id="place-about-title" className="text-sm font-extrabold text-pine">About</h3>
            {description ? <p className="mt-1.5 text-sm leading-6 text-[#405047]">{description}</p> : businessLoading && <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#7b877f]"><LoaderCircle size={14} className="animate-spin" />Loading place description…</p>}
            {whyGo && <div className="mt-2.5 border-t border-[#e8eee9] pt-2.5"><h4 className="text-xs font-extrabold text-pine">Why you should go</h4><p className="mt-1 text-sm leading-6 text-[#405047]">{whyGo}</p></div>}
          </div>}


          <section className="mt-2 rounded-xl border border-[#e2e9e3] bg-[#f8fbf8] p-3" aria-labelledby="place-open-in-title">
            <h3 id="place-open-in-title" className="text-sm font-extrabold text-pine">Open in</h3>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <a href={tripAdvisorSearchUrl} target="_blank" rel="nofollow noreferrer" aria-label={`Search ${business?.name || place.name} on Tripadvisor`} className="group inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-[#dce6de] bg-white px-2 text-xs font-bold text-pine shadow-sm transition hover:border-[#b9cdbd] hover:bg-[#f4f8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f8f1] text-[#159b72]"><SiTripadvisor size={17} aria-hidden="true" /></span><span className="min-w-0 truncate">Tripadvisor</span>
              </a>
              <a href={googleSearchUrl} target="_blank" rel="nofollow noreferrer" aria-label={`Search ${business?.name || place.name} on Google`} className="group inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-[#dce6de] bg-white px-2 text-xs font-bold text-pine shadow-sm transition hover:border-[#b9cdbd] hover:bg-[#f4f8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f5f7f6]"><GoogleGMark className="h-5 w-5" title="" /></span><span className="min-w-0 truncate">Google</span>
              </a>
              <a href={mapsUrl} target="_blank" rel="nofollow noreferrer" aria-label={`Open ${business?.name || place.name} in Google Maps`} className="group inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-[#dce6de] bg-white px-2 text-xs font-bold text-pine shadow-sm transition hover:border-[#b9cdbd] hover:bg-[#f4f8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f5f7f6] text-[#4285f4]"><SiGooglemaps size={19} aria-hidden="true" /></span><span className="min-w-0 truncate">Google Maps</span>
              </a>
            </div>
          </section>
        </section>}

        {activeSection === 'mentions' && <section id="place-mentions-panel" className="scroll-mt-2" role="tabpanel" aria-labelledby="place-mentions-title">
          <h3 id="place-mentions-title" className="text-sm font-extrabold text-pine">Mentions</h3>
          {place.tips?.length > 0 && <div className="mt-2 rounded-xl border border-[#e2e9e3] bg-white p-3"><h4 className="text-xs font-extrabold text-pine">Know before you go</h4><ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-[#405047]">{place.tips.slice(0, 5).map((tip, index) => <li key={`${index}-${tip}`}>{tip}</li>)}</ul></div>}
          {place.mentionSource && <a href={place.mentionSource} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#e2e9e3] bg-white p-3 text-xs font-semibold text-pine hover:bg-[#f8fbf8]"><span><span className="block text-[11px] font-bold uppercase tracking-wide text-[#748078]">Mentioned by</span>{place.mentionSourceName && <span className="mt-0.5 block">{place.mentionSourceName}</span>}</span><ExternalLink size={15} className="shrink-0" /></a>}
        </section>}

        {activeSection === 'reviews' && <section id="place-reviews-panel" className="scroll-mt-2" role="tabpanel" aria-labelledby="google-reviews-title">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div><h3 id="google-reviews-title" className="text-sm font-extrabold text-pine">Reviews</h3><p className="mt-0.5 text-xs text-[#718077]">Recent reviews from Google Maps</p></div>
            {rating > 0 && <div className="flex items-center gap-2 rounded-xl bg-[#f7faf7] px-2.5 py-1.5">
              <span className="text-xl font-black leading-none text-pine">{Number(rating).toFixed(1)}</span><span><PlaceRating rating={rating} size="lg" className="text-base" /><span className="mt-0.5 block text-[11px] font-semibold text-[#59675e]">{getRatingDescriptor(Number(rating))}</span></span>
              {reviewCount > 0 && <span className="border-l border-[#dce6de] pl-3 text-xs font-semibold leading-5 text-[#59675e]">{Number(reviewCount).toLocaleString()}<br />reviews</span>}
            </div>}
          </div>
          {reviewsLoading && <p role="status" className="mb-2 inline-flex items-center gap-2 rounded-lg bg-[#f7faf7] px-3 py-1.5 text-xs text-[#68766e]"><LoaderCircle size={14} className="animate-spin" />Loading Google reviews…</p>}
          {reviewsError && <p role="status" className="rounded-lg bg-[#f7faf7] px-3 py-1.5 text-xs leading-5 text-[#68766e]">{reviewsError}</p>}
          <div className="space-y-2">
            {reviews.slice(0, 5).map((review, index) => <article key={`${review.author}-${index}`} className="rounded-xl border border-[#e3eae4] bg-white p-3">
              <div className="flex items-center gap-2">
                {review.authorPhoto && <img src={review.authorPhoto} alt="" className="h-7 w-7 rounded-full object-cover" />}
                <div className="min-w-0 flex-1">
                  {review.author && (review.authorUri ? <a href={review.authorUri} target="_blank" rel="noreferrer" className="truncate text-xs font-bold text-pine hover:underline">{review.author}</a> : <p className="truncate text-xs font-bold text-pine">{review.author}</p>)}
                  {review.relativeTime && <p className="text-[11px] text-[#738078]">{review.relativeTime}</p>}
                </div>
                {review.rating > 0 && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fff7e6] px-2.5 py-1 text-sm font-bold text-[#72500b]"><span aria-hidden="true" className="text-amber-500">★</span>{Number(review.rating).toFixed(1)}</span>}
              </div>
              {review.text && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#405047]">{review.text}</p>}
              {review.mapsUri && <a href={review.mapsUri} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[11px] font-semibold text-pine underline">View on Google Maps</a>}
            </article>)}
          </div>
        </section>}

        {activeSection === 'photos' && <section id="place-photos-panel" className="scroll-mt-2" role="tabpanel" aria-labelledby="place-photo-heading">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 id="place-photo-heading" className="text-sm font-extrabold text-pine">Photos</h3>
              {photoCount + Number(Boolean(googlePhoto?.url)) > 0 && <p className="text-[11px] text-[#7b877f]">{photoCount + Number(Boolean(googlePhoto?.url))} photo{photoCount + Number(Boolean(googlePhoto?.url)) === 1 ? '' : 's'}</p>}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {category.key !== 'restaurant' && <PlaceImagePicker
              placeId={placeId}
              category={category.key}
              destinationName={destinationName}
              name={place.name}
              latitude={place.latitude}
              longitude={place.longitude}
              buttonLabel="Change place photo"
              buttonClassName="grid h-9 w-9 place-items-center rounded-full bg-[#eaf2ec] text-pine transition hover:bg-[#dce9df] disabled:cursor-not-allowed disabled:opacity-50"
              onSelect={(url) => setSelectedCommonsPhoto({ url, title: place.name })}
            />}
            </div>
          </div>
          {!user && <p className="mb-2 text-xs text-[#7b877f]">Sign in to add private photos to this place.</p>}
          {(photosLoading || googlePhotoLoading) && <p role="status" className="mb-2 inline-flex items-center gap-1.5 text-sm text-[#7b877f]"><LoaderCircle size={14} className="animate-spin" />Loading photos…</p>}
          <div className="grid grid-cols-3 gap-2">
            {selectedCommonsPhoto && <button type="button" onClick={() => setActivePhoto(selectedCommonsPhoto.url)} aria-label={`View selected photo of ${place.name}`} className="aspect-[4/3] overflow-hidden rounded-lg bg-[#edf3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">
              <img src={selectedCommonsPhoto.url} alt={`${place.name} photo: ${selectedCommonsPhoto.title}`} className="h-full w-full object-cover transition hover:scale-105" />
            </button>}
            {googlePhoto?.url && <figure className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#edf3ee]">
              <img src={googlePhoto.url} alt={`${place.name} on Google Maps`} className="h-full w-full object-cover" />
              {googlePhoto.mapsUri && <a href={googlePhoto.mapsUri} target="_blank" rel="noreferrer" aria-label="Photo from Google Maps" className="absolute bottom-1 right-1 rounded bg-white/90 px-1"><GoogleMapsAttribution className="h-3" /></a>}
              {googlePhoto.authors?.length > 0 && <figcaption className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-[9px] text-white">{googlePhoto.authors.map((author) => author.displayName).filter(Boolean).join(', ')}</figcaption>}
            </figure>}
            {photos.map((photo) => {
              const url = getPhotoUrl(photo);
              return url && <button key={photo.id} type="button" onClick={() => setActivePhoto(url)} aria-label={`View photo of ${place.name}`} className="aspect-[4/3] overflow-hidden rounded-lg bg-[#edf3ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine">
                <img crossOrigin="use-credentials" src={url} alt={`${place.name}, uploaded by you`} className="h-full w-full object-cover transition hover:scale-105" />
              </button>;
            })}
          </div>
          {googlePhoto?.authors?.length > 0 && <p className="mt-1 text-[10px] text-[#7b877f]">Google Maps photo by {googlePhoto.authors.map((author) => author.displayName).filter(Boolean).join(', ')}</p>}
          {user && <p className="mt-1 text-[10px] text-[#8a968f]">Your uploads are private to your account. JPEG, PNG, or WebP · up to 8 MB each · 12 per place.</p>}
        </section>}
      </div>

      {activePhoto && <div className="absolute inset-0 z-30 grid place-items-center bg-black/90 p-3" role="dialog" aria-modal="true" aria-label="Uploaded place photo" onClick={() => setActivePhoto(null)}>
        <button type="button" onClick={() => setActivePhoto(null)} aria-label="Close photo" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-pine"><X size={18} /></button>
        <img crossOrigin="use-credentials" src={activePhoto} alt={`${place.name}, uploaded by you`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
      </div>}
    </section>
  );
}
