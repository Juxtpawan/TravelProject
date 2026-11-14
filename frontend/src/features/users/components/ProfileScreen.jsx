import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserRound,
  Shield,
  Dices,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  CalendarDays,
  ArrowRight,
  Plane,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth';
import {
  getProfile,
  updateProfile,
  deleteAccount,
  suggestUsername,
  changePassword,
} from '../api/profileApi';
import { getTrips } from '../../trips/api/tripsApi';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTripDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const { user, isLoading: authLoading, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    id: '',
    name: '',
    email: '',
    username: '',
    avatar_url: '',
    subscription_tier: 'free',
    subscription_status: null,
    created_at: null,
    providers: { google: false, email: false },
  });
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsUserId, setTripsUserId] = useState(null);
  const [tripsError, setTripsError] = useState(false);

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'security' | 'danger'
  const profileTabs = ['details', 'security', 'danger'];
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [profileLoadVersion, setProfileLoadVersion] = useState(0);
  const loading = authLoading || Boolean(user?.id && loadedUserId !== user.id);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileError, setProfileError] = useState('');
  const deleteConfirmationInputRef = useRef(null);
  const deleteAccountTriggerRef = useRef(null);
  const editProfileTriggerRef = useRef(null);
  const editProfileDialogRef = useRef(null);
  const profileNameInputRef = useRef(null);
  const editProfileWasOpenRef = useRef(false);

  useEffect(() => {
    if (editingProfile) profileNameInputRef.current?.focus();
  }, [editingProfile]);

  useEffect(() => {
    if (!editingProfile) {
      if (editProfileWasOpenRef.current) editProfileTriggerRef.current?.focus();
      editProfileWasOpenRef.current = false;
      return undefined;
    }
    editProfileWasOpenRef.current = true;

    const handleEditDialogKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        setEditingProfile(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = editProfileDialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled)'
      );
      if (!focusableElements?.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleEditDialogKeyDown);
    return () => window.removeEventListener('keydown', handleEditDialogKeyDown);
  }, [editingProfile, saving]);

  useEffect(() => {
    if (showDeleteModal) deleteConfirmationInputRef.current?.focus();
  }, [showDeleteModal]);

  useEffect(() => {
    if (!showDeleteModal) return undefined;
    const handleDialogKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) setShowDeleteModal(false);
    };
    window.addEventListener('keydown', handleDialogKeyDown);
    return () => window.removeEventListener('keydown', handleDialogKeyDown);
  }, [showDeleteModal, isDeleting]);

  useEffect(() => {
    if (!showDeleteModal) deleteAccountTriggerRef.current?.focus();
  }, [showDeleteModal]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return undefined;

    let isMounted = true;
    getProfile(user.id)
      .then((data) => {
        if (!isMounted) return;
        setProfileError('');
        setProfile(data);
        setName(data.name || '');
        setEmail(data.email || '');
        setUsername((data.username || '').toLowerCase());
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err.response?.data?.error || 'Failed to load your profile.';
        setProfileError(message);
      })
      .finally(() => {
        if (isMounted) setLoadedUserId(user.id);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id, profileLoadVersion]);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;
    let isMounted = true;
    getTrips()
      .then((data) => {
        if (!isMounted) return;
        setTrips(data);
        setTripsUserId(user.id);
        setTripsError(false);
      })
      .catch(() => { if (isMounted) { setTripsUserId(user.id); setTripsError(true); } })
      .finally(() => { if (isMounted) setTripsLoading(false); });
    return () => { isMounted = false; };
  }, [authLoading, user?.id]);
  const currentTripsLoading = tripsLoading || Boolean(user?.id && tripsUserId !== user.id);

  const handleProfileTabKeyDown = (event) => {
    const currentIndex = profileTabs.indexOf(activeTab);
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % profileTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + profileTabs.length) % profileTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = profileTabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = profileTabs[nextIndex];
    setActiveTab(nextTab);
    event.currentTarget.parentElement?.querySelector(`#profile-tab-${nextTab}`)?.focus();
  };

  const handleCopyHandle = async () => {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(`@${username.toLowerCase()}`);
      setCopiedHandle(true);
      toast.success('Travel handle copied.');
      window.setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      toast.error('Could not copy the travel handle.');
    }
  };

  const handleSuggestUsername = async () => {
    setGeneratingUsername(true);
    try {
      const res = await suggestUsername();
      if (res?.username) {
        const suggestedUsername = res.username.toLowerCase();
        setUsername(suggestedUsername);
        toast.success(`Suggested: @${suggestedUsername}`);
      }
    } catch {
      toast.error('Could not generate username idea.');
    } finally {
      setGeneratingUsername(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const normalizedUsername = username.trim().toLowerCase() || null;
      const res = await updateProfile(user.id, {
        name: name.trim(),
        username: normalizedUsername,
      });

      const updatedUser = res.user || {
        ...profile,
        name: name.trim(),
        username: normalizedUsername,
      };

      setProfile((prev) => ({ ...prev, ...updatedUser }));
      if (updateUser) {
        updateUser({
          name: updatedUser.name,
          username: updatedUser.username,
        });
      }

      setEditingProfile(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: profile.providers?.email ? currentPassword : '',
        newPassword,
      });

      toast.success(
        profile.providers?.email
          ? 'Password updated successfully!'
          : 'Password created! You can now log in with email or username.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfile((prev) => ({
        ...prev,
        providers: { ...prev.providers, email: true },
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput.trim() !== 'DELETE') {
      toast.error('Please type DELETE to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount(user.id);
      toast.success('Your account has been deleted.');
      setShowDeleteModal(false);
      await logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Account could not be deleted.');
      setIsDeleting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-[80rem] mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-pine/20 border-t-pine mb-3" />
        <p className="text-sm font-medium text-[#66736b]">Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-[80rem] mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f2f5f2] text-pine mb-4">
          <UserRound size={30} />
        </div>
        <h1 className="text-2xl font-bold text-pine">Sign in to view your profile</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#66736b]">
          Sign in to manage your profile and trips.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-btn-primary-bg px-7 text-sm font-bold text-btn-primary-text shadow-sm transition-colors hover:bg-btn-primary-bg-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const initials = (profile.name || user.name || 'Traveler')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'T';
  const todayKey = getLocalDateKey();
  const upcomingTrip = trips.find((trip) => trip.end_date >= todayKey);
  const tripInProgress = Boolean(upcomingTrip && upcomingTrip.start_date <= todayKey);
  const pastTripCount = trips.filter((trip) => trip.end_date < todayKey).length;
  const destinationCount = new Set(trips.map((trip) => trip.destination_name).filter(Boolean)).size;

  return (
    <div className="w-full min-h-full bg-[#f6f8f6] py-5 sm:py-8 lg:py-10">
      <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8">
        
        <header className="mb-6 space-y-5 sm:mb-8 sm:space-y-6">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-2xl font-extrabold tracking-tight text-pine sm:text-3xl">Account</h1>
          </div>

          <section aria-label="Your traveler profile" className="relative isolate mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-[#073d2d] p-4 text-white shadow-[0_12px_32px_rgba(7,61,45,0.16)] sm:rounded-3xl sm:p-6 lg:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 h-64 w-64 rounded-full border-[32px] border-white/[0.035]" />
            <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/35 bg-white/10 text-lg font-extrabold tracking-wide text-white shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="mt-1 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{profile.name || user.name}</h2>
                <p className="mt-1 truncate text-sm font-medium text-emerald-50/80">@{(profile.username || 'wanderer').toLowerCase()}</p>
              </div>
              {!editingProfile && <button
                type="button"
                ref={editProfileTriggerRef}
                onClick={() => {
                  setActiveTab('details');
                  setName(profile.name || '');
                  setUsername((profile.username || '').toLowerCase());
                  setEditingProfile(true);
                }}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#073d2d] shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#073d2d] sm:w-auto"
              >
                Edit profile
              </button>}
            </div>
          </section>

          <div role="tablist" aria-label="Profile settings" onKeyDown={handleProfileTabKeyDown} className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-1 rounded-xl border border-[#e1e8e3] bg-[#eef3ef] p-1 sm:gap-1.5 sm:p-1.5">
            <button
              type="button"
              id="profile-tab-details"
              role="tab"
              aria-selected={activeTab === 'details'}
              aria-controls="profile-panel-details"
              tabIndex={activeTab === 'details' ? 0 : -1}
              onClick={() => setActiveTab('details')}
              className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium sm:min-h-11 sm:gap-2 sm:px-3 sm:text-sm ${
                activeTab === 'details'
                  ? 'bg-white text-pine shadow-sm'
                  : 'text-[#526158] hover:bg-white/70'
              }`}
            >
              <UserRound size={15} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Profile</span>
            </button>

            <button
              type="button"
              id="profile-tab-security"
              role="tab"
              aria-selected={activeTab === 'security'}
              aria-controls="profile-panel-security"
              tabIndex={activeTab === 'security' ? 0 : -1}
              onClick={() => setActiveTab('security')}
              className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-medium sm:min-h-11 sm:gap-2 sm:px-3 sm:text-sm ${
                activeTab === 'security'
                  ? 'bg-white text-pine shadow-sm'
                  : 'text-[#526158] hover:bg-white/70'
              }`}
            >
              <Shield size={15} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Security</span>
            </button>

            <button
              type="button"
              id="profile-tab-danger"
              role="tab"
              aria-selected={activeTab === 'danger'}
              aria-controls="profile-panel-danger"
              tabIndex={activeTab === 'danger' ? 0 : -1}
              onClick={() => setActiveTab('danger')}
              className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 sm:min-h-11 sm:gap-2 sm:px-3 sm:text-sm ${
                activeTab === 'danger'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-[#9b3e32] hover:bg-white/70'
              }`}
            >
              <Trash2 size={15} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Delete</span>
            </button>
          </div>
        </header>

        {profileError && <div role="alert" className="mx-auto mb-5 flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-[#f0d7d3] bg-[#fff8f7] p-3 text-sm text-[#8d3830] sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <span>{profileError}</span>
          <button type="button" onClick={() => { setProfileError(''); setLoadedUserId(null); setProfileLoadVersion((version) => version + 1); }} className="min-h-10 shrink-0 self-start rounded-full px-3 text-sm font-bold text-[#8d3830] transition hover:bg-[#fcecea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:self-auto">Try again</button>
        </div>}

        {activeTab === 'details' && <div id="profile-panel-details" role="tabpanel" aria-labelledby="profile-tab-details" tabIndex={0} className="space-y-6 outline-none focus-visible:ring-2 focus-visible:ring-green-medium/40">
        <section aria-labelledby="travel-snapshot-heading" className="mx-auto grid w-full max-w-4xl gap-3 sm:gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Total trips', value: trips.length },
              { label: 'Destinations', value: destinationCount },
              { label: 'Past trips', value: pastTripCount },
            ].map((stat) => (
              <div key={stat.label} className="flex min-h-[5.5rem] min-w-0 flex-col justify-center rounded-2xl border border-[#e2e8e3] bg-white px-2.5 py-3 shadow-sm sm:min-h-28 sm:px-5 sm:py-5">
                <span className="text-2xl font-extrabold tracking-tight text-pine sm:text-3xl">
                  {currentTripsLoading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-[#edf2ee] align-middle sm:h-8" /> : tripsError ? '—' : stat.value}
                </span>
                <span className="mt-1 text-[10px] font-semibold leading-tight text-[#66736b] min-[360px]:text-[11px] sm:text-sm">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="relative isolate flex min-h-40 min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-[#073d2d] p-4 text-white shadow-sm sm:min-h-44 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-52 w-52 rounded-full bg-emerald-400/15 blur-2xl" />
            <div className="min-w-0 flex-1">
              <h2 id="travel-snapshot-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                <Plane size={14} /> {tripInProgress ? 'Your current trip' : 'Your next trip'}
              </h2>
              {currentTripsLoading ? (
                <div className="mt-3 h-6 w-48 animate-pulse rounded bg-white/15" aria-label="Loading trips" />
              ) : tripsError ? (
                <>
                  <p className="mt-2 text-lg font-extrabold sm:text-xl">Couldn’t load your trips</p>
                  <p className="mt-1 text-xs text-emerald-50/85 sm:text-sm">Open Trips to try again.</p>
                </>
              ) : upcomingTrip ? (
                <>
                  <p className="mt-2 truncate text-xl font-extrabold sm:text-2xl">{upcomingTrip.destination_name || upcomingTrip.title}</p>
                  {upcomingTrip.destination_name && upcomingTrip.title && upcomingTrip.title !== upcomingTrip.destination_name && (
                    <p className="mt-0.5 truncate text-xs text-emerald-100/80">Trip: {upcomingTrip.title}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-50/90 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{formatTripDate(upcomingTrip.start_date)}{upcomingTrip.end_date !== upcomingTrip.start_date && ` – ${formatTripDate(upcomingTrip.end_date)}`}</span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-lg font-extrabold sm:text-xl">No upcoming trips</p>
              )}
            </div>
            <div className="mt-4 flex w-full shrink-0 flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row">
              <Link
                to={upcomingTrip ? `/trips/${upcomingTrip.id}` : '/trips'}
                state={upcomingTrip ? { fromProfile: true } : undefined}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#073d2d] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                {upcomingTrip ? 'Open itinerary' : tripsError ? 'View my trips' : 'Plan a trip'} <ArrowRight size={15} />
              </Link>
              {upcomingTrip && <Link
                to="/trips"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                All trips
              </Link>}
            </div>
          </div>
        </section>

        {editingProfile && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingProfile(false); }}>
          <section ref={editProfileDialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-profile-dialog-title" className="app-scrollbar max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#e2e8e3] bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl">
            <div className="flex items-center justify-between gap-4 border-b border-[#eef2ef] px-4 py-4 sm:px-6 sm:py-5">
              <h2 id="edit-profile-dialog-title" className="text-lg font-bold text-pine sm:text-xl">Edit profile</h2>
              <button type="button" aria-label="Close edit profile" disabled={saving} onClick={() => setEditingProfile(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#66736b] transition hover:bg-[#f2f5f2] hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium disabled:opacity-50">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 sm:p-6">

            <form onSubmit={handleSaveProfile} className="grid gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-6">
              {/* Display Name */}
              <div className="min-w-0">
                <label htmlFor="profile-name" className="mb-1.5 block text-sm font-bold text-pine">
                  Name
                </label>
                <input
                  ref={profileNameInputRef}
                  id="profile-name"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
                  placeholder="Your name"
                />
              </div>

              {/* Unique Travel Username / Handle */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="profile-username" className="block text-sm font-bold text-pine">
                    Username
                  </label>
                  <button
                    type="button"
                    disabled={generatingUsername}
                    onClick={handleSuggestUsername}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#cbe5cf] bg-[#eef7f0] px-2.5 py-1 text-xs font-bold text-[#087b5d] transition-colors hover:bg-[#e0f2e3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium disabled:opacity-60"
                    title="Generate a username suggestion"
                  >
                    <Dices size={13} className={generatingUsername ? 'animate-spin' : ''} />
                    <span>{generatingUsername ? 'Suggesting…' : 'Suggest username'}</span>
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[#66736b]">
                    @
                  </span>
                  <input
                    id="profile-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase())}
                    className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white pl-8 pr-12 font-sans text-sm font-semibold tracking-wide text-pine outline-none transition focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
                    placeholder="nomadexplorer42"
                  />
                  <button
                    type="button"
                    onClick={handleCopyHandle}
                    aria-label={copiedHandle ? 'Username copied' : 'Copy username'}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[#66736b] transition hover:bg-[#f2f5f2] hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"
                    title="Copy username"
                  >
                    {copiedHandle ? <Check size={16} className="text-green-ink" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-[#66736b]">Used on your profile and for sign-in.</p>
              </div>

              {/* Email Address — DISABLED / READ-ONLY */}
              <div className="min-w-0 sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-bold text-pine">
                    Email
                  </span>
                  <span className="text-xs font-semibold text-[#85948a] bg-[#f0f4f1] px-2 py-0.5 rounded-md">
                    Read-only
                  </span>
                </div>
                <p className="min-h-11 break-all rounded-xl border border-[#e2e8e3] bg-[#f8f9fa] px-3.5 py-3 text-sm font-medium text-[#66736b]">{profile.email || email}</p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#eef2ef] pt-4 sm:col-span-2 sm:flex-row sm:justify-end sm:gap-3 sm:pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setName(profile.name || '');
                    setUsername((profile.username || '').toLowerCase());
                    setEditingProfile(false);
                  }}
                  className="min-h-11 rounded-full px-5 text-sm font-bold text-[#526158] transition-colors hover:bg-[#f2f5f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-full bg-btn-primary-bg px-7 text-sm font-bold text-btn-primary-text shadow-sm transition-colors hover:bg-btn-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
            </div>
          </section>
        </div>}
        </div>}

        {/* ── TAB 2: Sign-in & Security ───────────────────────────────── */}
        {activeTab === 'security' && (
          <div id="profile-panel-security" role="tabpanel" aria-labelledby="profile-tab-security" tabIndex={0} className="mx-auto w-full max-w-4xl space-y-4 outline-none focus-visible:ring-2 focus-visible:ring-green-medium/40 sm:space-y-6">
            {/* Connected Sign-In Methods */}
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="border-b border-[#eef2ef] pb-4 mb-5">
                <h2 className="text-lg font-bold text-pine">Sign-in methods</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {/* Google card */}
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pine">Google</p>
                    </div>
                  </div>
                  {profile.providers?.google ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-badge-bg px-2.5 py-1 text-xs font-bold text-badge-text">
                      <CheckCircle2 size={13} className="text-green-ink" /> Connected
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 font-medium">Not linked</span>
                  )}
                </div>

                {/* Password card */}
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100 text-pine">
                      <Lock size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pine">Password</p>
                      <p className="text-xs text-[#66736b]">Email or username</p>
                    </div>
                  </div>
                  {profile.providers?.email ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-badge-bg px-2.5 py-1 text-xs font-bold text-badge-text">
                      <CheckCircle2 size={13} className="text-green-ink" /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Not set
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Set / Change Password */}
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="border-b border-[#eef2ef] pb-4 mb-5">
                <h2 className="text-lg font-bold text-pine">
                  {profile.providers?.email ? 'Change password' : 'Add a password'}
                </h2>
                <p className="text-xs text-[#66736b] mt-0.5">
                  {profile.providers?.email
                    ? 'Choose a new password for your account.'
                    : 'Sign in with your email or username.'}
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="max-w-2xl space-y-5">
                {profile.providers?.email && (
                  <div>
                    <label htmlFor="current-password" className="mb-1.5 block text-sm font-bold text-pine">
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        id="current-password"
                        type={showCurrentPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 pr-12 text-sm font-medium text-pine outline-none transition focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        aria-label={showCurrentPass ? 'Hide current password' : 'Show current password'}
                        aria-pressed={showCurrentPass}
                        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[#66736b] transition hover:bg-[#f2f5f2] hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-bold text-pine">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 pr-12 text-sm font-medium text-pine outline-none transition focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      aria-label={showNewPass ? 'Hide new password' : 'Show new password'}
                      aria-pressed={showNewPass}
                      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[#66736b] transition hover:bg-[#f2f5f2] hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-bold text-pine">
                    Confirm password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
                    placeholder="Repeat new password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="h-11 rounded-full bg-btn-primary-bg px-7 text-sm font-bold text-btn-primary-text shadow-sm transition-colors hover:bg-btn-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-medium focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPassword
                      ? 'Saving…'
                      : profile.providers?.email
                      ? 'Update password'
                      : 'Set password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 3: Delete Account ───────────────────────────────────── */}
        {activeTab === 'danger' && (
          <div id="profile-panel-danger" role="tabpanel" aria-labelledby="profile-tab-danger" tabIndex={0} className="mx-auto w-full max-w-4xl rounded-2xl border border-red-200 bg-white p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-red-100 pb-4 mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-950">Delete account</h2>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
              <p className="max-w-xl text-sm leading-relaxed text-red-800">
                Permanently delete your profile, trips, and account data. This can’t be undone.
              </p>

              <button
                type="button"
                ref={deleteAccountTriggerRef}
                onClick={() => {
                  setDeleteConfirmationInput('');
                  setShowDeleteModal(true);
                }}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-xs font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-700 cursor-pointer sm:w-auto"
              >
                <Trash2 size={14} />
                <span>Delete account</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setShowDeleteModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-account-dialog-title" className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-red-100 bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 shrink-0">
                <AlertCircle size={22} />
              </div>
              <h3 id="delete-account-dialog-title" className="text-lg font-bold text-red-950">Delete account?</h3>
            </div>

            <p className="text-sm text-[#526158] leading-relaxed mb-4">
              This deletes <strong className="text-red-700 font-mono">{profile.username || username ? `@${(profile.username || username).toLowerCase()}` : 'your account'}</strong> and its trip data permanently.
            </p>

            <div className="mb-5">
              <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-xs font-bold text-pine">
                Type <span className="font-mono text-red-600 font-extrabold">DELETE</span> to confirm
              </label>
              <input
                id="delete-account-confirmation"
                ref={deleteConfirmationInputRef}
                type="text"
                autoComplete="off"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-300 px-3 text-sm font-mono font-bold text-pine focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="h-10 px-4 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isDeleting ||
                    deleteConfirmationInput.trim() !== 'DELETE'
                }
                onClick={handleDeleteAccount}
                className="h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
