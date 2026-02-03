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
    <div className="p-6">
      {/* Header com botão Novo Link */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Links Rastreáveis</h1>
          <p className="text-slate-500">Gerencie seus links de rastreamento para campanhas</p>
        </div>
        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Novo Link
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white">
          <p className="text-cyan-100 text-sm font-medium uppercase tracking-wide">Links Ativos</p>
          <p className="text-3xl font-bold mt-1">{stats.activeLinks}</p>
          <p className="text-cyan-100 text-sm mt-1">de {stats.totalLinks} criados</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Total de Cliques</p>
          <p className="text-3xl font-bold mt-1">{stats.totalClicks}</p>
          <p className="text-blue-100 text-sm mt-1">Em todos os links</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Leads Gerados</p>
          <p className="text-3xl font-bold mt-1">{stats.totalLeads}</p>
          <p className="text-green-100 text-sm mt-1">Via links rastreáveis</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
          <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">Taxa de Conversão</p>
          <p className="text-3xl font-bold mt-1">{stats.conversionRate.toFixed(1)}%</p>
          <p className="text-orange-100 text-sm mt-1">Cliques → Leads</p>
        </div>
      </div>

      {/* Tabela de Links */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">emoji_events</span>
          <h2 className="font-bold text-slate-800">Top Links por Leads</h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : links.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">link_off</span>
            <p className="text-slate-500 mb-4">Nenhum link criado ainda</p>
            <button
              onClick={openNewModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Criar primeiro link
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </div>

      {/* Dica */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-cyan-600 text-xl">lightbulb</span>
        <div>
          <h4 className="font-bold text-cyan-800">Dica: Links Rastreáveis</h4>
          <p className="text-cyan-700 text-sm">
            Use links diferentes para cada canal (Instagram Bio, Google Ads, Site) para saber exatamente de onde vêm seus leads. 
            Crie novos links clicando em "+ Novo Link".
          </p>
        </div>
      </div>

      {/* Modal Criar/Editar Link */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">
                {editingLink ? 'Editar Link' : 'Novo Link Rastreável'}
              </h3>
              <p className="text-indigo-200 text-sm">
                {editingLink ? 'Atualize as informações do link' : 'Crie um link para rastrear leads'}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Link *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Instagram Dra. Kamylle"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código do Link</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">{baseUrl}/</span>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono uppercase"
                    maxLength={10}
                    placeholder="Ex: ABC123"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, code: generateCode() })}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                    title="Gerar novo código"
                  >
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="5567999999999"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origem (Lead Source)</label>
                <select
                  value={formData.source_id}
                  onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Selecione uma origem</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem Inicial</label>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    rows={3}
                    placeholder="Mensagem que será enviada automaticamente"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-2 top-2 p-1 hover:bg-slate-100 rounded text-slate-400"
                  >
                    <span className="material-symbols-outlined">mood</span>
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
                <label htmlFor="is_active" className="text-sm text-slate-700">Link ativo</label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.phone_number}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : editingLink ? 'Salvar' : 'Criar Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600">delete</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir link?</h3>
              <p className="text-slate-500 mb-6">Esta ação não pode ser desfeita. Os dados de cliques serão mantidos.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
