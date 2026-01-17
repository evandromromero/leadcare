import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Trocar manifest para admin (PWA)
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-admin.json');
    }
    // Restaurar manifest original ao sair
    return () => {
      if (manifestLink) {
        manifestLink.setAttribute('href', '/manifest.json');
      }
    };
  }, []);

  // Buscar logo do banco
  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase
        .from('settings')
        .select('login_logo_url')
        .single();
      const d = data as any;
      if (d?.login_logo_url) {
        setLogoUrl(d.login_logo_url);
      }
      setLogoLoaded(true);
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      if (user.role === 'SuperAdmin') {
        navigate('/admin');
      } else {
        setLoginError('Acesso negado. Esta área é restrita para administradores.');
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
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            {logoLoaded && logoUrl ? (
              <img src={logoUrl} alt="Belitx" className="h-16 mx-auto mb-4" />
            ) : (
              <div className="w-16 h-16 bg-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">Painel Administrativo</h1>
            <p className="text-slate-500 mt-2">Acesso restrito para administradores</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                E-mail
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@belitx.com" 
                className="w-full h-12 rounded-lg border border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all px-4"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Senha
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full h-12 rounded-lg border border-slate-200 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all px-4"
                required
              />
            </div>

            {loginError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Belitx Admin Panel • Acesso Restrito
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
