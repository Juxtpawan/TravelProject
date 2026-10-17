import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ENV } from '../config/env';
import { detectCountryCode } from '../shared/utils/country';

const MAP_LIBRARIES = ['places'];
const handleMapsError = error => console.error('[Maps] Google Maps JavaScript API could not load:', error);

export default function DashboardLayout() {
  const [region, setRegion] = useState(null);
  const [regionDetected, setRegionDetected] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    detectCountryCode({ signal: controller.signal })
      .then(countryCode => {
        if (countryCode) setRegion(countryCode);
      })
      .finally(() => {
        if (isMounted) setRegionDetected(true);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  if (!regionDetected) return null;

  return (
    <APIProvider
      apiKey={ENV.GOOGLE_MAPS_KEY || ''}
      libraries={MAP_LIBRARIES}
      region={region || undefined}
      onError={handleMapsError}
    >
      <div className="h-dvh w-full overflow-hidden bg-[#f7f9f7]">
        <main className="h-full w-full overflow-hidden"><Outlet /></main>
      </div>
    </APIProvider>
  );
}
