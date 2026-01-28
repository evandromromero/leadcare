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
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_PERMISSIONS, getRoleDescription, UserRole } from '../../lib/permissions';

interface MetaConversionLog {
  id: string;
  event_id: string;
  event_name: string;
  event_time: number;
  value: number;
  status: string;
  error_message: string | null;
  payload: any;
  response: any;
  created_at: string;
  chat_id: string | null;
}

const MetaConversionLogs: React.FC<{ clinicId: string }> = ({ clinicId }) => {
  const [logs, setLogs] = useState<MetaConversionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('meta_conversion_logs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setLogs(data || []);
      setLoading(false);
    };

    fetchLogs();
  }, [clinicId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
          <span className="text-sm">Carregando logs...</span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="mt-4 p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-500 text-center">Nenhum evento enviado ainda</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-700 mb-2">Últimos eventos enviados</h3>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div 
              className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`size-2 rounded-full ${
                  log.status === 'success' ? 'bg-green-500' : 
                  log.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <div>
                  <span className="text-sm font-medium text-slate-700">{log.event_name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    R$ {log.value?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{formatDate(log.created_at)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  log.status === 'success' ? 'bg-green-100 text-green-700' : 
                  log.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {log.status === 'success' ? 'Enviado' : log.status === 'error' ? 'Erro' : 'Pendente'}
                </span>
                {expandedLog === log.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
            
            {expandedLog === log.id && (
              <div className="p-3 border-t border-slate-200 bg-white">
                <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                  <div>
                    <span className="text-slate-500">Event ID:</span>
                    <span className="ml-1 font-mono text-slate-700">{log.event_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Event Time:</span>
                    <span className="ml-1 text-slate-700">{new Date(log.event_time * 1000).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                
                {log.error_message && (
                  <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-700">
                    <span className="font-medium">Erro:</span> {log.error_message}
                  </div>
                )}
                
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-slate-600">Payload enviado:</span>
                    <pre className="mt-1 p-2 bg-slate-100 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                  
                  {log.response && (
                    <div>
                      <span className="text-xs font-medium text-slate-600">Resposta do Meta:</span>
                      <pre className="mt-1 p-2 bg-slate-100 rounded text-xs overflow-x-auto max-h-40">
                        {JSON.stringify(log.response, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

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
  whatsapp_provider?: 'evolution' | 'cloud_api';
  cloud_api_enabled?: boolean;
  cloud_api_access_token?: string | null;
  cloud_api_phone_number_id?: string | null;
  cloud_api_waba_id?: string | null;
  cloud_api_app_id?: string | null;
  cloud_api_verify_token?: string | null;
  facebook_dataset_id?: string | null;
  facebook_api_token?: string | null;
  meta_event_name?: string | null;
  meta_action_source?: string | null;
  meta_funnel_events?: Record<string, string> | null;
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

interface WhatsAppTemplate {
  id: string;
  template_id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
}

interface MassMessageCampaign {
  id: string;
  name: string;
  template_id: string | null;
  status: string;
  scheduled_for: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
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
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<MassMessageCampaign[]>([]);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [massMessageForm, setMassMessageForm] = useState({ name: '', phones: '' });
  const [sendingMassMessage, setSendingMassMessage] = useState(false);
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
  
  // Estados para edição de limite de usuários
  const [editingMaxUsers, setEditingMaxUsers] = useState(false);
  const [tempMaxUsers, setTempMaxUsers] = useState<number>(5);
  
  // Estados para modal de edição da clínica
  const [showEditClinicModal, setShowEditClinicModal] = useState(false);
  const [editClinicForm, setEditClinicForm] = useState({
    name: '',
    email: '',
    phone: '',
    plan: '',
    max_users: 5
  });
  const [savingClinic, setSavingClinic] = useState(false);
  
  // Estados para modal de metas
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  
  // Estado para modal de ajuda Meta Conversions
  const [showMetaHelpModal, setShowMetaHelpModal] = useState(false);
  
  // Estados para modal de teste SMTP
  const [showSmtpTestModal, setShowSmtpTestModal] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSmtpSaveSuccess, setShowSmtpSaveSuccess] = useState(false);
  const [clinicGoal, setClinicGoal] = useState<number>(50000);
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});
  const [userCanSeeGoal, setUserCanSeeGoal] = useState<Record<string, boolean>>({});
  const [savingGoals, setSavingGoals] = useState(false);
  
  // Estado para abas
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'whatsapp' | 'integrations' | 'metrics' | 'receipts' | 'subscription'>('overview');
  
  // Estados para aba de Lançamentos
  const [receiptsData, setReceiptsData] = useState<{
    totalComercial: number;
    totalRecebido: number;
    roi: string;
    byAttendant: Array<{
      id: string;
      name: string;
      salesCount: number;
      commercialValue: number;
      receivedValue: number;
      roi: string;
    }>;
    details: Array<{
      id: string;
      clientName: string;
      paymentDate: string;
      sourceName: string;
      sourceColor: string;
      attendantName: string;
      commercialValue: number;
      receivedValue: number;
      status: 'pending' | 'received' | 'partial';
    }>;
  }>({
    totalComercial: 0,
    totalRecebido: 0,
    roi: '0',
    byAttendant: [],
    details: []
  });
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  
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
      const [usersCount, chatsCount, leadsCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('chats').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
      ]);

      setStats({
        users_count: usersCount.count || 0,
        chats_count: chatsCount.count || 0,
        messages_count: 0,
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
      
      // Buscar todos os pagamentos da clínica diretamente (excluindo canceladas)
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('value, payment_date, chat_id, created_by, status')
        .eq('clinic_id', id)
        .or('status.is.null,status.eq.active');

      const payments = (paymentsData || []) as Array<{ value: number; payment_date: string; chat_id: string; created_by: string | null }>;
      
      // Calcular totais gerais
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.value), 0);
      const monthlyRevenue = payments
        .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
        .reduce((sum, p) => sum + Number(p.value), 0);
      const totalConversions = chatsData.filter(c => c.status === 'Convertido').length;

      // Calcular por atendente - usando created_by (quem criou o pagamento)
      const byAttendant: BillingStats['byAttendant'] = [];
      
      // Adicionar cada usuário baseado em quem CRIOU o pagamento
      clinicUsers.forEach(u => {
        const userPayments = payments.filter(p => p.created_by === u.id);
        const userChats = chatsData.filter(c => c.assigned_to === u.id);
        
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

      // Adicionar "Não atribuído" para pagamentos sem created_by
      const unassignedPayments = payments.filter(p => !p.created_by);
      const unassignedChats = chatsData.filter(c => !c.assigned_to);
      
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
      
      // Buscar pagamentos (excluindo canceladas)
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('value, payment_date, chat_id, status')
        .eq('clinic_id', id)
        .or('status.is.null,status.eq.active');
      
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

  // Buscar dados de lançamentos quando abrir a aba
  useEffect(() => {
    if (activeTab === 'receipts' && id) {
      fetchReceiptsData();
    }
  }, [activeTab, id]);

  // Função para buscar dados de lançamentos
  const fetchReceiptsData = async () => {
    if (!id) return;
    setLoadingReceipts(true);
    
    try {
      // Buscar todos os payments da clínica (excluindo canceladas)
      const { data: paymentsData } = await supabase
        .from('payments' as any)
        .select('id, value, payment_date, chat_id, created_by, status, chat:chats(id, client_name, source_id)')
        .eq('clinic_id', id)
        .or('status.is.null,status.eq.active')
        .order('payment_date', { ascending: false });

      // Buscar usuários da clínica
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .eq('clinic_id', id);

      // Buscar origens
      const { data: sourcesData } = await supabase
        .from('lead_sources' as any)
        .select('id, name, color')
        .eq('clinic_id', id);

      // Buscar receitas
      const paymentIds = ((paymentsData || []) as any[]).map(p => p.id);
      let receiptsData: any[] = [];
      if (paymentIds.length > 0) {
        const { data } = await supabase
          .from('clinic_receipts' as any)
          .select('total_value, payment_id')
          .in('payment_id', paymentIds);
        receiptsData = (data || []) as any[];
      }

      // Calcular totais
      const totalComercial = ((paymentsData || []) as any[]).reduce((sum, p) => sum + Number(p.value), 0);
      const totalRecebido = receiptsData.reduce((sum, r) => sum + Number(r.total_value), 0);
      const roi = totalComercial > 0 ? ((totalRecebido / totalComercial) * 100).toFixed(1) : '0';

      // Agrupar por atendente
      const attendantMap = new Map<string, { salesCount: number; commercialValue: number; receivedValue: number }>();
      ((paymentsData || []) as any[]).forEach(p => {
        const attendantId = p.created_by || 'unknown';
        if (!attendantMap.has(attendantId)) {
          attendantMap.set(attendantId, { salesCount: 0, commercialValue: 0, receivedValue: 0 });
        }
        const att = attendantMap.get(attendantId)!;
        att.salesCount++;
        att.commercialValue += Number(p.value);
        
        const paymentReceipts = receiptsData.filter(r => r.payment_id === p.id);
        att.receivedValue += paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
      });

      const byAttendant = Array.from(attendantMap.entries()).map(([attendantId, data]) => {
        const user = ((usersData || []) as any[]).find(u => u.id === attendantId);
        return {
          id: attendantId,
          name: user?.name || 'Desconhecido',
          salesCount: data.salesCount,
          commercialValue: data.commercialValue,
          receivedValue: data.receivedValue,
          roi: data.commercialValue > 0 ? ((data.receivedValue / data.commercialValue) * 100).toFixed(1) : '0'
        };
      }).sort((a, b) => b.commercialValue - a.commercialValue);

      // Montar detalhes
      const details = ((paymentsData || []) as any[]).map(p => {
        const paymentReceipts = receiptsData.filter(r => r.payment_id === p.id);
        const receivedValue = paymentReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
        const source = ((sourcesData || []) as any[]).find(s => s.id === p.chat?.source_id);
        const attendant = ((usersData || []) as any[]).find(u => u.id === p.created_by);
        
        let status: 'pending' | 'received' | 'partial' = 'pending';
        if (receivedValue > 0) {
          status = receivedValue >= Number(p.value) ? 'received' : 'partial';
        }
        
        return {
          id: p.id,
          clientName: p.chat?.client_name || 'Cliente',
          paymentDate: p.payment_date,
          sourceName: source?.name || '-',
          sourceColor: source?.color || '#94a3b8',
          attendantName: attendant?.name || 'Desconhecido',
          commercialValue: Number(p.value),
          receivedValue,
          status
        };
      });

      setReceiptsData({ totalComercial, totalRecebido, roi, byAttendant, details });
    } catch (err) {
      console.error('Error fetching receipts data:', err);
    } finally {
      setLoadingReceipts(false);
    }
  };

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
    if (!editingUser || !clinic) return;
    
    setSavingUser(true);
    setEditUserError(null);

    try {
      // Validar limite ao reativar usuário
      if (editingUser.status === 'Inativo' && editUserForm.status === 'Ativo') {
        const activeUsersCount = users.filter(u => u.status === 'Ativo').length;
        if (activeUsersCount >= clinic.max_users) {
          throw new Error(`Limite de ${clinic.max_users} usuários ativos atingido. Inative outro usuário antes de reativar este.`);
        }
      }

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

  const updateWhatsAppProvider = async (provider: 'evolution' | 'cloud_api') => {
    if (!clinic || !user) return;

    try {
      const { error } = await supabase
        .from('clinics')
        .update({ whatsapp_provider: provider, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field: 'whatsapp_provider', old_value: clinic.whatsapp_provider, new_value: provider },
      });

      setClinic({ ...clinic, whatsapp_provider: provider });
    } catch (error) {
      console.error('Error updating whatsapp_provider:', error);
    }
  };

  const updateCloudApiField = async (field: string, value: string) => {
    if (!clinic || !user) return;

    try {
      const { error } = await supabase
        .from('clinics')
        .update({ [field]: value || null, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      setClinic({ ...clinic, [field]: value || null } as ClinicDetail);
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  const toggleCloudApiEnabled = async () => {
    if (!clinic || !user) return;

    try {
      const newValue = !clinic.cloud_api_enabled;
      
      const { error } = await supabase
        .from('clinics')
        .update({ cloud_api_enabled: newValue, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field: 'cloud_api_enabled', old_value: clinic.cloud_api_enabled, new_value: newValue },
      });

      setClinic({ ...clinic, cloud_api_enabled: newValue });
    } catch (error) {
      console.error('Error updating cloud_api_enabled:', error);
    }
  };

  const toggleChannelEnabled = async (channel: 'instagram' | 'facebook') => {
    if (!clinic || !user) return;

    try {
      const field = `${channel}_enabled`;
      const currentValue = (clinic as any)[field] || false;
      const newValue = !currentValue;
      
      const { error } = await supabase
        .from('clinics')
        .update({ [field]: newValue, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field, old_value: currentValue, new_value: newValue },
      });

      setClinic({ ...clinic, [field]: newValue } as any);
    } catch (error) {
      console.error(`Error updating ${channel}_enabled:`, error);
    }
  };

  const fetchTemplates = async () => {
    if (!clinic) return;
    
    const { data } = await (supabase as any)
      .from('whatsapp_templates')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('name');
    
    if (data) setTemplates(data as WhatsAppTemplate[]);
  };

  const fetchCampaigns = async () => {
    if (!clinic) return;
    
    const { data } = await (supabase as any)
      .from('mass_message_campaigns')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setCampaigns(data as MassMessageCampaign[]);
  };

  const syncTemplates = async () => {
    if (!clinic) return;
    
    setSyncingTemplates(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          clinic_id: clinic.id,
          action: 'sync_templates',
        }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        alert(`Erro ao sincronizar: ${result.error}`);
      } else {
        alert(`${result.count} templates sincronizados!`);
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Error syncing templates:', error);
      alert('Erro ao sincronizar templates');
    } finally {
      setSyncingTemplates(false);
    }
  };

  const sendMassMessage = async () => {
    if (!clinic || !selectedTemplate || !massMessageForm.phones.trim()) return;
    
    setSendingMassMessage(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const phones = massMessageForm.phones
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const phone of phones) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              clinic_id: clinic.id,
              action: 'send_template',
              phone: phone,
              template_name: selectedTemplate.name,
              template_language: selectedTemplate.language,
            }),
          });
          
          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to send to ${phone}:`, result.error);
          }
        } catch (err) {
          failCount++;
          console.error(`Error sending to ${phone}:`, err);
        }
      }
      
      alert(`Envio concluído!\n✅ Sucesso: ${successCount}\n❌ Falha: ${failCount}`);
      setShowMassMessageModal(false);
      setMassMessageForm({ name: '', phones: '' });
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error sending mass message:', error);
      alert('Erro ao enviar mensagens');
    } finally {
      setSendingMassMessage(false);
    }
  };

  const updateMaxUsers = async (newLimit: number) => {
    if (!clinic || !user) return;

    const activeUsersCount = users.filter(u => u.status === 'Ativo').length;
    if (newLimit < activeUsersCount) {
      alert(`Não é possível definir limite menor que o número de usuários ativos (${activeUsersCount})`);
      return;
    }

    try {
      const { error } = await supabase
        .from('clinics')
        .update({ max_users: newLimit, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field: 'max_users', old_value: clinic.max_users, new_value: newLimit },
      });

      setClinic({ ...clinic, max_users: newLimit });
    } catch (error) {
      console.error('Error updating max_users:', error);
    }
  };

  const openEditClinicModal = () => {
    if (!clinic) return;
    setEditClinicForm({
      name: clinic.name,
      email: clinic.email || '',
      phone: clinic.phone || '',
      plan: clinic.plan || 'free',
      max_users: clinic.max_users
    });
    setShowEditClinicModal(true);
  };

  const handleSaveClinic = async () => {
    if (!clinic || !user) return;
    
    const activeUsersCount = users.filter(u => u.status === 'Ativo').length;
    if (editClinicForm.max_users < activeUsersCount) {
      alert(`Não é possível definir limite menor que o número de usuários ativos (${activeUsersCount})`);
      return;
    }

    setSavingClinic(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          name: editClinicForm.name,
          email: editClinicForm.email || null,
          phone: editClinicForm.phone || null,
          plan: editClinicForm.plan,
          max_users: editClinicForm.max_users,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { 
          changes: {
            name: { old: clinic.name, new: editClinicForm.name },
            email: { old: clinic.email, new: editClinicForm.email },
            phone: { old: clinic.phone, new: editClinicForm.phone },
            plan: { old: clinic.plan, new: editClinicForm.plan },
            max_users: { old: clinic.max_users, new: editClinicForm.max_users }
          }
        },
      });

      setClinic({ 
        ...clinic, 
        name: editClinicForm.name,
        email: editClinicForm.email || null,
        phone: editClinicForm.phone || null,
        plan: editClinicForm.plan,
        max_users: editClinicForm.max_users
      });
      setShowEditClinicModal(false);
    } catch (error) {
      console.error('Error updating clinic:', error);
    } finally {
      setSavingClinic(false);
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
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link 
          to="/admin/clinics" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{clinic.name}</h1>
              <p className="text-sm text-slate-500 truncate">{clinic.slug}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {getStatusBadge(clinic.status)}
            
            <button
              onClick={handleImpersonate}
              disabled={impersonating || clinic.status !== 'active'}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{impersonating ? 'Entrando...' : 'Logar como cliente'}</span>
              <span className="sm:hidden">{impersonating ? '...' : 'Logar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.users_count}</p>
              <p className="text-xs sm:text-sm text-slate-500">Usuários</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.chats_count}</p>
              <p className="text-xs sm:text-sm text-slate-500">Conversas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.leads_count}</p>
              <p className="text-xs sm:text-sm text-slate-500">Leads</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 border-b border-slate-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {[
            { id: 'overview', label: 'Geral', labelFull: 'Visão Geral', icon: 'dashboard' },
            { id: 'users', label: 'Usuários', labelFull: 'Usuários', icon: 'group' },
            { id: 'whatsapp', label: 'WhatsApp', labelFull: 'WhatsApp', icon: 'chat' },
            { id: 'integrations', label: 'Integr.', labelFull: 'Integrações', icon: 'extension' },
            { id: 'metrics', label: 'Métricas', labelFull: 'Métricas', icon: 'analytics' },
            { id: 'receipts', label: 'Lanç.', labelFull: 'Lançamentos', icon: 'receipt_long' },
            { id: 'subscription', label: 'Plano', labelFull: 'Assinatura', icon: 'credit_card' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.labelFull}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Clinic Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">Informações</h2>
              <button 
                onClick={openEditClinicModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Editar informações"
              >
                <Edit className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm sm:text-base text-slate-800 truncate">{clinic.email || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm sm:text-base text-slate-800">{clinic.phone || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Plano</p>
                  <span className="text-sm sm:text-base text-slate-800 capitalize">{clinic.plan || 'Free'}</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Usuários Ativos / Limite</p>
                  <div className="flex items-center gap-2">
                    {editingMaxUsers ? (
                      <>
                        <span className="text-sm sm:text-base text-slate-800">
                          {users.filter(u => u.status === 'Ativo').length} /
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={tempMaxUsers}
                          onChange={(e) => setTempMaxUsers(Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (tempMaxUsers > 0) {
                              updateMaxUsers(tempMaxUsers);
                            }
                            setEditingMaxUsers(false);
                          }}
                          className="p-1 text-green-600 hover:text-green-700"
                          title="Salvar"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingMaxUsers(false)}
                          className="p-1 text-red-500 hover:text-red-600"
                          title="Cancelar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm sm:text-base text-slate-800">
                          {users.filter(u => u.status === 'Ativo').length} / {clinic.max_users}
                        </span>
                        <button
                          onClick={() => {
                            setTempMaxUsers(clinic.max_users);
                            setEditingMaxUsers(true);
                          }}
                          className="p-1 text-slate-400 hover:text-cyan-600 transition-colors"
                          title="Editar limite"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Criada em</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm sm:text-base text-slate-800">{formatDate(clinic.created_at)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500 mb-1">Última atualização</p>
                  <span className="text-sm sm:text-base text-slate-800">{formatDate(clinic.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px] sm:text-[24px]">payments</span>
                Faturamento
              </h2>
            </div>
            
            {/* Totais Gerais */}
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 border-b border-slate-200">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3 sm:p-4 text-white">
                <p className="text-emerald-100 text-xs sm:text-sm mb-1">Faturamento Total</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.totalRevenue)}
                </p>
                <p className="text-emerald-200 text-[10px] sm:text-xs mt-1">Acumulado geral</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-3 sm:p-4 text-white">
                <p className="text-cyan-100 text-xs sm:text-sm mb-1">Faturamento do Mês</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(billingStats.monthlyRevenue)}
                </p>
                <p className="text-cyan-200 text-[10px] sm:text-xs mt-1">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-3 sm:p-4 text-white">
                <p className="text-violet-100 text-xs sm:text-sm mb-1">Total Conversões</p>
                <p className="text-xl sm:text-2xl font-bold">{billingStats.totalConversions}</p>
                <p className="text-violet-200 text-[10px] sm:text-xs mt-1">Leads convertidos</p>
              </div>
            </div>

            {/* Por Atendente */}
            <div className="p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Por Atendente
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Atendente</th>
                      <th className="pb-3 text-right">Total</th>
                      <th className="pb-3 text-right hidden sm:table-cell">Mês</th>
                      <th className="pb-3 text-right">Conv.</th>
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
              <h2 className="text-lg font-semibold text-slate-800">Usuários Ativos ({users.filter(u => u.status === 'Ativo').length}/{clinic.max_users})</h2>
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
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">Usuários Ativos ({users.filter(u => u.status === 'Ativo').length}/{clinic.max_users})</h2>
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Criar Usuário</span>
              <span className="sm:hidden">Criar</span>
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                Nenhum usuário cadastrado
              </div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-slate-600 font-medium text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm sm:text-base truncate">{u.name}</p>
                        <p className="text-xs sm:text-sm text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-12 sm:ml-0 flex-wrap">
                      <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                        u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {u.role}
                      </span>
                      <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                        u.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.status}
                      </span>
                      <div className="flex items-center gap-1">
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === 'whatsapp' && (
        <>
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

              {/* WhatsApp Provider Selection */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-800 mb-2">Provedor WhatsApp</p>
                <p className="text-sm text-slate-500 mb-3">Escolha como esta clínica vai se conectar ao WhatsApp</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateWhatsAppProvider('evolution')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      (clinic.whatsapp_provider || 'evolution') === 'evolution'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-cyan-600">qr_code_2</span>
                      <span className="font-medium text-slate-800">Evolution API</span>
                    </div>
                    <p className="text-xs text-slate-500 text-left">Conexão via QR Code (Baileys)</p>
                  </button>
                  <button
                    onClick={() => updateWhatsAppProvider('cloud_api')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      clinic.whatsapp_provider === 'cloud_api'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-emerald-600">verified</span>
                      <span className="font-medium text-slate-800">Cloud API</span>
                    </div>
                    <p className="text-xs text-slate-500 text-left">API Oficial do Meta</p>
                  </button>
                </div>
              </div>

              
              {/* Aviso para configurar Cloud API na aba Integrações */}
              {clinic.whatsapp_provider === 'cloud_api' && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-600 mt-0.5">info</span>
                    <div>
                      <p className="font-medium text-emerald-800">Cloud API selecionada</p>
                      <p className="text-sm text-emerald-700 mt-1">
                        Configure as credenciais da Cloud API na aba <strong>"Integrações"</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Templates e Envio em Massa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Aviso se Cloud API não configurada */}
          {(clinic.whatsapp_provider !== 'cloud_api' || !clinic.cloud_api_waba_id) && (
            <div className="lg:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                <div>
                  <p className="font-medium text-amber-800">Cloud API não configurada</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Para usar Templates e Envio em Massa, configure a <strong>Cloud API</strong> acima com Phone Number ID, Access Token e WABA ID.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Templates */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Templates</h2>
              <button
                onClick={() => { syncTemplates(); fetchTemplates(); }}
                disabled={syncingTemplates || clinic.whatsapp_provider !== 'cloud_api' || !clinic.cloud_api_waba_id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-[16px] ${syncingTemplates ? 'animate-spin' : ''}`}>
                  {syncingTemplates ? 'progress_activity' : 'sync'}
                </span>
                Sincronizar
              </button>
            </div>
            
            {templates.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <div 
                    key={template.id} 
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{template.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          template.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          template.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {template.status}
                        </span>
                        <span className="text-xs text-slate-500">{template.category}</span>
                      </div>
                    </div>
                    {template.status === 'APPROVED' && (
                      <button
                        onClick={() => { setSelectedTemplate(template); setShowMassMessageModal(true); }}
                        disabled={clinic.whatsapp_provider !== 'cloud_api' || !clinic.cloud_api_waba_id}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enviar em massa"
                      >
                        <span className="material-symbols-outlined text-[20px]">send</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">description</span>
                <p className="text-slate-500 text-sm">
                  {clinic.whatsapp_provider === 'cloud_api' && clinic.cloud_api_waba_id
                    ? 'Nenhum template encontrado. Clique em "Sincronizar" para buscar do Meta.'
                    : 'Configure a Cloud API para sincronizar templates.'}
                </p>
              </div>
            )}
          </div>

          {/* Histórico de Campanhas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Histórico de Envios</h2>
            
            {campaigns.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">{campaign.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        campaign.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        campaign.status === 'running' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Enviados: {campaign.sent_count}/{campaign.total_recipients}</span>
                      <span>Entregues: {campaign.delivered_count}</span>
                      <span>Falhas: {campaign.failed_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">campaign</span>
                <p className="text-slate-500 text-sm">Nenhum envio em massa realizado ainda.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Envio em Massa */}
        {showMassMessageModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Envio em Massa</h3>
                <button 
                  onClick={() => { setShowMassMessageModal(false); setSelectedTemplate(null); }}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm font-medium text-emerald-800">Template: {selectedTemplate.name}</p>
                  <p className="text-xs text-emerald-600 mt-1">{selectedTemplate.category} • {selectedTemplate.language}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700">Números de telefone</label>
                  <p className="text-xs text-slate-500 mb-2">Um número por linha (com DDD)</p>
                  <textarea
                    value={massMessageForm.phones}
                    onChange={(e) => setMassMessageForm({ ...massMessageForm, phones: e.target.value })}
                    placeholder="11999999999&#10;21988888888&#10;31977777777"
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {massMessageForm.phones.split('\n').filter(p => p.trim()).length} números
                  </p>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setShowMassMessageModal(false); setSelectedTemplate(null); }}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={sendMassMessage}
                    disabled={sendingMassMessage || !massMessageForm.phones.trim()}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingMassMessage ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* Tab: Integrações */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* WhatsApp Cloud API */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600">verified</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">WhatsApp Cloud API</h3>
                    <p className="text-sm text-slate-500">API Oficial do Meta para WhatsApp Business</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clinic.cloud_api_enabled || false}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      await toggleCloudApiEnabled();
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
            
            {clinic.cloud_api_enabled && (
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-600 mt-0.5">info</span>
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Habilitado para o cliente</p>
                      <p className="text-sm text-emerald-700 mt-1">
                        O cliente pode configurar a Cloud API no painel dele. Configure abaixo as credenciais ou deixe o cliente configurar.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Configuração Cloud API */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Configuração Cloud API</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Phone Number ID *</label>
                      <input
                        type="text"
                        value={clinic.cloud_api_phone_number_id || ''}
                        onChange={(e) => updateCloudApiField('cloud_api_phone_number_id', e.target.value)}
                        placeholder="Ex: 123456789012345"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Access Token *</label>
                      <input
                        type="password"
                        value={clinic.cloud_api_access_token || ''}
                        onChange={(e) => updateCloudApiField('cloud_api_access_token', e.target.value)}
                        placeholder="Token do System User"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">WABA ID</label>
                      <input
                        type="text"
                        value={clinic.cloud_api_waba_id || ''}
                        onChange={(e) => updateCloudApiField('cloud_api_waba_id', e.target.value)}
                        placeholder="WhatsApp Business Account ID"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">App ID</label>
                      <input
                        type="text"
                        value={clinic.cloud_api_app_id || ''}
                        onChange={(e) => updateCloudApiField('cloud_api_app_id', e.target.value)}
                        placeholder="ID do App no Meta for Developers"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600 uppercase">Verify Token (Webhook)</label>
                      <input
                        type="text"
                        value={clinic.cloud_api_verify_token || ''}
                        onChange={(e) => updateCloudApiField('cloud_api_verify_token', e.target.value)}
                        placeholder="Token para verificação do webhook"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-600 mb-2"><span className="font-medium">Webhook URL:</span></p>
                    <code className="block p-2 bg-slate-50 rounded text-xs text-slate-600 break-all">
                      {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-cloud-webhook`}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instagram Direct */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Instagram Direct</h3>
                    <p className="text-sm text-slate-500">Integração com mensagens do Instagram</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(clinic as any).instagram_enabled || false}
                    onChange={() => toggleChannelEnabled('instagram')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                </label>
              </div>
            </div>
            
            {(clinic as any).instagram_enabled && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(clinic as any).instagram_client_can_configure || false}
                      onChange={(e) => updateCloudApiField('instagram_client_can_configure', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-slate-600">Cliente pode configurar</span>
                  </label>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 uppercase">Page ID</label>
                    <input
                      type="text"
                      value={(clinic as any).instagram_page_id || ''}
                      onChange={(e) => updateCloudApiField('instagram_page_id', e.target.value)}
                      placeholder="ID da página do Instagram"
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 uppercase">Access Token</label>
                    <input
                      type="password"
                      value={(clinic as any).instagram_access_token || ''}
                      onChange={(e) => updateCloudApiField('instagram_access_token', e.target.value)}
                      placeholder="Token de acesso do Instagram"
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Facebook Messenger */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.627 0-12 4.975-12 11.111 0 3.497 1.745 6.616 4.472 8.652v4.237l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111 0-6.136-5.373-11.111-12-11.111zm1.193 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.889-3.259-6.559 6.963z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Facebook Messenger</h3>
                    <p className="text-sm text-slate-500">Integração com mensagens do Facebook</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(clinic as any).facebook_enabled || false}
                    onChange={() => toggleChannelEnabled('facebook')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1877F2]"></div>
                </label>
              </div>
            </div>
            
            {(clinic as any).facebook_enabled && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(clinic as any).facebook_client_can_configure || false}
                      onChange={(e) => updateCloudApiField('facebook_client_can_configure', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">Cliente pode configurar</span>
                  </label>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 uppercase">Page ID</label>
                    <input
                      type="text"
                      value={(clinic as any).facebook_page_id || ''}
                      onChange={(e) => updateCloudApiField('facebook_page_id', e.target.value)}
                      placeholder="ID da página do Facebook"
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 uppercase">Access Token</label>
                    <input
                      type="password"
                      value={(clinic as any).facebook_access_token || ''}
                      onChange={(e) => updateCloudApiField('facebook_access_token', e.target.value)}
                      placeholder="Token de acesso do Facebook"
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Facebook Conversions API */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600">campaign</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Facebook Conversions API</h3>
                  <p className="text-sm text-slate-500">Enviar eventos de conversão para o Facebook Ads</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 uppercase">Dataset ID (Pixel ID)</label>
                  <input
                    type="text"
                    value={clinic.facebook_dataset_id || ''}
                    onChange={async (e) => {
                      const newValue = e.target.value;
                      setClinic(prev => prev ? { ...prev, facebook_dataset_id: newValue } : prev);
                      await (supabase as any).from('clinics').update({ facebook_dataset_id: newValue || null }).eq('id', clinic.id);
                    }}
                    placeholder="Ex: 1610564503295321"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 uppercase">Token da API</label>
                  <input
                    type="password"
                    value={clinic.facebook_api_token || ''}
                    onChange={async (e) => {
                      const newValue = e.target.value;
                      setClinic(prev => prev ? { ...prev, facebook_api_token: newValue } : prev);
                      await (supabase as any).from('clinics').update({ facebook_api_token: newValue || null }).eq('id', clinic.id);
                    }}
                    placeholder="Token de acesso do Facebook"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-slate-600 uppercase">Fonte da Ação</label>
                  <button
                    type="button"
                    onClick={() => setShowMetaHelpModal(true)}
                    className="text-slate-400 hover:text-blue-500 transition-colors"
                    title="Ajuda"
                  >
                    <span className="material-symbols-outlined text-sm">help</span>
                  </button>
                </div>
                <select
                  value={clinic.meta_action_source || 'website'}
                  onChange={async (e) => {
                    const newValue = e.target.value;
                    setClinic(prev => prev ? { ...prev, meta_action_source: newValue } : prev);
                    await (supabase as any).from('clinics').update({ meta_action_source: newValue }).eq('id', clinic.id);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="website">Website (CRM/Sistema)</option>
                  <option value="chat">Chat (WhatsApp)</option>
                  <option value="phone_call">Phone Call (Ligação)</option>
                  <option value="physical_store">Physical Store (Presencial)</option>
                </select>
              </div>

              {/* Eventos por Etapa do Funil */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs font-medium text-slate-600 uppercase">Eventos por Etapa do Funil</label>
                  <span className="text-xs text-slate-400">(deixe vazio para não enviar)</span>
                </div>
                <div className="space-y-2">
                  {[
                    { stage: 'Novo Lead', color: '#0891b2', hint: 'Quando um novo lead entra no sistema' },
                    { stage: 'Agendado', color: '#8b5cf6', hint: 'Quando o lead agenda consulta/procedimento' },
                    { stage: 'Em Atendimento', color: '#f59e0b', hint: 'Quando inicia negociação ativa' },
                    { stage: 'Convertido', color: '#10b981', hint: 'Quando fecha negócio (envia valor)' },
                    { stage: 'Perdido', color: '#ef4444', hint: 'Quando o lead desiste' },
                  ].map(({ stage, color, hint }) => (
                    <div key={stage} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{stage}</p>
                        <p className="text-xs text-slate-400 truncate">{hint}</p>
                      </div>
                      <select
                        value={(clinic.meta_funnel_events as Record<string, string>)?.[stage] || ''}
                        onChange={async (e) => {
                          const newValue = e.target.value;
                          const currentEvents = (clinic.meta_funnel_events as Record<string, string>) || {};
                          const updatedEvents = { ...currentEvents };
                          if (newValue) {
                            updatedEvents[stage] = newValue;
                          } else {
                            delete updatedEvents[stage];
                          }
                          setClinic(prev => prev ? { ...prev, meta_funnel_events: updatedEvents } : prev);
                          await (supabase as any).from('clinics').update({ meta_funnel_events: updatedEvents }).eq('id', clinic.id);
                        }}
                        className="w-40 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">Não enviar</option>
                        <option value="Lead">Lead</option>
                        <option value="Contact">Contact</option>
                        <option value="Schedule">Schedule</option>
                        <option value="Purchase">Purchase</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Como funciona:</span> Configure qual evento Meta será enviado em cada etapa do funil. 
                  Por exemplo: envie <code className="bg-blue-100 px-1 rounded">Lead</code> quando entrar um novo lead e 
                  <code className="bg-blue-100 px-1 rounded">Purchase</code> quando converter (com o valor do pagamento).
                </p>
              </div>

              {/* Últimos eventos enviados */}
              <MetaConversionLogs clinicId={clinic.id} />
            </div>
          </div>

          {/* Email Marketing */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-600">mail</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Email Marketing (SMTP)</h3>
                    <p className="text-sm text-slate-500">Permite que o cliente configure envio de emails via SMTP</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clinic.email_marketing_enabled || false}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      const { error } = await (supabase as any)
                        .from('clinics')
                        .update({ email_marketing_enabled: enabled })
                        .eq('id', id);
                      
                      if (!error) {
                        setClinic({ ...clinic, email_marketing_enabled: enabled });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
            
            {clinic.email_marketing_enabled && (
              <div className="p-6 space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-purple-600 mt-0.5">info</span>
                    <div>
                      <p className="text-sm font-medium text-purple-800">Habilitado para o cliente</p>
                      <p className="text-sm text-purple-700 mt-1">
                        O cliente pode acessar a aba "Integrações" no menu. Você também pode configurar diretamente aqui.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Configuração SMTP editável */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-slate-700">Configuração SMTP</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Host SMTP *</label>
                      <input
                        type="text"
                        value={(clinic as any).smtp_host || ''}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_host: e.target.value } : prev)}
                        placeholder="Ex: smtp.hostinger.com"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Porta *</label>
                      <input
                        type="number"
                        value={(clinic as any).smtp_port || 465}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_port: parseInt(e.target.value) || 465 } : prev)}
                        placeholder="465"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Usuário/Email *</label>
                      <input
                        type="text"
                        value={(clinic as any).smtp_user || ''}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_user: e.target.value } : prev)}
                        placeholder="email@seudominio.com"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Senha *</label>
                      <input
                        type="password"
                        value={(clinic as any).smtp_password || ''}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_password: e.target.value } : prev)}
                        placeholder="Senha do email"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Email Remetente</label>
                      <input
                        type="email"
                        value={(clinic as any).smtp_from_email || ''}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_from_email: e.target.value } : prev)}
                        placeholder="noreply@seudominio.com"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 uppercase">Nome Remetente</label>
                      <input
                        type="text"
                        value={(clinic as any).smtp_from_name || ''}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_from_name: e.target.value } : prev)}
                        placeholder="Nome da Clínica"
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600 uppercase">Criptografia</label>
                      <select
                        value={(clinic as any).smtp_encryption || 'ssl'}
                        onChange={(e) => setClinic(prev => prev ? { ...prev, smtp_encryption: e.target.value } : prev)}
                        className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="ssl">SSL (Porta 465)</option>
                        <option value="tls">TLS (Porta 587)</option>
                        <option value="none">Nenhuma (Porta 25)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await (supabase as any).from('clinics').update({
                            smtp_host: (clinic as any).smtp_host || null,
                            smtp_port: (clinic as any).smtp_port || 465,
                            smtp_user: (clinic as any).smtp_user || null,
                            smtp_password: (clinic as any).smtp_password || null,
                            smtp_from_email: (clinic as any).smtp_from_email || null,
                            smtp_from_name: (clinic as any).smtp_from_name || null,
                            smtp_encryption: (clinic as any).smtp_encryption || 'ssl',
                          }).eq('id', clinic.id);
                          
                          if (error) throw error;
                          setShowSmtpSaveSuccess(true);
                          setTimeout(() => setShowSmtpSaveSuccess(false), 3000);
                        } catch (err) {
                          setSmtpTestResult({ success: false, message: 'Erro ao salvar: ' + (err as Error).message });
                          setShowSmtpTestModal(true);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Salvar Configurações
                    </button>
                    <button
                      onClick={() => {
                        setSmtpTestEmail('');
                        setSmtpTestResult(null);
                        setShowSmtpTestModal(true);
                      }}
                      disabled={!(clinic as any).smtp_host || !(clinic as any).smtp_user || !(clinic as any).smtp_password}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Testar Conexão
                    </button>
                  </div>
                  
                  {/* Toast de sucesso ao salvar */}
                  {showSmtpSaveSuccess && (
                    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
                      <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>Configurações SMTP salvas com sucesso!</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabela de referência */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Configurações Comuns</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-2 font-medium text-slate-600">Provedor</th>
                          <th className="text-left py-2 px-2 font-medium text-slate-600">Host</th>
                          <th className="text-left py-2 px-2 font-medium text-slate-600">Porta</th>
                          <th className="text-left py-2 px-2 font-medium text-slate-600">Criptografia</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600">
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-2 font-medium">Hostinger</td>
                          <td className="py-2 px-2">smtp.hostinger.com</td>
                          <td className="py-2 px-2">465</td>
                          <td className="py-2 px-2">SSL</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-2 font-medium">Gmail</td>
                          <td className="py-2 px-2">smtp.gmail.com</td>
                          <td className="py-2 px-2">587</td>
                          <td className="py-2 px-2">TLS</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-2 font-medium">Outlook</td>
                          <td className="py-2 px-2">smtp.office365.com</td>
                          <td className="py-2 px-2">587</td>
                          <td className="py-2 px-2">TLS</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 font-medium">SendGrid</td>
                          <td className="py-2 px-2">smtp.sendgrid.net</td>
                          <td className="py-2 px-2">587</td>
                          <td className="py-2 px-2">TLS</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[20px] sm:text-[24px]">emoji_events</span>
                Ranking de Atendentes
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Performance de vendas por atendente</p>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
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

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {billingStats.byAttendant.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  Nenhum dado de faturamento disponível
                </div>
              ) : (
                billingStats.byAttendant.map((att, index) => {
                  const responseData = metricsData.responseTimeByAttendant.get(att.id);
                  const avgResponseTime = responseData ? Math.round((responseData.total / responseData.count) / (1000 * 60)) : null;
                  const userInfo = users.find(u => u.id === att.id);
                  const userGoal = userInfo?.monthly_goal || 0;
                  const goalProgress = userGoal > 0 ? (att.monthlyRevenue / userGoal) * 100 : null;
                  return (
                    <div key={att.id} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-200 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-cyan-700 font-medium text-sm">
                            {att.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-800 truncate">{att.name}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Faturamento</p>
                          <p className="font-semibold text-emerald-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(att.monthlyRevenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Conversões</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            {att.conversions}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Meta</p>
                          {goalProgress !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-2 rounded-full ${
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
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tempo Resposta</p>
                          {avgResponseTime !== null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              avgResponseTime <= 5 ? 'bg-emerald-100 text-emerald-700' :
                              avgResponseTime <= 15 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {avgResponseTime > 60 
                                ? `${Math.floor(avgResponseTime / 60)}h ${avgResponseTime % 60}min`
                                : `${avgResponseTime} min`}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Modal Editar Clínica */}
      {showEditClinicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEditClinicModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Editar Clínica</h3>
              <p className="text-xs text-slate-500 mt-0.5">Alterar informações da clínica</p>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome da Clínica</label>
                <input 
                  type="text"
                  value={editClinicForm.name}
                  onChange={(e) => setEditClinicForm({ ...editClinicForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                  <input 
                    type="email"
                    value={editClinicForm.email}
                    onChange={(e) => setEditClinicForm({ ...editClinicForm, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                  <input 
                    type="text"
                    value={editClinicForm.phone}
                    onChange={(e) => setEditClinicForm({ ...editClinicForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plano</label>
                  <select
                    value={editClinicForm.plan}
                    onChange={(e) => setEditClinicForm({ ...editClinicForm, plan: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Limite de Usuários</label>
                  <input 
                    type="number"
                    min="1"
                    value={editClinicForm.max_users}
                    onChange={(e) => setEditClinicForm({ ...editClinicForm, max_users: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ativos: {users.filter(u => u.status === 'Ativo').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={handleSaveClinic}
                disabled={savingClinic}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingClinic ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
              <button 
                onClick={() => setShowEditClinicModal(false)}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
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

      {/* Tab: Lançamentos */}
      {activeTab === 'receipts' && (
        <div className="space-y-4 sm:space-y-6">
          {loadingReceipts ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            </div>
          ) : (
            <>
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-4 sm:p-5 rounded-2xl shadow-lg text-white">
                  <p className="text-amber-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Valor Comercial</p>
                  <p className="text-xl sm:text-2xl font-black mt-1">
                    R$ {receiptsData.totalComercial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-amber-100 text-[10px] sm:text-xs mt-2 hidden sm:block">Total fechado pelos comerciais</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 sm:p-5 rounded-2xl shadow-lg text-white">
                  <p className="text-emerald-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Receita Clinica</p>
                  <p className="text-xl sm:text-2xl font-black mt-1">
                    R$ {receiptsData.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-emerald-100 text-[10px] sm:text-xs mt-2 hidden sm:block">Total recebido pela clinica</p>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-4 sm:p-5 rounded-2xl shadow-lg text-white">
                  <p className="text-violet-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider">ROI</p>
                  <p className="text-xl sm:text-2xl font-black mt-1">{receiptsData.roi}%</p>
                  <p className="text-violet-100 text-[10px] sm:text-xs mt-2 hidden sm:block">Retorno sobre vendas</p>
                </div>
              </div>

              {/* Por Comercial */}
              {receiptsData.byAttendant.length > 0 && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Por Comercial</h3>
                  
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Vendas</th>
                          <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Valor Comercial</th>
                          <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Recebido</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">ROI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptsData.byAttendant.map(att => (
                          <tr key={att.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-800">{att.name}</td>
                            <td className="py-3 px-4 text-center text-slate-600">{att.salesCount}</td>
                            <td className="py-3 px-4 text-right font-bold text-amber-600">
                              R$ {att.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">
                              R$ {att.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${Number(att.roi) >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                {att.roi}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-100 -mx-4">
                    {receiptsData.byAttendant.map(att => (
                      <div key={att.id} className="p-4">
                        <p className="font-medium text-slate-800 mb-2">{att.name}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Vendas</p>
                            <p className="font-medium">{att.salesCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">ROI</p>
                            <span className={`font-bold ${Number(att.roi) >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {att.roi}%
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Comercial</p>
                            <p className="font-bold text-amber-600">
                              R$ {att.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Recebido</p>
                            <p className="font-bold text-emerald-600">
                              R$ {att.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalhamento */}
              {receiptsData.details.length > 0 && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Detalhamento</h3>
                  
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Origem</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                          <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                          <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Recebido</th>
                          <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptsData.details.map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-800">{sale.clientName}</td>
                            <td className="py-3 px-4 text-center text-sm text-slate-600">
                              {new Date(sale.paymentDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                              >
                                {sale.sourceName}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-slate-600">{sale.attendantName}</td>
                            <td className="py-3 px-4 text-right font-bold text-amber-600">
                              R$ {sale.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-bold ${sale.receivedValue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {sale.receivedValue > 0 
                                  ? `R$ ${sale.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {sale.status === 'received' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  Recebido
                                </span>
                              )}
                              {sale.status === 'partial' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                                  Parcial
                                </span>
                              )}
                              {sale.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                                  Pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-100 -mx-4">
                    {receiptsData.details.map(sale => (
                      <div key={sale.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{sale.clientName}</p>
                            <p className="text-xs text-slate-500">{sale.attendantName} • {new Date(sale.paymentDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                          {sale.status === 'received' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 shrink-0">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              Recebido
                            </span>
                          )}
                          {sale.status === 'partial' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 shrink-0">
                              <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
                              Parcial
                            </span>
                          )}
                          {sale.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              Pendente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                          >
                            {sale.sourceName}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Valor</p>
                            <p className="font-bold text-amber-600">
                              R$ {sale.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Recebido</p>
                            <p className={`font-bold ${sale.receivedValue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {sale.receivedValue > 0 
                                ? `R$ ${sale.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receiptsData.details.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center text-slate-500">
                  Nenhum lancamento encontrado para esta clinica
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Assinatura */}
      {activeTab === 'subscription' && (
        <SubscriptionTab clinicId={id!} clinicName={clinic.name} />
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

      {/* Modal de Ajuda Meta Conversions API */}
      {/* Modal de Teste SMTP */}
      {showSmtpTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !smtpTestLoading && setShowSmtpTestModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">mail</span>
                Testar Conexão SMTP
              </h3>
              <p className="text-sm text-slate-500 mt-1">Envie um email de teste para verificar a configuração</p>
            </div>
            
            <div className="p-6">
              {!smtpTestResult ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email para receber o teste</label>
                    <input
                      type="email"
                      value={smtpTestEmail}
                      onChange={(e) => setSmtpTestEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={smtpTestLoading}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSmtpTestModal(false)}
                      disabled={smtpTestLoading}
                      className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!smtpTestEmail) return;
                        setSmtpTestLoading(true);
                        try {
                          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                            },
                            body: JSON.stringify({ clinicId: clinic.id, testEmail: smtpTestEmail }),
                          });
                          const result = await response.json();
                          if (result.success) {
                            setSmtpTestResult({ success: true, message: 'Email de teste enviado com sucesso! Verifique sua caixa de entrada.' });
                          } else {
                            setSmtpTestResult({ success: false, message: result.error || 'Erro ao enviar email de teste' });
                          }
                        } catch (err) {
                          setSmtpTestResult({ success: false, message: 'Erro ao testar conexão: ' + (err as Error).message });
                        }
                        setSmtpTestLoading(false);
                      }}
                      disabled={!smtpTestEmail || smtpTestLoading}
                      className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {smtpTestLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">send</span>
                          Enviar Teste
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    smtpTestResult.success ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl ${
                      smtpTestResult.success ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {smtpTestResult.success ? 'check_circle' : 'error'}
                    </span>
                  </div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    smtpTestResult.success ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    {smtpTestResult.success ? 'Sucesso!' : 'Erro'}
                  </h4>
                  <p className="text-slate-600 text-sm mb-6">{smtpTestResult.message}</p>
                  <button
                    onClick={() => {
                      setSmtpTestResult(null);
                      setShowSmtpTestModal(false);
                    }}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      smtpTestResult.success 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMetaHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMetaHelpModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">help</span>
                Configuração de Eventos Meta
              </h3>
              <p className="text-sm text-slate-500 mt-1">Entenda cada opção para configurar corretamente</p>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Tipo de Evento */}
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-violet-500">sell</span>
                  Tipo de Evento
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <p className="font-bold text-green-800">Purchase (Compra/Fechamento)</p>
                    <p className="text-sm text-green-700 mt-1">
                      <strong>Recomendado para clínicas.</strong> Enviado quando o lead fecha/paga um procedimento. 
                      O Meta usa esse evento para otimizar campanhas de conversão e calcular ROAS.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Lead (Novo Cadastro)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Enviado quando um novo lead entra no sistema. Útil para campanhas de geração de leads, 
                      mas não rastreia o valor monetário da conversão.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Schedule (Agendamento)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Enviado quando o lead agenda uma consulta ou procedimento. Ideal para clínicas que 
                      querem rastrear agendamentos como conversão principal.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Contact (Primeiro Contato)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Enviado no primeiro contato do lead. Útil para campanhas focadas em iniciar conversas, 
                      mas não rastreia conversões monetárias.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fonte da Ação */}
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-cyan-500">source</span>
                  Fonte da Ação
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="font-bold text-blue-800">Website (CRM/Sistema)</p>
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>Recomendado.</strong> Indica que a conversão foi registrada via sistema web (CRM). 
                      É o padrão mais usado para integrações server-side.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Chat (WhatsApp)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Indica que a conversão veio de uma conversa de chat. Útil se quiser diferenciar 
                      conversões que vieram especificamente do WhatsApp.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Phone Call (Ligação)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Indica que a conversão foi fechada por telefone. Use se a maioria das vendas 
                      acontece via ligação telefônica.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold text-slate-800">Physical Store (Presencial)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Indica que a conversão aconteceu presencialmente na clínica. Use se o fechamento 
                      geralmente acontece na consulta presencial.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dica */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600">lightbulb</span>
                  <div>
                    <p className="font-bold text-amber-800">Dica</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Para a maioria das clínicas, recomendamos usar <strong>Purchase + Website</strong>. 
                      Isso permite que o Meta otimize suas campanhas para conversões de alto valor e 
                      calcule corretamente o retorno sobre investimento (ROAS).
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex-shrink-0">
              <button 
                onClick={() => setShowMetaHelpModal(false)}
                className="w-full h-11 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente da aba de Assinatura
interface SubscriptionTabProps {
  clinicId: string;
  clinicName: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  trial_days: number;
  max_users: number;
  max_whatsapp_instances: number;
  has_cloud_api: boolean;
  has_instagram: boolean;
  has_facebook: boolean;
  has_mass_messaging: boolean;
  has_reports: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  is_public: boolean;
}

interface Subscription {
  id: string;
  clinic_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  starts_at: string;
  trial_ends_at: string | null;
  expires_at: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  cancelled_at: string | null;
  cancel_reason: string | null;
  payment_method: string | null;
  plan?: Plan;
}

interface Invoice {
  id: string;
  subscription_id: string;
  amount: number;
  discount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'overdue' | 'refunded' | 'cancelled';
  due_date: string;
  paid_at: string | null;
  reference_month: string | null;
  description: string | null;
}

const SubscriptionTab: React.FC<SubscriptionTabProps> = ({ clinicId, clinicName }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchData();
  }, [clinicId]);

  const fetchData = async () => {
    try {
      // Buscar planos
      const { data: plansData } = await supabase
        .from('plans' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      setPlans((plansData || []) as Plan[]);

      // Buscar assinatura da clínica
      const { data: subData } = await supabase
        .from('subscriptions' as any)
        .select('*, plan:plans(*)')
        .eq('clinic_id', clinicId)
        .single();

      if (subData) {
        setSubscription(subData as Subscription);
        setSelectedPlanId(subData.plan_id);
        setSelectedBillingCycle(subData.billing_cycle || 'monthly');
      }

      // Buscar faturas
      const { data: invoicesData } = await supabase
        .from('subscription_invoices' as any)
        .select('*')
        .eq('clinic_id', clinicId)
        .order('due_date', { ascending: false })
        .limit(10);

      setInvoices((invoicesData || []) as Invoice[]);
    } catch (err) {
      console.error('Error fetching subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async (planId: string, billingCycle: 'monthly' | 'yearly') => {
    setSaving(true);
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error('Plano não encontrado');

      const now = new Date();
      const trialEndsAt = plan.trial_days > 0 
        ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('subscriptions' as any)
        .insert({
          clinic_id: clinicId,
          plan_id: planId,
          billing_cycle: billingCycle,
          starts_at: now.toISOString(),
          trial_ends_at: trialEndsAt,
          status: plan.trial_days > 0 ? 'trialing' : 'active',
        });

      if (error) throw error;

      setShowChangePlanModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      alert(err.message || 'Erro ao criar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const updateSubscription = async (planId: string, billingCycle: 'monthly' | 'yearly') => {
    if (!subscription) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscriptions' as any)
        .update({
          plan_id: planId,
          billing_cycle: billingCycle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;

      setShowChangePlanModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Error updating subscription:', err);
      alert(err.message || 'Erro ao atualizar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) return;
    if (!confirm('Tem certeza que deseja cancelar a assinatura?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscriptions' as any)
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      alert(err.message || 'Erro ao cancelar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const reactivateSubscription = async () => {
    if (!subscription) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscriptions' as any)
        .update({
          status: 'active',
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      alert(err.message || 'Erro ao reativar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const markInvoiceAsPaid = async (invoiceId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subscription_invoices' as any)
        .update({
          status: 'confirmed',
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      console.error('Error marking invoice as paid:', err);
      alert(err.message || 'Erro ao marcar fatura como paga');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      trialing: 'bg-blue-100 text-blue-700',
      active: 'bg-green-100 text-green-700',
      past_due: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-600',
      expired: 'bg-orange-100 text-orange-700',
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      refunded: 'bg-purple-100 text-purple-700',
    };

    const labels: Record<string, string> = {
      trialing: 'Em Trial',
      active: 'Ativo',
      past_due: 'Inadimplente',
      cancelled: 'Cancelado',
      expired: 'Expirado',
      pending: 'Pendente',
      confirmed: 'Pago',
      overdue: 'Vencido',
      refunded: 'Reembolsado',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getDaysRemaining = () => {
    if (!subscription?.trial_ends_at) return null;
    const trialEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diff = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plano Atual */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Plano Atual</h2>
          <button
            onClick={() => setShowChangePlanModal(true)}
            className="px-4 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors"
          >
            {subscription ? 'Alterar Plano' : 'Atribuir Plano'}
          </button>
        </div>

        {subscription ? (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-slate-800">
                    {subscription.plan?.name || 'Plano'}
                  </h3>
                  {getStatusBadge(subscription.status)}
                </div>
                <p className="text-slate-500">{subscription.plan?.description}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-800">
                  {formatCurrency(
                    subscription.billing_cycle === 'yearly'
                      ? (subscription.plan?.price_yearly || 0)
                      : (subscription.plan?.price_monthly || 0)
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  /{subscription.billing_cycle === 'yearly' ? 'ano' : 'mês'}
                </p>
              </div>
            </div>

            {/* Trial Info */}
            {subscription.status === 'trialing' && subscription.trial_ends_at && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600">hourglass_top</span>
                  <div>
                    <p className="font-medium text-blue-800">Período de Teste</p>
                    <p className="text-sm text-blue-600">
                      {getDaysRemaining()} dias restantes (expira em {formatDate(subscription.trial_ends_at)})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Limites */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Usuários</p>
                <p className="text-lg font-bold text-slate-800">
                  {subscription.plan?.max_users === 999 ? '∞' : subscription.plan?.max_users}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Instâncias</p>
                <p className="text-lg font-bold text-slate-800">
                  {subscription.plan?.max_whatsapp_instances}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Cloud API</p>
                <p className="text-lg font-bold text-slate-800">
                  {subscription.plan?.has_cloud_api ? '✓' : '✗'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Relatórios</p>
                <p className="text-lg font-bold text-slate-800">
                  {subscription.plan?.has_reports ? '✓' : '✗'}
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-3">
              {subscription.status === 'cancelled' ? (
                <button
                  onClick={reactivateSubscription}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Reativar Assinatura
                </button>
              ) : (
                <button
                  onClick={cancelSubscription}
                  disabled={saving}
                  className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  Cancelar Assinatura
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">credit_card_off</span>
            <p className="text-slate-500 mb-4">Esta clínica não possui assinatura ativa</p>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Atribuir Plano
            </button>
          </div>
        )}
      </div>

      {/* Histórico de Faturas */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Histórico de Faturas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Referência</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vencimento</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {invoice.reference_month 
                        ? new Date(invoice.reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                        : invoice.description || '-'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {invoice.status === 'pending' && (
                        <button
                          onClick={() => markInvoiceAsPaid(invoice.id)}
                          disabled={saving}
                          className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          Marcar Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Alterar Plano */}
      {showChangePlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {subscription ? 'Alterar Plano' : 'Atribuir Plano'}
              </h2>
              <button
                onClick={() => setShowChangePlanModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* Ciclo de Cobrança */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Ciclo de Cobrança</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billing_cycle"
                      value="monthly"
                      checked={selectedBillingCycle === 'monthly'}
                      onChange={() => setSelectedBillingCycle('monthly')}
                      className="w-4 h-4 text-cyan-600"
                    />
                    <span className="text-sm text-slate-700">Mensal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billing_cycle"
                      value="yearly"
                      checked={selectedBillingCycle === 'yearly'}
                      onChange={() => setSelectedBillingCycle('yearly')}
                      className="w-4 h-4 text-cyan-600"
                    />
                    <span className="text-sm text-slate-700">Anual (desconto)</span>
                  </label>
                </div>
              </div>

              {/* Lista de Planos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-800">{plan.name}</h3>
                      {!plan.is_public && (
                        <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">Especial</span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-slate-800 mb-1">
                      {formatCurrency(selectedBillingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly)}
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      /{selectedBillingCycle === 'yearly' ? 'ano' : 'mês'}
                    </p>
                    {plan.trial_days > 0 && (
                      <p className="text-xs text-green-600 font-medium mb-2">
                        {plan.trial_days} dias grátis
                      </p>
                    )}
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>{plan.max_users === 999 ? 'Usuários ilimitados' : `${plan.max_users} usuários`}</p>
                      <p>{plan.max_whatsapp_instances} instância(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowChangePlanModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (subscription) {
                    updateSubscription(selectedPlanId, selectedBillingCycle);
                  } else {
                    createSubscription(selectedPlanId, selectedBillingCycle);
                  }
                }}
                disabled={saving || !selectedPlanId}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : subscription ? 'Alterar Plano' : 'Atribuir Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClinicDetail;
