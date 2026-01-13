
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { assets } from '../config/assets';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface LoginSettings {
  login_logo_url: string;
  login_background_url: string;
  login_title: string;
  login_subtitle: string;
  login_footer_text: string;
}

interface LoginProps {
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Login: React.FC<LoginProps> = ({ setState }) => {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSettings, setLoginSettings] = useState<LoginSettings>({
    login_logo_url: '',
    login_background_url: '',
    login_title: '',
    login_subtitle: '',
    login_footer_text: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Carregar configurações de login do banco
  useEffect(() => {
    const fetchLoginSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('login_logo_url, login_background_url, login_title, login_subtitle, login_footer_text')
          .single();

        if (data && !error) {
          const d = data as any;
          setLoginSettings({
            login_logo_url: d.login_logo_url || '',
            login_background_url: d.login_background_url || '',
            login_title: d.login_title || 'Transforme conversas em vendas',
            login_subtitle: d.login_subtitle || 'CRM de WhatsApp para clínicas',
            login_footer_text: d.login_footer_text || '',
          });
        }
      } catch (error) {
        console.error('Error fetching login settings:', error);
      } finally {
        setSettingsLoading(false);
      }
    };

    fetchLoginSettings();
  }, []);

  // Redirecionar quando o user carregar após login
  useEffect(() => {
    if (user && !authLoading) {
      if (user.role === 'SuperAdmin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);

    const { error } = await signIn(email, password);
    
    if (error) {
      setLoginError(error);
      setIsSubmitting(false);
      return;
    }
    // Redirecionamento será feito pelo useEffect quando o user carregar
  };

  if (settingsLoading) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <img 
          src={loginSettings.login_background_url || assets.loginIllustrationUrl} 
          className="absolute inset-0 size-full object-cover opacity-30 mix-blend-overlay" 
          alt="Clinic Management" 
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/90 to-teal-900 opacity-90"></div>
        <div className="relative z-10 flex flex-col justify-between p-16 text-white h-full">
          <div className="flex items-center gap-3">
            <img src={loginSettings.login_logo_url || "/logo.png"} alt="Belitx" className="h-12 w-auto brightness-0 invert" />
          </div>
          <div>
            <h1 className="text-5xl font-black leading-tight mb-6">{loginSettings.login_title}</h1>
            <p className="text-xl text-cyan-100 max-w-md">{loginSettings.login_subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-cyan-200">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} className="size-8 rounded-full border-2 border-cyan-600" />)}
            </div>
            <span>{loginSettings.login_footer_text}</span>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Bem-vindo de volta</h2>
            <p className="text-slate-500">Acesse sua conta para gerenciar seus atendimentos.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail corporativo</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@clinica.com" 
                className="w-full h-14 rounded-xl border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all px-4"
                required
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Senha</label>
                <a href="#" className="text-sm font-bold text-cyan-600 hover:text-cyan-700">Esqueceu a senha?</a>
              </div>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Insira sua senha" 
                  className="w-full h-14 rounded-xl border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all px-4"
                  required
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            Ainda não possui acesso? <a href="#" className="font-bold text-slate-900 hover:underline">Fale com o administrador</a>
          </p>

          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center items-center gap-2 text-slate-400 text-xs font-medium">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            Ambiente 100% seguro e criptografado
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
