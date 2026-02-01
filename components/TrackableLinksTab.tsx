import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import EmojiPicker from './EmojiPicker';

interface TrackableLink {
  id: string;
  code: string;
  name: string;
  phone_number: string;
  message_template: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  source_id: string | null;
  clicks_count: number;
  leads_count: number;
  is_active: boolean;
  created_at: string;
}

interface LeadSource {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface Props {
  clinicId: string;
}

export default function TrackableLinksTab({ clinicId }: Props) {
  const navigate = useNavigate();
  const [links, setLinks] = useState<TrackableLink[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState<TrackableLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [clinicPhone, setClinicPhone] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [createdLink, setCreatedLink] = useState<TrackableLink | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone_number: '',
    message_template: 'Oii 👋 Vi seu anúncio e gostaria de mais informações! 😊',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    source_id: '',
    is_active: true,
  });

  // URL base para os links rastreáveis (usando domínio próprio)
  const baseUrl = 'https://belitx.com.br/r';

  useEffect(() => {
    if (!clinicId) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      const { data: linksData } = await (supabase as any)
        .from('trackable_links')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      
      if (linksData) setLinks(linksData);
      
      const { data: sourcesData } = await supabase
        .from('lead_sources')
        .select('id, code, name, color')
        .eq('clinic_id', clinicId)
        .order('name');
      
      if (sourcesData) setSources(sourcesData);
      
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('phone')
        .eq('id', clinicId)
        .single();
      
      if (clinicData?.phone) setClinicPhone(clinicData.phone);
      
      setLoading(false);
    };
    
    fetchData();
  }, [clinicId]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const openNewModal = () => {
    setEditingLink(null);
    setFormData({
      code: generateCode(),
      name: '',
      phone_number: clinicPhone,
      message_template: 'Oii 👋 Vi seu anúncio e gostaria de mais informações! 😊',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_content: '',
      utm_term: '',
      source_id: '',
      is_active: true,
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
      utm_source: link.utm_source || '',
      utm_medium: link.utm_medium || '',
      utm_campaign: link.utm_campaign || '',
      utm_content: link.utm_content || '',
      utm_term: link.utm_term || '',
      source_id: link.source_id || '',
      is_active: link.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!clinicId || !formData.code || !formData.name || !formData.phone_number) return;
    
    setSaving(true);
    
    try {
      const payload = {
        clinic_id: clinicId,
        code: formData.code.toUpperCase(),
        name: formData.name,
        phone_number: formData.phone_number,
        message_template: formData.message_template || null,
        utm_source: formData.utm_source || null,
        utm_medium: formData.utm_medium || null,
        utm_campaign: formData.utm_campaign || null,
        utm_content: formData.utm_content || null,
        utm_term: formData.utm_term || null,
        source_id: formData.source_id || null,
        is_active: formData.is_active,
      };
      
      if (editingLink) {
        await (supabase as any).from('trackable_links').update(payload).eq('id', editingLink.id);
        setShowModal(false);
      } else {
        const { data: newLink } = await (supabase as any)
          .from('trackable_links')
          .insert(payload)
          .select()
          .single();
        
        if (newLink) {
          setCreatedLink(newLink);
          setShowModal(false);
          setShowCodesModal(true);
        }
      }
      
      const { data: linksData } = await (supabase as any)
        .from('trackable_links')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      
      if (linksData) setLinks(linksData);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setLinkToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!linkToDelete) return;
    await (supabase as any).from('trackable_links').delete().eq('id', linkToDelete);
    setLinks(links.filter(l => l.id !== linkToDelete));
    setShowDeleteModal(false);
    setLinkToDelete(null);
  };

  const copyToClipboard = (link: TrackableLink) => {
    navigator.clipboard.writeText(`${baseUrl}/${link.code}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Links Rastreáveis</h3>
          <p className="text-sm text-slate-500">Crie links para rastrear leads de qualquer origem (Instagram Bio, Site, etc.)</p>
        </div>
        <button
          onClick={openNewModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Novo Link
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-2xl font-bold text-slate-900">{links.length}</p>
          <p className="text-xs text-slate-500">Links</p>
        </div>
        <div className="bg-cyan-50 p-4 rounded-xl">
          <p className="text-2xl font-bold text-cyan-600">{links.reduce((s, l) => s + l.clicks_count, 0)}</p>
          <p className="text-xs text-slate-500">Cliques</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl">
          <p className="text-2xl font-bold text-green-600">{links.reduce((s, l) => s + l.leads_count, 0)}</p>
          <p className="text-xs text-slate-500">Leads</p>
        </div>
      </div>

      {/* Table */}
      {links.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">link_off</span>
          <p className="text-slate-500">Nenhum link criado</p>
          <button onClick={openNewModal} className="mt-3 text-indigo-600 hover:underline text-sm">
            Criar primeiro link
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Nome</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Código</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500">Cliques</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500">Leads</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500">Status</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900">{link.name}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{baseUrl}/{link.code}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{link.code}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-cyan-600">{link.clicks_count}</td>
                  <td className="py-3 px-4 text-center font-bold text-green-600">{link.leads_count}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {link.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => navigate(`/link/${link.id}`)} 
                        className="p-1.5 hover:bg-indigo-50 rounded text-indigo-500"
                        title="Ver detalhes"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">{editingLink ? 'Editar Link' : 'Novo Link'}</h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Instagram Bio"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Código *</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                    />
                    <button onClick={() => setFormData({ ...formData, code: generateCode() })} className="px-2 bg-slate-100 hover:bg-slate-200 rounded-lg">
                      <span className="material-symbols-outlined text-sm">refresh</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp *</label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="5567999999999"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem</label>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-2 top-2 p-1 hover:bg-slate-100 rounded transition-colors"
                    title="Adicionar emoji"
                  >
                    <span className="text-lg">😊</span>
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji) => {
                        const textarea = textareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = formData.message_template;
                          const newText = text.substring(0, start) + emoji + text.substring(end);
                          setFormData({ ...formData, message_template: newText });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                          }, 0);
                        } else {
                          setFormData({ ...formData, message_template: formData.message_template + emoji });
                        }
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Código [{formData.code}] será adicionado</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Origem</label>
                <select
                  value={formData.source_id}
                  onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Selecione</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <details className="bg-slate-50 rounded-lg p-3">
                <summary className="text-xs font-medium text-slate-600 cursor-pointer">UTM (opcional)</summary>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <input type="text" value={formData.utm_source} onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })} placeholder="utm_source" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                  <input type="text" value={formData.utm_medium} onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })} placeholder="utm_medium" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                  <input type="text" value={formData.utm_campaign} onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })} placeholder="utm_campaign" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                  <input type="text" value={formData.utm_content} onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })} placeholder="utm_content" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                </div>
              </details>

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Preview</p>
                <code className="text-xs text-indigo-600 break-all">{baseUrl}/{formData.code || 'CODIGO'}</code>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded" />
                <span className="text-sm text-slate-700">Link ativo</span>
              </label>
            </div>

            <div className="p-5 border-t flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.code || !formData.name || !formData.phone_number}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>}
                {editingLink ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Códigos Prontos */}
      {showCodesModal && createdLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCodesModal(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-white text-2xl">check_circle</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Link Criado com Sucesso!</h3>
                  <p className="text-green-100 text-sm">Copie os códigos abaixo para usar em cada plataforma</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Link Principal */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-indigo-700">🔗 Link Principal</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}`);
                      setCopiedCode('link');
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${copiedCode === 'link' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{copiedCode === 'link' ? 'check' : 'content_copy'}</span>
                    {copiedCode === 'link' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <code className="text-sm text-indigo-800 break-all block bg-white p-2 rounded-lg">{baseUrl}/{createdLink.code}</code>
              </div>

              {/* Grid de Códigos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Instagram Bio */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-pink-600">📸 Instagram Bio</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}`);
                        setCopiedCode('instagram');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'instagram' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'instagram' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Cole este link na bio do Instagram</p>
                  <code className="text-xs text-slate-700 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}</code>
                </div>

                {/* Google Ads */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-blue-600">🔍 Google Ads</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}?utm_source=google&utm_medium=cpc`);
                        setCopiedCode('google');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'google' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'google' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Use como URL de destino no Google Ads</p>
                  <code className="text-xs text-slate-700 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}?utm_source=google&utm_medium=cpc</code>
                </div>

                {/* Meta Ads */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-indigo-600">📣 Meta Ads</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}?utm_source=facebook&utm_medium=paid`);
                        setCopiedCode('meta');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'meta' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'meta' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Use em anúncios do Facebook/Instagram</p>
                  <code className="text-xs text-slate-700 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}?utm_source=facebook&utm_medium=paid</code>
                </div>

                {/* Site */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-emerald-600">🌐 Botão no Site</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}?utm_source=website&utm_medium=button`);
                        setCopiedCode('site');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'site' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'site' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Use em botões de contato no site</p>
                  <code className="text-xs text-slate-700 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}?utm_source=website&utm_medium=button</code>
                </div>
              </div>

              {/* Botão Flutuante WhatsApp */}
              <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-green-700">💬 Botão Flutuante WhatsApp</span>
                  <button
                    onClick={() => {
                      const floatCode = `<!-- Botão WhatsApp Flutuante - ${createdLink.name} -->
<a href="${baseUrl}/${createdLink.code}?utm_source=website&utm_medium=float" target="_blank" rel="noopener" style="position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</a>`;
                      navigator.clipboard.writeText(floatCode);
                      setCopiedCode('float');
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${copiedCode === 'float' ? 'bg-green-600 text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{copiedCode === 'float' ? 'check' : 'code'}</span>
                    {copiedCode === 'float' ? 'Copiado!' : 'Copiar HTML'}
                  </button>
                </div>
                <p className="text-xs text-green-700 mb-3">Cole este código HTML antes do {"</body>"} do seu site</p>
                <pre className="text-[10px] text-green-800 bg-white p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
{`<a href="${baseUrl}/${createdLink.code}?utm_source=website&utm_medium=float" 
   target="_blank" 
   style="position:fixed;bottom:20px;right:20px;...">
  <svg>WhatsApp Icon</svg>
</a>`}
                </pre>
              </div>

              {/* QR Code e Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">📱 QR Code</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}?utm_source=offline&utm_medium=qrcode`);
                        setCopiedCode('qr');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'qr' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'qr' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Gere um QR Code com este link</p>
                  <code className="text-[10px] text-slate-600 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}?utm_source=offline&utm_medium=qrcode</code>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-purple-600">📧 Email Marketing</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}/${createdLink.code}?utm_source=email&utm_medium=newsletter`);
                        setCopiedCode('email');
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      className={`p-1.5 rounded ${copiedCode === 'email' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{copiedCode === 'email' ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Use em campanhas de email</p>
                  <code className="text-[10px] text-slate-600 break-all block bg-slate-50 p-2 rounded">{baseUrl}/{createdLink.code}?utm_source=email&utm_medium=newsletter</code>
                </div>
              </div>
            </div>

            <div className="p-5 border-t bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowCodesModal(false)}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowCodesModal(false);
                  navigate(`/link/${createdLink.id}`);
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Ver Configurações Completas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600 text-2xl">delete</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Link</h3>
              <p className="text-slate-500 mb-6">Tem certeza que deseja excluir este link? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete} 
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
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
