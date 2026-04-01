// context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User, Session } from '@supabase/supabase-js';
import { CompanyUser } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyUser: CompanyUser | null;
  companyId: string | null;
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
  const [companyId, setCompanyId] = useState<string | null>(null);
  const lastLoadedUserId = useRef<string | null>(null);

  const loadCompanyUser = useCallback(async (userId: string) => {
    if (lastLoadedUserId.current === userId) return;
    lastLoadedUserId.current = userId;

    try {
      // 1. Check company_users table (team members)
      const { data: cuData } = await supabase
        .from('company_users')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      setCompanyUser(cuData as CompanyUser | null);

      if (cuData?.company_id) {
        setCompanyId(cuData.company_id);
        return;
      }

      // 2. Check companies table (owner)
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (companyData?.id) {
        setCompanyId(companyData.id);
      } else {
        setCompanyId(null);
      }
    } catch {
      setCompanyUser(null);
      setCompanyId(null);
    }
  }, []);

  const refreshCompanyUser = useCallback(async () => {
    if (user) {
      // Force reload by clearing the cached user id
      lastLoadedUserId.current = null;
      await loadCompanyUser(user.id);
    }
  }, [user, loadCompanyUser]);

  useEffect(() => {
    let mounted = true;

    // 1. Get the existing session first (covers page refresh / returning user)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadCompanyUser(session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for future auth changes (sign in, sign out, token refresh)
    //    Do NOT await async work here — Supabase warns against it.
    //    Instead, kick off loadCompanyUser without blocking.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Non-blocking — the ref guard prevents duplicate fetches
          loadCompanyUser(session.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        } else {
          lastLoadedUserId.current = null;
          setCompanyUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadCompanyUser]);

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
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    // If sign-in fails, stop loading immediately
    if (error) {
      setLoading(false);
    }
    // If successful, onAuthStateChange will handle setLoading(false)
    return { data, error };
  };

  const signOut = async () => {
    lastLoadedUserId.current = null;
    setCompanyUser(null);
    setCompanyId(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, companyUser, companyId, signUp, signIn, signOut, refreshCompanyUser }}>
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
