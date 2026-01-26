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
  Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { GlobalState } from '../types';
import { getDataAccess } from '../lib/permissions';

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
      
      // Buscar chats do período
      const { data: chatsData } = await supabase
        .from('chats')
        .select('id, status, created_at, source_id')
        .eq('clinic_id', clinicId);
      
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
      
      // Buscar pagamentos
      if (canSeeBilling) {
        const { data: paymentsData } = await supabase
          .from('payments' as any)
          .select('id, value, payment_date, chat_id')
          .eq('clinic_id', clinicId)
          .or('status.is.null,status.eq.active');
        
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
        
        // Leads por origem
        const { data: sourcesData } = await supabase
          .from('lead_sources' as any)
          .select('id, name, color')
          .eq('clinic_id', clinicId);
        
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
      
      // Buscar meta e horário de funcionamento da clínica
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('monthly_goal, business_hours_start, business_hours_end, business_days, has_lunch_break, lunch_break_start, lunch_break_end')
        .eq('id', clinicId)
        .single();
      
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
        const { data: messagesData } = await supabase
          .from('messages')
          .select('chat_id, created_at, from_me')
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
            const firstClientMsg = msgs.find(m => !m.from_me);
            const firstResponse = msgs.find(m => m.from_me && firstClientMsg && new Date(m.created_at) > new Date(firstClientMsg.created_at));
            
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
        const { data: paymentsForConversion } = await supabase
          .from('payments' as any)
          .select('chat_id, payment_date')
          .in('chat_id', convertedChats.map(c => c.id));
        
        if (paymentsForConversion && paymentsForConversion.length > 0) {
          const conversionTimes: number[] = [];
          paymentsForConversion.forEach((payment: any) => {
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
    }
  }, [clinicId, period]);

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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Métricas</h1>
          <p className="text-slate-500 text-sm">Acompanhe o desempenho da sua clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Período:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: 'month', label: 'Este mês' },
              { id: 'lastMonth', label: 'Mês anterior' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as MetricsPeriod)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  period === p.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Principais */}
      {canSeeBilling && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Faturamento */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
            <p className="text-emerald-100 text-sm mb-1">Faturamento do Período</p>
            <p className="text-3xl font-bold">{formatCurrency(periodRevenue)}</p>
            {previousPeriodRevenue > 0 && (
              <div className={`mt-2 flex items-center gap-1 text-sm ${
                periodRevenue >= previousPeriodRevenue ? 'text-emerald-200' : 'text-red-200'
              }`}>
                {periodRevenue >= previousPeriodRevenue ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {getPercentChange(periodRevenue, previousPeriodRevenue).toFixed(1)}% vs período anterior
              </div>
            )}
          </div>

          {/* Leads */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white">
            <p className="text-cyan-100 text-sm mb-1">Leads no Período</p>
            <p className="text-3xl font-bold">{periodLeads}</p>
            {previousPeriodLeads > 0 && (
              <div className={`mt-2 flex items-center gap-1 text-sm ${
                periodLeads >= previousPeriodLeads ? 'text-cyan-200' : 'text-red-200'
              }`}>
                {periodLeads >= previousPeriodLeads ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {getPercentChange(periodLeads, previousPeriodLeads).toFixed(1)}% vs período anterior
              </div>
            )}
          </div>

          {/* Conversões */}
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-5 text-white">
            <p className="text-violet-100 text-sm mb-1">Conversões no Período</p>
            <p className="text-3xl font-bold">{periodConversions}</p>
            {previousPeriodConversions > 0 && (
              <div className={`mt-2 flex items-center gap-1 text-sm ${
                periodConversions >= previousPeriodConversions ? 'text-violet-200' : 'text-red-200'
              }`}>
                {periodConversions >= previousPeriodConversions ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {getPercentChange(periodConversions, previousPeriodConversions).toFixed(1)}% vs período anterior
              </div>
            )}
          </div>
        </div>
      )}

      {/* Métricas Adicionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {canSeeBilling && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Ticket Médio</p>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(ticketMedio)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Percent className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Taxa de Conversão</p>
              <p className="text-lg font-bold text-slate-800">{taxaConversao.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Tempo de Resposta</p>
              <p className="text-lg font-bold text-slate-800">{avgResponseTimeMinutes} min</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${leadsAwaiting > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              <AlertCircle className={`w-5 h-5 ${leadsAwaiting > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Aguardando (+2h)</p>
              <p className={`text-lg font-bold ${leadsAwaiting > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{leadsAwaiting}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meta vs Realizado */}
      {canSeeBilling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meta do Mês */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-600" />
                  Meta do Mês
                </h2>
                <p className="text-sm text-slate-500">Progresso em relação à meta mensal</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{goalProgress.toFixed(0)}%</p>
                <p className="text-xs text-slate-500">da meta</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">{formatCurrency(monthlyRevenue)}</span>
                <span className="text-slate-400">Meta: {formatCurrency(monthlyGoal)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                <div 
                  className={`h-4 rounded-full transition-all duration-500 ${
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
            <div className="flex items-center gap-2 text-sm">
              {goalProgress >= 100 ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Meta atingida!
                </span>
              ) : (
                <span className="text-slate-500">
                  Faltam {formatCurrency(monthlyGoal - monthlyRevenue)} para a meta
                </span>
              )}
            </div>
          </div>

          {/* Previsão */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-600" />
                  Previsão do Mês
                </h2>
                <p className="text-sm text-slate-500">Estimativa baseada no ritmo atual</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Realizado até agora</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(monthlyRevenue)}</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 text-center">
                <p className="text-xs text-cyan-600 mb-1">Previsão final</p>
                <p className="text-xl font-bold text-cyan-700">{formatCurrency(projectedRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{daysRemaining} dias restantes no mês</span>
              {projectedRevenue >= monthlyGoal ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Deve atingir a meta
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  Abaixo da meta prevista
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Evolução */}
      {canSeeBilling && dailyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Evolução dos Últimos 30 Dias
            </h2>
            <p className="text-sm text-slate-500 mt-1">Faturamento, leads e conversões por dia</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Faturamento */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded"></span>
                  Faturamento Diário
                </span>
                <span className="text-sm text-slate-500">
                  Total: {formatCurrency(dailyData.reduce((sum, d) => sum + d.revenue, 0))}
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
                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="w-3 h-3 bg-cyan-500 rounded"></span>
                  Leads por Dia
                </span>
                <span className="text-sm text-slate-500">
                  Total: {dailyData.reduce((sum, d) => sum + d.leads, 0)} leads
                </span>
              </div>
              <div className="flex items-end gap-[2px] h-12">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil de Conversão */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-600" />
              Funil de Conversão
            </h2>
            <p className="text-sm text-slate-500 mt-1">Status atual de todos os leads</p>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Novo Lead', value: leadsByStatus.novo, color: 'bg-blue-500' },
              { label: 'Em Atendimento', value: leadsByStatus.emAtendimento, color: 'bg-amber-500' },
              { label: 'Convertido', value: leadsByStatus.convertido, color: 'bg-emerald-500' },
              { label: 'Perdido', value: leadsByStatus.perdido, color: 'bg-red-500' },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-sm font-bold text-slate-800">{item.value}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div 
                    className={`${item.color} h-3 rounded-full transition-all duration-500`}
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
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-600" />
                Leads por Origem
              </h2>
              <p className="text-sm text-slate-500 mt-1">Performance de cada canal</p>
            </div>
            <div className="overflow-x-auto">
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
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Tempo e Produtividade
          </h2>
          <p className="text-sm text-slate-500 mt-1">Métricas de eficiência do atendimento</p>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-600 mb-2">Tempo de Resposta</p>
            <p className="text-2xl font-bold text-blue-700">
              {avgResponseTimeMinutes > 60 
                ? `${Math.floor(avgResponseTimeMinutes / 60)}h ${avgResponseTimeMinutes % 60}min`
                : `${avgResponseTimeMinutes} min`}
            </p>
            <p className="text-xs text-blue-500 mt-1">média de primeira resposta</p>
          </div>
          
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <p className="text-sm text-emerald-600 mb-2">Tempo de Conversão</p>
            <p className="text-2xl font-bold text-emerald-700">{avgConversionTimeDays} dias</p>
            <p className="text-xs text-emerald-500 mt-1">média até converter</p>
          </div>
          
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <p className="text-sm text-red-600 mb-2">Leads Perdidos</p>
            <p className="text-2xl font-bold text-red-700">{lostLeads}</p>
            <p className="text-xs text-red-500 mt-1">no período</p>
          </div>
          
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-600 mb-2">Taxa de Perda</p>
            <p className={`text-2xl font-bold ${lossRate > 30 ? 'text-red-600' : lossRate > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {lossRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">do período</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
