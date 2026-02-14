import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { parseLocalDate } from '../lib/dates';

interface LeadDetailProps {
  state: { selectedClinic: { id: string } | null };
}

interface LeadData {
  id: string;
  client_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  source_id: string | null;
  ad_title: string | null;
  ad_body: string | null;
  ad_source_id: string | null;
  ad_source_type: string | null;
  ad_source_url: string | null;
  meta_account_id: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  meta_adset_id: string | null;
  meta_adset_name: string | null;
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  lead_sources?: { code: string; name: string; color: string } | null;
}

interface TrackableLinkData {
  id: string;
  name: string;
  code: string;
  clicks_count: number;
  leads_count: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

interface LinkClickData {
  id: string;
  clicked_at: string;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  device_model: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  ip_address: string | null;
  fbclid: string | null;
  gclid: string | null;
  belitx_fbid: string | null;
  ad_id: string | null;
  site_source: string | null;
  placement: string | null;
}

interface MetaEvent {
  id: string;
  event_name: string;
  event_time: number;
  value: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  value: number;
  description: string | null;
  payment_date: string;
  payment_method: string | null;
  status: string;
  created_at: string;
  created_by_name: string | null;
}

interface TimelineEvent {
  id: string;
  type: 'click' | 'message' | 'response' | 'status_change' | 'payment';
  timestamp: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  metadata?: Record<string, any>;
}

const LeadDetail: React.FC<LeadDetailProps> = ({ state }) => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { clinic, isImpersonating, impersonatedClinic } = useAuth();
  
  const clinicId = isImpersonating && impersonatedClinic ? impersonatedClinic.id : (state.selectedClinic?.id || clinic?.id);
  
  const [lead, setLead] = useState<LeadData | null>(null);
  const [metaEvents, setMetaEvents] = useState<MetaEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [trackableLink, setTrackableLink] = useState<TrackableLinkData | null>(null);
  const [linkClick, setLinkClick] = useState<LinkClickData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !clinicId) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Buscar dados iniciais em paralelo (4 queries independentes)
      const [
        { data: chatData },
        { data: eventsData },
        { data: paymentsData },
        { data: clickByChat }
      ] = await Promise.all([
        supabase
          .from('chats')
          .select(`
            id, client_name, phone_number, status, created_at,
            source_id, ad_title, ad_body, ad_source_id, ad_source_type, ad_source_url,
            meta_account_id, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name,
            meta_ad_id, meta_ad_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid,
            lead_sources!chats_source_id_fkey(code, name, color)
          `)
          .eq('id', chatId)
          .eq('clinic_id', clinicId)
          .single(),
        (supabase as any)
          .from('meta_conversion_logs')
          .select('id, event_name, event_time, value, status, error_message, created_at')
          .eq('chat_id', chatId)
          .eq('clinic_id', clinicId)
          .order('event_time', { ascending: false }),
        (supabase as any)
          .from('payments')
          .select('id, value, description, payment_date, payment_method, status, created_at, users:created_by(name)')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('link_clicks')
          .select('id, clicked_at, browser, os, device_type, device_model, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, ip_address, fbclid, gclid, belitx_fbid, ad_id, site_source, placement, link_id')
          .eq('chat_id', chatId)
          .order('clicked_at', { ascending: false })
          .limit(1)
          .single()
      ]);
      
      if (chatData) {
        let leadData = chatData as any;
        
        // Se tem ad_source_id mas não tem dados da campanha, buscar na Meta API
        if (leadData.ad_source_id && !leadData.meta_campaign_name) {
          try {
            const { data: adInfo } = await supabase.functions.invoke('meta-ads-api', {
              body: { clinic_id: clinicId, action: 'get_ad_info', ad_id: leadData.ad_source_id }
            });
            if (adInfo?.data) {
              leadData = {
                ...leadData,
                meta_ad_name: adInfo.data.ad_name || leadData.meta_ad_name,
                meta_campaign_name: adInfo.data.campaign_name || leadData.meta_campaign_name,
                meta_adset_name: adInfo.data.adset_name || leadData.meta_adset_name,
              };
            }
          } catch (e) {
            console.log('Erro ao buscar dados do anúncio:', e);
          }
        }
        
        setLead(leadData);
      }
      
      if (eventsData) {
        setMetaEvents(eventsData as MetaEvent[]);
      }
      
      if (paymentsData) {
        setPayments(paymentsData.map((p: any) => ({
          ...p,
          created_by_name: p.users?.name || null
        })) as Payment[]);
      }
      
      if (clickByChat) {
        setLinkClick(clickByChat as LinkClickData);
        
        // Buscar dados do link associado ao clique
        const { data: linkFromClick } = await (supabase as any)
          .from('trackable_links')
          .select('id, name, code, clicks_count, leads_count, utm_source, utm_medium, utm_campaign')
          .eq('id', clickByChat.link_id)
          .single();
        
        if (linkFromClick) {
          setTrackableLink(linkFromClick as TrackableLinkData);
        }
      } 
      // ESTRATÉGIA 2: Buscar pelo source_id (fallback para links antigos)
      else if (chatData?.source_id) {
        const { data: linkData } = await (supabase as any)
          .from('trackable_links')
          .select('id, name, code, clicks_count, leads_count, utm_source, utm_medium, utm_campaign')
          .eq('source_id', chatData.source_id)
          .single();
        
        if (linkData) {
          setTrackableLink(linkData as TrackableLinkData);
          
          // Buscar clique mais próximo da data de criação do lead (até 5 minutos antes)
          const leadDate = new Date(chatData.created_at);
          const fiveMinutesBefore = new Date(leadDate.getTime() - 5 * 60 * 1000).toISOString();
          
          const { data: clickData } = await (supabase as any)
            .from('link_clicks')
            .select('id, clicked_at, browser, os, device_type, device_model, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, ip_address, fbclid, gclid, belitx_fbid, ad_id, site_source, placement')
            .eq('link_id', linkData.id)
            .gte('clicked_at', fiveMinutesBefore)
            .lte('clicked_at', chatData.created_at)
            .order('clicked_at', { ascending: false })
            .limit(1)
            .single();
          
          if (clickData) {
            setLinkClick(clickData as LinkClickData);
          } else {
            // Se não encontrou no intervalo, buscar o último clique do link
            const { data: lastClick } = await (supabase as any)
              .from('link_clicks')
              .select('id, clicked_at, browser, os, device_type, device_model, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, ip_address, fbclid, gclid, belitx_fbid, ad_id, site_source, placement')
              .eq('link_id', linkData.id)
              .order('clicked_at', { ascending: false })
              .limit(1)
              .single();
            
            if (lastClick) {
              setLinkClick(lastClick as LinkClickData);
            }
          }
        }
      }
      
      // Construir Timeline de Interações
      const timelineEvents: TimelineEvent[] = [];
      
      // 1. Buscar TODOS os cliques do link associados a este chat
      const { data: allClicks } = await (supabase as any)
        .from('link_clicks')
        .select('id, clicked_at, browser, os, device_type, device_model, utm_source')
        .eq('chat_id', chatId)
        .order('clicked_at', { ascending: true });
      
      // Determinar a data do primeiro clique (início da jornada do link)
      let firstClickDate: Date | null = null;
      
      if (allClicks && allClicks.length > 0) {
        firstClickDate = new Date(allClicks[0].clicked_at);
        
        allClicks.forEach((click: any, index: number) => {
          const deviceInfo = [click.device_type, click.os, click.browser].filter(Boolean).join(' • ');
          timelineEvents.push({
            id: `click_${click.id}`,
            type: 'click',
            timestamp: click.clicked_at,
            title: index === 0 ? 'Clique no link rastreável' : `Retorno - Clique #${index + 1}`,
            description: deviceInfo || 'Dispositivo não identificado',
            icon: 'ads_click',
            color: 'cyan',
            metadata: { utm_source: click.utm_source }
          });
        });
      }
      
      // 2. Buscar mensagens - se tiver clique, filtrar apenas após o primeiro clique
      let messagesQuery = (supabase as any)
        .from('messages')
        .select('id, content, is_from_client, created_at, sent_by')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      const { data: messages } = await messagesQuery;
      
      if (messages) {
        // Buscar nomes dos usuários que responderam
        const userIds = [...new Set(messages.filter((m: any) => !m.is_from_client && m.sent_by).map((m: any) => m.sent_by))];
        let usersMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, name')
            .in('id', userIds as string[]);
          
          if (users) {
            usersMap = users.reduce((acc: Record<string, string>, u: any) => {
              acc[u.id] = u.name;
              return acc;
            }, {});
          }
        }
        
        let firstClientMsgAfterClick = true;
        let firstResponseAfterClick = true;
        
        messages.forEach((msg: any) => {
          const msgDate = new Date(msg.created_at);
          
          // Se tiver clique, só mostrar mensagens após o primeiro clique (com margem de 5 min antes)
          if (firstClickDate) {
            const marginDate = new Date(firstClickDate.getTime() - 5 * 60 * 1000); // 5 min antes do clique
            if (msgDate < marginDate) return; // Pular mensagens antigas
          }
          
          const contentPreview = msg.content?.substring(0, 80) + (msg.content?.length > 80 ? '...' : '') || '[Sem conteúdo]';
          
          if (msg.is_from_client) {
            timelineEvents.push({
              id: `msg_${msg.id}`,
              type: 'message',
              timestamp: msg.created_at,
              title: firstClientMsgAfterClick ? 'Mensagem com código do link' : 'Mensagem do cliente',
              description: contentPreview,
              icon: 'chat',
              color: 'blue'
            });
            firstClientMsgAfterClick = false;
          } else {
            const senderName = msg.sent_by ? usersMap[msg.sent_by] || 'Atendente' : 'Sistema';
            timelineEvents.push({
              id: `resp_${msg.id}`,
              type: 'response',
              timestamp: msg.created_at,
              title: firstResponseAfterClick ? `Primeira resposta (${senderName})` : `Resposta de ${senderName}`,
              description: contentPreview,
              icon: 'reply',
              color: 'green'
            });
            firstResponseAfterClick = false;
          }
        });
      }
      
      // 3. Adicionar evento de associação ao link (se tiver source_id)
      if (chatData && (chatData as any).source_id && firstClickDate) {
        timelineEvents.push({
          id: 'link_associated',
          type: 'status_change',
          timestamp: firstClickDate.toISOString(),
          title: 'Lead associado ao link',
          description: `Origem: ${trackableLink?.name || 'Link Rastreável'}`,
          icon: 'link',
          color: 'indigo'
        });
      }
      
      // Ordenar timeline por data
      timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setTimeline(timelineEvents);
      
      setLoading(false);
    };
    
    fetchData();
  }, [chatId, clinicId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Novo Lead': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Agendado': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Em Atendimento': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Convertido': return 'bg-green-100 text-green-700 border-green-200';
      case 'Perdido': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEventColor = (eventName: string, status: string) => {
    if (status === 'error') return 'bg-red-100 text-red-700';
    switch (eventName) {
      case 'Lead': return 'bg-blue-100 text-blue-700';
      case 'Contact': return 'bg-cyan-100 text-cyan-700';
      case 'Schedule': return 'bg-purple-100 text-purple-700';
      case 'Purchase': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const totalRevenue = payments
    .filter(p => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.value || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">person_off</span>
          <h2 className="text-xl font-bold text-slate-700">Lead não encontrado</h2>
          <button 
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{lead.client_name}</h1>
            <p className="text-xs sm:text-base text-slate-500">{lead.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-9 sm:ml-0">
          <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium border ${getStatusColor(lead.status)}`}>
            {lead.status}
          </span>
          <button
            onClick={() => navigate(`/inbox?chat=${chatId}`)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            <span className="hidden sm:inline">Ver Conversa</span>
            <span className="sm:hidden">Chat</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Coluna 1: Informações do Lead */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Card: Origem do Lead */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-indigo-600 to-blue-600">
              <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                <span className="material-symbols-outlined text-lg sm:text-xl">analytics</span>
                Origem do Lead
              </h2>
            </div>
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Código</p>
                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium text-xs sm:text-sm">
                    {lead.lead_sources?.code || '-'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Origem</p>
                  <p className="text-slate-800 font-medium text-xs sm:text-base truncate">
                    {lead.ad_title ? 'Meta Ads' : lead.lead_sources?.name || 'Orgânico'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Chegou em</p>
                  <p className="text-slate-800 text-xs sm:text-base">{new Date(lead.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Status</p>
                  <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Dados do Link Rastreável */}
          {trackableLink && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 bg-gradient-to-r from-cyan-600 to-blue-600">
                <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className="material-symbols-outlined text-lg sm:text-xl">link</span>
                  Link Rastreável
                </h2>
              </div>
              <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Nome</p>
                    <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{trackableLink.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Código</p>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-cyan-100 text-cyan-700 font-bold text-xs sm:text-sm">
                      {trackableLink.code}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Cliques</p>
                    <p className="text-slate-800 font-bold text-base sm:text-lg">{trackableLink.clicks_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1">Leads</p>
                    <p className="text-slate-800 font-bold text-base sm:text-lg">{trackableLink.leads_count || 0}</p>
                  </div>
                </div>
                
                {/* UTMs do Link */}
                {(trackableLink.utm_source || trackableLink.utm_medium || trackableLink.utm_campaign) && (
                  <div className="pt-3 sm:pt-4 border-t border-slate-100">
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-2">UTMs</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {trackableLink.utm_source && (
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 rounded text-[10px] sm:text-xs text-slate-600">
                          src: {trackableLink.utm_source}
                        </span>
                      )}
                      {trackableLink.utm_medium && (
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 rounded text-[10px] sm:text-xs text-slate-600">
                          med: {trackableLink.utm_medium}
                        </span>
                      )}
                      {trackableLink.utm_campaign && (
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-100 rounded text-[10px] sm:text-xs text-slate-600">
                          camp: {trackableLink.utm_campaign}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Dados do Clique */}
                {linkClick && (
                  <div className="pt-3 sm:pt-4 border-t border-slate-100">
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-2 sm:mb-3">Dados do Clique</p>
                    
                    {/* Dispositivo */}
                    <div className="bg-slate-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-2 sm:mb-3">
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1.5 sm:mb-2">Dispositivo</p>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {linkClick.device_type && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="material-symbols-outlined text-cyan-500 text-base sm:text-lg">
                              {linkClick.device_type === 'mobile' ? 'smartphone' : linkClick.device_type === 'tablet' ? 'tablet' : 'computer'}
                            </span>
                            <div>
                              <p className="text-[9px] sm:text-xs text-slate-500">Tipo</p>
                              <p className="text-[10px] sm:text-sm text-slate-800 font-medium capitalize">{linkClick.device_type}</p>
                            </div>
                          </div>
                        )}
                        {linkClick.os && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="material-symbols-outlined text-cyan-500 text-base sm:text-lg">memory</span>
                            <div>
                              <p className="text-[9px] sm:text-xs text-slate-500">Sistema</p>
                              <p className="text-[10px] sm:text-sm text-slate-800 font-medium truncate">{linkClick.os}</p>
                            </div>
                          </div>
                        )}
                        {linkClick.browser && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="material-symbols-outlined text-cyan-500 text-base sm:text-lg">public</span>
                            <div>
                              <p className="text-[9px] sm:text-xs text-slate-500">Navegador</p>
                              <p className="text-[10px] sm:text-sm text-slate-800 font-medium truncate">{linkClick.browser}</p>
                            </div>
                          </div>
                        )}
                        {linkClick.device_model && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="material-symbols-outlined text-cyan-500 text-base sm:text-lg">phone_android</span>
                            <div>
                              <p className="text-[9px] sm:text-xs text-slate-500">Modelo</p>
                              <p className="text-[10px] sm:text-sm text-slate-800 font-medium truncate">{linkClick.device_model}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* UTMs do Clique */}
                    {(linkClick.utm_source || linkClick.utm_medium || linkClick.utm_campaign) && (
                      <div className="bg-amber-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-2 sm:mb-3">
                        <p className="text-[10px] sm:text-xs text-amber-700 uppercase font-medium mb-1.5 sm:mb-2">UTMs</p>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {linkClick.utm_source && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded text-[9px] sm:text-xs font-medium">
                              src: {linkClick.utm_source}
                            </span>
                          )}
                          {linkClick.utm_medium && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded text-[9px] sm:text-xs font-medium">
                              med: {linkClick.utm_medium}
                            </span>
                          )}
                          {linkClick.utm_campaign && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded text-[9px] sm:text-xs font-medium">
                              camp: {linkClick.utm_campaign}
                            </span>
                          )}
                          {linkClick.utm_content && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded text-[9px] sm:text-xs font-medium">
                              cont: {linkClick.utm_content}
                            </span>
                          )}
                          {linkClick.utm_term && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded text-[9px] sm:text-xs font-medium">
                              term: {linkClick.utm_term}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* IDs de Rastreamento (Meta/Google) */}
                    {(linkClick.fbclid || linkClick.gclid || linkClick.belitx_fbid) && (
                      <div className="bg-purple-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-2 sm:mb-3">
                        <p className="text-[10px] sm:text-xs text-purple-700 uppercase font-medium mb-1.5 sm:mb-2">IDs Rastreamento</p>
                        <div className="space-y-1.5 sm:space-y-2">
                          {linkClick.fbclid && (
                            <div>
                              <p className="text-[9px] sm:text-xs text-purple-600">fbclid</p>
                              <code className="text-[9px] sm:text-xs bg-purple-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-purple-800 block truncate">{linkClick.fbclid}</code>
                            </div>
                          )}
                          {linkClick.gclid && (
                            <div>
                              <p className="text-[9px] sm:text-xs text-purple-600">gclid</p>
                              <code className="text-[9px] sm:text-xs bg-purple-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-purple-800 block truncate">{linkClick.gclid}</code>
                            </div>
                          )}
                          {linkClick.belitx_fbid && (
                            <div>
                              <p className="text-[9px] sm:text-xs text-purple-600">Belitx FB ID</p>
                              <code className="text-[9px] sm:text-xs bg-purple-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-purple-800 block truncate">{linkClick.belitx_fbid}</code>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Dados do Anúncio Meta */}
                    {(linkClick.ad_id || linkClick.site_source || linkClick.placement) && (
                      <div className="bg-pink-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-2 sm:mb-3">
                        <p className="text-[10px] sm:text-xs text-pink-700 uppercase font-medium mb-1.5 sm:mb-2">Anúncio Meta</p>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          {linkClick.ad_id && (
                            <div>
                              <p className="text-[9px] sm:text-xs text-pink-600">ID</p>
                              <p className="text-[10px] sm:text-sm text-pink-800 font-medium truncate">{linkClick.ad_id}</p>
                            </div>
                          )}
                          {linkClick.site_source && (
                            <div>
                              <p className="text-[9px] sm:text-xs text-pink-600">Origem</p>
                              <p className="text-[10px] sm:text-sm text-pink-800 font-medium truncate">{linkClick.site_source}</p>
                            </div>
                          )}
                          {linkClick.placement && (
                            <div className="col-span-2">
                              <p className="text-[9px] sm:text-xs text-pink-600">Posicionamento</p>
                              <p className="text-[10px] sm:text-sm text-pink-800 font-medium truncate">{linkClick.placement}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Outras Informações */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      {linkClick.clicked_at && (
                        <div>
                          <p className="text-[9px] sm:text-xs text-slate-500">Data Clique</p>
                          <p className="text-slate-800 font-medium text-[10px] sm:text-sm">{new Date(linkClick.clicked_at).toLocaleString('pt-BR')}</p>
                        </div>
                      )}
                      {linkClick.ip_address && (
                        <div>
                          <p className="text-[9px] sm:text-xs text-slate-500">IP</p>
                          <p className="text-slate-800 font-medium text-[10px] sm:text-sm">{linkClick.ip_address}</p>
                        </div>
                      )}
                    </div>
                    
                    {linkClick.referrer && (
                      <div className="mt-2 sm:mt-3">
                        <p className="text-[9px] sm:text-xs text-slate-500 mb-1">Referrer</p>
                        <p className="text-[9px] sm:text-xs text-slate-600 bg-slate-100 p-1.5 sm:p-2 rounded truncate">{linkClick.referrer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card: Dados do Anúncio Meta (Click to WhatsApp) */}
          {lead.ad_title && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 bg-gradient-to-r from-pink-600 to-purple-600">
                <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className="material-symbols-outlined text-lg sm:text-xl">campaign</span>
                  Anúncio Meta
                </h2>
              </div>
              <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                {/* Hierarquia da Campanha */}
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-pink-700 uppercase font-medium mb-2 sm:mb-3">Hierarquia</p>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-pink-600 text-xs sm:text-sm">flag</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] sm:text-xs text-slate-500">Campanha</p>
                        <p className="text-slate-800 font-medium text-[10px] sm:text-base truncate">{lead.meta_campaign_name || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 ml-3 sm:ml-4 border-l-2 border-pink-200 pl-2 sm:pl-4">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-purple-600 text-xs sm:text-sm">folder</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] sm:text-xs text-slate-500">Conjunto</p>
                        <p className="text-slate-800 font-medium text-[10px] sm:text-base truncate">{lead.meta_adset_name || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 ml-6 sm:ml-8 border-l-2 border-purple-200 pl-2 sm:pl-4">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-indigo-600 text-xs sm:text-sm">ads_click</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] sm:text-xs text-slate-500">Anúncio</p>
                        <p className="text-slate-800 font-medium text-[10px] sm:text-base truncate">{lead.meta_ad_name || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Conteúdo do Anúncio */}
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1 sm:mb-2">Título</p>
                  <p className="text-slate-800 font-medium text-xs sm:text-base">{lead.ad_title}</p>
                </div>
                
                {lead.ad_body && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1 sm:mb-2">Texto</p>
                    <p className="text-slate-600 text-[10px] sm:text-sm whitespace-pre-wrap bg-slate-50 p-2 sm:p-3 rounded-lg max-h-28 sm:max-h-40 overflow-y-auto">{lead.ad_body}</p>
                  </div>
                )}
                
                {/* Link do Post/Anúncio */}
                {lead.ad_source_url && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1 sm:mb-2">Link</p>
                    <a 
                      href={lead.ad_source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] sm:text-sm text-pink-600 hover:text-pink-700 flex items-center gap-1 truncate"
                    >
                      <span className="material-symbols-outlined text-xs sm:text-sm">open_in_new</span>
                      <span className="truncate">{lead.ad_source_url}</span>
                    </a>
                  </div>
                )}
                
                {/* IDs Técnicos */}
                <div className="pt-3 sm:pt-4 border-t border-slate-100">
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1.5 sm:mb-2">IDs Técnicos</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[9px] sm:text-xs">
                    {lead.ad_source_id && (
                      <div>
                        <p className="text-slate-500">ad_source_id</p>
                        <code className="bg-slate-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded block truncate text-[8px] sm:text-xs">{lead.ad_source_id}</code>
                      </div>
                    )}
                    {lead.ad_source_type && (
                      <div>
                        <p className="text-slate-500">ad_source_type</p>
                        <code className="bg-slate-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded block text-[8px] sm:text-xs">{lead.ad_source_type}</code>
                      </div>
                    )}
                    {lead.meta_account_id && (
                      <div className="col-span-2">
                        <p className="text-slate-500">meta_account_id</p>
                        <code className="bg-slate-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded block truncate text-[8px] sm:text-xs">{lead.meta_account_id}</code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Card: Google Ads (gclid) */}
          {lead.gclid && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-500 to-green-500">
                <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className="material-symbols-outlined text-lg sm:text-xl">ads_click</span>
                  Google Ads
                </h2>
              </div>
              <div className="p-3 sm:p-6">
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-1 sm:mb-2">gclid</p>
                  <code className="text-[9px] sm:text-xs bg-slate-100 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg block break-all">{lead.gclid}</code>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5 sm:mt-2">Lead de Google Ads</p>
                </div>
              </div>
            </div>
          )}

          {/* Card: UTM Parameters */}
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-500 to-orange-500">
                <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className="material-symbols-outlined text-lg sm:text-xl">link</span>
                  Parâmetros UTM
                </h2>
              </div>
              <div className="p-3 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                  {lead.utm_source && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-0.5 sm:mb-1">source</p>
                      <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{lead.utm_source}</p>
                    </div>
                  )}
                  {lead.utm_medium && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-0.5 sm:mb-1">medium</p>
                      <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{lead.utm_medium}</p>
                    </div>
                  )}
                  {lead.utm_campaign && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-0.5 sm:mb-1">campaign</p>
                      <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{lead.utm_campaign}</p>
                    </div>
                  )}
                  {lead.utm_content && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-0.5 sm:mb-1">content</p>
                      <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{lead.utm_content}</p>
                    </div>
                  )}
                  {lead.utm_term && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium mb-0.5 sm:mb-1">term</p>
                      <p className="text-slate-800 font-medium text-xs sm:text-base truncate">{lead.utm_term}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 2: Eventos Meta e Pagamentos */}
        <div className="space-y-4 sm:space-y-6">
          {/* Card: Receita Total */}
          {totalRevenue > 0 && (
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">payments</span>
                <div>
                  <p className="text-green-100 text-[10px] sm:text-sm">Receita Total</p>
                  <p className="text-xl sm:text-3xl font-black">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Eventos Meta */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                <span className="material-symbols-outlined text-lg sm:text-xl">send</span>
                Eventos Meta
              </h2>
            </div>
            <div className="p-3 sm:p-4">
              {metaEvents.length === 0 ? (
                <p className="text-slate-500 text-center py-3 sm:py-4 text-xs sm:text-sm">Nenhum evento enviado</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {metaEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border ${event.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold ${getEventColor(event.event_name, event.status)}`}>
                          {event.event_name}
                        </span>
                        <span className={`text-[10px] sm:text-xs font-medium ${event.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {event.status === 'success' ? '✓ Enviado' : '✗ Erro'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] sm:text-sm">
                        <span className="text-slate-500">
                          {new Date(event.event_time * 1000).toLocaleString('pt-BR')}
                        </span>
                        {event.value > 0 && (
                          <span className="font-bold text-green-600">
                            R$ {event.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {event.error_message && (
                        <p className="text-[9px] sm:text-xs text-red-600 mt-1 sm:mt-2 truncate">{event.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Timeline de Interações */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-violet-600 to-purple-600">
              <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                <span className="material-symbols-outlined text-lg sm:text-xl">timeline</span>
                Timeline
              </h2>
            </div>
            <div className="p-3 sm:p-4">
              {timeline.length === 0 ? (
                <div className="text-center py-4 sm:py-6">
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300">history</span>
                  <p className="text-slate-500 mt-1 sm:mt-2 text-xs sm:text-sm">Nenhuma interação</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                  <div className="space-y-2 sm:space-y-4">
                    {timeline.map((event, index) => {
                      const colorClasses: Record<string, string> = {
                        cyan: 'bg-cyan-100 text-cyan-600 border-cyan-300',
                        blue: 'bg-blue-100 text-blue-600 border-blue-300',
                        green: 'bg-green-100 text-green-600 border-green-300',
                        indigo: 'bg-indigo-100 text-indigo-600 border-indigo-300',
                        amber: 'bg-amber-100 text-amber-600 border-amber-300',
                      };
                      const bgColor = colorClasses[event.color] || colorClasses.indigo;
                      
                      return (
                        <div key={event.id} className="relative pl-8 sm:pl-10">
                          <div className={`absolute left-1 sm:left-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center ${bgColor}`}>
                            <span className="material-symbols-outlined text-[9px] sm:text-xs">{event.icon}</span>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-100">
                            <div className="flex items-start justify-between gap-1 sm:gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-800 text-[10px] sm:text-sm">{event.title}</p>
                                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">{event.description}</p>
                              </div>
                              <span className="text-[8px] sm:text-xs text-slate-400 whitespace-nowrap">
                                {new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {event.metadata?.utm_source && (
                              <span className="inline-block mt-1 sm:mt-2 px-1.5 sm:px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[9px] sm:text-xs rounded">
                                {event.metadata.utm_source}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Histórico de Negociações */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-emerald-600 to-green-600">
              <h2 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                <span className="material-symbols-outlined text-lg sm:text-xl">receipt_long</span>
                Negociações
              </h2>
            </div>
            <div className="p-3 sm:p-4">
              {payments.length === 0 ? (
                <div className="text-center py-4 sm:py-6">
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300">money_off</span>
                  <p className="text-slate-500 mt-1 sm:mt-2 text-xs sm:text-sm">Nenhuma negociação</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className={`p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-l-4 ${
                        payment.status === 'cancelled' 
                          ? 'border-red-400 bg-red-50/50' 
                          : 'border-emerald-500 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <span className={`text-base sm:text-xl font-black ${
                          payment.status === 'cancelled' ? 'text-red-400 line-through' : 'text-emerald-600'
                        }`}>
                          R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {payment.status === 'cancelled' && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-600 rounded text-[9px] sm:text-xs font-medium">
                            Cancelado
                          </span>
                        )}
                      </div>
                      {payment.description && (
                        <p className="text-[10px] sm:text-sm text-slate-700 mb-1 sm:mb-2 truncate">{payment.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 text-[9px] sm:text-xs text-slate-500">
                        <span className="flex items-center gap-0.5 sm:gap-1">
                          <span className="material-symbols-outlined text-xs sm:text-sm">calendar_today</span>
                          {parseLocalDate(payment.payment_date).toLocaleDateString('pt-BR')}
                        </span>
                        {payment.payment_method && (
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <span className="material-symbols-outlined text-xs sm:text-sm">credit_card</span>
                            {payment.payment_method}
                          </span>
                        )}
                        {payment.created_by_name && (
                          <span className="flex items-center gap-0.5 sm:gap-1 hidden sm:flex">
                            <span className="material-symbols-outlined text-xs sm:text-sm">person</span>
                            {payment.created_by_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
