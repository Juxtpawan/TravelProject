import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { ImagePlus, LoaderCircle, Upload, X } from 'lucide-react';
import { ENV } from '../../../config/env';
import { useAuth } from '../../../features/auth';
import { getPlaceImageOptions, selectPlaceImage } from '../../../features/place-images/api/placeImagesApi';
import { lookupDestination } from '../../../features/places/api/placesApi';
import { getPlacePhotos, uploadPlacePhoto } from '../../../features/places/api/placePhotosApi';

const placeContextCache = new Map();

function absolutePhotoUrl(url) {
  if (!url) return '';
  try { return new URL(url, ENV.API_URL).toString(); } catch { return ''; }
}

function googleCoordinate(location, key) {
  const value = typeof location?.[key] === 'function' ? location[key]() : location?.[key];
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Shared photo picker with Wikimedia choices and the signed-in user's private uploads. */
export default function PlaceImagePicker({
  placeId,
  destinationId,
  destinationName,
  name = destinationName,
  latitude,
  longitude,
  category = 'destination',
  onSelect,
  buttonLabel = 'Change destination photo',
  buttonClassName = 'inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/70 bg-white text-pine shadow-sm transition hover:bg-[#f2f7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine',
  buttonIconSize = 15,
}) {
  const { user } = useAuth();
  const placesLibrary = useMapsLibrary('places');
  const uploadInput = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('select');
  const [resolvedPlaceId, setResolvedPlaceId] = useState('');
  const canUploadPhotos = Boolean(user && resolvedPlaceId && !resolvedPlaceId.startsWith('local:'));
  const [options, setOptions] = useState([]);
  const [userPhotos, setUserPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userPhotosLoading, setUserPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingTitle, setSavingTitle] = useState('');
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [locationContext, setLocationContext] = useState('');

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      let id = placeId && !placeId.startsWith('local:') ? placeId : '';
      if (!id && destinationName) {
        try { id = (await lookupDestination(destinationName))?.destination?.google_place_id || ''; } catch { /* use local destination id */ }
      }
      if (!id) id = placeId || (destinationId ? `local:${destinationId}` : '');
      if (active) setResolvedPlaceId(id);
    };
    resolve();
    return () => { active = false; };
  }, [placeId, destinationId, destinationName]);

  const openPicker = async () => {
    setOpen(true);
    setActiveTab('select');
    setLoading(true);
    setUserPhotosLoading(Boolean(user));
    setError('');
    setUploadError('');
    try {
      let imagePlaceId = resolvedPlaceId;
      if (!imagePlaceId && destinationName) {
        try { imagePlaceId = (await lookupDestination(destinationName))?.destination?.google_place_id || ''; } catch { /* use saved destination id */ }
      }
      imagePlaceId ||= placeId || (destinationId ? `local:${destinationId}` : '');
      if (!imagePlaceId) throw new Error('This place does not have an image identity yet.');
      setResolvedPlaceId(imagePlaceId);

      let context = {
        placeName: name || destinationName || '', formattedAddress: '', primaryType: '',
        latitude: latitude !== undefined && latitude !== null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: longitude !== undefined && longitude !== null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      };
      if ((!Number.isFinite(context.latitude) || !Number.isFinite(context.longitude))
          && placesLibrary?.Place && !imagePlaceId.startsWith('local:')) {
        if (placeContextCache.has(imagePlaceId)) context = placeContextCache.get(imagePlaceId);
        else {
          try {
            const googlePlace = new placesLibrary.Place({ id: imagePlaceId });
            await googlePlace.fetchFields({ fields: ['location'] });
            context = {
              placeName: name || destinationName || '',
              formattedAddress: '',
              primaryType: '',
              latitude: googleCoordinate(googlePlace.location, 'lat'),
              longitude: googleCoordinate(googlePlace.location, 'lng'),
            };
            placeContextCache.set(imagePlaceId, context);
          } catch {
            // Still search using the location name if Place details are unavailable.
          }
        }
      }
      setLocationContext(context);
      const hasGoogleCoordinates = !imagePlaceId.startsWith('local:')
        && Number.isFinite(context.latitude) && Number.isFinite(context.longitude);
      if (!hasGoogleCoordinates) {
        setError('Google place details are unavailable, so nearby Wikimedia photos cannot be matched.');
      }
      const tasks = [hasGoogleCoordinates
        ? getPlaceImageOptions(imagePlaceId, category, destinationName, name, context)
        : Promise.resolve([])];
      if (user && !imagePlaceId.startsWith('local:')) tasks.push(getPlacePhotos(imagePlaceId).catch(() => []));
      const [wikimedia, personal] = await Promise.all(tasks);
      setOptions(wikimedia);
      setUserPhotos(personal || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Photo choices could not be loaded.');
      setUserPhotos([]);
    } finally {
      setLoading(false);
      setUserPhotosLoading(false);
    }
  };

  const selectPhoto = (url) => {
    const absoluteUrl = absolutePhotoUrl(url);
    if (!absoluteUrl) return;
    onSelect?.(absoluteUrl);
    setOpen(false);
  };

  const chooseWikimediaPhoto = async (option) => {
    setSavingTitle(option.title);
    setError('');
    try {
      const image = await selectPlaceImage(resolvedPlaceId, category, destinationName, name, option.title, locationContext);
      if (image?.url) selectPhoto(image.url);
      else setError('The selected photo was not available. Refresh the choices and try again.');
    } catch (err) {
      setError(err.response?.data?.error || 'The selected photo could not be saved.');
    } finally { setSavingTitle(''); }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Choose a photo smaller than 8 MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const photo = await uploadPlacePhoto(resolvedPlaceId, file);
      setUserPhotos((current) => [photo, ...current].slice(0, 12));
    } catch (err) {
      setUploadError(err.response?.data?.error || 'This photo could not be uploaded. Please try again.');
    } finally { setUploading(false); }
  };

  return <>
    <button type="button" onClick={openPicker} disabled={!placeId && !destinationId} aria-label={buttonLabel} title={buttonLabel} className={buttonClassName}>
      {loading ? <LoaderCircle size={buttonIconSize} className="animate-spin" /> : <ImagePlus size={buttonIconSize} />}
    </button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingTitle && !uploading) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="place-image-picker-title" className="flex max-h-[min(88dvh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 id="place-image-picker-title" className="truncate text-lg font-extrabold text-pine">Photos for {name || destinationName}</h2></div>
          <button type="button" onClick={() => setOpen(false)} disabled={Boolean(savingTitle) || uploading} aria-label="Close photo picker" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="flex shrink-0 gap-1 border-b border-slate-100 px-4 pt-2 sm:px-5" role="tablist" aria-label="Photo source">
          <button type="button" role="tab" aria-selected={activeTab === 'select'} onClick={() => setActiveTab('select')} className={`rounded-t-lg px-4 py-2 text-sm font-bold ${activeTab === 'select' ? 'border-b-2 border-pine text-pine' : 'text-slate-500 hover:text-pine'}`}>Select photo</button>
          {canUploadPhotos && <button type="button" role="tab" aria-selected={activeTab === 'yours'} onClick={() => setActiveTab('yours')} className={`rounded-t-lg px-4 py-2 text-sm font-bold ${activeTab === 'yours' ? 'border-b-2 border-pine text-pine' : 'text-slate-500 hover:text-pine'}`}>Your photo</button>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'select' && <>
            {loading && <p role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Finding matching photos…</p>}
            {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {!loading && !error && !options.length && <p className="py-8 text-center text-sm text-slate-500">No confidently matched photos were found.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {options.map((option) => <article key={option.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={option.previewUrl} alt="" loading="lazy" className="aspect-[5/3] w-full bg-[#edf3ee] object-cover" />
                <div className="p-2"><button type="button" disabled={Boolean(savingTitle)} onClick={() => chooseWikimediaPhoto(option)} className="inline-flex min-h-8 w-full items-center justify-center rounded-lg bg-btn-primary-bg px-3 text-xs font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover disabled:opacity-60">{savingTitle === option.title ? <LoaderCircle size={15} className="animate-spin" /> : 'Use this photo'}</button></div>
              </article>)}
            </div>
          </>}
          {activeTab === 'yours' && canUploadPhotos && <>
            <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleUpload} />
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Your uploads are private to your account.</p>
              <button type="button" onClick={() => uploadInput.current?.click()} disabled={uploading || !resolvedPlaceId || resolvedPlaceId.startsWith('local:') || userPhotos.length >= 12} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#eaf2ec] px-3 text-xs font-bold text-pine transition hover:bg-[#dce9df] disabled:cursor-not-allowed disabled:opacity-50">
                {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}{uploading ? 'Uploading…' : 'Upload photo'}
              </button>
            </div>
            {uploadError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{uploadError}</p>}
            {userPhotosLoading && <p role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading your photos…</p>}
            {!userPhotosLoading && !userPhotos.length && <p className="py-8 text-center text-sm text-slate-500">You haven’t uploaded a photo for this place yet.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {userPhotos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={absolutePhotoUrl(photo.url)} alt="" loading="lazy" className="aspect-[5/3] w-full bg-[#edf3ee] object-cover" />
                <div className="p-2"><button type="button" onClick={() => selectPhoto(photo.url)} className="inline-flex min-h-8 w-full items-center justify-center rounded-lg bg-btn-primary-bg px-3 text-xs font-bold text-btn-primary-text transition hover:bg-btn-primary-bg-hover">Use this photo</button></div>
              </article>)}
            </div>
          </>}
        </div>
      </section>
    </div>}
  </>;
}
