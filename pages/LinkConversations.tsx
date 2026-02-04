import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Conversation {
  id: string;
  client_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  first_message_at: string | null;
  first_response_at: string | null;
  responded_by_name: string | null;
  response_time_seconds: number | null;
  click_count: number;
  first_click_at: string | null;
  last_click_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

interface LinkInfo {
  id: string;
  name: string;
  code: string;
  source_id: string | null;
}

interface OriginStats {
  total: number;
  metaAds: number;
  googleAds: number;
  outras: number;
  naoRastreada: number;
}

interface ClickInteraction {
  id: string;
  clicked_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  ip_address: string | null;
  first_message_after?: string | null;
  response_time_seconds?: number | null;
  responded_by_name?: string | null;
}

export default function LinkConversations() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { clinic, user, isImpersonating, impersonatedClinic } = useAuth();
  // Usar clinicId do impersonate se estiver ativo
  const clinicId = isImpersonating ? impersonatedClinic?.id : (clinic?.id || user?.clinicId);
  
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'meta' | 'google' | 'outras' | 'nao_rastreada'>('all');
  const [stats, setStats] = useState<OriginStats>({ total: 0, metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 });
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filtro de data
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '15d' | '30d'>('30d');
  
  // Modal de histórico
  const [historyModal, setHistoryModal] = useState<{ open: boolean; chatId: string | null; clientName: string }>({ open: false, chatId: null, clientName: '' });
  const [historyData, setHistoryData] = useState<ClickInteraction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Estado para cards expansíveis no mobile
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);

  useEffect(() => {
    if (linkId && clinicId) {
      fetchLinkInfo();
      fetchConversations();
    }
  }, [linkId, clinicId, dateFilter]);

  const fetchLinkInfo = async () => {
    const { data } = await supabase
      .from('trackable_links')
      .select('id, name, code, source_id')
      .eq('id', linkId)
      .eq('clinic_id', clinicId)
      .single();
    
    if (data) {
      setLink(data as LinkInfo);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    
    // Buscar o link para pegar o código e source_id
    const { data: linkData } = await supabase
      .from('trackable_links')
      .select('code, source_id')
      .eq('id', linkId)
      .single();
    
    if (!linkData) {
      setLoading(false);
      return;
    }

    // Calcular data de início baseado no filtro
    const now = new Date();
    let startDate: Date;
    if (dateFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      const days = dateFilter === '7d' ? 7 : dateFilter === '15d' ? 15 : 30;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Estratégia 1: Buscar mensagens com o código do link [CODIGO] no período selecionado
    // Isso captura tanto clientes novos quanto antigos que viram uma publicação
    // Buscar mensagens com o código do link (colchetes ou parênteses)
    const { data: messagesWithCode } = await (supabase as any)
      .from('messages')
      .select('chat_id, created_at')
      .or(`content.ilike.%[${linkData.code}]%,content.ilike.%(${linkData.code})%`)
      .gte('created_at', startDate.toISOString());
    
    const chatIdsFromMessages = [...new Set((messagesWithCode || []).map((m: any) => m.chat_id))];
    
    // Estratégia 2: Buscar chats pelo source_id (se existir) - criados no período
    let chatIdsFromSource: string[] = [];
    if (linkData.source_id) {
      const { data: chatsFromSource } = await supabase
        .from('chats')
        .select('id')
        .eq('clinic_id', clinic?.id)
        .eq('source_id', linkData.source_id)
        .gte('created_at', startDate.toISOString());
      chatIdsFromSource = (chatsFromSource || []).map((c: any) => c.id);
    }
    
    // Estratégia 3: Buscar link_clicks no período que têm chat_id
    const { data: clicksWithChat } = await (supabase as any)
      .from('link_clicks')
      .select('chat_id')
      .eq('link_id', linkId)
      .not('chat_id', 'is', null)
      .gte('clicked_at', startDate.toISOString());
    const chatIdsFromClicks = [...new Set((clicksWithChat || []).map((c: any) => c.chat_id))];
    
    // Combinar todos os chat_ids únicos
    const allChatIds = [...new Set([...chatIdsFromMessages, ...chatIdsFromSource, ...chatIdsFromClicks])];
    
    if (allChatIds.length === 0) {
      setConversations([]);
      setStats({ total: 0, metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 });
      setLoading(false);
      return;
    }

    // Buscar detalhes dos chats (sem filtro de data, pois o chat pode ser antigo)
    const { data: chatsData } = await supabase
      .from('chats')
      .select(`
        id,
        client_name,
        phone_number,
        status,
        created_at,
        updated_at
      `)
      .eq('clinic_id', clinic?.id)
      .in('id', allChatIds)
      .order('updated_at', { ascending: false });

    if (!chatsData || chatsData.length === 0) {
      setConversations([]);
      setStats({ total: 0, metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 });
      setLoading(false);
      return;
    }

    // Para cada chat, buscar informações adicionais
    const conversationsWithDetails = await Promise.all(
      chatsData.map(async (chat: any) => {
        // Buscar cliques do link para este chat (por chat_id OU phone_number)
        const { data: clicksByChat } = await (supabase as any)
          .from('link_clicks')
          .select('id, utm_source, utm_medium, utm_campaign, clicked_at')
          .eq('link_id', linkId)
          .eq('chat_id', chat.id)
          .order('clicked_at', { ascending: true });
        
        // Se não encontrou por chat_id, tentar por phone_number (fallback)
        let clicksData = clicksByChat;
        if ((!clicksData || clicksData.length === 0) && chat.phone_number) {
          const { data: clicksByPhone } = await (supabase as any)
            .from('link_clicks')
            .select('id, utm_source, utm_medium, utm_campaign, clicked_at')
            .eq('link_id', linkId)
            .ilike('phone_number', `%${chat.phone_number.replace(/\D/g, '').slice(-8)}%`)
            .order('clicked_at', { ascending: true });
          clicksData = clicksByPhone;
        }

        const clickCount = clicksData?.length || 0;
        const firstClick = clicksData?.[0];
        const lastClick = clicksData && clicksData.length > 0 ? clicksData[clicksData.length - 1] : null;
        
        // Para remarketing: usar dados do ÚLTIMO clique, não do primeiro
        // Buscar primeira mensagem do cliente APÓS o último clique
        let respondedByName = null;
        let responseTimeSeconds = null;
        let firstMsgAfterLastClick = null;
        let firstResponseAfterLastClick = null;
        
        if (lastClick) {
          const lastClickTime = new Date(lastClick.clicked_at);
          // Margem de 1 minuto antes do clique para compensar delay
          const marginTime = new Date(lastClickTime.getTime() - 60 * 1000);
          
          // Buscar primeira mensagem do cliente após o último clique
          const { data: clientMsg } = await (supabase as any)
            .from('messages')
            .select('created_at')
            .eq('chat_id', chat.id)
            .eq('is_from_client', true)
            .gte('created_at', marginTime.toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          
          firstMsgAfterLastClick = clientMsg;
          
          if (clientMsg) {
            // Buscar primeira resposta APÓS essa mensagem do cliente
            const { data: response } = await (supabase as any)
              .from('messages')
              .select('created_at, sent_by')
              .eq('chat_id', chat.id)
              .eq('is_from_client', false)
              .gte('created_at', clientMsg.created_at)
              .order('created_at', { ascending: true })
              .limit(1)
              .single();
            
            firstResponseAfterLastClick = response;
            
            if (response?.sent_by) {
              const { data: userData } = await supabase
                .from('users')
                .select('name')
                .eq('id', response.sent_by)
                .single();
              respondedByName = (userData as any)?.name || null;
            }
            
            if (response?.created_at) {
              const clientMsgTime = new Date(clientMsg.created_at).getTime();
              const responseTime = new Date(response.created_at).getTime();
              responseTimeSeconds = Math.floor((responseTime - clientMsgTime) / 1000);
            }
          }
        }

        return {
          id: chat.id,
          client_name: chat.client_name,
          phone_number: chat.phone_number,
          status: chat.status,
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          first_message_at: firstMsgAfterLastClick?.created_at || null,
          first_response_at: firstResponseAfterLastClick?.created_at || null,
          responded_by: firstResponseAfterLastClick?.sent_by || null,
          responded_by_name: respondedByName,
          response_time_seconds: responseTimeSeconds,
          click_count: clickCount,
          first_click_at: firstClick?.clicked_at || null,
          last_click_at: lastClick?.clicked_at || null,
          utm_source: lastClick?.utm_source || null,
          utm_medium: lastClick?.utm_medium || null,
          utm_campaign: lastClick?.utm_campaign || null,
        };
      })
    );

    setConversations(conversationsWithDetails);
    
    // Calcular estatísticas
    let metaAds = 0, googleAds = 0, outras = 0, naoRastreada = 0;
    
    conversationsWithDetails.forEach(conv => {
      const source = (conv.utm_source || '').toLowerCase();
      if (source.includes('facebook') || source.includes('instagram') || source.includes('fb') || source.includes('ig')) {
        metaAds++;
      } else if (source.includes('google') || source.includes('gclid')) {
        googleAds++;
      } else if (conv.utm_source || conv.utm_medium || conv.utm_campaign) {
        outras++;
      } else {
        naoRastreada++;
      }
    });
    
    setStats({
      total: conversationsWithDetails.length,
      metaAds,
      googleAds,
      outras,
      naoRastreada
    });
    
    setLoading(false);
  };

  const formatResponseTime = (seconds: number | null): string => {
    if (seconds === null) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Buscar histórico de interações (cliques) de um contato
  const fetchContactHistory = async (chatId: string, clientName: string) => {
    setHistoryModal({ open: true, chatId, clientName });
    setLoadingHistory(true);
    setHistoryData([]);
    
    try {
      // Buscar todos os cliques deste chat
      const { data: clicks } = await (supabase as any)
        .from('link_clicks')
        .select('id, clicked_at, utm_source, utm_medium, utm_campaign, utm_content, device_type, browser, os, referrer, ip_address')
        .eq('link_id', linkId)
        .eq('chat_id', chatId)
        .order('clicked_at', { ascending: false });
      
      if (!clicks || clicks.length === 0) {
        setHistoryData([]);
        setLoadingHistory(false);
        return;
      }
      
      // Para cada clique, buscar a primeira mensagem após o clique e a resposta
      const clicksWithDetails = await Promise.all(
        clicks.map(async (click: any) => {
          const clickTime = new Date(click.clicked_at);
          
          // Buscar primeira mensagem do cliente após o clique (com margem de 1 min antes para compensar delay)
          const marginTime = new Date(clickTime.getTime() - 60 * 1000);
          const { data: firstMsg } = await (supabase as any)
            .from('messages')
            .select('id, created_at, content')
            .eq('chat_id', chatId)
            .eq('is_from_client', true)
            .gte('created_at', marginTime.toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          
          let responseTimeSeconds = null;
          let respondedByName = null;
          
          if (firstMsg) {
            // Buscar primeira resposta após a mensagem do cliente
            const { data: firstResponse } = await (supabase as any)
              .from('messages')
              .select('id, created_at, sent_by')
              .eq('chat_id', chatId)
              .eq('is_from_client', false)
              .gte('created_at', firstMsg.created_at)
              .order('created_at', { ascending: true })
              .limit(1)
              .single();
            
            if (firstResponse) {
              const msgTime = new Date(firstMsg.created_at).getTime();
              const respTime = new Date(firstResponse.created_at).getTime();
              responseTimeSeconds = Math.floor((respTime - msgTime) / 1000);
              
              if (firstResponse.sent_by) {
                const { data: userData } = await supabase
                  .from('users')
                  .select('name')
                  .eq('id', firstResponse.sent_by)
                  .single();
                respondedByName = (userData as any)?.name || null;
              }
            }
          }
          
          return {
            ...click,
            first_message_after: firstMsg?.created_at || null,
            response_time_seconds: responseTimeSeconds,
            responded_by_name: respondedByName
          };
        })
      );
      
      setHistoryData(clicksWithDetails);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
    
    setLoadingHistory(false);
  };

  const getSourceBadge = (source: string | null) => {
    const s = (source || '').toLowerCase();
    if (s.includes('instagram') || s === 'ig') {
      return <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded text-xs">Instagram</span>;
    }
    if (s.includes('facebook') || s === 'fb') {
      return <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs">Facebook</span>;
    }
    if (s.includes('google')) {
      return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Google</span>;
    }
    if (source) {
      return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{source}</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">Direto</span>;
  };

  const getOriginBadge = (conv: Conversation) => {
    const source = (conv.utm_source || '').toLowerCase();
    const medium = (conv.utm_medium || '').toLowerCase();
    
    // Instagram específico
    if (source.includes('instagram') || source === 'ig') {
      return <span className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded text-xs font-medium">Instagram</span>;
    }
    // Facebook específico
    if (source.includes('facebook') || source === 'fb') {
      return <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium">Facebook</span>;
    }
    // Google Ads
    if (source.includes('google') || source.includes('gclid')) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Google Ads</span>;
    }
    // Outras origens rastreadas
    if (conv.utm_source || conv.utm_medium || conv.utm_campaign) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">{conv.utm_source || medium || 'Outras'}</span>;
    }
    return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">Não Rastreada</span>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      'Novo Lead': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Novo Lead' },
      'Em Atendimento': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Atendimento' },
      'Agendado': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Agendado' },
      'Convertido': { bg: 'bg-green-100', text: 'text-green-700', label: 'Convertido' },
      'Recorrente': { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Recorrente' },
      'Mentoria': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Mentoria' },
      'Perdido': { bg: 'bg-red-100', text: 'text-red-700', label: 'Perdido' },
    };
    const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
    return <span className={`px-2 py-1 ${config.bg} ${config.text} rounded text-xs font-medium`}>{config.label}</span>;
  };

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv => {
    // Filtro de busca
    const matchesSearch = searchTerm === '' || 
      conv.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.phone_number?.includes(searchTerm);
    
    // Filtro de origem
    let matchesOrigin = true;
    if (originFilter !== 'all') {
      const source = (conv.utm_source || '').toLowerCase();
      if (originFilter === 'meta') {
        matchesOrigin = source.includes('facebook') || source.includes('instagram') || source.includes('fb') || source.includes('ig');
      } else if (originFilter === 'google') {
        matchesOrigin = source.includes('google') || source.includes('gclid');
      } else if (originFilter === 'outras') {
        matchesOrigin = !!(conv.utm_source || conv.utm_medium || conv.utm_campaign) && 
          !source.includes('facebook') && !source.includes('instagram') && !source.includes('fb') && !source.includes('ig') &&
          !source.includes('google') && !source.includes('gclid');
      } else if (originFilter === 'nao_rastreada') {
        matchesOrigin = !conv.utm_source && !conv.utm_medium && !conv.utm_campaign;
      }
    }
    
    return matchesSearch && matchesOrigin;
  });

  // Paginação
  const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
  const paginatedConversations = filteredConversations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => navigate(`/link/${linkId}`)} 
            className="text-slate-500 hover:text-slate-700 transition-colors text-sm"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Conversas do Link</h1>
            {link && <p className="text-[10px] sm:text-sm text-slate-500 truncate max-w-[200px] sm:max-w-none">{link.name} • {link.code}</p>}
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div 
          onClick={() => setOriginFilter('all')}
          className={`bg-white rounded-lg sm:rounded-xl border p-2 sm:p-4 cursor-pointer transition-all ${originFilter === 'all' ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <span className="material-symbols-outlined text-slate-500 text-sm sm:text-base">chat</span>
            <span className="text-[9px] sm:text-xs text-slate-500 font-medium">Total</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('meta')}
          className={`bg-white rounded-lg sm:rounded-xl border p-2 sm:p-4 cursor-pointer transition-all ${originFilter === 'meta' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded flex items-center justify-center">
              <span className="text-blue-600 font-bold text-[9px] sm:text-xs">M</span>
            </div>
            <span className="text-[9px] sm:text-xs text-slate-500 font-medium hidden sm:inline">Meta Ads</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.metaAds}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('google')}
          className={`bg-white rounded-lg sm:rounded-xl border p-2 sm:p-4 cursor-pointer transition-all ${originFilter === 'google' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-amber-100 rounded flex items-center justify-center">
              <span className="text-amber-600 font-bold text-[9px] sm:text-xs">G</span>
            </div>
            <span className="text-[9px] sm:text-xs text-slate-500 font-medium hidden sm:inline">Google</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.googleAds}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('outras')}
          className={`bg-white rounded-lg sm:rounded-xl border p-2 sm:p-4 cursor-pointer transition-all ${originFilter === 'outras' ? 'border-green-500 ring-2 ring-green-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-[10px] sm:text-sm">language</span>
            </div>
            <span className="text-[9px] sm:text-xs text-slate-500 font-medium hidden sm:inline">Outras</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.outras}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('nao_rastreada')}
          className={`bg-white rounded-lg sm:rounded-xl border p-2 sm:p-4 cursor-pointer transition-all ${originFilter === 'nao_rastreada' ? 'border-orange-500 ring-2 ring-orange-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-orange-100 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-600 text-[10px] sm:text-sm">help</span>
            </div>
            <span className="text-[9px] sm:text-xs text-slate-500 font-medium hidden sm:inline">N/R</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.naoRastreada}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-2 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
          {/* Filtro de Data */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
            {[
              { value: 'today', label: 'Hoje' },
              { value: '7d', label: '7d' },
              { value: '15d', label: '15d' },
              { value: '30d', label: '30d' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => { setDateFilter(period.value as 'today' | '7d' | '15d' | '30d'); setCurrentPage(1); }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                  dateFilter === period.value
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Busca */}
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <span className="material-symbols-outlined absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base sm:text-lg">search</span>
            <input
              type="text"
              placeholder="Nome ou telefone"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
            />
          </div>
          
          {/* Limpar Filtros */}
          {(searchTerm || originFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setOriginFilter('all'); setCurrentPage(1); }}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
        {filteredConversations.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 mb-2">chat_bubble_outline</span>
            <p className="text-slate-500 text-sm">Nenhuma conversa encontrada.</p>
          </div>
        ) : (
          <>
            {/* Versão Mobile - Cards Expansíveis */}
            <div className="sm:hidden p-2 space-y-2">
              {paginatedConversations.map((conv) => {
                const isExpanded = expandedConvId === conv.id;
                return (
                  <div 
                    key={conv.id}
                    className={`bg-slate-50 rounded-xl border transition-all ${isExpanded ? 'border-cyan-300 bg-white shadow-sm' : 'border-slate-200'}`}
                  >
                    {/* Header do Card */}
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedConvId(isExpanded ? null : conv.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 text-xs truncate">{conv.client_name || 'Sem nome'}</p>
                          <p className="text-[10px] text-slate-400 truncate">{conv.phone_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getOriginBadge(conv)}
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Conteúdo Expandido */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-500 uppercase">Etapa</p>
                            <div className="mt-0.5">{getStatusBadge(conv.status)}</div>
                          </div>
                          <div className="bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-500 uppercase">Tempo Resp.</p>
                            {conv.response_time_seconds !== null ? (
                              <p className={`text-sm font-bold ${conv.response_time_seconds <= 300 ? 'text-green-600' : conv.response_time_seconds <= 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                                {formatResponseTime(conv.response_time_seconds)}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-400">-</p>
                            )}
                          </div>
                          <div className="bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-500 uppercase">Respondido por</p>
                            <p className="text-xs font-medium text-slate-700 truncate">
                              {conv.responded_by_name || <span className="text-amber-600">Aguardando...</span>}
                            </p>
                          </div>
                          <div className="bg-slate-100 rounded-lg p-2">
                            <p className="text-[8px] text-slate-500 uppercase">Cliques</p>
                            <p className="text-sm font-bold text-slate-700">
                              {conv.click_count}
                              {conv.click_count > 1 && <span className="ml-1 text-cyan-500">🔄</span>}
                            </p>
                          </div>
                        </div>
                        
                        {/* Datas */}
                        <div className="flex justify-between text-[10px] text-slate-500 mb-3">
                          <div>
                            <span className="font-medium">1º Clique:</span>{' '}
                            {conv.first_click_at ? new Date(conv.first_click_at).toLocaleDateString('pt-BR') : '-'}
                          </div>
                          <div>
                            <span className="font-medium">Último:</span>{' '}
                            {conv.last_click_at ? new Date(conv.last_click_at).toLocaleDateString('pt-BR') : '-'}
                          </div>
                        </div>
                        
                        {/* Ações */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/inbox?chat=${conv.id}`); }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 text-green-600 rounded-lg text-xs font-medium"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Chat
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); fetchContactHistory(conv.id, conv.client_name); }}
                            className="px-2 py-1.5 bg-cyan-100 text-cyan-600 rounded-lg"
                          >
                            <span className="material-symbols-outlined text-sm">history</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/lead/${conv.id}`); }}
                            className="px-2 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg"
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
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Contato</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Origem</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Etapa</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Respondido por</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500 text-sm">Tempo Resp.</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500 text-sm">Cliques</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">1º Clique</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Último Clique</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500 text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedConversations.map((conv) => (
                    <tr 
                      key={conv.id} 
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{conv.client_name || 'Sem nome'}</p>
                        <p className="text-xs text-slate-400">{conv.phone_number}</p>
                      </td>
                      <td className="py-3 px-4">{getOriginBadge(conv)}</td>
                      <td className="py-3 px-4">{getStatusBadge(conv.status)}</td>
                      <td className="py-3 px-4">
                        {conv.responded_by_name ? (
                          <span className="text-sm text-slate-700">{conv.responded_by_name}</span>
                        ) : (
                          <span className="text-sm text-amber-600 font-medium">Aguardando...</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {conv.response_time_seconds !== null ? (
                          <span className={`text-sm font-medium ${conv.response_time_seconds <= 300 ? 'text-green-600' : conv.response_time_seconds <= 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                            {formatResponseTime(conv.response_time_seconds)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-medium text-slate-700">
                          {conv.click_count}
                          {conv.click_count > 1 && <span className="ml-1 text-cyan-500">🔄</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {conv.first_click_at ? (
                          <div>
                            <p>{new Date(conv.first_click_at).toLocaleDateString('pt-BR')}</p>
                            <p className="text-xs text-slate-400">{new Date(conv.first_click_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {conv.last_click_at ? (
                          <div>
                            <p>{new Date(conv.last_click_at).toLocaleDateString('pt-BR')}</p>
                            <p className="text-xs text-slate-400">{new Date(conv.last_click_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/inbox?chat=${conv.id}`)}
                            className="p-1.5 hover:bg-green-50 rounded text-green-600"
                            title="Ir para conversa"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => fetchContactHistory(conv.id, conv.client_name)}
                            className="p-1.5 hover:bg-cyan-50 rounded text-cyan-600"
                            title="Ver histórico de contatos"
                          >
                            <span className="material-symbols-outlined text-lg">history</span>
                          </button>
                          <button
                            onClick={() => navigate(`/lead/${conv.id}`)}
                            className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600"
                            title="Ver detalhes"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-t border-slate-200">
                <p className="text-xs sm:text-sm text-slate-500">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredConversations.length)} de {filteredConversations.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Anterior
                  </button>
                  <span className="text-xs sm:text-sm text-slate-600">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                      currentPage >= totalPages
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Histórico de Contatos */}
      {historyModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-slate-900">Histórico de Contatos</h3>
                <p className="text-xs sm:text-sm text-slate-500 truncate max-w-[200px] sm:max-w-none">{historyModal.clientName}</p>
              </div>
              <button
                onClick={() => setHistoryModal({ open: false, chatId: null, clientName: '' })}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-2 sm:p-4 overflow-y-auto max-h-[70vh] sm:max-h-[60vh]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 sm:py-12">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-cyan-500"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 mb-2">history</span>
                  <p className="text-slate-500 text-xs sm:text-sm">Nenhum clique registrado.</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {historyData.map((click, index) => (
                    <div 
                      key={click.id} 
                      className={`border rounded-lg sm:rounded-xl p-2.5 sm:p-4 ${index === 0 ? 'border-cyan-300 bg-cyan-50/50' : 'border-slate-200'}`}
                    >
                      {/* Header do clique */}
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${index === 0 ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {historyData.length - index}
                          </span>
                          <span className="font-medium text-slate-900 text-xs sm:text-sm">
                            {index === 0 ? 'Último' : `#${historyData.length - index}`}
                          </span>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded text-[9px] sm:text-xs font-medium hidden sm:inline">Mais recente</span>
                          )}
                        </div>
                        {getSourceBadge(click.utm_source)}
                      </div>
                      
                      {/* Dados do clique */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <p className="text-slate-500 text-[9px] sm:text-xs mb-0.5">Data</p>
                          <p className="font-medium text-slate-900 text-[10px] sm:text-sm">
                            {new Date(click.clicked_at).toLocaleDateString('pt-BR')} {new Date(click.clicked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[9px] sm:text-xs mb-0.5">Tempo Resp.</p>
                          <p className={`font-medium text-[10px] sm:text-sm ${click.response_time_seconds !== null ? (click.response_time_seconds <= 300 ? 'text-green-600' : click.response_time_seconds <= 1800 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                            {click.response_time_seconds !== null ? formatResponseTime(click.response_time_seconds) : 'Sem resposta'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[9px] sm:text-xs mb-0.5">Respondido por</p>
                          <p className="font-medium text-slate-900 text-[10px] sm:text-sm truncate">{click.responded_by_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[9px] sm:text-xs mb-0.5">Dispositivo</p>
                          <p className="font-medium text-slate-900 text-[10px] sm:text-sm truncate">{click.device_type || '-'} {click.os ? `(${click.os})` : ''}</p>
                        </div>
                      </div>
                      
                      {/* UTMs */}
                      {(click.utm_medium || click.utm_campaign || click.utm_content) && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-100">
                          <p className="text-slate-500 text-[9px] sm:text-xs mb-1">UTMs</p>
                          <div className="flex flex-wrap gap-1">
                            {click.utm_source && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] sm:text-xs">src: {click.utm_source}</span>}
                            {click.utm_medium && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] sm:text-xs">med: {click.utm_medium}</span>}
                            {click.utm_campaign && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] sm:text-xs truncate max-w-[100px] sm:max-w-none">camp: {click.utm_campaign}</span>}
                            {click.utm_content && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] sm:text-xs truncate max-w-[100px] sm:max-w-none">cont: {click.utm_content}</span>}
                          </div>
                        </div>
                      )}
                      
                      {/* Referrer - Oculto no mobile */}
                      {click.referrer && (
                        <div className="mt-2 hidden sm:block">
                          <p className="text-slate-500 text-xs mb-0.5">Referrer</p>
                          <p className="text-xs text-slate-600 truncate">{click.referrer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
