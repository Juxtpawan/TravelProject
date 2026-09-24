import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Thin wrapper around AuthContext's login() that adds per-form loading/error
 * state — used directly inside LoginForm.jsx.
 */
export function useLogin() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      return await login(email, password);
    } catch (err) {
      setError(err?.message || 'Invalid email or password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}