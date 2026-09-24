import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../api/useLogin';
import SocialAuthButtons from './SocialAuthButtons';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit, isLoading, error } = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submit(email, password);
      navigate('/');
    } catch {
      // `error` from useLogin already holds the message — nothing else to do
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-pine mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray px-3 py-2 text-sm text-pine focus:outline-none focus:ring-2 focus:ring-moss"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pine mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray px-3 py-2 text-sm text-pine focus:outline-none focus:ring-2 focus:ring-moss"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 rounded-lg bg-pine text-white text-sm font-semibold hover:bg-moss transition-colors disabled:opacity-60"
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
        <Link to="/auth/signup" className="text-moss font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default LoginForm;