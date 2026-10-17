import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Compass, Heart, Home, Menu, Plus, X } from 'lucide-react';
import AccountMenu from './AccountMenu';
import { WishlistButton } from '../../../features/wishlist';
import ProjectName from '../project-name/ProjectName';
import AiPlannerMark from './AiPlannerMark';
import './Header.css';

function Header() {
  const [activeHeaderMenu, setActiveHeaderMenu] = useState(null);
  const mobileMenuOpen = activeHeaderMenu === 'mobile-nav';
  const closeHeaderMenus = () => setActiveHeaderMenu(null);

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
      isActive ? 'bg-gray-200 text-pine font-bold' : 'text-[#35433d] hover:bg-[#f2f5f2]',
    ].join(' ');
  const aiPlannerNavLinkClass = ({ isActive }) => [
    'ai-planner-nav-link flex items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2',
    isActive ? 'ai-planner-nav-link-active text-pine' : 'text-pine',
  ].join(' ');

  return (
    <header className="site-header sticky top-0 z-50 w-full border-b border-[#e5e9e6] bg-white">
      <div className="app-container flex h-16 items-center justify-between gap-2 sm:h-18 sm:gap-4">
        <Link to="/" onClick={closeHeaderMenus} className="site-header-brand flex min-w-0 shrink-0 items-center gap-1 sm:gap-2.5" aria-label="travelproject home">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-badge-bg text-pine min-[430px]:h-10 min-[430px]:w-10">
            <Compass size={22} strokeWidth={2.4} />
          </span>
          <ProjectName className="text-pine" />
        </Link>

        {/* Main Navigation tabs (visible on desktop and tablet screens) */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <NavLink to="/ai" onClick={closeHeaderMenus} className={aiPlannerNavLinkClass}><AiPlannerMark /><span>AI planner</span></NavLink>
          <NavLink to="/" end onClick={closeHeaderMenus} className={navLinkClass}><Home size={16} />Home</NavLink>
          <NavLink to="/explore" onClick={closeHeaderMenus} className={navLinkClass}><Compass size={16} />Explore</NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/trips"
            onClick={closeHeaderMenus}
            className="hidden h-10 items-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-white transition hover:bg-pine/90 lg:flex"
          >
            <Plus size={17} />Plan a trip
          </Link>

          <div className="hidden min-[430px]:block">
            <WishlistButton
              open={activeHeaderMenu === 'wishlist'}
              onOpenChange={(open) => setActiveHeaderMenu(open ? 'wishlist' : null)}
            />
          </div>

          {/* Account Dropdown Menu */}
          <AccountMenu
            open={activeHeaderMenu === 'account'}
            onOpenChange={(open) => setActiveHeaderMenu(open ? 'account' : null)}
          />

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-[#263a30] hover:bg-[#f2f5f2] md:hidden cursor-pointer"
            onClick={() => setActiveHeaderMenu(mobileMenuOpen ? null : 'mobile-nav')}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <nav className="border-t border-[#e5e9e6] bg-white px-4 py-3 md:hidden shadow-md" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <NavLink to="/ai" className={aiPlannerNavLinkClass} onClick={closeHeaderMenus}><AiPlannerMark /><span>AI planner</span></NavLink>
            <NavLink to="/" end className={navLinkClass} onClick={closeHeaderMenus}><Home size={17} />Home</NavLink>
            <NavLink to="/explore" className={navLinkClass} onClick={closeHeaderMenus}><Compass size={17} />Explore places</NavLink>
            <button type="button" onClick={() => setActiveHeaderMenu('wishlist')} className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-left text-sm font-semibold text-[#35433d] transition-colors hover:bg-[#f2f5f2] min-[430px]:hidden">
              <Heart size={17} />Wishlists
            </button>
            <Link to="/trips" onClick={closeHeaderMenus} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-pine text-sm font-bold text-white hover:bg-pine/90">
              <Plus size={17} />Plan a trip
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export default Header;
