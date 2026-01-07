
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { supabase } from '../lib/supabase';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface QuickReply {
  id: string;
  text: string;
}

interface SettingsProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Settings: React.FC<SettingsProps> = ({ state, setState }) => {
  const clinicId = state.selectedClinic?.id;
  
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

  useEffect(() => {
    fetchTags();
    fetchQuickReplies();
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

        {/* Card: Integração WhatsApp */}
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
      </div>
    </div>
  );
};

export default Settings;
