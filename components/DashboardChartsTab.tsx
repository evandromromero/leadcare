import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area,
  FunnelChart, Funnel, LabelList
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DashboardChartsTabProps {
  clinicId: string | undefined;
}

interface ChartConfig {
  id: string;
  name: string;
  visible: boolean;
}

const DEFAULT_CHARTS: ChartConfig[] = [
  { id: 'cards', name: 'Cards Comparativos', visible: true },
  { id: 'funnel', name: 'Funil de Conversão', visible: true },
  { id: 'origin', name: 'Leads por Origem', visible: true },
  { id: 'leadsByDay', name: 'Leads por Dia', visible: true },
  { id: 'responseTime', name: 'Tempo Médio de Resposta', visible: true },
  { id: 'salesByDay', name: 'Vendas por Dia', visible: true },
  { id: 'responseDistribution', name: 'Distribuição do Tempo de Resposta', visible: true },
  { id: 'attendantPerformance', name: 'Performance por Atendente', visible: true },
  { id: 'hourlyPeak', name: 'Horário de Pico de Leads', visible: true },
  { id: 'weekday', name: 'Leads por Dia da Semana', visible: true },
  { id: 'conversionRate', name: 'Taxa de Conversão por Origem', visible: true },
  { id: 'avgTicket', name: 'Ticket Médio por Origem', visible: true },
  { id: 'heatmap', name: 'Mapa de Calor', visible: true },
  { id: 'weeklyEvolution', name: 'Evolução Semanal', visible: true },
  { id: 'topCampaigns', name: 'Top Campanhas Meta Ads', visible: true },
  { id: 'topLinks', name: 'Top Links Rastreáveis', visible: true },
];

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface LeadsByDay {
  date: string;
  meta_ads: number;
  organico: number;
  links: number;
  total: number;
}

interface LeadsByOrigin {
  name: string;
  value: number;
  color: string;
}

interface ResponseTimeData {
  date: string;
  tempo_medio: number;
}

interface SalesData {
  date: string;
  vendas: number;
  valor: number;
}

interface AttendantPerformance {
  name: string;
  leads: number;
  conversoes: number;
  tempo_resposta: number;
}

interface ResponseRateData {
  ate_5min: number;
  ate_30min: number;
  mais_30min: number;
  sem_resposta: number;
  total: number;
}

interface HourlyData {
  hora: string;
  total: number;
}

interface WeekdayData {
  dia: string;
  total: number;
}

interface ConversionRateData {
  origem: string;
  total: number;
  convertidos: number;
  taxa: number;
}

interface TicketData {
  origem: string;
  ticket: number;
  vendas: number;
}

interface HeatmapData {
  dia: string;
  hora: number;
  valor: number;
}

interface WeeklyEvolution {
  semana: string;
  leads: number;
  conversoes: number;
}

interface TopCampaign {
  nome: string;
  leads: number;
  ad_source_id: string;
}

interface TopLink {
  nome: string;
  code: string;
  leads: number;
  convertidos: number;
  taxa: number;
}

const DashboardChartsTab: React.FC<DashboardChartsTabProps> = ({ clinicId }) => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '15d' | '30d'>('7d');
  
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [leadsByDay, setLeadsByDay] = useState<LeadsByDay[]>([]);
  const [leadsByOrigin, setLeadsByOrigin] = useState<LeadsByOrigin[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [attendantPerformance, setAttendantPerformance] = useState<AttendantPerformance[]>([]);
  const [responseRate, setResponseRate] = useState<ResponseRateData | null>(null);
  const [comparison, setComparison] = useState<{
    leadsHoje: number;
    leadsOntem: number;
    vendasHoje: number;
    vendasOntem: number;
  } | null>(null);
  
  // Novos estados para gráficos adicionais
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [weekdayData, setWeekdayData] = useState<WeekdayData[]>([]);
  const [conversionRateData, setConversionRateData] = useState<ConversionRateData[]>([]);
  const [ticketData, setTicketData] = useState<TicketData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [weeklyEvolution, setWeeklyEvolution] = useState<WeeklyEvolution[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);
  
  // Estados para configuração de gráficos
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [chartsConfig, setChartsConfig] = useState<ChartConfig[]>(() => {
    const saved = localStorage.getItem('dashboardChartsConfig');
    return saved ? JSON.parse(saved) : DEFAULT_CHARTS;
  });
  const [tempChartsConfig, setTempChartsConfig] = useState<ChartConfig[]>([]);
  
  // Estados para exportação PDF
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState<ChartConfig[]>([]);
  const [exporting, setExporting] = useState(false);
  const [clinicName, setClinicName] = useState<string>('');
  const chartsContainerRef = useRef<HTMLDivElement>(null);

  const getPeriodDays = () => {
    switch (period) {
      case 'today': return 0;
      case '7d': return 7;
      case '15d': return 15;
      case '30d': return 30;
    }
  };

  useEffect(() => {
    if (!clinicId) return;
    
    const fetchAllData = async () => {
      setLoading(true);
      const days = getPeriodDays();
      
      // Calcular data de início do período
      const getStartDate = () => {
        if (days === 0) {
          // Hoje: início do dia atual
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return today.toISOString();
        }
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      };
      const startDate = getStartDate();
      
      try {
        // 1. Funil de Conversão
        const { data: statusData } = await (supabase as any)
          .from('chats')
          .select('status')
          .eq('clinic_id', clinicId)
          .eq('is_group', false)
          .gte('created_at', startDate);
        
        if (statusData) {
          const statusCount: Record<string, number> = {};
          statusData.forEach((c: any) => {
            const status = c.status || 'Novo Lead';
            statusCount[status] = (statusCount[status] || 0) + 1;
          });
          
          const funnelColors: Record<string, string> = {
            'Novo Lead': '#10B981',
            'Em Atendimento': '#F59E0B',
            'Agendado': '#8B5CF6',
            'Convertido': '#059669',
            'Recorrente': '#06B6D4',
            'Perdido': '#EF4444',
          };
          
          const funnel: FunnelData[] = [
            { name: 'Novo Lead', value: statusCount['Novo Lead'] || 0, fill: funnelColors['Novo Lead'] },
            { name: 'Em Atendimento', value: statusCount['Em Atendimento'] || 0, fill: funnelColors['Em Atendimento'] },
            { name: 'Agendado', value: statusCount['Agendado'] || 0, fill: funnelColors['Agendado'] },
            { name: 'Convertido', value: statusCount['Convertido'] || 0, fill: funnelColors['Convertido'] },
            { name: 'Recorrente', value: statusCount['Recorrente'] || 0, fill: funnelColors['Recorrente'] },
          ];
          setFunnelData(funnel);
        }
        
        // 2. Leads por Dia e Origem
        const { data: chatsData } = await (supabase as any)
          .from('chats')
          .select('id, created_at, ad_source_id, source_id, status, meta_campaign_name, meta_ad_name, ad_title')
          .eq('clinic_id', clinicId)
          .eq('is_group', false)
          .gte('created_at', startDate)
          .order('created_at', { ascending: true });
        
        // Buscar IDs de links rastreáveis (fora do if para usar em outros gráficos)
        const { data: trackableLinks } = await (supabase as any)
          .from('trackable_links')
          .select('source_id, name, code')
          .eq('clinic_id', clinicId);
        
        const linkSourceIds = new Set((trackableLinks || []).map((l: any) => l.source_id));
        
        if (chatsData) {
          
          // Agrupar por dia
          const byDay: Record<string, { meta_ads: number; organico: number; links: number; total: number }> = {};
          let metaTotal = 0, organicoTotal = 0, linksTotal = 0;
          
          chatsData.forEach((chat: any) => {
            const date = new Date(chat.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!byDay[date]) {
              byDay[date] = { meta_ads: 0, organico: 0, links: 0, total: 0 };
            }
            
            if (chat.ad_source_id) {
              byDay[date].meta_ads++;
              metaTotal++;
            } else if (chat.source_id && linkSourceIds.has(chat.source_id)) {
              byDay[date].links++;
              linksTotal++;
            } else {
              byDay[date].organico++;
              organicoTotal++;
            }
            byDay[date].total++;
          });
          
          setLeadsByDay(Object.entries(byDay).map(([date, data]) => ({ date, ...data })));
          
          // Leads por origem (pizza)
          setLeadsByOrigin([
            { name: 'Meta Ads', value: metaTotal, color: '#10B981' },
            { name: 'Links', value: linksTotal, color: '#3B82F6' },
            { name: 'Orgânico', value: organicoTotal, color: '#64748B' },
          ]);
        }
        
        // 3. Tempo de Resposta por Dia
        const chatIds = chatsData?.map((c: any) => c.id) || [];
        if (chatIds.length > 0) {
          const { data: responseData } = await (supabase as any).rpc('get_response_times', {
            chat_ids: chatIds
          });
          
          if (responseData && chatsData) {
            const responseMap = new Map<string, number | null>(responseData.map((r: any) => [r.chat_id, r.response_time_seconds]));
            
            // Agrupar por dia
            const byDayResponse: Record<string, { total: number; count: number }> = {};
            let ate5min = 0, ate30min = 0, mais30min = 0, semResposta = 0;
            
            chatsData.forEach((chat: any) => {
              const date = new Date(chat.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              const responseTime = responseMap.get(chat.id) as number | null | undefined;
              
              if (!byDayResponse[date]) {
                byDayResponse[date] = { total: 0, count: 0 };
              }
              
              if (responseTime !== null && responseTime !== undefined && responseTime > 0) {
                byDayResponse[date].total += responseTime;
                byDayResponse[date].count++;
                
                if (responseTime <= 300) ate5min++;
                else if (responseTime <= 1800) ate30min++;
                else mais30min++;
              } else {
                semResposta++;
              }
            });
            
            setResponseTimeData(
              Object.entries(byDayResponse).map(([date, data]) => ({
                date,
                tempo_medio: data.count > 0 ? Math.round(data.total / data.count / 60) : 0
              }))
            );
            
            setResponseRate({
              ate_5min: ate5min,
              ate_30min: ate30min,
              mais_30min: mais30min,
              sem_resposta: semResposta,
              total: chatIds.length
            });
          }
        }
        
        // 4. Vendas por Dia
        const { data: paymentsData } = await (supabase as any)
          .from('payments')
          .select('value, created_at')
          .eq('clinic_id', clinicId)
          .gte('created_at', startDate)
          .order('created_at', { ascending: true });
        
        if (paymentsData) {
          const byDaySales: Record<string, { vendas: number; valor: number }> = {};
          
          paymentsData.forEach((p: any) => {
            const date = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!byDaySales[date]) {
              byDaySales[date] = { vendas: 0, valor: 0 };
            }
            byDaySales[date].vendas++;
            byDaySales[date].valor += parseFloat(p.value) || 0;
          });
          
          setSalesData(Object.entries(byDaySales).map(([date, data]) => ({ date, ...data })));
        }
        
        // 5. Performance por Atendente
        const { data: usersData } = await (supabase as any)
          .from('users')
          .select('id, name')
          .eq('clinic_id', clinicId)
          .in('role', ['Admin', 'Atendente', 'Comercial']);
        
        if (usersData && chatsData) {
          const performance: AttendantPerformance[] = [];
          
          for (const user of usersData) {
            // Contar leads atribuídos
            const { data: assignedChats } = await (supabase as any)
              .from('chats')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('assigned_to', user.id)
              .gte('created_at', startDate);
            
            // Contar conversões
            const { data: conversions } = await (supabase as any)
              .from('payments')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('created_by', user.id)
              .gte('created_at', startDate);
            
            performance.push({
              name: user.name?.split(' ')[0] || 'Sem nome',
              leads: assignedChats?.length || 0,
              conversoes: conversions?.length || 0,
              tempo_resposta: 0
            });
          }
          
          // Contar chats respondidos fora do sistema (sem assigned_to mas com respostas)
          const { data: chatsForaBelitx } = await (supabase as any)
            .from('chats')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('is_group', false)
            .is('assigned_to', null)
            .gte('created_at', startDate);
          
          // Verificar quais têm respostas (respondidos fora do sistema)
          let leadsForaBelitx = 0;
          if (chatsForaBelitx && chatsForaBelitx.length > 0) {
            const chatIds = chatsForaBelitx.map((c: any) => c.id);
            const { data: chatsComResposta } = await (supabase as any)
              .from('messages')
              .select('chat_id')
              .in('chat_id', chatIds)
              .eq('is_from_client', false);
            
            // Contar chats únicos com resposta
            const chatsUnicosComResposta = new Set((chatsComResposta || []).map((m: any) => m.chat_id));
            leadsForaBelitx = chatsUnicosComResposta.size;
          }
          
          // Adicionar "Fora da Belitx" se houver leads
          if (leadsForaBelitx > 0) {
            performance.push({
              name: 'Fora da Belitx',
              leads: leadsForaBelitx,
              conversoes: 0,
              tempo_resposta: 0
            });
          }
          
          setAttendantPerformance(performance.filter(p => p.leads > 0 || p.conversoes > 0));
        }
        
        // 6. Comparativo Hoje vs Ontem
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { data: leadsHoje } = await (supabase as any)
          .from('chats')
          .select('id', { count: 'exact' })
          .eq('clinic_id', clinicId)
          .eq('is_group', false)
          .gte('created_at', today.toISOString());
        
        const { data: leadsOntem } = await (supabase as any)
          .from('chats')
          .select('id', { count: 'exact' })
          .eq('clinic_id', clinicId)
          .eq('is_group', false)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString());
        
        const { data: vendasHoje } = await (supabase as any)
          .from('payments')
          .select('id', { count: 'exact' })
          .eq('clinic_id', clinicId)
          .gte('created_at', today.toISOString());
        
        const { data: vendasOntem } = await (supabase as any)
          .from('payments')
          .select('id', { count: 'exact' })
          .eq('clinic_id', clinicId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString());
        
        setComparison({
          leadsHoje: leadsHoje?.length || 0,
          leadsOntem: leadsOntem?.length || 0,
          vendasHoje: vendasHoje?.length || 0,
          vendasOntem: vendasOntem?.length || 0
        });
        
        // 7. Horário de Pico de Leads
        if (chatsData) {
          const byHour: Record<number, number> = {};
          for (let i = 0; i < 24; i++) byHour[i] = 0;
          
          chatsData.forEach((chat: any) => {
            const hour = new Date(chat.created_at).getHours();
            byHour[hour]++;
          });
          
          setHourlyData(
            Object.entries(byHour).map(([hora, total]) => ({
              hora: `${hora}h`,
              total
            }))
          );
        }
        
        // 8. Leads por Dia da Semana
        if (chatsData) {
          const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          const byWeekday: Record<number, number> = {};
          for (let i = 0; i < 7; i++) byWeekday[i] = 0;
          
          chatsData.forEach((chat: any) => {
            const day = new Date(chat.created_at).getDay();
            byWeekday[day]++;
          });
          
          setWeekdayData(
            Object.entries(byWeekday).map(([dia, total]) => ({
              dia: diasSemana[parseInt(dia)],
              total
            }))
          );
        }
        
        // 9. Taxa de Conversão por Origem
        if (chatsData) {
          const origens: Record<string, { total: number; convertidos: number }> = {
            'Meta Ads': { total: 0, convertidos: 0 },
            'Links': { total: 0, convertidos: 0 },
            'Orgânico': { total: 0, convertidos: 0 }
          };
          
          chatsData.forEach((chat: any) => {
            let origem = 'Orgânico';
            if (chat.ad_source_id) origem = 'Meta Ads';
            else if (chat.source_id && linkSourceIds.has(chat.source_id)) origem = 'Links';
            
            origens[origem].total++;
            if (chat.status === 'Convertido') {
              origens[origem].convertidos++;
            }
          });
          
          setConversionRateData(
            Object.entries(origens).map(([origem, data]) => ({
              origem,
              total: data.total,
              convertidos: data.convertidos,
              taxa: data.total > 0 ? Math.round((data.convertidos / data.total) * 1000) / 10 : 0
            }))
          );
        }
        
        // 10. Ticket Médio por Origem
        if (chatsData && paymentsData) {
          const chatOrigemMap = new Map<string, string>();
          chatsData.forEach((chat: any) => {
            let origem = 'Orgânico';
            if (chat.ad_source_id) origem = 'Meta Ads';
            else if (chat.source_id && linkSourceIds.has(chat.source_id)) origem = 'Links';
            chatOrigemMap.set(chat.id, origem);
          });
          
          const ticketByOrigem: Record<string, { total: number; count: number }> = {
            'Meta Ads': { total: 0, count: 0 },
            'Links': { total: 0, count: 0 },
            'Orgânico': { total: 0, count: 0 }
          };
          
          paymentsData.forEach((p: any) => {
            const origem = chatOrigemMap.get(p.chat_id) || 'Orgânico';
            ticketByOrigem[origem].total += parseFloat(p.value) || 0;
            ticketByOrigem[origem].count++;
          });
          
          setTicketData(
            Object.entries(ticketByOrigem)
              .filter(([_, data]) => data.count > 0)
              .map(([origem, data]) => ({
                origem,
                ticket: Math.round(data.total / data.count),
                vendas: data.count
              }))
          );
        }
        
        // 11. Mapa de Calor (Heatmap)
        if (chatsData) {
          const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          const heatmap: HeatmapData[] = [];
          const heatmapMap: Record<string, number> = {};
          
          chatsData.forEach((chat: any) => {
            const d = new Date(chat.created_at);
            const key = `${d.getDay()}-${d.getHours()}`;
            heatmapMap[key] = (heatmapMap[key] || 0) + 1;
          });
          
          for (let dia = 0; dia < 7; dia++) {
            for (let hora = 0; hora < 24; hora++) {
              const key = `${dia}-${hora}`;
              heatmap.push({
                dia: diasSemana[dia],
                hora,
                valor: heatmapMap[key] || 0
              });
            }
          }
          
          setHeatmapData(heatmap);
        }
        
        // 12. Evolução Semanal
        if (chatsData) {
          const semanas: Record<string, { leads: number; conversoes: number }> = {};
          
          chatsData.forEach((chat: any) => {
            const d = new Date(chat.created_at);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const weekKey = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            
            if (!semanas[weekKey]) {
              semanas[weekKey] = { leads: 0, conversoes: 0 };
            }
            semanas[weekKey].leads++;
            if (chat.status === 'Convertido') {
              semanas[weekKey].conversoes++;
            }
          });
          
          setWeeklyEvolution(
            Object.entries(semanas)
              .slice(-4)
              .map(([semana, data]) => ({
                semana: `Sem ${semana}`,
                leads: data.leads,
                conversoes: data.conversoes
              }))
          );
        }
        
        // 13. Top Campanhas/Anúncios Meta Ads
        if (chatsData) {
          const campanhas: Record<string, { nome: string; leads: number; ad_source_id: string }> = {};
          
          chatsData.forEach((chat: any) => {
            if (chat.ad_source_id) {
              const nome = chat.meta_campaign_name || chat.meta_ad_name || chat.ad_title || 'Campanha sem nome';
              if (!campanhas[chat.ad_source_id]) {
                campanhas[chat.ad_source_id] = { nome, leads: 0, ad_source_id: chat.ad_source_id };
              }
              campanhas[chat.ad_source_id].leads++;
            }
          });
          
          setTopCampaigns(
            Object.values(campanhas)
              .sort((a, b) => b.leads - a.leads)
              .slice(0, 5)
          );
        }
        
        // 14. Top Links Rastreáveis - Buscar por mensagens com código [CODIGO]
        if (trackableLinks && trackableLinks.length > 0) {
          const linksMap: Record<string, TopLink> = {};
          
          // Para cada link, buscar mensagens que contêm o código
          for (const link of trackableLinks) {
            if (!link.code) continue;
            
            // Buscar mensagens com o código do link no período (colchetes ou parênteses)
            const { data: messagesWithCode } = await (supabase as any)
              .from('messages')
              .select('chat_id')
              .or(`content.ilike.%[${link.code}]%,content.ilike.%(${link.code})%`)
              .gte('created_at', startDate);
            
            const uniqueChatIds = [...new Set((messagesWithCode || []).map((m: any) => m.chat_id))];
            
            if (uniqueChatIds.length > 0) {
              // Buscar status dos chats
              const { data: chatsFromLink } = await (supabase as any)
                .from('chats')
                .select('id, status')
                .eq('clinic_id', clinicId)
                .in('id', uniqueChatIds);
              
              const convertidos = (chatsFromLink || []).filter((c: any) => c.status === 'Convertido').length;
              
              linksMap[link.code] = {
                nome: link.name || `Link ${link.code}`,
                code: link.code,
                leads: uniqueChatIds.length,
                convertidos: convertidos,
                taxa: uniqueChatIds.length > 0 ? Math.round((convertidos / uniqueChatIds.length) * 1000) / 10 : 0
              };
            }
          }
          
          // Ordenar por leads
          const topLinksArray = Object.values(linksMap)
            .filter(link => link.leads > 0)
            .sort((a, b) => b.leads - a.leads)
            .slice(0, 5);
          
          setTopLinks(topLinksArray);
        }
        
      } catch (error) {
        console.error('Erro ao buscar dados dos gráficos:', error);
      }
      
      setLoading(false);
    };
    
    fetchAllData();
  }, [clinicId, period]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const HelpTooltip = ({ text }: { text: string }) => (
    <div className="relative group inline-block ml-2">
      <span className="material-symbols-outlined text-[14px] text-slate-400 cursor-help hover:text-slate-600">info</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 text-center z-50 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );

  // Funções para configuração de gráficos
  const openConfigModal = () => {
    setTempChartsConfig([...chartsConfig]);
    setShowConfigModal(true);
  };

  const saveChartsConfig = () => {
    setChartsConfig(tempChartsConfig);
    localStorage.setItem('dashboardChartsConfig', JSON.stringify(tempChartsConfig));
    setShowConfigModal(false);
  };

  const toggleChartVisibility = (id: string) => {
    setTempChartsConfig(prev => prev.map(c => 
      c.id === id ? { ...c, visible: !c.visible } : c
    ));
  };

  const moveChart = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tempChartsConfig.length) return;
    
    const newConfig = [...tempChartsConfig];
    [newConfig[index], newConfig[newIndex]] = [newConfig[newIndex], newConfig[index]];
    setTempChartsConfig(newConfig);
  };

  const resetChartsConfig = () => {
    setTempChartsConfig([...DEFAULT_CHARTS]);
  };

  const isChartVisible = (id: string) => {
    const chart = chartsConfig.find(c => c.id === id);
    return chart ? chart.visible : true;
  };

  const getChartOrder = () => {
    return chartsConfig.filter(c => c.visible).map(c => c.id);
  };

  // Funções de exportação PDF
  const openExportModal = () => {
    // Inicializar com os gráficos visíveis marcados
    setExportConfig(chartsConfig.map(c => ({ ...c, visible: c.visible })));
    setShowExportModal(true);
  };

  const toggleExportChart = (id: string) => {
    setExportConfig(prev => prev.map(c => 
      c.id === id ? { ...c, visible: !c.visible } : c
    ));
  };

  const selectAllExport = () => {
    setExportConfig(prev => prev.map(c => ({ ...c, visible: true })));
  };

  const deselectAllExport = () => {
    setExportConfig(prev => prev.map(c => ({ ...c, visible: false })));
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoje';
      case '7d': return 'Últimos 7 dias';
      case '15d': return 'Últimos 15 dias';
      case '30d': return 'Últimos 30 dias';
    }
  };

  const exportToPDF = async () => {
    if (!chartsContainerRef.current) return;
    
    setExporting(true);
    
    try {
      // Buscar nome da clínica
      let clinicDisplayName = 'Relatório';
      if (clinicId) {
        const { data } = await (supabase as any)
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();
        if (data?.name) clinicDisplayName = data.name;
      }

      const chartsToExport = exportConfig.filter(c => c.visible).map(c => c.id);
      
      // Criar PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Cabeçalho
      pdf.setFontSize(20);
      pdf.setTextColor(16, 185, 129); // emerald-500
      pdf.text(clinicDisplayName, margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(12);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Relatório de Análise Comercial - ${getPeriodLabel()}`, margin, yPosition);
      yPosition += 6;

      pdf.setFontSize(10);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, yPosition);
      yPosition += 15;

      // Linha separadora
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Capturar cada gráfico selecionado
      const chartElements = chartsContainerRef.current.querySelectorAll('[data-chart-id]');
      
      for (const element of chartElements) {
        const chartId = element.getAttribute('data-chart-id');
        if (!chartId || !chartsToExport.includes(chartId)) continue;

        const chartConfig = exportConfig.find(c => c.id === chartId);
        if (!chartConfig) continue;

        // Verificar se precisa de nova página
        if (yPosition > pageHeight - 100) {
          pdf.addPage();
          yPosition = margin;
        }

        // Título do gráfico
        pdf.setFontSize(14);
        pdf.setTextColor(30, 41, 59); // slate-800
        pdf.text(chartConfig.name, margin, yPosition);
        yPosition += 8;

        try {
          // Capturar o elemento como imagem
          const canvas = await html2canvas(element as HTMLElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Verificar se a imagem cabe na página
          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 120));
          yPosition += Math.min(imgHeight, 120) + 15;
        } catch (err) {
          console.error(`Erro ao capturar gráfico ${chartId}:`, err);
        }
      }

      // Rodapé na última página
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text('Gerado pelo LeadCare', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Salvar PDF
      const fileName = `relatorio-${clinicDisplayName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      setShowExportModal(false);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  // Buscar nome da clínica ao carregar
  useEffect(() => {
    const fetchClinicName = async () => {
      if (!clinicId) return;
      const { data } = await (supabase as any)
        .from('clinics')
        .select('name')
        .eq('id', clinicId)
        .single();
      if (data?.name) setClinicName(data.name);
    };
    fetchClinicName();
  }, [clinicId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro de Período */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Análise Comercial</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={openExportModal}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Exportar para PDF"
          >
            <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
            <span className="text-sm font-medium hidden sm:inline">Exportar PDF</span>
          </button>
          <button
            onClick={openConfigModal}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Configurar gráficos"
          >
            <span className="material-symbols-outlined text-xl">tune</span>
          </button>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['today', '7d', '15d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'today' ? 'Hoje' : p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : '30 dias'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Configuração de Gráficos */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowConfigModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Configurar Gráficos</h3>
                <p className="text-sm text-slate-500">Escolha quais gráficos exibir e a ordem</p>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {tempChartsConfig.map((chart, index) => (
                  <div 
                    key={chart.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      chart.visible 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => toggleChartVisibility(chart.id)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        chart.visible 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-slate-300 text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {chart.visible ? 'check' : 'remove'}
                      </span>
                    </button>
                    
                    <span className={`flex-1 text-sm font-medium ${chart.visible ? 'text-slate-900' : 'text-slate-400'}`}>
                      {chart.name}
                    </span>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveChart(index, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded ${index === 0 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        <span className="material-symbols-outlined text-lg">keyboard_arrow_up</span>
                      </button>
                      <button
                        onClick={() => moveChart(index, 'down')}
                        disabled={index === tempChartsConfig.length - 1}
                        className={`p-1 rounded ${index === tempChartsConfig.length - 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={resetChartsConfig}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Restaurar padrão
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveChartsConfig}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação PDF */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !exporting && setShowExportModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-red-500 to-rose-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                    Exportar para PDF
                  </h3>
                  <p className="text-sm text-red-100">Selecione os gráficos para incluir no relatório</p>
                </div>
                <button 
                  onClick={() => !exporting && setShowExportModal(false)} 
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  disabled={exporting}
                >
                  <span className="material-symbols-outlined text-white">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="text-sm text-slate-600">
                <span className="font-medium">{exportConfig.filter(c => c.visible).length}</span> de {exportConfig.length} selecionados
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllExport}
                  className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  Selecionar todos
                </button>
                <button
                  onClick={deselectAllExport}
                  className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-100 rounded"
                >
                  Limpar
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {exportConfig.map((chart) => (
                  <label 
                    key={chart.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      chart.visible 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={chart.visible}
                      onChange={() => toggleExportChart(chart.id)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className={`flex-1 text-sm font-medium ${chart.visible ? 'text-slate-900' : 'text-slate-400'}`}>
                      {chart.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Período: <span className="font-medium">{getPeriodLabel()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={exporting}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={exportToPDF}
                  disabled={exporting || exportConfig.filter(c => c.visible).length === 0}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Gerando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">download</span>
                      Exportar PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Container com ref para captura dos gráficos */}
      <div ref={chartsContainerRef}>

      {/* Cards Comparativos */}
      {isChartVisible('cards') && comparison && (
        <div data-chart-id="cards" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Leads Hoje</p>
            <p className="text-2xl font-bold text-slate-900">{comparison.leadsHoje}</p>
            <p className={`text-xs ${getPercentChange(comparison.leadsHoje, comparison.leadsOntem) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {getPercentChange(comparison.leadsHoje, comparison.leadsOntem) >= 0 ? '↑' : '↓'} {Math.abs(getPercentChange(comparison.leadsHoje, comparison.leadsOntem))}% vs ontem
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Vendas Hoje</p>
            <p className="text-2xl font-bold text-emerald-600">{comparison.vendasHoje}</p>
            <p className={`text-xs ${getPercentChange(comparison.vendasHoje, comparison.vendasOntem) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {getPercentChange(comparison.vendasHoje, comparison.vendasOntem) >= 0 ? '↑' : '↓'} {Math.abs(getPercentChange(comparison.vendasHoje, comparison.vendasOntem))}% vs ontem
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Taxa Resposta ≤5min</p>
            <p className="text-2xl font-bold text-blue-600">
              {responseRate ? Math.round((responseRate.ate_5min / responseRate.total) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-400">{responseRate?.ate_5min || 0} de {responseRate?.total || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Sem Resposta</p>
            <p className="text-2xl font-bold text-red-600">{responseRate?.sem_resposta || 0}</p>
            <p className="text-xs text-slate-400">
              {responseRate ? Math.round((responseRate.sem_resposta / responseRate.total) * 100) : 0}% do total
            </p>
          </div>
        </div>
      )}

      {/* Linha 1: Funil + Origem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funil de Conversão */}
        <div data-chart-id="funnel" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Funil de Conversão<HelpTooltip text="Mostra a jornada dos leads desde a entrada até a conversão. Identifique gargalos no processo de vendas." /></h3>
          {funnelData.length > 0 ? (
            <div className="h-80" style={{ minWidth: 0, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Leads']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <p>Carregando dados...</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {funnelData.slice(0, 3).map((item) => (
              <div key={item.name} className="text-xs">
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: item.fill }}></div>
                <p className="text-slate-500">{item.name}</p>
                <p className="font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leads por Origem */}
        <div data-chart-id="origin" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Leads por Origem<HelpTooltip text="Distribuição dos leads por canal de aquisição: Meta Ads, Links Rastreáveis ou Orgânico (sem origem identificada)." /></h3>
          {leadsByOrigin.length > 0 && leadsByOrigin.some(l => l.value > 0) ? (
          <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={leadsByOrigin}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {leadsByOrigin.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de origem</p>
            </div>
          )}
          <div className="flex justify-center gap-6 mt-2">
            {leadsByOrigin.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-slate-600">{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 2: Leads por Dia */}
      <div data-chart-id="leadsByDay" className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Leads por Dia<HelpTooltip text="Evolução diária de novos leads separados por origem. Acompanhe tendências e identifique dias de maior movimento." /></h3>
        {leadsByDay.length > 0 ? (
        <div className="h-72" style={{ minWidth: 0, minHeight: 288 }}>
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={leadsByDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar dataKey="meta_ads" name="Meta Ads" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="links" name="Links" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="organico" name="Orgânico" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-slate-400">
            <p>Sem dados de leads por dia</p>
          </div>
        )}
      </div>

      {/* Linha 3: Tempo de Resposta + Vendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Médio de Resposta */}
        <div data-chart-id="responseTime" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Tempo Médio de Resposta (min)<HelpTooltip text="Tempo médio entre a primeira mensagem do cliente e a primeira resposta da equipe. Meta ideal: até 5 minutos." /></h3>
          {responseTimeData.length > 0 ? (
          <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value} min`, 'Tempo médio']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <defs>
                  <linearGradient id="colorTempo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="tempo_medio" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  fill="url(#colorTempo)" 
                />
                {/* Linha de referência em 5 min */}
                <Line type="monotone" dataKey={() => 5} stroke="#10B981" strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de tempo de resposta</p>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2 text-center">
            <span className="inline-block w-3 h-0.5 bg-emerald-500 mr-1"></span>
            Meta ideal: 5 minutos
          </p>
        </div>

        {/* Vendas por Dia */}
        <div data-chart-id="salesByDay" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Vendas por Dia<HelpTooltip text="Quantidade de vendas e valor total faturado por dia. Acompanhe o desempenho comercial diário." /></h3>
          {salesData.length > 0 ? (
          <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'valor' ? formatCurrency(value) : value,
                    name === 'valor' ? 'Valor' : 'Vendas'
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="vendas" name="Vendas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="valor" name="Valor" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de vendas</p>
            </div>
          )}
        </div>
      </div>

      {/* Linha 4: Taxa de Resposta + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de Resposta */}
        <div data-chart-id="responseDistribution" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Distribuição do Tempo de Resposta<HelpTooltip text="Percentual de leads respondidos em cada faixa de tempo. Quanto mais rápido, maior a chance de conversão." /></h3>
          {responseRate && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-600">≤ 5 min</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(responseRate.ate_5min / responseRate.total) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{responseRate.ate_5min}</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-right text-slate-500">
                  {Math.round((responseRate.ate_5min / responseRate.total) * 100)}%
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-600">5-30 min</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(responseRate.ate_30min / responseRate.total) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{responseRate.ate_30min}</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-right text-slate-500">
                  {Math.round((responseRate.ate_30min / responseRate.total) * 100)}%
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-600">&gt; 30 min</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(responseRate.mais_30min / responseRate.total) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{responseRate.mais_30min}</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-right text-slate-500">
                  {Math.round((responseRate.mais_30min / responseRate.total) * 100)}%
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-600">Sem resposta</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(responseRate.sem_resposta / responseRate.total) * 100}%` }}
                  >
                    <span className="text-xs text-white font-medium">{responseRate.sem_resposta}</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-right text-slate-500">
                  {Math.round((responseRate.sem_resposta / responseRate.total) * 100)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Performance por Atendente */}
        <div data-chart-id="attendantPerformance" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Performance por Atendente<HelpTooltip text="Comparativo de leads atribuídos e conversões realizadas por cada atendente da equipe." /></h3>
          {attendantPerformance.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={attendantPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="leads" name="Leads" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="conversoes" name="Conversões" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Nenhum dado de performance disponível</p>
            </div>
          )}
        </div>
      </div>

      {/* Linha 5: Horário de Pico + Dia da Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horário de Pico de Leads */}
        <div data-chart-id="hourlyPeak" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Horário de Pico de Leads<HelpTooltip text="Distribuição de leads por hora do dia. Use para escalar atendentes nos horários de maior demanda." /></h3>
          {hourlyData.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Leads']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de horário</p>
            </div>
          )}
        </div>

        {/* Leads por Dia da Semana */}
        <div data-chart-id="weekday" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Leads por Dia da Semana<HelpTooltip text="Quais dias da semana têm mais leads. Útil para planejar escalas e campanhas de marketing." /></h3>
          {weekdayData.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Leads']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de dia da semana</p>
            </div>
          )}
        </div>
      </div>

      {/* Linha 6: Taxa de Conversão + Ticket Médio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de Conversão por Origem */}
        <div data-chart-id="conversionRate" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Taxa de Conversão por Origem<HelpTooltip text="Percentual de leads que se tornaram clientes por canal. Identifique qual origem traz leads mais qualificados." /></h3>
          {conversionRateData.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={conversionRateData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="origem" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'taxa' ? `${value}%` : value,
                      name === 'taxa' ? 'Taxa' : name === 'total' ? 'Total Leads' : 'Convertidos'
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="taxa" name="Taxa %" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de conversão</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {conversionRateData.map((item) => (
              <div key={item.origem}>
                <p className="text-slate-500">{item.origem}</p>
                <p className="font-bold text-slate-900">{item.convertidos}/{item.total}</p>
                <p className="text-emerald-600">{item.taxa}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket Médio por Origem */}
        <div data-chart-id="avgTicket" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Ticket Médio por Origem<HelpTooltip text="Valor médio de venda por canal de aquisição. Descubra qual origem gera mais receita por cliente." /></h3>
          {ticketData.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={ticketData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <YAxis type="category" dataKey="origem" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'ticket' ? formatCurrency(value) : value,
                      name === 'ticket' ? 'Ticket Médio' : 'Vendas'
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="ticket" name="Ticket Médio" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de ticket médio</p>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-6 text-xs">
            {ticketData.map((item) => (
              <div key={item.origem} className="text-center">
                <p className="text-slate-500">{item.origem}</p>
                <p className="font-bold text-violet-600">{formatCurrency(item.ticket)}</p>
                <p className="text-slate-400">{item.vendas} vendas</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 7: Mapa de Calor */}
      <div data-chart-id="heatmap" className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Mapa de Calor - Leads por Horário e Dia<HelpTooltip text="Visualização de quando chegam mais leads combinando dia da semana e hora. Cores mais intensas = mais leads." /></h3>
        {heatmapData.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex">
                <div className="w-12"></div>
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-slate-500">{i}h</div>
                ))}
              </div>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, diaIdx) => (
                <div key={dia} className="flex items-center">
                  <div className="w-12 text-xs text-slate-600 font-medium">{dia}</div>
                  {Array.from({ length: 24 }, (_, hora) => {
                    const item = heatmapData.find(h => h.dia === dia && h.hora === hora);
                    const valor = item?.valor || 0;
                    const maxValor = Math.max(...heatmapData.map(h => h.valor));
                    const intensity = maxValor > 0 ? valor / maxValor : 0;
                    return (
                      <div
                        key={hora}
                        className="flex-1 h-8 border border-white flex items-center justify-center text-[9px] font-medium"
                        style={{
                          backgroundColor: valor > 0 
                            ? `rgba(16, 185, 129, ${0.1 + intensity * 0.9})` 
                            : '#f1f5f9',
                          color: intensity > 0.5 ? 'white' : '#64748b'
                        }}
                        title={`${dia} ${hora}h: ${valor} leads`}
                      >
                        {valor > 0 ? valor : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
              <span>Menos</span>
              <div className="flex gap-1">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                  <div 
                    key={i} 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${i})` }}
                  ></div>
                ))}
              </div>
              <span>Mais</span>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <p>Sem dados para o mapa de calor</p>
          </div>
        )}
      </div>

      {/* Linha 8: Evolução Semanal + Top Campanhas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Semanal */}
        <div data-chart-id="weeklyEvolution" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Evolução Semanal<HelpTooltip text="Comparativo de leads e conversões por semana. Acompanhe tendências e crescimento ao longo do tempo." /></h3>
          {weeklyEvolution.length > 0 ? (
            <div className="h-64" style={{ minWidth: 0, minHeight: 256 }}>
              <ResponsiveContainer width="100%" height={256}>
                <LineChart data={weeklyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                  <Line type="monotone" dataKey="conversoes" name="Conversões" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Sem dados de evolução semanal</p>
            </div>
          )}
        </div>

        {/* Top Campanhas Meta Ads */}
        <div data-chart-id="topCampaigns" className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Top Campanhas Meta Ads<HelpTooltip text="Ranking das campanhas de anúncios Meta (Facebook/Instagram) que mais geraram leads. Identifique os anúncios mais eficientes." /></h3>
          {topCampaigns.length > 0 ? (
            <div className="space-y-3">
              {topCampaigns.map((campaign, idx) => (
                <div key={campaign.ad_source_id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{campaign.nome}</p>
                    <p className="text-xs text-slate-500">{campaign.leads} leads</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(campaign.leads / topCampaigns[0].leads) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>Nenhuma campanha Meta Ads encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Linha 9: Top Links Rastreáveis */}
      <div data-chart-id="topLinks" className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Top Links Rastreáveis<HelpTooltip text="Ranking dos links rastreáveis que mais geraram leads. Mostra também a taxa de conversão de cada link." /></h3>
        {topLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Link</th>
                  <th className="text-center py-2 font-medium">Leads</th>
                  <th className="text-center py-2 font-medium">Convertidos</th>
                  <th className="text-center py-2 font-medium">Taxa</th>
                  <th className="text-right py-2 font-medium">Performance</th>
                </tr>
              </thead>
              <tbody>
                {topLinks.map((link, idx) => (
                  <tr key={link.code} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                        idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-blue-400' : idx === 2 ? 'bg-blue-300' : 'bg-slate-300'
                      }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-medium text-slate-900">{link.nome}</p>
                      <p className="text-xs text-slate-400">Código: {link.code}</p>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm font-semibold text-slate-900">{link.leads}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm font-semibold text-emerald-600">{link.convertidos}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-sm font-semibold ${link.taxa >= 10 ? 'text-emerald-600' : link.taxa >= 5 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {link.taxa}%
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden ml-auto">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(link.leads / topLinks[0].leads) * 100}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400">
            <p>Nenhum link rastreável com leads no período</p>
          </div>
        )}
      </div>
      </div> {/* Fechamento do chartsContainerRef */}
    </div>
  );
};

export default DashboardChartsTab;
