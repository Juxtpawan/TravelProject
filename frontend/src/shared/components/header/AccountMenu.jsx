import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound, MapPinned, LogOut, LogIn, CreditCard, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../features/auth';
import ThemeToggle from '../../theme/ThemeToggle';

// IMPORT THE FALLBACK IMAGE DIRECTLY
import defaultAvatar from '../../../assets/demo-user.jpg'; 

function AccountMenu({ open: controlledOpen, onOpenChange, compact = false, showThemeToggle = true, inline = false, onClose }) {
  const { user, isLoading, logout } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [imgError, setImgError] = useState(false); 
  
  // Track the previous user ID to handle state resets cleanly without an effect
  const [prevUserId, setPrevUserId] = useState(user?.id || null);
  
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const navigate = useNavigate();
  const triggerSize = 'h-10 w-10';
  const menuPosition = compact
    ? 'fixed right-2 top-[calc(env(safe-area-inset-top)+4.25rem)] w-[min(15rem,calc(100vw-1rem))] sm:right-6 sm:top-[calc(env(safe-area-inset-top)+4.75rem)] lg:right-8 2xl:right-[calc((100vw-80rem)/2+2rem)]'
    : 'absolute right-0 top-full mt-2 w-64';

  // If they did, update both states synchronously before the screen draws.
  const currentUserId = user?.id || null;
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setImgError(false);
  }

  useEffect(() => {
    function handlePointerDown(event) {
      if (open && ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (open && event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  // While loading, show a skeleton button that looks like the sign-in button
  if (isLoading) {
    return (
      <div
        className={`flex ${triggerSize} items-center justify-center gap-2 rounded-full border border-[#dce4de] bg-white px-0 text-sm font-bold text-[#263a30] opacity-50 cursor-wait select-none ${compact ? '' : 'min-[430px]:w-auto min-[430px]:justify-start min-[430px]:px-4'}`}
        aria-hidden="true"
      >
        <div className="h-4 w-4 rounded-full bg-slate-300 animate-pulse" />
        <span className="hidden sm:inline w-12 h-3 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  const handleLogout = async () => {
    setOpen(false);
    onClose?.();
    await logout();
    navigate('/');
  };

  if (inline) {
    if (!user) {
      return (
        <div className="space-y-2">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-[#f4f8f5] px-3 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-pine shadow-sm"><UserRound size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-pine">Welcome</span>
              <span className="block truncate text-xs text-[#66736b]">Sign in to save your trips</span>
            </span>
            <Link to="/auth/login" onClick={onClose} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-pine px-4 text-xs font-bold text-white transition hover:bg-[#003d27]">Log in</Link>
          </div>
          <Link to="/auth/signup" onClick={onClose} className="flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-pine transition hover:bg-[#f2f7f3]">Create an account</Link>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Link to="/profile" onClick={onClose} className="group flex min-h-[60px] min-w-0 items-center gap-3 rounded-2xl bg-[#f4f8f5] px-3 py-2.5 transition hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-pine shadow-sm">
            <img src={user.avatarUrl && !imgError ? user.avatarUrl : defaultAvatar} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-pine">{user.name || user.email}</span>
            <span className="block text-xs text-[#66736b]">Profile and settings</span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[#718077] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/pricing" onClick={onClose} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e5e9e6] px-3 text-xs font-semibold text-[#35433d] transition hover:bg-[#f7faf8]">
            <CreditCard size={14} aria-hidden="true" />Membership
          </Link>
          <button type="button" onClick={handleLogout} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#f0dfdd] px-3 text-xs font-semibold text-[#a13a31] transition hover:bg-[#fff6f5]">
            <LogOut size={14} aria-hidden="true" />Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      
      {/* TRIGGER BUTTON DESIGN */}
      {user ? (
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen(!open)}
          className={`grid ${triggerSize} place-items-center overflow-hidden rounded-full border border-[#dce4de] bg-white text-sm font-semibold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer`}
          aria-expanded={open}
          aria-controls={menuId}
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
          ref={triggerRef}
          onClick={() => setOpen(!open)}
          className="flex h-10 items-center justify-center gap-2 rounded-full border border-[#dce4de] bg-white px-4 text-sm font-bold text-[#263a30] transition hover:bg-[#f7faf7] focus:outline-none cursor-pointer"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Open sign in menu"
        >
          <UserRound size={17} />
          <span>Sign in</span>
        </button>
      )}

      {/* DROPDOWN MENU CONTAINER */}
      {open && (
        <div
          id={menuId}
          className={`header-popover-panel ${menuPosition} z-[70] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-[#e3e9e5] bg-white py-1 shadow-[0_14px_40px_rgba(18,44,32,0.16)]`}
        >
          {showThemeToggle && <div className="flex items-center justify-between border-b border-[#edf0ed] px-3 py-1.5">
            <span className="text-xs font-semibold text-[#526158]">Appearance</span>
            <ThemeToggle className="!h-8 !w-8" />
          </div>}
          {user && (
            <div className="border-b border-[#edf0ed] px-4 py-3">
              <p className="truncate text-base font-bold text-pine">{user.name}</p>
              {user.username && (
                <p className="mt-0 truncate text-sm font-medium text-[#66736b]">
                  @{(user.username || 'wanderer').toLowerCase()}
                </p>
              )}
            </div>
          )}

          {user ? (
            <>
              <div className="py-1">
                <Link
                  to="/trips"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <MapPinned size={16} />
                  My Trips
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <UserRound size={16} />
                  Profile
                </Link>
                <Link
                  to="/pricing"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#35433d] hover:bg-[#f2f7f3]"
                  onClick={() => setOpen(false)}
                >
                  <CreditCard size={16} />
                  Membership
                </Link>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-3 border-t border-[#edf0ed] px-4 py-3 text-left text-sm font-semibold text-[#a13a31] hover:bg-[#fff6f5] cursor-pointer"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <div className="p-2">
              <Link to="/auth/login" className="flex items-center justify-center gap-2 rounded-full bg-btn-primary-bg px-4 py-2.5 text-sm font-bold text-btn-primary-text hover:bg-btn-primary-bg-hover" onClick={() => setOpen(false)}>
                <LogIn size={16} />Log in
              </Link>
              <Link to="/auth/signup" className="mt-1 block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-[#35433d] hover:bg-[#f2f7f3]" onClick={() => setOpen(false)}>
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
