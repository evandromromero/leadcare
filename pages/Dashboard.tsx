
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import { getDataAccess } from '../lib/permissions';

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

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading } = useChats(clinicId, user?.id);
  const { todayTasks, upcomingTasks, overdueTasks, weekTasks, toggleTask } = useTasks(clinicId, user?.id);
  
  const dataAccess = getDataAccess(user?.role);
  const canSeeBilling = dataAccess !== 'no_billing';
  
  // Estados para métricas avançadas
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [leadSourceStats, setLeadSourceStats] = useState<LeadSourceStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Filtro de período para Leads por Origem
  const [sourcesPeriodFilter, setSourcesPeriodFilter] = useState<'all' | '7d' | '30d' | 'month'>('all');
  
  // Filtro de origens selecionadas (null = todas)
  const [selectedSources, setSelectedSources] = useState<string[] | null>(null);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState(false);
  
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

  const novosLeads = chats.filter(c => c.status === 'Novo Lead').length;
  const emAtendimento = chats.filter(c => c.status === 'Em Atendimento').length;
  const totalChats = chats.length;
  
  // Estado para contar pagamentos ativos (vendas concluídas)
  const [activePaymentsCount, setActivePaymentsCount] = useState(0);
  
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
        // Buscar view_mode do usuário para filtrar faturamento
        let userViewModeForStats = 'shared';
        let userMonthlyGoal = 0;
        let userCanSeeGoal = false;
        let userRole = '';
        
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('view_mode, role, monthly_goal, can_see_goal')
            .eq('id', user.id)
            .single();
          
          userRole = (userData as any)?.role || '';
          
          // Admin/SuperAdmin sempre veem tudo
          if (userData && userRole !== 'Admin' && userRole !== 'SuperAdmin') {
            userViewModeForStats = (userData as any).view_mode || 'personal';
          }
          
          // Dados de meta do usuário
          userMonthlyGoal = (userData as any)?.monthly_goal || 0;
          userCanSeeGoal = (userData as any)?.can_see_goal || false;
        }
        
        // Determinar quais chats usar para faturamento
        let chatIdsForStats: string[] = [];
        if (userViewModeForStats === 'personal' && user?.id) {
          // Só chats onde o usuário respondeu (assigned_to = user.id)
          const chatsAtendidos = chats.filter(c => c.assigned_to === user.id);
          chatIdsForStats = chatsAtendidos.map(c => c.id);
        } else {
          // Todos os chats
          chatIdsForStats = chats.map(c => c.id);
        }
        
        if (chatIdsForStats.length === 0) {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setLeadSourceStats([]);
          // Setar dados de meta mesmo sem faturamento
          if (userCanSeeGoal && userMonthlyGoal > 0) {
            setUserGoalData({
              monthlyGoal: userMonthlyGoal,
              canSeeGoal: userCanSeeGoal,
              myMonthlyRevenue: 0
            });
          } else {
            setUserGoalData(null);
          }
          setLoadingStats(false);
          return;
        }
        
        // Buscar faturamento
        // Para Comercial: buscar apenas payments que ELE CRIOU (created_by)
        // Para outros: buscar payments dos chats visíveis
        const isComercial = userRole === 'Comercial';
        
        let paymentsData: any[] | null = null;
        
        if (isComercial && user?.id) {
          // Comercial vê apenas o que ele criou (excluindo canceladas)
          const { data } = await supabase
            .from('payments' as any)
            .select('id, value, payment_date, chat_id, created_by, status')
            .eq('clinic_id', clinicId)
            .eq('created_by', user.id)
            .or('status.is.null,status.eq.active');
          paymentsData = data as any[];
        } else {
          // Outros perfis veem baseado nos chats (excluindo canceladas)
          const { data } = await supabase
            .from('payments' as any)
            .select('id, value, payment_date, chat_id, created_by, status')
            .in('chat_id', chatIdsForStats)
            .or('status.is.null,status.eq.active');
          paymentsData = data as any[];
        }
        
        if (paymentsData) {
          const total = (paymentsData as any[]).reduce((sum, p) => sum + Number(p.value), 0);
          setTotalRevenue(total);
          
          // Contar pagamentos ativos (vendas concluídas)
          setActivePaymentsCount(paymentsData.length);
          
          // Faturamento do mês atual
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthly = (paymentsData as any[])
            .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
            .reduce((sum, p) => sum + Number(p.value), 0);
          setMonthlyRevenue(monthly);
          
          // Calcular faturamento pessoal do mês para meta do atendente
          if (userCanSeeGoal && userMonthlyGoal > 0 && user?.id) {
            // Buscar apenas chats do usuário
            const myChats = chats.filter(c => c.assigned_to === user.id);
            const myChatIds = myChats.map(c => c.id);
            const myMonthlyRevenue = (paymentsData as any[])
              .filter(p => myChatIds.includes(p.chat_id) && new Date(p.payment_date) >= firstDayOfMonth)
              .reduce((sum, p) => sum + Number(p.value), 0);
            
            setUserGoalData({
              monthlyGoal: userMonthlyGoal,
              canSeeGoal: userCanSeeGoal,
              myMonthlyRevenue
            });
          } else {
            setUserGoalData(null);
          }
        } else {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setUserGoalData(null);
          setActivePaymentsCount(0);
        }
        
        // Buscar origens de leads apenas se houver chats visíveis
        if (chatIdsForStats.length > 0) {
          const { data: sourcesData } = await supabase
            .from('lead_sources' as any)
            .select('id, name, code, color, tag_id, tag:tags(id, name, color)')
            .eq('clinic_id', clinicId);
          
          // Buscar clinic_receipts vinculados aos payments para calcular receita clínica
          const { data: receiptsData } = await supabase
            .from('clinic_receipts' as any)
            .select('id, payment_id, total_value')
            .eq('clinic_id', clinicId);
          
          if (sourcesData && sourcesData.length > 0) {
            // Função para filtrar chats por período
            const getFilteredChats = (allChats: any[], period: 'all' | '7d' | '30d' | 'month') => {
              if (period === 'all') return allChats;
              
              const now = new Date();
              let startDate: Date;
              
              switch (period) {
                case '7d':
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  break;
                case '30d':
                  startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  break;
                case 'month':
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                  break;
                default:
                  return allChats;
              }
              
              return allChats.filter(c => new Date(c.created_at) >= startDate);
            };
            
            // Função para filtrar payments por período
            const getFilteredPayments = (allPayments: any[], period: 'all' | '7d' | '30d' | 'month') => {
              if (period === 'all') return allPayments;
              
              const now = new Date();
              let startDate: Date;
              
              switch (period) {
                case '7d':
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  break;
                case '30d':
                  startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  break;
                case 'month':
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                  break;
                default:
                  return allPayments;
              }
              
              return allPayments.filter(p => new Date(p.payment_date) >= startDate);
            };
            
            const filteredChats = getFilteredChats(chats, sourcesPeriodFilter);
            const filteredPayments = getFilteredPayments(paymentsData as any[] || [], sourcesPeriodFilter);
            
            // Calcular estatísticas por origem usando apenas os chats visíveis
            const stats: LeadSourceStats[] = (sourcesData as any[]).map(source => {
              const sourceChats = filteredChats.filter(c => (c as any).source_id === source.id);
              const convertedChats = sourceChats.filter(c => c.status === 'Convertido');
              const sourceChatIds = sourceChats.map(c => c.id);
              
              // Valor comercial (payments filtrados por período)
              const sourcePayments = filteredPayments.filter(p => sourceChatIds.includes(p.chat_id));
              const revenue = sourcePayments.reduce((sum, p) => sum + Number(p.value), 0);
              
              // Receita clínica (clinic_receipts vinculados aos payments desta origem)
              const sourcePaymentIds = sourcePayments.map(p => p.id);
              const clinicRevenue = (receiptsData as any[] || [])
                .filter(r => sourcePaymentIds.includes(r.payment_id))
                .reduce((sum, r) => sum + Number(r.total_value), 0);
              
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
        
        // Buscar dados de receita clínica (lançamentos) para o comercial
        // Só mostra se o usuário for Comercial e tiver vendas
        if (user?.id && userRole === 'Comercial') {
          // Buscar payments criados por este comercial com detalhes do chat (excluindo canceladas)
          const { data: myPayments } = await supabase
            .from('payments' as any)
            .select('id, value, payment_date, chat_id, status, chat:chats(id, client_name, source_id)')
            .eq('clinic_id', clinicId)
            .eq('created_by', user.id)
            .or('status.is.null,status.eq.active')
            .order('payment_date', { ascending: false });
          
          if (myPayments && myPayments.length > 0) {
            const myPaymentIds = (myPayments as any[]).map(p => p.id);
            const totalComercial = (myPayments as any[]).reduce((sum, p) => sum + Number(p.value), 0);
            
            // Buscar receitas vinculadas aos payments deste comercial
            const { data: myReceipts } = await supabase
              .from('clinic_receipts' as any)
              .select('total_value, payment_id')
              .in('payment_id', myPaymentIds);
            
            const totalRecebido = (myReceipts as any[] || []).reduce((sum, r) => sum + Number(r.total_value), 0);
            const roi = totalComercial > 0 ? ((totalRecebido / totalComercial) * 100).toFixed(1) : '0';
            
            setClinicReceiptsData({ totalComercial, totalRecebido, roi });
            
            // Buscar origens para os detalhes
            const { data: sourcesData } = await supabase
              .from('lead_sources' as any)
              .select('id, name, color')
              .eq('clinic_id', clinicId);
            
            // Montar lista detalhada de vendas
            const salesDetails = (myPayments as any[]).map(p => {
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
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    
    fetchStats();
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

  const stats = [
    { label: 'Novos Leads', value: String(novosLeads), change: '+12%', color: 'blue', icon: 'person_add', tooltip: 'Conversas com status "Novo Lead" - leads que ainda não foram atendidos' },
    { label: 'Em Atendimento', value: String(emAtendimento), change: '+4%', color: 'orange', icon: 'forum', tooltip: 'Conversas com status "Em Atendimento" - leads sendo trabalhados ativamente' },
    { label: 'Vendas Concluídas', value: String(activePaymentsCount), change: '+10%', color: 'green', icon: 'check_circle', tooltip: 'Total de negociações registradas (não canceladas) - vem da aba Negociações no chat' },
    { label: 'Total Conversas', value: String(totalChats), change: '', color: 'purple', icon: 'chat', tooltip: 'Quantidade total de conversas/leads no sistema' },
  ];

  return (
    <div className="p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500">Resumo em tempo real da performance da sua clínica hoje.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                  <div className="relative group">
                    <span className="material-symbols-outlined text-[14px] text-slate-400 cursor-help hover:text-slate-600">info</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48 text-center z-50 shadow-lg">
                      {stat.tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </div>
                <span className={`material-symbols-outlined text-${stat.color}-600`}>{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{stat.value}</span>
                {stat.change && <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{stat.change}</span>}
              </div>
              <span className="text-xs text-slate-400">vs. ontem</span>
            </div>
          ))}
        </div>

        {/* Faturamento Cards */}
        {canSeeBilling && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider">Faturamento do Mês</p>
                <p className="text-4xl font-black mt-1">
                  R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">trending_up</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-100 text-sm">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-cyan-100 text-sm font-medium uppercase tracking-wider">Faturamento Total</p>
                <p className="text-4xl font-black mt-1">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-cyan-100 text-sm">
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
              Acumulado geral
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Minhas Vendas Detalhadas - Visível apenas para Comercial */}
        {mySalesDetails.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Minhas Vendas Detalhadas</h3>
                <p className="text-sm text-slate-500">Acompanhe o recebimento de cada venda</p>
              </div>
            </div>
            
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

        {/* Leads por Origem */}
        {canSeeBilling && leadSourceStats.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Leads por Origem</h3>
                <p className="text-sm text-slate-500">Performance de cada canal de aquisição</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setSourcesPeriodFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === 'all' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSourcesPeriodFilter('7d')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === '7d' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  7 dias
                </button>
                <button
                  onClick={() => setSourcesPeriodFilter('30d')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === '30d' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  30 dias
                </button>
                <button
                  onClick={() => setSourcesPeriodFilter('month')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sourcesPeriodFilter === 'month' 
                      ? 'bg-cyan-100 text-cyan-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Este mês
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
                              <span className="text-sm text-slate-700 truncate">{source.name}</span>
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
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Leads</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Convertidos</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Taxa</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comercial</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Receita Clínica</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeadSourceStats.map(source => {
                    const conversionRate = source.total_leads > 0 
                      ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                      : '0.0';
                    return (
                      <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: source.tag_color || source.color }}></span>
                            <span className="font-medium text-slate-800">{source.name}</span>
                            {source.tag_name && (
                              <span 
                                className="text-[10px] text-white px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: source.tag_color || '#6B7280' }}
                              >
                                {source.tag_name}
                              </span>
                            )}
                            {source.code && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{source.code}</span>
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
                      </tr>
                    );
                  })}
                </tbody>
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
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Seção de Tarefas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tarefas Atrasadas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-red-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">warning</span>
                <h3 className="font-bold text-red-800 text-sm">Atrasadas</h3>
              </div>
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {overdueTasks.length}
              </span>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">today</span>
                <h3 className="font-bold text-amber-800 text-sm">Hoje</h3>
              </div>
              <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {todayTasks.length}
              </span>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-cyan-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600">date_range</span>
                <h3 className="font-bold text-cyan-800 text-sm">Esta Semana</h3>
              </div>
              <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {weekTasks.length}
              </span>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">schedule_send</span>
              <h3 className="font-bold text-blue-800 text-sm">Follow-ups Agendados</h3>
            </div>
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {scheduledFollowups.length}
            </span>
          </div>
          <div className="p-4">
            {scheduledFollowups.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum follow-up agendado</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

        {/* Chart Section Simulation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-96 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Fluxo de Mensagens</h3>
                <p className="text-sm text-slate-500">Volume de entrada e saída nas últimas 24h</p>
              </div>
              <select className="bg-slate-50 border-slate-200 rounded-lg text-sm font-medium">
                <option>Hoje</option>
                <option>Últimos 7 dias</option>
              </select>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-2 px-2">
              {/* Simulated Chart Bars */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-full bg-cyan-100 rounded-t-sm hover:bg-cyan-600 transition-colors cursor-pointer"
                  style={{ height: `${20 + Math.random() * 80}%` }}
                  title={`${i}h: ${Math.floor(Math.random() * 100)} msg`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Leads Recentes</h3>
              <a href="#" className="text-xs font-bold text-cyan-600">Ver todos</a>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-50">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto"></div>
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conversa ainda</div>
              ) : chats.slice(0, 6).map(chat => (
                <div key={chat.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <img src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} className="size-10 rounded-full border border-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{chat.client_name}</p>
                    <p className="text-xs text-slate-500 truncate">{chat.last_message || 'Sem mensagens'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
