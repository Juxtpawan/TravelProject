import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { BedDouble, Check, ChevronDown, Landmark, ListChecks, MapPin, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import useWishlist from '../hooks/useWishlist';
import CommonsPlaceImage from '../../place-images/components/CommonsPlaceImage';
import { fetchGooglePlaceDetails, getCachedPlaceDetails } from '../../places/api/googlePlaces';

const categories = [
  { id: 'all', label: 'All', Icon: MapPin },
  { id: 'attraction', label: 'Things to do', Icon: Landmark },
  { id: 'restaurant', label: 'Restaurants', Icon: Utensils },
  { id: 'hotel', label: 'Hotels', Icon: BedDouble },
];

export default function WishlistOverlayContent({ onShowInGuide, onClose }) {
  const { lists, activeList, activeListId, selectList, createList, removeItem } = useWishlist();
  const placesLibrary = useMapsLibrary('places');
  const [resolvedDetails, setResolvedDetails] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const listDropdownRef = useRef(null);

  // In accordance with Google Maps Platform Terms of Service:
  // Server databases store only Place IDs indefinitely. Place names and details
  // are fetched on-demand client-side using the Google Places JavaScript API.
  useEffect(() => {
    activeList.items.forEach((item) => {
      if (item.provider !== 'google' || !item.id) return;
      if (resolvedDetails[item.id]) return;
      const cached = getCachedPlaceDetails(item.id);
      if (cached?.name && cached.name !== 'Saved place') {
        setResolvedDetails((prev) => ({ ...prev, [item.id]: cached }));
        return;
      }
      if (placesLibrary) {
        fetchGooglePlaceDetails(placesLibrary, item.id).then((details) => {
          if (details?.name) {
            setResolvedDetails((prev) => ({ ...prev, [item.id]: details }));
          }
        });
      }
    });
  }, [activeList.items, placesLibrary, resolvedDetails]);

  const getItemDetails = (item) => {
    const resolved = resolvedDetails[item.id] || getCachedPlaceDetails(item.id);
    const name = resolved?.name || (item.name && item.name !== 'Saved place' ? item.name : item.displayName) || '';
    const formattedAddress = resolved?.formattedAddress || item.formattedAddress || '';
    return { name, formattedAddress };
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchingItems = activeList.items.filter((item) => {
    if (!normalizedSearch) return true;
    const { name, formattedAddress } = getItemDetails(item);
    return [name, item.displayName, item.destinationName, item.destinationSlug, formattedAddress, categories.find((category) => category.id === item.category)?.label]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  const visibleCategories = categories.filter((category) => category.id === 'all'
    || matchingItems.some((item) => item.category === category.id));
  const groups = activeCategory === 'all'
    ? categories.slice(1).map((category) => ({ ...category, items: matchingItems.filter((item) => item.category === category.id) })).filter((group) => group.items.length)
    : categories.filter((category) => category.id === activeCategory).map((category) => ({ ...category, items: matchingItems.filter((item) => item.category === category.id) })).filter((group) => group.items.length);

  const handleCreate = (event) => {
    event.preventDefault();
    const result = createList(newListName);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewListName('');
    setError('');
    setShowCreateForm(false);
    setActiveCategory('all');
  };

  useEffect(() => {
    const closeDropdown = (event) => {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape' || !listDropdownRef.current?.open) return;
        listDropdownRef.current.open = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.type === 'pointerdown' && listDropdownRef.current?.contains(event.target)) return;
      if (listDropdownRef.current) listDropdownRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeDropdown);
    document.addEventListener('keydown', closeDropdown);
    return () => {
      document.removeEventListener('pointerdown', closeDropdown);
      document.removeEventListener('keydown', closeDropdown);
    };
  }, []);

  return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
    <section aria-label="Wishlist collections" className="rounded-2xl border border-[#e0e7e1] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#718077]">Your lists</span>
          <details ref={listDropdownRef} className="group relative w-full sm:max-w-md">
            <summary aria-label={`Choose wishlist. Current: ${activeList.name}`} className="flex h-[3.25rem] cursor-pointer list-none items-center gap-3 rounded-xl border border-[#d6e1d8] bg-gradient-to-b from-white to-[#f7faf7] px-3 shadow-sm outline-none transition hover:border-[#aebfb2] hover:shadow-md focus-visible:ring-2 focus-visible:ring-pine/20 [&::-webkit-details-marker]:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf2ec] text-pine"><ListChecks size={18} /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-bold text-pine">{activeList.name}</span>
                <span className="mt-0.5 block text-[11px] text-[#718077]">{activeList.items.length} {activeList.items.length === 1 ? 'place' : 'places'} saved</span>
              </span>
              <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[#718077] transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[#dfe7e1] bg-white p-2 shadow-[0_18px_50px_rgba(28,53,39,0.18)] ring-1 ring-black/5">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#718077]">Switch wishlist</span>
                <span className="text-[11px] font-semibold text-[#8a9a8e]">{lists.length} {lists.length === 1 ? 'list' : 'lists'}</span>
              </div>
              <ul className="app-scrollbar max-h-64 overflow-y-auto">
                {lists.map((list) => {
                  const selected = list.id === activeListId;
                  return <li key={list.id}>
                    <button type="button" aria-current={selected ? 'true' : undefined} onClick={() => {
                      selectList(list.id);
                      setActiveCategory('all');
                      setSearchTerm('');
                      if (listDropdownRef.current) listDropdownRef.current.open = false;
                    }} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${selected ? 'bg-[#edf4ef]' : 'hover:bg-[#f7faf7]'}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-pine text-white' : 'bg-[#f1f5f2] text-[#627268]'}`}><ListChecks size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-bold ${selected ? 'text-pine' : 'text-[#35433d]'}`}>{list.name}</span>
                        <span className="mt-0.5 block text-xs text-[#718077]">{list.items.length} {list.items.length === 1 ? 'place' : 'places'}</span>
                      </span>
                      {selected && <Check size={17} className="shrink-0 text-pine" />}
                    </button>
                  </li>;
                })}
              </ul>
            </div>
          </details>
          <p className="mt-2 text-xs leading-5 text-[#718077]">New places saved from destination guides go to <span className="font-bold text-pine">{activeList.name}</span>. Choose another list above to change the save destination.</p>
        </div>
        <button type="button" onClick={() => setShowCreateForm((value) => !value)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-bold text-white transition hover:bg-pine/90">
          <Plus size={17} />New wishlist
        </button>
      </div>

      {showCreateForm && <form onSubmit={handleCreate} className="mt-4 border-t border-[#edf1ed] pt-4">
        <label htmlFor="wishlist-collection-name" className="block text-sm font-bold text-pine">Give this list a name</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="wishlist-collection-name" autoFocus maxLength={48} value={newListName} onChange={(event) => { setNewListName(event.target.value); setError(''); }} placeholder="e.g. Kyoto food spots" className="h-11 min-w-0 flex-1 rounded-xl border border-[#d4ded6] px-3 text-sm outline-none focus:border-pine focus:ring-2 focus:ring-pine/10" />
          <button type="submit" className="h-11 rounded-xl bg-[#eaf2ec] px-4 text-sm font-bold text-pine transition hover:bg-[#dce9df]">Create list</button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs font-medium text-[#a13a31]">{error}</p>}
      </form>}
    </section>

    {activeList.items.length > 0 && <label className="mt-5 flex h-11 items-center gap-2 rounded-xl border border-[#dce4de] bg-white px-3 text-[#718077] focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/10 sm:max-w-xl">
      <Search size={17} className="shrink-0" />
      <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${activeList.name}`} aria-label={`Search ${activeList.name}`} className="min-w-0 flex-1 bg-transparent text-sm text-[#263a30] outline-none placeholder:text-[#87958b]" />
    </label>}

    {activeList.items.length > 0 && <nav aria-label="Filter wishlist by category" className="app-scrollbar mt-3 flex gap-2 overflow-x-auto pb-2">
      {visibleCategories.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={activeCategory === id} onClick={() => setActiveCategory(id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${activeCategory === id ? 'border-pine bg-pine text-white' : 'border-[#dce4de] bg-white text-[#59675e] hover:bg-[#f2f6f3]'}`}><Icon size={15} />{label}{id !== 'all' && <span className="text-xs opacity-75">{activeList.items.filter((item) => item.category === id).length}</span>}</button>)}
    </nav>}

    {activeList.items.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#cbd8ce] bg-white px-5 py-12 text-center sm:py-16">
      <MapPin size={28} className="mx-auto text-[#8a9a8e]" />
      <h3 className="mt-3 text-lg font-extrabold text-pine">This wishlist is ready for your next idea</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718077]">Save places and restaurants from a destination guide. You can organize them into separate lists as you plan.</p>
      {onShowInGuide && <button type="button" onClick={onShowInGuide} className="mt-5 rounded-full bg-pine px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pine/90">Browse saved places in this guide</button>}
    </div> : !matchingItems.length ? <p className="mt-6 rounded-xl bg-white p-8 text-center text-sm text-[#718077]">No saved places match “{searchTerm}”.</p> : groups.map(({ id, label, Icon, items }) => <section key={id} aria-label={label} className="mt-6 first:mt-5">
      {activeCategory === 'all' && <div className="mb-3 flex items-center gap-2"><Icon size={17} className="text-pine" /><h3 className="text-sm font-extrabold text-pine">{label}</h3><span className="text-xs font-semibold text-[#718077]">{items.length}</span></div>}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const { name: resolvedName, formattedAddress } = getItemDetails(item);
          const placeName = resolvedName || (item.name && item.name !== 'Saved place' ? item.name : item.displayName);
          const destinationName = item.destinationName || item.destinationSlug?.replace(/-/g, ' ');
          const categoryName = categories.find((category) => category.id === item.category)?.label || 'Place';
          return <li key={`${item.provider}:${item.id}`} className="group flex min-w-0 overflow-hidden rounded-2xl border border-[#e0e7e1] bg-white shadow-sm transition hover:border-[#b9cbbd] hover:shadow-md">
          <Link to={`/locations/${encodeURIComponent(item.destinationSlug)}`} className="flex min-w-0 flex-1 gap-3 p-3" onClick={onClose}>
            {item.provider === 'google'
              ? <CommonsPlaceImage placeId={item.id} category={item.category} destination={destinationName || ''} name={placeName || ''} alt={placeName || ''} className="h-20 w-24 shrink-0 sm:h-24 sm:w-28" fallback={<Icon size={24} />} />
              : <span className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-[#edf3ee] text-pine sm:h-24 sm:w-28"><Icon size={24} /></span>}
            <span className="min-w-0 self-center">
              <span className="block line-clamp-2 text-sm font-extrabold text-pine">{placeName || `Saved place in ${destinationName || 'your destination'}`}</span>
              <span className="mt-1 block text-[11px] font-semibold text-[#56645b]">{categoryName}</span>
              {formattedAddress && <span className="mt-1 block line-clamp-2 text-xs text-[#718077]">{formattedAddress}</span>}
              {destinationName && <span className="mt-1 block truncate text-xs capitalize text-[#718077]">{destinationName}</span>}
              {item.provider === 'google' && <span translate="no" className="mt-1 block text-xs font-normal text-[#5e5e5e]">Google Maps</span>}
            </span>
          </Link>
          <div className="flex shrink-0 flex-col items-center gap-1 p-2">
            {item.provider === 'google' && <a href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" aria-label="Open saved place in Google Maps" title="Open in Google Maps" className="grid h-9 w-9 place-items-center rounded-full text-pine hover:bg-[#edf4ef]"><MapPin size={16} /></a>}
            <button type="button" onClick={() => removeItem(activeListId, item)} aria-label={`Remove saved place from ${activeList.name}`} title="Remove from wishlist" className="grid h-9 w-9 place-items-center rounded-full text-[#7a8980] opacity-100 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><Trash2 size={16} /></button>
          </div>
        </li>;
        })}
      </ul>
    </section>)}
    {activeList.items.length > 0 && matchingItems.length > 0 && activeCategory !== 'all' && !groups.length && <p className="mt-6 rounded-xl bg-white p-8 text-center text-sm text-[#718077]">No {categories.find((category) => category.id === activeCategory)?.label.toLowerCase()} match this search.</p>}
  </div>;
}
