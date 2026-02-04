import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LeadItem {
  id: string;
  client_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  ad_source_id: string | null;
  meta_ad_name: string | null;
  meta_campaign_name: string | null;
  source_id: string | null;
  assigned_to: string | null;
  lead_sources?: { id: string; name: string; code: string } | null;
  users?: { id: string; name: string } | null;
  total_payments?: number;
  // Novos campos para resposta
  responded_by_name?: string | null;
  response_time_seconds?: number | null;
  is_remarketing?: boolean;
  is_returning_client?: boolean;
}

interface Props {
  clinicId: string;
}

type OriginType = 'all' | 'meta' | 'link' | 'source' | 'organic';
type PeriodType = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export default function DashboardLeadsTab({ clinicId }: Props) {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('today');
  const [originFilter, setOriginFilter] = useState<OriginType>('all');
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [customDate, setCustomDate] = useState<string>('');
  const [trackableLinkSourceIds, setTrackableLinkSourceIds] = useState<Set<string>>(new Set());
  const [paymentsMap, setPaymentsMap] = useState<Record<string, number>>({});
  const [paymentCreatorsMap, setPaymentCreatorsMap] = useState<Record<string, string>>({});
  const [tagsMap, setTagsMap] = useState<Record<string, Array<{ name: string; color: string }>>>({});
  const [selectedLeadPayments, setSelectedLeadPayments] = useState<Array<{
    id: string;
    value: number;
    description: string | null;
    payment_date: string;
    payment_method: string | null;
    status: string;
    created_at: string;
    created_by_name: string | null;
  }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [responseDataMap, setResponseDataMap] = useState<Record<string, { responded_by: string | null; response_time: number | null }>>({});
  const [clickCountMap, setClickCountMap] = useState<Record<string, number>>({});
  
  // Estado para card expandido no mobile
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  
  // Estados para modal de histórico
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<Array<{
    clickedAt: string;
    respondedBy: string | null;
    responseTime: number | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  }>>([]);
  const [historyLeadName, setHistoryLeadName] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Buscar links rastreáveis para identificar tipo 'link'
  useEffect(() => {
    if (!clinicId) return;
    
    const fetchTrackableLinks = async () => {
      const { data } = await (supabase as any)
        .from('trackable_links')
        .select('source_id')
        .eq('clinic_id', clinicId);
      
      if (data) {
        setTrackableLinkSourceIds(new Set(data.map((l: any) => l.source_id).filter(Boolean)));
      }
    };
    
    fetchTrackableLinks();
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    
    const fetchLeads = async () => {
      setLoading(true);
      
      // Calcular data de início e fim baseado no período
      const now = new Date();
      let startDate: Date;
      let endDate: Date | null = null;
      
      if (period === 'today') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'yesterday') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === '7d') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === 'custom' && customDate) {
        startDate = new Date(customDate + 'T00:00:00');
        endDate = new Date(customDate + 'T23:59:59');
      } else {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
      }
      
      // Buscar TODOS os chats (sem filtro de data) para depois filtrar por criação OU clique
      const { data: allChatsData } = await (supabase as any)
        .from('chats')
        .select('id, client_name, phone_number, status, created_at, ad_source_id, meta_ad_name, meta_campaign_name, source_id, assigned_to, lead_sources(id, name, code), users:assigned_to(id, name)')
        .eq('clinic_id', clinicId)
        .eq('is_group', false)
        .order('created_at', { ascending: false });
      
      // Buscar cliques de links para identificar remarketing
      const { data: linkClicksData } = await (supabase as any)
        .from('link_clicks')
        .select('chat_id, clicked_at')
        .eq('clinic_id', clinicId)
        .not('chat_id', 'is', null);
      
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
      
      // Filtrar chats por criação OU último clique no período
      const data = (allChatsData || []).filter((chat: any) => {
        const createdAt = new Date(chat.created_at);
        const lastClick = lastClickByChat[chat.id];
        
        if (endDate) {
          const createdInPeriod = createdAt >= startDate && createdAt <= endDate;
          const clickedInPeriod = lastClick && lastClick >= startDate && lastClick <= endDate;
          return createdInPeriod || clickedInPeriod;
        } else {
          const createdInPeriod = createdAt >= startDate;
          const clickedInPeriod = lastClick && lastClick >= startDate;
          return createdInPeriod || clickedInPeriod;
        }
      });
      
      if (data) {
        setLeads(data);
        
        // Buscar pagamentos de todos os leads com o criador (em lotes para evitar URL muito longa)
        const chatIds = data.map((l: LeadItem) => l.id);
        if (chatIds.length > 0) {
          const valueMap: Record<string, number> = {};
          const creatorIds = new Set<string>();
          const allPayments: any[] = [];
          
          // Dividir em lotes de 50 para evitar erro 400
          const batchSize = 50;
          for (let i = 0; i < chatIds.length; i += batchSize) {
            const batch = chatIds.slice(i, i + batchSize);
            const { data: payments } = await (supabase as any)
              .from('payments')
              .select('chat_id, value, created_by')
              .in('chat_id', batch)
              .neq('status', 'cancelled');
            
            if (payments) {
              allPayments.push(...payments);
            }
          }
          
          if (allPayments.length > 0) {
            allPayments.forEach((p: any) => {
              const paymentValue = parseFloat(p.value) || 0;
              valueMap[p.chat_id] = (valueMap[p.chat_id] || 0) + paymentValue;
              if (p.created_by) {
                creatorIds.add(p.created_by);
              }
            });
            setPaymentsMap(valueMap);
            
            // Buscar nomes dos usuários separadamente
            if (creatorIds.size > 0) {
              const { data: usersData } = await (supabase as any)
                .from('users')
                .select('id, name')
                .in('id', Array.from(creatorIds));
              
              if (usersData) {
                const usersMap: Record<string, string> = {};
                usersData.forEach((u: any) => {
                  usersMap[u.id] = u.name;
                });
                
                const creatorMap: Record<string, string> = {};
                allPayments.forEach((p: any) => {
                  if (p.created_by && usersMap[p.created_by]) {
                    creatorMap[p.chat_id] = usersMap[p.created_by];
                  }
                });
                setPaymentCreatorsMap(creatorMap);
              }
            }
          }
          
          // Buscar tags de todos os leads (em lotes)
          const tagsMapTemp: Record<string, Array<{ name: string; color: string }>> = {};
          for (let i = 0; i < chatIds.length; i += batchSize) {
            const batch = chatIds.slice(i, i + batchSize);
            const { data: chatTags } = await (supabase as any)
              .from('chat_tags')
              .select('chat_id, tags(name, color)')
              .in('chat_id', batch);
            
            if (chatTags) {
              chatTags.forEach((ct: any) => {
                if (ct.tags) {
                  if (!tagsMapTemp[ct.chat_id]) {
                    tagsMapTemp[ct.chat_id] = [];
                  }
                  tagsMapTemp[ct.chat_id].push({ name: ct.tags.name, color: ct.tags.color });
                }
              });
            }
          }
          setTagsMap(tagsMapTemp);
          
          // Buscar dados de resposta - para links rastreáveis, usar dados do ÚLTIMO clique
          const responseMap: Record<string, { responded_by: string | null; response_time: number | null }> = {};
          const clicksCountMap: Record<string, number> = {};
          
          // Buscar todos os trackable_links da clínica
          const { data: trackableLinks } = await (supabase as any)
            .from('trackable_links')
            .select('id, source_id')
            .eq('clinic_id', clinicId);
          
          const trackableLinkIds = new Set((trackableLinks || []).map((l: any) => l.source_id).filter(Boolean));
          const linkIdBySourceId: Record<string, string> = {};
          (trackableLinks || []).forEach((l: any) => {
            if (l.source_id) linkIdBySourceId[l.source_id] = l.id;
          });
          
          // Para cada lead, verificar se é de link rastreável
          for (const lead of data) {
            const isFromTrackableLink = lead.source_id && trackableLinkIds.has(lead.source_id);
            
            if (isFromTrackableLink) {
              const linkId = linkIdBySourceId[lead.source_id];
              
              // Buscar cliques deste link para este chat
              const { data: clicks } = await (supabase as any)
                .from('link_clicks')
                .select('id, clicked_at')
                .eq('link_id', linkId)
                .eq('chat_id', lead.id)
                .order('clicked_at', { ascending: false });
              
              clicksCountMap[lead.id] = clicks?.length || 0;
              
              if (clicks && clicks.length > 0) {
                const lastClick = clicks[0]; // Mais recente
                const lastClickTime = new Date(lastClick.clicked_at);
                const marginTime = new Date(lastClickTime.getTime() - 60 * 1000);
                
                // Buscar primeira mensagem do cliente após o último clique
                const { data: clientMsg } = await (supabase as any)
                  .from('messages')
                  .select('created_at')
                  .eq('chat_id', lead.id)
                  .eq('is_from_client', true)
                  .gte('created_at', marginTime.toISOString())
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .single();
                
                if (clientMsg) {
                  // Buscar primeira resposta após a mensagem do cliente
                  const { data: response } = await (supabase as any)
                    .from('messages')
                    .select('created_at, sent_by')
                    .eq('chat_id', lead.id)
                    .eq('is_from_client', false)
                    .gte('created_at', clientMsg.created_at)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();
                  
                  if (response) {
                    const clientMsgTime = new Date(clientMsg.created_at).getTime();
                    const responseTime = new Date(response.created_at).getTime();
                    const responseSeconds = Math.floor((responseTime - clientMsgTime) / 1000);
                    
                    let respondedByName = null;
                    if (response.sent_by) {
                      const { data: userData } = await supabase
                        .from('users')
                        .select('name')
                        .eq('id', response.sent_by)
                        .single();
                      respondedByName = (userData as any)?.name || null;
                    }
                    
                    responseMap[lead.id] = {
                      responded_by: respondedByName,
                      response_time: responseSeconds
                    };
                  } else {
                    // Ainda não respondeu após o último clique
                    responseMap[lead.id] = { responded_by: null, response_time: null };
                  }
                } else {
                  // Ainda não mandou mensagem após o último clique
                  responseMap[lead.id] = { responded_by: null, response_time: null };
                }
              } else {
                responseMap[lead.id] = { responded_by: null, response_time: null };
              }
            } else {
              // Não é link rastreável - usar RPC ou fallback
              try {
                const { data: responseData } = await (supabase as any).rpc('get_response_times', {
                  chat_ids: [lead.id]
                });
                if (responseData && responseData[0]) {
                  responseMap[lead.id] = {
                    responded_by: responseData[0].responded_by_name || null,
                    response_time: responseData[0].response_time_seconds
                  };
                } else {
                  responseMap[lead.id] = { responded_by: lead.users?.name || null, response_time: null };
                }
              } catch (e) {
                responseMap[lead.id] = { responded_by: lead.users?.name || null, response_time: null };
              }
            }
          }
          
          setResponseDataMap(responseMap);
          setClickCountMap(clicksCountMap);
        }
      }
      setLoading(false);
    };
    
    fetchLeads();
  }, [clinicId, period, customDate]);

  // Classificar tipo de origem
  const getOriginType = (lead: LeadItem): 'meta' | 'link' | 'source' | 'organic' => {
    if (lead.ad_source_id) return 'meta';
    if (lead.source_id && trackableLinkSourceIds.has(lead.source_id)) return 'link';
    if (lead.source_id) return 'source';
    return 'organic';
  };

  // Obter nome da origem
  const getOriginName = (lead: LeadItem): string => {
    if (lead.ad_source_id) {
      return lead.meta_ad_name || 'Anúncio Meta';
    }
    if (lead.source_id && lead.lead_sources) {
      return (lead.lead_sources as any).name || (lead.lead_sources as any).code || 'Origem';
    }
    return '-';
  };

  // Obter código da origem
  const getOriginCode = (lead: LeadItem): string => {
    if (lead.ad_source_id) {
      return lead.meta_campaign_name || '';
    }
    if (lead.source_id && lead.lead_sources) {
      return (lead.lead_sources as any).code || '';
    }
    return '';
  };

  // Formatar tempo de resposta
  const formatResponseTime = (seconds: number | null): string => {
    if (seconds === null) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Verificar se é remarketing (pelo nome da campanha)
  const isRemarketing = (lead: LeadItem): boolean => {
    const campaign = (lead.meta_campaign_name || '').toLowerCase();
    return campaign.includes('rmkt') || campaign.includes('remarket') || campaign.includes('retarget');
  };

  // Filtrar leads
  const filteredLeads = leads.filter(lead => {
    // Filtro por tipo de origem
    if (originFilter !== 'all' && getOriginType(lead) !== originFilter) return false;
    
    // Filtro por etapa/status
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    
    // Filtro por busca (nome ou telefone)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const nameMatch = (lead.client_name || '').toLowerCase().includes(search);
      const phoneMatch = (lead.phone_number || '').includes(search.replace(/\D/g, ''));
      if (!nameMatch && !phoneMatch) return false;
    }
    
    return true;
  });

  // Paginação
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset página quando filtros mudam
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Verificar se é link rastreável
  const isTrackableLink = (lead: LeadItem): boolean => {
    return lead.source_id ? trackableLinkSourceIds.has(lead.source_id) : false;
  };

  // Buscar histórico de contatos (cliques) de um lead
  const fetchContactHistory = async (lead: LeadItem) => {
    if (!lead.source_id || !trackableLinkSourceIds.has(lead.source_id)) return;
    
    setLoadingHistory(true);
    setHistoryLeadName(lead.client_name || 'Lead');
    setShowHistoryModal(true);
    
    try {
      // Buscar o trackable_link pelo source_id
      const { data: trackableLink } = await (supabase as any)
        .from('trackable_links')
        .select('id')
        .eq('source_id', lead.source_id)
        .single();
      
      if (!trackableLink) {
        setHistoryData([]);
        setLoadingHistory(false);
        return;
      }
      
      // Buscar todos os cliques deste link para este chat
      const { data: clicks } = await (supabase as any)
        .from('link_clicks')
        .select('id, clicked_at, utm_source, utm_medium, utm_campaign')
        .eq('link_id', trackableLink.id)
        .eq('chat_id', lead.id)
        .order('clicked_at', { ascending: true });
      
      if (!clicks || clicks.length === 0) {
        setHistoryData([]);
        setLoadingHistory(false);
        return;
      }
      
      // Para cada clique, buscar a primeira mensagem do cliente e primeira resposta
      const historyItems = await Promise.all(clicks.map(async (click: any) => {
        const clickTime = new Date(click.clicked_at);
        const marginTime = new Date(clickTime.getTime() - 60 * 1000);
        
        // Buscar primeira mensagem do cliente após o clique
        const { data: clientMsg } = await (supabase as any)
          .from('messages')
          .select('created_at')
          .eq('chat_id', lead.id)
          .eq('is_from_client', true)
          .gte('created_at', marginTime.toISOString())
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        let respondedBy: string | null = null;
        let responseTime: number | null = null;
        
        if (clientMsg) {
          // Buscar primeira resposta após a mensagem do cliente
          const { data: response } = await (supabase as any)
            .from('messages')
            .select('created_at, sent_by')
            .eq('chat_id', lead.id)
            .eq('is_from_client', false)
            .gte('created_at', clientMsg.created_at)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          
          if (response) {
            const clientMsgTime = new Date(clientMsg.created_at).getTime();
            const responseTimeMs = new Date(response.created_at).getTime();
            responseTime = Math.floor((responseTimeMs - clientMsgTime) / 1000);
            
            if (response.sent_by) {
              const { data: userData } = await supabase
                .from('users')
                .select('name')
                .eq('id', response.sent_by)
                .single();
              respondedBy = (userData as any)?.name || null;
            }
          }
        }
        
        return {
          clickedAt: click.clicked_at,
          respondedBy,
          responseTime,
          utmSource: click.utm_source,
          utmMedium: click.utm_medium,
          utmCampaign: click.utm_campaign,
        };
      }));
      
      setHistoryData(historyItems);
    } catch (e) {
      console.error('Erro ao buscar histórico:', e);
      setHistoryData([]);
    }
    
    setLoadingHistory(false);
  };

  // Contadores
  const counts = {
    all: leads.length,
    meta: leads.filter(l => l.ad_source_id).length,
    link: leads.filter(l => !l.ad_source_id && l.source_id && trackableLinkSourceIds.has(l.source_id)).length,
    source: leads.filter(l => !l.ad_source_id && l.source_id && !trackableLinkSourceIds.has(l.source_id)).length,
    organic: leads.filter(l => !l.ad_source_id && !l.source_id).length,
  };

  // Métricas financeiras
  const totalNegociacoes = Object.values(paymentsMap).reduce<number>((sum, val) => sum + (val as number), 0);
  const leadsComValor = Object.keys(paymentsMap).length;
  const ticketMedio = leadsComValor > 0 ? totalNegociacoes / leadsComValor : 0;
  const leadsConvertidos = leads.filter(l => l.status === 'Convertido').length;
  const taxaConversao = leads.length > 0 ? (leadsConvertidos / leads.length) * 100 : 0;

  // Leads convertidos sem negociação registrada
  const leadsConvertidosSemNegociacao = leads.filter(l => 
    l.status === 'Convertido' && !paymentsMap[l.id]
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Buscar histórico de pagamentos quando seleciona um lead
  const fetchLeadPayments = async (chatId: string) => {
    setLoadingPayments(true);
    const { data } = await (supabase as any)
      .from('payments')
      .select('id, value, description, payment_date, payment_method, status, created_at, users:created_by(name)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSelectedLeadPayments(data.map((p: any) => ({
        ...p,
        created_by_name: p.users?.name || null
      })));
    }
    setLoadingPayments(false);
  };

  // Handler para selecionar lead
  const handleSelectLead = (lead: LeadItem) => {
    setSelectedLead(lead);
    fetchLeadPayments(lead.id);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 sm:py-20">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-900">Leads por Origem</h2>
          <p className="text-xs sm:text-sm text-slate-500">Leads com origem identificada</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Filtro de período */}
          <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-lg">
            <button
              onClick={() => setPeriod('today')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${
                period === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${
                period === 'yesterday' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Ontem
            </button>
            <button
              onClick={() => setPeriod('7d')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${
                period === '7d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all ${
                period === '30d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              30d
            </button>
          </div>
          {/* Seletor de data */}
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              if (e.target.value) setPeriod('custom');
            }}
            className={`hidden sm:block px-3 py-1.5 text-xs rounded-lg border transition-all ${
              period === 'custom' 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          />
        </div>
      </div>

      {/* Cards de contagem por tipo */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
        <button
          onClick={() => setOriginFilter('all')}
          className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all relative ${
            originFilter === 'all' 
              ? 'border-indigo-500 bg-indigo-50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group hidden sm:block">
            <span className="material-symbols-outlined text-slate-400 text-sm cursor-help">info</span>
            <div className="absolute right-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              Total de leads no período selecionado
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900">{counts.all}</p>
          <p className="text-[9px] sm:text-xs text-slate-500">Todos</p>
        </button>
        <button
          onClick={() => setOriginFilter('meta')}
          className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all relative ${
            originFilter === 'meta' 
              ? 'border-pink-500 bg-pink-50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group hidden sm:block">
            <span className="material-symbols-outlined text-slate-400 text-sm cursor-help">info</span>
            <div className="absolute right-0 top-6 w-52 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              Leads que vieram de anúncios Meta Ads (Click to WhatsApp)
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-pink-600">{counts.meta}</p>
          <p className="text-[9px] sm:text-xs text-slate-500">Meta</p>
        </button>
        <button
          onClick={() => setOriginFilter('link')}
          className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all relative ${
            originFilter === 'link' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group hidden sm:block">
            <span className="material-symbols-outlined text-slate-400 text-sm cursor-help">info</span>
            <div className="absolute right-0 top-6 w-52 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              Leads que vieram de links rastreáveis (Bio, Site, etc.)
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-blue-600">{counts.link}</p>
          <p className="text-[9px] sm:text-xs text-slate-500">Links</p>
        </button>
        <button
          onClick={() => setOriginFilter('source')}
          className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all relative ${
            originFilter === 'source' 
              ? 'border-amber-500 bg-amber-50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group hidden sm:block">
            <span className="material-symbols-outlined text-slate-400 text-sm cursor-help">info</span>
            <div className="absolute right-0 top-6 w-52 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              Leads com código de origem identificado na mensagem
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-amber-600">{counts.source}</p>
          <p className="text-[9px] sm:text-xs text-slate-500">Origem</p>
        </button>
        <button
          onClick={() => setOriginFilter('organic')}
          className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all relative ${
            originFilter === 'organic' 
              ? 'border-slate-500 bg-slate-50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group hidden sm:block">
            <span className="material-symbols-outlined text-slate-400 text-sm cursor-help">info</span>
            <div className="absolute right-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              Leads sem origem identificada (orgânico)
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-600">{counts.organic}</p>
          <p className="text-[9px] sm:text-xs text-slate-500">Org.</p>
        </button>
      </div>

      {/* Cards de métricas financeiras */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <div className="p-2 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="material-symbols-outlined text-emerald-200 text-sm sm:text-base">payments</span>
            <p className="text-[8px] sm:text-xs text-emerald-100 hidden sm:block">Valor Total</p>
          </div>
          <p className="text-sm sm:text-2xl font-black">{formatCurrency(totalNegociacoes)}</p>
          <p className="text-[8px] sm:hidden text-emerald-200">Total</p>
        </div>
        <div className="p-2 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="material-symbols-outlined text-violet-200 text-sm sm:text-base">receipt_long</span>
            <p className="text-[8px] sm:text-xs text-violet-100 hidden sm:block">Ticket Médio</p>
          </div>
          <p className="text-sm sm:text-2xl font-black">{formatCurrency(ticketMedio)}</p>
          <p className="text-[8px] sm:hidden text-violet-200">Ticket</p>
        </div>
        <div className="p-2 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="material-symbols-outlined text-cyan-200 text-sm sm:text-base">trending_up</span>
            <p className="text-[8px] sm:text-xs text-cyan-100 hidden sm:block">Taxa Conversão</p>
          </div>
          <p className="text-sm sm:text-2xl font-black">{taxaConversao.toFixed(1)}%</p>
          <p className="text-[8px] text-cyan-200 sm:block hidden">{leadsConvertidos} de {leads.length}</p>
          <p className="text-[8px] sm:hidden text-cyan-200">Conv.</p>
        </div>
      </div>

      {/* Alerta: Leads convertidos sem negociação */}
      {leadsConvertidosSemNegociacao.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="material-symbols-outlined text-amber-600 text-base sm:text-xl">warning</span>
            <h4 className="font-bold text-amber-800 text-xs sm:text-sm">
              {leadsConvertidosSemNegociacao.length} convertido{leadsConvertidosSemNegociacao.length > 1 ? 's' : ''} sem venda
            </h4>
          </div>
          <div className="space-y-1.5 sm:space-y-2 max-h-48 overflow-y-auto">
            {leadsConvertidosSemNegociacao.slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-amber-100">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-amber-600 text-sm sm:text-base">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-xs sm:text-sm truncate">{lead.client_name || 'Sem nome'}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">{formatDate(lead.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSelectLead(lead)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[10px] sm:text-xs font-medium"
                  >
                    <span className="hidden sm:inline">Lançar</span>
                    <span className="material-symbols-outlined sm:hidden text-sm">payments</span>
                  </button>
                </div>
              </div>
            ))}
            {leadsConvertidosSemNegociacao.length > 5 && (
              <p className="text-[10px] sm:text-xs text-amber-600 text-center pt-1">+{leadsConvertidosSemNegociacao.length - 5} mais...</p>
            )}
          </div>
        </div>
      )}

      {/* Tabela de leads */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-base sm:text-xl">group</span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Leads</h3>
                <span className="text-[10px] sm:text-xs text-slate-400">({filteredLeads.length})</span>
              </div>
              
              {/* Filtro por etapa - mobile */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }}
                className="px-2 sm:px-3 py-1 sm:py-2 border border-slate-200 rounded-lg text-[10px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">Todas</option>
                <option value="Novo Lead">Novo</option>
                <option value="Em Atendimento">Atendimento</option>
                <option value="Agendado">Agendado</option>
                <option value="Convertido">Convertido</option>
                <option value="Perdido">Perdido</option>
              </select>
            </div>
            
            {/* Busca */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base sm:text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
                className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        {filteredLeads.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300">person_off</span>
            <p className="text-slate-500 mt-2 text-xs sm:text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <>
            {/* Versão Mobile - Cards Expansíveis */}
            <div className="sm:hidden p-2 space-y-2">
              {paginatedLeads.map((lead) => {
                const originType = getOriginType(lead);
                const originName = getOriginName(lead);
                const responseData = responseDataMap[lead.id];
                const isExpanded = expandedLeadId === lead.id;
                
                return (
                  <div 
                    key={lead.id} 
                    className={`bg-slate-50 rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 bg-white shadow-sm' : 'border-slate-200'}`}
                  >
                    {/* Header do Card - Sempre visível */}
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`size-2.5 rounded-full flex-shrink-0 ${
                          originType === 'meta' ? 'bg-pink-500' :
                          originType === 'link' ? 'bg-blue-500' :
                          originType === 'source' ? 'bg-amber-500' :
                          'bg-slate-400'
                        }`}></span>
                        <span className="font-medium text-slate-800 text-xs truncate">{lead.client_name || 'Sem nome'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          lead.status === 'Novo Lead' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'Em Atendimento' ? 'bg-amber-100 text-amber-700' :
                          lead.status === 'Agendado' ? 'bg-purple-100 text-purple-700' :
                          lead.status === 'Convertido' ? 'bg-emerald-100 text-emerald-700' :
                          lead.status === 'Perdido' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {lead.status === 'Em Atendimento' ? 'Atend.' : lead.status === 'Novo Lead' ? 'Novo' : lead.status || 'Novo'}
                        </span>
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Conteúdo Expandido */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* Info básica */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-medium">Origem</p>
                            <p className="text-xs font-medium text-slate-700 truncate">{originName}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-medium">Data</p>
                            <p className="text-xs font-medium text-slate-700">{formatDate(lead.created_at)}</p>
                          </div>
                        </div>
                        
                        {/* Métricas */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-400 uppercase">Tempo Resp.</p>
                            {responseData?.response_time !== null && responseData?.response_time !== undefined ? (
                              <p className={`text-xs font-bold ${
                                responseData.response_time <= 300 ? 'text-green-600' : 
                                responseData.response_time <= 1800 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {formatResponseTime(responseData.response_time)}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">-</p>
                            )}
                          </div>
                          <div className="text-center bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-400 uppercase">Respondido</p>
                            <p className="text-xs font-medium text-slate-700 truncate">
                              {responseData?.responded_by || <span className="text-amber-600">Aguard.</span>}
                            </p>
                          </div>
                          <div className="text-center bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-400 uppercase">Valor</p>
                            {paymentsMap[lead.id] ? (
                              <p className="text-xs font-bold text-emerald-600">{formatCurrency(paymentsMap[lead.id])}</p>
                            ) : (
                              <p className="text-xs text-slate-400">-</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Tags */}
                        {tagsMap[lead.id] && tagsMap[lead.id].length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {tagsMap[lead.id].map((tag, idx) => (
                              <span 
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{ 
                                  backgroundColor: tag.color + '20', 
                                  color: tag.color,
                                  border: `1px solid ${tag.color}40`
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Ações */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/inbox?chat=${lead.id}`; }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                            Conversa
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectLead(lead); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">payments</span>
                            Venda
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/lead/${lead.id}`; }}
                            className="px-3 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Versão Desktop - Tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Origem</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Respondido por</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Tempo Resp.</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Valor</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Resp. Venda</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Etapa</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Data</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLeads.map((lead) => {
                    const originType = getOriginType(lead);
                    const originName = getOriginName(lead);
                    const originCode = getOriginCode(lead);
                    
                    const responseData = responseDataMap[lead.id];
                    const isRmkt = isRemarketing(lead);
                    
                    return (
                      <tr 
                        key={lead.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{lead.client_name || 'Sem nome'}</p>
                          <p className="text-xs text-slate-400">{formatPhone(lead.phone_number)}</p>
                          {tagsMap[lead.id] && tagsMap[lead.id].length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tagsMap[lead.id].map((tag, idx) => (
                                <span 
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ 
                                    backgroundColor: tag.color + '20', 
                                    color: tag.color,
                                    border: `1px solid ${tag.color}40`
                                  }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-900">{originName}</p>
                            {originCode && (
                              <p className="text-xs text-slate-400 truncate max-w-[150px]">{originCode}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              originType === 'meta' ? 'bg-pink-100 text-pink-700' :
                              originType === 'link' ? 'bg-blue-100 text-blue-700' :
                              originType === 'source' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {originType === 'meta' ? 'Meta Ads' :
                               originType === 'link' ? 'Link' :
                               originType === 'source' ? 'Origem' :
                               'Orgânico'}
                            </span>
                            {isRmkt && (
                              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-bold">
                                RMKT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {responseData?.responded_by ? (
                            <span className="text-xs text-slate-700">{responseData.responded_by}</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">Aguardando...</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {responseData?.response_time !== null && responseData?.response_time !== undefined ? (
                            <span className={`text-xs font-medium ${
                              responseData.response_time <= 300 ? 'text-green-600' : 
                              responseData.response_time <= 1800 ? 'text-amber-600' : 
                              'text-red-600'
                            }`}>
                              {formatResponseTime(responseData.response_time)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {paymentsMap[lead.id] ? (
                            <span className="font-bold text-emerald-600">{formatCurrency(paymentsMap[lead.id])}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {paymentCreatorsMap[lead.id] ? (
                            <span className="text-xs text-slate-700">{paymentCreatorsMap[lead.id]}</span>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            lead.status === 'Novo Lead' ? 'bg-blue-100 text-blue-700' :
                            lead.status === 'Em Atendimento' ? 'bg-amber-100 text-amber-700' :
                            lead.status === 'Agendado' ? 'bg-purple-100 text-purple-700' :
                            lead.status === 'Convertido' ? 'bg-emerald-100 text-emerald-700' :
                            lead.status === 'Perdido' ? 'bg-red-100 text-red-700' :
                            lead.status === 'Recorrente' ? 'bg-cyan-100 text-cyan-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {lead.status || 'Novo Lead'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 text-xs">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {isTrackableLink(lead) && clickCountMap[lead.id] > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); fetchContactHistory(lead); }}
                                className="p-1.5 hover:bg-violet-50 rounded text-violet-600 relative"
                                title={`Histórico de contatos (${clickCountMap[lead.id]} cliques)`}
                              >
                                <span className="material-symbols-outlined text-lg">history</span>
                                {clickCountMap[lead.id] > 1 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                    {clickCountMap[lead.id]}
                                  </span>
                                )}
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); window.location.href = `/inbox?chat=${lead.id}`; }}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600"
                              title="Ir para conversa"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectLead(lead); }}
                              className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600"
                              title="Lançar venda"
                            >
                              <span className="material-symbols-outlined text-lg">payments</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); window.location.href = `/lead/${lead.id}`; }}
                              className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600"
                              title="Ver detalhes"
                            >
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-2 sm:p-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-[10px] sm:text-sm text-slate-500 hidden sm:block">
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredLeads.length)} de {filteredLeads.length}
            </p>
            <p className="text-[10px] text-slate-500 sm:hidden">
              {currentPage}/{totalPages}
            </p>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
                title="Primeira página"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">first_page</span>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página anterior"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">chevron_left</span>
              </button>
              
              {/* Números das páginas - Desktop */}
              <div className="hidden sm:flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              {/* Números das páginas - Mobile (apenas 3) */}
              <div className="flex sm:hidden items-center gap-0.5 mx-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage <= 2) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 1) {
                    pageNum = totalPages - 2 + i;
                  } else {
                    pageNum = currentPage - 1 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 rounded text-[10px] font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Próxima página"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">chevron_right</span>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
                title="Última página"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">last_page</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalhes do lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className={`p-3 sm:p-5 flex-shrink-0 ${
              getOriginType(selectedLead) === 'meta' ? 'bg-gradient-to-r from-pink-600 to-rose-600' :
              getOriginType(selectedLead) === 'link' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' :
              getOriginType(selectedLead) === 'source' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
              'bg-gradient-to-r from-slate-600 to-slate-700'
            }`}>
              <button 
                onClick={() => setSelectedLead(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/80 hover:text-white"
              >
                <span className="material-symbols-outlined text-xl sm:text-2xl">close</span>
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl sm:text-3xl">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-lg font-bold text-white truncate">{selectedLead.client_name || 'Sem nome'}</h3>
                  <p className="text-white/80 text-xs sm:text-sm truncate">{formatPhone(selectedLead.phone_number)}</p>
                </div>
              </div>
              {/* Etiquetas no header */}
              {tagsMap[selectedLead.id] && tagsMap[selectedLead.id].length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
                  {tagsMap[selectedLead.id].map((tag, idx) => (
                    <span 
                      key={idx}
                      className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-white/20 text-white"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Conteúdo com scroll */}
            <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500">Etapa</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{selectedLead.status || 'Novo Lead'}</p>
                </div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500">Tipo</p>
                  <p className={`font-bold text-xs sm:text-sm ${
                    getOriginType(selectedLead) === 'meta' ? 'text-pink-600' :
                    getOriginType(selectedLead) === 'link' ? 'text-blue-600' :
                    getOriginType(selectedLead) === 'source' ? 'text-amber-600' :
                    'text-slate-600'
                  }`}>
                    {getOriginType(selectedLead) === 'meta' ? 'Meta Ads' :
                     getOriginType(selectedLead) === 'link' ? 'Link' :
                     getOriginType(selectedLead) === 'source' ? 'Origem' :
                     'Orgânico'}
                  </p>
                </div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500">Origem</p>
                  <p className="font-bold text-indigo-600 text-[10px] sm:text-sm truncate">{getOriginName(selectedLead)}</p>
                </div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                  <p className="text-[10px] sm:text-xs text-slate-500">Data</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{formatDate(selectedLead.created_at)}</p>
                </div>
              </div>

              {/* Card de valor total */}
              {paymentsMap[selectedLead.id] > 0 && (
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-3 sm:p-4 rounded-lg sm:rounded-xl text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs text-emerald-100">Valor Total</p>
                      <p className="text-lg sm:text-2xl font-black">{formatCurrency(paymentsMap[selectedLead.id])}</p>
                    </div>
                    <span className="material-symbols-outlined text-2xl sm:text-4xl text-emerald-200">payments</span>
                  </div>
                </div>
              )}

              {/* Histórico de Negociações */}
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <span className="material-symbols-outlined text-slate-600 text-base sm:text-xl">receipt_long</span>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Negociações</h4>
                </div>
                
                {loadingPayments ? (
                  <div className="flex items-center justify-center py-3 sm:py-4">
                    <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-indigo-600"></div>
                  </div>
                ) : selectedLeadPayments.length === 0 ? (
                  <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                    <span className="material-symbols-outlined text-2xl sm:text-3xl text-slate-300">money_off</span>
                    <p className="text-slate-500 text-[10px] sm:text-sm mt-1">Nenhuma negociação</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2 max-h-40 overflow-y-auto">
                    {selectedLeadPayments.map((payment) => (
                      <div 
                        key={payment.id} 
                        className={`bg-slate-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border-l-4 ${
                          payment.status === 'cancelled' ? 'border-red-400 opacity-60' : 'border-emerald-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-emerald-600 text-xs sm:text-sm">{formatCurrency(payment.value)}</p>
                            <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400 flex-wrap">
                              <span>{formatDate(payment.payment_date)}</span>
                              {payment.created_by_name && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">por {payment.created_by_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {payment.status === 'cancelled' && (
                            <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-600 rounded text-[9px] sm:text-xs">Canc.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer com ações */}
            <div className="p-3 sm:p-4 border-t border-slate-200 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <a 
                  href={`/inbox?chat=${selectedLead.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg sm:rounded-xl font-medium hover:bg-indigo-700 transition-colors text-xs sm:text-sm"
                >
                  <span className="material-symbols-outlined text-base sm:text-lg">chat</span>
                  <span className="hidden sm:inline">Abrir Conversa</span>
                  <span className="sm:hidden">Conversa</span>
                </a>
                <a 
                  href={`https://wa.me/${selectedLead.phone_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-green-600 text-white rounded-lg sm:rounded-xl font-medium hover:bg-green-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base sm:text-lg">call</span>
                </a>
              </div>
              <a 
                href={`/lead/${selectedLead.id}`}
                className="block w-full text-center px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 text-slate-700 rounded-lg sm:rounded-xl font-medium hover:bg-slate-50 transition-colors text-xs sm:text-sm"
              >
                Ver Detalhes
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Contatos */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-3 sm:p-6 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-bold text-white">Histórico</h3>
                  <p className="text-violet-200 text-xs sm:text-sm truncate">{historyLeadName}</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-white text-xl sm:text-2xl">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-500">
                  <span className="material-symbols-outlined text-3xl sm:text-4xl mb-2">history</span>
                  <p className="text-xs sm:text-sm">Nenhum histórico</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {historyData.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-xs sm:text-sm font-bold text-violet-700">#{index + 1}</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">
                          {new Date(item.clickedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <span className="text-slate-500 text-[10px] sm:text-xs">Respondido:</span>
                          <p className="font-medium text-slate-900 text-xs sm:text-sm truncate">{item.respondedBy || <span className="text-amber-600">Aguardando</span>}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] sm:text-xs">Tempo:</span>
                          <p className={`font-medium text-xs sm:text-sm ${
                            item.responseTime === null ? 'text-slate-400' :
                            item.responseTime <= 300 ? 'text-green-600' :
                            item.responseTime <= 1800 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {item.responseTime !== null ? formatResponseTime(item.responseTime) : '-'}
                          </p>
                        </div>
                      </div>
                      
                      {(item.utmSource || item.utmMedium || item.utmCampaign) && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-200">
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {item.utmSource && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded text-[9px] sm:text-xs">
                                {item.utmSource}
                              </span>
                            )}
                            {item.utmMedium && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded text-[9px] sm:text-xs">
                                {item.utmMedium}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 sm:p-4 border-t border-slate-200">
              <button
                onClick={() => setShowHistoryModal(false)}
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
}
