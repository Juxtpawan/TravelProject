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
      const serverMessage = err?.response?.data?.error;
      const message = typeof serverMessage === 'string'
        ? serverMessage
        : err?.code === 'ECONNABORTED'
          ? 'The login server took too long to respond. Make sure the backend is running, then try again.'
          : !err?.response
            ? 'Could not connect to the login server. Make sure the backend is running, then try again.'
            : 'Login failed. Check your details and try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}
