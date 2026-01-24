import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const db = supabase as any;

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
}

interface QuickRepliesProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  greeting: { label: 'Saudações', icon: 'waving_hand', color: 'yellow' },
  closing: { label: 'Encerramentos', icon: 'check_circle', color: 'green' },
  info: { label: 'Informações', icon: 'info', color: 'blue' },
  problem: { label: 'Problemas', icon: 'build', color: 'orange' },
  general: { label: 'Gerais', icon: 'chat', color: 'slate' },
};

const QuickReplies: React.FC<QuickRepliesProps> = ({ onSelect, onClose }) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('greeting');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchReplies = async () => {
      const { data, error } = await db
        .from('support_quick_replies')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setReplies(data as QuickReply[]);
      }
      setLoading(false);
    };

    fetchReplies();
  }, []);

  const filteredReplies = replies.filter((reply) => {
    const matchesCategory = activeCategory === 'all' || reply.category === activeCategory;
    const matchesSearch = searchTerm === '' || 
      reply.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reply.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reply.shortcut && reply.shortcut.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ['greeting', 'info', 'problem', 'closing', 'general'];

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-200 w-80 sm:w-96 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-600">bolt</span>
          <span className="font-medium text-slate-700">Mensagens Rápidas</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
        </button>
      </div>

      {/* Busca */}
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar ou digitar atalho..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Categorias */}
      <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
        {categories.map((cat) => {
          const info = CATEGORY_LABELS[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? `bg-${info.color}-100 text-${info.color}-700 font-medium`
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{info.icon}</span>
              {info.label}
            </button>
          );
        })}
      </div>

      {/* Lista de Mensagens */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
          </div>
        ) : filteredReplies.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
            <p className="text-sm">Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          filteredReplies.map((reply) => (
            <button
              key={reply.id}
              onClick={() => {
                onSelect(reply.content);
                onClose();
              }}
              className="w-full p-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-700 text-sm">{reply.title}</span>
                {reply.shortcut && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                    {reply.shortcut}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{reply.content}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default QuickReplies;
