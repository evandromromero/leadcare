import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'Atendente';
  clinicId: string | null;
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
  isImpersonating: boolean;
  impersonatedClinic: Clinic | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  startImpersonate: (clinicId: string, clinicName: string) => void;
  stopImpersonate: () => void;
}

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedClinic, setImpersonatedClinic] = useState<Clinic | null>(null);

  // Verificar se há impersonate ativo ao carregar
  useEffect(() => {
    const savedImpersonate = sessionStorage.getItem('impersonateClinic');
    if (savedImpersonate) {
      const clinicData = JSON.parse(savedImpersonate);
      setIsImpersonating(true);
      setImpersonatedClinic(clinicData);
    }
  }, []);

  const fetchUserProfile = async (authUser: SupabaseUser, accessToken: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Buscar usuário
      const userResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${authUser.id}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      const users = await userResponse.json();
      const profile = users?.[0] || null;

      if (!profile) {
        console.error('[useAuth] User not found');
        setError('Usuário não encontrado');
        return;
      }

      // Buscar clínica (apenas se não for SuperAdmin)
      let clinicData = null;
      if (profile.clinic_id) {
        const clinicResponse = await fetch(
          `${supabaseUrl}/rest/v1/clinics?id=eq.${profile.clinic_id}&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        const clinics = await clinicResponse.json();
        clinicData = clinics?.[0] || null;
      }

      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'SuperAdmin' | 'Admin' | 'Atendente',
        clinicId: profile.clinic_id || null,
        avatarUrl: profile.avatar_url || '',
        status: profile.status as 'Ativo' | 'Inativo',
      });

      if (clinicData) {
        setClinic({
          id: clinicData.id,
          name: clinicData.name,
          slug: clinicData.slug,
          logoUrl: clinicData.logo_url,
        });
      }
    } catch (err) {
      console.error('[useAuth] fetchUserProfile exception:', err);
      setError('Erro ao carregar perfil');
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;

    // Configurar listener primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] onAuthStateChange:', event, { hasSession: !!session });
        if (!isMounted) return;
        
        setSession(session);
        if (session?.user && session.access_token) {
          console.log('[useAuth] Buscando perfil...');
          // Pequeno delay para garantir que o token está sincronizado
          await new Promise(resolve => setTimeout(resolve, 100));
          await fetchUserProfile(session.user, session.access_token);
          console.log('[useAuth] Perfil carregado');
        } else {
          setUser(null);
          setClinic(null);
        }
        
        if (isMounted) {
          setLoading(false);
          isInitialized = true;
        }
      }
    );

    // Buscar sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[useAuth] getSession:', { hasSession: !!session, error });
      
      if (!isMounted) return;
      
      // Se já foi inicializado pelo onAuthStateChange, não fazer nada
      if (isInitialized) {
        console.log('[useAuth] Já inicializado pelo onAuthStateChange');
        return;
      }
      
      if (error) {
        console.error('[useAuth] Error getting session:', error);
        setLoading(false);
        return;
      }
      
      // Se não tem sessão, parar loading
      if (!session) {
        console.log('[useAuth] Sem sessão ativa');
        setLoading(false);
      }
      // Se tem sessão, o onAuthStateChange vai cuidar
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
    setIsImpersonating(false);
    setImpersonatedClinic(null);
    sessionStorage.removeItem('impersonateClinic');
  };

  const startImpersonate = (clinicId: string, clinicName: string) => {
    const clinicData = { id: clinicId, name: clinicName, slug: '', logoUrl: null };
    sessionStorage.setItem('impersonateClinic', JSON.stringify(clinicData));
    setIsImpersonating(true);
    setImpersonatedClinic(clinicData);
  };

  const stopImpersonate = () => {
    sessionStorage.removeItem('impersonateClinic');
    setIsImpersonating(false);
    setImpersonatedClinic(null);
  };

  const value = {
    user,
    clinic,
    session,
    loading,
    error,
    isImpersonating,
    impersonatedClinic,
    signIn,
    signOut,
    startImpersonate,
    stopImpersonate,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
