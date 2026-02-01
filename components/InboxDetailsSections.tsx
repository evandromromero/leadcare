import React, { useState } from 'react';

// Tipos
export type SectionKey = 'pipeline' | 'responsavel' | 'origem' | 'etiquetas' | 'orcamentos' | 'negociacoes' | 'lancamentos' | 'tarefas' | 'followup' | 'observacoes';

export const DEFAULT_SECTION_ORDER: SectionKey[] = ['pipeline', 'responsavel', 'origem', 'etiquetas', 'orcamentos', 'negociacoes', 'lancamentos', 'tarefas', 'followup', 'observacoes'];

export const SECTION_KEYS: SectionKey[] = DEFAULT_SECTION_ORDER;

export const SECTION_LABELS: Record<SectionKey, string> = {
  pipeline: 'Etapa do Pipeline',
  responsavel: 'Responsável',
  origem: 'Origem do Lead',
  etiquetas: 'Etiquetas',
  orcamentos: 'Orçamentos',
  negociacoes: 'Negociações Comerciais',
  lancamentos: 'Lançamentos da Clínica',
  tarefas: 'Tarefas',
  followup: 'Follow-up',
  observacoes: 'Observações'
};

// Hook para gerenciar seções
export const useSectionConfig = () => {
  const [hiddenSections, setHiddenSections] = useState<Record<SectionKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('inbox_hidden_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    try {
      const saved = localStorage.getItem('inbox_section_order');
      if (saved) {
        const parsed = JSON.parse(saved) as SectionKey[];
        if (Array.isArray(parsed) && parsed.length === DEFAULT_SECTION_ORDER.length) {
          return parsed;
        }
      }
      return DEFAULT_SECTION_ORDER;
    } catch {
      return DEFAULT_SECTION_ORDER;
    }
  });

  const toggleSectionVisibility = (key: SectionKey) => {
    setHiddenSections(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('inbox_hidden_sections', JSON.stringify(updated));
      return updated;
    });
  };

  const moveSectionUp = (key: SectionKey) => {
    setSectionOrder(prev => {
      const index = prev.indexOf(key);
      if (index <= 0) return prev;
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      localStorage.setItem('inbox_section_order', JSON.stringify(updated));
      return updated;
    });
  };

  const moveSectionDown = (key: SectionKey) => {
    setSectionOrder(prev => {
      const index = prev.indexOf(key);
      if (index < 0 || index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      localStorage.setItem('inbox_section_order', JSON.stringify(updated));
      return updated;
    });
  };

  const isSectionVisible = (key: SectionKey) => !hiddenSections[key];

  const getSectionOrder = (key: SectionKey) => sectionOrder.indexOf(key);

  return { hiddenSections, toggleSectionVisibility, isSectionVisible, sectionOrder, moveSectionUp, moveSectionDown, getSectionOrder };
};

// Props do modal
interface SectionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  hiddenSections: Record<SectionKey, boolean>;
  onToggle: (key: SectionKey) => void;
  sectionOrder: SectionKey[];
  onMoveUp: (key: SectionKey) => void;
  onMoveDown: (key: SectionKey) => void;
}

// Componente do Modal
export const SectionConfigModal: React.FC<SectionConfigModalProps> = ({
  isOpen,
  onClose,
  hiddenSections,
  onToggle,
  sectionOrder,
  onMoveUp,
  onMoveDown
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-600 to-slate-700">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-white">tune</span>
            <h3 className="font-bold text-white">Configurar Seções</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-4">Escolha quais seções exibir e arraste para reordenar:</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {sectionOrder.map((key, index) => (
              <div 
                key={key} 
                className={`flex items-center gap-2 p-2 rounded-lg border ${hiddenSections[key] ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => onMoveUp(key)}
                    disabled={index === 0}
                    className={`p-0.5 rounded ${index === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}
                    title="Mover para cima"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    onClick={() => onMoveDown(key)}
                    disabled={index === sectionOrder.length - 1}
                    className={`p-0.5 rounded ${index === sectionOrder.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}
                    title="Mover para baixo"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                  </button>
                </div>
                <span className="text-[10px] font-bold text-slate-300 w-5">{index + 1}º</span>
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hiddenSections[key]}
                    onChange={() => onToggle(key)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  <span className={`text-sm ${hiddenSections[key] ? 'text-slate-400' : 'text-slate-700'}`}>
                    {SECTION_LABELS[key]}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionConfigModal;
