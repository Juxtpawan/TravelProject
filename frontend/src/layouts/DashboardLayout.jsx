import { Outlet } from 'react-router-dom';
import Header from "../shared/components/header/Header.jsx"; // 1. IMPORT THE REAL HEADER

export default function DashboardLayout() {
  return (
    // Uses w-screen h-screen to stay edge-to-edge for interactive map apps
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-off-white">
      
      {/* 2. MOUNT THE REAL SITE HEADER */}
      <Header />

      {/* 3. Sub-header bar for your trip actions (Paris Summer Itinerary, Share, etc.) */}
      <div className="w-full h-12 bg-gray-100 border-b border-gray-200 px-4 flex items-center justify-between flex-shrink-0">
        <div className="font-semibold text-sm text-pine">Paris Summer Itinerary</div>
        <button className="bg-pine hover:bg-moss text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          Share Trip
        </button>
      </div>

      {/* Content wrapper taking up full viewport space */}
      <main className="flex-grow w-full flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
