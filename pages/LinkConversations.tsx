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

export default function LinkConversations() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { clinic } = useAuth();
  
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

  useEffect(() => {
    if (linkId && clinic?.id) {
      fetchLinkInfo();
      fetchConversations();
    }
  }, [linkId, clinic?.id, dateFilter]);

  const fetchLinkInfo = async () => {
    const { data } = await supabase
      .from('trackable_links')
      .select('id, name, code, source_id')
      .eq('id', linkId)
      .eq('clinic_id', clinic?.id)
      .single();
    
    if (data) {
      setLink(data as LinkInfo);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    
    // Buscar o link para pegar o source_id
    const { data: linkData } = await supabase
      .from('trackable_links')
      .select('source_id')
      .eq('id', linkId)
      .single();
    
    if (!linkData?.source_id) {
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

    // Buscar chats que vieram deste link (pelo source_id)
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
      .eq('source_id', linkData.source_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (!chatsData || chatsData.length === 0) {
      setConversations([]);
      setStats({ total: 0, metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 });
      setLoading(false);
      return;
    }

    // Para cada chat, buscar informações adicionais
    const conversationsWithDetails = await Promise.all(
      chatsData.map(async (chat: any) => {
        // Buscar cliques do link para este telefone
        const { data: clicksData } = await supabase
          .from('link_clicks')
          .select('id, utm_source, utm_medium, utm_campaign, clicked_at')
          .eq('link_id', linkId)
          .ilike('phone_number', `%${chat.phone_number.replace(/\D/g, '').slice(-8)}%`)
          .order('clicked_at', { ascending: true });

        const clickCount = clicksData?.length || 0;
        const firstClick = clicksData?.[0];
        
        // Buscar primeira mensagem do cliente
        const { data: firstClientMsg } = await supabase
          .from('messages')
          .select('created_at')
          .eq('chat_id', chat.id)
          .eq('is_from_me', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        // Buscar primeira resposta da clínica
        const { data: firstResponse } = await supabase
          .from('messages')
          .select('created_at, sender_id')
          .eq('chat_id', chat.id)
          .eq('is_from_me', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        let respondedByName = null;
        let responseTimeSeconds = null;

        if (firstResponse?.sender_id) {
          // Buscar nome do usuário que respondeu
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('id', firstResponse.sender_id)
            .single();
          
          respondedByName = userData?.name || null;
        }

        if (firstClientMsg?.created_at && firstResponse?.created_at) {
          const clientMsgTime = new Date(firstClientMsg.created_at).getTime();
          const responseTime = new Date(firstResponse.created_at).getTime();
          responseTimeSeconds = Math.floor((responseTime - clientMsgTime) / 1000);
        }

        return {
          id: chat.id,
          client_name: chat.client_name,
          phone_number: chat.phone_number,
          status: chat.status,
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          first_message_at: firstClientMsg?.created_at || null,
          first_response_at: firstResponse?.created_at || null,
          responded_by: firstResponse?.sender_id || null,
          responded_by_name: respondedByName,
          response_time_seconds: responseTimeSeconds,
          click_count: clickCount,
          utm_source: firstClick?.utm_source || null,
          utm_medium: firstClick?.utm_medium || null,
          utm_campaign: firstClick?.utm_campaign || null,
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

  const getOriginBadge = (conv: Conversation) => {
    const source = (conv.utm_source || '').toLowerCase();
    if (source.includes('facebook') || source.includes('instagram') || source.includes('fb') || source.includes('ig')) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Meta Ads</span>;
    } else if (source.includes('google') || source.includes('gclid')) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Google Ads</span>;
    } else if (conv.utm_source || conv.utm_medium || conv.utm_campaign) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Outras</span>;
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/link/${linkId}`)} 
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Conversas do Link</h1>
            {link && <p className="text-sm text-slate-500">{link.name} • belitx.com.br/r/{link.code}</p>}
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div 
          onClick={() => setOriginFilter('all')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${originFilter === 'all' ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-slate-500">chat</span>
            <span className="text-xs text-slate-500 font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('meta')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${originFilter === 'meta' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xs">M</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Meta Ads</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.metaAds}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('google')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${originFilter === 'google' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center">
              <span className="text-amber-600 font-bold text-xs">G</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Google Ads</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.googleAds}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('outras')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${originFilter === 'outras' ? 'border-green-500 ring-2 ring-green-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-sm">language</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Outras Origens</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.outras}</p>
        </div>
        
        <div 
          onClick={() => setOriginFilter('nao_rastreada')}
          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${originFilter === 'nao_rastreada' ? 'border-orange-500 ring-2 ring-orange-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-600 text-sm">help</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Não Rastreada</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.naoRastreada}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filtro de Data */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { value: 'today', label: 'Hoje' },
              { value: '7d', label: '7 dias' },
              { value: '15d', label: '15 dias' },
              { value: '30d', label: '30 dias' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => { setDateFilter(period.value as 'today' | '7d' | '15d' | '30d'); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
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
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Nome ou telefone"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          
          {/* Limpar Filtros */}
          {(searchTerm || originFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setOriginFilter('all'); setCurrentPage(1); }}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredConversations.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">chat_bubble_outline</span>
            <p className="text-slate-500">Nenhuma conversa encontrada com o filtro selecionado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Contato</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Origem</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Etapa</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Respondido por</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500 text-sm">Tempo Resp.</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500 text-sm">Cliques</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Primeira Msg</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-sm">Última Msg</th>
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
                        {conv.first_message_at ? new Date(conv.first_message_at).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredConversations.length)} de {filteredConversations.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-slate-600">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
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
    </div>
  );
}
