import { Outlet } from 'react-router-dom'; // Or whatever routing mechanism you mount
import Header from "../shared/components/header/Header.jsx"

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-off-white text-pine flex flex-col">
      {/* Structural full-bleed header background */}
      <Header/>

      {/* Main body content restricted and centered automatically */}
      <main className="app-container flex-grow py-6 md:py-8">
        <Outlet /> 
      </main>

      {/* Optional full-bleed footer background with constrained content */}
      <footer className="w-full bg-gray border-t border-gray-100 py-6 mt-auto">
        <div className="app-container text-sm text-gray-500">
          © {new Date().getFullYear()} TravelProject. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
