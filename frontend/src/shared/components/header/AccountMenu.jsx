import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound, MapPinned, LogOut, LogIn, ChevronDown, CreditCard, AtSign } from 'lucide-react';
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

  // While loading, show a skeleton button that looks like the sign-in button
  if (isLoading) {
    return (
      <div
        className="flex h-10 items-center gap-2 rounded-full border border-[#dce4de] bg-white px-4 text-sm font-bold text-[#263a30] opacity-50 cursor-wait select-none"
        aria-hidden="true"
      >
        <div className="h-4 w-4 rounded-full bg-slate-300 animate-pulse" />
        <span className="hidden sm:inline w-12 h-3 bg-slate-200 rounded animate-pulse" />
      </div>
    );
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-2 rounded-full border border-[#dce4de] bg-white pl-1 pr-3 text-sm font-semibold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Open account menu"
        >
          {user.avatarUrl && !imgError ? (
            <img 
              src={user.avatarUrl} 
              alt="" 
              className="h-8 w-8 rounded-full object-cover" 
              onError={() => setImgError(true)} 
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-badge-bg text-pine">
              {defaultAvatar ? <img src={defaultAvatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <UserRound size={18} />}
            </span>
          )}
          <span className="hidden max-w-24 truncate sm:inline">{user.name?.split(' ')[0] || 'Account'}</span>
          <ChevronDown size={14} className="hidden sm:block" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-2 rounded-full border border-[#dce4de] bg-white px-4 text-sm font-bold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Open sign in menu"
        >
          <UserRound size={17} />
          <span>Sign in</span>
        </button>
      )}

      {/* DROPDOWN MENU CONTAINER */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-[#e3e9e5] bg-white py-1 shadow-[0_14px_40px_rgba(18,44,32,0.16)] z-50"
        >
          {user && (
            <div className="border-b border-[#edf0ed] px-4 py-3">
              <p className="truncate text-sm font-bold text-pine">{user.name}</p>
              {user.username && (
                <p className="truncate text-xs font-mono font-bold text-emerald-700 flex items-center gap-0.5">
                  <AtSign size={11} />
                  <span>{user.username}</span>
                </p>
              )}
              <p className="truncate text-xs text-[#66736b]">{user.email}</p>
            </div>
          )}

          {user ? (
            <>
              <div className="py-1">
                <Link
                  to="/trips"
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <MapPinned size={16} />
                  My Trips
                </Link>
                <Link
                  to="/profile"
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <UserRound size={16} />
                  Profile
                </Link>
                <Link
                  to="/pricing"
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <CreditCard size={16} />
                  Membership
                </Link>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-3 border-t border-[#edf0ed] px-4 py-3 text-left text-sm font-semibold text-[#a13a31] hover:bg-[#fff6f5] cursor-pointer"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <div className="p-2">
              <Link to="/auth/login" role="menuitem" className="flex items-center justify-center gap-2 rounded-full bg-btn-primary-bg px-4 py-2.5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover" onClick={() => setOpen(false)}>
                <LogIn size={16} />Log in
              </Link>
              <Link to="/auth/signup" role="menuitem" className="mt-1 block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-[#35433d] hover:bg-[#f2f7f3]" onClick={() => setOpen(false)}>
                Create an account
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
