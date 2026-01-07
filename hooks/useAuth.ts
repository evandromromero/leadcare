import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Atendente';
  clinicId: string;
  avatarUrl: string;
  status: 'Ativo' | 'Inativo';
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface UseAuthReturn {
  user: AuthUser | null;
  clinic: Clinic | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        clinics (
          id,
          name,
          slug,
          logo_url
        )
      `)
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      setError('Erro ao carregar perfil do usuário');
      return;
    }

    const clinicData = profile.clinics as unknown as {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
    };

    setUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as 'Admin' | 'Atendente',
      clinicId: profile.clinic_id,
      avatarUrl: profile.avatar_url || '',
      status: profile.status as 'Ativo' | 'Inativo',
    });

    setClinic({
      id: clinicData.id,
      name: clinicData.name,
      slug: clinicData.slug,
      logoUrl: clinicData.logo_url,
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setSession(null);
        setUser(null);
        setClinic(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Exception getting session:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setUser(null);
          setClinic(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      const errorMessage = signInError.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos'
        : signInError.message;
      setError(errorMessage);
      return { error: errorMessage };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setClinic(null);
    setSession(null);
  };

  return {
    user,
    clinic,
    session,
    loading,
    error,
    signIn,
    signOut,
  };
}
