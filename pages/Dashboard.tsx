
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import { getDataAccess } from '../lib/permissions';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import DashboardLeadsTab from '../components/DashboardLeadsTab';
import DashboardChartsTab from '../components/DashboardChartsTab';
import CommercialRevenueModal from '../components/CommercialRevenueModal';
import { parseLocalDate } from '../lib/dates';

interface DashboardProps {
  state: GlobalState;
}

interface LeadSourceStats {
  id: string;
  name: string;
  code: string | null;
  color: string;
  total_leads: number;
  converted_leads: number;
  revenue: number;
  clinic_revenue: number;
  tag_name: string | null;
  tag_color: string | null;
}

interface MetaAdsAccount {
  id: string;
  account_id: string;
  account_name: string;
  has_token: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading } = useChats(clinicId, user?.id);
  const { todayTasks, upcomingTasks, overdueTasks, weekTasks, toggleTask } = useTasks(clinicId, user?.id);
  
  const dataAccess = getDataAccess(user?.role);
  const canSeeBilling = dataAccess !== 'no_billing';
  
  // Estados para métricas avançadas
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyRevenueConfirmed, setMonthlyRevenueConfirmed] = useState(0);
  const [monthlyRevenuePending, setMonthlyRevenuePending] = useState(0);
  const [leadSourceStats, setLeadSourceStats] = useState<LeadSourceStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Filtro de período para Leads por Origem
  const [sourcesPeriodFilter, setSourcesPeriodFilter] = useState<'today' | 'yesterday' | 'all' | '7d' | '30d' | 'month'>('7d');
  
  // Paginação para Leads por Origem
  const [sourcesPage, setSourcesPage] = useState(1);
  const sourcesPerPage = 10;
  
  // Estado para aba ativa do Dashboard (string para suportar abas dinâmicas como 'meta_123456')
  // Ler parâmetro 'tab' da URL para abrir na aba correta
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabFromUrl || 'overview');
  
  // Contas Meta Ads disponíveis
  const [metaAdsAccounts, setMetaAdsAccounts] = useState<MetaAdsAccount[]>([]);
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState<string | null>(null);
  
  // Estados para dados de campanhas (aba Campanhas)
  const [campaignStats, setCampaignStats] = useState<{
    leadsByDay: Array<{ date: string; leads: number; campanhas: number }>;
    metaAds: Array<{ chat_id: string; ad_title: string; count: number; ad_source_type: string | null; client_name?: string; phone_number?: string; source_code?: string; ad_name?: string; campaign_name?: string; adset_name?: string; created_at?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string }>;
    leadsByPlatform: Array<{ name: string; value: number; color: string }>;
    sourceStats: Array<{ id: string; name: string; code: string | null; color: string; total_leads: number; converted_leads: number; revenue: number }>;
  } | null>(null);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignPeriod, setCampaignPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  
  // Estados para dados da Meta Ads API
  const [metaAdsApiData, setMetaAdsApiData] = useState<{
    campaigns: Array<{ id: string; name: string; status: string; objective: string }>;
    adsets: Array<{ id: string; name: string; status: string; effective_status?: string; campaign_id: string; daily_budget?: string; lifetime_budget?: string; budget_remaining?: string; optimization_goal?: string; destination_type?: string; targeting?: any }>;
    ads: Array<{ id: string; name: string; status: string; campaign_id: string; adset_id: string }>;
    insights: Array<{ campaign_name: string; adset_name?: string; ad_name: string; impressions: string; clicks: string; spend: string }>;
    campaignInsights: Array<{ campaign_id: string; campaign_name: string; impressions: string; clicks: string; spend: string; reach: string; ctr: string; cpc: string }>;
    adsetInsights: Array<{ campaign_id: string; adset_id: string; adset_name: string; impressions: string; clicks: string; spend: string; reach: string; ctr: string; cpc: string }>;
  } | null>(null);
  const [loadingMetaAdsApi, setLoadingMetaAdsApi] = useState(false);
  const [metaAdsConfigured, setMetaAdsConfigured] = useState(false);
  const [expandedCampaignSections, setExpandedCampaignSections] = useState<{ active: boolean; paused: boolean; other: boolean; performance: boolean }>({ active: true, paused: false, other: false, performance: true });
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [metaAdsVisibility, setMetaAdsVisibility] = useState<{
    impressions: boolean;
    clicks: boolean;
    ctr: boolean;
    cpc: boolean;
    spent: boolean;
    campaign_performance: boolean;
    active_campaigns: boolean;
    paused_campaigns: boolean;
  }>({
    impressions: true, clicks: true, ctr: true, cpc: true,
    spent: true, campaign_performance: true, active_campaigns: true, paused_campaigns: true
  });
  
  // Estados para aba Tarefas
  const [tasks, setTasks] = useState<Array<{ id: string; chat_id: string; title: string; description: string | null; due_date: string | null; completed: boolean; completed_at: string | null; created_by: string | null; created_at: string; client_name?: string }>>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksFilter, setTasksFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<{ id: string; title: string; description: string; due_date: string } | null>(null);
  
  // Estados para aba Produtividade
  const [productivityData, setProductivityData] = useState<Array<{ user_id: string; user_name: string; role: string; avg_response_time: number; first_response_time: number; messages_sent: number; chats_active: number; leads_count: number; conversions: number }>>([]);
  const [loadingProductivity, setLoadingProductivity] = useState(false);
  const [productivityPeriod, setProductivityPeriod] = useState<1 | 7 | 15 | 30>(30);
  
  // Estados para modal de conversa (somente leitura) - Top Anúncios Meta
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    content: string | null;
    is_from_client: boolean;
    created_at: string;
    media_url: string | null;
    type: string | null;
  }>>([]);
  const [chatLeadName, setChatLeadName] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Estados para Top Anúncios Meta (Click to WhatsApp)
  const [topMetaAds, setTopMetaAds] = useState<Array<{ ad_title: string; ad_source_id: string; source_code: string; client_name: string }>>([]);
  
  // Estado para modal de detalhes do lead Meta Ads
  const [selectedMetaAdLead, setSelectedMetaAdLead] = useState<{
    chat_id: string;
    client_name: string;
    phone_number: string;
    source_code: string;
    ad_title: string;
    ad_name: string;
    campaign_name: string;
    adset_name: string;
    created_at: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  } | null>(null);
  
  // Filtro de origens selecionadas (null = todas)
  const [selectedSources, setSelectedSources] = useState<string[] | null>(null);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState(false);
  
  // Estado para card expandido na versão mobile de Leads por Origem
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  
  // Estados para meta do atendente
  const [userGoalData, setUserGoalData] = useState<{
    monthlyGoal: number;
    canSeeGoal: boolean;
    myMonthlyRevenue: number;
  } | null>(null);
  
  // Estados para receita clínica (lançamentos) do comercial
  const [clinicReceiptsData, setClinicReceiptsData] = useState<{
    totalComercial: number;
    totalRecebido: number;
    roi: string;
  } | null>(null);
  
  // Estado para receita direta da clínica (lançamentos sem comercial)
  const [directClinicRevenue, setDirectClinicRevenue] = useState<{
    total: number;
    monthly: number;
    count: number;
  } | null>(null);
  
  // Estado para receita total da clínica (todos os clinic_receipts)
  const [totalClinicRevenue, setTotalClinicRevenue] = useState<{
    total: number;
    monthly: number;
    monthlyConfirmed: number;
    monthlyPending: number;
  } | null>(null);
  
  // Estado para colapsar/expandir seções do Dashboard
  const [showComercialCards, setShowComercialCards] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showLeadSources, setShowLeadSources] = useState(false);
  
  // Estado para modal de detalhamento da receita comercial
  const [showCommercialRevenueDetail, setShowCommercialRevenueDetail] = useState(false);

  // Estado para modal de detalhamento da receita clínica
  const [showClinicRevenueDetail, setShowClinicRevenueDetail] = useState(false);
  const [clinicRevenueDetails, setClinicRevenueDetails] = useState<Array<{
    id: string;
    total_value: number;
    receipt_date: string;
    description: string;
    client_name: string;
    origem: string;
    origem_color: string;
    confirmed_at: string | null;
  }>>([]);
  
  // Estado para lista detalhada de vendas do comercial
  const [mySalesDetails, setMySalesDetails] = useState<Array<{
    id: string;
    clientName: string;
    paymentDate: string;
    sourceName: string;
    sourceColor: string;
    commercialValue: number;
    receivedValue: number;
    status: 'pending' | 'received' | 'partial';
  }>>([]);

  // Estado para follow-ups agendados
  const [scheduledFollowups, setScheduledFollowups] = useState<Array<{
    id: string;
    chat_id: string;
    message: string;
    scheduled_for: string;
    client_name: string;
  }>>([]);

  // Excluir grupos das métricas (is_group = false ou undefined)
  const chatsWithoutGroups = chats.filter(c => !c.is_group);
  const novosLeads = chatsWithoutGroups.filter(c => c.status === 'Novo Lead').length;
  const emAtendimento = chatsWithoutGroups.filter(c => c.status === 'Em Atendimento').length;
  const totalChats = chatsWithoutGroups.length;
  
  // Estado para dados do dia anterior (comparação)
  const [yesterdayStats, setYesterdayStats] = useState<{
    novosLeads: number;
    emAtendimento: number;
    vendas: number;
    totalChats: number;
  } | null>(null);
  
  // Estado para detalhes de leads (card expandível)
  const [leadsDetails, setLeadsDetails] = useState<{
    leadsHoje: number;
    leadsHojeOntem: number;
    leadsCampanhaHoje: number;
    leadsCampanhaOntem: number;
    leadsMetaAdsHoje: number;
    leadsMetaAdsOntem: number;
    leadsLinksHoje: number;
    leadsLinksOntem: number;
    leadsOrganicoHoje: number;
    leadsOrganicoOntem: number;
    topOrigens: Array<{ nome: string; codigo: string; quantidade: number; tipo: 'meta' | 'link' | 'source' }>;
    codigosRecentes: string[];
  } | null>(null);
  
  // Estado para detalhes de Em Atendimento
  const [atendimentoDetails, setAtendimentoDetails] = useState<{
    atendentesAtivos: number;
    iniciadosHoje: number;
    iniciadosOntem: number;
    mediaDias: number;
  } | null>(null);
  
  // Estado para detalhes de Vendas
  const [vendasDetails, setVendasDetails] = useState<{
    valorTotal: number;
    ticketMedio: number;
    vendasHoje: number;
    vendasOntem: number;
    valorHoje: number;
    valorOntem: number;
  } | null>(null);
  
  // Estado para detalhes de Total Conversas
  const [conversasDetails, setConversasDetails] = useState<{
    novosLeads: number;
    emAtendimento: number;
    convertidos: number;
    perdidos: number;
    outros: number;
    taxaConversao: number;
  } | null>(null);
  
  // Estado para controlar card expandido
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  // Estado para contar pagamentos ativos (vendas concluídas)
  const [activePaymentsCount, setActivePaymentsCount] = useState(0);
  
  // Estados para deletar origem (só admin)
  const [deleteSourceModal, setDeleteSourceModal] = useState<{ id: string; name: string; leadsCount: number } | null>(null);
  const [deletingSource, setDeletingSource] = useState(false);
  
  // Verificar se usuário pode deletar origens (Admin real ou SuperAdmin fazendo impersonate)
  const canDeleteSources = isAdmin;
  
  // Função para deletar origem
  const handleDeleteSource = async () => {
    if (!deleteSourceModal || !clinicId) return;
    
    setDeletingSource(true);
    try {
      // 1. Desvincular chats da origem
      await supabase
        .from('chats')
        .update({ source_id: null })
        .eq('source_id', deleteSourceModal.id);
      
      // 2. Deletar a origem
      const { error } = await supabase
        .from('lead_sources')
        .delete()
        .eq('id', deleteSourceModal.id);
      
      if (error) throw error;
      
      // 3. Atualizar lista local
      setLeadSourceStats(prev => prev.filter(s => s.id !== deleteSourceModal.id));
      setDeleteSourceModal(null);
    } catch (error) {
      console.error('Erro ao deletar origem:', error);
      alert('Erro ao deletar origem. Tente novamente.');
    } finally {
      setDeletingSource(false);
    }
  };
  
  // Buscar detalhamento da receita clínica do mês
  const fetchClinicRevenueDetails = async () => {
    if (!clinicId) return;
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('clinic_receipts' as any)
      .select('id, total_value, receipt_date, description, chat_id, confirmed_at')
      .eq('clinic_id', clinicId)
      .or('status.is.null,status.eq.active')
      .gte('receipt_date', firstDayOfMonth)
      .lte('receipt_date', lastDayOfMonth)
      .order('receipt_date', { ascending: false });
    
    if (data && data.length > 0) {
      const chatIds = [...new Set((data as any[]).map(r => r.chat_id).filter(Boolean))];
      
      // Buscar nomes dos clientes e origens
      const { data: chatsInfo } = await (supabase as any)
        .from('chats')
        .select('id, client_name, source_id')
        .in('id', chatIds);
      
      const sourceIds = [...new Set((chatsInfo || []).map((c: any) => c.source_id).filter(Boolean))];
      let sourcesMap: Record<string, { name: string; color: string }> = {};
      
      if (sourceIds.length > 0) {
        const { data: sources } = await supabase
          .from('lead_sources' as any)
          .select('id, name, color')
          .in('id', sourceIds);
        if (sources) {
          (sources as any[]).forEach(s => {
            sourcesMap[s.id] = { name: s.name, color: s.color || '#6B7280' };
          });
        }
      }
      
      const chatsMap: Record<string, { client_name: string; source_id: string | null }> = {};
      (chatsInfo || []).forEach((c: any) => {
        chatsMap[c.id] = { client_name: c.client_name, source_id: c.source_id };
      });
      
      const details = (data as any[]).map(r => {
        const chat = chatsMap[r.chat_id] || { client_name: 'Desconhecido', source_id: null };
        const source = chat.source_id ? sourcesMap[chat.source_id] : null;
        return {
          id: r.id,
          total_value: Number(r.total_value),
          receipt_date: r.receipt_date,
          description: r.description || '',
          client_name: chat.client_name,
          origem: source?.name || 'Sem origem',
          origem_color: source?.color || '#6B7280',
          confirmed_at: r.confirmed_at || null,
        };
      });
      
      setClinicRevenueDetails(details);
    }
    
    setShowClinicRevenueDetail(true);
  };

  // Filtrar leadSourceStats baseado nas origens selecionadas
  const filteredLeadSourceStats = useMemo(() => {
    if (selectedSources === null) return leadSourceStats;
    return leadSourceStats.filter(s => selectedSources.includes(s.id));
  }, [leadSourceStats, selectedSources]);

  // Calcular métricas baseado no view_mode do usuário
  // view_mode 'shared' = vê faturamento de todos
  // view_mode 'personal' = só vê faturamento dos atendimentos dele
  useEffect(() => {
    const fetchStats = async () => {
      if (!clinicId || loading) return;
      setLoadingStats(true);
      
      try {
        // ===== RODADA 1: Queries independentes em paralelo =====
        const userQuery = user?.id 
          ? supabase.from('users').select('view_mode, role, monthly_goal, can_see_goal').eq('id', user.id).single()
          : Promise.resolve({ data: null });
        
        const paymentsQuery = supabase
          .from('payments' as any)
          .select('id, value, payment_date, chat_id, created_by, status, received_at')
          .eq('clinic_id', clinicId)
          .or('status.is.null,status.eq.active');
        
        const sourcesQuery = supabase
          .from('lead_sources' as any)
          .select('id, name, code, color, tag_id, tag:tags(id, name, color)')
          .eq('clinic_id', clinicId);
        
        const directReceiptsQuery = supabase
          .from('clinic_receipts' as any)
          .select('id, chat_id, total_value, receipt_date')
          .eq('clinic_id', clinicId)
          .or('status.is.null,status.eq.active')
          .is('payment_id', null);
        
        const linkClicksQuery = (supabase as any)
          .from('link_clicks')
          .select('chat_id, clicked_at')
          .eq('clinic_id', clinicId)
          .not('chat_id', 'is', null);
        
        const allClinicReceiptsQuery = supabase
          .from('clinic_receipts' as any)
          .select('id, total_value, receipt_date, payment_id, confirmed_at')
          .eq('clinic_id', clinicId)
          .or('status.is.null,status.eq.active');
        
        const myPaymentsQuery = user?.id 
          ? supabase
              .from('payments' as any)
              .select('id, value, payment_date, chat_id, status, chat:chats(id, client_name, source_id)')
              .eq('clinic_id', clinicId)
              .eq('created_by', user.id)
              .or('status.is.null,status.eq.active')
              .order('payment_date', { ascending: false })
          : Promise.resolve({ data: null });
        
        const [
          { data: userData },
          { data: allPaymentsRaw },
          { data: sourcesData },
          { data: directReceiptsForSources },
          { data: linkClicksData },
          { data: allClinicReceiptsData },
          { data: myPaymentsRaw }
        ] = await Promise.all([
          userQuery,
          paymentsQuery,
          sourcesQuery,
          directReceiptsQuery,
          linkClicksQuery,
          allClinicReceiptsQuery,
          myPaymentsQuery
        ]);
        
        // Processar dados do usuário
        let userViewModeForStats = 'shared';
        let userMonthlyGoal = 0;
        let userCanSeeGoal = false;
        let userRole = '';
        
        if (userData) {
          userRole = (userData as any)?.role || '';
          if (userRole !== 'Admin' && userRole !== 'SuperAdmin') {
            userViewModeForStats = (userData as any).view_mode || 'personal';
          }
          userMonthlyGoal = (userData as any)?.monthly_goal || 0;
          userCanSeeGoal = (userData as any)?.can_see_goal || false;
        }
        
        // Determinar quais chats usar para faturamento
        let chatIdsForStats: string[] = [];
        if (userViewModeForStats === 'personal' && user?.id) {
          const chatsAtendidos = chats.filter(c => c.assigned_to === user.id);
          chatIdsForStats = chatsAtendidos.map(c => c.id);
        } else {
          chatIdsForStats = chats.map(c => c.id);
        }
        
        if (chatIdsForStats.length === 0) {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setMonthlyRevenueConfirmed(0);
          setMonthlyRevenuePending(0);
          setLeadSourceStats([]);
          if (userCanSeeGoal && userMonthlyGoal > 0) {
            setUserGoalData({ monthlyGoal: userMonthlyGoal, canSeeGoal: userCanSeeGoal, myMonthlyRevenue: 0 });
          } else {
            setUserGoalData(null);
          }
          setLoadingStats(false);
          return;
        }
        
        // Filtrar payments conforme perfil do usuário
        const isComercial = userRole === 'Comercial';
        const isPersonalComercial = isComercial && userViewModeForStats === 'personal';
        const chatIdsSet = new Set(chatIdsForStats);
        
        let paymentsData: any[] | null = null;
        if (isPersonalComercial && user?.id) {
          paymentsData = (allPaymentsRaw as any[] || []).filter((p: any) => p.created_by === user.id);
        } else {
          paymentsData = (allPaymentsRaw as any[] || []).filter((p: any) => chatIdsSet.has(p.chat_id));
        }
        
        if (paymentsData) {
          const total = paymentsData.reduce((sum, p) => sum + Number(p.value), 0);
          setTotalRevenue(total);
          setActivePaymentsCount(paymentsData.length);
          
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthlyPayments = paymentsData.filter(p => new Date(p.payment_date) >= firstDayOfMonth);
          const monthly = monthlyPayments.reduce((sum, p) => sum + Number(p.value), 0);
          setMonthlyRevenue(monthly);
          
          const confirmed = monthlyPayments.filter(p => p.received_at).reduce((sum, p) => sum + Number(p.value), 0);
          const pending = monthlyPayments.filter(p => !p.received_at).reduce((sum, p) => sum + Number(p.value), 0);
          setMonthlyRevenueConfirmed(confirmed);
          setMonthlyRevenuePending(pending);
          
          if (userCanSeeGoal && userMonthlyGoal > 0 && user?.id) {
            const myChats = chats.filter(c => c.assigned_to === user.id);
            const myChatIds = new Set(myChats.map(c => c.id));
            const myMonthlyRevenue = paymentsData
              .filter(p => myChatIds.has(p.chat_id) && new Date(p.payment_date) >= firstDayOfMonth)
              .reduce((sum, p) => sum + Number(p.value), 0);
            setUserGoalData({ monthlyGoal: userMonthlyGoal, canSeeGoal: userCanSeeGoal, myMonthlyRevenue });
          } else {
            setUserGoalData(null);
          }
        } else {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setMonthlyRevenueConfirmed(0);
          setMonthlyRevenuePending(0);
          setUserGoalData(null);
          setActivePaymentsCount(0);
        }
        
        // ===== RODADA 2: Query que depende de payments (receipts vinculados) =====
        const activePaymentIds = (paymentsData || []).map(p => p.id);
        let receiptsData: any[] | null = null;
        if (activePaymentIds.length > 0) {
          const { data } = await supabase
            .from('clinic_receipts' as any)
            .select('id, payment_id, total_value')
            .eq('clinic_id', clinicId)
            .or('status.is.null,status.eq.active')
            .in('payment_id', activePaymentIds);
          receiptsData = data;
        }
        
        // ===== Processar origens de leads =====
        if (chatIdsForStats.length > 0) {
          
          // Criar mapa de último clique por chat_id
          const lastClickByChat: Record<string, Date> = {};
          if (linkClicksData) {
            linkClicksData.forEach((click: any) => {
              const clickDate = new Date(click.clicked_at);
              if (!lastClickByChat[click.chat_id] || clickDate > lastClickByChat[click.chat_id]) {
                lastClickByChat[click.chat_id] = clickDate;
              }
            });
          }
          
          if (sourcesData && sourcesData.length > 0) {
            // Função para filtrar chats por período (considera criação OU último clique)
            const getFilteredChats = (allChats: any[], period: 'today' | 'yesterday' | 'all' | '7d' | '30d' | 'month') => {
              if (period === 'all') return allChats;
              
              const now = new Date();
              let startDate: Date;
              let endDate: Date | null = null;
              
              switch (period) {
                case 'today':
                  // Usar meia-noite do dia atual no fuso local
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case 'yesterday':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                  endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case '7d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
                  break;
                case '30d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
                  break;
                case 'month':
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                  break;
                default:
                  return allChats;
              }
              
              // Filtrar por criação OU último clique no período (remarketing)
              // Converter created_at para Date local para comparação correta
              return allChats.filter(c => {
                const createdAt = new Date(c.created_at);
                const lastClick = lastClickByChat[c.id];
                
                if (endDate) {
                  // Para períodos com fim (ex: ontem)
                  const createdInPeriod = createdAt >= startDate && createdAt < endDate;
                  const clickedInPeriod = lastClick && lastClick >= startDate && lastClick < endDate;
                  return createdInPeriod || clickedInPeriod;
                } else {
                  // Para períodos abertos (ex: hoje, 7d, 30d)
                  const createdInPeriod = createdAt >= startDate;
                  const clickedInPeriod = lastClick && lastClick >= startDate;
                  return createdInPeriod || clickedInPeriod;
                }
              });
            };
            
            // Função para filtrar payments por período
            const getFilteredPayments = (allPayments: any[], period: 'today' | 'yesterday' | 'all' | '7d' | '30d' | 'month') => {
              if (period === 'all') return allPayments;
              
              const now = new Date();
              let startDate: Date;
              let endDate: Date | null = null;
              
              switch (period) {
                case 'today':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case 'yesterday':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                  endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case '7d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
                  break;
                case '30d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
                  break;
                case 'month':
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                  break;
                default:
                  return allPayments;
              }
              
              if (endDate) {
                return allPayments.filter(p => {
                  const d = new Date(p.payment_date);
                  return d >= startDate && d < endDate;
                });
              }
              return allPayments.filter(p => new Date(p.payment_date) >= startDate);
            };
            
            const filteredChats = getFilteredChats(chats, sourcesPeriodFilter);
            const filteredPayments = getFilteredPayments(paymentsData as any[] || [], sourcesPeriodFilter);
            
            // Função para filtrar lançamentos diretos por período
            const getFilteredDirectReceipts = (allReceipts: any[], period: 'today' | 'yesterday' | 'all' | '7d' | '30d' | 'month') => {
              if (period === 'all') return allReceipts;
              
              const now = new Date();
              let startDate: Date;
              let endDate: Date | null = null;
              
              switch (period) {
                case 'today':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case 'yesterday':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                  endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  break;
                case '7d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
                  break;
                case '30d':
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
                  break;
                case 'month':
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                  break;
                default:
                  return allReceipts;
              }
              
              if (endDate) {
                return allReceipts.filter(r => {
                  const d = new Date(r.receipt_date);
                  return d >= startDate && d < endDate;
                });
              }
              return allReceipts.filter(r => new Date(r.receipt_date) >= startDate);
            };
            
            const filteredDirectReceipts = getFilteredDirectReceipts(directReceiptsForSources as any[] || [], sourcesPeriodFilter);
            
            // Todos os chats da clínica (sem filtro de período) para vincular receita à origem
            const allClinicChats = chats;
            
            // Calcular estatísticas por origem
            // Leads: filtrados pelo período (data de criação do chat)
            // Receita: filtrada pela data do lançamento/payment no período
            // Pré-indexar chats por source_id para evitar O(n²)
            const chatsBySource: Record<string, typeof chats> = {};
            const allChatIdsBySource: Record<string, Set<string>> = {};
            for (const c of filteredChats) {
              const sid = (c as any).source_id;
              if (sid) {
                (chatsBySource[sid] ||= []).push(c);
              }
            }
            for (const c of allClinicChats) {
              const sid = (c as any).source_id;
              if (sid) {
                (allChatIdsBySource[sid] ||= new Set()).add(c.id);
              }
            }
            
            // Pré-indexar receipts por payment_id
            const receiptsByPaymentId: Record<string, number> = {};
            for (const r of (receiptsData as any[] || [])) {
              receiptsByPaymentId[r.payment_id] = (receiptsByPaymentId[r.payment_id] || 0) + Number(r.total_value);
            }
            
            const stats: LeadSourceStats[] = (sourcesData as any[]).map(source => {
              const sourceChats = chatsBySource[source.id] || [];
              const convertedChats = sourceChats.filter(c => c.status === 'Convertido');
              
              const allSourceChatIdsSet = allChatIdsBySource[source.id] || new Set();
              
              // Valor comercial (payments filtrados por data do payment no período)
              const sourcePayments = filteredPayments.filter(p => allSourceChatIdsSet.has(p.chat_id));
              const revenue = sourcePayments.reduce((sum, p) => sum + Number(p.value), 0);
              
              // Receita clínica (clinic_receipts vinculados aos payments desta origem)
              const clinicRevenueFromPayments = sourcePayments.reduce((sum, p) => sum + (receiptsByPaymentId[p.id] || 0), 0);
              
              // Receita direta (lançamentos sem payment_id, filtrados por data do lançamento)
              const directRevenueFromSource = filteredDirectReceipts
                .filter(r => allSourceChatIdsSet.has(r.chat_id))
                .reduce((sum, r) => sum + Number(r.total_value), 0);
              
              const clinicRevenue = clinicRevenueFromPayments + directRevenueFromSource;
              
              return {
                id: source.id,
                name: source.name,
                code: source.code,
                color: source.tag?.color || source.color,
                total_leads: sourceChats.length,
                converted_leads: convertedChats.length,
                revenue,
                clinic_revenue: clinicRevenue,
                tag_name: source.tag?.name || null,
                tag_color: source.tag?.color || null,
              };
            });
            
            // Ordenar por total de leads e filtrar apenas os que têm leads
            stats.sort((a, b) => b.total_leads - a.total_leads);
            setLeadSourceStats(stats.filter(s => s.total_leads > 0));
          } else {
            setLeadSourceStats([]);
          }
        } else {
          setLeadSourceStats([]);
        }
        
        // Processar dados de receita clínica (lançamentos) para o comercial
        // Usa myPaymentsRaw do Promise.all (já buscado em paralelo)
        if (user?.id && userRole === 'Comercial') {
          const myPayments = myPaymentsRaw as any[];
          
          if (myPayments && myPayments.length > 0) {
            const myPaymentIds = myPayments.map(p => p.id);
            const totalComercial = myPayments.reduce((sum, p) => sum + Number(p.value), 0);
            
            // Buscar receitas vinculadas aos payments deste comercial
            const { data: myReceipts } = await supabase
              .from('clinic_receipts' as any)
              .select('total_value, payment_id')
              .or('status.is.null,status.eq.active')
              .in('payment_id', myPaymentIds);
            
            const totalRecebido = (myReceipts as any[] || []).reduce((sum, r) => sum + Number(r.total_value), 0);
            const roi = totalComercial > 0 ? ((totalRecebido / totalComercial) * 100).toFixed(1) : '0';
            
            setClinicReceiptsData({ totalComercial, totalRecebido, roi });
            
            // sourcesData já veio do Promise.all
            const salesDetails = myPayments.map(p => {
              const receiptsForPayment = (myReceipts as any[] || []).filter(r => r.payment_id === p.id);
              const receivedValue = receiptsForPayment.reduce((sum, r) => sum + Number(r.total_value), 0);
              const source = (sourcesData as any[] || []).find(s => s.id === p.chat?.source_id);
              
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
                commercialValue: Number(p.value),
                receivedValue,
                status
              };
            });
            
            setMySalesDetails(salesDetails);
          } else {
            setClinicReceiptsData(null);
            setMySalesDetails([]);
          }
        } else {
          setClinicReceiptsData(null);
          setMySalesDetails([]);
        }
        
        // Processar receita total da clínica (allClinicReceiptsData já veio do Promise.all)
        if (allClinicReceiptsData && (allClinicReceiptsData as any[]).length > 0) {
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          // Receita total da clínica (todos os clinic_receipts)
          const totalClinic = (allClinicReceiptsData as any[]).reduce((sum, r) => sum + Number(r.total_value), 0);
          const monthlyClinicReceipts = (allClinicReceiptsData as any[]).filter(r => new Date(r.receipt_date) >= firstDayOfMonth);
          const monthlyClinic = monthlyClinicReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
          
          // Separar confirmados vs pendentes da clínica
          const monthlyClinicConfirmed = monthlyClinicReceipts.filter(r => r.confirmed_at).reduce((sum, r) => sum + Number(r.total_value), 0);
          const monthlyClinicPending = monthlyClinicReceipts.filter(r => !r.confirmed_at).reduce((sum, r) => sum + Number(r.total_value), 0);
          
          setTotalClinicRevenue({
            total: totalClinic,
            monthly: monthlyClinic,
            monthlyConfirmed: monthlyClinicConfirmed,
            monthlyPending: monthlyClinicPending
          });
          
          // Receita direta (sem comercial - payment_id IS NULL)
          const directReceipts = (allClinicReceiptsData as any[]).filter(r => !r.payment_id);
          if (directReceipts.length > 0) {
            const directTotal = directReceipts.reduce((sum, r) => sum + Number(r.total_value), 0);
            const directMonthly = directReceipts
              .filter(r => new Date(r.receipt_date) >= firstDayOfMonth)
              .reduce((sum, r) => sum + Number(r.total_value), 0);
            
            setDirectClinicRevenue({
              total: directTotal,
              monthly: directMonthly,
              count: directReceipts.length
            });
          } else {
            setDirectClinicRevenue(null);
          }
        } else {
          setDirectClinicRevenue(null);
          setTotalClinicRevenue(null);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    
    const debounceTimer = setTimeout(() => {
      fetchStats();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [clinicId, chats, loading, sourcesPeriodFilter]);

  // Buscar follow-ups agendados
  useEffect(() => {
    const fetchFollowups = async () => {
      if (!clinicId) return;
      
      const { data } = await supabase
        .from('scheduled_messages' as any)
        .select(`
          id,
          chat_id,
          message,
          scheduled_for,
          chats (
            client_name
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(10);
      
      if (data) {
        const followups = (data as any[]).map(d => ({
          id: d.id,
          chat_id: d.chat_id,
          message: d.message,
          scheduled_for: d.scheduled_for,
          client_name: d.chats?.client_name || 'Cliente',
        }));
        setScheduledFollowups(followups);
      }
    };
    
    fetchFollowups();
  }, [clinicId]);

  // Buscar dados do dia anterior para comparação
  useEffect(() => {
    const fetchYesterdayStats = async () => {
      if (!clinicId) return;
      
      try {
        // Data de ontem (início e fim do dia)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
        const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
        
        // Buscar chats e payments até ontem em paralelo
        const [{ data: yesterdayChats }, { data: yesterdayPayments }] = await Promise.all([
          supabase
            .from('chats')
            .select('id, status, is_group, created_at')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
            .lte('created_at', yesterdayEnd),
          supabase
            .from('payments' as any)
            .select('id')
            .eq('clinic_id', clinicId)
            .or('status.is.null,status.eq.active')
            .lte('created_at', yesterdayEnd)
        ]);
        
        if (yesterdayChats) {
          setYesterdayStats({
            novosLeads: yesterdayChats.filter((c: any) => c.status === 'Novo Lead').length,
            emAtendimento: yesterdayChats.filter((c: any) => c.status === 'Em Atendimento').length,
            vendas: yesterdayPayments?.length || 0,
            totalChats: yesterdayChats.length,
          });
        }
      } catch (error) {
        console.error('Erro ao buscar dados de ontem:', error);
      }
    };
    
    fetchYesterdayStats();
  }, [clinicId]);

  // Buscar detalhes de leads (hoje, campanha, códigos recentes)
  useEffect(() => {
    const fetchLeadsDetails = async () => {
      if (!clinicId) return;
      
      try {
        // Usar fuso horário local para calcular início do dia
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayStart = today.toISOString();
        
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const yesterdayStart = yesterday.toISOString();
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const yesterdayEndStr = yesterdayEnd.toISOString();
        
        // Buscar todas as queries de leads em paralelo
        const [
          { data: leadsHoje },
          { data: leadsOntem },
          { data: trackableLinks },
          { data: linkConversionsHoje },
          { data: linkConversionsOntem },
          { data: recentSourcesData }
        ] = await Promise.all([
          (supabase as any)
            .from('chats')
            .select('id, source_id, ad_source_id, meta_campaign_name, meta_ad_name, lead_sources(id, code, name)')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
            .gte('created_at', todayStart),
          (supabase as any)
            .from('chats')
            .select('id, source_id, ad_source_id')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
            .gte('created_at', yesterdayStart)
            .lte('created_at', yesterdayEndStr),
          (supabase as any)
            .from('trackable_links')
            .select('id, code, name, source_id')
            .eq('clinic_id', clinicId),
          (supabase as any)
            .from('link_clicks')
            .select('id, chat_id')
            .eq('clinic_id', clinicId)
            .eq('converted_to_lead', true)
            .gte('converted_at', todayStart),
          (supabase as any)
            .from('link_clicks')
            .select('id, chat_id')
            .eq('clinic_id', clinicId)
            .eq('converted_to_lead', true)
            .gte('converted_at', yesterdayStart)
            .lte('converted_at', yesterdayEndStr),
          supabase
            .from('lead_sources')
            .select('code, name')
            .eq('clinic_id', clinicId)
            .not('code', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5)
        ]);
        
        const trackableLinkSourceIds = new Set(trackableLinks?.map((l: any) => l.source_id).filter(Boolean) || []);
        const trackableLinkCodes = new Set(trackableLinks?.map((l: any) => l.code?.toUpperCase()).filter(Boolean) || []);
        
        // Classificar leads de hoje
        const leadsHojeArr = leadsHoje || [];
        const leadsOntemArr = leadsOntem || [];
        const linkConversionsHojeArr = linkConversionsHoje || [];
        const linkConversionsOntemArr = linkConversionsOntem || [];
        
        // Meta Ads = tem ad_source_id
        const leadsMetaAdsHoje = leadsHojeArr.filter((l: any) => l.ad_source_id).length;
        const leadsMetaAdsOntem = leadsOntemArr.filter((l: any) => l.ad_source_id).length;
        
        // Links Rastreáveis = conversões de link_clicks hoje (inclui remarketing)
        const leadsLinksHoje = linkConversionsHojeArr.length;
        const leadsLinksOntem = linkConversionsOntemArr.length;
        
        // Orgânico = sem source_id e sem ad_source_id
        const leadsOrganicoHoje = leadsHojeArr.filter((l: any) => !l.source_id && !l.ad_source_id).length;
        const leadsOrganicoOntem = leadsOntemArr.filter((l: any) => !l.source_id && !l.ad_source_id).length;
        
        // De Campanhas = tem source_id (qualquer origem identificada)
        const leadsCampanhaHoje = leadsHojeArr.filter((l: any) => l.source_id || l.ad_source_id).length;
        const leadsCampanhaOntem = leadsOntemArr.filter((l: any) => l.source_id || l.ad_source_id).length;
        
        // Top Origens de hoje - separando Meta Ads de origens do sistema
        const origemCount: Record<string, { nome: string; codigo: string; quantidade: number; tipo: 'meta' | 'link' | 'source' }> = {};
        
        for (const lead of leadsHojeArr) {
          let key = '';
          let nome = '';
          let codigo = '';
          let tipo: 'meta' | 'link' | 'source' = 'source';
          
          if (lead.ad_source_id) {
            // Meta Ads - agrupar por nome do anúncio (meta_ad_name)
            const adName = lead.meta_ad_name || 'Anúncio Meta';
            const campaignName = lead.meta_campaign_name || '';
            key = `meta_${adName}`; // Agrupar por nome do anúncio
            nome = adName;
            codigo = campaignName;
            tipo = 'meta';
          } else if (lead.source_id && (lead.lead_sources as any)) {
            // Origem do sistema - usar dados corretos da origem
            const source = lead.lead_sources as any;
            key = `source_${source.id}`;
            nome = source.name || source.code || 'Origem';
            codigo = source.code || '';
            tipo = trackableLinkSourceIds.has(lead.source_id) || trackableLinkCodes.has(source.code?.toUpperCase()) ? 'link' : 'source';
          }
          
          if (key) {
            if (!origemCount[key]) {
              origemCount[key] = { nome, codigo, quantidade: 0, tipo };
            }
            origemCount[key].quantidade++;
          }
        }
        
        const topOrigens = Object.values(origemCount)
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 7);
        
        // Códigos recentes (já buscado no Promise.all)
        const codigos = recentSourcesData?.map((s: any) => s.code || s.name).filter(Boolean) || [];
        
        setLeadsDetails({
          leadsHoje: leadsHojeArr.length,
          leadsHojeOntem: leadsOntemArr.length,
          leadsCampanhaHoje,
          leadsCampanhaOntem,
          leadsMetaAdsHoje,
          leadsMetaAdsOntem,
          leadsLinksHoje,
          leadsLinksOntem,
          leadsOrganicoHoje,
          leadsOrganicoOntem,
          topOrigens,
          codigosRecentes: codigos,
        });
      } catch (error) {
        console.error('Erro ao buscar detalhes de leads:', error);
      }
    };
    
    fetchLeadsDetails();
  }, [clinicId]);

  // Buscar detalhes de Em Atendimento, Vendas e Total Conversas
  useEffect(() => {
    const fetchCardsDetails = async () => {
      if (!clinicId) return;
      
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayStart = yesterday.toISOString();
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        const yesterdayEndStr = yesterdayEnd.toISOString();
        
        // Buscar todas as 3 queries em paralelo
        const [{ data: atendimentoChats }, { data: vendasData }, { data: allChats }] = await Promise.all([
          supabase
            .from('chats')
            .select('id, assigned_to, updated_at')
            .eq('clinic_id', clinicId)
            .eq('status', 'Em Atendimento')
            .eq('is_group', false),
          supabase
            .from('payments' as any)
            .select('id, value, created_at')
            .eq('clinic_id', clinicId)
            .or('status.is.null,status.eq.active'),
          supabase
            .from('chats')
            .select('id, status')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
        ]);
        
        // EM ATENDIMENTO
        if (atendimentoChats) {
          const atendentesUnicos = new Set(atendimentoChats.map((c: any) => c.assigned_to).filter(Boolean));
          const iniciadosHoje = atendimentoChats.filter((c: any) => new Date(c.updated_at) >= today).length;
          const iniciadosOntem = atendimentoChats.filter((c: any) => {
            const d = new Date(c.updated_at);
            return d >= yesterday && d < today;
          }).length;
          
          const now = new Date();
          const totalDias = atendimentoChats.reduce((sum: number, c: any) => {
            const dias = (now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + dias;
          }, 0);
          const mediaDias = atendimentoChats.length > 0 ? totalDias / atendimentoChats.length : 0;
          
          setAtendimentoDetails({
            atendentesAtivos: atendentesUnicos.size,
            iniciadosHoje,
            iniciadosOntem,
            mediaDias: Math.round(mediaDias * 10) / 10,
          });
        }
        
        // VENDAS
        if (vendasData) {
          const vendas = vendasData as any[];
          const valorTotal = vendas.reduce((sum, v) => sum + parseFloat(v.value || 0), 0);
          const ticketMedio = vendas.length > 0 ? valorTotal / vendas.length : 0;
          
          const vendasHoje = vendas.filter(v => new Date(v.created_at) >= today);
          const vendasOntem = vendas.filter(v => {
            const d = new Date(v.created_at);
            return d >= yesterday && d < today;
          });
          
          setVendasDetails({
            valorTotal,
            ticketMedio: Math.round(ticketMedio * 100) / 100,
            vendasHoje: vendasHoje.length,
            vendasOntem: vendasOntem.length,
            valorHoje: vendasHoje.reduce((sum, v) => sum + parseFloat(v.value || 0), 0),
            valorOntem: vendasOntem.reduce((sum, v) => sum + parseFloat(v.value || 0), 0),
          });
        }
        
        // TOTAL CONVERSAS
        if (allChats) {
          const chatsArr = allChats as any[];
          const novos = chatsArr.filter(c => c.status === 'Novo Lead').length;
          const atendimento = chatsArr.filter(c => c.status === 'Em Atendimento').length;
          const convertidos = chatsArr.filter(c => c.status === 'Convertido').length;
          const perdidos = chatsArr.filter(c => c.status === 'Perdido').length;
          const outros = chatsArr.length - novos - atendimento - convertidos - perdidos;
          const taxaConversao = chatsArr.length > 0 ? (convertidos / chatsArr.length) * 100 : 0;
          
          setConversasDetails({
            novosLeads: novos,
            emAtendimento: atendimento,
            convertidos,
            perdidos,
            outros,
            taxaConversao: Math.round(taxaConversao * 10) / 10,
          });
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes dos cards:', error);
      }
    };
    
    fetchCardsDetails();
  }, [clinicId, chats]);

  // Buscar contas Meta Ads disponíveis
  useEffect(() => {
    const fetchMetaAccounts = async () => {
      if (!clinicId) return;
      
      const { data } = await (supabase as any)
        .from('clinic_meta_accounts')
        .select('id, account_id, account_name, access_token')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (data && data.length > 0) {
        setMetaAdsAccounts(data.map((a: any) => ({
          id: a.id,
          account_id: a.account_id,
          account_name: a.account_name,
          has_token: !!a.access_token
        })));
      }
    };
    
    fetchMetaAccounts();
  }, [clinicId]);

  // Buscar mensagens de um chat (somente leitura)
  const fetchChatMessages = async (chatId: string, clientName: string) => {
    setLoadingChat(true);
    setChatLeadName(clientName || 'Lead');
    setShowChatModal(true);
    setChatMessages([]);
    
    try {
      const { data } = await (supabase as any)
        .from('messages')
        .select('id, content, is_from_client, created_at, media_url, type')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (data) {
        setChatMessages(data);
      }
    } catch (e) {
      console.error('Erro ao buscar mensagens:', e);
    }
    
    setLoadingChat(false);
  };

  // Buscar dados de campanhas quando mudar para aba de conta Meta
  useEffect(() => {
    const fetchCampaignStats = async () => {
      if (!clinicId || !activeTab.startsWith('meta_')) return;
      setLoadingCampaigns(true);
      
      try {
        // Calcular data de início baseado no período
        const now = new Date();
        let startDate = new Date();
        if (campaignPeriod === 'custom' && customDateRange) {
          startDate = new Date(customDateRange.start + 'T00:00:00');
        } else if (campaignPeriod === 'today') startDate.setHours(0, 0, 0, 0);
        else if (campaignPeriod === '7d') startDate.setDate(now.getDate() - 7);
        else if (campaignPeriod === '30d') startDate.setDate(now.getDate() - 30);
        else if (campaignPeriod === '90d') startDate.setDate(now.getDate() - 90);
        
        // Calcular data final para período customizado
        let endDate = new Date();
        if (campaignPeriod === 'custom' && customDateRange?.end) {
          endDate = new Date(customDateRange.end + 'T23:59:59');
        }
        
        // Buscar chats do período com dados de campanha
        // Extrair account_id da aba ativa (formato: meta_123456)
        const accountIdFromTab = activeTab.startsWith('meta_') ? activeTab.replace('meta_', '') : null;
        
        let chatsQuery = supabase
          .from('chats')
          .select('id, created_at, source_id, ad_title, ad_source_id, ad_source_type, ad_source_url, client_name, phone_number, meta_campaign_name, meta_adset_name, meta_ad_name, meta_account_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, lead_sources!chats_source_id_fkey(name, code)')
          .eq('clinic_id', clinicId)
          .eq('is_group', false)
          .gte('created_at', startDate.toISOString());
        
        // Filtrar por conta Meta se uma aba específica estiver selecionada
        if (accountIdFromTab) {
          chatsQuery = (chatsQuery as any).eq('meta_account_id', accountIdFromTab);
        }
        
        if (campaignPeriod === 'custom' && customDateRange?.end) {
          chatsQuery = chatsQuery.lte('created_at', endDate.toISOString());
        }
        
        const { data: chatsData } = await chatsQuery.order('created_at', { ascending: false });
        
        if (chatsData) {
          const chatsArr = chatsData as any[];
          
          // 1. Leads por dia
          const leadsByDayMap = new Map<string, { leads: number; campanhas: number }>();
          chatsArr.forEach(chat => {
            const date = new Date(chat.created_at).toLocaleDateString('pt-BR');
            const current = leadsByDayMap.get(date) || { leads: 0, campanhas: 0 };
            current.leads++;
            if (chat.source_id || chat.ad_title) current.campanhas++;
            leadsByDayMap.set(date, current);
          });
          const leadsByDay = Array.from(leadsByDayMap.entries()).map(([date, data]) => ({
            date,
            leads: data.leads,
            campanhas: data.campanhas
          }));
          
          // 2. Anúncios Meta (Click to WhatsApp) - Lista individual de leads
          // Buscar dados da campanha via Meta API se não estiver preenchido
          const metaAdsChats = chatsArr.filter(c => c.ad_title).slice(0, 20);
          const metaAds = await Promise.all(metaAdsChats.map(async (chat) => {
            let adName = chat.meta_ad_name || '';
            let campaignName = chat.meta_campaign_name || '';
            let adsetName = chat.meta_adset_name || '';
            
            // Se não tem dados da campanha e tem ad_source_id, buscar na Meta API
            if (!campaignName && chat.ad_source_id) {
              try {
                const { data: adInfo } = await supabase.functions.invoke('meta-ads-api', {
                  body: { clinic_id: clinicId, action: 'get_ad_info', ad_id: chat.ad_source_id }
                });
                if (adInfo?.data) {
                  adName = adInfo.data.ad_name || adName;
                  campaignName = adInfo.data.campaign_name || '';
                  adsetName = adInfo.data.adset_name || '';
                }
              } catch (e) {
                console.log('Erro ao buscar info do anúncio:', e);
              }
            }
            
            return {
              chat_id: chat.id,
              ad_title: chat.ad_title || 'Sem título',
              count: 1,
              ad_source_type: chat.ad_source_type,
              client_name: chat.client_name || 'Cliente',
              phone_number: chat.phone_number || '',
              source_code: (chat.lead_sources as any)?.code || '-',
              ad_name: adName,
              campaign_name: campaignName,
              adset_name: adsetName,
              created_at: chat.created_at,
              utm_source: chat.utm_source || '',
              utm_medium: chat.utm_medium || '',
              utm_campaign: chat.utm_campaign || '',
              utm_content: chat.utm_content || '',
              utm_term: chat.utm_term || ''
            };
          }));
          
          // 3. Leads por plataforma (classificação inteligente)
          // Regex para detectar códigos de campanha Meta Ads
          const metaCampaignRegex = /^(AV|KR|ACV|AL|ALV|AVG|T|A)\d+$/i;
          // Helper para classificar cada chat
          const classifyChat = (c: any): 'meta' | 'instagram' | 'link' | 'source' | 'organic' => {
            if (c.ad_source_id) return 'meta';
            if (c.source_id && c.lead_sources) {
              const sourceName = (c.lead_sources.name || '').toLowerCase();
              const sourceCode = (c.lead_sources.code || '').toUpperCase();
              const sourceNameUpper = (c.lead_sources.name || '').toUpperCase();
              if (sourceName.includes('instagram')) return 'instagram';
              if (sourceCode && metaCampaignRegex.test(sourceCode)) return 'meta';
              if (!sourceCode && metaCampaignRegex.test(sourceNameUpper)) return 'meta';
            }
            if (c.ad_title) return 'meta';
            if (c.source_id) return 'source';
            return 'organic';
          };
          
          const fromMeta = chatsArr.filter(c => classifyChat(c) === 'meta').length;
          const fromInstagram = chatsArr.filter(c => classifyChat(c) === 'instagram').length;
          const fromSource = chatsArr.filter(c => classifyChat(c) === 'source').length;
          const organic = chatsArr.filter(c => classifyChat(c) === 'organic').length;
          
          const leadsByPlatform = [
            { name: 'Meta Ads', value: fromMeta, color: '#E1306C' },
            { name: 'Instagram', value: fromInstagram, color: '#C026D3' },
            { name: 'Outras Origens', value: fromSource, color: '#6366f1' },
            { name: 'Orgânico', value: organic, color: '#94a3b8' },
          ].filter(p => p.value > 0);
          
          // 4. Estatísticas por origem (para tabela Performance por Origem)
          // Buscar origens
          const { data: sourcesData } = await supabase
            .from('lead_sources')
            .select('id, name, code, color')
            .eq('clinic_id', clinicId);
          
          // Buscar pagamentos do período
          const { data: paymentsData } = await supabase
            .from('payments')
            .select('value, chat_id')
            .gte('payment_date', startDate.toISOString().split('T')[0]);
          
          // Buscar status dos chats diretamente com filtro de período e source_id
          let chatsWithStatusQuery = supabase
            .from('chats')
            .select('id, status, source_id')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
            .gte('created_at', startDate.toISOString())
            .not('source_id', 'is', null);
          
          // Filtrar por conta Meta se uma aba específica estiver selecionada
          if (accountIdFromTab) {
            chatsWithStatusQuery = (chatsWithStatusQuery as any).eq('meta_account_id', accountIdFromTab);
          }
          
          if (campaignPeriod === 'custom' && customDateRange?.end) {
            chatsWithStatusQuery = chatsWithStatusQuery.lte('created_at', endDate.toISOString());
          }
          
          const { data: chatsWithStatus } = await chatsWithStatusQuery;
          
          const sourceStats: Array<{ id: string; name: string; code: string | null; color: string; total_leads: number; converted_leads: number; revenue: number }> = [];
          
          if (sourcesData) {
            (sourcesData as any[]).forEach(source => {
              const sourceChats = (chatsWithStatus as any[] || []).filter(c => c.source_id === source.id);
              const convertedChats = sourceChats.filter(c => c.status === 'Convertido');
              const sourceChatIds = sourceChats.map(c => c.id);
              const sourcePayments = (paymentsData as any[] || []).filter(p => sourceChatIds.includes(p.chat_id));
              const revenue = sourcePayments.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
              
              if (sourceChats.length > 0) {
                sourceStats.push({
                  id: source.id,
                  name: source.name,
                  code: source.code,
                  color: source.color || '#94a3b8',
                  total_leads: sourceChats.length,
                  converted_leads: convertedChats.length,
                  revenue
                });
              }
            });
            sourceStats.sort((a, b) => b.total_leads - a.total_leads);
          }
          
          console.log('sourceStats:', sourceStats);
          setCampaignStats({ leadsByDay, metaAds, leadsByPlatform, sourceStats });
        }
      } catch (error) {
        console.error('Erro ao buscar dados de campanhas:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    
    fetchCampaignStats();
  }, [clinicId, activeTab, campaignPeriod, customDateRange]);

  // Buscar dados da Meta Ads API quando uma aba de conta Meta for selecionada
  useEffect(() => {
    const fetchMetaAdsApiData = async () => {
      // Verificar se é uma aba de conta Meta (formato: meta_123456)
      if (!clinicId || !activeTab.startsWith('meta_')) return;
      
      const accountId = activeTab.replace('meta_', '');
      setSelectedMetaAccountId(accountId);
      setMetaAdsConfigured(true);
      setLoadingMetaAdsApi(true);
      
      // Buscar configurações de visibilidade da clínica (apenas se não for SuperAdmin)
      if (user?.role !== 'SuperAdmin') {
        const { data: clinicData } = await (supabase as any)
          .from('clinics')
          .select('meta_ads_visibility')
          .eq('id', clinicId)
          .single();
        
        if (clinicData?.meta_ads_visibility) {
          setMetaAdsVisibility(clinicData.meta_ads_visibility);
        }
      }
      
      try {
        const datePreset = campaignPeriod === 'today' ? 'today' : campaignPeriod === '7d' ? 'last_7d' : campaignPeriod === '30d' ? 'last_30d' : 'last_90d';
        
        // Buscar todos os dados em paralelo para a conta específica
        const [campaignsRes, adsetsRes, adsRes, insightsRes, campaignInsightsRes, adsetInsightsRes] = await Promise.all([
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_campaigns', account_id: accountId }
          }),
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_adsets', account_id: accountId }
          }),
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_ads', account_id: accountId }
          }),
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_insights', date_preset: datePreset, account_id: accountId }
          }),
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_campaign_insights', date_preset: datePreset, account_id: accountId }
          }),
          supabase.functions.invoke('meta-ads-api', {
            body: { clinic_id: clinicId, action: 'get_adset_insights', date_preset: datePreset, account_id: accountId }
          })
        ]);
        
        setMetaAdsApiData({
          campaigns: campaignsRes.data?.data || [],
          adsets: adsetsRes.data?.data || [],
          ads: adsRes.data?.data || [],
          insights: insightsRes.data?.data || [],
          campaignInsights: campaignInsightsRes.data?.data || [],
          adsetInsights: adsetInsightsRes.data?.data || []
        });
        
        // Buscar leads por anúncio Meta (Click to WhatsApp) com código e nome do cliente
        const { data: metaAdsLeads } = await supabase
          .from('chats' as any)
          .select('ad_title, ad_source_id, client_name, source_id, lead_sources!chats_source_id_fkey(code)')
          .eq('clinic_id', clinicId)
          .not('ad_title', 'is', null)
          .eq('ad_source_type', 'ad')
          .order('created_at', { ascending: false });
        
        if (metaAdsLeads) {
          const adsList = (metaAdsLeads as any[]).map((chat: any) => ({
            ad_title: chat.ad_title,
            ad_source_id: chat.ad_source_id,
            source_code: chat.lead_sources?.code || '-',
            client_name: chat.client_name || 'Cliente'
          }));
          setTopMetaAds(adsList);
        }
        
        console.log('Meta Ads API Data:', { campaigns: campaignsRes.data, ads: adsRes.data, insights: insightsRes.data, campaignInsights: campaignInsightsRes.data });
      } catch (error) {
        console.error('Erro ao buscar dados da Meta Ads API:', error);
      } finally {
        setLoadingMetaAdsApi(false);
      }
    };
    
    fetchMetaAdsApiData();
  }, [clinicId, activeTab, campaignPeriod, customDateRange]);

  // Buscar tarefas quando a aba Tarefas for selecionada
  useEffect(() => {
    const fetchTasks = async () => {
      if (!clinicId || activeTab !== 'tasks') return;
      setLoadingTasks(true);
      
      try {
        const { data: tasksData, error } = await supabase
          .from('tasks' as any)
          .select(`
            id,
            chat_id,
            title,
            description,
            due_date,
            completed,
            completed_at,
            created_by,
            created_at,
            chats:chat_id (client_name)
          `)
          .eq('clinic_id', clinicId)
          .order('due_date', { ascending: true, nullsFirst: false });
        
        if (!error && tasksData) {
          const formattedTasks = (tasksData as any[]).map(task => ({
            ...task,
            client_name: task.chats?.client_name || 'Cliente'
          }));
          setTasks(formattedTasks);
        }
      } catch (error) {
        console.error('Erro ao buscar tarefas:', error);
      } finally {
        setLoadingTasks(false);
      }
    };
    
    fetchTasks();
  }, [clinicId, activeTab]);

  // Buscar dados de produtividade quando a aba Produtividade for selecionada
  useEffect(() => {
    const fetchProductivity = async () => {
      if (!clinicId || activeTab !== 'productivity') return;
      setLoadingProductivity(true);
      
      try {
        // Calcular data de início baseado no período selecionado
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - productivityPeriod);
        periodStart.setHours(0, 0, 0, 0);
        const periodStartStr = periodStart.toISOString();
        
        // Buscar usuários da clínica (roles que atendem leads)
        const { data: usersData } = await supabase
          .from('users' as any)
          .select('id, name, role')
          .eq('clinic_id', clinicId)
          .in('role', ['Admin', 'Comercial', 'Recepcionista', 'Atendente']);
        
        if (!usersData) {
          setLoadingProductivity(false);
          return;
        }
        
        // Buscar tempo médio de resposta via SQL (com período)
        const { data: responseTimesData } = await (supabase.rpc as any)('get_response_times_by_user_period', { 
          p_clinic_id: clinicId,
          p_start_date: periodStartStr
        });
        const responseTimes = (responseTimesData || []) as any[];
        
        // Para cada usuário, calcular métricas
        const productivityPromises = (usersData as any[]).map(async (user) => {
          // Buscar chats atribuídos ao usuário no período
          const { data: chatsData } = await (supabase as any)
            .from('chats')
            .select('id, status, created_at')
            .eq('clinic_id', clinicId)
            .eq('assigned_to', user.id)
            .eq('is_group', false)
            .gte('created_at', periodStartStr);
          
          // Buscar mensagens que o usuário REALMENTE enviou (sent_by) no período
          const { data: messagesData } = await (supabase as any)
            .from('messages')
            .select('id, created_at, chat_id, sent_by')
            .eq('sent_by', user.id)
            .eq('is_from_client', false)
            .gte('created_at', periodStartStr);
          
          const chats = chatsData || [];
          const messages = messagesData || [];
          
          // Encontrar tempo médio de resposta para este usuário
          const userResponseTime = responseTimes.find((rt: any) => rt.assigned_to === user.id);
          
          return {
            user_id: user.id,
            user_name: user.name,
            role: user.role,
            avg_response_time: userResponseTime?.avg_response_minutes || 0,
            first_response_time: 0,
            messages_sent: messages.length,
            chats_active: chats.filter((c: any) => c.status !== 'Convertido' && c.status !== 'Perdido').length,
            leads_count: chats.length,
            conversions: chats.filter((c: any) => c.status === 'Convertido').length
          };
        });
        
        const results = await Promise.all(productivityPromises);
        setProductivityData(results);
      } catch (error) {
        console.error('Erro ao buscar produtividade:', error);
      } finally {
        setLoadingProductivity(false);
      }
    };
    
    fetchProductivity();
  }, [clinicId, activeTab, productivityPeriod]);

  // Calcular variação percentual
  const calcChange = (current: number, yesterday: number | undefined) => {
    if (yesterday === undefined || yesterday === 0) return null;
    const diff = current - yesterday;
    const percent = Math.round((diff / yesterday) * 100);
    return { diff, percent };
  };

  const stats = [
    { 
      label: 'Novos Leads', 
      value: String(novosLeads), 
      yesterdayValue: yesterdayStats?.novosLeads,
      color: 'blue', 
      icon: 'person_add', 
      tooltip: 'Conversas com status "Novo Lead" - leads que ainda não foram atendidos (excluindo grupos)' 
    },
    { 
      label: 'Em Atendimento', 
      value: String(emAtendimento), 
      yesterdayValue: yesterdayStats?.emAtendimento,
      color: 'orange', 
      icon: 'forum', 
      tooltip: 'Conversas com status "Em Atendimento" - leads sendo trabalhados ativamente (excluindo grupos)' 
    },
    { 
      label: 'Vendas Concluídas', 
      value: String(activePaymentsCount), 
      yesterdayValue: yesterdayStats?.vendas,
      color: 'green', 
      icon: 'check_circle', 
      tooltip: 'Total de negociações registradas (não canceladas) - vem da aba Negociações no chat' 
    },
    { 
      label: 'Total Conversas', 
      value: String(totalChats), 
      yesterdayValue: yesterdayStats?.totalChats,
      color: 'purple', 
      icon: 'chat', 
      tooltip: 'Quantidade total de conversas/leads no sistema (excluindo grupos)' 
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header com Abas */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-500 mb-3 sm:mb-4">Resumo em tempo real da performance da sua clínica.</p>
          
          {/* Tabs - Scroll horizontal no mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max sm:w-fit">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'overview' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">dashboard</span>
                  <span className="hidden sm:inline">Visão Geral</span>
                  <span className="sm:hidden">Geral</span>
                </span>
              </button>
              {/* Abas dinâmicas para cada conta Meta Ads - Admin e SuperAdmin */}
              {isAdmin && metaAdsAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setActiveTab(`meta_${account.account_id}`);
                    setSelectedMetaAccountId(account.account_id);
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === `meta_${account.account_id}` 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">ads_click</span>
                    <span className="hidden sm:inline">{account.account_name.length > 15 ? account.account_name.substring(0, 15) + '...' : account.account_name}</span>
                    <span className="sm:hidden">{account.account_name.length > 8 ? account.account_name.substring(0, 8) + '...' : account.account_name}</span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'tasks' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">task_alt</span>
                  Tarefas
                </span>
              </button>
              <button
                onClick={() => setActiveTab('productivity')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'productivity' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">speed</span>
                  <span className="hidden sm:inline">Produtividade</span>
                  <span className="sm:hidden">Prod.</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('leads')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'leads' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">group</span>
                  Leads
                </span>
              </button>
              <button
                onClick={() => setActiveTab('charts')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'charts' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">bar_chart</span>
                  <span className="hidden sm:inline">Gráficos</span>
                  <span className="sm:hidden">Graf.</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo da Aba Visão Geral */}
        {activeTab === 'overview' && (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {stats.map(stat => (
            <div 
              key={stat.label} 
              className={`bg-white p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-0.5 sm:gap-1 transition-all duration-300 cursor-pointer hover:shadow-md ${expandedCard === stat.label ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setExpandedCard(expandedCard === stat.label ? null : stat.label)}
            >
              <div className="flex justify-between items-center mb-1 sm:mb-2">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-[10px] sm:text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                  <div className="relative group hidden sm:block">
                    <span className="material-symbols-outlined text-[14px] text-slate-400 cursor-help hover:text-slate-600">info</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48 text-center z-50 shadow-lg">
                      {stat.tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-blue-500 ml-0.5 sm:ml-1">
                    {expandedCard === stat.label ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                <span className={`material-symbols-outlined text-[18px] sm:text-[20px] lg:text-[24px] text-${stat.color}-600`}>{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900">{stat.value}</span>
                {(() => {
                  const change = calcChange(parseInt(stat.value), stat.yesterdayValue);
                  if (!change) return null;
                  const isPositive = change.diff >= 0;
                  return (
                    <span className={`text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded ${isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                      {isPositive ? '+' : ''}{change.percent}%
                    </span>
                  );
                })()}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400">
                {stat.yesterdayValue !== undefined ? `ontem: ${stat.yesterdayValue}` : 'vs. ontem'}
              </span>
              
              {/* Card expandido - Detalhes de Novos Leads */}
              {stat.label === 'Novos Leads' && expandedCard === 'Novos Leads' && leadsDetails && (
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-200 space-y-2 sm:space-y-3 animate-in fade-in duration-200">
                  {/* Leads Hoje */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-emerald-500">today</span>
                      <span className="text-xs sm:text-sm text-slate-600">Leads Hoje</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-slate-800">{leadsDetails.leadsHoje}</span>
                      {leadsDetails.leadsHojeOntem > 0 && (
                        <span className="text-[10px] sm:text-xs text-slate-400">(ontem: {leadsDetails.leadsHojeOntem})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Separador - Por Origem */}
                  <div className="pt-1 sm:pt-2 pb-0.5 sm:pb-1">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Origem</span>
                  </div>
                  
                  {/* Meta Ads */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-pink-500">ads_click</span>
                      <span className="text-xs sm:text-sm text-slate-600">Meta Ads</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-pink-600">{leadsDetails.leadsMetaAdsHoje}</span>
                      {leadsDetails.leadsMetaAdsOntem > 0 && (
                        <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">(ontem: {leadsDetails.leadsMetaAdsOntem})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Links Rastreáveis */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-indigo-500">link</span>
                      <span className="text-xs sm:text-sm text-slate-600">Links</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-indigo-600">{leadsDetails.leadsLinksHoje}</span>
                      {leadsDetails.leadsLinksOntem > 0 && (
                        <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">(ontem: {leadsDetails.leadsLinksOntem})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Orgânico */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-emerald-500">public</span>
                      <span className="text-xs sm:text-sm text-slate-600">Orgânico</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-emerald-600">{leadsDetails.leadsOrganicoHoje}</span>
                      {leadsDetails.leadsOrganicoOntem > 0 && (
                        <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">(ontem: {leadsDetails.leadsOrganicoOntem})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Top Origens */}
                  {leadsDetails.topOrigens.length > 0 && (
                    <div className="pt-2 sm:pt-3 border-t border-slate-100">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-2">Top Origens Hoje</span>
                      <div className="space-y-1 sm:space-y-1.5">
                        {leadsDetails.topOrigens.map((origem, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0 ${
                                origem.tipo === 'meta' ? 'bg-pink-500' : 
                                origem.tipo === 'link' ? 'bg-indigo-500' : 'bg-slate-400'
                              }`}></span>
                              <span className="text-[10px] sm:text-xs text-slate-600 truncate" title={origem.nome}>
                                {origem.nome.length > 15 ? origem.nome.substring(0, 15) + '...' : origem.nome}
                              </span>
                              {origem.codigo && origem.codigo !== origem.nome && (
                                <span className="text-[10px] text-slate-400">({origem.codigo})</span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-slate-700 ml-2">{origem.quantidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-[8px] sm:text-[10px] text-slate-400 pt-1 sm:pt-2 hidden sm:block">
                    * Meta Ads = Click to WhatsApp | Links = Bio, Site | Orgânico = Sem origem identificada
                  </p>
                </div>
              )}
              
              {/* Card expandido - Detalhes de Em Atendimento */}
              {stat.label === 'Em Atendimento' && expandedCard === 'Em Atendimento' && atendimentoDetails && (
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-200 space-y-2 sm:space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-orange-500">groups</span>
                      <span className="text-xs sm:text-sm text-slate-600">Atendentes</span>
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-slate-800">{atendimentoDetails.atendentesAtivos}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-emerald-500">today</span>
                      <span className="text-xs sm:text-sm text-slate-600">Iniciados hoje</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-slate-800">{atendimentoDetails.iniciadosHoje}</span>
                      {atendimentoDetails.iniciadosOntem > 0 && (
                        <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">(ontem: {atendimentoDetails.iniciadosOntem})</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-blue-500">schedule</span>
                      <span className="text-xs sm:text-sm text-slate-600">Média</span>
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-blue-600">{atendimentoDetails.mediaDias} dias</span>
                  </div>
                </div>
              )}
              
              {/* Card expandido - Detalhes de Vendas Concluídas */}
              {stat.label === 'Vendas Concluídas' && expandedCard === 'Vendas Concluídas' && vendasDetails && (
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-200 space-y-2 sm:space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-emerald-500">payments</span>
                      <span className="text-xs sm:text-sm text-slate-600">Valor total</span>
                    </div>
                    <span className="text-xs sm:text-lg font-bold text-emerald-600">
                      R$ {vendasDetails.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-purple-500">local_offer</span>
                      <span className="text-xs sm:text-sm text-slate-600">Ticket médio</span>
                    </div>
                    <span className="text-xs sm:text-lg font-bold text-purple-600">
                      R$ {vendasDetails.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-blue-500">today</span>
                      <span className="text-xs sm:text-sm text-slate-600">Vendas hoje</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-bold text-slate-800">{vendasDetails.vendasHoje}</span>
                      <span className="text-[10px] sm:text-xs text-slate-400 hidden sm:inline">(ontem: {vendasDetails.vendasOntem})</span>
                    </div>
                  </div>
                  
                  {vendasDetails.valorHoje > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-green-500">trending_up</span>
                        <span className="text-xs sm:text-sm text-slate-600">Valor hoje</span>
                      </div>
                      <span className="text-xs sm:text-lg font-bold text-green-600">
                        R$ {vendasDetails.valorHoje.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Card expandido - Detalhes de Total Conversas */}
              {stat.label === 'Total Conversas' && expandedCard === 'Total Conversas' && conversasDetails && (
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-200 space-y-1.5 sm:space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-500"></span>
                      <span className="text-xs sm:text-sm text-slate-600">Novos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">{conversasDetails.novosLeads}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500"></span>
                      <span className="text-xs sm:text-sm text-slate-600">Atendimento</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">{conversasDetails.emAtendimento}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></span>
                      <span className="text-xs sm:text-sm text-slate-600">Convertidos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-green-600">{conversasDetails.convertidos}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500"></span>
                      <span className="text-xs sm:text-sm text-slate-600">Perdidos</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-red-600">{conversasDetails.perdidos}</span>
                  </div>
                  
                  {conversasDetails.outros > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-400"></span>
                        <span className="text-xs sm:text-sm text-slate-600">Outros</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-600">{conversasDetails.outros}</span>
                    </div>
                  )}
                  
                  <div className="pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="material-symbols-outlined text-[14px] sm:text-[18px] text-purple-500">analytics</span>
                        <span className="text-xs sm:text-sm font-medium text-slate-700">Conversão</span>
                      </div>
                      <span className="text-sm sm:text-lg font-bold text-purple-600">{conversasDetails.taxaConversao}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Faturamento Cards - 4 cards: Comercial, Clínica, Total Mês, Total Geral */}
        {canSeeBilling && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Receita Comercial do Mês */}
          <div onClick={() => setShowCommercialRevenueDetail(true)} className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-orange-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate">Receita Comercial</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-black mt-0.5 sm:mt-1 truncate">
                  R$ {monthlyRevenueConfirmed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0 ml-2">
                <span className="material-symbols-outlined text-base sm:text-lg lg:text-xl">storefront</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {monthlyRevenuePending > 0 && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-orange-200">schedule</span>
                  <span className="text-orange-200">R$ {monthlyRevenuePending.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pendente</span>
                </div>
              )}
              {monthlyRevenuePending === 0 && (
                <div className="flex items-center gap-1 text-orange-100 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px]">calendar_month</span>
                  {new Date().toLocaleDateString('pt-BR', { month: 'short' })}
                </div>
              )}
            </div>
          </div>

          {/* Receita Clínica do Mês */}
          <div onClick={fetchClinicRevenueDetails} className="bg-gradient-to-br from-teal-500 to-teal-600 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-teal-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate">Receita Clínica</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-black mt-0.5 sm:mt-1 truncate">
                  R$ {(totalClinicRevenue?.monthlyConfirmed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0 ml-2">
                <span className="material-symbols-outlined text-base sm:text-lg lg:text-xl">medical_services</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {(totalClinicRevenue?.monthlyPending || 0) > 0 && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-teal-200">schedule</span>
                  <span className="text-teal-200">R$ {(totalClinicRevenue?.monthlyPending || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pendente</span>
                </div>
              )}
              {(totalClinicRevenue?.monthlyPending || 0) === 0 && (
                <div className="flex items-center gap-1 text-teal-100 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px]">calendar_month</span>
                  {new Date().toLocaleDateString('pt-BR', { month: 'short' })}
                </div>
              )}
            </div>
          </div>

          {/* Faturamento do Mês (Total) */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-emerald-100 text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate">Fat. do Mês</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-black mt-0.5 sm:mt-1 truncate">
                  R$ {(monthlyRevenueConfirmed + (totalClinicRevenue?.monthlyConfirmed || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0 ml-2">
                <span className="material-symbols-outlined text-base sm:text-lg lg:text-xl">trending_up</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {(monthlyRevenuePending + (totalClinicRevenue?.monthlyPending || 0)) > 0 && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-yellow-200">schedule</span>
                  <span className="text-yellow-200">R$ {(monthlyRevenuePending + (totalClinicRevenue?.monthlyPending || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pendente</span>
                </div>
              )}
              {(monthlyRevenuePending + (totalClinicRevenue?.monthlyPending || 0)) === 0 && (
                <div className="flex items-center gap-1 text-emerald-100 text-[10px] sm:text-xs">
                  <span className="material-symbols-outlined text-[12px] sm:text-[14px]">add</span>
                  <span className="hidden sm:inline">Comercial + Clínica</span>
                  <span className="sm:hidden">Total</span>
                </div>
              )}
            </div>
          </div>

        </div>
        )}

        {/* Minha Meta do Mês - Visível apenas para atendentes com permissão */}
        {userGoalData && userGoalData.canSeeGoal && userGoalData.monthlyGoal > 0 && (
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-violet-100 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">flag</span>
                  Minha Meta do Mês
                </p>
                <p className="text-4xl font-black mt-1">
                  {((userGoalData.myMonthlyRevenue / userGoalData.monthlyGoal) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">
                  {userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal ? 'emoji_events' : 'target'}
                </span>
              </div>
            </div>
            
            {/* Barra de progresso */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-violet-100">
                  R$ {userGoalData.myMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-violet-200">
                  Meta: R$ {userGoalData.monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal 
                      ? 'bg-emerald-400' 
                      : 'bg-white'
                  }`}
                  style={{ width: `${Math.min((userGoalData.myMonthlyRevenue / userGoalData.monthlyGoal) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-violet-100 text-sm">
              {userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Parabéns! Meta atingida! 🎉
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  Faltam R$ {(userGoalData.monthlyGoal - userGoalData.myMonthlyRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para a meta
                </>
              )}
            </div>
          </div>
        )}

        {/* Minhas Vendas e Receita Clínica - Visível apenas para Comercial */}
        {clinicReceiptsData && (
          <div>
            <button
              onClick={() => setShowComercialCards(!showComercialCards)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-xl">sell</span>
                <span className="font-bold text-sm text-slate-700">Minhas Vendas & Receita</span>
                <span className="text-xs text-slate-400 font-medium">
                  R$ {clinicReceiptsData.totalComercial.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} vendido | R$ {clinicReceiptsData.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} recebido | ROI {clinicReceiptsData.roi}%
                </span>
              </div>
              <span className={`material-symbols-outlined text-slate-400 text-xl transition-transform ${showComercialCards ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {showComercialCards && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-2xl shadow-lg text-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">Minhas Vendas</p>
                      <p className="text-2xl font-black mt-1">
                        R$ {clinicReceiptsData.totalComercial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl">
                      <span className="material-symbols-outlined text-xl">sell</span>
                    </div>
                  </div>
                  <p className="text-amber-100 text-xs">Valor total fechado por mim</p>
                </div>

                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-5 rounded-2xl shadow-lg text-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase tracking-wider">Receita Clinica</p>
                      <p className="text-2xl font-black mt-1">
                        R$ {clinicReceiptsData.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl">
                      <span className="material-symbols-outlined text-xl">account_balance</span>
                    </div>
                  </div>
                  <p className="text-teal-100 text-xs">Recebido pela clinica das minhas vendas</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-5 rounded-2xl shadow-lg text-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-purple-100 text-xs font-medium uppercase tracking-wider">ROI</p>
                      <p className="text-2xl font-black mt-1">{clinicReceiptsData.roi}%</p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl">
                      <span className="material-symbols-outlined text-xl">trending_up</span>
                    </div>
                  </div>
                  <p className="text-purple-100 text-xs">Retorno sobre minhas vendas</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Minhas Vendas Detalhadas - Visível apenas para Comercial */}
        {mySalesDetails.length > 0 && (
          <div>
            <button
              onClick={() => setShowSalesDetails(!showSalesDetails)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-500 text-xl">receipt_long</span>
                <span className="font-bold text-sm text-slate-700">Minhas Vendas Detalhadas</span>
                <span className="text-xs text-slate-400 font-medium">
                  {mySalesDetails.length} venda{mySalesDetails.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className={`material-symbols-outlined text-slate-400 text-xl transition-transform ${showSalesDetails ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            {showSalesDetails && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comercial</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recebido</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mySalesDetails.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800">{sale.clientName}</span>
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">
                            {parseLocalDate(sale.paymentDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                            >
                              {sale.sourceName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-bold text-amber-600">
                              R$ {sale.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
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
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-700" colSpan={3}>Total</td>
                        <td className="py-3 px-4 text-right font-black text-amber-600">
                          R$ {mySalesDetails.reduce((sum, s) => sum + s.commercialValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">
                          R$ {mySalesDetails.reduce((sum, s) => sum + s.receivedValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leads por Origem */}
        {canSeeBilling && (
          <div>
            <button
              onClick={() => setShowLeadSources(!showLeadSources)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-xl">hub</span>
                <span className="font-bold text-sm text-slate-700">Leads por Origem</span>
                <span className="text-xs text-slate-400 font-medium">
                  {filteredLeadSourceStats.length} origem{filteredLeadSourceStats.length !== 1 ? 'ns' : ''} | {filteredLeadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)} leads
                </span>
              </div>
              <span className={`material-symbols-outlined text-slate-400 text-xl transition-transform ${showLeadSources ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
          {showLeadSources && (
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm mt-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div>
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900">Leads por Origem</h3>
                <p className="text-xs sm:text-sm text-slate-500">Performance de cada canal</p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center w-full sm:w-auto">
                <button
                  onClick={() => { setSourcesPeriodFilter('today'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === 'today' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoje
                </button>
                <button
                  onClick={() => { setSourcesPeriodFilter('yesterday'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors hidden sm:block ${
                    sourcesPeriodFilter === 'yesterday' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Ontem
                </button>
                <button
                  onClick={() => { setSourcesPeriodFilter('7d'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === '7d' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  7d
                </button>
                <button
                  onClick={() => { setSourcesPeriodFilter('30d'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === '30d' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  30d
                </button>
                <button
                  onClick={() => { setSourcesPeriodFilter('month'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors hidden sm:block ${
                    sourcesPeriodFilter === 'month' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mês
                </button>
                <button
                  onClick={() => { setSourcesPeriodFilter('all'); setSourcesPage(1); }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === 'all' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                
                <div className="relative">
                  <button
                    onClick={() => setShowSourcesDropdown(!showSourcesDropdown)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      selectedSources && selectedSources.length > 0
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                    {selectedSources && selectedSources.length > 0 
                      ? `${selectedSources.length} origem(ns)`
                      : 'Todas origens'
                    }
                    <span className="material-symbols-outlined text-sm">
                      {showSourcesDropdown ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  
                  {showSourcesDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                      <div className="p-2 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-600">Filtrar por origem</span>
                        <button
                          onClick={() => setSelectedSources(null)}
                          className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                        >
                          Limpar
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {leadSourceStats.map(source => {
                          const isSelected = selectedSources === null || selectedSources.includes(source.id);
                          return (
                            <label
                              key={source.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (selectedSources === null) {
                                      setSelectedSources(null);
                                    } else {
                                      const newSelected = [...selectedSources, source.id];
                                      if (newSelected.length === leadSourceStats.length) {
                                        setSelectedSources(null);
                                      } else {
                                        setSelectedSources(newSelected);
                                      }
                                    }
                                  } else {
                                    if (selectedSources === null) {
                                      setSelectedSources(leadSourceStats.filter(s => s.id !== source.id).map(s => s.id));
                                    } else {
                                      const newSelected = selectedSources.filter(id => id !== source.id);
                                      setSelectedSources(newSelected.length > 0 ? newSelected : null);
                                    }
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                              />
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: source.tag_color || source.color }}
                              ></span>
                              <span className="text-sm text-slate-700 truncate">{source.code || source.name}</span>
                              {source.tag_name && (
                                <span
                                  className="text-[10px] text-white px-1.5 py-0.5 rounded font-medium ml-auto"
                                  style={{ backgroundColor: source.tag_color || '#6B7280' }}
                                >
                                  {source.tag_name}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-slate-100">
                        <button
                          onClick={() => setShowSourcesDropdown(false)}
                          className="w-full px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Versão Mobile - Cards Expansíveis */}
            <div className="sm:hidden space-y-2">
              {filteredLeadSourceStats.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl mb-2 block">inbox</span>
                  <span className="text-xs">Nenhum lead encontrado</span>
                </div>
              ) : (
                <>
                  {filteredLeadSourceStats
                    .slice((sourcesPage - 1) * sourcesPerPage, sourcesPage * sourcesPerPage)
                    .map(source => {
                    const conversionRate = source.total_leads > 0 
                      ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                      : '0.0';
                    const isExpanded = expandedSourceId === source.id;
                    return (
                      <div 
                        key={source.id} 
                        className={`bg-slate-50 rounded-xl border transition-all ${isExpanded ? 'border-cyan-300 bg-white shadow-sm' : 'border-slate-200'}`}
                      >
                        {/* Header do Card - Sempre visível */}
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: source.tag_color || source.color }}></span>
                            <span className="font-medium text-slate-800 text-xs truncate">{source.code || source.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-xs">{source.total_leads}</span>
                            <span className="font-bold text-cyan-600 text-xs">
                              R$ {(source.revenue + source.clinic_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className="material-symbols-outlined text-slate-400 text-[16px]">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Conteúdo Expandido */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100 animate-in fade-in duration-200">
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Leads</p>
                                <p className="text-sm font-bold text-slate-800">{source.total_leads}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Conv.</p>
                                <p className="text-sm font-bold text-green-600">{source.converted_leads}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Taxa</p>
                                <p className={`text-sm font-bold ${Number(conversionRate) >= 30 ? 'text-green-600' : Number(conversionRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                                  {conversionRate}%
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Comercial</p>
                                <p className="text-sm font-bold text-amber-600">
                                  R$ {source.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Clínica</p>
                                <p className="text-sm font-bold text-emerald-600">
                                  R$ {source.clinic_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-medium">Total</p>
                                <p className="text-sm font-bold text-cyan-600">
                                  R$ {(source.revenue + source.clinic_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              </div>
                            </div>
                            {canDeleteSources && (
                              <div className="flex justify-end mt-3 pt-2 border-t border-slate-100">
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation();
                                    setDeleteSourceModal({ 
                                      id: source.id, 
                                      name: source.code || source.name, 
                                      leadsCount: source.total_leads 
                                    });
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-xs"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                  Deletar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Totais Mobile */}
                  <div className="bg-slate-100 rounded-xl p-3 mt-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-medium">Leads</p>
                        <p className="text-sm font-bold text-slate-800">
                          {filteredLeadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-medium">Comercial</p>
                        <p className="text-sm font-bold text-amber-600">
                          R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-medium">Clínica</p>
                        <p className="text-sm font-bold text-emerald-600">
                          R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.clinic_revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-medium">Total</p>
                        <p className="text-sm font-bold text-cyan-600">
                          R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.revenue + s.clinic_revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Versão Desktop/Tablet - Tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Leads</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Conv.</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Taxa</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comercial</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Clínica</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                    {canDeleteSources && (
                      <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeadSourceStats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                        <span className="text-sm">Nenhum lead encontrado</span>
                      </td>
                    </tr>
                  ) : filteredLeadSourceStats
                    .slice((sourcesPage - 1) * sourcesPerPage, sourcesPage * sourcesPerPage)
                    .map(source => {
                    const conversionRate = source.total_leads > 0 
                      ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                      : '0.0';
                    return (
                      <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.tag_color || source.color }}></span>
                            <span className="font-medium text-slate-800 text-sm">{source.code || source.name}</span>
                            {source.tag_name && (
                              <span 
                                className="text-[10px] text-white px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: source.tag_color || '#6B7280' }}
                              >
                                {source.tag_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-slate-800">{source.total_leads}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-green-600">{source.converted_leads}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${Number(conversionRate) >= 30 ? 'text-green-600' : Number(conversionRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {conversionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-amber-600">
                            R$ {source.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-emerald-600">
                            R$ {source.clinic_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-cyan-600">
                            R$ {(source.revenue + source.clinic_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        {canDeleteSources && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setDeleteSourceModal({ 
                                id: source.id, 
                                name: source.code || source.name, 
                                leadsCount: source.total_leads 
                              })}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deletar origem"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {filteredLeadSourceStats.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-700">Total</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {filteredLeadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-green-600">
                      {filteredLeadSourceStats.reduce((sum, s) => sum + s.converted_leads, 0)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">
                      {filteredLeadSourceStats.reduce((sum, s) => sum + s.total_leads, 0) > 0 
                        ? ((filteredLeadSourceStats.reduce((sum, s) => sum + s.converted_leads, 0) / filteredLeadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)) * 100).toFixed(1)
                        : '0.0'}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600">
                      R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.clinic_revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-cyan-600">
                      R$ {filteredLeadSourceStats.reduce((sum, s) => sum + s.revenue + s.clinic_revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    {canDeleteSources && <td></td>}
                  </tr>
                </tfoot>
                )}
              </table>
            </div>
            
            {/* Paginação */}
            {filteredLeadSourceStats.length > sourcesPerPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100">
                <p className="text-[10px] sm:text-sm text-slate-500">
                  {Math.min((sourcesPage - 1) * sourcesPerPage + 1, filteredLeadSourceStats.length)}-{Math.min(sourcesPage * sourcesPerPage, filteredLeadSourceStats.length)} de {filteredLeadSourceStats.length}
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSourcesPage(p => Math.max(1, p - 1))}
                    disabled={sourcesPage === 1}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                      sourcesPage === 1
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ant.
                  </button>
                  <span className="text-[10px] sm:text-sm text-slate-600">
                    {sourcesPage}/{Math.ceil(filteredLeadSourceStats.length / sourcesPerPage)}
                  </span>
                  <button
                    onClick={() => setSourcesPage(p => Math.min(Math.ceil(filteredLeadSourceStats.length / sourcesPerPage), p + 1))}
                    disabled={sourcesPage >= Math.ceil(filteredLeadSourceStats.length / sourcesPerPage)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-colors ${
                      sourcesPage >= Math.ceil(filteredLeadSourceStats.length / sourcesPerPage)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Próx.
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
          </div>
        )}

        {/* Seção de Tarefas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {/* Tarefas Atrasadas */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-red-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-base sm:text-xl text-red-600">warning</span>
                <h3 className="font-bold text-red-800 text-xs sm:text-sm">Atrasadas</h3>
              </div>
              <span className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                {overdueTasks.length}
              </span>
            </div>
            <div className="p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma tarefa atrasada</p>
              ) : (
                <div className="space-y-2">
                  {overdueTasks.slice(0, 5).map(task => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => navigate(`/inbox?chat=${task.chat_id}`)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }}
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
              )}
            </div>
          </div>

          {/* Tarefas de Hoje */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-base sm:text-xl text-amber-600">today</span>
                <h3 className="font-bold text-amber-800 text-xs sm:text-sm">Hoje</h3>
              </div>
              <span className="bg-amber-600 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                {todayTasks.length}
              </span>
            </div>
            <div className="p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma tarefa para hoje</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.slice(0, 5).map(task => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => navigate(`/inbox?chat=${task.chat_id}`)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }}
                        className="mt-0.5 size-4 rounded border-2 border-amber-300 hover:bg-amber-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{task.chat_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tarefas da Semana */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-cyan-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-base sm:text-xl text-cyan-600">date_range</span>
                <h3 className="font-bold text-cyan-800 text-xs sm:text-sm">Esta Semana</h3>
              </div>
              <span className="bg-cyan-600 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                {weekTasks.length}
              </span>
            </div>
            <div className="p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
              {weekTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma tarefa esta semana</p>
              ) : (
                <div className="space-y-2">
                  {weekTasks.slice(0, 5).map(task => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => navigate(`/inbox?chat=${task.chat_id}`)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }}
                        className="mt-0.5 size-4 rounded border-2 border-slate-300 hover:bg-slate-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{task.chat_name}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                        {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seção de Follow-ups Agendados */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="material-symbols-outlined text-base sm:text-xl text-blue-600">schedule_send</span>
              <h3 className="font-bold text-blue-800 text-xs sm:text-sm">Follow-ups Agendados</h3>
            </div>
            <span className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
              {scheduledFollowups.length}
            </span>
          </div>
          <div className="p-3 sm:p-4">
            {scheduledFollowups.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-400 text-center py-3 sm:py-4">Nenhum follow-up agendado</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {scheduledFollowups.map(followup => (
                  <div 
                    key={followup.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => navigate(`/inbox?chat=${followup.chat_id}`)}
                  >
                    <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-lg">schedule</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{followup.client_name}</p>
                      <p className="text-xs text-slate-600 truncate">{followup.message}</p>
                      <p className="text-[10px] text-blue-600 font-medium mt-1">
                        {new Date(followup.scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(followup.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leads Recentes */}
        <div>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Leads Recentes</h3>
              <a href="#" className="text-[10px] sm:text-xs font-bold text-cyan-600">Ver todos</a>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-50 max-h-48 sm:max-h-64 lg:max-h-none">
              {loading ? (
                <div className="p-4 sm:p-8 text-center">
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-cyan-600 mx-auto"></div>
                </div>
              ) : chats.length === 0 ? (
                <div className="p-4 sm:p-8 text-center text-slate-400 text-xs sm:text-sm">Nenhuma conversa ainda</div>
              ) : chats.slice(0, 6).map(chat => (
                <div key={chat.id} className="p-2.5 sm:p-3 lg:p-4 flex items-center gap-2 sm:gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <img src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} className="size-8 sm:size-10 rounded-full border border-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{chat.client_name}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">{chat.last_message || 'Sem mensagens'}</p>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">{chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
          </>
        )}

        {/* Conteúdo da Aba de Conta Meta Ads */}
        {activeTab.startsWith('meta_') && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header com filtro de período */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none">
                  {metaAdsAccounts.find(a => a.account_id === selectedMetaAccountId)?.account_name || 'Campanhas'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">Performance Meta Ads</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                {(['today', '7d', '30d', '90d'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => setCampaignPeriod(period)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
                      campaignPeriod === period
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {period === 'today' ? 'Hoje' : period === '7d' ? '7d' : period === '30d' ? '30d' : '90d'}
                  </button>
                ))}
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  <input
                    type="date"
                    value={customDateRange?.start || ''}
                    onChange={(e) => {
                      const start = e.target.value;
                      setCustomDateRange(prev => ({ start, end: prev?.end || start }));
                      setCampaignPeriod('custom');
                    }}
                    className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input
                    type="date"
                    value={customDateRange?.end || ''}
                    onChange={(e) => {
                      const end = e.target.value;
                      setCustomDateRange(prev => ({ start: prev?.start || end, end }));
                      setCampaignPeriod('custom');
                    }}
                    className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {loadingCampaigns ? (
              <div className="flex items-center justify-center py-12 sm:py-20">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-cyan-600"></div>
              </div>
            ) : campaignStats ? (
              <>
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white relative group">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <div>
                        <p className="text-pink-100 text-[9px] sm:text-xs font-medium uppercase tracking-wider">Meta Ads</p>
                        <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">
                          {campaignStats.leadsByPlatform.find(p => p.name === 'Meta Ads')?.value || 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="relative hidden sm:block">
                          <span className="material-symbols-outlined text-white/60 text-base cursor-help hover:text-white transition-colors">info</span>
                          <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <p className="font-semibold mb-1">Meta Ads</p>
                            <p className="text-slate-300">Leads de anúncios Meta (Click to WhatsApp + campanhas AV, KR, ACV, etc.)</p>
                          </div>
                        </div>
                        <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
                          <span className="material-symbols-outlined text-base sm:text-xl">ads_click</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-pink-100 text-[9px] sm:text-xs hidden sm:block">Anúncios + campanhas</p>
                  </div>

                  <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white relative group">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <div>
                        <p className="text-fuchsia-100 text-[9px] sm:text-xs font-medium uppercase tracking-wider">Instagram</p>
                        <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">
                          {campaignStats.leadsByPlatform.find(p => p.name === 'Instagram')?.value || 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="relative hidden sm:block">
                          <span className="material-symbols-outlined text-white/60 text-base cursor-help hover:text-white transition-colors">info</span>
                          <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <p className="font-semibold mb-1">Instagram</p>
                            <p className="text-slate-300">Leads que vieram do Instagram (link no bio/stories).</p>
                          </div>
                        </div>
                        <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
                          <span className="material-symbols-outlined text-base sm:text-xl">photo_camera</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-fuchsia-100 text-[9px] sm:text-xs hidden sm:block">Links do Instagram</p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white relative group">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <div>
                        <p className="text-indigo-100 text-[9px] sm:text-xs font-medium uppercase tracking-wider truncate">Outras</p>
                        <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">
                          {campaignStats.leadsByPlatform.find(p => p.name === 'Outras Origens')?.value || 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="relative hidden sm:block">
                          <span className="material-symbols-outlined text-white/60 text-base cursor-help hover:text-white transition-colors">info</span>
                          <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <p className="font-semibold mb-1">Outras Origens</p>
                            <p className="text-slate-300">Leads com origem identificada (Indicação, Recorrência, etc.)</p>
                          </div>
                        </div>
                        <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
                          <span className="material-symbols-outlined text-base sm:text-xl">tag</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-indigo-100 text-[9px] sm:text-xs hidden sm:block">Origens diversas</p>
                  </div>

                  <div className="bg-gradient-to-br from-slate-500 to-slate-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white relative group">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <div>
                        <p className="text-slate-300 text-[9px] sm:text-xs font-medium uppercase tracking-wider">Orgânico</p>
                        <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">
                          {campaignStats.leadsByPlatform.find(p => p.name === 'Orgânico')?.value || 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="relative hidden sm:block">
                          <span className="material-symbols-outlined text-white/60 text-base cursor-help hover:text-white transition-colors">info</span>
                          <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <p className="font-semibold mb-1">Leads Orgânicos</p>
                            <p className="text-slate-300">Leads que chegaram sem identificação de origem. Podem ser indicações, busca orgânica, ou leads que não foram rastreados.</p>
                          </div>
                        </div>
                        <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
                          <span className="material-symbols-outlined text-base sm:text-xl">nature</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[9px] sm:text-xs hidden sm:block">Sem origem identificada</p>
                  </div>
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
                  {/* Gráfico de Linha - Leads por Dia */}
                  <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Leads por Dia</h3>
                    {campaignStats.leadsByDay.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180} className="sm:!h-[250px]">
                        <AreaChart data={campaignStats.leadsByDay}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" width={30} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Area type="monotone" dataKey="leads" name="Total" stroke="#0891b2" fill="#0891b2" fillOpacity={0.2} />
                          <Area type="monotone" dataKey="campanhas" name="Campanhas" stroke="#E1306C" fill="#E1306C" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[150px] sm:h-[250px] flex items-center justify-center text-slate-400 text-xs sm:text-sm">
                        Sem dados no período
                      </div>
                    )}
                  </div>

                  {/* Gráfico de Pizza - Distribuição por Plataforma */}
                  <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Distribuição por Origem</h3>
                    {campaignStats.leadsByPlatform.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180} className="sm:!h-[250px]">
                        <PieChart>
                          <Pie
                            data={campaignStats.leadsByPlatform}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {campaignStats.leadsByPlatform.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[150px] sm:h-[250px] flex items-center justify-center text-slate-400 text-xs sm:text-sm">
                        Sem dados no período
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabela de Anúncios Meta - Leads por Anúncio */}
                {campaignStats.metaAds.length > 0 && (
                  <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                      <span className="material-symbols-outlined text-pink-600 text-base sm:text-xl">ads_click</span>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">Top Anúncios Meta</h3>
                      <span className="text-[10px] sm:text-xs bg-pink-100 text-pink-700 px-1.5 sm:px-2 py-0.5 rounded-full ml-auto">{campaignStats.metaAds.reduce((sum, ad) => sum + ad.count, 0)} leads</span>
                    </div>
                    
                    {/* Versão Mobile - Cards */}
                    <div className="sm:hidden space-y-2">
                      {campaignStats.metaAds.slice(0, 5).map((ad, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <a 
                              href={`/lead/${ad.chat_id}`}
                              className="font-medium text-indigo-600 text-xs truncate max-w-[120px]"
                            >
                              {ad.client_name || 'Cliente'}
                            </a>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => fetchChatMessages(ad.chat_id, ad.client_name || 'Lead')}
                                className="p-1 hover:bg-cyan-50 rounded text-cyan-600"
                                title="Ver conversa"
                              >
                                <span className="material-symbols-outlined text-sm">forum</span>
                              </button>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                {ad.source_code || '-'}
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-600 truncate">{ad.ad_name || ad.ad_title}</p>
                          <p className="text-[10px] text-slate-400">{ad.created_at ? new Date(ad.created_at).toLocaleDateString('pt-BR') : '-'}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Versão Desktop - Tabela */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Anúncio</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Campanha</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {campaignStats.metaAds.map((ad, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <a 
                                  href={`/lead/${ad.chat_id}`}
                                  className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                                >
                                  {ad.client_name || 'Cliente'}
                                </a>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                                  {ad.source_code || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-800">{ad.ad_name || ad.ad_title}</span>
                                  {ad.ad_name && ad.ad_title !== ad.ad_name && (
                                    <span className="text-xs text-slate-400 truncate max-w-[200px]">{ad.ad_title}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col">
                                  <span className="text-sm text-slate-600">{ad.campaign_name || '-'}</span>
                                  {ad.adset_name && (
                                    <span className="text-xs text-slate-400">{ad.adset_name}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-slate-600">
                                  {ad.created_at ? new Date(ad.created_at).toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => fetchChatMessages(ad.chat_id, ad.client_name || 'Lead')}
                                  className="p-1.5 hover:bg-cyan-50 rounded text-cyan-600"
                                  title="Ver conversa"
                                >
                                  <span className="material-symbols-outlined text-lg">forum</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Dados da Meta Ads API */}
                {metaAdsConfigured && (
                  <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-pink-600 text-base sm:text-xl">analytics</span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">Meta Ads Manager</h3>
                      </div>
                      {loadingMetaAdsApi && (
                        <div className="w-4 h-4 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin"></div>
                      )}
                    </div>
                    
                    {metaAdsApiData ? (
                      <div className="space-y-4 sm:space-y-6">
                        {/* Cards de Métricas Totais */}
                        {metaAdsApiData.insights.length > 0 && (metaAdsVisibility.impressions || metaAdsVisibility.clicks || metaAdsVisibility.ctr || metaAdsVisibility.cpc || metaAdsVisibility.spent) && (
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                            {(() => {
                              const totals = metaAdsApiData.insights.reduce((acc, i) => ({
                                impressions: acc.impressions + parseInt(i.impressions || '0'),
                                clicks: acc.clicks + parseInt(i.clicks || '0'),
                                spend: acc.spend + parseFloat(i.spend || '0'),
                              }), { impressions: 0, clicks: 0, spend: 0 });
                              const ctr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100) : 0;
                              const cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
                              return (
                                <>
                                  {metaAdsVisibility.impressions && (
                                  <div className="p-2 sm:p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl text-white text-center relative group">
                                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 hidden sm:block">
                                      <span className="material-symbols-outlined text-white/50 text-sm cursor-help hover:text-white">info</span>
                                      <div className="absolute right-0 top-5 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Número de vezes que seus anúncios foram exibidos
                                      </div>
                                    </div>
                                    <p className="text-base sm:text-2xl font-black">{totals.impressions.toLocaleString()}</p>
                                    <p className="text-[9px] sm:text-xs text-blue-100 mt-0.5 sm:mt-1">Impressões</p>
                                  </div>
                                  )}
                                  {metaAdsVisibility.clicks && (
                                  <div className="p-2 sm:p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl text-white text-center relative group">
                                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 hidden sm:block">
                                      <span className="material-symbols-outlined text-white/50 text-sm cursor-help hover:text-white">info</span>
                                      <div className="absolute right-0 top-5 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Número de cliques nos seus anúncios
                                      </div>
                                    </div>
                                    <p className="text-base sm:text-2xl font-black">{totals.clicks.toLocaleString()}</p>
                                    <p className="text-[9px] sm:text-xs text-green-100 mt-0.5 sm:mt-1">Cliques</p>
                                  </div>
                                  )}
                                  {metaAdsVisibility.ctr && (
                                  <div className="p-2 sm:p-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg sm:rounded-xl text-white text-center relative group">
                                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 hidden sm:block">
                                      <span className="material-symbols-outlined text-white/50 text-sm cursor-help hover:text-white">info</span>
                                      <div className="absolute right-0 top-5 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Taxa de cliques: Cliques ÷ Impressões × 100
                                      </div>
                                    </div>
                                    <p className="text-base sm:text-2xl font-black">{ctr.toFixed(2)}%</p>
                                    <p className="text-[9px] sm:text-xs text-amber-100 mt-0.5 sm:mt-1">CTR</p>
                                  </div>
                                  )}
                                  {metaAdsVisibility.cpc && (
                                  <div className="p-2 sm:p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl text-white text-center relative group hidden sm:block">
                                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                                      <span className="material-symbols-outlined text-white/50 text-sm cursor-help hover:text-white">info</span>
                                      <div className="absolute right-0 top-5 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Custo por clique médio: Gasto ÷ Cliques
                                      </div>
                                    </div>
                                    <p className="text-base sm:text-2xl font-black">R$ {cpc.toFixed(2)}</p>
                                    <p className="text-[9px] sm:text-xs text-purple-100 mt-0.5 sm:mt-1">CPC</p>
                                  </div>
                                  )}
                                  {metaAdsVisibility.spent && (
                                  <div className="p-2 sm:p-4 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg sm:rounded-xl text-white text-center relative group hidden sm:block">
                                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                                      <span className="material-symbols-outlined text-white/50 text-sm cursor-help hover:text-white">info</span>
                                      <div className="absolute right-0 top-5 w-48 bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        Valor total investido em anúncios
                                      </div>
                                    </div>
                                    <p className="text-base sm:text-2xl font-black">R$ {totals.spend.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    <p className="text-[9px] sm:text-xs text-pink-100 mt-0.5 sm:mt-1">Investido</p>
                                  </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Tabela de Performance por Campanha */}
                        {metaAdsVisibility.campaign_performance && metaAdsApiData.campaignInsights && metaAdsApiData.campaignInsights.length > 0 && (
                          <div className="rounded-xl border border-purple-200 overflow-hidden">
                            <button 
                              onClick={() => setExpandedCampaignSections(prev => ({ ...prev, performance: !prev.performance }))}
                              className="bg-purple-50 text-purple-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between w-full hover:opacity-90 transition-opacity"
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm sm:text-base">campaign</span>
                                <h4 className="text-xs sm:text-sm font-bold">Performance ({metaAdsApiData.campaignInsights.length})</h4>
                              </div>
                              <span className="material-symbols-outlined text-sm sm:text-base transition-transform" style={{ transform: expandedCampaignSections.performance ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                expand_more
                              </span>
                            </button>
                            {expandedCampaignSections.performance && (
                              <>
                              {/* Versão Mobile - Cards Expansíveis */}
                              <div className="sm:hidden bg-white p-2 space-y-2">
                                {metaAdsApiData.campaignInsights
                                  .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
                                  .map((insight, idx) => {
                                    const impressions = parseInt(insight.impressions || '0');
                                    const clicks = parseInt(insight.clicks || '0');
                                    const spend = parseFloat(insight.spend || '0');
                                    const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;
                                    const cpc = clicks > 0 ? (spend / clicks) : 0;
                                    const campaignId = insight.campaign_id || `campaign-${idx}`;
                                    const isExpanded = expandedCampaigns.has(campaignId);
                                    
                                    return (
                                      <div 
                                        key={campaignId}
                                        className={`rounded-lg border transition-all ${isExpanded ? 'border-purple-300 bg-purple-50/50' : 'border-slate-200 bg-slate-50'}`}
                                      >
                                        <div 
                                          className="flex items-center justify-between p-2.5 cursor-pointer"
                                          onClick={() => {
                                            setExpandedCampaigns(prev => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(campaignId)) {
                                                newSet.delete(campaignId);
                                              } else {
                                                newSet.add(campaignId);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        >
                                          <span className="font-medium text-slate-800 text-xs truncate flex-1 mr-2">{insight.campaign_name}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-pink-600 text-xs">R$ {spend.toFixed(0)}</span>
                                            <span className="material-symbols-outlined text-slate-400 text-[14px]">
                                              {isExpanded ? 'expand_less' : 'expand_more'}
                                            </span>
                                          </div>
                                        </div>
                                        {isExpanded && (
                                          <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-100">
                                            <div className="grid grid-cols-4 gap-1.5 text-center">
                                              <div>
                                                <p className="text-[8px] text-slate-400 uppercase">Impr.</p>
                                                <p className="text-[10px] font-bold text-slate-700">{impressions.toLocaleString()}</p>
                                              </div>
                                              <div>
                                                <p className="text-[8px] text-slate-400 uppercase">Cliques</p>
                                                <p className="text-[10px] font-bold text-green-600">{clicks.toLocaleString()}</p>
                                              </div>
                                              <div>
                                                <p className="text-[8px] text-slate-400 uppercase">CTR</p>
                                                <p className={`text-[10px] font-bold ${ctr >= 2 ? 'text-green-600' : ctr >= 1 ? 'text-amber-600' : 'text-red-500'}`}>{ctr.toFixed(2)}%</p>
                                              </div>
                                              <div>
                                                <p className="text-[8px] text-slate-400 uppercase">CPC</p>
                                                <p className="text-[10px] font-bold text-purple-600">R$ {cpc.toFixed(2)}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                              
                              {/* Versão Desktop - Tabela */}
                              <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-white">
                                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Campanha</th>
                                      {metaAdsVisibility.impressions && <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Impressões</th>}
                                      {metaAdsVisibility.clicks && <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Cliques</th>}
                                      {metaAdsVisibility.ctr && <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">CTR</th>}
                                      {metaAdsVisibility.cpc && <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">CPC</th>}
                                      {metaAdsVisibility.spent && <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Gasto</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {metaAdsApiData.campaignInsights
                                      .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
                                      .map((insight, idx) => {
                                        const impressions = parseInt(insight.impressions || '0');
                                        const clicks = parseInt(insight.clicks || '0');
                                        const spend = parseFloat(insight.spend || '0');
                                        const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;
                                        const cpc = clicks > 0 ? (spend / clicks) : 0;
                                        const campaignId = insight.campaign_id || `campaign-${idx}`;
                                        const isExpanded = expandedCampaigns.has(campaignId);
                                        const campaignAdsets = metaAdsApiData.adsets?.filter(a => a.campaign_id === campaignId) || [];
                                        const hasAdsets = campaignAdsets.length > 0;
                                        
                                        return (
                                          <React.Fragment key={campaignId}>
                                            <tr 
                                              className={`hover:bg-slate-50 transition-colors ${hasAdsets ? 'cursor-pointer' : ''}`}
                                              onClick={() => {
                                                if (hasAdsets) {
                                                  setExpandedCampaigns(prev => {
                                                    const newSet = new Set(prev);
                                                    if (newSet.has(campaignId)) {
                                                      newSet.delete(campaignId);
                                                    } else {
                                                      newSet.add(campaignId);
                                                    }
                                                    return newSet;
                                                  });
                                                }
                                              }}
                                            >
                                              <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                  {hasAdsets && (
                                                    <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                      chevron_right
                                                    </span>
                                                  )}
                                                  <span className="font-medium text-slate-800 text-sm">{insight.campaign_name}</span>
                                                  {hasAdsets && (
                                                    <span className="text-xs text-slate-400">({campaignAdsets.length} conjuntos)</span>
                                                  )}
                                                </div>
                                              </td>
                                              {metaAdsVisibility.impressions && (
                                              <td className="py-3 px-4 text-right">
                                                <span className="text-sm text-slate-600">{impressions.toLocaleString()}</span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.clicks && (
                                              <td className="py-3 px-4 text-right">
                                                <span className="text-sm font-semibold text-green-600">{clicks.toLocaleString()}</span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.ctr && (
                                              <td className="py-3 px-4 text-right">
                                                <span className={`text-sm font-semibold ${ctr >= 2 ? 'text-green-600' : ctr >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                                                  {ctr.toFixed(2)}%
                                                </span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.cpc && (
                                              <td className="py-3 px-4 text-right">
                                                <span className="text-sm text-purple-600">R$ {cpc.toFixed(2)}</span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.spent && (
                                              <td className="py-3 px-4 text-right">
                                                <span className="text-sm font-bold text-pink-600">R$ {spend.toFixed(2)}</span>
                                              </td>
                                              )}
                                            </tr>
                                            {/* Conjuntos de Anúncios (Ad Sets) */}
                                            {isExpanded && campaignAdsets.map((adset) => {
                                              const adsetInsight = metaAdsApiData.adsetInsights?.find(i => i.adset_id === adset.id);
                                              const adsetImpressions = parseInt(adsetInsight?.impressions || '0');
                                              const adsetClicks = parseInt(adsetInsight?.clicks || '0');
                                              const adsetSpend = parseFloat(adsetInsight?.spend || '0');
                                              const adsetCtr = adsetImpressions > 0 ? ((adsetClicks / adsetImpressions) * 100) : 0;
                                              const adsetCpc = adsetClicks > 0 ? (adsetSpend / adsetClicks) : 0;
                                              const destinationType = adset.destination_type === 'WHATSAPP' ? 'WhatsApp' : 
                                                                     adset.destination_type === 'MESSENGER' ? 'Messenger' : 
                                                                     adset.destination_type === 'WEBSITE' ? 'Site' : 
                                                                     adset.destination_type || '';
                                              
                                              return (
                                                <tr key={adset.id} className="bg-purple-50/50 border-l-2 border-purple-300">
                                                  <td className="py-2 px-4 pl-10">
                                                    <div className="flex items-center gap-2">
                                                      <span className="material-symbols-outlined text-xs text-purple-400">subdirectory_arrow_right</span>
                                                      <div className="flex flex-col">
                                                        <span className="text-sm text-purple-700 font-medium">{adset.name}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                          <span className={`text-xs px-1.5 py-0.5 rounded ${adset.effective_status === 'ACTIVE' || adset.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {adset.effective_status === 'ACTIVE' || adset.status === 'ACTIVE' ? 'Ativo' : adset.status === 'PAUSED' ? 'Pausado' : adset.effective_status || adset.status}
                                                          </span>
                                                          {destinationType && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                                              {destinationType}
                                                            </span>
                                                          )}
                                                          {adset.daily_budget && (
                                                            <span className="text-xs text-slate-500">R$ {(parseInt(adset.daily_budget) / 100).toFixed(2)}/dia</span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  {metaAdsVisibility.impressions && (
                                                  <td className="py-2 px-4 text-right">
                                                    <span className="text-xs text-slate-600">{adsetImpressions > 0 ? adsetImpressions.toLocaleString() : '-'}</span>
                                                  </td>
                                                  )}
                                                  {metaAdsVisibility.clicks && (
                                                  <td className="py-2 px-4 text-right">
                                                    <span className="text-xs font-semibold text-green-600">{adsetClicks > 0 ? adsetClicks.toLocaleString() : '-'}</span>
                                                  </td>
                                                  )}
                                                  {metaAdsVisibility.ctr && (
                                                  <td className="py-2 px-4 text-right">
                                                    <span className={`text-xs font-semibold ${adsetCtr >= 2 ? 'text-green-600' : adsetCtr >= 1 ? 'text-amber-600' : adsetCtr > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                      {adsetCtr > 0 ? `${adsetCtr.toFixed(2)}%` : '-'}
                                                    </span>
                                                  </td>
                                                  )}
                                                  {metaAdsVisibility.cpc && (
                                                  <td className="py-2 px-4 text-right">
                                                    <span className="text-xs text-purple-600">{adsetCpc > 0 ? `R$ ${adsetCpc.toFixed(2)}` : '-'}</span>
                                                  </td>
                                                  )}
                                                  {metaAdsVisibility.spent && (
                                                  <td className="py-2 px-4 text-right">
                                                    <span className="text-xs font-bold text-pink-600">{adsetSpend > 0 ? `R$ ${adsetSpend.toFixed(2)}` : '-'}</span>
                                                  </td>
                                                  )}
                                                </tr>
                                              );
                                            })}
                                          </React.Fragment>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Campanhas Ativas com Métricas */}
                        {(() => {
                          const activeCampaigns = metaAdsApiData.campaigns.filter(c => c.status === 'ACTIVE');
                          const pausedCampaigns = metaAdsApiData.campaigns.filter(c => c.status === 'PAUSED');
                          const otherCampaigns = metaAdsApiData.campaigns.filter(c => c.status !== 'ACTIVE' && c.status !== 'PAUSED');
                          
                          // Função para obter métricas de uma campanha
                          const getCampaignMetrics = (campaignId: string) => {
                            const insight = metaAdsApiData.campaignInsights?.find(i => i.campaign_id === campaignId);
                            if (!insight) return null;
                            const impressions = parseInt(insight.impressions || '0');
                            const clicks = parseInt(insight.clicks || '0');
                            const spend = parseFloat(insight.spend || '0');
                            const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;
                            const cpc = clicks > 0 ? (spend / clicks) : 0;
                            return { impressions, clicks, spend, ctr, cpc };
                          };
                          
                          // Ordenar campanhas por gasto
                          const sortBySpend = (a: any, b: any) => {
                            const metricsA = getCampaignMetrics(a.id);
                            const metricsB = getCampaignMetrics(b.id);
                            return (metricsB?.spend || 0) - (metricsA?.spend || 0);
                          };
                          
                          const renderCampaignTable = (campaigns: typeof activeCampaigns, title: string, icon: string, bgColor: string, borderColor: string, sectionKey: 'active' | 'paused' | 'other') => {
                            const isExpanded = expandedCampaignSections[sectionKey];
                            return campaigns.length > 0 && (
                              <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
                                <button 
                                  onClick={() => setExpandedCampaignSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                                  className={`${bgColor} px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between w-full hover:opacity-90 transition-opacity`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm sm:text-base">{icon}</span>
                                    <h4 className="text-xs sm:text-sm font-bold">{title} ({campaigns.length})</h4>
                                  </div>
                                  <span className="material-symbols-outlined text-sm sm:text-base transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    expand_more
                                  </span>
                                </button>
                                {isExpanded && (
                                  <>
                                  {/* Versão Mobile - Cards */}
                                  <div className="sm:hidden bg-white p-2 space-y-2">
                                    {campaigns.sort(sortBySpend).map(campaign => {
                                      const metrics = getCampaignMetrics(campaign.id);
                                      return (
                                        <div key={campaign.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-medium text-slate-800 text-xs truncate flex-1 mr-2">{campaign.name}</span>
                                            <span className="font-bold text-pink-600 text-xs">R$ {metrics?.spend?.toFixed(0) || '0'}</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px]">
                                            <span className="text-green-600 font-medium">{metrics?.clicks?.toLocaleString() || '0'} cliques</span>
                                            <span className={`font-medium ${(metrics?.ctr || 0) >= 2 ? 'text-green-600' : (metrics?.ctr || 0) >= 1 ? 'text-amber-600' : 'text-slate-500'}`}>
                                              CTR {metrics?.ctr?.toFixed(1) || '0'}%
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Versão Desktop - Tabela */}
                                  <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-slate-200 bg-white">
                                          <th className="text-left py-2 px-4 text-xs font-bold text-slate-500 uppercase">Campanha</th>
                                          {metaAdsVisibility.clicks && <th className="text-right py-2 px-4 text-xs font-bold text-slate-500 uppercase">Cliques</th>}
                                          {metaAdsVisibility.ctr && <th className="text-right py-2 px-4 text-xs font-bold text-slate-500 uppercase">CTR</th>}
                                          {metaAdsVisibility.cpc && <th className="text-right py-2 px-4 text-xs font-bold text-slate-500 uppercase">CPC</th>}
                                          {metaAdsVisibility.spent && <th className="text-right py-2 px-4 text-xs font-bold text-slate-500 uppercase">Gasto</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {campaigns.sort(sortBySpend).map(campaign => {
                                          const metrics = getCampaignMetrics(campaign.id);
                                          return (
                                            <tr key={campaign.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-2.5 px-4">
                                                <span className="font-medium text-slate-800 text-sm">{campaign.name}</span>
                                              </td>
                                              {metaAdsVisibility.clicks && (
                                              <td className="py-2.5 px-4 text-right">
                                                <span className="text-sm font-semibold text-green-600">
                                                  {metrics?.clicks?.toLocaleString() || '-'}
                                                </span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.ctr && (
                                              <td className="py-2.5 px-4 text-right">
                                                <span className={`text-sm font-semibold ${
                                                  (metrics?.ctr || 0) >= 2 ? 'text-green-600' : 
                                                  (metrics?.ctr || 0) >= 1 ? 'text-amber-600' : 
                                                  'text-red-500'
                                                }`}>
                                                  {metrics?.ctr?.toFixed(2) || '0.00'}%
                                                </span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.cpc && (
                                              <td className="py-2.5 px-4 text-right">
                                                <span className="text-sm text-purple-600">
                                                  R$ {metrics?.cpc?.toFixed(2) || '0.00'}
                                                </span>
                                              </td>
                                              )}
                                              {metaAdsVisibility.spent && (
                                              <td className="py-2.5 px-4 text-right">
                                                <span className="text-sm font-bold text-pink-600">
                                                  R$ {metrics?.spend?.toFixed(2) || '0.00'}
                                                </span>
                                              </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  </>
                                )}
                              </div>
                            );
                          };
                          
                          return (
                            <div className="space-y-4">
                              {metaAdsVisibility.active_campaigns && renderCampaignTable(activeCampaigns, 'Campanhas Ativas', 'play_circle', 'bg-green-50 text-green-700', 'border-green-200', 'active')}
                              {metaAdsVisibility.paused_campaigns && renderCampaignTable(pausedCampaigns, 'Campanhas Pausadas', 'pause_circle', 'bg-slate-100 text-slate-600', 'border-slate-200', 'paused')}
                              {renderCampaignTable(otherCampaigns, 'Outras Campanhas', 'help', 'bg-amber-50 text-amber-700', 'border-amber-200', 'other')}
                            </div>
                          );
                        })()}
                        
                        {metaAdsApiData.campaigns.length === 0 && metaAdsApiData.ads.length === 0 && (
                          <p className="text-sm text-slate-500 text-center py-4">Nenhum dado retornado da API</p>
                        )}
                      </div>
                    ) : loadingMetaAdsApi ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Carregando dados...</p>
                    )}
                  </div>
                )}

                {/* Card de Comparação: Meta Ads vs Origens do Sistema */}
                <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="material-symbols-outlined text-cyan-600 text-base sm:text-xl">compare</span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">Comparativo</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
                    {/* Tabela Meta Ads - Campanhas */}
                    <div className="rounded-xl border border-purple-200 overflow-hidden">
                      <div className="bg-purple-50 text-purple-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm sm:text-base">campaign</span>
                        <h4 className="text-xs sm:text-sm font-bold">Meta Ads</h4>
                        <span className="text-[10px] sm:text-xs bg-purple-200 px-1.5 sm:px-2 py-0.5 rounded-full ml-auto">
                          {metaAdsApiData?.campaignInsights?.length || 0}
                        </span>
                      </div>
                      {/* Versão Mobile - Cards */}
                      <div className="sm:hidden bg-white p-2 space-y-1.5 max-h-48 overflow-y-auto">
                        {metaAdsApiData?.campaignInsights?.sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0')).slice(0, 5).map((insight, idx) => (
                          <div key={insight.campaign_id || idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-[10px] text-slate-800 truncate flex-1 mr-2">{insight.campaign_name}</span>
                            <span className="text-[10px] font-bold text-pink-600">R$ {parseFloat(insight.spend || '0').toFixed(0)}</span>
                          </div>
                        )) || (
                          <p className="text-[10px] text-slate-400 text-center py-2">Sem dados</p>
                        )}
                      </div>
                      {/* Versão Desktop - Tabela */}
                      <div className="hidden sm:block overflow-x-auto max-h-80">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Campanha</th>
                              <th className="text-right py-2 px-3 text-xs font-bold text-slate-500 uppercase">Cliques</th>
                              <th className="text-right py-2 px-3 text-xs font-bold text-slate-500 uppercase">Gasto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metaAdsApiData?.campaignInsights?.sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0')).slice(0, 10).map((insight, idx) => (
                              <tr key={insight.campaign_id || idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-sm text-slate-800 truncate max-w-[150px]" title={insight.campaign_name}>
                                  {insight.campaign_name}
                                </td>
                                <td className="py-2 px-3 text-right text-sm font-semibold text-green-600">
                                  {parseInt(insight.clicks || '0').toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right text-sm font-bold text-pink-600">
                                  R$ {parseFloat(insight.spend || '0').toFixed(2)}
                                </td>
                              </tr>
                            )) || (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-sm text-slate-400">
                                  Sem dados do Meta Ads
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tabela Origens do Sistema */}
                    <div className="rounded-xl border border-cyan-200 overflow-hidden">
                      <div className="bg-cyan-50 text-cyan-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm sm:text-base">group</span>
                        <h4 className="text-xs sm:text-sm font-bold">Origens</h4>
                        <span className="text-[10px] sm:text-xs bg-cyan-200 px-1.5 sm:px-2 py-0.5 rounded-full ml-auto">
                          {campaignStats.sourceStats?.length || 0}
                        </span>
                      </div>
                      {/* Versão Mobile - Cards */}
                      <div className="sm:hidden bg-white p-2 space-y-1.5 max-h-48 overflow-y-auto">
                        {campaignStats.sourceStats?.slice(0, 5).map(source => {
                          const rate = source.total_leads > 0 ? ((source.converted_leads / source.total_leads) * 100).toFixed(0) : '0';
                          return (
                            <div key={source.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }}></span>
                                <span className="text-[10px] text-slate-800 truncate">{source.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-700">{source.total_leads}</span>
                                <span className={`text-[10px] font-bold ${Number(rate) >= 30 ? 'text-green-600' : Number(rate) >= 15 ? 'text-amber-600' : 'text-slate-400'}`}>{rate}%</span>
                              </div>
                            </div>
                          );
                        }) || (
                          <p className="text-[10px] text-slate-400 text-center py-2">Sem dados</p>
                        )}
                      </div>
                      {/* Versão Desktop - Tabela */}
                      <div className="hidden sm:block overflow-x-auto max-h-80">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase">Origem</th>
                              <th className="text-right py-2 px-3 text-xs font-bold text-slate-500 uppercase">Leads</th>
                              <th className="text-right py-2 px-3 text-xs font-bold text-slate-500 uppercase">Taxa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {campaignStats.sourceStats?.slice(0, 10).map(source => {
                              const rate = source.total_leads > 0 ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={source.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: source.color }}></span>
                                      <span className="text-sm text-slate-800 truncate max-w-[120px]" title={source.name}>
                                        {source.name}
                                      </span>
                                      {source.code && (
                                        <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{source.code}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right text-sm font-bold text-slate-800">{source.total_leads}</td>
                                  <td className="py-2 px-3 text-right">
                                    <span className={`text-sm font-bold ${Number(rate) >= 30 ? 'text-green-600' : Number(rate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                                      {rate}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            }) || (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-sm text-slate-400">
                                  Sem dados de origens
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">campaign</span>
                <p>Nenhum dado de campanha encontrado</p>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da Aba Tarefas */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header com filtros */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-slate-900">Tarefas</h2>
                <p className="text-xs sm:text-sm text-slate-500">Gerencie suas tarefas</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="flex gap-0.5 sm:gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-lg w-full sm:w-auto">
                  <button
                    onClick={() => setTasksFilter('pending')}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${tasksFilter === 'pending' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Pendentes
                  </button>
                  <button
                    onClick={() => setTasksFilter('completed')}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${tasksFilter === 'completed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Concluídas
                  </button>
                  <button
                    onClick={() => setTasksFilter('all')}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${tasksFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    Todas
                  </button>
                </div>
              </div>
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center py-12 sm:py-20">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-cyan-600"></div>
              </div>
            ) : (
              <>
                {/* Layout de 3 colunas */}
                {tasksFilter === 'pending' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
                    {/* Coluna Atrasadas */}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const overdueTasks = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < today);
                      const todayTasks = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString());
                      const endOfWeek = new Date();
                      endOfWeek.setDate(endOfWeek.getDate() + 7);
                      const weekTasks = tasks.filter(t => {
                        if (t.completed || !t.due_date) return false;
                        const dueDate = new Date(t.due_date);
                        return dueDate > today && dueDate <= endOfWeek && dueDate.toDateString() !== new Date().toDateString();
                      });

                      const renderTaskItem = (task: typeof tasks[0], showDate = true) => (
                        <div key={task.id} className="p-2 sm:p-3 flex items-start gap-2 sm:gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                          <button
                            onClick={async () => {
                              await supabase
                                .from('tasks' as any)
                                .update({ completed: true, completed_at: new Date().toISOString() })
                                .eq('id', task.id);
                              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t));
                            }}
                            className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 hover:border-green-500 flex-shrink-0 transition-colors"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{task.title}</p>
                            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{task.client_name}</p>
                          </div>
                          {showDate && task.due_date && (
                            <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">
                              {parseLocalDate(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <>
                          {/* Atrasadas */}
                          <div className="bg-white rounded-xl sm:rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-red-50 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="material-symbols-outlined text-red-500 text-base sm:text-lg">warning</span>
                                <span className="font-semibold text-red-700 text-xs sm:text-sm">Atrasadas</span>
                              </div>
                              <span className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">{overdueTasks.length}</span>
                            </div>
                            <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                              {overdueTasks.length === 0 ? (
                                <p className="text-center py-4 sm:py-6 text-xs sm:text-sm text-slate-400">Nenhuma atrasada</p>
                              ) : (
                                overdueTasks.map(task => renderTaskItem(task, true))
                              )}
                            </div>
                          </div>

                          {/* Hoje */}
                          <div className="bg-white rounded-xl sm:rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-amber-50 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="material-symbols-outlined text-amber-500 text-base sm:text-lg">today</span>
                                <span className="font-semibold text-amber-700 text-xs sm:text-sm">Hoje</span>
                              </div>
                              <span className="bg-amber-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">{todayTasks.length}</span>
                            </div>
                            <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                              {todayTasks.length === 0 ? (
                                <p className="text-center py-4 sm:py-6 text-xs sm:text-sm text-slate-400">Nenhuma para hoje</p>
                              ) : (
                                todayTasks.map(task => renderTaskItem(task, false))
                              )}
                            </div>
                          </div>

                          {/* Esta Semana */}
                          <div className="bg-white rounded-xl sm:rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
                            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="material-symbols-outlined text-blue-500 text-base sm:text-lg">date_range</span>
                                <span className="font-semibold text-blue-700 text-xs sm:text-sm">Esta Semana</span>
                              </div>
                              <span className="bg-blue-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">{weekTasks.length}</span>
                            </div>
                            <div className="max-h-60 sm:max-h-80 overflow-y-auto">
                              {weekTasks.length === 0 ? (
                                <p className="text-center py-4 sm:py-6 text-xs sm:text-sm text-slate-400">Nenhuma esta semana</p>
                              ) : (
                                weekTasks.map(task => {
                                  const dueDate = new Date(task.due_date!);
                                  const dayName = dueDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                                  const dayNum = dueDate.toLocaleDateString('pt-BR', { day: '2-digit' });
                                  return (
                                    <div key={task.id} className="p-2 sm:p-3 flex items-start gap-2 sm:gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                                      <button
                                        onClick={async () => {
                                          await supabase
                                            .from('tasks' as any)
                                            .update({ completed: true, completed_at: new Date().toISOString() })
                                            .eq('id', task.id);
                                          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t));
                                        }}
                                        className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 hover:border-green-500 flex-shrink-0 transition-colors"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{task.title}</p>
                                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{task.client_name}</p>
                                      </div>
                                      <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">{dayName}, {dayNum}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Lista de tarefas concluídas */}
                {tasksFilter === 'completed' && (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-green-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="material-symbols-outlined text-green-500 text-base sm:text-lg">check_circle</span>
                        <span className="font-semibold text-green-700 text-xs sm:text-sm">Concluídas</span>
                      </div>
                      <span className="bg-green-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">{tasks.filter(t => t.completed).length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                      {tasks.filter(t => t.completed).length === 0 ? (
                        <p className="text-center py-4 sm:py-6 text-xs sm:text-sm text-slate-400">Nenhuma concluída</p>
                      ) : (
                        tasks.filter(t => t.completed).map(task => (
                          <div key={task.id} className="p-2 sm:p-3 flex items-start gap-2 sm:gap-3 hover:bg-slate-50 transition-colors opacity-60">
                            <button
                              onClick={async () => {
                                await supabase
                                  .from('tasks' as any)
                                  .update({ completed: false, completed_at: null })
                                  .eq('id', task.id);
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: false, completed_at: null } : t));
                              }}
                              className="mt-0.5 w-4 h-4 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center flex-shrink-0"
                            >
                              <span className="material-symbols-outlined text-white text-xs">check</span>
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-slate-800 line-through truncate">{task.title}</p>
                              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{task.client_name}</p>
                            </div>
                            {task.completed_at && (
                              <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">
                                {new Date(task.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Lista de todas as tarefas */}
                {tasksFilter === 'all' && (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="material-symbols-outlined text-slate-500 text-base sm:text-lg">list</span>
                        <span className="font-semibold text-slate-700 text-xs sm:text-sm">Todas</span>
                      </div>
                      <span className="bg-slate-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">{tasks.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                      {tasks.length === 0 ? (
                        <p className="text-center py-4 sm:py-6 text-xs sm:text-sm text-slate-400">Nenhuma tarefa</p>
                      ) : (
                        tasks.map(task => {
                          const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
                          const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                          return (
                            <div key={task.id} className={`p-2 sm:p-3 flex items-start gap-2 sm:gap-3 hover:bg-slate-50 transition-colors ${task.completed ? 'opacity-60' : ''}`}>
                              <button
                                onClick={async () => {
                                  const newCompleted = !task.completed;
                                  await supabase
                                    .from('tasks' as any)
                                    .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
                                    .eq('id', task.id);
                                  setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : t));
                                }}
                                className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  task.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-500'
                                }`}
                              >
                                {task.completed && <span className="material-symbols-outlined text-white text-xs">check</span>}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs sm:text-sm font-medium text-slate-800 truncate ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{task.client_name}</p>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                {task.completed && (
                                  <span className="text-[9px] sm:text-xs bg-green-100 text-green-600 px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline">Concluída</span>
                                )}
                                {isOverdue && !task.completed && (
                                  <span className="text-[9px] sm:text-xs bg-red-100 text-red-600 px-1.5 sm:px-2 py-0.5 rounded-full">Atrasada</span>
                                )}
                                {isToday && !task.completed && (
                                  <span className="text-[9px] sm:text-xs bg-amber-100 text-amber-600 px-1.5 sm:px-2 py-0.5 rounded-full">Hoje</span>
                                )}
                                {task.due_date && (
                                  <span className="text-[10px] sm:text-xs text-slate-400">
                                    {parseLocalDate(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Conteúdo da Aba Produtividade */}
        {activeTab === 'productivity' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900">Produtividade</h2>
              <p className="text-xs sm:text-sm text-slate-500">Métricas da equipe</p>
            </div>

            {loadingProductivity ? (
              <div className="flex items-center justify-center py-12 sm:py-20">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-cyan-600"></div>
              </div>
            ) : (
              <>
                {/* Cards de resumo */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white">
                    <p className="text-blue-100 text-[9px] sm:text-xs font-medium uppercase">Leads</p>
                    <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">{productivityData.reduce((acc, p) => acc + p.leads_count, 0)}</p>
                    <p className="text-blue-100 text-[9px] sm:text-xs mt-0.5 sm:mt-1 hidden sm:block">{productivityPeriod === 1 ? 'Hoje' : `Últimos ${productivityPeriod} dias`}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white">
                    <p className="text-green-100 text-[9px] sm:text-xs font-medium uppercase">Conversões</p>
                    <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">{productivityData.reduce((acc, p) => acc + p.conversions, 0)}</p>
                    <p className="text-green-100 text-[9px] sm:text-xs mt-0.5 sm:mt-1 hidden sm:block">{productivityPeriod === 1 ? 'Hoje' : `Últimos ${productivityPeriod} dias`}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white">
                    <p className="text-purple-100 text-[9px] sm:text-xs font-medium uppercase">Mensagens</p>
                    <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">{productivityData.reduce((acc, p) => acc + p.messages_sent, 0).toLocaleString()}</p>
                    <p className="text-purple-100 text-[9px] sm:text-xs mt-0.5 sm:mt-1 hidden sm:block">{productivityPeriod === 1 ? 'Hoje' : `Últimos ${productivityPeriod} dias`}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-white">
                    <p className="text-amber-100 text-[9px] sm:text-xs font-medium uppercase">Chats</p>
                    <p className="text-xl sm:text-3xl font-black mt-0.5 sm:mt-1">{productivityData.reduce((acc, p) => acc + p.chats_active, 0)}</p>
                    <p className="text-amber-100 text-[9px] sm:text-xs mt-0.5 sm:mt-1 hidden sm:block">Em atendimento</p>
                  </div>
                </div>

                {/* Tabela de produtividade por usuário */}
                {isAdmin && productivityData.length > 0 && (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-cyan-600 text-base sm:text-xl">group</span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">Por Comercial</h3>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-lg p-0.5 sm:p-1">
                        {([1, 7, 15, 30] as const).map((days) => (
                          <button
                            key={days}
                            onClick={() => setProductivityPeriod(days)}
                            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors ${
                              productivityPeriod === days
                                ? 'bg-white text-cyan-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {days === 1 ? 'Hoje' : `${days}d`}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Versão Mobile - Cards */}
                    <div className="sm:hidden p-2 space-y-2">
                      {productivityData
                        .sort((a, b) => b.conversions - a.conversions)
                        .map((p, idx) => {
                          const conversionRate = p.leads_count > 0 ? ((p.conversions / p.leads_count) * 100).toFixed(0) : '0';
                          return (
                            <div key={p.user_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  {idx === 0 && <span className="material-symbols-outlined text-amber-500 text-sm">emoji_events</span>}
                                  <span className="font-medium text-slate-800 text-xs truncate max-w-[100px]">{p.user_name}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                  p.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                                  p.role === 'Comercial' ? 'bg-cyan-100 text-cyan-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {p.role}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1 text-center">
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase">Leads</p>
                                  <p className="text-[10px] font-bold text-slate-700">{p.leads_count}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase">Conv.</p>
                                  <p className="text-[10px] font-bold text-green-600">{p.conversions}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase">Taxa</p>
                                  <p className={`text-[10px] font-bold ${Number(conversionRate) >= 30 ? 'text-green-600' : Number(conversionRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>{conversionRate}%</p>
                                </div>
                                <div>
                                  <p className="text-[8px] text-slate-400 uppercase">Msgs</p>
                                  <p className="text-[10px] font-bold text-slate-600">{p.messages_sent}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* Versão Desktop - Tabela */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Comercial</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Cargo</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Leads</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Conversões</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Taxa</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Tempo Resp.</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Msgs Enviadas</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Chats Ativos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {productivityData
                            .sort((a, b) => b.conversions - a.conversions)
                            .map((p, idx) => {
                              const conversionRate = p.leads_count > 0 ? ((p.conversions / p.leads_count) * 100).toFixed(1) : '0.0';
                              const formatResponseTime = (minutes: number) => {
                                if (minutes === 0) return '-';
                                if (minutes < 60) return `${Math.round(minutes)}min`;
                                const hours = Math.floor(minutes / 60);
                                const mins = Math.round(minutes % 60);
                                return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
                              };
                              return (
                                <tr key={p.user_id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      {idx === 0 && <span className="material-symbols-outlined text-amber-500 text-lg">emoji_events</span>}
                                      <span className="font-medium text-slate-800">{p.user_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      p.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                                      p.role === 'Comercial' ? 'bg-cyan-100 text-cyan-700' :
                                      p.role === 'Recepcionista' ? 'bg-pink-100 text-pink-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {p.role}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-slate-800">{p.leads_count}</td>
                                  <td className="py-3 px-4 text-center font-bold text-green-600">{p.conversions}</td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`font-bold ${Number(conversionRate) >= 30 ? 'text-green-600' : Number(conversionRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                                      {conversionRate}%
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`font-medium ${p.avg_response_time <= 15 ? 'text-green-600' : p.avg_response_time <= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                      {formatResponseTime(p.avg_response_time)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center text-slate-600">{p.messages_sent.toLocaleString()}</td>
                                  <td className="py-3 px-4 text-center text-slate-600">{p.chats_active}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Para usuário comum, mostrar apenas seus dados */}
                {(user?.role === 'Comercial' || user?.role === 'Recepcionista' || user?.role === 'Atendente') && (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-6">
                    <h3 className="font-bold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Sua Performance</h3>
                    {productivityData.filter(p => p.user_id === user.id).map(p => {
                      const conversionRate = p.leads_count > 0 ? ((p.conversions / p.leads_count) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={p.user_id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                          <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                            <p className="text-lg sm:text-2xl font-black text-slate-800">{p.leads_count}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Leads</p>
                          </div>
                          <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg sm:rounded-xl">
                            <p className="text-lg sm:text-2xl font-black text-green-600">{p.conversions}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Conversões</p>
                          </div>
                          <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg sm:rounded-xl">
                            <p className="text-lg sm:text-2xl font-black text-purple-600">{conversionRate}%</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Taxa</p>
                          </div>
                          <div className="text-center p-3 sm:p-4 bg-amber-50 rounded-lg sm:rounded-xl">
                            <p className="text-lg sm:text-2xl font-black text-amber-600">{p.messages_sent}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Mensagens</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}


        {/* Conteúdo da Aba Leads */}
        {activeTab === 'leads' && clinicId && (
          <DashboardLeadsTab clinicId={clinicId} />
        )}

        {/* Conteúdo da Aba Gráficos */}
        {activeTab === 'charts' && clinicId && (
          <DashboardChartsTab clinicId={clinicId} />
        )}
      </div>

      {/* Modal de Detalhes do Lead Meta Ads */}
      {selectedMetaAdLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedMetaAdLead(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600">
              <button 
                onClick={() => setSelectedMetaAdLead(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl">person</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedMetaAdLead.client_name}</h3>
                  <p className="text-white/80 text-sm">{selectedMetaAdLead.phone_number}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Origem */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  Origem do Lead
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Código</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">{selectedMetaAdLead.source_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Origem</span>
                    <span className="text-sm font-medium text-indigo-600">Meta Ads (Click to WhatsApp)</span>
                  </div>
                </div>
              </div>

              {/* Dados do Anúncio */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">campaign</span>
                  Dados do Anúncio
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Campanha</span>
                    <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.campaign_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Conjunto</span>
                    <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.adset_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Anúncio</span>
                    <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.ad_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Descrição</span>
                    <span className="text-sm text-slate-600 text-right max-w-[200px] truncate">{selectedMetaAdLead.ad_title}</span>
                  </div>
                </div>
              </div>

              {/* UTM (se disponível) */}
              {(selectedMetaAdLead.utm_source || selectedMetaAdLead.utm_medium || selectedMetaAdLead.utm_campaign) && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">link</span>
                    Parâmetros UTM
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    {selectedMetaAdLead.utm_source && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">utm_source</span>
                        <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.utm_source}</span>
                      </div>
                    )}
                    {selectedMetaAdLead.utm_medium && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">utm_medium</span>
                        <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.utm_medium}</span>
                      </div>
                    )}
                    {selectedMetaAdLead.utm_campaign && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">utm_campaign</span>
                        <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.utm_campaign}</span>
                      </div>
                    )}
                    {selectedMetaAdLead.utm_content && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">utm_content</span>
                        <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.utm_content}</span>
                      </div>
                    )}
                    {selectedMetaAdLead.utm_term && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">utm_term</span>
                        <span className="text-sm font-medium text-slate-800">{selectedMetaAdLead.utm_term}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  Data
                </h4>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Chegou em</span>
                    <span className="text-sm font-medium text-slate-800">
                      {selectedMetaAdLead.created_at ? new Date(selectedMetaAdLead.created_at).toLocaleString('pt-BR') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setSelectedMetaAdLead(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  window.location.href = `/inbox?chat=${selectedMetaAdLead.chat_id}`;
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                Ver Conversa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação para deletar origem */}
      {deleteSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-600 text-2xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Deletar Origem</h3>
                  <p className="text-sm text-slate-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-600">
                  Tem certeza que deseja deletar a origem <strong className="text-slate-800">"{deleteSourceModal.name}"</strong>?
                </p>
                {deleteSourceModal.leadsCount > 0 && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    {deleteSourceModal.leadsCount} lead{deleteSourceModal.leadsCount > 1 ? 's' : ''} vinculado{deleteSourceModal.leadsCount > 1 ? 's' : ''} ficará{deleteSourceModal.leadsCount > 1 ? 'ão' : ''} sem origem.
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setDeleteSourceModal(null)}
                disabled={deletingSource}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSource}
                disabled={deletingSource}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingSource ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Deletando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Deletar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Detalhamento Receita Comercial */}
      <CommercialRevenueModal
        clinicId={clinicId || ''}
        isOpen={showCommercialRevenueDetail}
        onClose={() => setShowCommercialRevenueDetail(false)}
      />

      {/* Modal Detalhamento Receita Clínica */}
      {showClinicRevenueDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowClinicRevenueDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 bg-gradient-to-r from-teal-500 to-teal-600 text-white shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Receita Clínica</h3>
                  <p className="text-teal-100 text-xs mt-0.5">
                    {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} - {clinicRevenueDetails.length} lançamento{clinicRevenueDetails.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">
                    R$ {clinicRevenueDetails.filter(r => r.confirmed_at).reduce((sum, r) => sum + r.total_value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-teal-200 text-[10px]">confirmado</p>
                </div>
              </div>
              {clinicRevenueDetails.some(r => !r.confirmed_at) && (
                <div className="mt-2 pt-2 border-t border-white/20 flex justify-between items-center">
                  <span className="text-teal-200 text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {clinicRevenueDetails.filter(r => !r.confirmed_at).length} pendente{clinicRevenueDetails.filter(r => !r.confirmed_at).length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-teal-200 text-xs font-bold">
                    R$ {clinicRevenueDetails.filter(r => !r.confirmed_at).reduce((sum, r) => sum + r.total_value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {clinicRevenueDetails.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
                  <p className="text-sm">Nenhum lançamento no mês</p>
                </div>
              ) : (
                clinicRevenueDetails.map(r => (
                  <div key={r.id} className={`rounded-xl p-3 border ${r.confirmed_at ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-800">{r.client_name}</p>
                        {r.confirmed_at ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">check_circle</span>
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-black shrink-0 ml-3 ${r.confirmed_at ? 'text-emerald-600' : 'text-amber-600'}`}>
                        R$ {r.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                        {new Date(r.receipt_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      {r.description && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">description</span>
                          {r.description}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.origem_color }}></span>
                        {r.origem}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowClinicRevenueDetail(false)}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de conversa (somente leitura) */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowChatModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-cyan-600 to-teal-600 flex-shrink-0">
              <button 
                onClick={() => setShowChatModal(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/80 hover:text-white"
              >
                <span className="material-symbols-outlined text-xl sm:text-2xl">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg sm:text-xl">forum</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base">{chatLeadName}</h3>
                  <p className="text-cyan-100 text-[10px] sm:text-xs">{chatMessages.length} mensagens</p>
                </div>
              </div>
            </div>
            
            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 bg-slate-50 min-h-[200px] max-h-[60vh]">
              {loadingChat ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Nenhuma mensagem encontrada
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_from_client ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                      msg.is_from_client 
                        ? 'bg-white border border-slate-200 rounded-tl-sm' 
                        : 'bg-cyan-600 text-white rounded-tr-sm'
                    }`}>
                      {msg.media_url && (
                        <div className="mb-1.5">
                          {msg.type === 'image' ? (
                            <img src={msg.media_url} alt="" className="max-w-full rounded-lg max-h-48 object-cover" />
                          ) : msg.type === 'audio' || msg.type === 'ptt' ? (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">mic</span>
                              <span className="text-[10px] sm:text-xs opacity-70">Áudio</span>
                            </div>
                          ) : msg.type === 'video' ? (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">videocam</span>
                              <span className="text-[10px] sm:text-xs opacity-70">Vídeo</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">attach_file</span>
                              <span className="text-[10px] sm:text-xs opacity-70">Arquivo</span>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.content && (
                        <p className={`text-xs sm:text-sm whitespace-pre-wrap break-words ${
                          msg.is_from_client ? 'text-slate-800' : 'text-white'
                        }`}>
                          {msg.content}
                        </p>
                      )}
                      <p className={`text-[9px] sm:text-[10px] mt-1 ${
                        msg.is_from_client ? 'text-slate-400' : 'text-cyan-100'
                      }`}>
                        {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex-shrink-0">
              <button
                onClick={() => setShowChatModal(false)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 text-slate-700 rounded-lg sm:rounded-xl font-medium hover:bg-slate-200 transition-colors text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
