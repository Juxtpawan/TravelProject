import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/authApi';

export const AuthContext = createContext(null);

/**
 * FIX: race condition between the initial getMe() check (on mount) and a
 * real login/signup/Google action. If getMe() is still in flight (or a
 * duplicate one fires, e.g. from StrictMode's double-effect in dev) and it
 * resolves AFTER a successful login, its stale result can overwrite the
 * correct logged-in state with null. `authVersion` guards against that:
 * every state-changing action bumps it, and any async result that isn't
 * from the CURRENT version is discarded instead of applied.
 */
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

  const login = useCallback(async (email, password) => {
    authVersion.current++; // invalidate any in-flight/stale check
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

  const value = { user, isLoading, login, signup, loginWithGoogle, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}