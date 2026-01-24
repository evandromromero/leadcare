import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSupport, SupportTicket, SupportMessage } from '../hooks/useSupport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import EmojiPicker from '../components/EmojiPicker';
import QuickReplies from '../components/QuickReplies';

const db = supabase as any;

const SupportPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut, signIn } = useAuth();
  const {
    tickets,
    messages,
    selectedTicket,
    setSelectedTicket,
    loading,
    supportSettings,
    sendMessage,
    markMessagesAsRead,
    updateTicketStatus,
    assignTicket,
    toggleSupportOnline,
    toggleSupportEnabled,
    fetchTickets,
  } = useSupport(undefined, user?.id); // undefined = buscar todos os tickets (modo suporte)

  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'ticket' | 'live_chat'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'dashboard' | 'quick_replies'>('tickets');
  const [supportAgents, setSupportAgents] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [selectedQuickReply, setSelectedQuickReply] = useState<any>(null);
  const [qrFormTitle, setQrFormTitle] = useState('');
  const [qrFormContent, setQrFormContent] = useState('');
  const [qrFormCategory, setQrFormCategory] = useState('general');
  const [qrFormShortcut, setQrFormShortcut] = useState('');
  const [qrFormIsActive, setQrFormIsActive] = useState(true);
  const [qrSaving, setQrSaving] = useState(false);
  const [qrFormError, setQrFormError] = useState('');
  const [qrSearchTerm, setQrSearchTerm] = useState('');
  const [qrFilterCategory, setQrFilterCategory] = useState('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estados do login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Verificar autenticação inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthChecking(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [user]);

  // Buscar logo
  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await db.from('settings').select('login_logo_url').single();
      if (data?.login_logo_url) {
        setLogoUrl(data.login_logo_url);
      }
    };
    fetchLogo();
  }, []);

  // Buscar agentes de suporte
  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await db
        .from('users')
        .select('id, name, email, status')
        .in('role', ['SuperAdmin', 'Suporte'])
        .eq('status', 'Ativo');
      if (data) {
        setSupportAgents(data);
      }
    };
    fetchAgents();
  }, []);

  // Buscar mensagens rápidas
  const fetchQuickReplies = async () => {
    setQuickRepliesLoading(true);
    const { data } = await db
      .from('support_quick_replies')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) {
      setQuickReplies(data);
    }
    setQuickRepliesLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'quick_replies') {
      fetchQuickReplies();
    }
  }, [activeTab]);

  // Funções para gerenciar mensagens rápidas
  const openQrCreateModal = () => {
    setSelectedQuickReply(null);
    setQrFormTitle('');
    setQrFormContent('');
    setQrFormCategory('general');
    setQrFormShortcut('');
    setQrFormIsActive(true);
    setQrFormError('');
    setShowQuickReplyModal(true);
  };

  const openQrEditModal = (reply: any) => {
    setSelectedQuickReply(reply);
    setQrFormTitle(reply.title);
    setQrFormContent(reply.content);
    setQrFormCategory(reply.category);
    setQrFormShortcut(reply.shortcut || '');
    setQrFormIsActive(reply.is_active);
    setQrFormError('');
    setShowQuickReplyModal(true);
  };

  const handleQrSave = async () => {
    if (!qrFormTitle.trim() || !qrFormContent.trim()) {
      setQrFormError('Preencha título e conteúdo');
      return;
    }

    setQrSaving(true);
    setQrFormError('');

    try {
      if (selectedQuickReply) {
        await db
          .from('support_quick_replies')
          .update({
            title: qrFormTitle,
            content: qrFormContent,
            category: qrFormCategory,
            shortcut: qrFormShortcut || null,
            is_active: qrFormIsActive,
          })
          .eq('id', selectedQuickReply.id);
      } else {
        const maxOrder = quickReplies.length > 0 ? Math.max(...quickReplies.map((r: any) => r.sort_order)) + 1 : 0;
        await db
          .from('support_quick_replies')
          .insert({
            title: qrFormTitle,
            content: qrFormContent,
            category: qrFormCategory,
            shortcut: qrFormShortcut || null,
            is_active: qrFormIsActive,
            sort_order: maxOrder,
          });
      }

      setShowQuickReplyModal(false);
      fetchQuickReplies();
    } catch (error: any) {
      setQrFormError(error.message || 'Erro ao salvar');
    } finally {
      setQrSaving(false);
    }
  };

  const handleQrDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    
    await db.from('support_quick_replies').delete().eq('id', id);
    fetchQuickReplies();
  };

  const handleQrToggleActive = async (reply: any) => {
    await db
      .from('support_quick_replies')
      .update({ is_active: !reply.is_active })
      .eq('id', reply.id);
    fetchQuickReplies();
  };

  const QR_CATEGORIES = [
    { value: 'greeting', label: 'Saudações', icon: 'waving_hand', color: 'yellow' },
    { value: 'closing', label: 'Encerramentos', icon: 'check_circle', color: 'green' },
    { value: 'info', label: 'Informações', icon: 'info', color: 'blue' },
    { value: 'problem', label: 'Problemas', icon: 'build', color: 'orange' },
    { value: 'general', label: 'Gerais', icon: 'chat', color: 'slate' },
  ];

  const getQrCategoryInfo = (category: string) => {
    return QR_CATEGORIES.find(c => c.value === category) || QR_CATEGORIES[4];
  };

  const filteredQuickReplies = quickReplies.filter((reply: any) => {
    const matchesSearch = reply.title.toLowerCase().includes(qrSearchTerm.toLowerCase()) ||
                          reply.content.toLowerCase().includes(qrSearchTerm.toLowerCase());
    const matchesCategory = qrFilterCategory === 'all' || reply.category === qrFilterCategory;
    return matchesSearch && matchesCategory;
  });

  // Notificação sonora para novas mensagens
  const prevTicketsRef = useRef<number>(0);
  useEffect(() => {
    if (tickets.length > prevTicketsRef.current && prevTicketsRef.current > 0) {
      // Novo ticket chegou - tocar som
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
      
      // Notificação do navegador
      if (Notification.permission === 'granted') {
        new Notification('Novo ticket de suporte!', {
          body: 'Um cliente iniciou uma conversa',
          icon: '/favicon.ico'
        });
      }
    }
    prevTicketsRef.current = tickets.length;
  }, [tickets.length]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Marcar mensagens como lidas quando abrir ticket
  useEffect(() => {
    if (selectedTicket) {
      markMessagesAsRead(selectedTicket.id, true);
    }
  }, [selectedTicket, markMessagesAsRead]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket) return;
    
    setSending(true);
    await sendMessage(selectedTicket.id, messageInput, true); // true = mensagem do suporte
    setSending(false);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogout = async () => {
    await signOut();
    setEmail('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setLoginError('Email ou senha inválidos');
      }
    } catch (err) {
      setLoginError('Erro ao fazer login');
    } finally {
      setLoginLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesType = filterType === 'all' || 
      (filterType === 'live_chat' && (ticket as any).is_live_chat) ||
      (filterType === 'ticket' && !(ticket as any).is_live_chat);
    return matchesStatus && matchesType;
  });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const typeCounts = {
    all: tickets.length,
    live_chat: tickets.filter(t => (t as any).is_live_chat).length,
    ticket: tickets.filter(t => !(t as any).is_live_chat).length,
  };

  // Tela de loading enquanto verifica autenticação
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  // Tela de login se não autenticado ou não tem permissão (SuperAdmin ou Suporte)
  const userRole = user?.role as string;
  if (!user || (userRole !== 'SuperAdmin' && userRole !== 'Suporte')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-12 w-auto mx-auto mb-4" />
              )}
              <div className="p-3 bg-violet-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-600 text-3xl">support_agent</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Painel de Suporte</h1>
              <p className="text-slate-500 mt-2">Acesso restrito a administradores</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {loginError}
                </div>
              )}

              {user && user.role !== 'SuperAdmin' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  Você não tem permissão para acessar o painel de suporte.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Entrando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">login</span>
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-300`}>
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b border-slate-700`}>
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto brightness-0 invert" />
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {sidebarCollapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
          </div>
        </div>

        <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1`}>
          {(user?.role as string) === 'SuperAdmin' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">analytics</span>
              {!sidebarCollapsed && 'Dashboard'}
            </button>
          )}
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'tickets' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined">confirmation_number</span>
            {!sidebarCollapsed && 'Tickets'}
          </button>
          {(user?.role as string) === 'SuperAdmin' && (
            <button
              onClick={() => setActiveTab('quick_replies')}
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'quick_replies' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">quick_phrases</span>
              {!sidebarCollapsed && 'Mensagens Rápidas'}
            </button>
          )}
        </nav>

        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-700`}>
          <button
            onClick={handleLogout}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors`}
          >
            <span className="material-symbols-outlined">logout</span>
            {!sidebarCollapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <span className="material-symbols-outlined text-violet-600">support_agent</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Painel de Suporte</h1>
                <p className="text-sm text-slate-500">Gerencie tickets de clientes</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Toggle Habilitar Suporte */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Suporte:</span>
                <button
                  onClick={toggleSupportEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    supportSettings.support_enabled ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                  title={supportSettings.support_enabled ? 'Desabilitar suporte para clientes' : 'Habilitar suporte para clientes'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      supportSettings.support_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Online/Offline */}
              {supportSettings.support_enabled && (
                <button
                  onClick={toggleSupportOnline}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    supportSettings.support_online
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${supportSettings.support_online ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                  {supportSettings.support_online ? 'Online' : 'Offline'}
                </button>
              )}
              
              <button
                onClick={() => fetchTickets()}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                title="Atualizar"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        {activeTab === 'dashboard' && user?.role === 'SuperAdmin' ? (
          /* Dashboard de Métricas */
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-100 rounded-lg">
                      <span className="material-symbols-outlined text-violet-600">confirmation_number</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total de Tickets</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <span className="material-symbols-outlined text-yellow-600">pending</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Abertos</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.filter(t => t.status === 'open').length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <span className="material-symbols-outlined text-blue-600">sync</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Em Andamento</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.filter(t => t.status === 'in_progress').length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <span className="material-symbols-outlined text-green-600">check_circle</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Resolvidos</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.filter(t => t.status === 'resolved').length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards por Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <span className="material-symbols-outlined text-green-600">chat</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Chats ao Vivo</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.filter(t => (t as any).is_live_chat).length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <span className="material-symbols-outlined text-orange-600">mail</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Tickets</p>
                      <p className="text-2xl font-bold text-slate-800">{tickets.filter(t => !(t as any).is_live_chat).length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desempenho por Agente */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-800">Desempenho por Agente</h2>
                  <p className="text-sm text-slate-500">Tickets atribuídos a cada agente</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {supportAgents.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      Nenhum agente de suporte cadastrado
                    </div>
                  ) : (
                    supportAgents.map(agent => {
                      const agentTickets = tickets.filter(t => t.assigned_to === agent.id);
                      const openTickets = agentTickets.filter(t => t.status === 'open').length;
                      const inProgressTickets = agentTickets.filter(t => t.status === 'in_progress').length;
                      const resolvedTickets = agentTickets.filter(t => t.status === 'resolved').length;
                      
                      return (
                        <div key={agent.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-violet-600">person</span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{agent.name}</p>
                                <p className="text-xs text-slate-500">{agent.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-lg font-bold text-slate-800">{agentTickets.length}</p>
                                <p className="text-xs text-slate-500">Total</p>
                              </div>
                              <div className="flex gap-2">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">{openTickets} abertos</span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{inProgressTickets} em andamento</span>
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">{resolvedTickets} resolvidos</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Não atribuídos */}
                  {(() => {
                    const unassignedTickets = tickets.filter(t => !t.assigned_to);
                    if (unassignedTickets.length === 0) return null;
                    return (
                      <div className="p-4 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-500">help</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-600">Não Atribuídos</p>
                              <p className="text-xs text-slate-400">Aguardando atribuição</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-600">{unassignedTickets.length}</p>
                            <p className="text-xs text-slate-400">tickets</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Links Rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/admin/support-agents"
                  className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-violet-300 hover:shadow-md transition-all flex items-center gap-4"
                >
                  <div className="p-3 bg-violet-100 rounded-lg">
                    <span className="material-symbols-outlined text-violet-600">group</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">Gerenciar Agentes</p>
                    <p className="text-sm text-slate-500">Cadastrar e editar agentes de suporte</p>
                  </div>
                </a>
                <button
                  onClick={() => setActiveTab('quick_replies')}
                  className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-violet-300 hover:shadow-md transition-all flex items-center gap-4 text-left"
                >
                  <div className="p-3 bg-violet-100 rounded-lg">
                    <span className="material-symbols-outlined text-violet-600">quick_phrases</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">Mensagens Rápidas</p>
                    <p className="text-sm text-slate-500">Gerenciar respostas pré-definidas</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'quick_replies' && (user?.role as string) === 'SuperAdmin' ? (
          /* Aba de Mensagens Rápidas */
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Mensagens Rápidas</h2>
                  <p className="text-sm text-slate-500">Gerencie respostas pré-definidas para o suporte</p>
                </div>
                <button
                  onClick={openQrCreateModal}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Nova Mensagem
                </button>
              </div>

              {/* Busca e Filtros */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                {/* Busca */}
                <div className="relative mb-4">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                  <input
                    type="text"
                    value={qrSearchTerm}
                    onChange={(e) => setQrSearchTerm(e.target.value)}
                    placeholder="Buscar por título ou conteúdo..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
                {/* Filtros por Categoria */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setQrFilterCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      qrFilterCategory === 'all'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas ({quickReplies.length})
                  </button>
                  {QR_CATEGORIES.map(cat => {
                    const count = quickReplies.filter((r: any) => r.category === cat.value).length;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setQrFilterCategory(cat.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          qrFilterCategory === cat.value
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                        {cat.label}
                        <span className="text-xs opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {quickRepliesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                  </div>
                ) : filteredQuickReplies.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">quick_phrases</span>
                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                      {qrSearchTerm || qrFilterCategory !== 'all' ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem rápida'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      {qrSearchTerm || qrFilterCategory !== 'all' ? 'Tente ajustar os filtros' : 'Crie a primeira mensagem rápida'}
                    </p>
                    {!qrSearchTerm && qrFilterCategory === 'all' && (
                      <button
                        onClick={openQrCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Criar Mensagem
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                    {filteredQuickReplies.map((reply: any) => {
                      const catInfo = getQrCategoryInfo(reply.category);
                      return (
                        <div 
                          key={reply.id} 
                          className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all ${
                            reply.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
                          }`}
                        >
                          {/* Header do Card */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-800">{reply.title}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${catInfo.color}-100 text-${catInfo.color}-700`}>
                                {catInfo.label}
                              </span>
                              {reply.shortcut && (
                                <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-600 text-xs font-mono">
                                  /{reply.shortcut}
                                </span>
                              )}
                            </div>
                            {!reply.is_active && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 shrink-0">
                                Inativo
                              </span>
                            )}
                          </div>
                          
                          {/* Conteúdo */}
                          <p className="text-sm text-slate-600 line-clamp-3 mb-4 min-h-[3.75rem]">{reply.content}</p>
                          
                          {/* Ações */}
                          <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-100">
                            <button
                              onClick={() => handleQrToggleActive(reply)}
                              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${
                                reply.is_active
                                  ? 'hover:bg-green-50 text-green-600'
                                  : 'hover:bg-slate-100 text-slate-400'
                              }`}
                              title={reply.is_active ? 'Desativar' : 'Ativar'}
                            >
                              <span className="material-symbols-outlined text-[22px]">
                                {reply.is_active ? 'toggle_on' : 'toggle_off'}
                              </span>
                            </button>
                            <button
                              onClick={() => openQrEditModal(reply)}
                              className="p-2 hover:bg-violet-50 rounded-lg transition-colors text-violet-600"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleQrDelete(reply.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal de Criar/Editar */}
            {showQuickReplyModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">
                      {selectedQuickReply ? 'Editar Mensagem' : 'Nova Mensagem Rápida'}
                    </h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {qrFormError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {qrFormError}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                      <input
                        type="text"
                        value={qrFormTitle}
                        onChange={(e) => setQrFormTitle(e.target.value)}
                        placeholder="Ex: Boas-vindas"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo *</label>
                      <textarea
                        value={qrFormContent}
                        onChange={(e) => setQrFormContent(e.target.value)}
                        placeholder="Digite o conteúdo da mensagem..."
                        rows={4}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                        <select
                          value={qrFormCategory}
                          onChange={(e) => setQrFormCategory(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          {QR_CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Atalho</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">/</span>
                          <input
                            type="text"
                            value={qrFormShortcut}
                            onChange={(e) => setQrFormShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="atalho"
                            className="w-full pl-7 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQrFormIsActive(!qrFormIsActive)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          qrFormIsActive ? 'bg-violet-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            qrFormIsActive ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-700">
                        {qrFormIsActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 border-t border-slate-200 flex gap-3">
                    <button
                      onClick={() => setShowQuickReplyModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleQrSave}
                      disabled={qrSaving}
                      className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {qrSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Salvando...
                        </>
                      ) : (
                        selectedQuickReply ? 'Salvar' : 'Criar Mensagem'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Lista de Tickets */}
          <div className={`${selectedTicket ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-96 bg-white border-r border-slate-200`}>
            {/* Filtros */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'open', label: 'Abertos' },
                  { key: 'in_progress', label: 'Em Andamento' },
                  { key: 'resolved', label: 'Resolvidos' },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterStatus(filter.key)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      filterStatus === filter.key
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-1 text-xs opacity-75">
                      ({ticketCounts[filter.key as keyof typeof ticketCounts]})
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Filtro por Tipo */}
              <div className="flex gap-2 mt-2">
                {[
                  { key: 'all', label: 'Todos', icon: 'list', color: 'slate' },
                  { key: 'live_chat', label: 'Chat ao Vivo', icon: 'chat', color: 'green' },
                  { key: 'ticket', label: 'Tickets', icon: 'confirmation_number', color: 'orange' },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterType(filter.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full transition-colors ${
                      filterType === filter.key
                        ? filter.key === 'live_chat' 
                          ? 'bg-green-600 text-white' 
                          : filter.key === 'ticket'
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{filter.icon}</span>
                    {filter.label}
                    <span className="text-xs opacity-75">
                      ({typeCounts[filter.key as keyof typeof typeCounts]})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">inbox</span>
                  <p className="text-slate-500 text-center">Nenhum ticket encontrado</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 border-b cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-violet-50 border-l-4 border-l-violet-600' 
                        : (ticket as any).is_live_chat 
                          ? 'border-l-4 border-l-green-500 border-b-slate-100' 
                          : 'border-l-4 border-l-orange-400 border-b-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-800 truncate">{ticket.subject}</h3>
                          {(ticket as any).is_live_chat ? (
                            <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[12px]">chat</span>
                              Chat
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[12px]">confirmation_number</span>
                              Ticket
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {ticket.clinic?.name || 'Clínica não identificada'}
                        </p>
                      </div>
                      {(ticket.unread_count ?? 0) > 0 && (
                        <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                          {ticket.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                    </div>
                    {ticket.last_message && (
                      <p className="text-sm text-slate-500 line-clamp-1">
                        {ticket.last_message.is_from_support ? 'Você: ' : 'Cliente: '}
                        {ticket.last_message.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-slate-400">
                        {format(new Date(ticket.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {ticket.user && (
                        <p className="text-xs text-slate-400">{ticket.user.name}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat do Ticket */}
          {selectedTicket ? (
            <div className="flex-1 flex flex-col bg-slate-50">
              {/* Header do Chat */}
              <div className="bg-white border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
                    >
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                      <h3 className="font-medium text-slate-800">{selectedTicket.subject}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {selectedTicket.clinic?.name} • {selectedTicket.user?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Ações do ticket */}
                    {selectedTicket.status !== 'closed' && (
                      <>
                        {selectedTicket.status === 'open' && (
                          <button
                            onClick={() => assignTicket(selectedTicket.id, user?.id || null)}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          >
                            Assumir
                          </button>
                        )}
                        {selectedTicket.status === 'in_progress' && (
                          <button
                            onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          >
                            Resolver
                          </button>
                        )}
                        <button
                          onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                        >
                          Fechar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.is_from_support ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.is_from_support
                          ? 'bg-violet-600 text-white rounded-tr-sm'
                          : 'bg-white border border-slate-200 rounded-tl-sm'
                      }`}
                    >
                      {!message.is_from_support && (
                        <p className="text-xs font-medium text-violet-600 mb-1">
                          {message.sender?.name || 'Cliente'}
                        </p>
                      )}
                      <p className={`text-sm ${message.is_from_support ? 'text-white' : 'text-slate-700'}`}>
                        {message.content}
                      </p>
                      <p className={`text-xs mt-1 ${message.is_from_support ? 'text-violet-200' : 'text-slate-400'}`}>
                        {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de Mensagem */}
              {selectedTicket.status !== 'closed' && (
                <div className="bg-white border-t border-slate-200 p-4">
                  <div className="flex items-end gap-2">
                    <div className="relative flex-1">
                      {showEmojiPicker && (
                        <EmojiPicker
                          onSelect={(emoji) => setMessageInput(prev => prev + emoji)}
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      )}
                      {showQuickReplies && (
                        <QuickReplies
                          onSelect={(content) => setMessageInput(content)}
                          onClose={() => setShowQuickReplies(false)}
                        />
                      )}
                      <div className="flex items-center gap-1 mb-2">
                        <button
                          onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmojiPicker(false); }}
                          className={`p-2 rounded-lg transition-colors ${showQuickReplies ? 'bg-violet-100 text-violet-600' : 'hover:bg-slate-100 text-slate-500'}`}
                          title="Mensagens rápidas"
                        >
                          <span className="material-symbols-outlined text-[20px]">bolt</span>
                        </button>
                        <button
                          onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowQuickReplies(false); }}
                          className={`p-2 rounded-lg transition-colors ${showEmojiPicker ? 'bg-violet-100 text-violet-600' : 'hover:bg-slate-100 text-slate-500'}`}
                          title="Emojis"
                        >
                          <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                        </button>
                      </div>
                      <textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Digite sua resposta..."
                        rows={1}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                      />
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sending}
                      className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="bg-slate-100 border-t border-slate-200 p-4 text-center">
                  <p className="text-slate-500 text-sm">Este ticket foi fechado</p>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50">
              <div className="text-center">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">chat</span>
                <p className="text-slate-500">Selecione um ticket para responder</p>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default SupportPanel;
