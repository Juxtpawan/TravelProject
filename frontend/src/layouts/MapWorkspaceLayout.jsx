import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Map as MapIcon, PanelLeftOpen } from 'lucide-react';
import './MapWorkspaceLayout.css';

/** Shared padded, responsive two-pane shell for itinerary and destination maps. */
export default function MapWorkspaceLayout({
  header,
  hero,
  sidebar,
  collapsedSidebar,
  map,
  auxiliary,
  mobileView = 'list',
  onToggleView,
  sidebarExpanded = true,
  onExpandSidebar,
  hideMobileHeader = false,
  collapsedHeaderOnly = false,
}) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 729);
  useEffect(() => {
    const updateViewport = () => setIsDesktop(window.innerWidth >= 729);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);
  const mobileHeaderIsHidden = hideMobileHeader && mobileView === 'map';
  const mobileRows = hero
    ? 'grid-rows-[auto] min-[729px]:grid-rows-[auto_auto]'
    : mobileHeaderIsHidden ? 'grid-rows-[minmax(0,1fr)]' : 'grid-rows-[auto_auto_minmax(0,1fr)]';
  const splitLayout = hero
    ? sidebarExpanded ? 'workspace-map-split' : 'min-[729px]:grid-cols-[4rem_minmax(0,1fr)]'
    : sidebarExpanded ? 'workspace-map-split' : 'min-[729px]:grid-cols-[4rem_minmax(0,1fr)]';
  const mobileToggle = onToggleView && <button
    type="button"
    onClick={onToggleView}
    aria-label={hideMobileHeader && mobileView === 'map' ? 'Back to list' : mobileView === 'list' ? 'Show map' : 'Show list'}
    className={hideMobileHeader
      ? `${mobileView === 'map' ? 'absolute' : 'fixed'} z-30 inline-flex min-h-10 items-center justify-center gap-1.5 bg-green hover:bg-green-medium text-xs font-bold text-pine shadow-md ring-1 ring-slate-200 min-[729px]:hidden ${mobileView === 'map' ? 'left-3 top-3 h-10 w-10 rounded-full' : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 rounded-lg px-3'}`
      : 'fixed z-30 bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-pine shadow-md ring-1 ring-slate-200 transition hover:bg-slate-200 min-[729px]:hidden'}
  >
    {hideMobileHeader && mobileView === 'map'
      ? <ArrowLeft size={18} />
      : mobileView === 'list' ? <><MapIcon size={15} />Map</> : <><BookOpen size={15} />List</>}
  </button>;

  return (
    <main className="workspace-pane-scroll relative h-full min-h-0 overflow-y-auto bg-[#f8f9fa] p-2 sm:p-3">
      <div className={`workspace-map-grid mx-auto grid min-h-full w-full max-w-[1600px] grid-cols-1 ${splitLayout} ${mobileRows} items-start gap-2 ${!hero ? 'min-[729px]:grid-rows-[auto_auto_minmax(0,1fr)]' : ''}`}>
        {hero && sidebarExpanded && <div className={`col-start-1 row-start-1 min-w-0 ${mobileView === 'map' ? 'hidden min-[729px]:block' : ''} min-[729px]:row-span-2`}>
          {hero}
          {auxiliary && <div className="mt-2">{auxiliary}</div>}
          {sidebar && <div className="min-w-0">{sidebar}</div>}
        </div>}
        {hero && !sidebarExpanded && <aside className="col-start-1 row-start-1 hidden w-16 self-stretch rounded-lg border border-slate-200 bg-white text-pine shadow-sm min-[729px]:row-span-2 min-[729px]:flex">
          {collapsedSidebar || <button type="button" onClick={onExpandSidebar} aria-label="Expand places panel" title="Expand places panel" className="flex h-full w-full items-center justify-center hover:bg-slate-50"><PanelLeftOpen size={18} /></button>}
        </aside>}
        {!hero && <header className={`${mobileHeaderIsHidden ? (sidebarExpanded ? 'hidden min-[729px]:flex' : 'hidden') : !sidebarExpanded ? 'flex min-[729px]:hidden' : 'flex'} col-start-1 row-start-1 min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 min-[729px]:col-start-1 min-[729px]:row-start-1 ${!sidebarExpanded && collapsedHeaderOnly ? 'min-[729px]:justify-center min-[729px]:px-1' : ''}`}>
          <div className="min-w-0 flex-1">{header}</div>
          {!hideMobileHeader && mobileToggle}
        </header>}

        {!hero && auxiliary && <div className="col-start-1 row-start-2 min-w-0 rounded-lg min-[729px]:col-start-1 min-[729px]:row-start-2">{auxiliary}</div>}

        {!hero && <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} ${mobileHeaderIsHidden ? 'row-start-1' : 'row-start-3'} min-w-0 min-[729px]:col-start-1 ${!sidebarExpanded ? 'min-[729px]:row-start-1 min-[729px]:row-span-3' : 'min-[729px]:row-start-3'} min-[729px]:flex`}>
          {sidebar}
        </div>}

        <div className={`sticky top-0 h-[calc(100dvh-1rem)] min-h-0 min-w-0 overflow-hidden ${mobileView === 'map' ? 'block' : 'hidden'} ${hero ? 'row-start-1' : mobileHeaderIsHidden ? 'row-start-1' : 'row-start-3'} min-[729px]:col-start-2 min-[729px]:block ${hero ? 'min-[729px]:row-start-1 min-[729px]:row-span-2' : 'min-[729px]:row-start-1 min-[729px]:row-span-3'}`}>
          {(isDesktop || mobileView === 'map') && map}
        </div>
      </div>
      {hideMobileHeader && mobileToggle}
    </main>
  );
}
