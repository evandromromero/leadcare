
import React, { useState } from 'react';
import { GlobalState, Chat } from '../types';

interface KanbanProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Kanban: React.FC<KanbanProps> = ({ state, setState }) => {
  const columns: Chat['status'][] = ['Novo Lead', 'Em Atendimento', 'Agendado', 'Fechado', 'Perdido'];
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const columnConfig = {
    'Novo Lead': { color: 'blue', label: 'Novos' },
    'Em Atendimento': { color: 'orange', label: 'Atendimento' },
    'Agendado': { color: 'purple', label: 'Agendados' },
    'Fechado': { color: 'green', label: 'Ganhos' },
    'Perdido': { color: 'red', label: 'Perdidos' },
  };

  const moveLead = (id: string, newStage: Chat['status']) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => chat.id === id ? { ...chat, status: newStage } : chat)
    }));
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

  const onDrop = (e: React.DragEvent, newStage: Chat['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      moveLead(id, newStage);
      setDraggedId(null);
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
           <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
              <input type="text" placeholder="Buscar lead..." className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-lg text-sm" />
           </div>
           <button className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm h-10 px-6 rounded-lg shadow-lg shadow-cyan-500/30 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">add</span> Novo Lead
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-6 pb-6 no-scrollbar">
        {columns.map(column => {
          const leadsInCol = state.chats.filter(c => c.status === column);
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
                  <h3 className="font-black text-slate-700 uppercase text-[11px] tracking-widest">{config.label}</h3>
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
                      <h4 className="font-bold text-slate-900 text-sm truncate pr-4">{lead.clientName}</h4>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-slate-300 text-[18px]">drag_indicator</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-4">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      {lead.phoneNumber}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {lead.tags.map(tag => (
                        <span key={tag.label} className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${tag.color}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> 2h atrás
                      </div>
                      <img src={lead.avatarUrl} className="size-6 rounded-full border border-white shadow-sm" />
                    </div>
                  </div>
                ))}
                
                <button className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50/50 border border-dashed border-slate-200 rounded-2xl transition-all text-sm font-medium">
                   <span className="material-symbols-outlined text-[18px]">add</span> Adicionar Lead
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Kanban;
