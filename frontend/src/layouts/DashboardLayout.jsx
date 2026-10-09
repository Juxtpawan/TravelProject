import { Outlet } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ENV } from '../config/env';

const MAP_LIBRARIES = ['places'];
const handleMapsError = error => console.error('[Maps] Google Maps JavaScript API could not load:', error);

export default function DashboardLayout() {
  return (
    <APIProvider
      apiKey={ENV.GOOGLE_MAPS_KEY || ''}
      libraries={MAP_LIBRARIES}
      onError={handleMapsError}
    >
      <div className="h-dvh w-full overflow-hidden bg-[#f7f9f7]">
        <main className="h-full w-full overflow-hidden"><Outlet /></main>
      </div>
    </APIProvider>
  );
}
