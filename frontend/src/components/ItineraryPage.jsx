import { useState, useEffect } from 'react';
import ItinerarySidebar from '../custom-itinerary/ItinerarySidebar';
import ItineraryMap from '../custom-itinerary/ItineraryMap';

function ItineraryPage() {
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(true);
  const [mobileView, setMobileView] = useState('list');
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : true
  );

  // Shared Map & Location States
  const [items, setItems] = useState([
    { id: 1, title: "Day 1: Central Park Walk", placeId: "ChIJ4zGv7yVZwokRl640HGJ5X2o", lat: 40.7851, lng: -73.9683 },
    { id: 2, title: "Day 2: Dyker Heights Christmas Lights", placeId: "ChIJa_cDuK5FwokR-VerysXOFVU", lat: 40.6190, lng: -74.0064 }
  ]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [mapZoom, setMapZoom] = useState(11);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handleChange = (e) => setIsLandscape(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const showList = isLandscape || mobileView === 'list';
  const showMap = isLandscape || mobileView === 'map';

  return (
    <div className="flex flex-col landscape:flex-row h-dvh w-full overflow-hidden bg-slate-50 relative">
      
      {/* LEFT COLUMN: Sidebar (Takes props to render list items) */}
      <ItinerarySidebar 
        showList={showList}
        isLandscape={isLandscape}
        isItineraryExpanded={isItineraryExpanded}
        setIsItineraryExpanded={setIsItineraryExpanded}
        items={items}
        setItems={setItems}
        setMapCenter={setMapCenter}
        setMapZoom={setMapZoom}
        setSelectedItem={setSelectedItem}
        setMobileView={setMobileView}
      />

      {/* RIGHT COLUMN: Google Map canvas layout */}
      <ItineraryMap 
        showMap={showMap}
        isLandscape={isLandscape}
        isItineraryExpanded={isItineraryExpanded}
        mapCenter={mapCenter}
        setMapCenter={setMapCenter}
        mapZoom={mapZoom}
        setMapZoom={setMapZoom}
        items={items}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        isLandscapeView={isLandscape}
        setMobileView={setMobileView}
      />

      {/* MOBILE TRIGGER SWITCH BUTTON */}
      {!isLandscape && (
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
            className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-full shadow-xl"
          >
            {mobileView === 'list' ? '🗺️ Show Map' : '🗒️ Show List'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ItineraryPage;
