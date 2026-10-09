import { useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, InfoWindow, Map, useApiLoadingStatus, useMap, APILoadingStatus } from '@vis.gl/react-google-maps';
import { ENV } from '../config/env';

const DEFAULT_CENTER = { lat: 32.2432, lng: 77.1892 };

function FitMapToItems({ items }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !items.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    items.forEach(item => bounds.extend({ lat: Number(item.latitude), lng: Number(item.longitude) }));
    if (items.length === 1) {
      map.setCenter({ lat: Number(items[0].latitude), lng: Number(items[0].longitude) });
      map.setZoom(13);
    } else {
      map.fitBounds(bounds, 72);
    }
  }, [map, items]);

  return null;
}

export default function MapView({ items = [] }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const status = useApiLoadingStatus();
  const locatedItems = useMemo(() => items.filter(item => Number.isFinite(Number(item.latitude))
    && Number.isFinite(Number(item.longitude)) && Number(item.latitude) !== 0 && Number(item.longitude) !== 0), [items]);
  const center = locatedItems[0]
    ? { lat: Number(locatedItems[0].latitude), lng: Number(locatedItems[0].longitude) }
    : DEFAULT_CENTER;

  if (!ENV.GOOGLE_MAPS_KEY) {
    return <div className="grid h-full min-h-64 place-items-center bg-slate-100 p-6 text-center text-sm text-slate-600">Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local to enable the map.</div>;
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <div role="alert" className="grid h-full min-h-64 place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">Google Maps could not load. Check that the Maps JavaScript API is enabled and that this key allows localhost referrers.</div>;
  }

  return (
    <Map
      mapId={ENV.GOOGLE_MAP_ID}
      defaultCenter={center}
      defaultZoom={12}
      gestureHandling="greedy"
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      className="h-full w-full"
    >
      <FitMapToItems items={locatedItems} />
      {locatedItems.map((item, index) => (
        <AdvancedMarker
          key={item.id}
          position={{ lat: Number(item.latitude), lng: Number(item.longitude) }}
          title={item.place_name}
          onClick={() => setSelectedItem(item)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-pine text-xs font-bold text-white shadow-lg">{index + 1}</span>
        </AdvancedMarker>
      ))}
      {selectedItem && (
        <InfoWindow
          position={{ lat: Number(selectedItem.latitude), lng: Number(selectedItem.longitude) }}
          onCloseClick={() => setSelectedItem(null)}
        >
          <div className="max-w-52 p-1">
            <p className="text-sm font-bold text-pine">{selectedItem.place_name}</p>
            {selectedItem.category && <p className="mt-1 text-xs capitalize text-slate-500">{selectedItem.category}</p>}
            {selectedItem.start_time && <p className="mt-1 text-xs text-slate-600">{selectedItem.start_time}</p>}
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}
