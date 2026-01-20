
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface QuickReply {
  id: string;
  text: string;
}

interface CloudApiConfig {
  cloud_api_enabled: boolean;
  cloud_api_phone_number_id: string | null;
  cloud_api_access_token: string | null;
  cloud_api_waba_id: string | null;
  cloud_api_verify_token: string | null;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
}

interface SettingsProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Settings: React.FC<SettingsProps> = ({ state, setState }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  
  const canEditTags = hasPermission(user?.role, 'edit_tags');
  const canEditQuickReplies = hasPermission(user?.role, 'edit_quick_replies');
  const canEditClinicProfile = hasPermission(user?.role, 'edit_clinic_profile');
  const canConfigureCloudApi = user?.role === 'Admin' || user?.role === 'Gerente';
  
  // Estados para etiquetas
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [loadingTags, setLoadingTags] = useState(false);
  
  // Estados para mensagens rápidas
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newQuickReply, setNewQuickReply] = useState('');
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Estados para Cloud API
  const [cloudApiConfig, setCloudApiConfig] = useState<CloudApiConfig | null>(null);
  const [savingCloudApi, setSavingCloudApi] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [massMessagePhones, setMassMessagePhones] = useState('');
  const [sendingMassMessage, setSendingMassMessage] = useState(false);

  // Cores predefinidas para etiquetas
  const tagColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // Buscar etiquetas
  const fetchTags = async () => {
    if (!clinicId) return;
    setLoadingTags(true);
    const { data } = await supabase.from('tags').select('*').eq('clinic_id', clinicId).order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  };

  // Buscar mensagens rápidas
  const fetchQuickReplies = async () => {
    if (!clinicId) return;
    setLoadingReplies(true);
    const { data } = await supabase.from('quick_replies' as any).select('*').eq('clinic_id', clinicId).order('created_at');
    if (data) setQuickReplies(data as QuickReply[]);
    setLoadingReplies(false);
  };

  // Buscar configuração Cloud API
  const fetchCloudApiConfig = async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from('clinics')
      .select('cloud_api_enabled, cloud_api_phone_number_id, cloud_api_access_token, cloud_api_waba_id, cloud_api_verify_token')
      .eq('id', clinicId)
      .single();
    if (data) setCloudApiConfig(data as CloudApiConfig);
  };

  // Salvar configuração Cloud API
  const saveCloudApiConfig = async () => {
    if (!clinicId || !cloudApiConfig) return;
    setSavingCloudApi(true);
    try {
      await supabase
        .from('clinics')
        .update({
          cloud_api_phone_number_id: cloudApiConfig.cloud_api_phone_number_id,
          cloud_api_access_token: cloudApiConfig.cloud_api_access_token,
          cloud_api_waba_id: cloudApiConfig.cloud_api_waba_id,
          cloud_api_verify_token: cloudApiConfig.cloud_api_verify_token,
          whatsapp_provider: 'cloud_api',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clinicId);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving Cloud API config:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSavingCloudApi(false);
    }
  };

  // Buscar templates
  const fetchTemplates = async () => {
    if (!clinicId) return;
    const { data } = await (supabase as any)
      .from('whatsapp_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name');
    if (data) setTemplates(data as WhatsAppTemplate[]);
  };

  // Sincronizar templates do Meta
  const syncTemplates = async () => {
    if (!clinicId) return;
    setSyncingTemplates(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          clinic_id: clinicId,
          action: 'sync_templates',
        }),
      });
      
      const result = await response.json();
      if (result.error) {
        alert(`Erro: ${result.error}`);
      } else {
        alert(`${result.count} templates sincronizados!`);
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Error syncing templates:', error);
      alert('Erro ao sincronizar templates');
    } finally {
      setSyncingTemplates(false);
    }
  };

  // Enviar mensagem em massa
  const sendMassMessage = async () => {
    if (!clinicId || !selectedTemplate || !massMessagePhones.trim()) return;
    setSendingMassMessage(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const phones = massMessagePhones.split('\n').map(p => p.trim()).filter(p => p.length > 0);
      let successCount = 0;
      let failCount = 0;
      
      for (const phone of phones) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              clinic_id: clinicId,
              action: 'send_template',
              phone: phone,
              template_name: selectedTemplate.name,
              template_language: selectedTemplate.language,
            }),
          });
          
          const result = await response.json();
          if (result.success) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }
      
      alert(`Envio concluído!\nSucesso: ${successCount}\nFalha: ${failCount}`);
      setShowMassMessageModal(false);
      setMassMessagePhones('');
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error sending mass message:', error);
      alert('Erro ao enviar mensagens');
    } finally {
      setSendingMassMessage(false);
    }
  };

  useEffect(() => {
    fetchTags();
    fetchQuickReplies();
    fetchCloudApiConfig();
    fetchTemplates();
  }, [clinicId]);

  // CRUD Etiquetas
  const handleAddTag = async () => {
    if (!newTagName.trim() || !clinicId) return;
    await supabase.from('tags').insert({ clinic_id: clinicId, name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
    fetchTags();
  };

  const handleUpdateTag = async () => {
    if (!editingTag) return;
    await supabase.from('tags').update({ name: editingTag.name, color: editingTag.color }).eq('id', editingTag.id);
    setEditingTag(null);
    fetchTags();
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta?')) return;
    await supabase.from('tags').delete().eq('id', id);
    fetchTags();
  };

  // CRUD Mensagens Rápidas
  const handleAddQuickReply = async () => {
    if (!newQuickReply.trim() || !clinicId) return;
    await supabase.from('quick_replies' as any).insert({ clinic_id: clinicId, text: newQuickReply.trim() });
    setNewQuickReply('');
    fetchQuickReplies();
  };

  const handleUpdateQuickReply = async () => {
    if (!editingReply) return;
    await supabase.from('quick_replies' as any).update({ text: editingReply.text }).eq('id', editingReply.id);
    setEditingReply(null);
    fetchQuickReplies();
  };

  const handleDeleteQuickReply = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem rápida?')) return;
    await supabase.from('quick_replies' as any).delete().eq('id', id);
    fetchQuickReplies();
  };
  return (
    <div className="p-8 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500">Gerencie as preferências da sua clínica.</p>
      </div>

      {/* Grid de 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card: Etiquetas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">label</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Etiquetas</h3>
              <p className="text-xs text-slate-500">Organize seus contatos</p>
            </div>
          </div>
          
          {/* Adicionar etiqueta */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Nova etiqueta..."
              className="flex-1 h-10 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <div className="flex gap-1">
              {tagColors.slice(0, 4).map(color => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`size-6 rounded transition-transform ${newTagColor === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="h-10 px-4 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              +
            </button>
          </div>

          {/* Lista de etiquetas */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {loadingTags ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-600 mx-auto"></div>
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma etiqueta</p>
            ) : (
              tags.map(tag => (
                <div key={tag.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  {editingTag?.id === tag.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        className="flex-1 h-8 bg-white border-slate-200 rounded px-2 text-sm"
                      />
                      <button onClick={handleUpdateTag} className="text-green-600">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                      <button onClick={() => setEditingTag(null)} className="text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded" style={{ backgroundColor: tag.color }}></span>
                        <span className="text-sm text-slate-700">{tag.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingTag(tag)} className="text-slate-400 hover:text-cyan-600">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => handleDeleteTag(tag.id)} className="text-slate-400 hover:text-red-600">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card: Mensagens Rápidas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Mensagens Rápidas</h3>
              <p className="text-xs text-slate-500">Respostas prontas</p>
            </div>
          </div>
          
          {/* Adicionar mensagem */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuickReply}
              onChange={(e) => setNewQuickReply(e.target.value)}
              placeholder="Nova mensagem rápida..."
              className="flex-1 h-10 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddQuickReply()}
            />
            <button
              onClick={handleAddQuickReply}
              disabled={!newQuickReply.trim()}
              className="h-10 px-4 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              +
            </button>
          </div>

          {/* Lista de mensagens */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {loadingReplies ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-600 mx-auto"></div>
              </div>
            ) : quickReplies.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma mensagem rápida</p>
            ) : (
              quickReplies.map(reply => (
                <div key={reply.id} className="flex items-start justify-between p-2 bg-slate-50 rounded-lg">
                  {editingReply?.id === reply.id ? (
                    <div className="flex items-start gap-2 flex-1">
                      <input
                        type="text"
                        value={editingReply.text}
                        onChange={(e) => setEditingReply({ ...editingReply, text: e.target.value })}
                        className="flex-1 h-8 bg-white border-slate-200 rounded px-2 text-sm"
                      />
                      <button onClick={handleUpdateQuickReply} className="text-green-600">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                      <button onClick={() => setEditingReply(null)} className="text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 flex-1 line-clamp-2">{reply.text}</p>
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => setEditingReply(reply)} className="text-slate-400 hover:text-cyan-600">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => handleDeleteQuickReply(reply.id)} className="text-slate-400 hover:text-red-600">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card: Perfil da Clínica */}
        {canEditClinicProfile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">business</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Perfil da Clínica</h3>
              <p className="text-xs text-slate-500">Informações da unidade</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <img src={state.selectedClinic?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.selectedClinic?.name || 'C')}&background=0891b2&color=fff&size=60`} className="size-14 rounded-xl object-cover border border-slate-100" />
            <div className="flex-1">
              <input type="text" defaultValue={state.selectedClinic?.name} className="w-full h-10 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm font-medium" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">CNPJ</label>
              <input type="text" defaultValue="00.000.000/0001-00" className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone</label>
              <input type="text" defaultValue="(11) 99999-9999" className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm" />
            </div>
          </div>
          
          <button className="w-full h-10 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700">
            Salvar Alterações
          </button>
        </div>
        )}

        {/* Card: Integração WhatsApp */}
        {canEditClinicProfile && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">api</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Integração WhatsApp</h3>
              <p className="text-xs text-slate-500">Status e configurações</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="size-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-slate-700">Webhook Status</span>
            </div>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">Online</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">auto_fix_high</span>
              <span className="text-sm text-slate-700">Auto-Resposta (IA)</span>
            </div>
            <div className="w-10 h-5 bg-slate-200 rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 size-4 bg-white rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
        )}

        {/* Card: Cloud API - só aparece se habilitado pelo SuperAdmin */}
        {canConfigureCloudApi && cloudApiConfig?.cloud_api_enabled && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">WhatsApp Cloud API</h3>
              <p className="text-xs text-slate-500">API Oficial do Meta para envio em massa</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number ID *</label>
              <input
                type="text"
                value={cloudApiConfig?.cloud_api_phone_number_id || ''}
                onChange={(e) => setCloudApiConfig({ ...cloudApiConfig!, cloud_api_phone_number_id: e.target.value })}
                placeholder="ID do número no Meta"
                className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">WABA ID *</label>
              <input
                type="text"
                value={cloudApiConfig?.cloud_api_waba_id || ''}
                onChange={(e) => setCloudApiConfig({ ...cloudApiConfig!, cloud_api_waba_id: e.target.value })}
                placeholder="WhatsApp Business Account ID"
                className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Access Token *</label>
              <input
                type="password"
                value={cloudApiConfig?.cloud_api_access_token || ''}
                onChange={(e) => setCloudApiConfig({ ...cloudApiConfig!, cloud_api_access_token: e.target.value })}
                placeholder="Token do System User"
                className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Verify Token (Webhook)</label>
              <input
                type="text"
                value={cloudApiConfig?.cloud_api_verify_token || ''}
                onChange={(e) => setCloudApiConfig({ ...cloudApiConfig!, cloud_api_verify_token: e.target.value })}
                placeholder="Token para verificação"
                className="w-full h-9 bg-slate-50 border-slate-200 rounded-lg px-3 text-sm"
              />
            </div>
          </div>
          
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Webhook URL</p>
            <code className="text-xs text-slate-600 break-all">
              {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-cloud-webhook`}
            </code>
          </div>
          
          <button
            onClick={saveCloudApiConfig}
            disabled={savingCloudApi}
            className="w-full h-10 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingCloudApi ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
        )}

        {/* Card: Templates - só aparece se Cloud API configurada */}
        {canConfigureCloudApi && cloudApiConfig?.cloud_api_enabled && cloudApiConfig?.cloud_api_waba_id && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Templates</h3>
                <p className="text-xs text-slate-500">Mensagens aprovadas pelo Meta</p>
              </div>
            </div>
            <button
              onClick={syncTemplates}
              disabled={syncingTemplates}
              className="h-8 px-3 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
            >
              <span className={`material-symbols-outlined text-[14px] ${syncingTemplates ? 'animate-spin' : ''}`}>
                {syncingTemplates ? 'progress_activity' : 'sync'}
              </span>
              Sincronizar
            </button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Clique em "Sincronizar" para buscar templates</p>
            ) : (
              templates.map(template => (
                <div key={template.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{template.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        template.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        template.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {template.status}
                      </span>
                      <span className="text-[10px] text-slate-400">{template.category}</span>
                    </div>
                  </div>
                  {template.status === 'APPROVED' && (
                    <button
                      onClick={() => { setSelectedTemplate(template); setShowMassMessageModal(true); }}
                      className="text-violet-600 hover:bg-violet-50 p-1.5 rounded"
                      title="Enviar em massa"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>

      {/* Modal de Envio em Massa */}
      {showMassMessageModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Envio em Massa</h3>
              <button 
                onClick={() => { setShowMassMessageModal(false); setSelectedTemplate(null); }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-sm font-medium text-violet-800">Template: {selectedTemplate.name}</p>
                <p className="text-xs text-violet-600 mt-1">{selectedTemplate.category} • {selectedTemplate.language}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">Números de telefone</label>
                <p className="text-xs text-slate-500 mb-2">Um número por linha (com DDD)</p>
                <textarea
                  value={massMessagePhones}
                  onChange={(e) => setMassMessagePhones(e.target.value)}
                  placeholder="11999999999&#10;21988888888&#10;31977777777"
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {massMessagePhones.split('\n').filter(p => p.trim()).length} números
                </p>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowMassMessageModal(false); setSelectedTemplate(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendMassMessage}
                  disabled={sendingMassMessage || !massMessagePhones.trim()}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingMassMessage ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Enviar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
