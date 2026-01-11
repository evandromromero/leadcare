import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  ArrowLeft,
  Users,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  LogIn,
  Edit,
  Wifi,
  WifiOff,
  Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_PERMISSIONS, getRoleDescription, UserRole } from '../../lib/permissions';

interface ClinicDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  plan: string;
  max_users: number;
  can_create_users: boolean;
  created_at: string;
  updated_at: string;
  monthly_goal?: number;
}

interface ClinicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  default_instance_id?: string | null;
  monthly_goal?: number | null;
  can_see_goal?: boolean;
}

interface ClinicStats {
  users_count: number;
  chats_count: number;
  messages_count: number;
  leads_count: number;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  status: string;
  phone_number: string | null;
  connected_at: string | null;
  is_shared: boolean;
  user_id: string | null;
}

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalConversions: number;
  byAttendant: Array<{
    id: string;
    name: string;
    totalRevenue: number;
    monthlyRevenue: number;
    conversions: number;
    avgResponseTimeMinutes?: number;
  }>;
}

interface MetricsData {
  periodRevenue: number;
  periodConversions: number;
  periodLeads: number;
  previousPeriodRevenue: number;
  previousPeriodConversions: number;
  previousPeriodLeads: number;
  leadsBySource: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    converted: number;
    revenue: number;
  }>;
  leadsByStatus: {
    novo: number;
    emAtendimento: number;
    convertido: number;
    perdido: number;
  };
  // Métricas de Tempo e Produtividade
  avgResponseTimeMinutes: number;
  avgConversionTimeDays: number;
  leadsAwaiting: number;
  lostLeads: number;
  lossRate: number;
  responseTimeByAttendant: Map<string, { total: number; count: number }>;
  // Dados para gráficos de evolução
  dailyData: Array<{
    date: string;
    revenue: number;
    leads: number;
    conversions: number;
  }>;
  // Meta mensal
  monthlyGoal: number;
  monthlyRevenue: number;
  // Previsão
  projectedRevenue: number;
  daysRemaining: number;
}

// Componente de Tooltip para informações
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left - 200
      });
    }
    setShow(true);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">info</span>
      </button>
      {show && ReactDOM.createPortal(
        <div 
          className="bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 w-64"
          style={{ 
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 99999,
            transform: 'translateY(-100%)'
          }}>
          {text}
          <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800"></div>
        </div>,
        document.body
      )}
    </div>
  );
};

const AdminClinicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [stats, setStats] = useState<ClinicStats>({ users_count: 0, chats_count: 0, messages_count: 0, leads_count: 0 });
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);
  const [billingStats, setBillingStats] = useState<BillingStats>({ totalRevenue: 0, monthlyRevenue: 0, totalConversions: 0, byAttendant: [] });
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'Comercial',
    whatsappOption: 'shared' as 'shared' | 'create' | 'none',
    defaultInstanceId: '',
    viewMode: 'personal' as 'shared' | 'personal'
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  
  // Estados para edição/exclusão de usuário
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ClinicUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', role: '', status: '', instanceId: '' as string | null, newPassword: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ClinicUser | null>(null);
  
  // Estados para modal de permissões
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<ClinicUser | null>(null);
  
  // Estados para modal de metas
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [clinicGoal, setClinicGoal] = useState<number>(50000);
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});
  const [userCanSeeGoal, setUserCanSeeGoal] = useState<Record<string, boolean>>({});
  const [savingGoals, setSavingGoals] = useState(false);
  
  // Estado para abas
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'whatsapp' | 'metrics'>('overview');
  
  // Estados para métricas avançadas
  const [metricsPeriod, setMetricsPeriod] = useState<'7d' | '30d' | 'month' | 'lastMonth' | 'custom'>('month');
  const [metricsData, setMetricsData] = useState<MetricsData>({
    periodRevenue: 0,
    periodConversions: 0,
    periodLeads: 0,
    previousPeriodRevenue: 0,
    previousPeriodConversions: 0,
    previousPeriodLeads: 0,
    leadsBySource: [],
    leadsByStatus: { novo: 0, emAtendimento: 0, convertido: 0, perdido: 0 },
    avgResponseTimeMinutes: 0,
    avgConversionTimeDays: 0,
    leadsAwaiting: 0,
    lostLeads: 0,
    lossRate: 0,
    responseTimeByAttendant: new Map(),
    dailyData: [],
    monthlyGoal: 0,
    monthlyRevenue: 0,
    projectedRevenue: 0,
    daysRemaining: 0
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClinicDetails();
    }
  }, [id]);

  const fetchClinicDetails = async () => {
    try {
      // Buscar clínica
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .single();

      if (clinicError) throw clinicError;
      setClinic(clinicData);

      // Buscar usuários da clínica
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, role, status, created_at, default_instance_id, monthly_goal, can_see_goal')
        .eq('clinic_id', id)
        .order('created_at', { ascending: false });

      setUsers((usersData || []) as unknown as ClinicUser[]);

      // Buscar estatísticas
      const [usersCount, chatsCount, messagesCount, leadsCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('chats').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .in('chat_id', (await supabase.from('chats').select('id').eq('clinic_id', id)).data?.map(c => c.id) || []),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
      ]);

      setStats({
        users_count: usersCount.count || 0,
        chats_count: chatsCount.count || 0,
        messages_count: messagesCount.count || 0,
        leads_count: leadsCount.count || 0,
      });

      // Buscar instâncias WhatsApp
      const { data: instancesData } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, display_name, status, phone_number, connected_at, is_shared, user_id')
        .eq('clinic_id', id)
        .order('created_at', { ascending: true });

      setWhatsappInstances(instancesData || []);

      // Buscar faturamento
      await fetchBillingStats(usersData || []);

    } catch (error) {
      console.error('Error fetching clinic details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingStats = async (clinicUsers: ClinicUser[]) => {
    try {
      // Buscar todos os chats da clínica com assigned_to
      const { data: chatsData } = await supabase
        .from('chats')
        .select('id, assigned_to, status')
        .eq('clinic_id', id);

      if (!chatsData) return;

      const chatIds = chatsData.map(c => c.id);
      
      if (chatIds.length === 0) return;
      
      // Buscar todos os pagamentos dos chats
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('value, payment_date, chat_id')
        .in('chat_id', chatIds);

      const payments = (paymentsData || []) as Array<{ value: number; payment_date: string; chat_id: string }>;
      
      // Calcular totais gerais
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.value), 0);
      const monthlyRevenue = payments
        .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
        .reduce((sum, p) => sum + Number(p.value), 0);
      const totalConversions = chatsData.filter(c => c.status === 'Convertido').length;

      // Calcular por atendente
      const byAttendant: BillingStats['byAttendant'] = [];
      
      // Adicionar cada usuário
      clinicUsers.forEach(u => {
        const userChats = chatsData.filter(c => c.assigned_to === u.id);
        const userChatIds = userChats.map(c => c.id);
        const userPayments = payments.filter(p => userChatIds.includes(p.chat_id));
        
        byAttendant.push({
          id: u.id,
          name: u.name,
          totalRevenue: userPayments.reduce((sum, p) => sum + Number(p.value), 0),
          monthlyRevenue: userPayments
            .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
            .reduce((sum, p) => sum + Number(p.value), 0),
          conversions: userChats.filter(c => c.status === 'Convertido').length,
        });
      });

      // Adicionar "Não atribuído" para chats sem assigned_to
      const unassignedChats = chatsData.filter(c => !c.assigned_to);
      const unassignedChatIds = unassignedChats.map(c => c.id);
      const unassignedPayments = payments.filter(p => unassignedChatIds.includes(p.chat_id));
      
      if (unassignedPayments.length > 0 || unassignedChats.filter(c => c.status === 'Convertido').length > 0) {
        byAttendant.push({
          id: 'unassigned',
          name: '(Não atribuído)',
          totalRevenue: unassignedPayments.reduce((sum, p) => sum + Number(p.value), 0),
          monthlyRevenue: unassignedPayments
            .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
            .reduce((sum, p) => sum + Number(p.value), 0),
          conversions: unassignedChats.filter(c => c.status === 'Convertido').length,
        });
      }

      // Ordenar por faturamento total
      byAttendant.sort((a, b) => b.totalRevenue - a.totalRevenue);

      setBillingStats({ totalRevenue, monthlyRevenue, totalConversions, byAttendant });
    } catch (error) {
      console.error('Error fetching billing stats:', error);
    }
  };

  // Buscar métricas avançadas com filtro de período
  const fetchMetricsData = async () => {
    if (!id) return;
    setLoadingMetrics(true);
    
    try {
      // Calcular datas do período
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      let prevStartDate: Date;
      let prevEndDate: Date;
      
      switch (metricsPeriod) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          prevEndDate = new Date(startDate.getTime() - 1);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          prevStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          prevEndDate = new Date(startDate.getTime() - 1);
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
          break;
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
      }
      
      // Buscar chats da clínica
      const { data: chatsData } = await supabase
        .from('chats')
        .select('id, status, created_at, source_id')
        .eq('clinic_id', id);
      
      const allChats = (chatsData || []) as any[];
      
      // Filtrar por período
      const periodChats = allChats.filter(c => {
        const created = new Date(c.created_at);
        return created >= startDate && created <= endDate;
      });
      
      const prevPeriodChats = allChats.filter(c => {
        const created = new Date(c.created_at);
        return created >= prevStartDate && created <= prevEndDate;
      });
      
      // Buscar pagamentos
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('value, payment_date, chat_id');
      
      const allPayments = (paymentsData || []) as any[];
      
      // Filtrar pagamentos por período
      const periodPayments = allPayments.filter(p => {
        const payDate = new Date(p.payment_date);
        return payDate >= startDate && payDate <= endDate;
      });
      
      const prevPeriodPayments = allPayments.filter(p => {
        const payDate = new Date(p.payment_date);
        return payDate >= prevStartDate && payDate <= prevEndDate;
      });
      
      // Calcular métricas do período
      const periodRevenue = periodPayments.reduce((sum, p) => sum + Number(p.value), 0);
      const periodConversions = periodChats.filter(c => c.status === 'Convertido').length;
      const periodLeads = periodChats.length;
      
      // Calcular métricas do período anterior
      const previousPeriodRevenue = prevPeriodPayments.reduce((sum, p) => sum + Number(p.value), 0);
      const previousPeriodConversions = prevPeriodChats.filter(c => c.status === 'Convertido').length;
      const previousPeriodLeads = prevPeriodChats.length;
      
      // Buscar origens de leads
      const { data: sourcesData } = await supabase
        .from('lead_sources' as any)
        .select('id, name, color')
        .eq('clinic_id', id);
      
      const leadsBySource = ((sourcesData || []) as any[]).map(source => {
        const sourceChats = periodChats.filter(c => c.source_id === source.id);
        const converted = sourceChats.filter(c => c.status === 'Convertido').length;
        const sourceChatIds = sourceChats.map(c => c.id);
        const revenue = periodPayments
          .filter(p => sourceChatIds.includes(p.chat_id))
          .reduce((sum, p) => sum + Number(p.value), 0);
        
        return {
          id: source.id,
          name: source.name,
          color: source.color || '#6B7280',
          count: sourceChats.length,
          converted,
          revenue
        };
      }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
      
      // Contar leads por status (todos os chats, não só do período)
      const leadsByStatus = {
        novo: allChats.filter(c => c.status === 'Novo Lead').length,
        emAtendimento: allChats.filter(c => c.status === 'Em Atendimento').length,
        convertido: allChats.filter(c => c.status === 'Convertido').length,
        perdido: allChats.filter(c => c.status === 'Perdido').length
      };
      
      // Métricas de Tempo e Produtividade
      // Limitar análise aos últimos 30 chats para performance
      const recentChats = allChats.slice(0, 30);
      let allMessages: any[] = [];
      
      // Buscar mensagens chat por chat (incluindo sent_by para métricas por atendente)
      for (const chat of recentChats) {
        const { data: chatMessages } = await supabase
          .from('messages')
          .select('chat_id, created_at, is_from_client, sent_by')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true })
          .limit(10);
        
        if (chatMessages) {
          allMessages = [...allMessages, ...(chatMessages as any[])];
        }
      }
      
      const messages = allMessages;
      
      // Calcular tempo médio de primeira resposta (geral)
      let totalResponseTime = 0;
      let responseCount = 0;
      
      // Mapa para tempo de resposta por atendente
      const responseTimeByAttendant: Map<string, { total: number; count: number }> = new Map();
      
      recentChats.forEach(chat => {
        const chatMessages = messages.filter(m => m.chat_id === chat.id);
        const firstClientMsg = chatMessages.find(m => m.is_from_client === true);
        const firstResponse = chatMessages.find(m => m.is_from_client === false && firstClientMsg && new Date(m.created_at) > new Date(firstClientMsg.created_at));
        
        if (firstClientMsg && firstResponse) {
          const responseTime = new Date(firstResponse.created_at).getTime() - new Date(firstClientMsg.created_at).getTime();
          totalResponseTime += responseTime;
          responseCount++;
          
          // Registrar tempo por atendente
          if (firstResponse.sent_by) {
            const existing = responseTimeByAttendant.get(firstResponse.sent_by) || { total: 0, count: 0 };
            responseTimeByAttendant.set(firstResponse.sent_by, {
              total: existing.total + responseTime,
              count: existing.count + 1
            });
          }
        }
      });
      
      const avgResponseTimeMinutes = responseCount > 0 ? Math.round((totalResponseTime / responseCount) / (1000 * 60)) : 0;
      
      // Calcular tempo médio de conversão (dias entre criação e status Convertido)
      const convertedChats = recentChats.filter(c => c.status === 'Convertido');
      let totalConversionTime = 0;
      
      convertedChats.forEach(chat => {
        const chatMessages = messages.filter(m => m.chat_id === chat.id);
        if (chatMessages.length > 0) {
          const lastMsg = chatMessages[chatMessages.length - 1];
          const conversionTime = new Date(lastMsg.created_at).getTime() - new Date(chat.created_at).getTime();
          totalConversionTime += conversionTime;
        }
      });
      
      const avgConversionTimeDays = convertedChats.length > 0 ? Math.round((totalConversionTime / convertedChats.length) / (1000 * 60 * 60 * 24)) : 0;
      
      // Leads aguardando resposta (Novo Lead há mais de 2 horas)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const leadsAwaiting = allChats.filter(c => {
        if (c.status !== 'Novo Lead') return false;
        const created = new Date(c.created_at);
        return created < twoHoursAgo;
      }).length;
      
      // Leads perdidos no período
      const lostLeads = periodChats.filter(c => c.status === 'Perdido').length;
      
      // Taxa de perda
      const lossRate = periodLeads > 0 ? (lostLeads / periodLeads) * 100 : 0;
      
      // Dados diários para gráfico de evolução (últimos 30 dias)
      const dailyData: Array<{ date: string; revenue: number; leads: number; conversions: number }> = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayLeads = allChats.filter(c => c.created_at.startsWith(dateStr)).length;
        const dayConversions = allChats.filter(c => c.status === 'Convertido' && c.created_at.startsWith(dateStr)).length;
        const dayRevenue = allPayments.filter(p => p.payment_date.startsWith(dateStr)).reduce((sum, p) => sum + p.value, 0);
        
        dailyData.push({
          date: dateStr,
          revenue: dayRevenue,
          leads: dayLeads,
          conversions: dayConversions
        });
      }
      
      // Meta mensal da clínica (do banco de dados)
      const monthlyGoal = clinic?.monthly_goal || 50000;
      
      // Faturamento do mês atual
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyRevenue = allPayments
        .filter(p => new Date(p.payment_date) >= currentMonthStart)
        .reduce((sum, p) => sum + p.value, 0);
      
      // Previsão de faturamento (baseado no ritmo atual)
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - dayOfMonth;
      const dailyAverage = dayOfMonth > 0 ? monthlyRevenue / dayOfMonth : 0;
      const projectedRevenue = monthlyRevenue + (dailyAverage * daysRemaining);
      
      setMetricsData({
        periodRevenue,
        periodConversions,
        periodLeads,
        previousPeriodRevenue,
        previousPeriodConversions,
        previousPeriodLeads,
        leadsBySource,
        leadsByStatus,
        avgResponseTimeMinutes,
        avgConversionTimeDays,
        leadsAwaiting,
        lostLeads,
        lossRate,
        responseTimeByAttendant,
        dailyData,
        monthlyGoal,
        monthlyRevenue,
        projectedRevenue,
        daysRemaining
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Buscar métricas quando mudar o período ou a aba
  useEffect(() => {
    if (activeTab === 'metrics' && id) {
      fetchMetricsData();
    }
  }, [activeTab, metricsPeriod, id]);

  // Função para abrir modal de metas
  const openGoalsModal = () => {
    setClinicGoal(clinic?.monthly_goal || 50000);
    const goals: Record<string, number> = {};
    const canSee: Record<string, boolean> = {};
    users.forEach(u => {
      goals[u.id] = u.monthly_goal || 0;
      canSee[u.id] = u.can_see_goal || false;
    });
    setUserGoals(goals);
    setUserCanSeeGoal(canSee);
    setShowGoalsModal(true);
  };

  // Função para salvar metas
  const saveGoals = async () => {
    if (!clinic) return;
    setSavingGoals(true);
    try {
      // Salvar meta da clínica
      await supabase
        .from('clinics')
        .update({ monthly_goal: clinicGoal } as any)
        .eq('id', clinic.id);
      
      // Salvar metas dos usuários
      for (const [userId, goalValue] of Object.entries(userGoals)) {
        const goal = goalValue as number;
        const canSee = userCanSeeGoal[userId] || false;
        await supabase
          .from('users')
          .update({ 
            monthly_goal: goal > 0 ? goal : null,
            can_see_goal: canSee
          } as any)
          .eq('id', userId);
      }
      
      // Atualizar dados locais
      setClinic({ ...clinic, monthly_goal: clinicGoal });
      setUsers(users.map(u => ({ 
        ...u, 
        monthly_goal: userGoals[u.id] || null,
        can_see_goal: userCanSeeGoal[u.id] || false
      })));
      
      setShowGoalsModal(false);
      // Recarregar métricas
      fetchMetricsData();
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
    } finally {
      setSavingGoals(false);
    }
  };

  // Função para exportar relatório em Excel (CSV)
  const exportToExcel = () => {
    if (!clinic) return;
    
    const periodLabel = metricsPeriod === '7d' ? '7 dias' : 
                       metricsPeriod === '30d' ? '30 dias' : 
                       metricsPeriod === 'month' ? 'Este mês' : 'Mês anterior';
    
    // Cabeçalho
    let csv = `Relatório de Métricas - ${clinic.name}\n`;
    csv += `Período: ${periodLabel}\n`;
    csv += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    // Métricas Gerais
    csv += `MÉTRICAS GERAIS\n`;
    csv += `Métrica;Valor\n`;
    csv += `Faturamento do Período;${metricsData.periodRevenue.toFixed(2).replace('.', ',')}\n`;
    csv += `Leads no Período;${metricsData.periodLeads}\n`;
    csv += `Conversões no Período;${metricsData.periodConversions}\n`;
    csv += `Taxa de Conversão;${metricsData.periodLeads > 0 ? ((metricsData.periodConversions / metricsData.periodLeads) * 100).toFixed(1) : '0'}%\n`;
    csv += `Ticket Médio;${metricsData.periodConversions > 0 ? (metricsData.periodRevenue / metricsData.periodConversions).toFixed(2).replace('.', ',') : '0'}\n`;
    csv += `Tempo Médio de Resposta;${metricsData.avgResponseTimeMinutes} min\n`;
    csv += `Tempo Médio de Conversão;${metricsData.avgConversionTimeDays} dias\n`;
    csv += `Leads Aguardando;${metricsData.leadsAwaiting}\n`;
    csv += `Leads Perdidos;${metricsData.lostLeads}\n`;
    csv += `Taxa de Perda;${metricsData.lossRate.toFixed(1)}%\n\n`;
    
    // Funil de Conversão
    csv += `FUNIL DE CONVERSÃO\n`;
    csv += `Status;Quantidade\n`;
    csv += `Novo Lead;${metricsData.leadsByStatus.novo}\n`;
    csv += `Em Atendimento;${metricsData.leadsByStatus.emAtendimento}\n`;
    csv += `Convertido;${metricsData.leadsByStatus.convertido}\n`;
    csv += `Perdido;${metricsData.leadsByStatus.perdido}\n\n`;
    
    // Leads por Origem
    csv += `LEADS POR ORIGEM\n`;
    csv += `Origem;Leads;Conversões;Receita\n`;
    metricsData.leadsBySource.forEach(source => {
      csv += `${source.name};${source.count};${source.converted};${source.revenue.toFixed(2).replace('.', ',')}\n`;
    });
    csv += `\n`;
    
    // Ranking de Atendentes
    csv += `RANKING DE ATENDENTES\n`;
    csv += `Atendente;Faturamento;Conversões;Ticket Médio;Tempo Resposta (min)\n`;
    billingStats.byAttendant.forEach(att => {
      const responseData = metricsData.responseTimeByAttendant.get(att.id);
      const avgResponseTime = responseData ? Math.round((responseData.total / responseData.count) / (1000 * 60)) : '-';
      csv += `${att.name};${att.totalRevenue.toFixed(2).replace('.', ',')};${att.conversions};${att.conversions > 0 ? (att.totalRevenue / att.conversions).toFixed(2).replace('.', ',') : '0'};${avgResponseTime}\n`;
    });
    
    // Criar e baixar arquivo
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${clinic.slug || clinic.id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Função para exportar relatório em PDF (via impressão)
  const exportToPDF = () => {
    if (!clinic) return;
    
    const periodLabel = metricsPeriod === '7d' ? '7 dias' : 
                       metricsPeriod === '30d' ? '30 dias' : 
                       metricsPeriod === 'month' ? 'Este mês' : 'Mês anterior';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório - ${clinic.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
          h2 { color: #475569; margin-top: 30px; }
          .header { margin-bottom: 20px; }
          .header p { margin: 5px 0; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; }
          .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .metric-card .label { font-size: 12px; color: #64748b; }
          .metric-card .value { font-size: 24px; font-weight: bold; color: #0f172a; }
          .text-right { text-align: right; }
          .text-green { color: #059669; }
          .text-red { color: #dc2626; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Métricas</h1>
          <p><strong>Clínica:</strong> ${clinic.name}</p>
          <p><strong>Período:</strong> ${periodLabel}</p>
          <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <h2>Métricas Gerais</h2>
        <div class="metric-grid">
          <div class="metric-card">
            <div class="label">Faturamento do Período</div>
            <div class="value text-green">${formatCurrency(metricsData.periodRevenue)}</div>
          </div>
          <div class="metric-card">
            <div class="label">Leads no Período</div>
            <div class="value">${metricsData.periodLeads}</div>
          </div>
          <div class="metric-card">
            <div class="label">Conversões</div>
            <div class="value">${metricsData.periodConversions}</div>
          </div>
          <div class="metric-card">
            <div class="label">Taxa de Conversão</div>
            <div class="value">${metricsData.periodLeads > 0 ? ((metricsData.periodConversions / metricsData.periodLeads) * 100).toFixed(1) : '0'}%</div>
          </div>
          <div class="metric-card">
            <div class="label">Ticket Médio</div>
            <div class="value">${metricsData.periodConversions > 0 ? formatCurrency(metricsData.periodRevenue / metricsData.periodConversions) : 'R$ 0,00'}</div>
          </div>
          <div class="metric-card">
            <div class="label">Tempo Médio de Resposta</div>
            <div class="value">${metricsData.avgResponseTimeMinutes} min</div>
          </div>
        </div>
        
        <h2>Funil de Conversão</h2>
        <table>
          <tr><th>Status</th><th class="text-right">Quantidade</th><th class="text-right">%</th></tr>
          <tr><td>Novo Lead</td><td class="text-right">${metricsData.leadsByStatus.novo}</td><td class="text-right">${stats.leads_count > 0 ? ((metricsData.leadsByStatus.novo / stats.leads_count) * 100).toFixed(1) : 0}%</td></tr>
          <tr><td>Em Atendimento</td><td class="text-right">${metricsData.leadsByStatus.emAtendimento}</td><td class="text-right">${stats.leads_count > 0 ? ((metricsData.leadsByStatus.emAtendimento / stats.leads_count) * 100).toFixed(1) : 0}%</td></tr>
          <tr><td>Convertido</td><td class="text-right">${metricsData.leadsByStatus.convertido}</td><td class="text-right">${stats.leads_count > 0 ? ((metricsData.leadsByStatus.convertido / stats.leads_count) * 100).toFixed(1) : 0}%</td></tr>
          <tr><td>Perdido</td><td class="text-right">${metricsData.leadsByStatus.perdido}</td><td class="text-right">${stats.leads_count > 0 ? ((metricsData.leadsByStatus.perdido / stats.leads_count) * 100).toFixed(1) : 0}%</td></tr>
        </table>
        
        <h2>Leads por Origem</h2>
        <table>
          <tr><th>Origem</th><th class="text-right">Leads</th><th class="text-right">Conversões</th><th class="text-right">Receita</th></tr>
          ${metricsData.leadsBySource.map(source => `
            <tr>
              <td>${source.name}</td>
              <td class="text-right">${source.count}</td>
              <td class="text-right">${source.converted}</td>
              <td class="text-right">${formatCurrency(source.revenue)}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Ranking de Atendentes</h2>
        <table>
          <tr><th>#</th><th>Atendente</th><th class="text-right">Faturamento</th><th class="text-right">Conversões</th><th class="text-right">Ticket Médio</th><th class="text-right">Tempo Resposta</th></tr>
          ${billingStats.byAttendant.map((att, index) => {
            const responseData = metricsData.responseTimeByAttendant.get(att.id);
            const avgResponseTime = responseData ? Math.round((responseData.total / responseData.count) / (1000 * 60)) : null;
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${att.name}</td>
                <td class="text-right text-green">${formatCurrency(att.totalRevenue)}</td>
                <td class="text-right">${att.conversions}</td>
                <td class="text-right">${att.conversions > 0 ? formatCurrency(att.totalRevenue / att.conversions) : '-'}</td>
                <td class="text-right">${avgResponseTime !== null ? avgResponseTime + ' min' : '-'}</td>
              </tr>
            `;
          }).join('')}
        </table>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleImpersonate = async () => {
    if (!clinic || !user) return;
    
    setImpersonating(true);
    
    try {
      // Registrar log de acesso
      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'impersonate',
        details: { clinic_name: clinic.name },
      });

      // Usar a função do useAuth para iniciar impersonate
      const { startImpersonate } = await import('../../hooks/useAuth').then(m => {
        // Precisamos chamar via contexto, então vamos usar sessionStorage
        return { startImpersonate: () => {} };
      });

      // Salvar dados do impersonate no sessionStorage
      sessionStorage.setItem('impersonateClinic', JSON.stringify({
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug || '',
        logoUrl: null,
      }));

      // Redirecionar para o dashboard
      navigate('/dashboard');
      
      // Forçar reload para aplicar o novo contexto
      window.location.reload();
      
    } catch (error) {
      console.error('Error impersonating:', error);
      setImpersonating(false);
    }
  };

  const updateClinicStatus = async (newStatus: string) => {
    if (!clinic || !user) return;

    try {
      const { error } = await supabase
        .from('clinics')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      // Registrar log
      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: newStatus === 'active' ? 'approve' : 'suspend',
        details: { previous_status: clinic.status, new_status: newStatus },
      });

      setClinic({ ...clinic, status: newStatus });
    } catch (error) {
      console.error('Error updating clinic status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Ativo
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pendente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Suspenso
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreateUser = async () => {
    if (!clinic || !newUser.name || !newUser.email || !newUser.password) {
      setCreateUserError('Preencha todos os campos');
      return;
    }

    if (newUser.whatsappOption === 'shared' && !newUser.defaultInstanceId) {
      setCreateUserError('Selecione uma instância compartilhada');
      return;
    }

    setCreatingUser(true);
    setCreateUserError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          clinic_id: clinic.id,
          default_instance_id: newUser.whatsappOption === 'shared' ? newUser.defaultInstanceId : null,
          can_create_instance: newUser.whatsappOption === 'create',
          view_mode: newUser.whatsappOption === 'shared' ? newUser.viewMode : 'personal',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      setShowCreateUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'Comercial', whatsappOption: 'shared', defaultInstanceId: '', viewMode: 'personal' });
      fetchClinicDetails();
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEditUser = (u: ClinicUser) => {
    setEditingUser(u);
    setEditUserForm({ name: u.name, role: u.role, status: u.status, instanceId: u.default_instance_id || null, newPassword: '' });
    setEditUserError(null);
    setShowEditUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSavingUser(true);
    setEditUserError(null);

    try {
      // Atualizar dados do usuário
      const { error } = await supabase
        .from('users')
        .update({
          name: editUserForm.name,
          role: editUserForm.role,
          status: editUserForm.status,
          default_instance_id: editUserForm.instanceId || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', editingUser.id);

      if (error) throw error;

      // Se uma nova senha foi fornecida, atualizar via Edge Function
      if (editUserForm.newPassword && editUserForm.newPassword.length >= 6) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            new_password: editUserForm.newPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar senha');
        }
      }

      setShowEditUserModal(false);
      setEditingUser(null);
      fetchClinicDetails();
    } catch (error) {
      setEditUserError(error instanceof Error ? error.message : 'Erro ao salvar usuário');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeletingUserId(userToDelete.id);

    try {
      // Primeiro deletar o perfil na tabela users
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (profileError) throw profileError;

      // Deletar do Auth via Edge Function (precisa de service role)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ user_id: userToDelete.id }),
      });

      setShowDeleteConfirm(false);
      setUserToDelete(null);
      fetchClinicDetails();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    } finally {
      setDeletingUserId(null);
    }
  };

  const toggleCanCreateUsers = async () => {
    if (!clinic || !user) return;

    try {
      const newValue = !clinic.can_create_users;
      
      const { error } = await supabase
        .from('clinics')
        .update({ can_create_users: newValue, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field: 'can_create_users', old_value: clinic.can_create_users, new_value: newValue },
      });

      setClinic({ ...clinic, can_create_users: newValue });
    } catch (error) {
      console.error('Error updating can_create_users:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Clínica não encontrada</p>
          <Link to="/admin/clinics" className="text-cyan-600 hover:text-cyan-700 mt-2 inline-block">
            Voltar para lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/clinics" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para clínicas
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{clinic.name}</h1>
              <p className="text-slate-500">{clinic.slug}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(clinic.status)}
            
            <button
              onClick={handleImpersonate}
              disabled={impersonating || clinic.status !== 'active'}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              {impersonating ? 'Entrando...' : 'Logar como cliente'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.users_count}</p>
              <p className="text-sm text-slate-500">Usuários</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.chats_count}</p>
              <p className="text-sm text-slate-500">Conversas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.messages_count}</p>
              <p className="text-sm text-slate-500">Mensagens</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.leads_count}</p>
              <p className="text-sm text-slate-500">Leads</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-1">
          {[
            { id: 'overview', label: 'Visão Geral', icon: 'dashboard' },
            { id: 'users', label: 'Usuários', icon: 'group' },
            { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
            { id: 'metrics', label: 'Métricas', icon: 'analytics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Informações</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Edit className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{clinic.email || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{clinic.phone || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Plano</p>
                  <span className="text-slate-800 capitalize">{clinic.plan || 'Free'}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Máx. Usuários</p>
                  <span className="text-slate-800">{clinic.max_users}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Criada em</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{formatDate(clinic.created_at)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Última atualização</p>
                  <span className="text-slate-800">{formatDate(clinic.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">payments</span>
                Faturamento da Clínica
              </h2>
            </div>
            
            {/* Totais Gerais */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                <p className="text-emerald-100 text-sm mb-1">Faturamento Total</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.totalRevenue)}
                </p>
                <p className="text-emerald-200 text-xs mt-1">Acumulado geral</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
                <p className="text-cyan-100 text-sm mb-1">Faturamento do Mês</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.monthlyRevenue)}
                </p>
                <p className="text-cyan-200 text-xs mt-1">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white">
                <p className="text-violet-100 text-sm mb-1">Total Conversões</p>
                <p className="text-2xl font-bold">{billingStats.totalConversions}</p>
                <p className="text-violet-200 text-xs mt-1">Leads convertidos</p>
              </div>
            </div>

            {/* Por Atendente */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Faturamento por Atendente
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Atendente</th>
                      <th className="pb-3 text-right">Total</th>
                      <th className="pb-3 text-right">Mês Atual</th>
                      <th className="pb-3 text-right">Conversões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billingStats.byAttendant.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                              <span className="text-slate-600 text-sm font-medium">
                                {att.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-slate-800">{att.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-medium text-slate-800">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(att.totalRevenue)}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(att.monthlyRevenue)}
                        </td>
                        <td className="py-3 text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            {att.conversions}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {billingStats.byAttendant.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Nenhum dado de faturamento disponível
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {billingStats.byAttendant.length > 0 && (
                    <tfoot className="border-t-2 border-slate-200">
                      <tr className="font-semibold">
                        <td className="pt-3 text-slate-800">TOTAL</td>
                        <td className="pt-3 text-right text-emerald-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.totalRevenue)}
                        </td>
                        <td className="pt-3 text-right text-cyan-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.monthlyRevenue)}
                        </td>
                        <td className="pt-3 text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-600 text-white">
                            {billingStats.totalConversions}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Usuários ({users.length}/{clinic.max_users})</h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Criar Usuário
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {users.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Nenhum usuário cadastrado
                </div>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.name}</p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {u.role}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.status}
                      </span>
                      <button
                        onClick={() => { setPermissionsUser(u); setShowPermissionsModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Ver Permissões"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(u)}
                        className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => { setUserToDelete(u); setShowDeleteConfirm(true); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* WhatsApp Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              WhatsApp ({whatsappInstances.length})
            </h2>
            {whatsappInstances.length > 0 ? (
              <div className="space-y-3">
                {whatsappInstances.map((instance) => (
                  <div key={instance.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {instance.status === 'connected' ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          instance.status === 'connected' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        instance.is_shared ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {instance.is_shared ? 'Compartilhada' : 'Pessoal'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {instance.display_name || instance.phone_number || 'Sem nome'}
                    </p>
                    {instance.phone_number && (
                      <p className="text-xs text-slate-500 mt-1">
                        <Phone className="w-3 h-3 inline mr-1" />
                        {instance.phone_number}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Nenhuma instância configurada</p>
            )}
          </div>

          {/* Permissões */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Permissões</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">Criar usuários</p>
                  <p className="text-sm text-slate-500">Permitir que a clínica crie seus próprios usuários</p>
                </div>
                <button
                  onClick={toggleCanCreateUsers}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    clinic.can_create_users ? 'bg-cyan-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      clinic.can_create_users ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Ações</h2>
            <div className="space-y-3">
              {clinic.status === 'pending' && (
                <button
                  onClick={() => updateClinicStatus('active')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Aprovar Clínica
                </button>
              )}
              {clinic.status === 'active' && (
                <button
                  onClick={() => updateClinicStatus('suspended')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  Suspender Clínica
                </button>
              )}
              {clinic.status === 'suspended' && (
                <button
                  onClick={() => updateClinicStatus('active')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Reativar Clínica
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab: Usuários */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Usuários ({users.length}/{clinic.max_users})</h2>
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Users className="w-4 h-4" />
              Criar Usuário
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                Nenhum usuário cadastrado
              </div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <span className="text-slate-600 font-medium">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.name}</p>
                      <p className="text-sm text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {u.role}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      u.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {u.status}
                    </span>
                    <button
                      onClick={() => { setPermissionsUser(u); setShowPermissionsModal(true); }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Ver Permissões"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditUser(u)}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => { setUserToDelete(u); setShowDeleteConfirm(true); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Instâncias WhatsApp ({whatsappInstances.length})
            </h2>
            {whatsappInstances.length > 0 ? (
              <div className="space-y-3">
                {whatsappInstances.map((instance) => (
                  <div key={instance.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {instance.status === 'connected' ? (
                          <Wifi className="w-5 h-5 text-green-500" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          instance.status === 'connected' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        instance.is_shared ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {instance.is_shared ? 'Compartilhada' : 'Pessoal'}
                      </span>
                    </div>
                    <p className="text-base font-medium text-slate-800">
                      {instance.display_name || instance.phone_number || 'Sem nome'}
                    </p>
                    {instance.phone_number && (
                      <p className="text-sm text-slate-500 mt-1">
                        <Phone className="w-4 h-4 inline mr-1" />
                        {instance.phone_number}
                      </p>
                    )}
                    {instance.connected_at && (
                      <p className="text-xs text-slate-400 mt-2">
                        Conectado em: {new Date(instance.connected_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Nenhuma instância configurada</p>
            )}
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Configurações</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800">Criar usuários</p>
                  <p className="text-sm text-slate-500">Permitir que a clínica crie seus próprios usuários</p>
                </div>
                <button
                  onClick={toggleCanCreateUsers}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    clinic.can_create_users ? 'bg-cyan-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      clinic.can_create_users ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Métricas */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Filtro de Período e Exportação */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500">calendar_month</span>
                  <span className="text-sm font-medium text-slate-700">Período:</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: '7d', label: '7 dias' },
                    { id: '30d', label: '30 dias' },
                    { id: 'month', label: 'Este mês' },
                    { id: 'lastMonth', label: 'Mês anterior' },
                  ].map(period => (
                    <button
                      key={period.id}
                      onClick={() => setMetricsPeriod(period.id as any)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        metricsPeriod === period.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">table_chart</span>
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  PDF
                </button>
              </div>
            </div>
          </div>

          {loadingMetrics ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            </div>
          ) : (
          <>
          {/* Cards com Comparativo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
              <div className="flex items-center gap-1 text-emerald-100 text-sm mb-1">
                Faturamento do Período
                <InfoTooltip text="Soma de todos os pagamentos registrados no período selecionado. Inclui todas as vendas confirmadas." />
              </div>
              <p className="text-3xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.periodRevenue)}
              </p>
              {metricsData.previousPeriodRevenue > 0 && (
                <div className={`mt-2 flex items-center gap-1 text-sm ${
                  metricsData.periodRevenue >= metricsData.previousPeriodRevenue ? 'text-emerald-200' : 'text-red-200'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {metricsData.periodRevenue >= metricsData.previousPeriodRevenue ? 'trending_up' : 'trending_down'}
                  </span>
                  {((metricsData.periodRevenue - metricsData.previousPeriodRevenue) / metricsData.previousPeriodRevenue * 100).toFixed(1)}% vs período anterior
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white">
              <div className="flex items-center gap-1 text-cyan-100 text-sm mb-1">
                Leads no Período
                <InfoTooltip text="Quantidade de novos leads (conversas) que entraram no período selecionado." />
              </div>
              <p className="text-3xl font-bold">{metricsData.periodLeads}</p>
              {metricsData.previousPeriodLeads > 0 && (
                <div className={`mt-2 flex items-center gap-1 text-sm ${
                  metricsData.periodLeads >= metricsData.previousPeriodLeads ? 'text-cyan-200' : 'text-red-200'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {metricsData.periodLeads >= metricsData.previousPeriodLeads ? 'trending_up' : 'trending_down'}
                  </span>
                  {((metricsData.periodLeads - metricsData.previousPeriodLeads) / metricsData.previousPeriodLeads * 100).toFixed(1)}% vs período anterior
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-5 text-white">
              <div className="flex items-center gap-1 text-violet-100 text-sm mb-1">
                Conversões no Período
                <InfoTooltip text="Quantidade de leads que foram convertidos em clientes (status 'Convertido') no período." />
              </div>
              <p className="text-3xl font-bold">{metricsData.periodConversions}</p>
              {metricsData.previousPeriodConversions > 0 && (
                <div className={`mt-2 flex items-center gap-1 text-sm ${
                  metricsData.periodConversions >= metricsData.previousPeriodConversions ? 'text-violet-200' : 'text-red-200'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {metricsData.periodConversions >= metricsData.previousPeriodConversions ? 'trending_up' : 'trending_down'}
                  </span>
                  {((metricsData.periodConversions - metricsData.previousPeriodConversions) / metricsData.previousPeriodConversions * 100).toFixed(1)}% vs período anterior
                </div>
              )}
            </div>
          </div>

          {/* Métricas Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-600">receipt_long</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    Ticket Médio
                    <InfoTooltip text="Valor médio de cada venda. Calculado dividindo o faturamento total pelo número de conversões." />
                  </div>
                  <p className="text-xl font-bold text-slate-800">
                    {metricsData.periodConversions > 0 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.periodRevenue / metricsData.periodConversions)
                      : 'R$ 0,00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600">percent</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    Taxa de Conversão
                    <InfoTooltip text="Percentual de leads que se tornaram clientes. Quanto maior, melhor a eficiência comercial." />
                  </div>
                  <p className="text-xl font-bold text-slate-800">
                    {metricsData.periodLeads > 0 ? ((metricsData.periodConversions / metricsData.periodLeads) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600">payments</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    Faturamento Total
                    <InfoTooltip text="Soma de todos os pagamentos registrados desde o início. Representa o faturamento acumulado da clínica." />
                  </div>
                  <p className="text-xl font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.totalRevenue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-600">groups</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    Atendentes Ativos
                    <InfoTooltip text="Quantidade de usuários com status 'Ativo' que podem atender conversas." />
                  </div>
                  <p className="text-xl font-bold text-slate-800">{users.filter(u => u.status === 'Ativo').length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Meta vs Realizado e Previsão */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Meta vs Realizado */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-600">flag</span>
                    Meta do Mês
                  </h2>
                  <p className="text-sm text-slate-500">Progresso em relação à meta mensal</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={openGoalsModal}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Configurar
                  </button>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">
                      {((metricsData.monthlyRevenue / metricsData.monthlyGoal) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">da meta</p>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.monthlyRevenue)}
                  </span>
                  <span className="text-slate-400">
                    Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.monthlyGoal)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full transition-all duration-500 ${
                      metricsData.monthlyRevenue >= metricsData.monthlyGoal 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                        : metricsData.monthlyRevenue >= metricsData.monthlyGoal * 0.7
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-violet-500 to-violet-400'
                    }`}
                    style={{ width: `${Math.min((metricsData.monthlyRevenue / metricsData.monthlyGoal) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {metricsData.monthlyRevenue >= metricsData.monthlyGoal ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Meta atingida!
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Faltam {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.monthlyGoal - metricsData.monthlyRevenue)} para a meta
                  </span>
                )}
              </div>
            </div>

            {/* Previsão de Faturamento */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-600">trending_up</span>
                    Previsão do Mês
                  </h2>
                  <p className="text-sm text-slate-500">Estimativa baseada no ritmo atual</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Realizado até agora</p>
                  <p className="text-xl font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.monthlyRevenue)}
                  </p>
                </div>
                <div className="bg-cyan-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-cyan-600 mb-1">Previsão final</p>
                  <p className="text-xl font-bold text-cyan-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metricsData.projectedRevenue)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {metricsData.daysRemaining} dias restantes no mês
                </span>
                {metricsData.projectedRevenue >= metricsData.monthlyGoal ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                    Deve atingir a meta
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    Abaixo da meta prevista
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Gráfico de Evolução */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">show_chart</span>
                Evolução dos Últimos 30 Dias
              </h2>
              <p className="text-sm text-slate-500 mt-1">Faturamento, leads e conversões por dia</p>
            </div>
            <div className="p-6">
              {/* Mini gráfico de barras */}
              <div className="space-y-6">
                {/* Faturamento */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-500 rounded"></span>
                      Faturamento Diário
                    </span>
                    <span className="text-sm text-slate-500">
                      Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        metricsData.dailyData.reduce((sum, d) => sum + d.revenue, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-end gap-[2px] h-16">
                    {metricsData.dailyData.map((day, idx) => {
                      const maxRevenue = Math.max(...metricsData.dailyData.map(d => d.revenue), 1);
                      const height = (day.revenue / maxRevenue) * 100;
                      return (
                        <div 
                          key={idx}
                          className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-400 transition-colors cursor-pointer group relative"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(day.revenue)}`}
                        >
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{new Date(metricsData.dailyData[0]?.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                    <span>Hoje</span>
                  </div>
                </div>

                {/* Leads */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 bg-cyan-500 rounded"></span>
                      Leads por Dia
                    </span>
                    <span className="text-sm text-slate-500">
                      Total: {metricsData.dailyData.reduce((sum, d) => sum + d.leads, 0)} leads
                    </span>
                  </div>
                  <div className="flex items-end gap-[2px] h-12">
                    {metricsData.dailyData.map((day, idx) => {
                      const maxLeads = Math.max(...metricsData.dailyData.map(d => d.leads), 1);
                      const height = (day.leads / maxLeads) * 100;
                      return (
                        <div 
                          key={idx}
                          className="flex-1 bg-cyan-500 rounded-t hover:bg-cyan-400 transition-colors cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${day.leads} leads`}
                        >
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conversões */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 bg-violet-500 rounded"></span>
                      Conversões por Dia
                    </span>
                    <span className="text-sm text-slate-500">
                      Total: {metricsData.dailyData.reduce((sum, d) => sum + d.conversions, 0)} conversões
                    </span>
                  </div>
                  <div className="flex items-end gap-[2px] h-12">
                    {metricsData.dailyData.map((day, idx) => {
                      const maxConversions = Math.max(...metricsData.dailyData.map(d => d.conversions), 1);
                      const height = (day.conversions / maxConversions) * 100;
                      return (
                        <div 
                          key={idx}
                          className="flex-1 bg-violet-500 rounded-t hover:bg-violet-400 transition-colors cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${day.conversions} conversões`}
                        >
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tempo e Produtividade */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">schedule</span>
                Tempo e Produtividade
              </h2>
              <p className="text-sm text-slate-500 mt-1">Métricas de eficiência do atendimento</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-sm text-blue-600 mb-2">
                  <span className="material-symbols-outlined text-[18px]">avg_time</span>
                  Tempo de Resposta
                  <InfoTooltip text="Tempo médio entre a primeira mensagem do cliente e a primeira resposta da equipe. Quanto menor, melhor o atendimento." />
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {metricsData.avgResponseTimeMinutes > 60 
                    ? `${Math.floor(metricsData.avgResponseTimeMinutes / 60)}h ${metricsData.avgResponseTimeMinutes % 60}min`
                    : `${metricsData.avgResponseTimeMinutes} min`}
                </p>
                <p className="text-xs text-blue-500 mt-1">média de primeira resposta</p>
              </div>
              
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-sm text-emerald-600 mb-2">
                  <span className="material-symbols-outlined text-[18px]">event_available</span>
                  Tempo de Conversão
                  <InfoTooltip text="Tempo médio em dias desde o primeiro contato até a conversão em cliente. Indica a velocidade do ciclo de vendas." />
                </div>
                <p className="text-2xl font-bold text-emerald-700">
                  {metricsData.avgConversionTimeDays} dias
                </p>
                <p className="text-xs text-emerald-500 mt-1">média até converter</p>
              </div>
              
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-sm text-amber-600 mb-2">
                  <span className="material-symbols-outlined text-[18px]">pending</span>
                  Aguardando
                  <InfoTooltip text="Leads com status 'Novo Lead' há mais de 2 horas sem resposta. Requer atenção imediata!" />
                </div>
                <p className={`text-2xl font-bold ${metricsData.leadsAwaiting > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                  {metricsData.leadsAwaiting}
                </p>
                <p className="text-xs text-amber-500 mt-1">leads sem resposta (+2h)</p>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-sm text-red-600 mb-2">
                  <span className="material-symbols-outlined text-[18px]">person_off</span>
                  Leads Perdidos
                  <InfoTooltip text="Quantidade de leads que foram marcados como 'Perdido' no período selecionado." />
                </div>
                <p className="text-2xl font-bold text-red-700">
                  {metricsData.lostLeads}
                </p>
                <p className="text-xs text-red-500 mt-1">no período</p>
              </div>
              
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-sm text-slate-600 mb-2">
                  <span className="material-symbols-outlined text-[18px]">trending_down</span>
                  Taxa de Perda
                  <InfoTooltip text="Percentual de leads perdidos em relação ao total de leads do período. Quanto menor, melhor." />
                </div>
                <p className={`text-2xl font-bold ${metricsData.lossRate > 30 ? 'text-red-600' : metricsData.lossRate > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {metricsData.lossRate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">do período</p>
              </div>
            </div>
          </div>

          {/* Funil de Conversão e Leads por Origem */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil de Conversão */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600">filter_alt</span>
                  Funil de Conversão
                </h2>
                <p className="text-sm text-slate-500 mt-1">Status atual de todos os leads</p>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Novo Lead', value: metricsData.leadsByStatus.novo, color: 'bg-blue-500', total: stats.leads_count },
                  { label: 'Em Atendimento', value: metricsData.leadsByStatus.emAtendimento, color: 'bg-amber-500', total: stats.leads_count },
                  { label: 'Convertido', value: metricsData.leadsByStatus.convertido, color: 'bg-emerald-500', total: stats.leads_count },
                  { label: 'Perdido', value: metricsData.leadsByStatus.perdido, color: 'bg-red-500', total: stats.leads_count },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <span className="text-sm font-bold text-slate-800">{item.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div 
                        className={`${item.color} h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Leads por Origem */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600">source</span>
                  Leads por Origem
                </h2>
                <p className="text-sm text-slate-500 mt-1">Performance por canal de aquisição</p>
              </div>
              <div className="p-6">
                {metricsData.leadsBySource.length > 0 ? (
                  <div className="space-y-3">
                    {metricsData.leadsBySource.map(source => (
                      <div key={source.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }}></div>
                          <span className="font-medium text-slate-800">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-slate-800">{source.count}</p>
                            <p className="text-xs text-slate-500">leads</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-emerald-600">{source.converted}</p>
                            <p className="text-xs text-slate-500">conv.</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-cyan-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(source.revenue)}
                            </p>
                            <p className="text-xs text-slate-500">receita</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">Nenhuma origem cadastrada</p>
                )}
              </div>
            </div>
          </div>

          {/* Ranking de Atendentes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">emoji_events</span>
                Ranking de Atendentes
              </h2>
              <p className="text-sm text-slate-500 mt-1">Performance de vendas e tempo de resposta por atendente</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">#</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Atendente</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Faturamento</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                      <div className="flex items-center justify-center gap-1">
                        Meta
                        <InfoTooltip text="Progresso em relação à meta individual do mês. Configure as metas no botão 'Configurar'." />
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Conversões</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                      <div className="flex items-center justify-end gap-1">
                        Tempo Resposta
                        <InfoTooltip text="Tempo médio de primeira resposta do atendente. Calculado com base nos últimos 30 chats." />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billingStats.byAttendant.map((att, index) => {
                    const responseData = metricsData.responseTimeByAttendant.get(att.id);
                    const avgResponseTime = responseData ? Math.round((responseData.total / responseData.count) / (1000 * 60)) : null;
                    const userInfo = users.find(u => u.id === att.id);
                    const userGoal = userInfo?.monthly_goal || 0;
                    const goalProgress = userGoal > 0 ? (att.monthlyRevenue / userGoal) * 100 : null;
                    return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-200 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
                            <span className="text-cyan-700 font-medium text-sm">
                              {att.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-800">{att.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(att.monthlyRevenue)}
                      </td>
                      <td className="py-4 px-4">
                        {goalProgress !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden" style={{ minWidth: '80px' }}>
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  goalProgress >= 100 ? 'bg-emerald-500' :
                                  goalProgress >= 70 ? 'bg-amber-500' :
                                  'bg-violet-500'
                                }`}
                                style={{ width: `${Math.min(goalProgress, 100)}%` }}
                              ></div>
                            </div>
                            <span className={`text-xs font-medium ${
                              goalProgress >= 100 ? 'text-emerald-600' :
                              goalProgress >= 70 ? 'text-amber-600' :
                              'text-violet-600'
                            }`}>
                              {goalProgress.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sem meta</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          {att.conversions}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {avgResponseTime !== null ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            avgResponseTime <= 5 ? 'bg-emerald-100 text-emerald-700' :
                            avgResponseTime <= 15 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {avgResponseTime > 60 
                              ? `${Math.floor(avgResponseTime / 60)}h ${avgResponseTime % 60}min`
                              : `${avgResponseTime} min`}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {billingStats.byAttendant.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhum dado de faturamento disponível
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Modal Criar Usuário */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateUserModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">Criar Usuário</h3>
              <p className="text-xs text-slate-500 mt-0.5">Adicionar novo usuário à clínica {clinic.name}</p>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {createUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {createUserError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</label>
                  <input 
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Maria Silva"
                    className="w-full mt-1 h-9 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
                  <input 
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Mín. 6 caracteres"
                    className="w-full mt-1 h-9 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                <input 
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="maria@email.com"
                  className="w-full mt-1 h-9 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfil</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full mt-1 h-9 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-3 text-sm"
                >
                  <option value="Admin">Administrador - Acesso total</option>
                  <option value="Gerente">Gerente - Gerencia equipe e relatórios</option>
                  <option value="Supervisor">Supervisor - Monitora equipe</option>
                  <option value="Comercial">Comercial - Atende conversas</option>
                  <option value="Recepcionista">Recepcionista - Agendamentos</option>
                  <option value="Financeiro">Financeiro - Faturamento</option>
                  <option value="Visualizador">Visualizador - Apenas leitura</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instância WhatsApp</label>
                <div className="mt-1 space-y-1.5">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    newUser.whatsappOption === 'shared' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="whatsappOption" 
                      checked={newUser.whatsappOption === 'shared'}
                      onChange={() => setNewUser({...newUser, whatsappOption: 'shared', defaultInstanceId: ''})}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-700">Instância compartilhada</span>
                  </label>
                  
                  {newUser.whatsappOption === 'shared' && whatsappInstances.filter(i => i.is_shared).length > 0 && (
                    <select 
                      value={newUser.defaultInstanceId}
                      onChange={(e) => setNewUser({...newUser, defaultInstanceId: e.target.value})}
                      className="w-full h-8 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-2 text-sm ml-4"
                      style={{ width: 'calc(100% - 1rem)' }}
                    >
                      <option value="">Selecione...</option>
                      {whatsappInstances.filter(i => i.is_shared).map(inst => (
                        <option key={inst.id} value={inst.id}>
                          {inst.display_name || inst.phone_number || inst.instance_name} 
                          {inst.status === 'connected' ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {newUser.whatsappOption === 'shared' && whatsappInstances.filter(i => i.is_shared).length === 0 && (
                    <p className="text-xs text-amber-600 ml-4 p-1.5 bg-amber-50 rounded">
                      Nenhuma instância disponível.
                    </p>
                  )}

                  {newUser.whatsappOption === 'shared' && newUser.defaultInstanceId && (
                    <label className="flex items-center gap-2 ml-4 p-1.5 bg-slate-50 rounded cursor-pointer" style={{ width: 'calc(100% - 1rem)' }}>
                      <input 
                        type="checkbox" 
                        checked={newUser.viewMode === 'shared'}
                        onChange={(e) => setNewUser({...newUser, viewMode: e.target.checked ? 'shared' : 'personal'})}
                        className="w-3.5 h-3.5 text-cyan-600 rounded focus:ring-cyan-500"
                      />
                      <span className="text-xs text-slate-600">Painel compartilhado (vê todos os leads)</span>
                    </label>
                  )}

                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    newUser.whatsappOption === 'create' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="whatsappOption" 
                      checked={newUser.whatsappOption === 'create'}
                      onChange={() => setNewUser({...newUser, whatsappOption: 'create', defaultInstanceId: ''})}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-700">Criar nova instância</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    newUser.whatsappOption === 'none' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="whatsappOption" 
                      checked={newUser.whatsappOption === 'none'}
                      onChange={() => setNewUser({...newUser, whatsappOption: 'none', defaultInstanceId: ''})}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-700">Sem WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-3 flex-shrink-0">
              <button 
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </button>
              <button 
                onClick={() => {
                  setShowCreateUserModal(false);
                  setNewUser({ name: '', email: '', password: '', role: 'Comercial', whatsappOption: 'shared', defaultInstanceId: '', viewMode: 'personal' });
                  setCreateUserError(null);
                }}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Usuário */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Editar Usuário</h3>
            
            {editUserError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {editUserError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</label>
                <input 
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({...editUserForm, name: e.target.value})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                <input 
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 bg-slate-50 px-4 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfil</label>
                <select 
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({...editUserForm, role: e.target.value})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                >
                  <option value="Admin">Administrador</option>
                  <option value="Gerente">Gerente</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Recepcionista">Recepcionista</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Visualizador">Visualizador</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {getRoleDescription(editUserForm.role)}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                <select 
                  value={editUserForm.status}
                  onChange={(e) => setEditUserForm({...editUserForm, status: e.target.value})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instância WhatsApp</label>
                <select 
                  value={editUserForm.instanceId || ''}
                  onChange={(e) => setEditUserForm({...editUserForm, instanceId: e.target.value || null})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                >
                  <option value="">Sem instância vinculada</option>
                  {whatsappInstances.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.display_name || inst.phone_number || inst.instance_name}
                      {inst.status === 'connected' ? ' ✓' : ' (desconectado)'}
                      {inst.is_shared ? ' [Compartilhada]' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {editUserForm.instanceId 
                    ? 'Usuário vinculado a esta instância. Ao remover, ele precisará criar uma nova.'
                    : 'Sem instância. O usuário precisará criar ou vincular uma ao fazer login.'}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nova Senha</label>
                <input 
                  type="password"
                  value={editUserForm.newPassword}
                  onChange={(e) => setEditUserForm({...editUserForm, newPassword: e.target.value})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                  placeholder="Deixe em branco para manter a atual"
                  minLength={6}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Mínimo 6 caracteres. Deixe em branco para não alterar.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSaveUser}
                disabled={savingUser}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
              <button 
                onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Permissões */}
      {showPermissionsModal && permissionsUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Permissões do Usuário</h3>
                  <p className="text-white/80 text-sm">{permissionsUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowPermissionsModal(false); setPermissionsUser(null); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">Perfil Atual</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    permissionsUser.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                    permissionsUser.role === 'Gerente' ? 'bg-blue-100 text-blue-700' :
                    permissionsUser.role === 'Supervisor' ? 'bg-indigo-100 text-indigo-700' :
                    permissionsUser.role === 'Financeiro' ? 'bg-amber-100 text-amber-700' :
                    permissionsUser.role === 'Visualizador' ? 'bg-slate-100 text-slate-700' :
                    'bg-cyan-100 text-cyan-700'
                  }`}>
                    {permissionsUser.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{getRoleDescription(permissionsUser.role)}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Páginas com Acesso</h4>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.menu.map(page => (
                    <div key={page} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                      <span className="material-symbols-outlined text-green-600 text-[16px]">check_circle</span>
                      <span className="text-sm text-green-700 capitalize">{page === 'inbox' ? 'Caixa de Entrada' : page === 'kanban' ? 'Pipeline' : page === 'users' ? 'Usuários' : page === 'settings' ? 'Configurações' : page === 'connect' ? 'WhatsApp' : page}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ações Permitidas</h4>
                <div className="space-y-1.5">
                  {[
                    { key: 'send_message', label: 'Enviar mensagens', icon: 'chat' },
                    { key: 'move_lead', label: 'Mover leads no pipeline', icon: 'swap_horiz' },
                    { key: 'create_lead', label: 'Criar novos leads', icon: 'person_add' },
                    { key: 'add_quote', label: 'Adicionar orçamentos', icon: 'request_quote' },
                    { key: 'add_payment', label: 'Registrar pagamentos', icon: 'payments' },
                    { key: 'edit_tags', label: 'Gerenciar etiquetas', icon: 'label' },
                    { key: 'edit_quick_replies', label: 'Editar mensagens rápidas', icon: 'bolt' },
                    { key: 'create_user', label: 'Criar usuários', icon: 'group_add' },
                    { key: 'edit_user', label: 'Editar usuários', icon: 'manage_accounts' },
                    { key: 'change_role', label: 'Alterar perfis', icon: 'badge' },
                  ].map(action => {
                    const hasAction = ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.actions.includes(action.key as any);
                    return (
                      <div key={action.key} className={`flex items-center gap-2 p-2 rounded-lg ${hasAction ? 'bg-green-50' : 'bg-slate-50'}`}>
                        <span className={`material-symbols-outlined text-[16px] ${hasAction ? 'text-green-600' : 'text-slate-300'}`}>
                          {hasAction ? 'check_circle' : 'cancel'}
                        </span>
                        <span className={`material-symbols-outlined text-[16px] ${hasAction ? 'text-green-600' : 'text-slate-400'}`}>{action.icon}</span>
                        <span className={`text-sm ${hasAction ? 'text-green-700' : 'text-slate-400'}`}>{action.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Acesso a Dados Financeiros</h4>
                <div className={`p-3 rounded-lg ${
                  ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'all_billing' ? 'bg-green-50' :
                  ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'own_billing' ? 'bg-amber-50' :
                  'bg-red-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${
                      ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'all_billing' ? 'text-green-600' :
                      ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'own_billing' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'all_billing' ? 'visibility' :
                       ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'own_billing' ? 'visibility_lock' :
                       'visibility_off'}
                    </span>
                    <span className={`text-sm font-medium ${
                      ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'all_billing' ? 'text-green-700' :
                      ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'own_billing' ? 'text-amber-700' :
                      'text-red-700'
                    }`}>
                      {ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'all_billing' ? 'Vê faturamento de toda a clínica' :
                       ROLE_PERMISSIONS[permissionsUser.role as UserRole]?.data === 'own_billing' ? 'Vê apenas próprio faturamento' :
                       'Sem acesso a dados financeiros'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-500 text-center">
                Para alterar as permissões, edite o perfil do usuário clicando no botão de edição.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600 text-2xl">warning</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Usuário</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja excluir <strong>{userToDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleDeleteUser}
                disabled={deletingUserId === userToDelete.id}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingUserId === userToDelete.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
              <button 
                onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Metas */}
      {showGoalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowGoalsModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-600">flag</span>
                Configurar Metas Mensais
              </h3>
              <p className="text-sm text-slate-500 mt-1">Defina as metas de faturamento da clínica e dos atendentes</p>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Meta da Clínica */}
              <div className="bg-violet-50 rounded-xl p-4">
                <label className="text-sm font-bold text-violet-700 flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]">business</span>
                  Meta Geral da Clínica
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">R$</span>
                  <input 
                    type="number"
                    value={clinicGoal}
                    onChange={(e) => setClinicGoal(Number(e.target.value))}
                    className="flex-1 h-12 rounded-lg border-slate-200 focus:ring-violet-500 focus:border-violet-500 px-4 text-lg font-bold"
                    placeholder="50000"
                  />
                </div>
                <p className="text-xs text-violet-600 mt-2">
                  Esta é a meta total de faturamento mensal da clínica
                </p>
              </div>

              {/* Metas por Atendente */}
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]">group</span>
                  Metas Individuais por Atendente
                </label>
                <div className="space-y-3">
                  {users.filter(u => u.status === 'Ativo').map(user => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-cyan-700 font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm">R$</span>
                          <input 
                            type="number"
                            value={userGoals[user.id] || ''}
                            onChange={(e) => setUserGoals({ ...userGoals, [user.id]: Number(e.target.value) })}
                            className="w-24 h-10 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-3 text-right font-medium"
                            placeholder="0"
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer" title="Permitir que o atendente veja sua meta">
                          <input
                            type="checkbox"
                            checked={userCanSeeGoal[user.id] || false}
                            onChange={(e) => setUserCanSeeGoal({ ...userCanSeeGoal, [user.id]: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="material-symbols-outlined text-[18px] text-slate-500">visibility</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  {users.filter(u => u.status === 'Ativo').length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Nenhum atendente ativo encontrado
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Deixe em branco ou 0 para atendentes sem meta individual. 
                  <span className="inline-flex items-center gap-1 ml-1">
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                    = atendente pode ver sua meta
                  </span>
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button 
                onClick={saveGoals}
                disabled={savingGoals}
                className="flex-1 h-11 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingGoals ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Metas
                  </>
                )}
              </button>
              <button 
                onClick={() => setShowGoalsModal(false)}
                className="px-6 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClinicDetail;
