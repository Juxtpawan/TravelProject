import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound, MapPinned, LogOut, LogIn, CreditCard, AtSign } from 'lucide-react';
import { useAuth } from '../../../features/auth';

// IMPORT THE FALLBACK IMAGE DIRECTLY
import defaultAvatar from '../../../assets/demo-user.jpg'; 

function AccountMenu({ open: controlledOpen, onOpenChange }) {
  const { user, isLoading, logout } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
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
      if (open && ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  // While loading, show a skeleton button that looks like the sign-in button
  if (isLoading) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-[#dce4de] bg-white px-0 text-sm font-bold text-[#263a30] opacity-50 cursor-wait select-none min-[430px]:w-auto min-[430px]:justify-start min-[430px]:px-4"
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
          onClick={() => setOpen(!open)}
          className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-[#dce4de] bg-white text-sm font-semibold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Open account menu${user.name ? ` for ${user.name}` : ''}`}
        >
          {user.avatarUrl && !imgError ? (
            <img 
              src={user.avatarUrl} 
              alt="" 
              className="h-full w-full rounded-full object-cover"
              onError={() => setImgError(true)} 
            />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-full bg-badge-bg text-pine">
              {defaultAvatar ? <img src={defaultAvatar} alt="" className="h-full w-full rounded-full object-cover" /> : <UserRound size={18} />}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-[#dce4de] bg-white px-0 text-sm font-bold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer min-[430px]:w-auto min-[430px]:px-4"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Open sign in menu"
        >
          <UserRound size={17} />
          <span className="hidden min-[430px]:inline">Sign in</span>
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
                <p className="flex items-center gap-0.5 truncate text-xs font-mono font-semibold text-[#66736b]">
                  <AtSign size={11} aria-hidden="true" />
                  <span>{user.username}</span>
                </p>
              )}
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
