import { useMapsLibrary } from '@vis.gl/react-google-maps';

function ItinerarySidebar({ 
  showList, isLandscape, isItineraryExpanded, setIsItineraryExpanded, 
  items, setMapCenter, setMapZoom, setSelectedItem, setMobileView 
}) {
  
  const placesLibrary = useMapsLibrary('places');

  const handleLocationClick = (item) => {
    if (!item.lat || !item.lng) return;

    setMapCenter({ lat: item.lat, lng: item.lng });
    setMapZoom(16);
    if (!isLandscape) setMobileView('map');

    // On-demand places lookup logic
    if (item.placeId && placesLibrary) {
      const service = new placesLibrary.PlacesService(document.createElement('div'));
      service.getDetails(
        {
          placeId: item.placeId,
          fields: ['name', 'formatted_address', 'wheelchair_accessible_entrance', 'editorial_summary', 'reviews', 'photos', 'opening_hours']
        },
        (place, status) => {
          if (status === placesLibrary.PlacesServiceStatus.OK && place) {
            setSelectedItem({
              ...item,
              title: place.name || item.title,
              address: place.formatted_address,
              accessible: place.wheelchair_accessible_entrance ? 'Accessible entrance' : null,
              about: place.editorial_summary?.overview,
              isOpen: place.opening_hours?.isOpen(),
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
              reviews: place.reviews ? place.reviews.slice(0, 2) : []
            });
          } else {
            setSelectedItem(item);
          }
        }
      );
    } else {
      setSelectedItem(item);
    }
  };

  return (
    <div className={`h-full overflow-y-auto p-6 flex flex-col justify-between transition-all duration-300 ease-in-out relative border-r border-slate-200
      ${showList ? 'flex' : 'hidden'}
      ${isLandscape ? (isItineraryExpanded ? 'w-[60%] lg:w-1/2' : 'w-16') : 'w-full'}`}
    >
      {isItineraryExpanded || !isLandscape ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Edit Your Itinerary</h2>
            {isLandscape && (
              <button
                onClick={() => setIsItineraryExpanded(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg transition"
              >
                Collapse List 📑
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-6">Plan your trip layout and track stops seamlessly.</p>
          
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <div 
                key={item.id} 
                onClick={() => handleLocationClick(item)}
                className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-md cursor-pointer transition"
              >
                <p className="font-semibold text-slate-700">{item.title}</p>
                <span className="inline-block mt-2 text-xs font-medium text-blue-600">🎯 View on Map</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div onClick={() => setIsItineraryExpanded(true)} className="absolute inset-0 bg-slate-900/5 cursor-pointer flex items-center justify-center hover:bg-slate-900/10 transition">
          <span className="transform -rotate-90 whitespace-nowrap tracking-wider font-bold text-slate-600 text-xs">EXPAND ITINERARY</span>
        </div>
      )}

      {(isItineraryExpanded || !isLandscape) && (
        <div className="p-4 bg-white border border-slate-100 rounded-xl text-center text-sm text-slate-400">
          Form Input Section
        </div>
      )}
    </div>
  );
}

export default ItinerarySidebar;
