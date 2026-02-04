import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrackableLink {
  id: string;
  code: string;
  name: string;
  phone_number: string;
  message_template: string | null;
  source_id: string | null;
  clicks_count: number;
  leads_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  lead_sources?: { name: string; color: string } | null;
}

interface LinkClick {
  id: string;
  clicked_at: string;
  browser: string;
  os: string;
  device_type: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  site_source: string | null;
  placement: string | null;
}

interface DashboardData {
  totalConversas: number;
  rastreadas: number;
  naoRastreadas: number;
  metaAds: number;
  googleAds: number;
  outras: number;
  porDia: Array<{ date: string; metaAds: number; googleAds: number; outras: number; naoRastreada: number }>;
}

export default function LinkSettings() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clinic, user, isImpersonating, impersonatedClinic } = useAuth();
  // Usar clinicId do impersonate se estiver ativo
  const clinicId = isImpersonating ? impersonatedClinic?.id : (clinic?.id || user?.clinicId);
  const [link, setLink] = useState<TrackableLink | null>(null);
  const [clicks, setClicks] = useState<LinkClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Verificar se veio da aba dashboard
  const initialTab = searchParams.get('tab') === 'dashboard' ? 'dashboard' : 'links';
  const [activeTab, setActiveTab] = useState<'links' | 'tutorial' | 'clicks' | 'dashboard'>(initialTab);
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalConversas: 0,
    rastreadas: 0,
    naoRastreadas: 0,
    metaAds: 0,
    googleAds: 0,
    outras: 0,
    porDia: []
  });
  const [dashboardPeriod, setDashboardPeriod] = useState<'today' | '7d' | '15d' | '30d'>('7d');

  const baseUrl = 'https://belitx.com.br/w';

  useEffect(() => {
    if (linkId && clinicId) {
      fetchLink();
      fetchClicks();
    }
  }, [linkId, clinicId]);

  const fetchLink = async () => {
    const { data, error } = await supabase
      .from('trackable_links')
      .select('*, lead_sources(name, color)')
      .eq('id', linkId)
      .eq('clinic_id', clinicId)
      .single();

    if (!error && data) {
      setLink(data as TrackableLink);
    }
    setLoading(false);
  };

  const fetchClicks = async () => {
    const { data } = await supabase
      .from('link_clicks')
      .select('id, clicked_at, browser, os, device_type, utm_source, utm_medium, utm_campaign, referrer, site_source, placement')
      .eq('link_id', linkId)
      .order('clicked_at', { ascending: false })
      .limit(50);

    if (data) {
      setClicks(data as LinkClick[]);
      // Calcular dados do dashboard baseado nos cliques
      calculateDashboardData(data as LinkClick[]);
    }
  };

  const calculateDashboardData = (clicksData: LinkClick[]) => {
    // Filtrar por período
    const now = new Date();
    const days = dashboardPeriod === 'today' ? 1 : dashboardPeriod === '7d' ? 7 : dashboardPeriod === '15d' ? 15 : 30;
    const startDate = dashboardPeriod === 'today' 
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
      : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filteredClicks = clicksData.filter(c => new Date(c.clicked_at) >= startDate);
    
    let metaAds = 0;
    let googleAds = 0;
    let outras = 0;
    let naoRastreada = 0;
    
    // Agrupar por dia
    const porDiaMap: Record<string, { metaAds: number; googleAds: number; outras: number; naoRastreada: number }> = {};
    
    // Inicializar todos os dias do período
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      porDiaMap[dateStr] = { metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 };
    }
    
    filteredClicks.forEach(click => {
      const dateStr = new Date(click.clicked_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const source = (click.utm_source || '').toLowerCase();
      
      if (!porDiaMap[dateStr]) {
        porDiaMap[dateStr] = { metaAds: 0, googleAds: 0, outras: 0, naoRastreada: 0 };
      }
      
      // Classificar origem
      if (source.includes('facebook') || source.includes('instagram') || source.includes('fb') || source.includes('ig')) {
        metaAds++;
        porDiaMap[dateStr].metaAds++;
      } else if (source.includes('google') || source.includes('gclid')) {
        googleAds++;
        porDiaMap[dateStr].googleAds++;
      } else if (click.utm_source || click.utm_medium || click.utm_campaign) {
        outras++;
        porDiaMap[dateStr].outras++;
      } else {
        naoRastreada++;
        porDiaMap[dateStr].naoRastreada++;
      }
    });
    
    const rastreadas = metaAds + googleAds + outras;
    const totalConversas = rastreadas + naoRastreada;
    
    // Converter mapa para array ordenado por data
    const porDia = Object.entries(porDiaMap)
      .map(([date, data]) => ({ date, ...data }))
      .reverse();
    
    setDashboardData({
      totalConversas,
      rastreadas,
      naoRastreadas: naoRastreada,
      metaAds,
      googleAds,
      outras,
      porDia
    });
  };

  // Recalcular dashboard quando período mudar
  useEffect(() => {
    if (clicks.length > 0) {
      calculateDashboardData(clicks);
    }
  }, [dashboardPeriod]);

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">link_off</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link não encontrado</h2>
          <button onClick={() => navigate('/dashboard')} className="text-indigo-600 hover:underline">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const metaAdsParams = `utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{adset.name}}_{{ad.name}}&belitx_fbid={{ad.id}}_{{site_source_name}}_{{placement}}`;

  return (
    <div className="p-3 sm:p-6">
      {/* Header com botões de ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <button 
          onClick={() => navigate('/links')} 
          className="text-slate-500 hover:text-slate-700 transition-colors text-sm"
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate(`/link/${linkId}/conversations`)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-cyan-500 text-cyan-600 rounded-lg hover:bg-cyan-50 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">chat</span>
            <span className="hidden sm:inline">Ver Conversas</span>
            <span className="sm:hidden">Conversas</span>
          </button>
          <button 
            onClick={() => navigate('/links')}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">edit</span>
            Editar
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex gap-1 mb-4 sm:mb-6 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-white border border-b-white border-slate-200 -mb-px text-orange-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">bar_chart</span>
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            activeTab === 'links'
              ? 'bg-white border border-b-white border-slate-200 -mb-px text-indigo-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link</span>
          Links
        </button>
        <button
          onClick={() => setActiveTab('clicks')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            activeTab === 'clicks'
              ? 'bg-white border border-b-white border-slate-200 -mb-px text-cyan-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">touch_app</span>
          Cliques ({clicks.length})
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Filtro de Período */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 rounded-lg p-1 overflow-x-auto">
              {[
                { value: 'today', label: 'Hoje' },
                { value: '7d', label: '7d' },
                { value: '15d', label: '15d' },
                { value: '30d', label: '30d' },
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => setDashboardPeriod(period.value as 'today' | '7d' | '15d' | '30d')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                    dashboardPeriod === period.value
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Visão Geral das Conversas */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Visão Geral</h3>
              
              <div className="flex items-center gap-2 mb-2 sm:mb-4">
                <span className="material-symbols-outlined text-slate-400 text-lg sm:text-xl">chat</span>
                <span className="text-xs sm:text-sm text-slate-500">Total Conversas</span>
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 mb-4 sm:mb-6">{dashboardData.totalConversas}</p>
              
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-cyan-600 text-xs sm:text-sm">check_circle</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-slate-500">Rastreadas</p>
                    <p className="text-base sm:text-xl font-bold text-slate-900">
                      {dashboardData.rastreadas}{' '}
                      <span className="text-[10px] sm:text-sm font-normal text-slate-400">
                        ({dashboardData.totalConversas > 0 ? ((dashboardData.rastreadas / dashboardData.totalConversas) * 100).toFixed(0) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-600 text-xs sm:text-sm">help</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-slate-500">Não rastreadas</p>
                    <p className="text-base sm:text-xl font-bold text-slate-900">
                      {dashboardData.naoRastreadas}{' '}
                      <span className="text-[10px] sm:text-sm font-normal text-slate-400">
                        ({dashboardData.totalConversas > 0 ? ((dashboardData.naoRastreadas / dashboardData.totalConversas) * 100).toFixed(0) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Gráfico Donut */}
              <div className="flex justify-center">
                <ResponsiveContainer width={150} height={150} className="sm:!w-[200px] sm:!h-[200px]">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Rastreadas', value: dashboardData.rastreadas, color: '#06B6D4' },
                        { name: 'Não rastreadas', value: dashboardData.naoRastreadas, color: '#F97316' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                    >
                      <Cell fill="#06B6D4" />
                      <Cell fill="#F97316" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center -mt-[72px] sm:-mt-24 mb-6 sm:mb-8">
                <p className="text-xl sm:text-3xl font-bold text-slate-900">{dashboardData.totalConversas}</p>
              </div>
              <div className="flex justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-500 rounded-full"></div>
                  <span className="text-slate-600">Rastreadas</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-slate-600">Não rastreadas</span>
                </div>
              </div>
            </div>

            {/* Origem das Conversas */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Origem</h3>
              
              {/* Cards de Origem */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="text-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <span className="text-blue-600 font-bold text-sm sm:text-lg">M</span>
                  </div>
                  <p className="text-[9px] sm:text-xs text-slate-500">Meta</p>
                  <p className="text-base sm:text-xl font-bold text-slate-900">{dashboardData.metaAds}</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <span className="text-amber-600 font-bold text-sm sm:text-lg">G</span>
                  </div>
                  <p className="text-[9px] sm:text-xs text-slate-500">Google</p>
                  <p className="text-base sm:text-xl font-bold text-slate-900">{dashboardData.googleAds}</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <span className="material-symbols-outlined text-green-600 text-sm sm:text-base">language</span>
                  </div>
                  <p className="text-[9px] sm:text-xs text-slate-500">Outras</p>
                  <p className="text-base sm:text-xl font-bold text-slate-900">{dashboardData.outras}</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-1 sm:mb-2">
                    <span className="material-symbols-outlined text-orange-600 text-sm sm:text-base">help</span>
                  </div>
                  <p className="text-[9px] sm:text-xs text-slate-500">N/R</p>
                  <p className="text-base sm:text-xl font-bold text-slate-900">{dashboardData.naoRastreadas}</p>
                </div>
              </div>
              
              {/* Gráfico de Barras */}
              <ResponsiveContainer width="100%" height={180} className="sm:!h-[250px]">
                <BarChart data={dashboardData.porDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 9 }} stroke="#94A3B8" width={25} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '10px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '9px' }} />
                  <Bar dataKey="metaAds" name="Meta" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="googleAds" name="Google" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="outras" name="Outras" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="naoRastreada" name="N/R" stackId="a" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Links Tab */}
      {activeTab === 'links' && (
      <>
      {/* Link Principal - Gradiente Indigo/Purple */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl sm:text-2xl">link</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold">Link Principal</h2>
              <p className="text-indigo-200 text-xs sm:text-sm">Use em qualquer lugar</p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(`${baseUrl}/${link.code}`, 'principal')}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-sm ${
              copiedCode === 'principal' 
                ? 'bg-green-500 text-white' 
                : 'bg-white text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {copiedCode === 'principal' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="mt-3 sm:mt-4 bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
          <code className="text-xs sm:text-sm font-mono break-all">{baseUrl}/{link.code}</code>
        </div>
      </div>

      {/* Grid de Cards por Plataforma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Instagram Bio */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">📸</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">Instagram Bio</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}?utm_source=instagram&utm_medium=bio`, 'instagram')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'instagram' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'instagram' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all">
            {baseUrl}/{link.code}?utm_source=instagram&utm_medium=bio
          </code>
        </div>

        {/* Google Ads */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">🔍</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">Google Ads</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}?utm_source=google&utm_medium=cpc`, 'google')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'google' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'google' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all">
            {baseUrl}/{link.code}?utm_source=google&utm_medium=cpc
          </code>
        </div>

        {/* Meta Ads */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">📣</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">Meta Ads</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}`, 'meta')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'meta' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'meta' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all mb-2 sm:mb-3">
            {baseUrl}/{link.code}
          </code>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-3">
            <p className="text-[9px] sm:text-xs text-purple-800 font-medium mb-1.5 sm:mb-2">Parâmetros URL (Meta Ads):</p>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <code className="text-[8px] sm:text-[10px] text-purple-700 bg-purple-100 p-1.5 sm:p-2 rounded flex-1 break-all">
                {metaAdsParams}
              </code>
              <button
                onClick={() => copyToClipboard(metaAdsParams, 'metaParams')}
                className={`p-1 sm:p-1.5 rounded transition-all flex-shrink-0 ${
                  copiedCode === 'metaParams' ? 'bg-green-100 text-green-600' : 'hover:bg-purple-100 text-purple-600'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{copiedCode === 'metaParams' ? 'check' : 'content_copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Botão no Site */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">🌐</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">Botão no Site</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}?utm_source=website&utm_medium=button`, 'site')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'site' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'site' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all">
            {baseUrl}/{link.code}?utm_source=website&utm_medium=button
          </code>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">📱</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">QR Code</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}?utm_source=offline&utm_medium=qrcode`, 'qr')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'qr' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'qr' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all">
            {baseUrl}/{link.code}?utm_source=offline&utm_medium=qrcode
          </code>
        </div>

        {/* Email Marketing */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-violet-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">📧</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-base">Email Marketing</h4>
                <p className="text-[9px] sm:text-xs text-slate-500 hidden sm:block">Com redirecionamento (5 seg)</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/${link.code}?utm_source=email&utm_medium=newsletter`, 'email')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                copiedCode === 'email' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">{copiedCode === 'email' ? 'check' : 'content_copy'}</span>
            </button>
          </div>
          <code className="text-[9px] sm:text-xs text-slate-600 bg-slate-50 p-2 sm:p-3 rounded-lg block break-all">
            {baseUrl}/{link.code}?utm_source=email&utm_medium=newsletter
          </code>
        </div>
      </div>

      {/* Pixel de Rastreamento - Gradiente Azul */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl sm:text-2xl">code</span>
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-bold">Pixel de Rastreamento</h3>
              <p className="text-blue-100 text-[10px] sm:text-sm">Cole antes do &lt;/head&gt;</p>
            </div>
          </div>
          <button
            onClick={() => {
              const pixelCode = `<!-- Belitx Pixel - Rastreamento de Conversões -->
<script>
(function(window, document, script) {
  if (!window.belitx) {
    window.belitx = window.belitx || {};
    var c = document.getElementsByTagName('head')[0];
    var k = document.createElement('script');
    k.async = 1;
    k.src = script;
    c.appendChild(k);
  }
  window.belitx.clinicId = '${clinicId}';
})(window, document, 'https://belitx.com.br/pixel/belitx-1.0.js');
</script>`;
              copyToClipboard(pixelCode, 'pixel');
            }}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              copiedCode === 'pixel' 
                ? 'bg-white text-blue-600' 
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            {copiedCode === 'pixel' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <pre className="bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-4 text-[8px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap text-blue-100 max-h-32 sm:max-h-none">
{`<script>
(function(window, document, script) {
  if (!window.belitx) {
    window.belitx = window.belitx || {};
    var c = document.getElementsByTagName('head')[0];
    var k = document.createElement('script');
    k.async = 1;
    k.src = script;
    c.appendChild(k);
  }
  window.belitx.clinicId = '${clinicId}';
})(window, document, 'https://belitx.com.br/pixel/belitx-1.0.js');
</script>`}
        </pre>
        <p className="text-blue-200 text-[9px] sm:text-xs mt-2 sm:mt-3 hidden sm:block">
          O pixel captura: dispositivo, navegador, UTMs, fbclid/gclid, referrer e cliques em links Belitx.
        </p>
      </div>

      {/* Botão Flutuante WhatsApp - Gradiente Verde */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl sm:text-2xl">widgets</span>
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-bold">Botão Flutuante</h3>
              <p className="text-green-100 text-[10px] sm:text-sm">Cole antes do &lt;/body&gt;</p>
            </div>
          </div>
          <button
            onClick={() => {
              const floatCode = `<!-- Botão WhatsApp Flutuante - ${link.name} -->
<a href="${baseUrl}/${link.code}?utm_source=website&utm_medium=float" target="_blank" rel="noopener" style="position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</a>`;
              copyToClipboard(floatCode, 'float');
            }}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              copiedCode === 'float' 
                ? 'bg-white text-green-600' 
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            {copiedCode === 'float' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <pre className="bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-4 text-[8px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap text-green-100">
{`<a href="${baseUrl}/${link.code}?utm_source=website&utm_medium=float" 
   target="_blank" 
   style="position:fixed;bottom:20px;right:20px;...">
  <svg>WhatsApp Icon</svg>
</a>`}
        </pre>
      </div>

      {/* Botão Voltar */}
      <div className="text-center">
        <button 
          onClick={() => navigate('/links')}
          className="text-slate-500 hover:text-slate-700 text-sm"
        >
          Voltar
        </button>
      </div>
      </>
      )}

      {/* Clicks Tab */}
      {activeTab === 'clicks' && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200">
          <div className="p-3 sm:p-6 border-b border-slate-200">
            <h3 className="text-sm sm:text-lg font-bold text-slate-800">Histórico de Cliques</h3>
            <p className="text-xs sm:text-sm text-slate-500">Últimos 50 cliques</p>
          </div>
          {clicks.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 mb-2">touch_app</span>
              <p className="text-slate-500 text-xs sm:text-sm">Nenhum clique registrado</p>
            </div>
          ) : (
            <>
              {/* Versão Mobile - Cards */}
              <div className="sm:hidden p-2 space-y-2">
                {clicks.map((click) => (
                  <div key={click.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(click.clicked_at).toLocaleString('pt-BR')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        click.device_type === 'mobile' ? 'bg-blue-100 text-blue-700' :
                        click.device_type === 'tablet' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {click.device_type || 'desktop'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">{click.browser || '-'}</span>
                      {click.utm_source ? (
                        <span className="text-xs text-indigo-600 font-medium">{click.utm_source}</span>
                      ) : (
                        <span className="text-xs text-slate-400">Direto</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Versão Desktop - Tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Data/Hora</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Dispositivo</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Navegador</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Origem (UTM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clicks.map((click) => (
                      <tr key={click.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {new Date(click.clicked_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            click.device_type === 'mobile' ? 'bg-blue-100 text-blue-700' :
                            click.device_type === 'tablet' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {click.device_type || 'desktop'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{click.browser || '-'}</td>
                        <td className="py-3 px-4 text-sm">
                          {click.utm_source ? (
                            <span className="text-indigo-600">{click.utm_source}</span>
                          ) : (
                            <span className="text-slate-400">Direto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
