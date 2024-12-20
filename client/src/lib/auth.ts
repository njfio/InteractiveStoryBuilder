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
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  checkSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          loading: false
        });
        return true;
      }
      set({ user: null, loading: false });
      return false;
    } catch (error) {
      console.error('Error checking session:', error);
      set({ user: null, loading: false });
      return false;
    }
  }
}));

// Set up auth state change subscription
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    useAuthStore.setState({
      user: {
        id: session.user.id,
        email: session.user.email
      },
      loading: false
    });
  } else {
    useAuthStore.setState({ user: null, loading: false });
  }
});

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
  const { user, loading } = useAuthStore.getState();
  if (loading) return true;
  return !!user;
};