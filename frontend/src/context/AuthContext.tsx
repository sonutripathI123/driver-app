import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  /** True while the stored token is being validated against the API on boot. */
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = 'chauffeur_access_token';
const REFRESH_KEY = 'chauffeur_refresh_token';
const USER_KEY = 'chauffeur_user';

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

const readStoredUser = (): User | null => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
};

/** Turns an axios failure into something worth showing a dispatcher. */
const describeLoginError = (error: any): string => {
  const status = error?.response?.status;
  if (status === 401) return 'Incorrect email or password.';
  if (status === 403) return 'This account is not permitted to sign in.';
  if (status === 422) return 'Please enter a valid email address.';
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (!error?.response) {
    return 'Cannot reach the Opal Cloud Engine. Check your connection and try again.';
  }
  return 'Sign-in failed. Please try again.';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setLoginError(null);
  }, []);

  // A stored token may be expired or issued by an older deployment, so confirm
  // it with the API before trusting the cached user.
  useEffect(() => {
    if (!token) {
      setIsBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fresh = await authApi.me();
        if (cancelled) return;
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per token value; re-validating on every render would loop.
  }, [token, logout]);

  // The API layer emits this when any call comes back 401/403.
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('chauffeur:unauthorized', onUnauthorized);
    return () => window.removeEventListener('chauffeur:unauthorized', onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await authApi.login(email.trim(), password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      localStorage.setItem(REFRESH_KEY, res.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      setToken(res.access_token);
      setIsBootstrapping(false);
    } catch (error) {
      clearSession();
      setToken(null);
      setUser(null);
      const message = describeLoginError(error);
      setLoginError(message);
      throw new Error(message);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        currentRole: user?.role ?? null,
        isAuthenticated: !!token && !!user,
        isBootstrapping,
        isLoggingIn,
        loginError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
