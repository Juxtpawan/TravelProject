import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Compass, Home, Menu, Plus, X } from 'lucide-react';
import AccountMenu from './AccountMenu';
import { WishlistButton } from '../../../features/wishlist';
import ProjectName from '../project-name/ProjectName';
import AiPlannerMark from './AiPlannerMark';
import TripNotificationsButton from './TripNotificationsButton';
import ThemeToggle from '../../theme/ThemeToggle';
import './Header.css';

function Header() {
  const [activeHeaderMenu, setActiveHeaderMenu] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef(null);
  const mobileMenuTriggerRef = useRef(null);
  const closeHeaderMenus = () => {
    setActiveHeaderMenu(null);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (mobileNavRef.current?.contains(event.target) || mobileMenuTriggerRef.current?.contains(event.target) || event.target.closest?.('[role="dialog"]')) return;
      setMobileMenuOpen(false);
      setActiveHeaderMenu(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setActiveHeaderMenu(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const navLinkClass = ({ isActive }) =>
    [
      'flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2',
      isActive
        ? 'bg-badge-bg text-pine font-bold shadow-sm ring-1 ring-inset ring-pine/10 hover:brightness-95'
        : 'text-[#35433d] hover:bg-[#f0f6f2]',
    ].join(' ');
  const aiPlannerNavLinkClass = ({ isActive }) => [
    'ai-planner-nav-link flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2',
    isActive ? 'ai-planner-nav-link-active text-pine' : 'text-pine',
  ].join(' ');
  const mobileNavLinkClass = ({ isActive }) => [
    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium',
    isActive ? 'bg-[#edf5ef] text-pine' : 'text-[#405147] hover:bg-[#f5f8f6]',
  ].join(' ');

  return (
    <header className="site-header sticky top-0 z-50 w-full border-b border-[#e5e9e6] bg-white">
      <div className="app-container flex h-16 items-center justify-between gap-2 max-[359px]:gap-1 max-[359px]:px-3 sm:h-18 sm:gap-4 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Link to="/" onClick={closeHeaderMenus} className="site-header-brand flex min-w-0 shrink-0 items-center gap-1 sm:gap-2.5" aria-label="travelproject home">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-badge-bg text-pine min-[430px]:h-9 min-[430px]:w-9 sm:h-10 sm:w-10">
            <Compass size={22} strokeWidth={2.4} />
          </span>
          <ProjectName className="text-[17px] text-pine min-[430px]:text-[19px] sm:text-[21px]" />
        </Link>

        {/* Main Navigation tabs (visible on desktop and tablet screens) */}
        <nav className="hidden items-center gap-1 min-[900px]:flex min-[900px]:justify-self-center" aria-label="Main navigation">
          <NavLink to="/ai" onClick={closeHeaderMenus} className={aiPlannerNavLinkClass}><AiPlannerMark /><span>AI planner</span></NavLink>
          <NavLink to="/" end onClick={closeHeaderMenus} className={navLinkClass}><Home size={16} />Home</NavLink>
          <NavLink to="/explore" onClick={closeHeaderMenus} className={navLinkClass}><Compass size={16} />Explore</NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 min-[900px]:justify-self-end">
          <Link
            to="/trips"
            onClick={closeHeaderMenus}
            aria-label="Plan a trip"
            title="Plan a trip"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#004f32] px-2.5 text-xs font-bold text-white transition-colors hover:bg-[#003d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2 sm:gap-2 sm:px-4 sm:text-sm lg:px-5"
          >
            <Plus size={17} /><span className="lg:hidden">Plan</span><span className="hidden lg:inline">Plan a trip</span>
          </Link>

          <div className="hidden min-[900px]:block">
            <WishlistButton
              compact
              open={activeHeaderMenu === 'wishlist'}
              onOpenChange={(open) => setActiveHeaderMenu(open ? 'wishlist' : null)}
            />
          </div>

          <TripNotificationsButton
            open={activeHeaderMenu === 'notifications'}
            onOpenChange={(open) => setActiveHeaderMenu(open ? 'notifications' : null)}
          />

          {/* Account Dropdown Menu */}
          <div className="hidden min-[900px]:block"><AccountMenu open={activeHeaderMenu === 'account'} onOpenChange={(open) => setActiveHeaderMenu(open ? 'account' : null)} compact /></div>

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            ref={mobileMenuTriggerRef}
            className="grid h-10 w-10 place-items-center rounded-full text-[#263a30] transition hover:bg-[#f2f5f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium min-[900px]:hidden cursor-pointer"
            onClick={() => {
              setMobileMenuOpen(open => !open);
              setActiveHeaderMenu(null);
            }}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <nav id="mobile-navigation" ref={mobileNavRef} className="mobile-navigation-panel absolute right-2 top-[calc(100%+0.5rem)] z-[60] max-h-[calc(100dvh-5.5rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[#e5e9e6] bg-white p-2 shadow-[0_14px_40px_rgba(18,44,32,0.16)] sm:right-6 sm:p-2.5 min-[900px]:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col">
            <div role="group" aria-label="Main pages" className="flex flex-col gap-0.5">
              <NavLink to="/ai" className={mobileNavLinkClass} onClick={closeHeaderMenus}><AiPlannerMark /><span>AI planner</span></NavLink>
              <NavLink to="/" end className={mobileNavLinkClass} onClick={closeHeaderMenus}><Home size={17} aria-hidden="true" /><span>Home</span></NavLink>
              <NavLink to="/explore" className={mobileNavLinkClass} onClick={closeHeaderMenus}><Compass size={17} aria-hidden="true" /><span>Explore places</span></NavLink>
            </div>
            <div role="group" aria-label="Preferences" className="mt-2 grid gap-0.5 border-t border-[#e8ede9] pt-2">
              <ThemeToggle label="Appearance" />
              <WishlistButton label="Saved" open={activeHeaderMenu === 'wishlist'} onOpenChange={open => setActiveHeaderMenu(open ? 'wishlist' : null)} />
            </div>
            <div aria-label="Account" className="mt-2 border-t border-[#e8ede9] pt-2">
              <AccountMenu compact inline onClose={closeHeaderMenus} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

export default Header;
