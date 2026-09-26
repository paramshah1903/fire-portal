import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, toApiError } from '../lib/api';
import type { PermKey, RoleKey } from '../lib/permissions';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  roleKey: RoleKey;
  roleName: string;
  permissions: string[];
  unitId: string | null;
  departmentId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (...keys: PermKey[]) => boolean;
  hasAnyPermission: (...keys: PermKey[]) => boolean;
  hasRole: (...roles: RoleKey[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] =
    useState<'loading' | 'authenticated' | 'anonymous'>('loading');

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(data.user);
      setStatus('authenticated');
    } catch (err) {
      const { status: httpStatus } = toApiError(err);
      if (httpStatus === 401) {
        setUser(null);
        setStatus('anonymous');
      } else {
        // network/server error — treat as anonymous but keep last user null
        setUser(null);
        setStatus('anonymous');
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', {
      username,
      password,
    });
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const held = new Set(user?.permissions ?? []);
    return {
      user,
      status,
      login,
      logout,
      refresh,
      hasPermission: (...keys) => keys.every((k) => held.has(k)),
      hasAnyPermission: (...keys) => keys.some((k) => held.has(k)),
      hasRole: (...roles) =>
        user ? roles.includes(user.roleKey as RoleKey) : false,
    };
  }, [user, status, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
