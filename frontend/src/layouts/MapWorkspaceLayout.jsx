import { ArrowLeft, BookOpen, Map as MapIcon } from 'lucide-react';

/** Shared padded, responsive two-pane shell for itinerary and destination maps. */
export default function MapWorkspaceLayout({
  header,
  sidebar,
  map,
  auxiliary,
  mobileView = 'list',
  onToggleView,
  sidebarExpanded = true,
  hideMobileHeader = false,
  collapsedHeaderOnly = false,
}) {
  const mobileHeaderIsHidden = hideMobileHeader && mobileView === 'map';
  const mobileRows = mobileHeaderIsHidden ? 'grid-rows-[minmax(0,1fr)]' : 'grid-rows-[auto_auto_minmax(0,1fr)]';
  const mobileToggle = onToggleView && <button
    type="button"
    onClick={onToggleView}
    aria-label={hideMobileHeader && mobileView === 'map' ? 'Back to list' : mobileView === 'list' ? 'Show map' : 'Show list'}
    className={hideMobileHeader
      ? `absolute z-30 inline-flex min-h-10 items-center justify-center gap-1.5 bg-green hover:bg-green-medium text-xs font-bold text-pine shadow-md ring-1 ring-slate-200 md:hidden ${mobileView === 'map' ? 'left-3 top-3 h-10 w-10 rounded-full' : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 rounded-lg px-3'}`
      : 'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-pine transition hover:bg-slate-200 md:hidden'}
  >
    {hideMobileHeader && mobileView === 'map'
      ? <ArrowLeft size={18} />
      : mobileView === 'list' ? <><MapIcon size={15} />Map</> : <><BookOpen size={15} />List</>}
  </button>;

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-[#f8f9fa] p-2 sm:p-3">
      <div className={`mx-auto grid h-full min-h-0 w-full max-w-[1600px] grid-cols-1 ${mobileRows} gap-2 md:grid-rows-[auto_auto_minmax(0,1fr)] ${sidebarExpanded ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'md:grid-cols-[4rem_minmax(0,1fr)]'}`}>
        <header className={`${mobileHeaderIsHidden ? 'hidden md:flex' : 'flex'} col-start-1 row-start-1 min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 md:col-start-1 md:row-start-1 ${!sidebarExpanded && collapsedHeaderOnly ? 'md:justify-center md:px-1' : !sidebarExpanded ? 'md:col-span-2' : ''}`}>
          <div className="min-w-0 flex-1">{header}</div>
          {!hideMobileHeader && mobileToggle}
        </header>

        {auxiliary && <div className="col-start-1 row-start-2 min-w-0 rounded-lg md:col-start-1 md:row-start-2">{auxiliary}</div>}

        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} ${mobileHeaderIsHidden ? 'row-start-1' : 'row-start-3'} min-h-0 min-w-0 overflow-hidden md:col-start-1 ${!sidebarExpanded && collapsedHeaderOnly ? 'md:row-start-2 md:row-span-2' : 'md:row-start-3'} md:flex`}>
          {sidebar}
        </div>

        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} ${mobileHeaderIsHidden ? 'row-start-1' : 'row-start-3'} min-h-0 min-w-0 overflow-hidden md:col-start-2 md:block ${sidebarExpanded || collapsedHeaderOnly ? 'md:row-start-1 md:row-span-3' : 'md:row-start-2 md:row-span-2'}`}>
          {map}
        </div>
      </div>
      {hideMobileHeader && mobileToggle}
    </main>
  );
}
