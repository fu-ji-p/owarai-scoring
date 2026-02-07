import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '../types/database';
import { demoDb, initDemoData } from '../lib/demoData';
import { hashPin, storage } from '../lib/utils';

interface AuthContextType {
  user: Pick<User, 'id' | 'name' | 'avatar_emoji' | 'is_admin'> | null;
  users: User[];
  loading: boolean;
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initDemoData();
      setUsers(demoDb.getUsers());

      // Restore session from localStorage
      const saved = storage.getUser();
      if (saved) {
        const dbUser = demoDb.getUserById(saved.id);
        if (dbUser) {
          setUser({
            id: dbUser.id,
            name: dbUser.name,
            avatar_emoji: dbUser.avatar_emoji,
            is_admin: dbUser.is_admin,
          });
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (userId: string, pin: string): Promise<boolean> => {
    const dbUser = demoDb.getUserById(userId);
    if (!dbUser) return false;

    const pinHash = await hashPin(pin);
    if (pinHash !== dbUser.pin_hash) return false;

    const sessionUser = {
      id: dbUser.id,
      name: dbUser.name,
      avatar_emoji: dbUser.avatar_emoji,
      is_admin: dbUser.is_admin,
    };
    setUser(sessionUser);
    storage.setUser(sessionUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    storage.clearUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, users, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
