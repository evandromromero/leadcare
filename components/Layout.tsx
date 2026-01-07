
import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GlobalState, WhatsAppStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useChats } from '../hooks/useChats';
import ImpersonateBanner from './ImpersonateBanner';

interface LayoutProps {
  children: React.ReactNode;
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Layout: React.FC<LayoutProps> = ({ children, state, setState }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isImpersonating, impersonatedClinic, stopImpersonate } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { whatsappConnected } = useChats(clinicId);

  const handleExitImpersonate = () => {
    stopImpersonate();
    navigate('/admin/clinics');
  };

  // Sincronizar status do WhatsApp com o estado global
  useEffect(() => {
    const newStatus: WhatsAppStatus = whatsappConnected ? 'connected' : 'disconnected';
    if (state.whatsappStatus !== newStatus) {
      setState(prev => ({ ...prev, whatsappStatus: newStatus }));
    }
  }, [whatsappConnected, state.whatsappStatus, setState]);

  const handleLogout = async () => {
    await signOut();
    setState(prev => ({ ...prev, currentUser: null, selectedClinic: null, whatsappStatus: 'disconnected' }));
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/inbox', label: 'Caixa de Entrada', icon: 'inbox', badge: state.chats.reduce((acc, c) => acc + c.unreadCount, 0) },
    { path: '/kanban', label: 'Leads (Kanban)', icon: 'view_kanban' },
    { path: '/users', label: 'Usuários (Admin)', icon: 'group' },
    { path: '/settings', label: 'Configurações', icon: 'settings' },
  ];

  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
    reconnecting: 'bg-yellow-500 animate-pulse',
  };

  const statusLabels = {
    connected: 'WhatsApp Conectado',
    disconnected: 'WhatsApp Desconectado',
    reconnecting: 'Reconectando...',
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Banner de Impersonate */}
      {isImpersonating && impersonatedClinic && (
        <ImpersonateBanner 
          clinicName={impersonatedClinic.name} 
          onExit={handleExitImpersonate} 
        />
      )}
      
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="LeadCare" className="h-8 w-auto" />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined ${location.pathname === item.path ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              {item.label}
              {item.badge ? (
                <span className="ml-auto bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
            <img src={state.currentUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.currentUser?.name || 'U')}&background=0891b2&color=fff`} className="size-9 rounded-full border border-slate-200" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{state.currentUser?.name}</p>
              <p className="text-xs text-slate-500 truncate">{state.currentUser?.role}</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }} 
              className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="material-symbols-outlined text-cyan-600 text-[20px]">dentistry</span>
              <span className="text-sm font-bold text-slate-800">{state.selectedClinic?.name}</span>
              <span className="text-[10px] font-medium text-slate-400">ID: {state.selectedClinic?.idCode}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              state.whatsappStatus === 'connected' ? 'bg-green-50 border-green-200 text-green-700' : 
              state.whatsappStatus === 'disconnected' ? 'bg-red-50 border-red-200 text-red-700' : 
              'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              <div className={`size-2 rounded-full ${statusColors[state.whatsappStatus]}`}></div>
              <span className="text-xs font-bold uppercase tracking-wide">{statusLabels[state.whatsappStatus]}</span>
            </div>

            {state.whatsappStatus !== 'connected' && (
              <button 
                onClick={() => navigate('/connect-whatsapp')}
                className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm"
              >
                Conectar WhatsApp
              </button>
            )}

            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
};

export default Layout;
