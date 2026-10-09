import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import ItineraryMap from './ItineraryMap';
import ItinerarySidebar from './ItinerarySidebar';
import MapWorkspaceLayout from '../../layouts/MapWorkspaceLayout';
import TripAiAssistant from '../itinerary-ai/components/TripAiAssistant';
import { useAuth } from '../auth';
import { addTripItineraryItem, deleteTripItineraryItem, generateTripItinerary, getTrips, getTripItinerary, optimizeTripItineraryDay, reorderTripItinerary, updateTripItineraryItem } from '../trips/api/tripsApi';

const MANALI_CENTER = { lat: 32.2432, lng: 77.1892 };

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
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // ── Responsive layout state ───────────────────────────────────────────────
  const [isLandscape, setIsLandscape] = useState(window.innerWidth >= 768);
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
  const [items, setItems] = useState([]);
  const [removedItem, setRemovedItem] = useState(null);
  const [loadedTripId, setLoadedTripId] = useState(null);
  const [loadError, setLoadError] = useState('');

  // ── AI Panel state ────────────────────────────────────────────────────────
  const [showAiPanel, setShowAiPanel] = useState(() => searchParams.get('mode') === 'ai');
  const [aiStyle, setAiStyle] = useState('balanced');
  const [aiBudget, setAiBudget] = useState('mid');
  const [aiLoading, setAiLoading] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState(null);
  const [optimizationMessage, setOptimizationMessage] = useState('');
  const loading = authLoading || Boolean(user?.id && loadedTripId !== tripId);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Responsive resize listener ────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

        // Normalise: ItineraryMap uses item.lat / item.lng
        // Our DB returns item.latitude / item.longitude
        const normalised = (Array.isArray(rawItems) ? rawItems : []).map(i => ({
          ...i,
          lat: i.latitude,
          lng: i.longitude,
          title: i.place_name,
        }));
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

  // ── Drag and drop ─────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx).map((item, idx) => ({
      ...item, order_index: idx,
    }));
    setItems(reordered);
    try {
        await reorderTripItinerary(tripId, reordered.map(i => ({ id: i.id, dayIndex: i.day_index ?? 0, orderIndex: i.order_index })));
    } catch {
      setItems(items);
      toast.error('Failed to save order');
    }
  }, [items, tripId]);

  const handleAddPlace = useCallback(async (place, dayIndex) => {
    if (addingPlace) return;
    setAddingPlace(true);
    try {
      const orderIndex = items.filter(item => Number(item.day_index ?? 0) === dayIndex).length;
      const result = await addTripItineraryItem(tripId, {
        placeId: place.id,
        dayIndex,
        orderIndex,
        startTime: '09:00',
      });
      if (!result.success) throw new Error(result.error || 'Place could not be added.');

      const newItem = {
        id: result.id,
        place_id: place.id,
        place_name: place.name,
        title: place.name,
        category: place.category,
        google_place_id: place.google_place_id,
        latitude: place.latitude,
        longitude: place.longitude,
        lat: place.latitude,
        lng: place.longitude,
        day_index: dayIndex,
        order_index: orderIndex,
        start_time: '09:00',
      };
      setItems(current => [...current, newItem].sort((a, b) =>
        (a.day_index ?? 0) - (b.day_index ?? 0) || (a.order_index ?? 0) - (b.order_index ?? 0)
      ));
      toast.success(`${place.name} added to Day ${dayIndex + 1}`);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Place could not be added.');
    } finally {
      setAddingPlace(false);
    }
  }, [addingPlace, items, tripId]);

  const handleOptimizeDay = useCallback(async (dayIndex) => {
    setOptimizingDay(dayIndex);
    setOptimizationMessage('');
    try {
      const result = await optimizeTripItineraryDay(tripId, dayIndex);
      setItems(current => [
        ...current.filter(item => Number(item.day_index ?? 0) !== dayIndex),
        ...result.items,
      ].sort((a, b) =>
        (a.day_index ?? 0) - (b.day_index ?? 0) || (a.order_index ?? 0) - (b.order_index ?? 0)
      ));
      const message = result.source === 'google_routes'
        ? 'Stop order optimized with Google Maps route estimates.'
        : 'Stop order arranged by nearby locations. Add a server-side Google Routes key for drive-time estimates.';
      setOptimizationMessage(message);
      toast.success('Day route updated');
    } catch (error) {
      const message = error.response?.data?.error || 'This day could not be optimized.';
      setOptimizationMessage(message);
      toast.error(message);
    } finally {
      setOptimizingDay(null);
    }
  }, [tripId]);

  const handleSelectDay = useCallback((dayIndex) => {
    setSelectedDay(dayIndex);
    setSelectedItem(null);
    const firstStop = items.find(item => Number(item.day_index ?? 0) === dayIndex);
    if (firstStop && Number.isFinite(firstStop.lat) && Number.isFinite(firstStop.lng)) {
      setMapCenter({ lat: firstStop.lat, lng: firstStop.lng });
      setMapZoom(13);
    }
  }, [items]);

  const handleUpdateItem = useCallback(async (itemId, updates) => {
    try {
      const { item } = await updateTripItineraryItem(tripId, itemId, updates);
      setItems(current => current.map(existing => existing.id === itemId ? item : existing));
      setSelectedItem(current => current?.id === itemId ? item : current);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'The stop could not be updated.');
      return false;
    }
  }, [tripId]);

  const handleMoveItem = useCallback(async (itemId, dayIndex) => {
    const moving = items.find(item => item.id === itemId);
    if (!moving || Number(moving.day_index ?? 0) === dayIndex) return;
    const original = items;
    const targetOrder = items.filter(item => Number(item.day_index ?? 0) === dayIndex).length;
    const next = [...items.filter(item => item.id !== itemId), { ...moving, day_index: dayIndex, order_index: targetOrder }]
      .sort((left, right) => Number(left.day_index ?? 0) - Number(right.day_index ?? 0) || Number(left.order_index ?? 0) - Number(right.order_index ?? 0));
    const orderByDay = new Map();
    const reordered = next.map(item => {
      const day = Number(item.day_index ?? 0);
      const order = orderByDay.get(day) || 0;
      orderByDay.set(day, order + 1);
      return { ...item, order_index: order };
    });
    setItems(reordered);
    setSelectedDay(dayIndex);
    try {
      await reorderTripItinerary(tripId, reordered.map(item => ({ id: item.id, dayIndex: Number(item.day_index ?? 0), orderIndex: item.order_index })));
      toast.success(`Stop moved to Day ${dayIndex + 1}`);
    } catch (error) {
      setItems(original);
      toast.error(error.response?.data?.error || 'The stop could not be moved.');
    }
  }, [items, tripId]);

  const handleRemoveItem = useCallback(async (item) => {
    try {
      await deleteTripItineraryItem(tripId, item.id);
      setItems(current => current.filter(stop => stop.id !== item.id));
      setSelectedItem(current => current?.id === item.id ? null : current);
      setRemovedItem(item);
    } catch (error) {
      toast.error(error.response?.data?.error || 'The stop could not be removed.');
    }
  }, [tripId]);

  const handleUndoRemove = useCallback(async () => {
    if (!removedItem) return;
    try {
      const dayIndex = Number(removedItem.day_index ?? 0);
      const dayItems = items.filter(item => Number(item.day_index ?? 0) === dayIndex);
      const result = await addTripItineraryItem(tripId, {
        placeId: removedItem.place_id,
        dayIndex,
        orderIndex: Math.min(Number(removedItem.order_index ?? dayItems.length), dayItems.length),
        startTime: removedItem.start_time,
        endTime: removedItem.end_time,
        note: removedItem.note,
      });
      if (!result.success) throw new Error(result.error || 'The stop could not be restored.');
      const restored = { ...removedItem, id: result.id };
      setItems(current => [...current, restored].sort((left, right) => Number(left.day_index ?? 0) - Number(right.day_index ?? 0) || Number(left.order_index ?? 0) - Number(right.order_index ?? 0)));
      setSelectedDay(dayIndex);
      setRemovedItem(null);
      toast.success('Stop restored');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'The stop could not be restored.');
    }
  }, [items, removedItem, tripId]);

  const handleReplaceItem = useCallback(async (place, itemId) => {
    const saved = await handleUpdateItem(itemId, { placeId: place.id });
    if (saved) toast.success('Stop replaced');
    return saved;
  }, [handleUpdateItem]);

  // ── AI Draft ──────────────────────────────────────────────────────────────
  const handleGenerateAI = async () => {
    setAiLoading(true);
    try {
      const data = await generateTripItinerary(tripId, { style: aiStyle, budget: aiBudget });
      if (data.success) {
        const normalised = data.itinerary.map(i => ({
          ...i, lat: i.latitude, lng: i.longitude, title: i.place_name,
        }));
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
          <button onClick={() => navigate('/trips')} className="mt-5 rounded-full bg-btn-primary-bg px-5 py-2.5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover">Back to my trips</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MapWorkspaceLayout
        header={<div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate('/trips')} className="text-slate-500 hover:text-pine text-sm font-medium">
            ← Back
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-pine truncate">{trip?.title || 'Trip Planner'}</h1>
          {trip?.destination_name && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              📍 {trip.destination_name}
            </span>
          )}
        </div>}
        auxiliary={showAiPanel && <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#d3e8d8] bg-[#f1f8f3] p-4">
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
          </div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <ItinerarySidebar
                showList
                isLandscape={isLandscape}
                isItineraryExpanded={isItineraryExpanded}
                setIsItineraryExpanded={setIsItineraryExpanded}
                items={items}
                dayCount={Math.max(1, Math.round((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1)}
                destinationSlug={trip.destination_slug}
                onAddPlace={handleAddPlace}
                addingPlace={addingPlace}
                onOptimizeDay={handleOptimizeDay}
                optimizingDay={optimizingDay}
                optimizationMessage={optimizationMessage}
                setMapCenter={setMapCenter}
                setMapZoom={setMapZoom}
                setSelectedItem={setSelectedItem}
                setMobileView={setMobileView}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                onUpdateItem={handleUpdateItem}
                onMoveItem={handleMoveItem}
                onRemoveItem={handleRemoveItem}
                removedItem={removedItem}
                onUndoRemove={handleUndoRemove}
                onReplaceItem={handleReplaceItem}
              />
            </SortableContext>
          </DndContext>}
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
        sidebarExpanded={isItineraryExpanded}
      />
      <TripAiAssistant
        tripId={tripId}
        onItineraryUpdated={updatedItems => {
          const normalised = updatedItems.map(item => ({
            ...item,
            lat: item.latitude,
            lng: item.longitude,
            title: item.place_name,
          }));
          setItems(normalised);
          setSelectedDay(0);
          if (normalised[0]?.lat) setMapCenter({ lat: normalised[0].lat, lng: normalised[0].lng });
          setSelectedItem(null);
        }}
      />
    </>
  );
}
