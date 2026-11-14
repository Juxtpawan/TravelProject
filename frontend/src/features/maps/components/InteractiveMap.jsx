import { useState, useCallback, useRef, useEffect } from 'react';
import { Map, AdvancedMarker, useMap, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';
import { Layers } from 'lucide-react';
import { ENV } from '../../../config/env';

/**
 * Handles smooth programmatic camera adjustments (e.g. locate-me, clicking place cards)
 * without entering a 60fps React state feedback-loop during user drag operations.
 */
function MapCameraController({ center, zoom, lastReportedCenterRef, lastReportedZoomRef }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !center) return;
        const last = lastReportedCenterRef.current;
        const latDiff = last ? Math.abs(last.lat - center.lat) : 1;
        const lngDiff = last ? Math.abs(last.lng - center.lng) : 1;
        // Only pan if changed programmatically (greater than a tiny drift threshold)
        if (latDiff > 0.00005 || lngDiff > 0.00005) {
            lastReportedCenterRef.current = center;
            map.panTo(center);
        }
    }, [map, center, lastReportedCenterRef]);

    useEffect(() => {
        if (!map || typeof zoom !== 'number') return;
        if (lastReportedZoomRef.current !== zoom) {
            lastReportedZoomRef.current = zoom;
            map.setZoom(zoom);
        }
    }, [map, zoom, lastReportedZoomRef]);

    return null;
}

export default function InteractiveMap({
    workspaceClassName = '',
    id = 'interactive-map',
    mapId,
    showMap = true,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    children,
    userLocation,
    setUserLocation,
    overlayOpen = false,
    gestureHandling = 'greedy'
}) {
    const apiKey = ENV.GOOGLE_MAPS_KEY || '';
    const mapsStatus = useApiLoadingStatus();
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const [mapType, setMapType] = useState('roadmap');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const locationPosition = overlayOpen ? 'bottom-[calc(38%_+_1.5rem)]' : 'bottom-6';

    const lastReportedCenterRef = useRef(mapCenter);
    const lastReportedZoomRef = useRef(mapZoom);

    // Sync state only when map interactions settle (idle), preventing lag & marker jitter during drags
    const handleIdle = useCallback((event) => {
        const map = event.map;
        if (!map) return;
        const c = map.getCenter();
        const z = map.getZoom();
        if (c && setMapCenter) {
            const nextCenter = { lat: c.lat(), lng: c.lng() };
            lastReportedCenterRef.current = nextCenter;
            setMapCenter(nextCenter);
        }
        if (typeof z === 'number' && setMapZoom) {
            lastReportedZoomRef.current = z;
            setMapZoom(z);
        }
    }, [setMapCenter, setMapZoom]);

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
                if (setUserLocation) setUserLocation(coords);
                if (setMapCenter) setMapCenter(coords);
                if (setMapZoom) setMapZoom(14);
                setLocating(false);
            },
            (error) => {
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
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
    }, [setMapCenter, setMapZoom, setUserLocation]);

    return (
        <div className={`relative h-full min-h-0 min-w-0 w-full overflow-hidden rounded-lg border border-slate-200 ${workspaceClassName} ${showMap ? 'block' : 'hidden'}`}>
            {apiKey ? (mapsStatus === APILoadingStatus.FAILED || mapsStatus === APILoadingStatus.AUTH_FAILURE ? (
                <div role="alert" className="grid h-full place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                    Google Maps could not load. Enable the Maps JavaScript API and allow localhost referrers for this key.
                </div>
            ) : (
                <>
                    <Map
                        id={id}
                        mapId={mapId || ENV.GOOGLE_MAP_ID}
                        gestureHandling={gestureHandling}
                        defaultZoom={mapZoom}
                        defaultCenter={mapCenter}
                        onIdle={handleIdle}
                        draggableCursor="grab"
                        draggingCursor="grabbing"
                        className="w-full h-full"
                        streetViewControl={false}
                        mapTypeControl={false}
                        fullscreenControl={false}
                        zoomControl={false}
                        cameraControl={false}
                        mapTypeId={mapType}
                    >
                        <MapCameraController
                            center={mapCenter}
                            zoom={mapZoom}
                            lastReportedCenterRef={lastReportedCenterRef}
                            lastReportedZoomRef={lastReportedZoomRef}
                        />
                        {children}
                        {userLocation && (
                            <AdvancedMarker position={userLocation} title="Your Location">
                                <div className="relative flex items-center justify-center">
                                    <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-400 opacity-60" />
                                    <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-md" />
                                </div>
                            </AdvancedMarker>
                        )}
                    </Map>

                    {/* ⚡ CUSTOM FLOATING SELECT MAP DROPDOWN PANEL */}
                    <div className="absolute right-4 top-4 z-10 flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={isDropdownOpen}
                                onClick={() => setIsDropdownOpen((open) => !open)}
                                className="flex min-h-9 items-center gap-2 rounded-full border border-green-medium bg-white px-3 py-2 text-xs font-bold text-green-ink shadow-md transition hover:bg-badge-bg active:scale-95"
                            >
                                <Layers size={14} className="text-slate-600" />
                                <span>Select Map</span>
                            </button>
                        </div>

                        {/* Collapsible Dropdown Menu */}
                        {isDropdownOpen && (
                            <div role="menu" className="mt-2 w-32 bg-white/95 backdrop-blur-md p-1.5 border border-slate-200 rounded-xl shadow-xl flex flex-col gap-1 transition-all">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { setMapType('roadmap'); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'roadmap' ? 'bg-btn-primary-bg text-btn-primary-text shadow-sm hover:bg-btn-primary-bg-hover' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    🗺️ Standard Map
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { setMapType('satellite'); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'satellite' ? 'bg-btn-primary-bg text-btn-primary-text shadow-sm hover:bg-btn-primary-bg-hover' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    🛰️ Satellite
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { setMapType('terrain'); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${mapType === 'terrain' ? 'bg-btn-primary-bg text-btn-primary-text shadow-sm hover:bg-btn-primary-bg-hover' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    ⛰️ Terrain
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Locate-me button */}
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
