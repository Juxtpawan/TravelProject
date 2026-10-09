import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserRound,
  AtSign,
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
  Compass,
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

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'security' | 'danger'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

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
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    getProfile(user.id)
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setName(data.name || '');
        setEmail(data.email || '');
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url || '');
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err.response?.data?.error || 'Failed to load profile.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
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
        avatarUrl: avatarUrl.trim() || null,
      });

      const updatedUser = res.user || {
        ...profile,
        name: name.trim(),
        username: username.trim(),
        avatar_url: avatarUrl.trim() || null,
      };

      setProfile((prev) => ({ ...prev, ...updatedUser }));
      if (updateUser) {
        updateUser({
          name: updatedUser.name,
          username: updatedUser.username,
          avatarUrl: updatedUser.avatar_url,
        });
      }

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

  return (
    <div className="w-full bg-[#f8f9fa] min-h-[calc(100vh-72px)] py-8 sm:py-10">
      <div className="w-full max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── Page Header (Simple TripAdvisor / Wanderlog style) ──────── */}
        <div className="border-b border-[#e5eae6] pb-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                Account Settings
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-pine tracking-tight">
                Profile & Preferences
              </h1>
              <p className="text-sm text-[#66736b] mt-1">
                Manage your travel handle, personal identity, and security.
              </p>
            </div>

            {/* Quick Profile Pill */}
            <div className="flex items-center gap-3 bg-white border border-[#e2e8e3] rounded-2xl p-2.5 sm:px-4 shadow-2xs self-start sm:self-auto">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-[#FAF1ED] border border-[#d6dfd8] grid place-items-center text-pine font-bold text-base shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-pine truncate leading-tight">
                  {profile.name || user.name}
                </p>
                <p className="text-xs font-mono text-emerald-800 font-semibold truncate">
                  @{profile.username || 'wanderer'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Horizontal Navigation Tabs (Always Visible, Mobile-Friendly) ── */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors cursor-pointer ${
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
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors cursor-pointer ${
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
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors cursor-pointer ${
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

        {/* ── TAB 1: Personal Details ─────────────────────────────────── */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl border border-[#e2e8e3] p-6 sm:p-8 shadow-xs max-w-3xl">
            <div className="border-b border-[#eef2ef] pb-4 mb-6">
              <h2 className="text-lg font-bold text-pine">Personal Information</h2>
              <p className="text-xs text-[#66736b] mt-0.5">
                Update your display name and unique travel handle.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-bold text-pine mb-1.5">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                  placeholder="e.g. Jordan Rivera"
                />
              </div>

              {/* Unique Travel Username / Handle */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-sm font-bold text-pine">
                    Travel Username / Handle
                  </label>
                  <button
                    type="button"
                    disabled={generatingUsername}
                    onClick={handleSuggestUsername}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003924] bg-[#eef7f0] hover:bg-[#e0f2e3] border border-[#cbe5cf] px-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:opacity-60"
                    title="Suggest a random travel handle"
                  >
                    <Dices size={13} className={generatingUsername ? 'animate-spin' : ''} />
                    <span>{generatingUsername ? 'Rolling…' : 'Suggest random handle'}</span>
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[#66736b]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white pl-8 pr-10 font-mono text-sm font-semibold text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                    placeholder="NomadExplorer42"
                  />
                  <button
                    type="button"
                    onClick={handleCopyHandle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736b] hover:text-pine cursor-pointer"
                    title="Copy handle"
                  >
                    {copiedHandle ? <Check size={16} className="text-[#00d050]" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-[#66736b]">
                  Unique handle for your profile. You can also use this username to log into your account!
                </p>
              </div>

              {/* Email Address — DISABLED / READ-ONLY */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-pine">
                    Email Address
                  </label>
                  <span className="text-xs font-semibold text-[#85948a] bg-[#f0f4f1] px-2 py-0.5 rounded-md">
                    Non-editable
                  </span>
                </div>
                <input
                  type="email"
                  disabled
                  readOnly
                  value={email}
                  className="h-11 w-full rounded-xl border border-[#e2e8e3] bg-[#f2f4f2] px-3.5 text-sm font-medium text-[#66736b] cursor-not-allowed outline-none select-all"
                  title="Email cannot be modified"
                />
                <p className="mt-1.5 text-xs text-[#85948a]">
                  Email address is linked to your account and cannot be modified.
                </p>
              </div>

              {/* Profile Image URL */}
              <div>
                <label className="block text-sm font-bold text-pine mb-1.5">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-white px-3.5 text-sm font-medium text-pine outline-none transition focus:border-[#00d050] focus:ring-2 focus:ring-[#00d050]/20"
                />
                <p className="mt-1.5 text-xs text-[#66736b]">
                  Enter a public URL for your profile avatar.
                </p>
              </div>

              {/* Action Buttons: Button #00eb5b / Hover #00d050 */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-5 border-t border-[#eef2ef]">
                <button
                  type="button"
                  onClick={() => {
                    setName(profile.name || '');
                    setUsername(profile.username || '');
                    setAvatarUrl(profile.avatar_url || '');
                  }}
                  className="h-10 px-5 rounded-full text-sm font-bold text-[#526158] hover:bg-[#f2f5f2] transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-7 rounded-full bg-[#00eb5b] hover:bg-[#00d050] text-[#003924] font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving changes…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 2: Sign-in & Security ───────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-3xl">
            {/* Connected Sign-In Methods */}
            <div className="bg-white rounded-2xl border border-[#e2e8e3] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eef2ef] pb-4 mb-5">
                <h2 className="text-lg font-bold text-pine">Connected Sign-in Methods</h2>
                <p className="text-xs text-[#66736b] mt-0.5">
                  See which login credentials are currently linked to your account.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Google card */}
                <div className="p-4 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div>
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
                <div className="p-4 rounded-xl border border-[#e2e8e3] bg-[#fafcfa] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-2xs border border-gray-100 text-pine">
                      <Lock size={18} />
                    </div>
                    <div>
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
            <div className="bg-white rounded-2xl border border-[#e2e8e3] p-6 sm:p-8 shadow-xs">
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

              <form onSubmit={handleChangePassword} className="space-y-5">
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
          <div className="bg-white rounded-2xl border border-red-200 p-6 sm:p-8 shadow-xs max-w-3xl">
            <div className="flex items-center gap-3 border-b border-red-100 pb-4 mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-950">Danger Zone</h2>
                <p className="text-xs text-red-600">
                  Permanently remove your account and all associated data.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 rounded-xl border border-red-200 bg-red-50/40">
              <div>
                <h3 className="text-sm font-bold text-red-950">Delete Entire Account</h3>
                <p className="text-xs text-red-800 mt-1 max-w-xl leading-relaxed">
                  Once deleted, your account cannot be recovered. All saved trips, itineraries, preferences, and login credentials will be erased immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmationInput('');
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wide shadow-2xs transition-colors cursor-pointer shrink-0"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-red-100">
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

            <div className="flex items-center justify-end gap-3">
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