import { supabase } from './supabase';
import { create } from 'zustand';

interface AuthStore {
  user: any | null;
  loading: boolean;
  setUser: (user: any | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

export const initAuth = async () => {
  const { setUser, setLoading } = useAuthStore.getState();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  } catch (error) {
    console.error('Error initializing auth:', error);
  } finally {
    setLoading(false);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
};

export const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
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
  const { user, loading } = useAuthStore.getState();
  if (loading) return true;
  if (!user) return false;
  return true;
};
