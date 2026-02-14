import React, { useState, useEffect } from 'react';
import { 
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Users,
  BarChart3,
  Percent,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  Settings,
  Trophy,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { GlobalState } from '../types';
import { getDataAccess, hasPermission } from '../lib/permissions';

interface AttendantStats {
  id: string;
  name: string;
  role: string;
  leads: number;
  conversions: number;
  revenue: number;
  monthlyGoal: number;
  canSeeGoal: boolean;
  avgResponseTime: number | null;
}

interface MetricsProps {
  state: GlobalState;
}

interface DailyData {
  date: string;
  revenue: number;
  leads: number;
  conversions: number;
}

interface LeadsByStatus {
  novo: number;
  emAtendimento: number;
  convertido: number;
  perdido: number;
}

interface LeadSourceStats {
  id: string;
  name: string;
  color: string;
  total_leads: number;
  converted_leads: number;
  revenue: number;
}

type MetricsPeriod = '7d' | '30d' | 'month' | 'lastMonth';

const Metrics: React.FC<MetricsProps> = ({ state }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const dataAccess = getDataAccess(user?.role);
  const canSeeBilling = dataAccess !== 'no_billing';
  
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<MetricsPeriod>('month');
  
  // Métricas principais
  const [periodRevenue, setPeriodRevenue] = useState(0);
  const [previousPeriodRevenue, setPreviousPeriodRevenue] = useState(0);
  const [periodLeads, setPeriodLeads] = useState(0);
  const [previousPeriodLeads, setPreviousPeriodLeads] = useState(0);
  const [periodConversions, setPeriodConversions] = useState(0);
  const [previousPeriodConversions, setPreviousPeriodConversions] = useState(0);
  
  // Meta
  const [monthlyGoal, setMonthlyGoal] = useState(50000);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [projectedRevenue, setProjectedRevenue] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  
  // Tempo e produtividade
  const [avgResponseTimeMinutes, setAvgResponseTimeMinutes] = useState(0);
  const [avgConversionTimeDays, setAvgConversionTimeDays] = useState(0);
  const [leadsAwaiting, setLeadsAwaiting] = useState(0);
  const [lostLeads, setLostLeads] = useState(0);
  const [lossRate, setLossRate] = useState(0);
  
  // Horário de funcionamento
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hasLunchBreak, setHasLunchBreak] = useState(false);
  const [lunchBreakStart, setLunchBreakStart] = useState('12:00');
  const [lunchBreakEnd, setLunchBreakEnd] = useState('13:00');
  
  // Funil e origens
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus>({ novo: 0, emAtendimento: 0, convertido: 0, perdido: 0 });
  const [leadSourceStats, setLeadSourceStats] = useState<LeadSourceStats[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  
  // Gráfico diário
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  
  // Ranking de atendentes e metas (só para Admin)
  const [attendantStats, setAttendantStats] = useState<AttendantStats[]>([]);
  const [clinicUsers, setClinicUsers] = useState<Array<{ id: string; name: string; role: string; monthly_goal: number | null; can_see_goal: boolean }>>([]);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [clinicGoal, setClinicGoal] = useState(50000);
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});
  const [userCanSeeGoal, setUserCanSeeGoal] = useState<Record<string, boolean>>({});
  const [savingGoals, setSavingGoals] = useState(false);
  
  const { isAdmin } = useAuth();

  const getDateRange = (periodType: MetricsPeriod) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let prevStartDate: Date;
    let prevEndDate: Date;
    
    switch (periodType) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    
    return { startDate, endDate, prevStartDate, prevEndDate };
  };

  const fetchMetrics = async () => {
    if (!clinicId) return;
    setLoading(true);
    
    try {
      const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(period);
      const now = new Date();
      
      // Buscar chats, pagamentos, origens e config da clínica em paralelo
      const [
        { data: chatsData },
        { data: paymentsData },
        { data: sourcesData },
        { data: clinicData }
      ] = await Promise.all([
        supabase.from('chats').select('id, status, created_at, source_id').eq('clinic_id', clinicId),
        supabase.from('payments' as any).select('id, value, payment_date, chat_id').eq('clinic_id', clinicId).or('status.is.null,status.eq.active'),
        supabase.from('lead_sources' as any).select('id, name, color').eq('clinic_id', clinicId),
        (supabase as any).from('clinics').select('monthly_goal, business_hours_start, business_hours_end, business_days, has_lunch_break, lunch_break_start, lunch_break_end').eq('id', clinicId).single()
      ]);
      
      const chats = chatsData || [];
      
      // Filtrar por período
      const periodChats = chats.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
      
      const prevPeriodChats = chats.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= prevStartDate && createdAt <= prevEndDate;
      });
      
      // Leads e conversões do período
      setPeriodLeads(periodChats.length);
      setPreviousPeriodLeads(prevPeriodChats.length);
      setPeriodConversions(periodChats.filter(c => c.status === 'Convertido').length);
      setPreviousPeriodConversions(prevPeriodChats.filter(c => c.status === 'Convertido').length);
      
      // Funil de status (todos os leads)
      setTotalLeads(chats.length);
      setLeadsByStatus({
        novo: chats.filter(c => c.status === 'Novo Lead').length,
        emAtendimento: chats.filter(c => c.status === 'Em Atendimento').length,
        convertido: chats.filter(c => c.status === 'Convertido').length,
        perdido: chats.filter(c => c.status === 'Perdido').length,
      });
      
      // Leads aguardando (+2h sem resposta)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const awaiting = chats.filter(c => {
        const createdAt = new Date(c.created_at);
        return c.status === 'Novo Lead' && createdAt < twoHoursAgo;
      }).length;
      setLeadsAwaiting(awaiting);
      
      // Leads perdidos no período
      const lost = periodChats.filter(c => c.status === 'Perdido').length;
      setLostLeads(lost);
      setLossRate(periodChats.length > 0 ? (lost / periodChats.length) * 100 : 0);
      
      // Processar pagamentos (dados já buscados em paralelo)
      if (canSeeBilling) {
        const payments = (paymentsData || []) as any[];
        
        // Faturamento do período
        const periodPayments = payments.filter(p => {
          const payDate = new Date(p.payment_date);
          return payDate >= startDate && payDate <= endDate;
        });
        const prevPeriodPayments = payments.filter(p => {
          const payDate = new Date(p.payment_date);
          return payDate >= prevStartDate && payDate <= prevEndDate;
        });
        
        const revenue = periodPayments.reduce((sum, p) => sum + Number(p.value), 0);
        const prevRevenue = prevPeriodPayments.reduce((sum, p) => sum + Number(p.value), 0);
        
        setPeriodRevenue(revenue);
        setPreviousPeriodRevenue(prevRevenue);
        
        // Faturamento do mês atual (para meta)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthPayments = payments.filter(p => new Date(p.payment_date) >= monthStart);
        const monthRev = monthPayments.reduce((sum, p) => sum + Number(p.value), 0);
        setMonthlyRevenue(monthRev);
        
        // Projeção
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remaining = daysInMonth - dayOfMonth;
        setDaysRemaining(remaining);
        
        const dailyAvg = dayOfMonth > 0 ? monthRev / dayOfMonth : 0;
        setProjectedRevenue(monthRev + (dailyAvg * remaining));
        
        // Dados diários (últimos 30 dias)
        const last30Days: DailyData[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayPayments = payments.filter(p => p.payment_date === dateStr);
          const dayChats = chats.filter(c => c.created_at.split('T')[0] === dateStr);
          const dayConversions = chats.filter(c => c.status === 'Convertido' && c.created_at.split('T')[0] === dateStr);
          
          last30Days.push({
            date: dateStr,
            revenue: dayPayments.reduce((sum, p) => sum + Number(p.value), 0),
            leads: dayChats.length,
            conversions: dayConversions.length,
          });
        }
        setDailyData(last30Days);
        
        // Leads por origem (dados já buscados em paralelo)
        if (sourcesData && sourcesData.length > 0) {
          const stats: LeadSourceStats[] = (sourcesData as any[]).map(source => {
            const sourceChats = chats.filter(c => c.source_id === source.id);
            const convertedChats = sourceChats.filter(c => c.status === 'Convertido');
            const sourceChatIds = sourceChats.map(c => c.id);
            const sourceRevenue = payments
              .filter(p => sourceChatIds.includes(p.chat_id))
              .reduce((sum, p) => sum + Number(p.value), 0);
            
            return {
              id: source.id,
              name: source.name,
              color: source.color || '#6B7280',
              total_leads: sourceChats.length,
              converted_leads: convertedChats.length,
              revenue: sourceRevenue,
            };
          });
          
          stats.sort((a, b) => b.total_leads - a.total_leads);
          setLeadSourceStats(stats.filter(s => s.total_leads > 0));
        }
      }
      
      // Processar config da clínica (dados já buscados em paralelo)
      if (clinicData) {
        setMonthlyGoal(Number(clinicData.monthly_goal) || 50000);
        setBusinessHoursStart(clinicData.business_hours_start || '08:00');
        setBusinessHoursEnd(clinicData.business_hours_end || '18:00');
        setBusinessDays(clinicData.business_days || [1, 2, 3, 4, 5]);
        setHasLunchBreak(clinicData.has_lunch_break || false);
        setLunchBreakStart(clinicData.lunch_break_start || '12:00');
        setLunchBreakEnd(clinicData.lunch_break_end || '13:00');
      }
      
      // Calcular tempo médio de resposta real
      const chatIds = periodChats.map(c => c.id);
      if (chatIds.length > 0) {
        const { data: messagesData } = await (supabase as any)
          .from('messages')
          .select('chat_id, created_at, is_from_client')
          .in('chat_id', chatIds.slice(0, 100)) // Limitar para performance
          .order('created_at', { ascending: true });
        
        if (messagesData && messagesData.length > 0) {
          // Agrupar mensagens por chat
          const messagesByChat: Record<string, any[]> = {};
          messagesData.forEach(msg => {
            if (!messagesByChat[msg.chat_id]) messagesByChat[msg.chat_id] = [];
            messagesByChat[msg.chat_id].push(msg);
          });
          
          // Calcular tempo de primeira resposta para cada chat
          const responseTimes: number[] = [];
          const bhStart = clinicData?.business_hours_start || '08:00';
          const bhEnd = clinicData?.business_hours_end || '18:00';
          const bhDays = clinicData?.business_days || [1, 2, 3, 4, 5];
          const hasLunch = clinicData?.has_lunch_break || false;
          const lunchStart = clinicData?.lunch_break_start || '12:00';
          const lunchEnd = clinicData?.lunch_break_end || '13:00';
          
          Object.values(messagesByChat).forEach(msgs => {
            // Encontrar primeira mensagem do cliente e primeira resposta
            // is_from_client: true = mensagem do cliente, false = resposta do atendente
            const firstClientMsg = msgs.find(m => m.is_from_client === true);
            const firstResponse = msgs.find(m => m.is_from_client === false && firstClientMsg && new Date(m.created_at) > new Date(firstClientMsg.created_at));
            
            if (firstClientMsg && firstResponse) {
              const clientTime = new Date(firstClientMsg.created_at);
              const responseTime = new Date(firstResponse.created_at);
              
              // Calcular tempo em minutos (considerando horário comercial)
              let diffMinutes = (responseTime.getTime() - clientTime.getTime()) / (1000 * 60);
              
              // Se a mensagem chegou fora do horário comercial, ajustar
              const clientHour = clientTime.getHours();
              const clientMinute = clientTime.getMinutes();
              const clientDay = clientTime.getDay();
              const [startH, startM = 0] = bhStart.split(':').map(Number);
              const [endH, endM = 0] = bhEnd.split(':').map(Number);
              const [lunchStartH, lunchStartM = 0] = lunchStart.split(':').map(Number);
              const [lunchEndH, lunchEndM = 0] = lunchEnd.split(':').map(Number);
              
              // Calcular horas úteis por dia (descontando almoço se houver)
              let hoursPerDay = (endH + endM/60) - (startH + startM/60);
              if (hasLunch) {
                const lunchDuration = (lunchEndH + lunchEndM/60) - (lunchStartH + lunchStartM/60);
                hoursPerDay -= lunchDuration;
              }
              
              // Se chegou fora do horário ou dia não útil, descontar tempo fora do expediente
              const clientTimeDecimal = clientHour + clientMinute/60;
              const isOutsideHours = !bhDays.includes(clientDay) || 
                clientTimeDecimal < (startH + startM/60) || 
                clientTimeDecimal >= (endH + endM/60);
              const isDuringLunch = hasLunch && 
                clientTimeDecimal >= (lunchStartH + lunchStartM/60) && 
                clientTimeDecimal < (lunchEndH + lunchEndM/60);
              
              if (isOutsideHours || isDuringLunch) {
                // Se fora do horário, limitar ao máximo de 1 dia útil
                if (diffMinutes > hoursPerDay * 60) {
                  diffMinutes = Math.min(diffMinutes, hoursPerDay * 60);
                }
              } else if (hasLunch) {
                // Se dentro do horário mas passou pelo almoço, descontar tempo do almoço
                const responseHour = responseTime.getHours();
                const responseMinute = responseTime.getMinutes();
                const responseTimeDecimal = responseHour + responseMinute/60;
                
                // Se a mensagem chegou antes do almoço e resposta depois do almoço
                if (clientTimeDecimal < (lunchStartH + lunchStartM/60) && 
                    responseTimeDecimal >= (lunchEndH + lunchEndM/60)) {
                  const lunchDurationMinutes = ((lunchEndH + lunchEndM/60) - (lunchStartH + lunchStartM/60)) * 60;
                  diffMinutes -= lunchDurationMinutes;
                }
              }
              
              if (diffMinutes > 0 && diffMinutes < 1440) { // Menos de 24h
                responseTimes.push(diffMinutes);
              }
            }
          });
          
          if (responseTimes.length > 0) {
            const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            setAvgResponseTimeMinutes(Math.round(avgTime));
          } else {
            setAvgResponseTimeMinutes(0);
          }
        }
      }
      
      // Calcular tempo médio de conversão (dias entre criação e conversão)
      const convertedChats = periodChats.filter(c => c.status === 'Convertido');
      if (convertedChats.length > 0 && canSeeBilling) {
        // Buscar por clinic_id e filtrar no frontend para evitar erro 400 com muitos IDs
        const { data: paymentsForConversion } = await supabase
          .from('payments' as any)
          .select('chat_id, payment_date')
          .eq('clinic_id', clinicId);
        
        const convertedChatIds = convertedChats.map(c => c.id);
        const filteredPayments = (paymentsForConversion || []).filter((p: any) => convertedChatIds.includes(p.chat_id));
        
        if (filteredPayments.length > 0) {
          const conversionTimes: number[] = [];
          filteredPayments.forEach((payment: any) => {
            const chat = convertedChats.find(c => c.id === payment.chat_id);
            if (chat) {
              const chatDate = new Date(chat.created_at);
              const paymentDate = new Date(payment.payment_date);
              const diffDays = (paymentDate.getTime() - chatDate.getTime()) / (1000 * 60 * 60 * 24);
              if (diffDays >= 0 && diffDays < 365) {
                conversionTimes.push(diffDays);
              }
            }
          });
          
          if (conversionTimes.length > 0) {
            const avgDays = conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length;
            setAvgConversionTimeDays(Math.round(avgDays));
          }
        }
      }
      
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId) {
      fetchMetrics();
      if (isAdmin) {
        fetchAttendantStats();
      }
    }
  }, [clinicId, period]);

  // Buscar dados de atendentes (só para Admin)
  const fetchAttendantStats = async () => {
    if (!clinicId || !isAdmin) return;
    
    try {
      // Buscar usuários da clínica
      const { data: usersData } = await (supabase as any)
        .from('users')
        .select('id, name, role, monthly_goal, can_see_goal')
        .eq('clinic_id', clinicId)
        .in('role', ['Admin', 'Atendente', 'Comercial']);
      
      if (usersData) {
        setClinicUsers(usersData);
      }
      
      // Buscar meta da clínica
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('monthly_goal')
        .eq('id', clinicId)
        .single();
      
      if (clinicData?.monthly_goal) {
        setClinicGoal(clinicData.monthly_goal);
        setMonthlyGoal(clinicData.monthly_goal);
      }
      
      // Buscar chats e pagamentos para calcular stats por atendente
      const { data: chatsData } = await supabase
        .from('chats')
        .select('id, status, assigned_to, created_at')
        .eq('clinic_id', clinicId);
      
      const { data: paymentsData } = await (supabase as any)
        .from('payments')
        .select('id, value, chat_id, created_by, payment_date')
        .eq('clinic_id', clinicId)
        .or('status.is.null,status.eq.active');
      
      // Buscar mensagens para tempo de resposta
      const chatIds = (chatsData || []).map(c => c.id);
      const { data: messagesData } = await (supabase as any)
        .from('messages')
        .select('chat_id, created_at, is_from_client, sent_by')
        .in('chat_id', chatIds.slice(0, 200))
        .order('created_at', { ascending: true });
      
      // Calcular stats por atendente
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const stats: AttendantStats[] = (usersData || []).map((u: any) => {
        // Leads atribuídos a este atendente
        const userChats = (chatsData || []).filter(c => c.assigned_to === u.id);
        const userConversions = userChats.filter(c => c.status === 'Convertido');
        
        // Faturamento do mês (pagamentos criados por este usuário)
        const userPayments = (paymentsData || []).filter((p: any) => {
          const payDate = new Date(p.payment_date);
          return p.created_by === u.id && payDate >= monthStart;
        });
        const revenue = userPayments.reduce((sum: number, p: any) => sum + Number(p.value), 0);
        
        // Tempo médio de resposta
        let avgResponseTime: number | null = null;
        const userMessages = (messagesData || []).filter((m: any) => m.sent_by === u.id);
        if (userMessages.length > 0) {
          const responseTimes: number[] = [];
          const messagesByChat: Record<string, any[]> = {};
          (messagesData || []).forEach((m: any) => {
            if (!messagesByChat[m.chat_id]) messagesByChat[m.chat_id] = [];
            messagesByChat[m.chat_id].push(m);
          });
          
          Object.values(messagesByChat).forEach((msgs: any[]) => {
            const firstClient = msgs.find(m => m.is_from_client === true);
            const firstResponse = msgs.find(m => m.is_from_client === false && m.sent_by === u.id && firstClient && new Date(m.created_at) > new Date(firstClient.created_at));
            if (firstClient && firstResponse) {
              const diff = (new Date(firstResponse.created_at).getTime() - new Date(firstClient.created_at).getTime()) / (1000 * 60);
              if (diff > 0 && diff < 1440) responseTimes.push(diff);
            }
          });
          
          if (responseTimes.length > 0) {
            avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
          }
        }
        
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          leads: userChats.length,
          conversions: userConversions.length,
          revenue,
          monthlyGoal: u.monthly_goal || 0,
          canSeeGoal: u.can_see_goal || false,
          avgResponseTime,
        };
      });
      
      // Ordenar por faturamento
      stats.sort((a, b) => b.revenue - a.revenue);
      setAttendantStats(stats);
      
    } catch (err) {
      console.error('Error fetching attendant stats:', err);
    }
  };

  // Abrir modal de metas
  const openGoalsModal = () => {
    const goals: Record<string, number> = {};
    const canSee: Record<string, boolean> = {};
    clinicUsers.forEach(u => {
      goals[u.id] = u.monthly_goal || 0;
      canSee[u.id] = u.can_see_goal || false;
    });
    setUserGoals(goals);
    setUserCanSeeGoal(canSee);
    setShowGoalsModal(true);
  };

  // Salvar metas
  const saveGoals = async () => {
    if (!clinicId) return;
    setSavingGoals(true);
    try {
      // Salvar meta da clínica
      await (supabase as any)
        .from('clinics')
        .update({ monthly_goal: clinicGoal })
        .eq('id', clinicId);
      
      // Salvar metas dos usuários
      for (const [userId, goalValue] of Object.entries(userGoals)) {
        const goal = goalValue as number;
        const canSee = userCanSeeGoal[userId] || false;
        await (supabase as any)
          .from('users')
          .update({ 
            monthly_goal: goal > 0 ? goal : null,
            can_see_goal: canSee
          })
          .eq('id', userId);
      }
      
      // Atualizar dados locais
      setMonthlyGoal(clinicGoal);
      setClinicUsers(clinicUsers.map(u => ({ 
        ...u, 
        monthly_goal: userGoals[u.id] || null,
        can_see_goal: userCanSeeGoal[u.id] || false
      })));
      
      setShowGoalsModal(false);
      fetchAttendantStats();
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
    } finally {
      setSavingGoals(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const exportToCSV = () => {
    let csv = 'Métrica;Valor\n';
    csv += `Faturamento do Período;${periodRevenue}\n`;
    csv += `Leads do Período;${periodLeads}\n`;
    csv += `Conversões do Período;${periodConversions}\n`;
    csv += `Taxa de Conversão;${periodLeads > 0 ? ((periodConversions / periodLeads) * 100).toFixed(1) : 0}%\n`;
    csv += `Ticket Médio;${periodConversions > 0 ? (periodRevenue / periodConversions).toFixed(2) : 0}\n`;
    csv += `\nOrigem;Leads;Convertidos;Taxa;Receita\n`;
    leadSourceStats.forEach(s => {
      const rate = s.total_leads > 0 ? ((s.converted_leads / s.total_leads) * 100).toFixed(1) : '0';
      csv += `${s.name};${s.total_leads};${s.converted_leads};${rate}%;${s.revenue.toFixed(2)}\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `metricas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const ticketMedio = periodConversions > 0 ? periodRevenue / periodConversions : 0;
  const taxaConversao = periodLeads > 0 ? (periodConversions / periodLeads) * 100 : 0;
  const goalProgress = monthlyGoal > 0 ? (monthlyRevenue / monthlyGoal) * 100 : 0;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Métricas</h1>
          <p className="text-slate-500 text-xs sm:text-sm">Acompanhe o desempenho</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={fetchMetrics}
            className="flex items-center gap-2 p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button 
              onClick={openGoalsModal}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors text-xs sm:text-sm"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurar Metas</span>
              <span className="sm:hidden">Metas</span>
            </button>
          )}
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-xs sm:text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="hidden sm:flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Período:</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap flex-1 sm:flex-none">
            {[
              { id: '7d', label: '7d', labelFull: '7 dias' },
              { id: '30d', label: '30d', labelFull: '30 dias' },
              { id: 'month', label: 'Mês', labelFull: 'Este mês' },
              { id: 'lastMonth', label: 'Anterior', labelFull: 'Mês anterior' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as MetricsPeriod)}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-none ${
                  period === p.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="sm:hidden">{p.label}</span>
                <span className="hidden sm:inline">{p.labelFull}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Principais */}
      {canSeeBilling && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Faturamento */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3 sm:p-5 text-white">
            <p className="text-emerald-100 text-[10px] sm:text-sm mb-1">Faturamento</p>
            <p className="text-xl sm:text-3xl font-bold">{formatCurrency(periodRevenue)}</p>
            {previousPeriodRevenue > 0 && (
              <div className={`mt-1 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-sm ${
                periodRevenue >= previousPeriodRevenue ? 'text-emerald-200' : 'text-red-200'
              }`}>
                {periodRevenue >= previousPeriodRevenue ? (
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                {getPercentChange(periodRevenue, previousPeriodRevenue).toFixed(1)}%
              </div>
            )}
          </div>

          {/* Leads */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-3 sm:p-5 text-white">
            <p className="text-cyan-100 text-[10px] sm:text-sm mb-1">Leads</p>
            <p className="text-xl sm:text-3xl font-bold">{periodLeads}</p>
            {previousPeriodLeads > 0 && (
              <div className={`mt-1 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-sm ${
                periodLeads >= previousPeriodLeads ? 'text-cyan-200' : 'text-red-200'
              }`}>
                {periodLeads >= previousPeriodLeads ? (
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                {getPercentChange(periodLeads, previousPeriodLeads).toFixed(1)}%
              </div>
            )}
          </div>

          {/* Conversões */}
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-3 sm:p-5 text-white">
            <p className="text-violet-100 text-[10px] sm:text-sm mb-1">Conversões</p>
            <p className="text-xl sm:text-3xl font-bold">{periodConversions}</p>
            {previousPeriodConversions > 0 && (
              <div className={`mt-1 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-sm ${
                periodConversions >= previousPeriodConversions ? 'text-violet-200' : 'text-red-200'
              }`}>
                {periodConversions >= previousPeriodConversions ? (
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                {getPercentChange(periodConversions, previousPeriodConversions).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Métricas Adicionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {canSeeBilling && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500">Ticket Médio</p>
                <p className="text-sm sm:text-lg font-bold text-slate-800">{formatCurrency(ticketMedio)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500">Conversão</p>
              <p className="text-sm sm:text-lg font-bold text-slate-800">{taxaConversao.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500">Resposta</p>
              <p className="text-sm sm:text-lg font-bold text-slate-800">{avgResponseTimeMinutes} min</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${leadsAwaiting > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              <AlertCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${leadsAwaiting > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-500">Aguardando</p>
              <p className={`text-sm sm:text-lg font-bold ${leadsAwaiting > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{leadsAwaiting}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meta vs Realizado */}
      {canSeeBilling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Meta do Mês */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
                  Meta do Mês
                </h2>
                <p className="text-[10px] sm:text-sm text-slate-500 hidden sm:block">Progresso em relação à meta mensal</p>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-slate-800">{goalProgress.toFixed(0)}%</p>
                <p className="text-[10px] sm:text-xs text-slate-500">da meta</p>
              </div>
            </div>
            <div className="mb-3 sm:mb-4">
              <div className="flex justify-between text-xs sm:text-sm mb-2">
                <span className="text-slate-600">{formatCurrency(monthlyRevenue)}</span>
                <span className="text-slate-400">Meta: {formatCurrency(monthlyGoal)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 sm:h-4 overflow-hidden">
                <div 
                  className={`h-3 sm:h-4 rounded-full transition-all duration-500 ${
                    goalProgress >= 100 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                      : goalProgress >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-violet-500 to-violet-400'
                  }`}
                  style={{ width: `${Math.min(goalProgress, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {goalProgress >= 100 ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  Meta atingida!
                </span>
              ) : (
                <span className="text-slate-500">
                  Faltam {formatCurrency(monthlyGoal - monthlyRevenue)}
                </span>
              )}
            </div>
          </div>

          {/* Previsão */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
                  Previsão do Mês
                </h2>
                <p className="text-[10px] sm:text-sm text-slate-500 hidden sm:block">Estimativa baseada no ritmo atual</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="bg-slate-50 rounded-xl p-2.5 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">Realizado</p>
                <p className="text-sm sm:text-xl font-bold text-slate-800">{formatCurrency(monthlyRevenue)}</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-2.5 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-cyan-600 mb-1">Previsão</p>
                <p className="text-sm sm:text-xl font-bold text-cyan-700">{formatCurrency(projectedRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] sm:text-sm">
              <span className="text-slate-500">{daysRemaining} dias restantes</span>
              {projectedRevenue >= monthlyGoal ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Deve atingir</span>
                  <span className="sm:hidden">OK</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Abaixo da meta</span>
                  <span className="sm:hidden">Abaixo</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Evolução */}
      {canSeeBilling && dailyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-3 sm:p-6 border-b border-slate-200">
            <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <span className="hidden sm:inline">Evolução dos Últimos 30 Dias</span>
              <span className="sm:hidden">Últimos 30 Dias</span>
            </h2>
            <p className="text-[10px] sm:text-sm text-slate-500 mt-1 hidden sm:block">Faturamento, leads e conversões por dia</p>
          </div>
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Faturamento */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-500 rounded"></span>
                  <span className="hidden sm:inline">Faturamento Diário</span>
                  <span className="sm:hidden">Faturamento</span>
                </span>
                <span className="text-[10px] sm:text-sm text-slate-500">
                  {formatCurrency(dailyData.reduce((sum, d) => sum + d.revenue, 0))}
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-16">
                {dailyData.map((day, idx) => {
                  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1);
                  const height = (day.revenue / maxRevenue) * 100;
                  return (
                    <div 
                      key={idx}
                      className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-400 transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${formatCurrency(day.revenue)}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Leads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-cyan-500 rounded"></span>
                  <span className="hidden sm:inline">Leads por Dia</span>
                  <span className="sm:hidden">Leads</span>
                </span>
                <span className="text-[10px] sm:text-sm text-slate-500">
                  {dailyData.reduce((sum, d) => sum + d.leads, 0)} leads
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-10 sm:h-12">
                {dailyData.map((day, idx) => {
                  const maxLeads = Math.max(...dailyData.map(d => d.leads), 1);
                  const height = (day.leads / maxLeads) * 100;
                  return (
                    <div 
                      key={idx}
                      className="flex-1 bg-cyan-500 rounded-t hover:bg-cyan-400 transition-colors cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${new Date(day.date).toLocaleDateString('pt-BR')}: ${day.leads} leads`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funil e Origens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Funil de Conversão */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-3 sm:p-6 border-b border-slate-200">
            <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
              Funil de Conversão
            </h2>
            <p className="text-[10px] sm:text-sm text-slate-500 mt-1 hidden sm:block">Status atual de todos os leads</p>
          </div>
          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            {[
              { label: 'Novo Lead', value: leadsByStatus.novo, color: 'bg-blue-500' },
              { label: 'Em Atendimento', value: leadsByStatus.emAtendimento, color: 'bg-amber-500' },
              { label: 'Convertido', value: leadsByStatus.convertido, color: 'bg-emerald-500' },
              { label: 'Perdido', value: leadsByStatus.perdido, color: 'bg-red-500' },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">{item.value}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 sm:h-3">
                  <div 
                    className={`${item.color} h-2 sm:h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${totalLeads > 0 ? (item.value / totalLeads) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leads por Origem */}
        {canSeeBilling && leadSourceStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-3 sm:p-6 border-b border-slate-200">
              <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
                Leads por Origem
              </h2>
              <p className="text-[10px] sm:text-sm text-slate-500 mt-1 hidden sm:block">Performance de cada canal</p>
            </div>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {leadSourceStats.slice(0, 5).map(source => {
                const rate = source.total_leads > 0 
                  ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                  : '0.0';
                return (
                  <div key={source.id} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: source.color }}></span>
                      <span className="font-medium text-slate-800 text-xs">{source.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-slate-500">Leads</p>
                        <p className="text-xs font-bold text-slate-800">{source.total_leads}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Conv.</p>
                        <p className="text-xs font-bold text-emerald-600">{source.converted_leads}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Taxa</p>
                        <p className={`text-xs font-bold ${Number(rate) >= 30 ? 'text-emerald-600' : Number(rate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>{rate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Receita</p>
                        <p className="text-xs font-bold text-emerald-600">{formatCurrency(source.revenue)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Origem</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Leads</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Conv.</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Taxa</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadSourceStats.slice(0, 5).map(source => {
                    const rate = source.total_leads > 0 
                      ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                      : '0.0';
                    return (
                      <tr key={source.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }}></span>
                            <span className="font-medium text-slate-800 text-sm">{source.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{source.total_leads}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{source.converted_leads}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${Number(rate) >= 30 ? 'text-emerald-600' : Number(rate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          {formatCurrency(source.revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tempo e Produtividade */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-3 sm:p-6 border-b border-slate-200">
          <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Tempo e Produtividade
          </h2>
          <p className="text-[10px] sm:text-sm text-slate-500 mt-1 hidden sm:block">Métricas de eficiência do atendimento</p>
        </div>
        <div className="p-3 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="text-center p-2.5 sm:p-4 bg-blue-50 rounded-xl">
            <p className="text-[10px] sm:text-sm text-blue-600 mb-1 sm:mb-2">Resposta</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-700">
              {avgResponseTimeMinutes > 60 
                ? `${Math.floor(avgResponseTimeMinutes / 60)}h`
                : `${avgResponseTimeMinutes}min`}
            </p>
            <p className="text-[9px] sm:text-xs text-blue-500 mt-1 hidden sm:block">média primeira resposta</p>
          </div>
          
          <div className="text-center p-2.5 sm:p-4 bg-emerald-50 rounded-xl">
            <p className="text-[10px] sm:text-sm text-emerald-600 mb-1 sm:mb-2">Conversão</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700">{avgConversionTimeDays}d</p>
            <p className="text-[9px] sm:text-xs text-emerald-500 mt-1 hidden sm:block">média até converter</p>
          </div>
          
          <div className="text-center p-2.5 sm:p-4 bg-red-50 rounded-xl">
            <p className="text-[10px] sm:text-sm text-red-600 mb-1 sm:mb-2">Perdidos</p>
            <p className="text-lg sm:text-2xl font-bold text-red-700">{lostLeads}</p>
            <p className="text-[9px] sm:text-xs text-red-500 mt-1 hidden sm:block">no período</p>
          </div>
          
          <div className="text-center p-2.5 sm:p-4 bg-slate-50 rounded-xl">
            <p className="text-[10px] sm:text-sm text-slate-600 mb-1 sm:mb-2">Taxa Perda</p>
            <p className={`text-lg sm:text-2xl font-bold ${lossRate > 30 ? 'text-red-600' : lossRate > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {lossRate.toFixed(1)}%
            </p>
            <p className="text-[9px] sm:text-xs text-slate-500 mt-1 hidden sm:block">do período</p>
          </div>
        </div>
      </div>

      {/* Ranking de Atendentes (só para Admin) */}
      {isAdmin && attendantStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-3 sm:p-6 border-b border-slate-200">
            <h2 className="text-sm sm:text-lg font-semibold text-slate-800 flex items-center gap-1.5 sm:gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              Ranking de Atendentes
            </h2>
            <p className="text-[10px] sm:text-sm text-slate-500 mt-1 hidden sm:block">Performance individual do mês atual</p>
          </div>
          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {attendantStats.map((att, idx) => {
              const convRate = att.leads > 0 ? ((att.conversions / att.leads) * 100).toFixed(1) : '0.0';
              const goalProgressAtt = att.monthlyGoal > 0 ? (att.revenue / att.monthlyGoal) * 100 : null;
              return (
                <div key={att.id} className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-200 text-slate-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800 text-xs">{att.name}</p>
                      <p className="text-[10px] text-slate-500">{att.role}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Leads</p>
                      <p className="text-xs font-bold text-slate-800">{att.leads}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Conv.</p>
                      <p className="text-xs font-bold text-emerald-600">{att.conversions}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Taxa</p>
                      <p className={`text-xs font-bold ${Number(convRate) >= 30 ? 'text-emerald-600' : Number(convRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>{convRate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Fatur.</p>
                      <p className="text-xs font-bold text-emerald-600">{formatCurrency(att.revenue)}</p>
                    </div>
                  </div>
                  {goalProgressAtt !== null && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full ${goalProgressAtt >= 100 ? 'bg-emerald-500' : goalProgressAtt >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                            style={{ width: `${Math.min(goalProgressAtt, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-[10px] font-bold ${goalProgressAtt >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {goalProgressAtt.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">#</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Atendente</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Leads</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Conv.</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Taxa</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Faturamento</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Meta</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Tempo Resp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendantStats.map((att, idx) => {
                  const convRate = att.leads > 0 ? ((att.conversions / att.leads) * 100).toFixed(1) : '0.0';
                  const goalProgress = att.monthlyGoal > 0 ? (att.revenue / att.monthlyGoal) * 100 : null;
                  return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-700' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-800">{att.name}</p>
                          <p className="text-xs text-slate-500">{att.role}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{att.leads}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">{att.conversions}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${Number(convRate) >= 30 ? 'text-emerald-600' : Number(convRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {convRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(att.revenue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {goalProgress !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-2 rounded-full ${goalProgress >= 100 ? 'bg-emerald-500' : goalProgress >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                                style={{ width: `${Math.min(goalProgress, 100)}%` }}
                              ></div>
                            </div>
                            <span className={`text-xs font-bold ${goalProgress >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                              {goalProgress.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {att.avgResponseTime !== null ? (
                          <span className={`font-medium ${att.avgResponseTime <= 10 ? 'text-emerald-600' : att.avgResponseTime <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                            {att.avgResponseTime > 60 
                              ? `${Math.floor(att.avgResponseTime / 60)}h ${att.avgResponseTime % 60}min`
                              : `${att.avgResponseTime} min`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Metas */}
      {showGoalsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGoalsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-violet-50">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-slate-800">Configurar Metas</h3>
              </div>
              <button onClick={() => setShowGoalsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">
              {/* Meta da Clínica */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Meta Mensal da Clínica</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <input
                    type="number"
                    value={clinicGoal}
                    onChange={(e) => setClinicGoal(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="50000"
                  />
                </div>
              </div>

              {/* Metas por Atendente */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Metas por Atendente</label>
                <div className="space-y-3">
                  {clinicUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 text-sm">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                          <input
                            type="number"
                            value={userGoals[u.id] || ''}
                            onChange={(e) => setUserGoals(prev => ({ ...prev, [u.id]: Number(e.target.value) }))}
                            className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userCanSeeGoal[u.id] || false}
                            onChange={(e) => setUserCanSeeGoal(prev => ({ ...prev, [u.id]: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="text-xs text-slate-600">Ver meta</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowGoalsModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoals}
                disabled={savingGoals}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingGoals ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar Metas'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrics;
