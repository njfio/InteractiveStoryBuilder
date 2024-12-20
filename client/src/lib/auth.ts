import { supabase } from './supabase';
import { create } from 'zustand';

type User = {
  id: string;
  email: string | undefined;
  displayName?: string;
};

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<(() => void) | undefined>;
  checkSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  initialize: async () => {
    if (get().initialized) {
      return undefined;
    }

    try {
      set({ loading: true });
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          loading: false,
          initialized: true,
        });
      } else {
        set({ user: null, loading: false, initialized: true });
      }

      // Subscribe to auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({
            user: {
              id: session.user.id,
              email: session.user.email,
            },
            loading: false,
          });
        } else {
          set({ user: null, loading: false });
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ user: null, loading: false, initialized: true });
      return undefined;
    }
  },
  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email,
          },
        });
        return true;
      }
      set({ user: null });
      return false;
    } catch (error) {
      console.error('Error checking session:', error);
      set({ user: null });
      return false;
    }
  },
}));

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/login'
    }
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const requireAuth = () => {
  const { user, loading, initialized } = useAuthStore.getState();
  if (!initialized || loading) return true;
  return !!user;
};