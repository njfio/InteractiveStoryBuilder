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
  console.log('Initializing auth...');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Initial session:', session);
    setUser(session?.user ?? null);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  } catch (error) {
    console.error('Error initializing auth:', error);
  } finally {
    setLoading(false);
  }
};

export const signIn = async (email: string, password: string) => {
  console.log('Attempting sign in for:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error('Sign in error:', error);
    throw error;
  }
  console.log('Sign in successful:', data);
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
  const { user, loading } = useAuthStore.getState();
  if (loading) return true;
  if (!user) return false;
  return true;
};
