import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Map as MapIcon, PanelLeftOpen } from 'lucide-react';
import './MapWorkspaceLayout.css';

/** Shared responsive two-pane shell for itinerary and destination maps. */
export default function MapWorkspaceLayout({
  header,
  headerBackdrop,
  hero,
  stickyHeader,
  stickyNav = false,
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
  scrollHeaderWithSidebar = false,
  flush = false,
  onScroll,
}) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 729);
  const [tripNavTarget, setTripNavTarget] = useState(null);
  const listPanelRef = useRef(null);
  const listContentRef = useRef(null);
  const listScrollbarRef = useRef(null);
  const [listScrollSize, setListScrollSize] = useState({ content: 0, viewport: 0 });
  const assignTripNavTarget = useCallback(node => setTripNavTarget(node), []);
  const hasHero = Boolean(hero);
  useEffect(() => {
    const updateViewport = () => setIsDesktop(window.innerWidth >= 729);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);
  useEffect(() => {
    if ((!hasHero && !scrollHeaderWithSidebar) || !sidebarExpanded) {
      setListScrollSize({ content: 0, viewport: 0 });
      return undefined;
    }
    const panel = listPanelRef.current;
    const content = listContentRef.current;
    if (!panel || !content) return undefined;
    const measure = () => setListScrollSize({ content: content.scrollHeight, viewport: panel.clientHeight });
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(panel);
    observer?.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [hasHero, scrollHeaderWithSidebar, sidebarExpanded]);
  const syncScrollbarFromList = useCallback(event => {
    const scrollbar = listScrollbarRef.current;
    if (scrollbar && Math.abs(scrollbar.scrollTop - event.currentTarget.scrollTop) > 1) {
      scrollbar.scrollTop = event.currentTarget.scrollTop;
    }
  }, []);
  const syncListFromScrollbar = useCallback(event => {
    const panel = listPanelRef.current;
    if (panel && Math.abs(panel.scrollTop - event.currentTarget.scrollTop) > 1) {
      panel.scrollTop = event.currentTarget.scrollTop;
    }
  }, []);
  const mobileHeaderIsHidden = hideMobileHeader && mobileView === 'map';
  const mobileRows = hero
    ? 'grid-rows-[minmax(0,1fr)] min-[729px]:grid-rows-[minmax(0,1fr)]'
    : mobileHeaderIsHidden ? 'grid-rows-[minmax(0,1fr)]' : stickyNav && sidebarExpanded ? 'grid-rows-[auto_auto_auto_minmax(0,1fr)]' : 'grid-rows-[auto_auto_minmax(0,1fr)]';
  const splitLayout = hero
    ? sidebarExpanded ? 'workspace-map-split' : 'min-[729px]:grid-cols-[4rem_minmax(0,1fr)]'
    : sidebarExpanded ? 'workspace-map-split' : 'min-[729px]:grid-cols-[4rem_minmax(0,1fr)]';
  const gridGap = flush ? 'gap-0' : 'gap-2';
  const sidebarContent = stickyNav && isValidElement(sidebar) && typeof sidebar.type === 'function'
    ? cloneElement(sidebar, { tripNavTarget })
    : sidebar;
  const workspaceHeader = !hero && <header className={`${mobileHeaderIsHidden ? (sidebarExpanded ? 'hidden min-[729px]:flex' : 'hidden') : !sidebarExpanded ? 'flex min-[729px]:hidden' : 'flex'} relative min-h-28 min-w-0 shrink-0 items-center justify-between gap-3 overflow-hidden ${flush ? (headerBackdrop ? 'border-0' : 'border-x border-t border-b-0') : 'border'} border-[#cfe0d2] bg-[#e2efe4] px-2 py-2 min-[430px]:px-3 min-[430px]:py-3 ${flush && headerBackdrop ? 'shadow-none' : 'shadow-sm'} sm:px-4 min-[729px]:col-start-1 min-[729px]:row-start-1 ${!sidebarExpanded && collapsedHeaderOnly ? 'min-[729px]:justify-center min-[729px]:px-1' : ''}`}>
    {headerBackdrop && <div aria-hidden="true" className="absolute inset-0 z-0">{headerBackdrop}</div>}
    <div className="relative z-10 min-w-0 flex-1">{header}</div>
    {!hideMobileHeader && mobileToggle}
  </header>;
  const workspaceAuxiliary = !hero && auxiliary && <div className="shrink-0 min-w-0 min-[729px]:col-start-1 min-[729px]:row-start-2">{auxiliary}</div>;
  const workspaceNavTarget = !hero && stickyNav && <div ref={assignTripNavTarget} id="trip-section-nav-target" className={`${mobileView === 'list' && sidebarExpanded ? 'block mb-2' : 'hidden'} sticky top-0 z-40 w-full min-w-0 shrink-0 ${sidebarExpanded ? 'min-[729px]:row-start-3' : 'min-[729px]:hidden'}`} />;
  const workspaceSidebar = !hero && <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} ${mobileHeaderIsHidden ? 'row-start-1' : stickyNav && sidebarExpanded ? 'row-start-4' : 'row-start-3'} min-w-0 min-[729px]:col-start-1 ${!sidebarExpanded ? 'min-[729px]:row-start-1 min-[729px]:row-span-3 min-[729px]:self-stretch' : stickyNav ? 'min-[729px]:row-start-4' : 'min-[729px]:row-start-3'} min-[729px]:flex`}>{sidebarContent}</div>;
  const mobileToggle = onToggleView && <button
    type="button"
    onClick={onToggleView}
    aria-label={hideMobileHeader && mobileView === 'map' ? 'Back to list' : mobileView === 'list' ? 'Show map' : 'Show list'}
    className={hideMobileHeader
      ? mobileView === 'map'
        ? 'absolute left-3 top-3 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#dce4de] bg-white text-pine shadow-md transition hover:bg-[#f7faf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine min-[729px]:hidden'
        : 'fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-30 inline-flex min-h-10 -translate-x-1/2 items-center justify-center gap-1.5 rounded-lg bg-btn-primary-bg px-3 text-xs font-bold text-btn-primary-text shadow-md ring-1 ring-slate-200 hover:bg-btn-primary-bg-hover min-[729px]:hidden'
      : 'fixed z-30 bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-pine shadow-md ring-1 ring-slate-200 transition hover:bg-slate-200 min-[729px]:hidden'}
  >
    {hideMobileHeader && mobileView === 'map'
      ? <ArrowLeft size={18} />
      : mobileView === 'list' ? <><MapIcon size={15} />Map</> : <><BookOpen size={15} />List</>}
  </button>;

  return (
    <main onScroll={hero ? undefined : onScroll} className={`workspace-pane-scroll relative h-full min-h-0 overflow-hidden bg-[#f8f9fa] ${flush ? 'p-0' : 'p-1 sm:p-2'}`}>
      <div className={`workspace-map-grid relative mx-auto grid h-full min-h-0 w-full max-w-[1600px] grid-cols-1 ${splitLayout} ${mobileRows} items-start ${gridGap} ${!hero ? stickyNav && sidebarExpanded ? 'min-[729px]:grid-rows-[auto_auto_auto_minmax(0,1fr)]' : 'min-[729px]:grid-rows-[auto_auto_minmax(0,1fr)]' : ''}`}>
        {hero && sidebarExpanded && <div ref={listPanelRef} onScroll={syncScrollbarFromList} role="region" aria-label="Destination guide list" tabIndex={0} className={`app-scrollbar-hidden col-start-1 row-start-1 h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain ${mobileView === 'map' ? 'hidden min-[729px]:block' : ''}`}>
          <div ref={listContentRef} className="min-w-0">
            {stickyHeader && <div className="relative z-40">{stickyHeader}</div>}
            {hero}
            {auxiliary && <div className="mt-2">{auxiliary}</div>}
            {sidebar && <div className="min-w-0">{sidebar}</div>}
          </div>
        </div>}
        {hero && !sidebarExpanded && <aside className="col-start-1 row-start-1 hidden h-full w-16 self-stretch rounded-lg border border-slate-200 bg-white text-pine shadow-sm min-[729px]:flex">
          {collapsedSidebar || <button type="button" onClick={onExpandSidebar} aria-label="Expand places panel" title="Expand places panel" className="flex h-full w-full items-center justify-center hover:bg-slate-50"><PanelLeftOpen size={18} /></button>}
        </aside>}
        {!hero && scrollHeaderWithSidebar ? (
          <section ref={listPanelRef} onScroll={syncScrollbarFromList} role="region" aria-label="Trip workspace" tabIndex={0} className={`${mobileView === 'list' ? 'flex' : 'hidden'} app-scrollbar-hidden col-start-1 row-start-1 ${stickyNav && sidebarExpanded ? 'row-span-4' : 'row-span-3'} h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain min-[729px]:flex`}>
            <div ref={listContentRef} className={`flex min-w-0 flex-col ${sidebarExpanded ? 'shrink-0' : 'min-h-0 flex-1'}`}>
              {workspaceHeader}
              {workspaceAuxiliary}
              {workspaceNavTarget}
              <div className={`min-w-0 ${sidebarExpanded ? 'shrink-0' : 'min-h-0 flex-1'}`}>{sidebarContent}</div>
            </div>
          </section>
        ) : (
          <>
            {workspaceHeader}
            {workspaceAuxiliary}
            {!hero && stickyNav && <div ref={assignTripNavTarget} id="trip-section-nav-target" className={`${mobileView === 'list' && sidebarExpanded ? 'block mb-2' : 'hidden'} sticky top-0 z-40 col-start-1 row-start-3 w-full min-w-0 ${sidebarExpanded ? 'min-[729px]:row-start-3' : 'min-[729px]:hidden'}`} />}
            {workspaceSidebar}
          </>
        )}

        <div className={`relative ${hero ? 'h-full' : 'sticky top-0 h-full'} min-h-0 min-w-0 overflow-hidden ${mobileView === 'map' ? 'block' : 'hidden'} ${hero ? 'row-start-1' : mobileHeaderIsHidden ? 'row-start-1' : stickyNav && sidebarExpanded ? 'row-start-3 row-span-2' : 'row-start-3'} min-[729px]:col-start-2 min-[729px]:block ${hero ? 'min-[729px]:row-start-1' : stickyNav && sidebarExpanded ? 'min-[729px]:row-start-1 min-[729px]:row-span-4' : 'min-[729px]:row-start-1 min-[729px]:row-span-3'}`}>
          {(isDesktop || mobileView === 'map') && map}
          {(hero || scrollHeaderWithSidebar) && sidebarExpanded && listScrollSize.content > listScrollSize.viewport + 1 && <div ref={listScrollbarRef} onScroll={syncListFromScrollbar} aria-hidden="true" className={`app-scrollbar map-list-scrollbar absolute inset-y-0 right-0 z-50 w-3 overflow-y-auto overscroll-contain ${mobileView === 'map' ? 'hidden min-[729px]:block' : ''}`}>
            <div aria-hidden="true" style={{ height: `${listScrollSize.content}px`, width: 1 }} />
          </div>}
        </div>
      </div>
      {hideMobileHeader && mobileToggle}
    </main>
  );
}
