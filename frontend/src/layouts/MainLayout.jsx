import { Outlet, useLocation } from 'react-router-dom';
import Header from "../shared/components/header/Header.jsx"
import ProjectName from "../shared/components/project-name/ProjectName.jsx"

export default function MainLayout() {
  const { pathname } = useLocation();
  const isAiPlanner = pathname === '/ai';
  const isTripWorkspace = /^\/trips\/[^/]+$/.test(pathname);

  return (
    <div className="flex h-screen h-dvh flex-col overflow-hidden bg-bg-page text-text-primary">
      <div className="z-50 shrink-0"><Header key={pathname} /></div>
      <main className={`w-full min-h-0 flex-1 ${isAiPlanner ? 'overflow-hidden' : 'app-scrollbar touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain'}`}>
        <div className={isAiPlanner || isTripWorkspace ? 'h-full min-h-0 flex flex-col' : 'flex min-h-full flex-col'}>
          <Outlet />
          {!isAiPlanner && <footer className="mt-auto border-t border-[#e5eae6] bg-white py-6">
            <div className="app-container flex flex-col gap-2 text-sm text-[#718077] sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">© {new Date().getFullYear()} <ProjectName className="text-pine" /></span>
              <span>Find your next favorite place.</span>
            </div>
          </footer>}
        </div>
      </main>
    </div>
  );
}
