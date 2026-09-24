import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import { User, MapPinned, LogOut, LogIn, Sparkles, Home, Compass, Menu } from 'lucide-react';
import { useAuth } from '../../../features/auth';

// IMPORT THE FALLBACK IMAGE DIRECTLY
import defaultAvatar from '../../../assets/demo-user.jpg'; 

function AccountMenu() {
  const { user, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false); 
  
  // Track the previous user ID to handle state resets cleanly without an effect
  const [prevUserId, setPrevUserId] = useState(user?.id || null);
  
  const ref = useRef(null);
  const navigate = useNavigate();

  // If they did, update both states synchronously before the screen draws.
  const currentUserId = user?.id || null;
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setImgError(false);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" aria-hidden="true" />;
  }

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="relative inline-block" ref={ref}>
      
      {/* TRIGGER BUTTON DESIGN */}
      {user ? (
        /* If logged in: Show the Profile Picture */
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shadow-sm focus:outline-none overflow-hidden"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Toggle user menu"
        >
          {user.avatarUrl && !imgError ? (
            <img 
              src={user.avatarUrl} 
              alt="" 
              className="h-full w-full rounded-full object-cover" 
              onError={() => setImgError(true)} 
            />
          ) : (
            <img 
              src={defaultAvatar} 
              alt="User profile fallback" 
              className="h-full w-full rounded-full object-cover" 
            />
          )}
        </button>
      ) : (
        /* If logged out: Show a combined Hamburger/Login element for mobile & desktop */
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm focus:outline-none"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} className="text-slate-500" />
          <span className="hidden sm:inline text-xs font-semibold">Menu</span>
        </button>
      )}

      {/* DROPDOWN MENU CONTAINER */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-1 overflow-hidden z-50 block"
        >
          {/* USER INFO BAR (Only displayed if logged in) */}
          {user && (
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          )}

          {/* MOBILE ONLY NAVIGATION LINKS (Hidden on Desktop via md:hidden) */}
          <div className="md:hidden border-b border-slate-100 pb-1">
            <Link
              to="/"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Home size={15} className="text-slate-400" />
              Home
            </Link>
            <Link
              to="/explore"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Compass size={15} className="text-slate-400" />
              Explore
            </Link>
            <RouterNavLink
              to="/ai"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-700 font-semibold bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Sparkles size={15} className="text-emerald-600" />
              AI mode
            </RouterNavLink>
          </div>

          {/* DYNAMIC AUTHENTICATION LINKS */}
          {user ? (
            /* Logged In Core Dropdown Links */
            <>
              <div className="pt-1">
                <Link
                  to="/trips"
                  role="menuitem"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <MapPinned size={15} className="text-slate-400" />
                  My Trips
                </Link>

                <Link
                  to="/profile"
                  role="menuitem"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <User size={15} className="text-slate-400" />
                  Profile
                </Link>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100 text-left font-medium mt-1"
              >
                <LogOut size={15} />
                Log out
              </button>
            </>
          ) : (
            /* Logged Out Simple CTA Option */
            <Link
              to="/auth/login"
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white bg-slate-800 hover:bg-slate-700 m-1.5 rounded-lg text-center justify-center transition-colors font-medium"
              onClick={() => setOpen(false)}
            >
              <LogIn size={14} />
              Log in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
