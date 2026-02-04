import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import EmojiPicker from '../components/EmojiPicker';

interface TrackableLink {
  id: string;
  code: string;
  name: string;
  phone_number: string;
  message_template: string | null;
  clicks_count: number;
  leads_count: number;
  is_active: boolean;
  created_at: string;
  source_id: string | null;
  lead_sources?: { name: string; code: string; id: string } | null;
}

interface LeadSource {
  id: string;
  name: string;
  code: string;
  color: string;
}

export default function Links() {
  const navigate = useNavigate();
  const { clinic, user, isImpersonating, impersonatedClinic, isAdmin } = useAuth();
  // Usar clinicId do impersonate se estiver ativo, senão usar do usuário/clínica
  const clinicId = isImpersonating ? impersonatedClinic?.id : (clinic?.id || user?.clinicId);
  
  const [links, setLinks] = useState<TrackableLink[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState<TrackableLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [clinicPhone, setClinicPhone] = useState('');
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone_number: '',
    message_template: 'Oii 👋 Vi seu anúncio e gostaria de mais informações! 😊',
    source_id: '',
    is_active: true
  });
  
  const [stats, setStats] = useState({
    totalLinks: 0,
    activeLinks: 0,
    totalClicks: 0,
    totalLeads: 0,
    conversionRate: 0
  });
  
  const baseUrl = 'https://belitx.com.br/w';

  useEffect(() => {
    if (!clinicId) return;
    fetchLinks();
    fetchSources();
    fetchClinicPhone();
  }, [clinicId]);

  const fetchLinks = async () => {
    setLoading(true);
    
    const { data } = await (supabase as any)
      .from('trackable_links')
      .select('*, lead_sources(name, code, id)')
      .eq('clinic_id', clinicId)
      .order('leads_count', { ascending: false });
    
    if (data) {
      setLinks(data);
      
      const totalLinks = data.length;
      const activeLinks = data.filter((l: TrackableLink) => l.is_active).length;
      const totalClicks = data.reduce((acc: number, l: TrackableLink) => acc + (l.clicks_count || 0), 0);
      const totalLeads = data.reduce((acc: number, l: TrackableLink) => acc + (l.leads_count || 0), 0);
      const conversionRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;
      
      setStats({ totalLinks, activeLinks, totalClicks, totalLeads, conversionRate });
    }
    setLoading(false);
  };

  const fetchSources = async () => {
    const { data } = await (supabase as any)
      .from('lead_sources')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name');
    if (data) setSources(data);
  };

  const fetchClinicPhone = async () => {
    const { data } = await (supabase as any)
      .from('clinics')
      .select('phone')
      .eq('id', clinicId)
      .single();
    if (data?.phone) setClinicPhone(data.phone);
  };

  const generateCode = () => {
    // Apenas letras maiúsculas e números para evitar confusão
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const checkCodeExists = async (code: string): Promise<boolean> => {
    const { data } = await (supabase as any)
      .from('trackable_links')
      .select('id')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    return !!data;
  };

  const openNewModal = () => {
    setEditingLink(null);
    setFormData({
      code: generateCode(),
      name: '',
      phone_number: clinicPhone,
      message_template: 'Oii 👋 Vi seu anúncio e gostaria de mais informações! 😊',
      source_id: '',
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (link: TrackableLink) => {
    setEditingLink(link);
    setFormData({
      code: link.code,
      name: link.name,
      phone_number: link.phone_number,
      message_template: link.message_template || '',
      source_id: link.source_id || '',
      is_active: link.is_active
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone_number) return;
    
    // Converter código para maiúsculas
    const codeUpperCase = formData.code.toUpperCase();
    
    // Verificar se código já existe (apenas para novos links ou se código mudou)
    if (!editingLink || editingLink.code !== codeUpperCase) {
      const exists = await checkCodeExists(codeUpperCase);
      if (exists) {
        alert('Este código já está em uso. Por favor, escolha outro código.');
        return;
      }
    }
    
    setSaving(true);

    const linkData = {
      clinic_id: clinicId,
      code: codeUpperCase,
      name: formData.name,
      phone_number: formData.phone_number,
      message_template: formData.message_template || null,
      source_id: formData.source_id || null,
      is_active: formData.is_active
    };

    if (editingLink) {
      await (supabase as any).from('trackable_links').update(linkData).eq('id', editingLink.id);
    } else {
      await (supabase as any).from('trackable_links').insert(linkData);
    }

    setSaving(false);
    setShowModal(false);
    fetchLinks();
  };

  const handleDeleteClick = (id: string) => {
    setLinkToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!linkToDelete) return;
    await (supabase as any).from('trackable_links').delete().eq('id', linkToDelete);
    setShowDeleteModal(false);
    setLinkToDelete(null);
    fetchLinks();
  };

  const copyToClipboard = (link: TrackableLink) => {
    navigator.clipboard.writeText(`${baseUrl}/${link.code}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = formData.message_template;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setFormData({ ...formData, message_template: newText });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + emoji.length;
          textareaRef.current.selectionEnd = start + emoji.length;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setFormData({ ...formData, message_template: formData.message_template + emoji });
    }
    setShowEmojiPicker(false);
  };

  // Verificar permissão
  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">lock</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
          <p className="text-slate-500">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (!clinicId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header com botão Novo Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Links Rastreáveis</h1>
          <p className="text-xs sm:text-base text-slate-500">Gerencie seus links de rastreamento</p>
        </div>
        <button
          onClick={openNewModal}
          className="px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 sm:gap-2 font-medium text-sm sm:text-base"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Novo Link
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg sm:rounded-xl p-3 sm:p-5 text-white">
          <p className="text-cyan-100 text-[10px] sm:text-sm font-medium uppercase tracking-wide">Links Ativos</p>
          <p className="text-xl sm:text-3xl font-bold mt-0.5 sm:mt-1">{stats.activeLinks}</p>
          <p className="text-cyan-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1">de {stats.totalLinks}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl p-3 sm:p-5 text-white">
          <p className="text-blue-100 text-[10px] sm:text-sm font-medium uppercase tracking-wide">Cliques</p>
          <p className="text-xl sm:text-3xl font-bold mt-0.5 sm:mt-1">{stats.totalClicks}</p>
          <p className="text-blue-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1">Total</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl p-3 sm:p-5 text-white">
          <p className="text-green-100 text-[10px] sm:text-sm font-medium uppercase tracking-wide">Leads</p>
          <p className="text-xl sm:text-3xl font-bold mt-0.5 sm:mt-1">{stats.totalLeads}</p>
          <p className="text-green-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1">Gerados</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl p-3 sm:p-5 text-white">
          <p className="text-orange-100 text-[10px] sm:text-sm font-medium uppercase tracking-wide">Conversão</p>
          <p className="text-xl sm:text-3xl font-bold mt-0.5 sm:mt-1">{stats.conversionRate.toFixed(1)}%</p>
          <p className="text-orange-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1">Taxa</p>
        </div>
      </div>

      {/* Tabela de Links */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-lg sm:text-xl">emoji_events</span>
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">Top Links por Leads</h2>
        </div>
        
        {loading ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : links.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-300 mb-2">link_off</span>
            <p className="text-slate-500 mb-4 text-sm sm:text-base">Nenhum link criado ainda</p>
            <button
              onClick={openNewModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Criar primeiro link
            </button>
          </div>
        ) : (
          <>
            {/* Versão Mobile - Cards Expansíveis */}
            <div className="sm:hidden p-2 space-y-2">
              {links.map((link, index) => {
                const conversion = link.clicks_count > 0 ? ((link.leads_count / link.clicks_count) * 100).toFixed(1) : '0.0';
                const isExpanded = expandedLinkId === link.id;
                
                return (
                  <div 
                    key={link.id} 
                    className={`bg-slate-50 rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 bg-white shadow-sm' : 'border-slate-200'}`}
                  >
                    {/* Header do Card - Sempre visível */}
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedLinkId(isExpanded ? null : link.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base flex-shrink-0">
                          {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 text-xs truncate">{link.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{link.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <p className="text-xs font-bold text-green-600">{link.leads_count || 0}</p>
                          <p className="text-[8px] text-slate-400">leads</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {link.is_active ? 'Ativo' : 'Off'}
                        </span>
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Conteúdo Expandido */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* Métricas */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center bg-cyan-50 rounded-lg p-2">
                            <p className="text-[8px] text-cyan-600 uppercase">Cliques</p>
                            <p className="text-sm font-bold text-cyan-700">{link.clicks_count || 0}</p>
                          </div>
                          <div className="text-center bg-green-50 rounded-lg p-2">
                            <p className="text-[8px] text-green-600 uppercase">Leads</p>
                            <p className="text-sm font-bold text-green-700">{link.leads_count || 0}</p>
                          </div>
                          <div className="text-center bg-orange-50 rounded-lg p-2">
                            <p className="text-[8px] text-orange-600 uppercase">Conversão</p>
                            <p className="text-sm font-bold text-orange-700">{conversion}%</p>
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="mb-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">Link:</span>
                            <span className="text-[10px] text-slate-700 font-mono">{baseUrl}/{link.code}</span>
                          </div>
                          {link.lead_sources && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">Origem:</span>
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-medium">
                                {link.lead_sources.name}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Ações */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(link); }}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              copiedId === link.id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">{copiedId === link.id ? 'check' : 'content_copy'}</span>
                            {copiedId === link.id ? 'Copiado!' : 'Copiar'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/link/${link.id}`); }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            Detalhes
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(link); }}
                            className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(link.id); }}
                            className="px-2 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
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
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">#</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Link</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Origem</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Cliques</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Leads</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Conversão</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-500">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {links.map((link, index) => {
                    const conversion = link.clicks_count > 0 ? ((link.leads_count / link.clicks_count) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={link.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          {index === 0 && <span className="text-amber-500 text-xl">🏆</span>}
                          {index === 1 && <span className="text-slate-400 text-xl">🥈</span>}
                          {index === 2 && <span className="text-amber-700 text-xl">🥉</span>}
                          {index > 2 && <span className="text-slate-400">{index + 1}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{link.name}</p>
                          <p className="text-xs text-slate-400">{baseUrl}/{link.code}</p>
                        </td>
                        <td className="py-3 px-4">
                          {link.lead_sources ? (
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                              {link.lead_sources.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-cyan-600">{link.clicks_count || 0}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-600">{link.leads_count || 0}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-600">{conversion}%</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {link.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => navigate(`/link/${link.id}`)} 
                              className="p-1.5 hover:bg-indigo-50 rounded text-indigo-500 flex items-center gap-1"
                              title="Ver detalhes"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                            <button 
                              onClick={() => navigate(`/link/${link.id}?tab=dashboard`)} 
                              className="p-1.5 hover:bg-orange-50 rounded text-orange-500 flex items-center gap-1"
                              title="Dashboard"
                            >
                              <span className="material-symbols-outlined text-sm">bar_chart</span>
                            </button>
                            <button 
                              onClick={() => copyToClipboard(link)} 
                              className={`p-1.5 rounded ${copiedId === link.id ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                              title="Copiar link"
                            >
                              <span className="material-symbols-outlined text-sm">{copiedId === link.id ? 'check' : 'content_copy'}</span>
                            </button>
                            <button 
                              onClick={() => openEditModal(link)} 
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-400"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(link.id)} 
                              className="p-1.5 hover:bg-red-50 rounded text-red-400"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
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
      </div>

      {/* Dica */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
        <span className="material-symbols-outlined text-cyan-600 text-lg sm:text-xl flex-shrink-0">lightbulb</span>
        <div>
          <h4 className="font-bold text-cyan-800 text-xs sm:text-base">Dica: Links Rastreáveis</h4>
          <p className="text-cyan-700 text-[10px] sm:text-sm">
            Use links diferentes para cada canal para saber de onde vêm seus leads.
          </p>
        </div>
      </div>

      {/* Modal Criar/Editar Link */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl sm:rounded-t-2xl">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {editingLink ? 'Editar Link' : 'Novo Link'}
              </h3>
              <p className="text-indigo-200 text-xs sm:text-sm">
                {editingLink ? 'Atualize as informações' : 'Crie um link para rastrear'}
              </p>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Nome do Link *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Instagram Bio"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Código</label>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-slate-500 text-[10px] sm:text-sm hidden sm:inline">{baseUrl}/</span>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono uppercase text-sm"
                    maxLength={10}
                    placeholder="ABC123"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, code: generateCode() })}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                    title="Gerar novo código"
                  >
                    <span className="material-symbols-outlined text-lg sm:text-xl">refresh</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">WhatsApp *</label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="5567999999999"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Origem</label>
                <select
                  value={formData.source_id}
                  onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="">Selecione</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    rows={2}
                    placeholder="Mensagem inicial"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-2 top-2 p-1 hover:bg-slate-100 rounded text-slate-400"
                  >
                    <span className="material-symbols-outlined text-lg">mood</span>
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute right-0 top-full mt-1 z-10">
                      <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-xs sm:text-sm text-slate-700">Link ativo</label>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200 flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.phone_number}
                className="flex-1 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {saving ? 'Salvando...' : editingLink ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="material-symbols-outlined text-red-600 text-xl sm:text-2xl">delete</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 sm:mb-2">Excluir link?</h3>
              <p className="text-slate-500 mb-4 sm:mb-6 text-xs sm:text-sm">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
