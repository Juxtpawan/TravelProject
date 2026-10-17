import { useEffect, useState } from 'react';
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
  const [tripsError, setTripsError] = useState(false);

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'security' | 'danger'
  const [loadedUserId, setLoadedUserId] = useState(null);
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

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return undefined;

    let isMounted = true;
    getProfile(user.id)
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setName(data.name || '');
        setEmail(data.email || '');
        setUsername(data.username || '');
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err.response?.data?.error || 'Failed to load profile.');
      })
      .finally(() => {
        if (isMounted) setLoadedUserId(user.id);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return undefined;
    let isMounted = true;
    setTripsLoading(true);
    getTrips()
      .then((data) => {
        if (!isMounted) return;
        setTrips(data);
        setTripsError(false);
      })
      .catch(() => { if (isMounted) setTripsError(true); })
      .finally(() => { if (isMounted) setTripsLoading(false); });
    return () => { isMounted = false; };
  }, [authLoading, user?.id]);

  const handleCopyHandle = () => {
    if (!username) return;
    navigator.clipboard.writeText(`@${username}`);
    setCopiedHandle(true);
    toast.success('Travel handle copied to clipboard!');
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const handleSuggestUsername = async () => {
    setGeneratingUsername(true);
    try {
      const res = await suggestUsername();
      if (res?.username) {
        setUsername(res.username);
        toast.success(`Suggested: @${res.username}`);
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
      const res = await updateProfile(user.id, {
        name: name.trim(),
        username: username.trim() || null,
      });

      const updatedUser = res.user || {
        ...profile,
        name: name.trim(),
        username: username.trim(),
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
    if (deleteConfirmationInput.trim() !== 'DELETE' && deleteConfirmationInput.trim() !== username) {
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
        <p className="mt-2 text-sm text-[#66736b] max-w-sm">
          Sign in to access your personal details, travel handle, and saved trips.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-[#00eb5b] hover:bg-[#00d050] px-7 text-sm font-bold text-[#003924] transition-colors cursor-pointer shadow-sm"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const initials = profile.name?.trim()?.[0]?.toUpperCase() || user.name?.[0]?.toUpperCase() || '✈️';
  const todayKey = getLocalDateKey();
  const upcomingTrip = trips.find((trip) => trip.end_date >= todayKey);
  const tripInProgress = Boolean(upcomingTrip && upcomingTrip.start_date <= todayKey);
  const pastTripCount = trips.filter((trip) => trip.end_date < todayKey).length;
  const destinationCount = new Set(trips.map((trip) => trip.destination_name).filter(Boolean)).size;

  return (
    <div className="w-full min-h-[calc(100vh-72px)] bg-[#f6f8f6] py-5 sm:py-8 lg:py-10">
      <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8">
        
        {/* ── Page Header (Simple TripAdvisor / Wanderlog style) ──────── */}
        <div className="mb-6 border-b border-[#e5eae6] pb-5 sm:mb-8 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                Account Settings
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-pine sm:text-3xl">
                Profile & Preferences
              </h1>
              <p className="text-sm text-[#66736b] mt-1">
                Manage your travel handle, personal identity, and security.
              </p>
            </div>

            {/* Quick Profile Pill */}
            <div className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[#e2e8e3] bg-white p-3 shadow-[0_8px_24px_rgba(24,49,37,0.06)] sm:w-auto sm:max-w-full sm:p-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d6dfd8] bg-[#FAF1ED] text-base font-bold text-pine ring-4 ring-[#f5f8f5]">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight text-pine sm:text-[15px]">
                  {profile.name || user.name}
                </p>
                <p className="mt-1 truncate text-xs font-mono font-medium text-[#66736b]">
                  @{profile.username || 'wanderer'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Horizontal Navigation Tabs (Always Visible, Mobile-Friendly) ── */}
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors cursor-pointer sm:rounded-full sm:px-4 ${
                activeTab === 'details'
                  ? 'bg-[#003924] text-white shadow-xs'
                  : 'bg-white text-[#526158] hover:bg-[#f2f5f2] border border-[#e2e8e3]'
              }`}
            >
              <UserRound size={15} />
              <span>Personal Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors cursor-pointer sm:rounded-full sm:px-4 ${
                activeTab === 'security'
                  ? 'bg-[#003924] text-white shadow-xs'
                  : 'bg-white text-[#526158] hover:bg-[#f2f5f2] border border-[#e2e8e3]'
              }`}
            >
              <Shield size={15} />
              <span>Sign-in & Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('danger')}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors cursor-pointer sm:rounded-full sm:px-4 ${
                activeTab === 'danger'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
              }`}
            >
              <Trash2 size={15} />
              <span>Delete Account</span>
            </button>
          </div>
        </div>

        {activeTab === 'details' && <section aria-labelledby="travel-snapshot-heading" className="mx-auto mb-6 grid w-full max-w-4xl gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Total trips', value: trips.length },
              { label: 'Destinations', value: destinationCount },
              { label: 'Past trips', value: pastTripCount },
            ].map((stat) => (
              <div key={stat.label} className="flex min-h-[5.5rem] min-w-0 flex-col justify-center rounded-2xl border border-[#e2e8e3] bg-white px-2.5 py-3 shadow-sm sm:min-h-28 sm:px-5 sm:py-5">
                <span className="text-2xl font-extrabold tracking-tight text-pine sm:text-3xl">
                  {tripsLoading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-[#edf2ee] align-middle sm:h-8" /> : tripsError ? '—' : stat.value}
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
              {tripsLoading ? (
                <div className="mt-3 h-6 w-48 animate-pulse rounded bg-white/15" aria-label="Loading trips" />
              ) : tripsError ? (
                <>
                  <p className="mt-2 text-lg font-extrabold sm:text-xl">Your trip plans aren’t available</p>
                  <p className="mt-1 text-xs text-emerald-50/85 sm:text-sm">Open My Trips to try loading them again.</p>
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
                <>
                  <p className="mt-2 text-lg font-extrabold sm:text-xl">Your next trip starts here</p>
                  <p className="mt-1 text-xs text-emerald-50/85 sm:text-sm">Choose a destination and turn it into a day-by-day plan.</p>
                </>
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
              <Link
                to="/trips"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                View all trips
              </Link>
            </div>
          </div>
        </section>}

        {/* ── TAB 1: Personal Details ─────────────────────────────────── */}
        {activeTab === 'details' && (
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="border-b border-[#eef2ef] pb-4 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-pine">Personal Information</h2>
                  <p className="text-xs text-[#66736b] mt-0.5">
                    Update your display name and unique travel handle.
                  </p>
                </div>
                {!editingProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(profile.name || '');
                      setUsername(profile.username || '');
                      setEditingProfile(true);
                    }}
                    className="h-9 shrink-0 rounded-full border border-[#cbe5cf] bg-[#eef7f0] px-4 text-sm font-bold text-[#003924] hover:bg-[#e0f2e3]"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="grid gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-6">
              {/* Display Name */}
              <div className="min-w-0">
                <label className="block text-sm font-bold text-pine mb-1.5">
                  Full Name / Display Name
                </label>
                {editingProfile ? <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                  placeholder="e.g. Jordan Rivera"
                /> : <p className="min-h-11 rounded-xl border border-[#e2e8e3] bg-[#f8f9fa] px-3.5 py-3 text-sm font-medium text-pine">{profile.name || 'Not set'}</p>}
              </div>

              {/* Unique Travel Username / Handle */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-sm font-bold text-pine">
                    Travel Username / Handle
                  </label>
                  {editingProfile && <button
                    type="button"
                    disabled={generatingUsername}
                    onClick={handleSuggestUsername}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003924] bg-[#eef7f0] hover:bg-[#e0f2e3] border border-[#cbe5cf] px-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:opacity-60"
                    title="Suggest a random travel handle"
                  >
                    <Dices size={13} className={generatingUsername ? 'animate-spin' : ''} />
                    <span>{generatingUsername ? 'Rolling…' : 'Suggest random handle'}</span>
                  </button>}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[#66736b]">
                    @
                  </span>
                  {editingProfile ? <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white pl-8 pr-10 font-mono text-sm font-semibold text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                    placeholder="NomadExplorer42"
                  /> : <p className="min-h-11 rounded-xl border border-[#e2e8e3] bg-[#f8f9fa] py-3 pl-8 pr-3 font-mono text-sm font-semibold text-[#66736b]">@{profile.username || 'wanderer'}</p>}
                  {editingProfile && <button
                    type="button"
                    onClick={handleCopyHandle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736b] hover:text-pine cursor-pointer"
                    title="Copy handle"
                  >
                    {copiedHandle ? <Check size={16} className="text-[#00d050]" /> : <Copy size={16} />}
                  </button>}
                </div>
                <p className="mt-1.5 text-xs text-[#66736b]">
                  Unique handle for your profile. You can also use this username to log into your account!
                </p>
              </div>

              {/* Email Address — DISABLED / READ-ONLY */}
              <div className="min-w-0 sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-pine">
                    Email Address
                  </label>
                  <span className="text-xs font-semibold text-[#85948a] bg-[#f0f4f1] px-2 py-0.5 rounded-md">
                    Non-editable
                  </span>
                </div>
                <p className="min-h-11 rounded-xl border border-[#e2e8e3] bg-[#f8f9fa] px-3.5 py-3 text-sm font-medium text-[#66736b]">{profile.email || email}</p>
                <p className="mt-1.5 text-xs text-[#85948a]">
                  Email address is linked to your account and cannot be modified.
                </p>
              </div>

              {editingProfile && <div className="flex flex-col-reverse gap-2 border-t border-[#eef2ef] pt-4 sm:col-span-2 sm:flex-row sm:justify-end sm:gap-3 sm:pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setName(profile.name || '');
                    setUsername(profile.username || '');
                    setEditingProfile(false);
                  }}
                  className="min-h-11 rounded-full px-5 text-sm font-bold text-[#526158] transition-colors hover:bg-[#f2f5f2] cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-full bg-[#00eb5b] px-7 text-sm font-bold text-[#003924] shadow-sm transition-colors hover:bg-[#00d050] cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving changes…' : 'Save Changes'}
                </button>
              </div>}
            </form>
          </div>
        )}

        {/* ── TAB 2: Sign-in & Security ───────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
            {/* Connected Sign-In Methods */}
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="border-b border-[#eef2ef] pb-4 mb-5">
                <h2 className="text-lg font-bold text-pine">Connected Sign-in Methods</h2>
                <p className="text-xs text-[#66736b] mt-0.5">
                  See which login credentials are currently linked to your account.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {/* Google card */}
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pine">Google Sign-in</p>
                      <p className="text-xs text-[#66736b]">OAuth provider</p>
                    </div>
                  </div>
                  {profile.providers?.google ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#003924] bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={13} className="text-[#00d050]" /> Connected
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 font-medium">Not linked</span>
                  )}
                </div>

                {/* Password card */}
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100 text-pine">
                      <Lock size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pine">Password Login</p>
                      <p className="text-xs text-[#66736b]">Email or handle</p>
                    </div>
                  </div>
                  {profile.providers?.email ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#003924] bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={13} className="text-[#00d050]" /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Not set yet
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Set / Change Password */}
            <div className="rounded-2xl border border-[#e2e8e3] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="border-b border-[#eef2ef] pb-4 mb-5">
                <h2 className="text-lg font-bold text-pine">
                  {profile.providers?.email ? 'Change Password' : 'Create a Password'}
                </h2>
                <p className="text-xs text-[#66736b] mt-0.5">
                  {profile.providers?.email
                    ? 'Update your existing password.'
                    : 'Setting a password allows you to log in with your email or travel handle (@' + (username || 'username') + ') alongside Google.'}
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="max-w-2xl space-y-5">
                {profile.providers?.email && (
                  <div>
                    <label className="block text-sm font-bold text-pine mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 pr-10 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736b] hover:text-pine cursor-pointer"
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-pine mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 pr-10 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736b] hover:text-pine cursor-pointer"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-pine mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                    placeholder="Repeat new password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="h-11 px-7 rounded-full bg-[#00eb5b] hover:bg-[#00d050] text-[#003924] font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {savingPassword
                      ? 'Saving…'
                      : profile.providers?.email
                      ? 'Update Password'
                      : 'Set Account Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 3: Delete Account ───────────────────────────────────── */}
        {activeTab === 'danger' && (
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-red-100 pb-4 mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-950">Delete Account</h2>
                <p className="text-xs text-red-600">
                  Permanently delete your account and its data.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
              <div>
                <h3 className="text-sm font-bold text-red-950">Delete your account</h3>
                <p className="text-xs text-red-800 mt-1 max-w-xl leading-relaxed">
                  This action is permanent. Your profile, saved trips, itineraries, preferences, and sign-in credentials will be deleted and can’t be recovered.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmationInput('');
                  setShowDeleteModal(true);
                }}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-xs font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-700 cursor-pointer sm:w-auto"
              >
                <Trash2 size={14} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-red-100 bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 shrink-0">
                <AlertCircle size={22} />
              </div>
              <h3 className="text-lg font-bold text-red-950">Delete Account Permanently</h3>
            </div>

            <p className="text-sm text-[#526158] leading-relaxed mb-4">
              Are you sure? Your account <strong className="text-red-700 font-mono">@{profile.username}</strong> and all travel history will be permanently erased.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-pine mb-1.5">
                Type <span className="font-mono text-red-600 font-extrabold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
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
                  (deleteConfirmationInput.trim() !== 'DELETE' &&
                    deleteConfirmationInput.trim() !== username)
                }
                onClick={handleDeleteAccount}
                className="h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
