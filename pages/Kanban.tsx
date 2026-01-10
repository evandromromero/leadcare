
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface KanbanProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

type ChatStatus = 'Novo Lead' | 'Em Atendimento' | 'Agendado' | 'Convertido' | 'Perdido';

// Labels padrão para as colunas do pipeline
const DEFAULT_LABELS: Record<ChatStatus, string> = {
  'Novo Lead': 'Novos',
  'Em Atendimento': 'Atendimento',
  'Agendado': 'Agendados',
  'Convertido': 'Ganhos',
  'Perdido': 'Perdidos',
};

const Kanban: React.FC<KanbanProps> = ({ state, setState }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, updateChatStatus, refetch } = useChats(clinicId, user?.id);
  const columns: ChatStatus[] = ['Novo Lead', 'Em Atendimento', 'Agendado', 'Convertido', 'Perdido'];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, Array<{ service_type: string; value: number; status: string }>>>({});
  
  // Estados para modal de novo lead
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '' });
  const [savingLead, setSavingLead] = useState(false);
  
  // Estados para labels personalizados do pipeline
  const [pipelineLabels, setPipelineLabels] = useState<Record<string, string>>(DEFAULT_LABELS);
  const [showEditLabelsModal, setShowEditLabelsModal] = useState(false);
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});
  const [savingLabels, setSavingLabels] = useState(false);

  // Buscar labels personalizados do pipeline
  useEffect(() => {
    const fetchPipelineLabels = async () => {
      if (!clinicId) return;
      
      try {
        const { data } = await supabase
          .from('pipeline_settings' as any)
          .select('status_key, label')
          .eq('clinic_id', clinicId);
        
        if (data && data.length > 0) {
          const customLabels: Record<string, string> = { ...DEFAULT_LABELS };
          (data as any[]).forEach(item => {
            customLabels[item.status_key] = item.label;
          });
          setPipelineLabels(customLabels);
        }
      } catch (err) {
        console.error('Error fetching pipeline labels:', err);
      }
    };
    
    fetchPipelineLabels();
  }, [clinicId]);

  // Salvar labels personalizados
  const handleSaveLabels = async () => {
    if (!clinicId) return;
    
    setSavingLabels(true);
    try {
      // Upsert para cada label
      for (const [statusKey, label] of Object.entries(editingLabels)) {
        await supabase
          .from('pipeline_settings' as any)
          .upsert({
            clinic_id: clinicId,
            status_key: statusKey,
            label: label,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'clinic_id,status_key' });
      }
      
      setPipelineLabels(editingLabels);
      setShowEditLabelsModal(false);
    } catch (err) {
      console.error('Error saving pipeline labels:', err);
    } finally {
      setSavingLabels(false);
    }
  };

  // Buscar orçamentos (pendentes e aprovados) de todos os chats
  useEffect(() => {
    const fetchQuotes = async () => {
      if (!clinicId || chats.length === 0) return;
      
      const chatIds = chats.map(c => c.id);
      const { data } = await supabase
        .from('quotes' as any)
        .select('chat_id, service_type, value, status')
        .in('chat_id', chatIds)
        .in('status', ['approved', 'pending']);
      
      if (data) {
        const map: Record<string, Array<{ service_type: string; value: number; status: string }>> = {};
        (data as any[]).forEach(q => {
          if (!map[q.chat_id]) map[q.chat_id] = [];
          map[q.chat_id].push({ service_type: q.service_type, value: Number(q.value), status: q.status });
        });
        setQuotesMap(map);
      }
    };
    fetchQuotes();
  }, [clinicId, chats]);

  const columnConfig: Record<ChatStatus, { color: string }> = {
    'Novo Lead': { color: 'blue' },
    'Em Atendimento': { color: 'orange' },
    'Agendado': { color: 'purple' },
    'Convertido': { color: 'green' },
    'Perdido': { color: 'red' },
  };

  const moveLead = async (id: string, newStage: ChatStatus) => {
    await updateChatStatus(id, newStage);
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Agora';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, newStage: ChatStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      moveLead(id, newStage);
      setDraggedId(null);
    }
  };

  // Criar novo lead
  const handleCreateLead = async () => {
    if (!newLeadForm.name.trim() || !newLeadForm.phone.trim() || !clinicId) return;
    
    setSavingLead(true);
    try {
      const { error } = await supabase
        .from('chats')
        .insert({
          clinic_id: clinicId,
          client_name: newLeadForm.name.trim(),
          phone_number: newLeadForm.phone.trim(),
          status: 'Novo Lead',
        });
      
      if (!error) {
        setNewLeadForm({ name: '', phone: '' });
        setShowNewLeadModal(false);
        refetch();
      }
    } catch (err) {
      console.error('Error creating lead:', err);
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pipeline de Leads</h1>
          <p className="text-slate-500">Arraste e solte os leads para atualizar o status.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
              onClick={() => {
                setEditingLabels({ ...pipelineLabels });
                setShowEditLabelsModal(true);
              }}
              className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Editar nomes das etapas"
           >
              <span className="material-symbols-outlined text-[20px]">settings</span>
           </button>
           <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
              <input type="text" placeholder="Buscar lead..." className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-lg text-sm" />
           </div>
           <button 
              onClick={() => setShowNewLeadModal(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm h-10 px-6 rounded-lg shadow-lg shadow-cyan-500/30 flex items-center gap-2"
           >
              <span className="material-symbols-outlined text-[20px]">add</span> Novo Lead
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-6 pb-6 no-scrollbar">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto mb-4"></div>
              <p className="text-slate-500">Carregando pipeline...</p>
            </div>
          </div>
        ) : columns.map(column => {
          const leadsInCol = chats.filter(c => c.status === column);
          const config = columnConfig[column];

          return (
            <div 
              key={column} 
              className="w-[320px] flex flex-col shrink-0"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column)}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full bg-${config.color}-500`}></div>
                  <h3 className="font-black text-slate-700 uppercase text-[11px] tracking-widest">{pipelineLabels[column]}</h3>
                  <span className={`bg-${config.color}-50 text-${config.color}-700 px-2 py-0.5 rounded-full text-[10px] font-black`}>
                    {leadsInCol.length}
                  </span>
                </div>
                <button className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>

              <div className={`flex-1 overflow-y-auto space-y-4 pr-1 rounded-xl transition-colors ${draggedId ? 'bg-slate-100/50' : ''}`}>
                {leadsInCol.map(lead => (
                  <div 
                    key={lead.id} 
                    draggable
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-400 transition-all cursor-grab active:cursor-grabbing group relative ${draggedId === lead.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-900 text-sm truncate pr-4">{lead.client_name}</h4>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-slate-300 text-[18px]">drag_indicator</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-4">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      {lead.phone_number}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {lead.tags.map(tag => (
                        <span key={tag.id} className="px-1.5 py-0.5 rounded text-[9px] font-black border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Orçamentos */}
                    {quotesMap[lead.id]?.length > 0 && (
                      <div className="mb-4 space-y-1">
                        {quotesMap[lead.id].map((q, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border ${
                              q.status === 'approved' 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`material-symbols-outlined text-[14px] ${q.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                                {q.status === 'approved' ? 'check_circle' : 'schedule'}
                              </span>
                              <span className={q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}>{q.service_type}</span>
                            </div>
                            <span className={`font-black ml-2 ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>
                              R$ {q.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {quotesMap[lead.id].length > 1 && (
                          <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-600">Total</span>
                            <span className="font-black text-slate-700">
                              R$ {quotesMap[lead.id].reduce((sum, q) => sum + q.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> {formatTimeAgo(lead.updated_at)}
                      </div>
                      <img src={lead.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.client_name)}&background=0891b2&color=fff&size=32`} className="size-6 rounded-full border border-white shadow-sm" />
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => setShowNewLeadModal(true)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50/50 border border-dashed border-slate-200 rounded-2xl transition-all text-sm font-medium"
                >
                   <span className="material-symbols-outlined text-[18px]">add</span> Adicionar Lead
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Editar Labels do Pipeline */}
      {showEditLabelsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditLabelsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Editar Etapas do Pipeline</h3>
              <button onClick={() => setShowEditLabelsModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {columns.map(column => (
                <div key={column}>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{column}</label>
                  <input
                    type="text"
                    value={editingLabels[column] || ''}
                    onChange={(e) => setEditingLabels(prev => ({ ...prev, [column]: e.target.value }))}
                    placeholder={DEFAULT_LABELS[column]}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                  />
                </div>
              ))}
              <button
                onClick={handleSaveLabels}
                disabled={savingLabels}
                className="w-full py-3 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLabels ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lead */}
      {showNewLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewLeadModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Novo Lead</h3>
              <button onClick={() => setShowNewLeadModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nome do Cliente</label>
                <input
                  type="text"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Telefone (WhatsApp)</label>
                <input
                  type="text"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
                <p className="text-[10px] text-slate-400 mt-1">Formato: código do país + DDD + número</p>
              </div>
              <button
                onClick={handleCreateLead}
                disabled={!newLeadForm.name.trim() || !newLeadForm.phone.trim() || savingLead}
                className="w-full py-3 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLead ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    Criar Lead
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Kanban;
