import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin } from '../api/useLogin';
import SocialAuthButtons from './SocialAuthButtons';

function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { submit, isLoading, error } = useLogin();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submit(identifier, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch {
      // `error` from useLogin already holds the message
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-pine mb-1">
          Email or Travel Username
        </label>
        <input
          type="text"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="h-12 w-full rounded-xl border border-gray bg-white px-3.5 text-sm text-pine outline-none transition placeholder:text-[#89958e] focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
          placeholder="you@example.com or NomadExplorer42"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pine mb-1">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-xl border border-gray bg-white px-3.5 text-sm text-pine outline-none transition placeholder:text-[#89958e] focus:border-green-medium focus:ring-2 focus:ring-green-medium/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 rounded-lg bg-btn-primary-bg text-btn-primary-text text-sm font-semibold hover:bg-btn-primary-bg-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        {isLoading ? 'Logging in…' : 'Log in'}
      </button>

      <div className="flex items-center gap-3 my-1">
        <div className="h-px flex-1 bg-gray" />
        <span className="text-xs text-pine/50">or</span>
        <div className="h-px flex-1 bg-gray" />
      </div>

      <SocialAuthButtons />

      <p className="text-center text-sm text-pine/70 mt-2">
        New here?{' '}
        <Link to="/auth/signup" state={location.state} className="text-moss font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default LoginForm;
