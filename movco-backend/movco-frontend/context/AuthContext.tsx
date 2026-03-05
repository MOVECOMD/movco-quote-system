// context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User, Session } from '@supabase/supabase-js';
import { CompanyUser } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyUser: CompanyUser | null;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshCompanyUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);

  const loadCompanyUser = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('company_users')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      setCompanyUser(data as CompanyUser | null);
    } catch {
      setCompanyUser(null);
    }
  };

  const refreshCompanyUser = async () => {
    if (user) await loadCompanyUser(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // Set up the auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadCompanyUser(session.user.id);
        } else {
          setCompanyUser(null);
        }
        setLoading(false);
      }
    );

    // Then attempt to recover/refresh the session
    // This will trigger onAuthStateChange with the refreshed session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        setSession(session);
        setUser(session.user);
        await loadCompanyUser(session.user.id);
        setLoading(false);
      } else {
        // No session at all — try to refresh explicitly
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!mounted) return;
        if (refreshData.session) {
          setSession(refreshData.session);
          setUser(refreshData.session.user);
          await loadCompanyUser(refreshData.session.user.id);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  const signUp = async (email: string, password: string, name: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
        },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    setCompanyUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, companyUser, signUp, signIn, signOut, refreshCompanyUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
