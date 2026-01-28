import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MousePointerClick, 
  Eye, 
  DollarSign,
  Target,
  RefreshCw,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  objective?: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

const DEFAULT_VISIBLE_COLUMNS = ['campaign_name', 'objective', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach'];

const COLUMN_CONFIG: Record<string, { label: string; align: 'left' | 'right'; format?: 'currency' | 'number' | 'percent'; actionType?: string }> = {
  // Identificação
  campaign_name: { label: 'Campanha', align: 'left' },
  objective: { label: 'Objetivo', align: 'left' },
  
  // Custos
  spend: { label: 'Gasto', align: 'right', format: 'currency' },
  cpc: { label: 'CPC', align: 'right', format: 'currency' },
  cpm: { label: 'CPM', align: 'right', format: 'currency' },
  cpp: { label: 'CPP', align: 'right', format: 'currency' },
  cost_per_unique_click: { label: 'Custo/Clique Único', align: 'right', format: 'currency' },
  
  // Alcance
  impressions: { label: 'Impressões', align: 'right', format: 'number' },
  reach: { label: 'Alcance', align: 'right', format: 'number' },
  frequency: { label: 'Frequência', align: 'right', format: 'number' },
  
  // Cliques
  clicks: { label: 'Cliques', align: 'right', format: 'number' },
  unique_clicks: { label: 'Cliques Únicos', align: 'right', format: 'number' },
  ctr: { label: 'CTR', align: 'right', format: 'percent' },
  unique_ctr: { label: 'CTR Único', align: 'right', format: 'percent' },
  
  // Conversões (baseadas em actions)
  conversations: { label: 'Conversas', align: 'right', format: 'number', actionType: 'messaging_conversation_started_7d' },
  link_clicks: { label: 'Cliques Link', align: 'right', format: 'number', actionType: 'link_click' },
  landing_page_views: { label: 'Views Página', align: 'right', format: 'number', actionType: 'landing_page_view' },
  leads: { label: 'Leads', align: 'right', format: 'number', actionType: 'lead' },
  purchases: { label: 'Compras', align: 'right', format: 'number', actionType: 'purchase' },
  post_engagement: { label: 'Engaj. Post', align: 'right', format: 'number', actionType: 'post_engagement' },
  page_engagement: { label: 'Engaj. Página', align: 'right', format: 'number', actionType: 'page_engagement' },
  actions_total: { label: 'Ações Total', align: 'right', format: 'number' },
  
  // Vídeo
  video_p25: { label: 'Vídeo 25%', align: 'right', format: 'number' },
  video_p50: { label: 'Vídeo 50%', align: 'right', format: 'number' },
  video_p75: { label: 'Vídeo 75%', align: 'right', format: 'number' },
  video_p100: { label: 'Vídeo 100%', align: 'right', format: 'number' },
};

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState('last_30d');
  const [refreshing, setRefreshing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  const datePresets = [
    { value: 'today', label: 'Hoje' },
    { value: 'yesterday', label: 'Ontem' },
    { value: 'last_7d', label: 'Últimos 7 dias' },
    { value: 'last_14d', label: 'Últimos 14 dias' },
    { value: 'last_30d', label: 'Últimos 30 dias' },
    { value: 'this_month', label: 'Este mês' },
    { value: 'last_month', label: 'Mês passado' },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [datePreset]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('facebook_ads_visible_columns')
        .single();
      
      if (data && (data as any).facebook_ads_visible_columns) {
        setVisibleColumns((data as any).facebook_ads_visible_columns);
      }
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
    }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-ads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`,
          },
          body: JSON.stringify({ 
            action: 'get_campaigns',
            date_preset: datePreset
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erro ao buscar campanhas');
      }

      setCampaigns(result.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err);
      setError(err.message || 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCampaigns();
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2)}%`;
  };

  // Calcular totais
  const totals = campaigns.reduce((acc, c) => ({
    spend: acc.spend + parseFloat(c.spend || '0'),
    impressions: acc.impressions + parseInt(c.impressions || '0'),
    clicks: acc.clicks + parseInt(c.clicks || '0'),
    reach: acc.reach + parseInt(c.reach || '0'),
  }), { spend: 0, impressions: 0, clicks: 0, reach: 0 });

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Campanhas</h1>
          <p className="text-sm text-slate-500 mt-1">Dados do Facebook Ads</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            {datePresets.map(preset => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <p className="text-xs text-red-500 mt-1">Verifique as configurações em Admin → Integrações</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Gasto Total</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(totals.spend)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-xs font-medium">Impressões</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatNumber(totals.impressions)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-xs font-medium">Cliques</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatNumber(totals.clicks)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Alcance</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatNumber(totals.reach)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">CTR Médio</span>
            </div>
            <p className="text-lg font-bold text-green-600">{formatPercent(avgCtr)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-medium">CPC Médio</span>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(avgCpc)}</p>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Campanhas Ativas</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Carregando campanhas...</p>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhuma campanha encontrada</p>
              <p className="text-sm text-slate-400 mt-1">Verifique o período selecionado ou as configurações</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {visibleColumns.map(col => {
                    const config = COLUMN_CONFIG[col];
                    if (!config) return null;
                    return (
                      <th 
                        key={col}
                        className={`text-${config.align} px-4 py-3 text-xs font-semibold text-slate-500 uppercase`}
                      >
                        {config.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((campaign) => (
                  <tr key={campaign.campaign_id} className="hover:bg-slate-50 transition-colors">
                    {visibleColumns.map(col => {
                      const config = COLUMN_CONFIG[col];
                      if (!config) return null;
                      
                      // Renderização especial para campaign_name
                      if (col === 'campaign_name') {
                        return (
                          <td key={col} className="px-4 py-3">
                            <p className="font-medium text-slate-800 text-sm">{campaign.campaign_name}</p>
                            <p className="text-xs text-slate-400">ID: {campaign.campaign_id}</p>
                          </td>
                        );
                      }
                      
                      // Renderização especial para objective
                      if (col === 'objective') {
                        return (
                          <td key={col} className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                              {campaign.objective || '-'}
                            </span>
                          </td>
                        );
                      }
                      
                      // Renderização para colunas baseadas em actions (conversões)
                      if (config.actionType) {
                        const actionValue = campaign.actions?.find(a => 
                          a.action_type === config.actionType ||
                          a.action_type === `onsite_conversion.${config.actionType}`
                        )?.value || '0';
                        return (
                          <td key={col} className="px-4 py-3 text-right text-sm text-purple-600 font-medium">
                            {formatNumber(actionValue)}
                          </td>
                        );
                      }
                      
                      // Renderização especial para actions_total
                      if (col === 'actions_total') {
                        const actionsCount = campaign.actions?.reduce((sum, a) => sum + parseInt(a.value || '0'), 0) || 0;
                        return (
                          <td key={col} className="px-4 py-3 text-right text-sm text-slate-600">
                            {formatNumber(actionsCount)}
                          </td>
                        );
                      }
                      
                      // Renderização para métricas de vídeo
                      if (col.startsWith('video_p')) {
                        const videoKey = col.replace('video_p', 'video_p') + '_watched_actions';
                        const videoData = (campaign as any)[videoKey];
                        const videoValue = Array.isArray(videoData) ? videoData[0]?.value || '0' : '0';
                        return (
                          <td key={col} className="px-4 py-3 text-right text-sm text-slate-600">
                            {formatNumber(videoValue)}
                          </td>
                        );
                      }
                      
                      // Renderização padrão baseada no formato
                      const value = (campaign as any)[col];
                      let formattedValue = '-';
                      let textClass = 'text-slate-600';
                      
                      if (value !== undefined && value !== null) {
                        if (config.format === 'currency') {
                          formattedValue = formatCurrency(value);
                          if (col === 'spend') textClass = 'font-medium text-slate-800';
                        } else if (config.format === 'number') {
                          formattedValue = formatNumber(value);
                        } else if (config.format === 'percent') {
                          formattedValue = formatPercent(value);
                          textClass = 'font-medium text-green-600';
                        }
                      }
                      
                      return (
                        <td key={col} className={`px-4 py-3 text-${config.align} text-sm ${textClass}`}>
                          {formattedValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;
