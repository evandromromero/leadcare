import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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
  referrer: string | null;
  ip_address: string | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !clinicId) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Buscar dados do lead/chat
      const { data: chatData } = await supabase
        .from('chats')
        .select(`
          id, client_name, phone_number, status, created_at,
          source_id, ad_title, ad_body, ad_source_id, ad_source_type,
          meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name,
          meta_ad_id, meta_ad_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          lead_sources!chats_source_id_fkey(code, name, color)
        `)
        .eq('id', chatId)
        .eq('clinic_id', clinicId)
        .single();
      
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
      
      // Buscar eventos Meta enviados para este chat
      const { data: eventsData } = await (supabase as any)
        .from('meta_conversion_logs')
        .select('id, event_name, event_time, value, status, error_message, created_at')
        .eq('chat_id', chatId)
        .eq('clinic_id', clinicId)
        .order('event_time', { ascending: false });
      
      if (eventsData) {
        setMetaEvents(eventsData as MetaEvent[]);
      }
      
      // Buscar pagamentos/negociações do chat com o nome de quem criou
      const { data: paymentsData } = await (supabase as any)
        .from('payments')
        .select('id, value, description, payment_date, payment_method, status, created_at, users:created_by(name)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });
      
      if (paymentsData) {
        setPayments(paymentsData.map((p: any) => ({
          ...p,
          created_by_name: p.users?.name || null
        })) as Payment[]);
      }
      
      // Buscar dados do link rastreável se o lead veio de um link
      if (chatData?.source_id) {
        const { data: linkData } = await (supabase as any)
          .from('trackable_links')
          .select('id, name, code, clicks_count, leads_count, utm_source, utm_medium, utm_campaign')
          .eq('source_id', chatData.source_id)
          .single();
        
        if (linkData) {
          setTrackableLink(linkData as TrackableLinkData);
          
          // Buscar último clique do link (mais próximo da data de criação do lead)
          const { data: clickData } = await (supabase as any)
            .from('link_clicks')
            .select('id, clicked_at, browser, os, device_type, device_model, utm_source, utm_medium, utm_campaign, referrer, ip_address')
            .eq('link_id', linkData.id)
            .lte('clicked_at', chatData.created_at)
            .order('clicked_at', { ascending: false })
            .limit(1)
            .single();
          
          if (clickData) {
            setLinkClick(clickData as LinkClickData);
          }
        }
      }
      
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{lead.client_name}</h1>
          <p className="text-slate-500">{lead.phone_number}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(lead.status)}`}>
          {lead.status}
        </span>
        <button
          onClick={() => navigate(`/inbox?chat=${chatId}`)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">chat</span>
          Ver Conversa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Informações do Lead */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Origem do Lead */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-600">
              <h2 className="text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">analytics</span>
                Origem do Lead
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Código</p>
                  <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium text-sm">
                    {lead.lead_sources?.code || '-'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Origem</p>
                  <p className="text-slate-800 font-medium">
                    {lead.ad_title ? 'Meta Ads (Click to WhatsApp)' : lead.lead_sources?.name || 'Orgânico'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Chegou em</p>
                  <p className="text-slate-800">{new Date(lead.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Status Atual</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Dados do Link Rastreável */}
          {trackableLink && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">link</span>
                  Link Rastreável
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Nome do Link</p>
                    <p className="text-slate-800 font-medium">{trackableLink.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Código</p>
                    <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 font-bold text-sm">
                      {trackableLink.code}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Total de Cliques</p>
                    <p className="text-slate-800 font-bold text-lg">{trackableLink.clicks_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Total de Leads</p>
                    <p className="text-slate-800 font-bold text-lg">{trackableLink.leads_count || 0}</p>
                  </div>
                </div>
                
                {/* UTMs do Link */}
                {(trackableLink.utm_source || trackableLink.utm_medium || trackableLink.utm_campaign) && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-2">UTMs Configurados no Link</p>
                    <div className="flex flex-wrap gap-2">
                      {trackableLink.utm_source && (
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                          source: {trackableLink.utm_source}
                        </span>
                      )}
                      {trackableLink.utm_medium && (
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                          medium: {trackableLink.utm_medium}
                        </span>
                      )}
                      {trackableLink.utm_campaign && (
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                          campaign: {trackableLink.utm_campaign}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Dados do Clique */}
                {linkClick && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-3">Dados do Clique</p>
                    <div className="grid grid-cols-2 gap-3">
                      {linkClick.device_type && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-sm">
                            {linkClick.device_type === 'mobile' ? 'smartphone' : linkClick.device_type === 'tablet' ? 'tablet' : 'computer'}
                          </span>
                          <span className="text-sm text-slate-700 capitalize">{linkClick.device_type}</span>
                        </div>
                      )}
                      {linkClick.os && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-sm">settings</span>
                          <span className="text-sm text-slate-700">{linkClick.os}</span>
                        </div>
                      )}
                      {linkClick.browser && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-sm">public</span>
                          <span className="text-sm text-slate-700">{linkClick.browser}</span>
                        </div>
                      )}
                      {linkClick.clicked_at && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-sm">schedule</span>
                          <span className="text-sm text-slate-700">{new Date(linkClick.clicked_at).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                    {linkClick.referrer && (
                      <div className="mt-3">
                        <p className="text-xs text-slate-500 mb-1">Referrer</p>
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded truncate">{linkClick.referrer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card: Dados do Anúncio Meta */}
          {lead.ad_title && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-pink-600 to-purple-600">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">campaign</span>
                  Dados do Anúncio Meta
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Campanha</p>
                    <p className="text-slate-800 font-medium">{lead.meta_campaign_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Conjunto de Anúncios</p>
                    <p className="text-slate-800 font-medium">{lead.meta_adset_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Anúncio</p>
                    <p className="text-slate-800 font-medium">{lead.meta_ad_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">Descrição</p>
                    <p className="text-slate-600 text-sm">{lead.ad_title}</p>
                  </div>
                </div>
                {lead.ad_source_id && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium mb-1">ID do Anúncio</p>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded">{lead.ad_source_id}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card: UTM Parameters */}
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">link</span>
                  Parâmetros UTM
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {lead.utm_source && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-1">utm_source</p>
                      <p className="text-slate-800 font-medium">{lead.utm_source}</p>
                    </div>
                  )}
                  {lead.utm_medium && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-1">utm_medium</p>
                      <p className="text-slate-800 font-medium">{lead.utm_medium}</p>
                    </div>
                  )}
                  {lead.utm_campaign && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-1">utm_campaign</p>
                      <p className="text-slate-800 font-medium">{lead.utm_campaign}</p>
                    </div>
                  )}
                  {lead.utm_content && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-1">utm_content</p>
                      <p className="text-slate-800 font-medium">{lead.utm_content}</p>
                    </div>
                  )}
                  {lead.utm_term && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-1">utm_term</p>
                      <p className="text-slate-800 font-medium">{lead.utm_term}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 2: Eventos Meta e Pagamentos */}
        <div className="space-y-6">
          {/* Card: Receita Total */}
          {totalRevenue > 0 && (
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-3xl">payments</span>
                <div>
                  <p className="text-green-100 text-sm">Receita Total</p>
                  <p className="text-3xl font-black">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Eventos Meta */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">send</span>
                Eventos Enviados para Meta
              </h2>
            </div>
            <div className="p-4">
              {metaEvents.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Nenhum evento enviado ainda</p>
              ) : (
                <div className="space-y-3">
                  {metaEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className={`p-3 rounded-xl border ${event.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getEventColor(event.event_name, event.status)}`}>
                          {event.event_name}
                        </span>
                        <span className={`text-xs font-medium ${event.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {event.status === 'success' ? '✓ Enviado' : '✗ Erro'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
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
                        <p className="text-xs text-red-600 mt-2">{event.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Histórico de Negociações */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-green-600">
              <h2 className="text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                Histórico de Negociações
              </h2>
            </div>
            <div className="p-4">
              {payments.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-4xl text-slate-300">money_off</span>
                  <p className="text-slate-500 mt-2">Nenhuma negociação registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className={`p-4 rounded-xl border-l-4 ${
                        payment.status === 'cancelled' 
                          ? 'border-red-400 bg-red-50/50' 
                          : 'border-emerald-500 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-xl font-black ${
                          payment.status === 'cancelled' ? 'text-red-400 line-through' : 'text-emerald-600'
                        }`}>
                          R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {payment.status === 'cancelled' && (
                          <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium">
                            Cancelado
                          </span>
                        )}
                      </div>
                      {payment.description && (
                        <p className="text-sm text-slate-700 mb-2">{payment.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                        </span>
                        {payment.payment_method && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">credit_card</span>
                            {payment.payment_method}
                          </span>
                        )}
                        {payment.created_by_name && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">person</span>
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
