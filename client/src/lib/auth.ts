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
}

// Create the auth store with basic state management
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// Initialize auth state and set up listener
const initAuth = async () => {
  try {
    // Check initial session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      useAuthStore.setState({
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        loading: false,
      });
    } else {
      useAuthStore.setState({ user: null, loading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        useAuthStore.setState({
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          loading: false,
        });
      } else {
        useAuthStore.setState({ user: null, loading: false });
      }
    });
  } catch (error) {
    console.error('Auth initialization error:', error);
    useAuthStore.setState({ user: null, loading: false });
  }
};

// Initialize auth immediately
initAuth();

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/login'
      }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const requireAuth = () => {
  const { user, loading } = useAuthStore.getState();
  if (loading) return true;
  return !!user;
};