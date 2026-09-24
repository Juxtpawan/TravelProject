import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function useSignup() {
  const { signup } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (name, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      return await signup(name, email, password);
    } catch (err) {
      setError(err?.message || 'Could not create your account.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}