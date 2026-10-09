import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/authApi';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const authVersion = useRef(0);

  useEffect(() => {
    const myVersion = ++authVersion.current;
    authApi
      .getMe()
      .then((u) => {
        if (authVersion.current === myVersion) setUser(u);
      })
      .catch(() => {
        if (authVersion.current === myVersion) setUser(null);
      })
      .finally(() => {
        if (authVersion.current === myVersion) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const clearExpiredSession = () => {
      authVersion.current++;
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('auth:session-expired', clearExpiredSession);
    return () => window.removeEventListener('auth:session-expired', clearExpiredSession);
  }, []);

  const login = useCallback(async (email, password) => {
    authVersion.current++;
    const loggedInUser = await authApi.login(email, password);
    setUser(loggedInUser);
    setIsLoading(false);
    return loggedInUser;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    authVersion.current++;
    const newUser = await authApi.signup(name, email, password);
    setUser(newUser);
    setIsLoading(false);
    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    authVersion.current++;
    const loggedInUser = await authApi.googleAuth(idToken);
    setUser(loggedInUser);
    setIsLoading(false);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    authVersion.current++;
    await authApi.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser((curr) => (curr ? { ...curr, ...updatedData } : null));
  }, []);

  const value = { user, isLoading, login, signup, loginWithGoogle, logout, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
