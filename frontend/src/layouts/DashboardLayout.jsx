import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Compass } from 'lucide-react';
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
      .catch(() => {})
      .finally(() => {
        if (isMounted) setRegionDetected(true);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  if (!regionDetected) {
    return (
      <main className="grid h-dvh place-items-center bg-bg-page px-4 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-badge-bg text-green-ink shadow-sm"><Compass size={23} /></span>
          <span aria-hidden="true" className="mx-auto mt-4 block h-5 w-5 animate-spin rounded-full border-2 border-[#dce8e1] border-t-green-medium" />
          <p className="mt-3 text-sm font-semibold text-pine">Getting your map ready…</p>
          <p className="mt-1 text-xs text-text-secondary">Your trip is loading.</p>
        </div>
      </main>
    );
  }

  return (
    <APIProvider
      apiKey={ENV.GOOGLE_MAPS_KEY || ''}
      libraries={MAP_LIBRARIES}
      region={region || undefined}
      onError={handleMapsError}
    >
      <div className="h-dvh w-full overflow-hidden bg-bg-page">
        <main className="h-full w-full overflow-hidden"><Outlet /></main>
      </div>
    </APIProvider>
  );
}
