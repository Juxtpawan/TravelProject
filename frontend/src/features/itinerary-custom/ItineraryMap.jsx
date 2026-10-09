import { InfoWindow } from '@vis.gl/react-google-maps';
import { InteractiveMap, NumberedPlaceMarker } from '../maps';

const markerCategory = (value = '') => {
  const category = String(value).toLowerCase();
  if (/hotel|lodging|accommodation|stay/.test(category)) return { color: '#3972c6', border: '#24549d', title: 'Hotel' };
  if (/restaurant|food|dining|cafe|bar/.test(category)) return { color: '#e46432', border: '#b84620', title: 'Restaurant' };
  if (/experience|activity|tour/.test(category)) return { color: '#7955bf', border: '#59399a', title: 'Experience' };
  return { color: 'var(--color-green-medium)', border: 'var(--color-pine)', title: 'Place to visit' };
};

/** Itinerary-specific markers rendered inside the shared interactive map. */
export default function ItineraryMap({
  showMap,
  mapCenter,
  setMapCenter,
  mapZoom,
  setMapZoom,
  items,
  selectedItem,
  setSelectedItem,
  userLocation,
  setUserLocation,
}) {
  const mappableItems = items
    .filter((item) => item.lat != null && item.lng != null && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .sort((left, right) => Number(left.order_index ?? 0) - Number(right.order_index ?? 0));

  return (
    <InteractiveMap
      showMap={showMap}
      mapCenter={mapCenter}
      setMapCenter={setMapCenter}
      mapZoom={mapZoom}
      setMapZoom={setMapZoom}
      userLocation={userLocation}
      setUserLocation={setUserLocation}
    >
      {mappableItems.map((item, index) => {
        const category = markerCategory(item.category || item.type);
        return <NumberedPlaceMarker
          key={item.id}
          position={{ lat: Number(item.lat), lng: Number(item.lng) }}
          title={item.title || item.place_name}
          number={index + 1}
          category={category}
          selected={selectedItem?.id === item.id}
          onClick={() => setSelectedItem(item)}
        />;
      })}
      {selectedItem && Number.isFinite(Number(selectedItem.lat)) && Number.isFinite(Number(selectedItem.lng)) && <InfoWindow
        position={{ lat: Number(selectedItem.lat), lng: Number(selectedItem.lng) }}
        onCloseClick={() => setSelectedItem(null)}
      >
        <div className="max-w-48 p-1">
          <p className="font-bold text-pine">{selectedItem.title || selectedItem.place_name}</p>
        </div>
      </InfoWindow>}
    </InteractiveMap>
  );
}
