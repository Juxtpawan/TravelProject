import { useState, useCallback } from 'react';
import { Map, Marker, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';
import { Layers } from 'lucide-react';
import { ENV } from '../../../config/env';


export default function InteractiveMap({
    workspaceClassName = '',
    id = 'interactive-map',
    mapId,
    showMap = true, mapCenter, setMapCenter,
    mapZoom, setMapZoom, children, userLocation, setUserLocation, overlayOpen = false
}) {
    const apiKey = ENV.GOOGLE_MAPS_KEY || '';
    const mapsStatus = useApiLoadingStatus();
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // 🟢 ADD THIS STATE TRACKER INSIDE YOUR ItineraryMap() FUNCTION
    const [mapType, setMapType] = useState('roadmap');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const locationPosition = overlayOpen ? 'bottom-[calc(38%_+_1.5rem)]' : 'bottom-6';


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

    return (
        <div className={`relative h-full min-h-0 min-w-0 w-full overflow-hidden rounded-lg border border-slate-200 transition-all duration-300 ease-in-out ${workspaceClassName} ${showMap ? 'block' : 'hidden'}`}
        >
            {apiKey ? (mapsStatus === APILoadingStatus.FAILED || mapsStatus === APILoadingStatus.AUTH_FAILURE ? (
                <div role="alert" className="grid h-full place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                    Google Maps could not load. Enable the Maps JavaScript API and allow localhost referrers for this key.
                </div>
            ) : (
                    <>
                        <Map
                            id={id}
                            mapId={mapId || ENV.GOOGLE_MAP_ID}
                            gestureHandling="greedy"
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
                            {children}
                            {userLocation && <Marker position={userLocation} icon={{
                                path: window.google?.maps?.SymbolPath?.CIRCLE,
                                scale: 8,
                                fillColor: '#3b82f6',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2,
                            }} />}
                        </Map>

                        {/* ⚡ CUSTOM FLOATING SELECT MAP DROPDOWN PANEL */}
                        <div className="absolute right-4 top-4 z-10 flex flex-col items-end">

                            {/* The Main "Select Map" Trigger Button */}
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-2 px-3 py-2 bg-white text-pine font-bold text-xs border border-slate-200 rounded-xl shadow-md hover:bg-slate-50 transition active:scale-95"
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


                        {/* Locate-me button stays bottom-right */}
                        <button
                            onClick={handleLocateMe}
                            disabled={locating}
                            aria-label="Use my current location"
                            className={`absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition-[bottom] duration-200 ${locationPosition}`}
                        >
                            {locating ? <span className="block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <span className="text-lg">📍</span>}
                        </button>

                        {locationError && (
                            <div className={`absolute right-4 z-10 max-w-[220px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 shadow ${overlayOpen ? 'bottom-[calc(38%_+_5rem)]' : 'bottom-20'}`}>
                                {locationError}
                            </div>
                        )}
                    </>
            )) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-red-500">Error: Key missing.</div>
            )}
        </div>
    );
}
