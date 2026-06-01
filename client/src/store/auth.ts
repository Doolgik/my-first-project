import { create } from 'zustand';
import { api, setAccessToken } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  initializing: boolean;
  setUser: (user: User | null) => void;
  bootstrap: () => Promise<void>;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  setUser: (user) => set({ user }),

  bootstrap: async () => {
    try {
      const res = await api.post('/auth/refresh');
      setAccessToken(res.data.accessToken);
      const me = await api.get('/auth/me');
      set({ user: me.data.user, initializing: false });
    } catch {
      setAccessToken(null);
      set({ user: null, initializing: false });
    }
  },

  login: async (emailOrUsername, password) => {
    const res = await api.post('/auth/login', { emailOrUsername, password });
    setAccessToken(res.data.accessToken);
    set({ user: res.data.user });
  },

  register: async (data) => {
    const res = await api.post('/auth/register', data);
    setAccessToken(res.data.accessToken);
    set({ user: res.data.user });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    set({ user: null });
  },
}));
