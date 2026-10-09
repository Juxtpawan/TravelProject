import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Compass, MapPinned, Menu, Plus, Sparkles, X, UserRound } from 'lucide-react';
import { useAuth } from '../../../features/auth';
import AccountMenu from './AccountMenu';

function Header() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
      isActive ? 'bg-badge-bg text-pine font-bold' : 'text-[#35433d] hover:bg-[#f2f5f2]',
    ].join(' ');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e5e9e6] bg-white">
      <div className="app-container flex h-18 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="TravelProject home">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-badge-bg text-pine">
            <Compass size={22} strokeWidth={2.4} />
          </span>
          <span className="text-[21px] font-extrabold tracking-tight text-pine">TravelProject</span>
        </Link>

        {/* Main Navigation tabs (visible on desktop and tablet screens) */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <NavLink to="/explore" className={navLinkClass}><Compass size={16} />Explore</NavLink>
          <NavLink to="/trips" className={navLinkClass}><MapPinned size={16} />My trips</NavLink>
          <NavLink to="/pricing" className={navLinkClass}>Membership</NavLink>
          {user && (
            <NavLink to="/profile" className={navLinkClass}>
              <UserRound size={16} />Profile
            </NavLink>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/ai"
            className="hidden h-10 items-center gap-2 rounded-full border border-gray px-4 text-sm font-bold text-pine transition hover:bg-gray lg:flex"
          >
            <Sparkles size={16} />AI planner
          </Link>
          <Link
            to="/trips"
            className="hidden h-10 items-center gap-2 rounded-full bg-pine px-5 text-sm font-bold text-white transition hover:bg-pine/90 lg:flex"
          >
            <Plus size={17} />Plan a trip
          </Link>

          {/* Account Dropdown Menu */}
          <AccountMenu />

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-[#263a30] hover:bg-[#f2f5f2] md:hidden cursor-pointer"
            onClick={() => setMobileMenuOpen(value => !value)}
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
            <NavLink to="/explore" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}><Compass size={17} />Explore places</NavLink>
            <NavLink to="/trips" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}><MapPinned size={17} />My trips and plans</NavLink>
            <NavLink to="/pricing" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>Membership</NavLink>
            {user && (
              <NavLink to="/profile" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
                <UserRound size={17} />My Profile
              </NavLink>
            )}
            <Link to="/ai" onClick={() => setMobileMenuOpen(false)} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-pine hover:bg-gray">
              <Sparkles size={17} />AI trip planner
            </Link>
            <Link to="/trips" onClick={() => setMobileMenuOpen(false)} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-pine text-sm font-bold text-white hover:bg-pine/90">
              <Plus size={17} />Plan a trip
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export default Header;
