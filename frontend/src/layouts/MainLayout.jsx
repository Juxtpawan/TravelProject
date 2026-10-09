import { Outlet, useLocation } from 'react-router-dom';
import Header from "../shared/components/header/Header.jsx"

export default function MainLayout() {
  const { pathname } = useLocation();
  const isAiPlanner = pathname === '/ai';

  return (
    <div className={`flex flex-col bg-[#f7f9f7] text-pine ${isAiPlanner ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      <Header />
      <main className={`w-full flex-1 ${isAiPlanner ? 'min-h-0 overflow-hidden' : ''}`}>
        <Outlet />
      </main>
      {!isAiPlanner && <footer className="mt-auto border-t border-[#e5eae6] bg-white py-6">
        <div className="app-container flex flex-col gap-2 text-sm text-[#718077] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} TravelProject</span>
          <span>Find your next favorite place.</span>
        </div>
      </footer>}
    </div>
  );
}
