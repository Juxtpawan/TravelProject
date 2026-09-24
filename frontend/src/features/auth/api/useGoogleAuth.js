import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Used by SocialAuthButtons.jsx — takes the Google ID token from
 * @react-oauth/google's onSuccess callback and exchanges it with your
 * backend for a real session.
 */
export function useGoogleAuth() {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (idToken) => {
    setIsLoading(true);
    setError(null);
    try {
      return await loginWithGoogle(idToken);
    } catch (err) {
      setError(err?.message || 'Google sign-in failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}