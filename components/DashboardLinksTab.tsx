import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TrackableLink {
  id: string;
  code: string;
  name: string;
  clicks_count: number;
  leads_count: number;
  is_active: boolean;
  created_at: string;
  source_id: string | null;
  lead_sources?: { name: string; code: string } | null;
}

interface LinkClick {
  id: string;
  clicked_at: string;
  ip_address: string;
  browser: string;
  os: string;
  device_type: string;
  device_model: string;
  utm_source: string | null;
  utm_medium: string | null;
  fbclid: string | null;
  converted_to_lead: boolean;
}

interface LeadFromLink {
  id: string;
  client_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  source_code: string;
  kanban_columns?: { name: string } | null;
}

interface Props {
  clinicId: string;
}

export default function DashboardLinksTab({ clinicId }: Props) {
  const [links, setLinks] = useState<TrackableLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 15 | 30>(30);
  const [selectedLink, setSelectedLink] = useState<TrackableLink | null>(null);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [linkLeads, setLinkLeads] = useState<LeadFromLink[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'leads' | 'clicks'>('leads');
  const [selectedLead, setSelectedLead] = useState<LeadFromLink | null>(null);

  const baseUrl = 'https://belitx.com.br/r';

  useEffect(() => {
    if (!clinicId) return;
    
    const fetchLinks = async () => {
      setLoading(true);
      
      const { data } = await (supabase as any)
        .from('trackable_links')
        .select('*, lead_sources(name, code)')
        .eq('clinic_id', clinicId)
        .order('leads_count', { ascending: false });
      
      if (data) setLinks(data);
      setLoading(false);
    };
    
    fetchLinks();
  }, [clinicId]);

  const openLinkDetails = async (link: TrackableLink) => {
    setSelectedLink(link);
    setLoadingDetails(true);
    setDetailsTab('leads');
    
    // Buscar cliques do link
    const { data: clicks } = await (supabase as any)
      .from('link_clicks')
      .select('*')
      .eq('link_id', link.id)
      .order('clicked_at', { ascending: false })
      .limit(50);
    
    if (clicks) setLinkClicks(clicks);
    
    // Buscar leads que vieram desse link (pelo source_code)
    const { data: leads } = await (supabase as any)
      .from('chats')
      .select('id, client_name, phone_number, status, created_at, source_code, kanban_columns(name)')
      .eq('clinic_id', clinicId)
      .ilike('source_code', link.code)
      .order('created_at', { ascending: false });
    
    if (leads) setLinkLeads(leads);
    
    setLoadingDetails(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Calcular totais
  const totalClicks = links.reduce((sum, l) => sum + l.clicks_count, 0);
  const totalLeads = links.reduce((sum, l) => sum + l.leads_count, 0);
  const avgConversion = totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(1) : '0';
  const activeLinks = links.filter(l => l.is_active).length;

  // Top 5 links por leads
  const topLinks = [...links].sort((a, b) => b.leads_count - a.leads_count).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-2xl text-white">
          <p className="text-indigo-100 text-xs font-medium uppercase">Links Ativos</p>
          <p className="text-3xl font-black mt-1">{activeLinks}</p>
          <p className="text-indigo-100 text-xs mt-1">de {links.length} criados</p>
        </div>
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-5 rounded-2xl text-white">
          <p className="text-cyan-100 text-xs font-medium uppercase">Total de Cliques</p>
          <p className="text-3xl font-black mt-1">{totalClicks.toLocaleString()}</p>
          <p className="text-cyan-100 text-xs mt-1">Em todos os links</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl text-white">
          <p className="text-green-100 text-xs font-medium uppercase">Leads Gerados</p>
          <p className="text-3xl font-black mt-1">{totalLeads}</p>
          <p className="text-green-100 text-xs mt-1">Via links rastreáveis</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-5 rounded-2xl text-white">
          <p className="text-amber-100 text-xs font-medium uppercase">Taxa de Conversão</p>
          <p className="text-3xl font-black mt-1">{avgConversion}%</p>
          <p className="text-amber-100 text-xs mt-1">Cliques → Leads</p>
        </div>
      </div>

      {/* Top Links */}
      {topLinks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">leaderboard</span>
              <h3 className="font-bold text-slate-900">Top Links por Leads</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">#</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Link</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Origem</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Cliques</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Leads</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Conversão</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topLinks.map((link, idx) => {
                  const conversion = link.clicks_count > 0 
                    ? ((link.leads_count / link.clicks_count) * 100).toFixed(1) 
                    : '0';
                  return (
                    <tr key={link.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openLinkDetails(link)}>
                      <td className="py-3 px-4">
                        {idx === 0 && <span className="material-symbols-outlined text-amber-500">emoji_events</span>}
                        {idx === 1 && <span className="text-slate-400 font-bold">2º</span>}
                        {idx === 2 && <span className="text-slate-400 font-bold">3º</span>}
                        {idx > 2 && <span className="text-slate-400">{idx + 1}º</span>}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{link.name}</p>
                        <p className="text-xs text-slate-400">{baseUrl}/{link.code}</p>
                      </td>
                      <td className="py-3 px-4">
                        {link.lead_sources ? (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                            {(link.lead_sources as any).name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-cyan-600">{link.clicks_count}</td>
                      <td className="py-3 px-4 text-center font-bold text-green-600">{link.leads_count}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${Number(conversion) >= 30 ? 'text-green-600' : Number(conversion) >= 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {conversion}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {link.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Todos os links */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">link</span>
            <h3 className="font-bold text-slate-900">Todos os Links</h3>
            <span className="text-xs text-slate-400">({links.length})</span>
          </div>
          <a 
            href="/integrations" 
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Criar novo
          </a>
        </div>
        
        {links.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">link_off</span>
            <p className="text-slate-500 mb-3">Nenhum link rastreável criado</p>
            <a 
              href="/integrations" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Criar primeiro link
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Nome</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Origem</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Cliques</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Leads</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Conversão</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {links.map((link) => {
                  const conversion = link.clicks_count > 0 
                    ? ((link.leads_count / link.clicks_count) * 100).toFixed(1) 
                    : '0';
                  return (
                    <tr key={link.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openLinkDetails(link)}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{link.name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">{link.code}</span>
                      </td>
                      <td className="py-3 px-4">
                        {link.lead_sources ? (
                          <span className="text-xs text-slate-600">{(link.lead_sources as any).name}</span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">{link.clicks_count}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{link.leads_count}</td>
                      <td className="py-3 px-4 text-center text-slate-500">{conversion}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${link.is_active ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dica */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-indigo-600">lightbulb</span>
        <div>
          <p className="text-sm font-medium text-indigo-900">Dica: Links Rastreáveis</p>
          <p className="text-xs text-indigo-700 mt-1">
            Use links diferentes para cada canal (Instagram Bio, Google Ads, Site) para saber exatamente de onde vêm seus leads.
            Crie novos links em <a href="/integrations" className="underline">Integrações → Links</a>.
          </p>
        </div>
      </div>

      {/* Modal de Detalhes do Link */}
      {selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLink(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 flex-shrink-0">
              <button 
                onClick={() => setSelectedLink(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl">link</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedLink.name}</h3>
                  <p className="text-indigo-100 text-sm">{baseUrl}/{selectedLink.code}</p>
                </div>
              </div>
              {/* Stats do link */}
              <div className="flex gap-6 mt-4">
                <div>
                  <p className="text-2xl font-black text-white">{selectedLink.clicks_count}</p>
                  <p className="text-indigo-200 text-xs">Cliques</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">{selectedLink.leads_count}</p>
                  <p className="text-indigo-200 text-xs">Leads</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">
                    {selectedLink.clicks_count > 0 ? ((selectedLink.leads_count / selectedLink.clicks_count) * 100).toFixed(1) : '0'}%
                  </p>
                  <p className="text-indigo-200 text-xs">Conversão</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 flex-shrink-0">
              <button
                onClick={() => setDetailsTab('leads')}
                className={`flex-1 py-3 text-sm font-medium ${detailsTab === 'leads' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">person</span>
                  Leads ({linkLeads.length})
                </span>
              </button>
              <button
                onClick={() => setDetailsTab('clicks')}
                className={`flex-1 py-3 text-sm font-medium ${detailsTab === 'clicks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">ads_click</span>
                  Cliques ({linkClicks.length})
                </span>
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : detailsTab === 'leads' ? (
                linkLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-4xl text-slate-300">person_off</span>
                    <p className="text-slate-500 mt-2">Nenhum lead gerado por este link ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkLeads.map((lead) => (
                      <div 
                        key={lead.id} 
                        className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-indigo-600">person</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{lead.client_name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-500">{lead.phone_number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded text-xs ${
                              lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                              lead.status === 'active' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {lead.kanban_columns?.name || lead.status}
                            </span>
                            <p className="text-xs text-slate-400 mt-1">{formatDate(lead.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                linkClicks.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-4xl text-slate-300">ads_click</span>
                    <p className="text-slate-500 mt-2">Nenhum clique registrado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkClicks.map((click) => (
                      <div key={click.id} className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              click.device_type === 'mobile' ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              <span className={`material-symbols-outlined ${
                                click.device_type === 'mobile' ? 'text-green-600' : 'text-blue-600'
                              }`}>
                                {click.device_type === 'mobile' ? 'smartphone' : 'computer'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{click.browser} - {click.os}</p>
                              <p className="text-xs text-slate-500">{click.device_model || click.device_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {click.converted_to_lead && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Converteu</span>
                            )}
                            <p className="text-xs text-slate-400 mt-1">{formatDate(click.clicked_at)}</p>
                          </div>
                        </div>
                        {(click.utm_source || click.fbclid) && (
                          <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                            {click.utm_source && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">
                                {click.utm_source}
                              </span>
                            )}
                            {click.utm_medium && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                                {click.utm_medium}
                              </span>
                            )}
                            {click.fbclid && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                                Facebook Ads
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-green-600 to-emerald-600">
              <button 
                onClick={() => setSelectedLead(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-3xl">person</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedLead.client_name || 'Sem nome'}</h3>
                  <p className="text-green-100">{selectedLead.phone_number}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-xs text-slate-500">Etapa Atual</p>
                  <p className="font-bold text-slate-900">{selectedLead.kanban_columns?.name || selectedLead.status}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-xs text-slate-500">Código</p>
                  <p className="font-bold text-indigo-600">[{selectedLead.source_code}]</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                  <p className="text-xs text-slate-500">Data de Entrada</p>
                  <p className="font-bold text-slate-900">{formatDate(selectedLead.created_at)}</p>
                </div>
              </div>
              <a 
                href={`/leads/${selectedLead.id}`}
                className="block w-full text-center px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Ver Detalhes Completos
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
