'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@/server/db/types';
import { apiClient } from '@/lib/api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const currentUser = await apiClient.getMe();
        setUser(currentUser);
      } catch {
        // No session cookie or invalid token, user is not logged in
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const logout = async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
