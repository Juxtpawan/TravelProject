import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, Check, LoaderCircle, X } from 'lucide-react';
import { useAuth } from '../../../features/auth';
import { getTripNotifications, markTripNotificationsRead, respondToTripNotification } from '../../../features/trips/api/tripsApi';

export default function TripNotificationsButton({ compact = false, size = 'default', className = '', open: controlledOpen, onOpenChange }) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const triggerSize = size === 'small' ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-10 w-10';

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try { setItems(await getTripNotifications()); setError(''); }
    catch { setError('Notifications could not be loaded.'); }
  }, [user?.id]);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    if (!user?.id) return () => window.clearTimeout(initial);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  const respond = async (notification, decision, role = 'editor') => {
    setBusyId(notification.id);
    try {
      await respondToTripNotification(notification.id, decision, role);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || 'The request could not be updated.');
    } finally { setBusyId(null); }
  };

  return <div className="relative" ref={containerRef}>
    <button type="button" ref={triggerRef} onClick={async () => { const next = !open; setOpen(next); if (next && user?.id) { await markTripNotificationsRead().catch(() => {}); await refresh(); } }}
      aria-label="Notifications" title="Notifications" aria-expanded={open} aria-controls={panelId}
      className={`${triggerSize} relative grid shrink-0 place-items-center rounded-full border border-white/70 bg-white text-pine shadow-sm transition hover:bg-[#f2f7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium ${className}`}>
      <Bell size={size === 'small' ? 14 : 17} />
      {user && items.some(item => !item.read_at) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#e05a47] ring-2 ring-white" />}
    </button>
    {open && <section id={panelId} aria-label="Notifications" className={`header-popover-panel absolute right-0 top-full z-[120] mt-2 max-h-[min(70dvh,32rem)] overflow-y-auto rounded-2xl border border-[#dce5de] bg-white p-3 text-pine shadow-2xl max-[899px]:fixed max-[899px]:right-2 max-[899px]:top-[calc(env(safe-area-inset-top)+4.25rem)] max-[899px]:mt-0 ${compact ? 'w-[min(22rem,calc(100vw-1rem))]' : 'w-[min(24rem,calc(100vw-1rem))]'}`}>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-extrabold">Notifications</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#f1f6f2]"><X size={15} /></button></div>
      {error && <p className="mb-2 rounded-lg bg-[#fff4f1] px-3 py-2 text-xs text-[#9b3e31]">{error}</p>}
      {!user ? <p className="rounded-xl bg-[#f7faf8] p-3 text-sm text-[#66736b]">Sign in to see trip notifications.</p> : items.length === 0 ? <p className="rounded-xl bg-[#f7faf8] p-3 text-sm text-[#66736b]">You’re all caught up.</p> : <ul className="space-y-2">
        {items.map(item => {
          const requester = item.payload?.requesterName || item.payload?.requesterUsername || item.payload?.requesterEmail || 'A traveler';
          const isRequest = item.type === 'trip_access_request';
          return <li key={item.id} className="rounded-xl border border-[#e7ede8] p-3">
            <p className="text-sm font-semibold">{isRequest ? `${requester} wants to plan with you` : item.type === 'trip_access_approved' ? 'Your trip access was approved' : item.type === 'trip_access_declined' ? 'Your trip access request was declined' : 'Trip update'}</p>
            <p className="mt-0.5 text-xs text-[#66736b]">{item.trip_title || item.payload?.tripTitle || 'Trip'}{item.destination_name ? ` · ${item.destination_name}` : ''}</p>
            {isRequest && <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busyId === item.id} onClick={() => respond(item, 'accept', 'editor')} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-pine px-2 text-xs font-bold text-white hover:bg-[#003d27] disabled:opacity-50">{busyId === item.id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}Accept edit</button>
              <button type="button" disabled={busyId === item.id} onClick={() => respond(item, 'accept', 'viewer')} className="min-h-9 rounded-lg border border-[#cfdcd2] px-2 text-xs font-bold hover:bg-[#f3f7f4] disabled:opacity-50">Accept view only</button>
              <button type="button" disabled={busyId === item.id} onClick={() => respond(item, 'decline')} className="col-span-2 min-h-8 rounded-lg px-2 text-xs font-semibold text-[#66736b] hover:bg-[#f7faf8] disabled:opacity-50">Decline</button>
            </div>}
          </li>;
        })}
      </ul>}
    </section>}
  </div>;
}
