
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GlobalState, WhatsAppStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useChats } from '../hooks/useChats';
import { useTasks } from '../hooks/useTasks';
import ImpersonateBanner from './ImpersonateBanner';
import { canAccessPage, MenuPage } from '../lib/permissions';
import { supabase } from '../lib/supabase';

const db = supabase as any;

interface LayoutProps {
  children: React.ReactNode;
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Layout: React.FC<LayoutProps> = ({ children, state, setState }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isImpersonating, impersonatedClinic, stopImpersonate, user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { whatsappConnected } = useChats(clinicId, user?.id);
  const { todayTasks, upcomingTasks, overdueTasks, toggleTask } = useTasks(clinicId, user?.id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTasksDropdown, setShowTasksDropdown] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const tasksDropdownRef = useRef<HTMLDivElement>(null);
  const [supportEnabled, setSupportEnabled] = useState(false);

  // Buscar logo e configurações de suporte do banco
  const fetchSupportStatus = async () => {
    const { data } = await db
      .from('settings')
      .select('login_logo_url, support_enabled')
      .single();
    const d = data as any;
    if (d?.login_logo_url) {
      setLogoUrl(d.login_logo_url);
    }
    if (d?.support_enabled !== undefined) {
      // Verificar também se a clínica tem suporte habilitado
      if (clinicId) {
        const { data: clinicData } = await db
          .from('clinics')
          .select('support_enabled')
          .eq('id', clinicId)
          .single();
        setSupportEnabled(d.support_enabled && (clinicData?.support_enabled ?? true));
      } else {
        setSupportEnabled(d.support_enabled);
      }
    }
    setLogoLoaded(true);
  };

  useEffect(() => {
    fetchSupportStatus();
  }, [clinicId]);

  // Subscription para atualizar menu de suporte em tempo real
  useEffect(() => {
    const channel = db
      .channel('layout_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings' },
        () => {
          fetchSupportStatus();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [clinicId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tasksDropdownRef.current && !tasksDropdownRef.current.contains(event.target as Node)) {
        setShowTasksDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalPendingTasks = todayTasks.length + overdueTasks.length;

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

  const allNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', page: 'dashboard' as MenuPage },
    { path: '/inbox', label: 'Caixa de Entrada', icon: 'inbox', badge: state.chats.reduce((acc, c) => acc + c.unreadCount, 0), page: 'inbox' as MenuPage },
    { path: '/kanban', label: 'Leads (Kanban)', icon: 'view_kanban', page: 'kanban' as MenuPage },
    { path: '/receipts', label: 'Lançamentos', icon: 'payments', page: 'receipts' as MenuPage },
    { path: '/reports', label: 'Relatórios', icon: 'analytics', page: 'reports' as MenuPage },
    { path: '/users', label: 'Usuários', icon: 'group', page: 'users' as MenuPage },
    { path: '/settings', label: 'Configurações', icon: 'settings', page: 'settings' as MenuPage },
  ];

  // Adicionar menu de suporte se habilitado
  const navItemsWithSupport = supportEnabled 
    ? [...allNavItems, { path: '/support', label: 'Suporte', icon: 'support_agent', page: 'support' as MenuPage }]
    : allNavItems;

  const navItems = navItemsWithSupport.filter(item => 
    item.page === 'support' || canAccessPage(user?.role, item.page as MenuPage)
  );

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
      <aside className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 transition-all duration-300`}>
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b border-slate-100`}>
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && logoLoaded && logoUrl && <img src={logoUrl} alt="Belitx" className="h-8 w-auto" />}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {sidebarCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
          </div>
        </div>

        <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto`}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined ${location.pathname === item.path ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              {!sidebarCollapsed && item.label}
              {!sidebarCollapsed && item.badge ? (
                <span className="ml-auto bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
              {sidebarCollapsed && item.badge ? (
                <span className="absolute -top-1 -right-1 bg-cyan-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-100`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} p-2 rounded-lg hover:bg-slate-50 transition-colors`}>
            <img 
              src={state.currentUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.currentUser?.name || 'U')}&background=0891b2&color=fff`} 
              className="size-9 rounded-full border border-slate-200" 
              alt="User" 
              title={sidebarCollapsed ? state.currentUser?.name : undefined}
            />
            {!sidebarCollapsed && (
              <>
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
              </>
            )}
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

            <div className="relative" ref={tasksDropdownRef}>
              <button 
                onClick={() => setShowTasksDropdown(!showTasksDropdown)}
                className="p-2 text-slate-400 hover:text-slate-600 relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                {totalPendingTasks > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {totalPendingTasks > 9 ? '9+' : totalPendingTasks}
                  </span>
                )}
              </button>

              {showTasksDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Tarefas Pendentes</h3>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {overdueTasks.length > 0 && (
                      <div className="p-3 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Atrasadas ({overdueTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {overdueTasks.slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100"
                            >
                              <button
                                onClick={() => toggleTask(task.id, task.completed)}
                                className="mt-0.5 size-4 rounded border-2 border-red-300 hover:bg-red-200 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                                <p className="text-[10px] text-slate-500 truncate">{task.chat_name}</p>
                              </div>
                              <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">
                                {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {todayTasks.length > 0 && (
                      <div className="p-3 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">today</span>
                          Hoje ({todayTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {todayTasks.slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100"
                            >
                              <button
                                onClick={() => toggleTask(task.id, task.completed)}
                                className="mt-0.5 size-4 rounded border-2 border-amber-300 hover:bg-amber-200 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                                <p className="text-[10px] text-slate-500 truncate">{task.chat_name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {upcomingTasks.length > 0 && (
                      <div className="p-3">
                        <h4 className="text-xs font-bold text-cyan-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">upcoming</span>
                          Próximas ({upcomingTasks.length})
                        </h4>
                        <div className="space-y-2">
                          {upcomingTasks.slice(0, 3).map(task => (
                            <div 
                              key={task.id}
                              className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                            >
                              <button
                                onClick={() => toggleTask(task.id, task.completed)}
                                className="mt-0.5 size-4 rounded border-2 border-slate-300 hover:bg-slate-200 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                                <p className="text-[10px] text-slate-500 truncate">{task.chat_name}</p>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {todayTasks.length === 0 && upcomingTasks.length === 0 && overdueTasks.length === 0 && (
                      <div className="p-6 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">task_alt</span>
                        <p className="text-sm text-slate-500">Nenhuma tarefa pendente</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
