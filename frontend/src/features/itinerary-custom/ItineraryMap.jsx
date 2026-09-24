import { useState, useCallback } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { Layers } from 'lucide-react';


function ItineraryMap({
    showMap, isLandscape, isItineraryExpanded, mapCenter, setMapCenter,
    mapZoom, setMapZoom, items, selectedItem, setSelectedItem, userLocation, setUserLocation
}) {
    const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // 🟢 ADD THIS STATE TRACKER INSIDE YOUR ItineraryMap() FUNCTION
    const [mapType, setMapType] = useState('roadmap');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);


    const MIN_ZOOM = 3;
    const MAX_ZOOM = 20;

    const handleLocateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by this browser.');
            return;
        }
        setLocating(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(coords);
                setMapCenter(coords);
                setMapZoom(14);
                setLocating(false);
            },
            (error) => {
                // 🟢 Report the real reason instead of one generic message —
                // on laptops this is almost always POSITION_UNAVAILABLE (no GPS,
                // relies on Wi-Fi/IP triangulation via OS location services).
                console.log('Geolocation error code:', error.code, error.message);
                let message;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied. Check your browser site settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Position unavailable — check Location Services is on for this device.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Try again.';
                        break;
                    default:
                        message = 'Unable to fetch your location.';
                }
                setLocationError(message);
                setLocating(false);
            },
            // 🟢 enableHighAccuracy:false — laptops rarely have GPS, so "high accuracy"
            // just makes it try harder (and slower) for no gain. Longer timeout too.
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
    }, [setMapCenter, setMapZoom, setUserLocation]);

    // 🔍 Zoom handlers — clamp to sane bounds so buttons can't push past Google's own limits
    const handleZoomIn = useCallback(() => {
        setMapZoom((z) => Math.min(z + 1, MAX_ZOOM));
    }, [setMapZoom]);

    const handleZoomOut = useCallback(() => {
        setMapZoom((z) => Math.max(z - 1, MIN_ZOOM));
    }, [setMapZoom]);

    return (
        <div className={`h-full relative transition-all duration-300 ease-in-out
      ${showMap ? 'block' : 'hidden'}
      ${isLandscape ? (isItineraryExpanded ? 'w-[40%] lg:w-1/2' : 'w-[calc(100%-4rem)]') : 'w-full'}`}
        >
            {apiKey ? (
                <APIProvider apiKey={apiKey} libraries={['places']}>
                    <>
                        <Map
                            zoom={mapZoom}
                            center={mapCenter}
                            onCenterChanged={(e) => setMapCenter(e.detail.center)}
                            // 🟢 Sync manual pinch/scroll zoom back into state, so the
                            // +/- buttons stay accurate after the user zooms by other means
                            onZoomChanged={(e) => setMapZoom(e.detail.zoom)}
                            className="w-full h-full"
                            streetViewControl={false}
                            mapTypeControl={false}
                            fullscreenControl={false}
                            zoomControl={false} // 🚫 hide Google's default zoom UI since we have our own

                            cameraControl={false}
                            mapTypeId={mapType}
                        >
                            {items.map((item) => (
                                <Marker key={item.id} position={{ lat: item.lat, lng: item.lng }} />
                            ))}

                            {userLocation && (
                                <Marker
                                    position={userLocation}
                                    icon={{
                                        path: window.google?.maps?.SymbolPath?.CIRCLE,
                                        scale: 8,
                                        fillColor: '#3b82f6',
                                        fillOpacity: 1,
                                        strokeColor: '#ffffff',
                                        strokeWeight: 2,
                                    }}
                                />
                            )}
                        </Map>

                        {/* ⚡ CUSTOM FLOATING SELECT MAP DROPDOWN PANEL */}
                        <div className="absolute top-4 right-4 z-50 flex flex-col items-end">

                            {/* The Main "Select Map" Trigger Button */}
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-2 px-3 py-2 bg-white text-slate-800 font-bold text-xs border border-slate-200 rounded-xl shadow-md hover:bg-slate-50 transition active:scale-95"
                            >
                                <Layers size={14} className="text-slate-600" />
                                <span>Select Map</span>
                            </button>

                            {/* The Collapsible Dropdown Menu (Only opens if isDropdownOpen is true) */}
                            {isDropdownOpen && (
                                <div className="mt-2 w-32 bg-white/95 backdrop-blur-md p-1.5 border border-slate-200 rounded-xl shadow-xl flex flex-col gap-1 transition-all">
                                    <button
                                        onClick={() => { setMapType('roadmap'); setIsDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'roadmap' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        🗺️ Standard Map
                                    </button>

                                    <button
                                        onClick={() => { setMapType('satellite'); setIsDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'satellite' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        🛰️ Satellite
                                    </button>

                                    <button
                                        onClick={() => { setMapType('terrain'); setIsDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'terrain' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        ⛰️ Terrain
                                    </button>
                                </div>
                            )}
                        </div>


                        {/* 🟢 CUSTOM ZOOM CONTROLS: bottom-left, stacked +/- */}
                        <div className="absolute bottom-6 left-4 z-10 flex flex-col rounded-lg shadow-lg border border-slate-200 overflow-hidden bg-white">
                            <button
                                onClick={handleZoomIn}
                                disabled={mapZoom >= MAX_ZOOM}
                                aria-label="Zoom in"
                                className="w-9 h-9 flex items-center justify-center text-lg font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed border-b border-slate-200"
                            >
                                +
                            </button>
                            <button
                                onClick={handleZoomOut}
                                disabled={mapZoom <= MIN_ZOOM}
                                aria-label="Zoom out"
                                className="w-9 h-9 flex items-center justify-center text-lg font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                −
                            </button>
                        </div>

                        {/* Locate-me button stays bottom-right */}
                        <button
                            onClick={handleLocateMe}
                            disabled={locating}
                            aria-label="Use my current location"
                            className="absolute bottom-6 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-200"
                        >
                            {locating ? <span className="block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <span className="text-lg">📍</span>}
                        </button>

                        {locationError && (
                            <div className="absolute bottom-20 right-4 z-10 max-w-[220px] px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 shadow">
                                {locationError}
                            </div>
                        )}
                    </>
                </APIProvider>
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-red-500">Error: Key missing.</div>
            )}
        </div>
    );
}

export default ItineraryMap;