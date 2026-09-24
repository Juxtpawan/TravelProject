import { Link, NavLink as RouterNavLink } from 'react-router-dom';
import { Heart, Sparkles } from 'lucide-react';
import AccountMenu from './AccountMenu';

/**
 * Site-wide header — streamlined layout with responsive sub-menus
 * handled directly within AccountMenu to prevent layout bugs.
 */
function Header() {
  const navLinkClass = ({ isActive }) =>
    [
      'relative px-3 py-2 text-[15px] font-medium transition-colors',
      'text-slate-700 hover:text-emerald-700',
      isActive
        ? 'text-emerald-700 after:absolute after:left-3 after:right-3 after:-bottom-[1px] after:h-[2px] after:bg-emerald-600 after:rounded-full'
        : '',
    ].join(' ');

  return (
    <header className="sticky top-0 z-50 w-full bg-off-white border-b border-slate-200 overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between gap-4 overflow-visible">
        
        {/* Left Side: Brand Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl font-bold tracking-tight text-pine">
            TravelProject
          </span>
        </Link>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden md:flex items-center gap-1">
          <RouterNavLink
            to="/ai"
            className={({ isActive }) =>
              [
                'relative flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium rounded-full transition-colors',
                isActive ? 'bg-slate-800 text-white' : 'text-pine hover:bg-slate-200',
              ].join(' ')
            }
          >
            <Sparkles size={15} />
            AI mode
          </RouterNavLink>
          <RouterNavLink to="/" end className={navLinkClass}>
            Home
          </RouterNavLink>
          <RouterNavLink to="/explore" className={navLinkClass}>
            Explore
          </RouterNavLink>
        </nav>

        {/* Right Side: Actions Layout Panel */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 overflow-visible z-50">
          <Link
            to="/wishlist"
            className="relative flex items-center justify-center h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Wishlist"
          >
            <Heart size={20} />
          </Link>

          {/* Single Unified Mount Location Block for Account and Mobile Nav */}
          <div className="relative inline-block overflow-visible z-50 shrink-0">
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
