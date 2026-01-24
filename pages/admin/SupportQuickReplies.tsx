import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Search,
  GripVertical
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const db = supabase as any;

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: 'greeting', label: 'Saudações', icon: 'waving_hand', color: 'yellow' },
  { value: 'closing', label: 'Encerramentos', icon: 'check_circle', color: 'green' },
  { value: 'info', label: 'Informações', icon: 'info', color: 'blue' },
  { value: 'problem', label: 'Problemas', icon: 'build', color: 'orange' },
  { value: 'general', label: 'Gerais', icon: 'chat', color: 'slate' },
];

const getCategoryInfo = (category: string) => {
  return CATEGORY_OPTIONS.find(c => c.value === category) || CATEGORY_OPTIONS[4];
};

const SupportQuickReplies: React.FC = () => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedReply, setSelectedReply] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formShortcut, setFormShortcut] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from('support_quick_replies')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedReply(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('general');
    setFormShortcut('');
    setFormIsActive(true);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (reply: QuickReply) => {
    setSelectedReply(reply);
    setFormTitle(reply.title);
    setFormContent(reply.content);
    setFormCategory(reply.category);
    setFormShortcut(reply.shortcut || '');
    setFormIsActive(reply.is_active);
    setFormError('');
    setShowModal(true);
  };

  const openDeleteConfirm = (reply: QuickReply) => {
    setSelectedReply(reply);
    setShowDeleteConfirm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      setFormError('Preencha título e conteúdo');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (selectedReply) {
        // Editar
        const { error } = await db
          .from('support_quick_replies')
          .update({
            title: formTitle,
            content: formContent,
            category: formCategory,
            shortcut: formShortcut || null,
            is_active: formIsActive,
          })
          .eq('id', selectedReply.id);

        if (error) throw error;
      } else {
        // Criar
        const maxOrder = replies.length > 0 ? Math.max(...replies.map(r => r.sort_order)) + 1 : 0;
        
        const { error } = await db
          .from('support_quick_replies')
          .insert({
            title: formTitle,
            content: formContent,
            category: formCategory,
            shortcut: formShortcut || null,
            is_active: formIsActive,
            sort_order: maxOrder,
          });

        if (error) throw error;
      }

      setShowModal(false);
      setSelectedReply(null);
      fetchReplies();
    } catch (error: any) {
      console.error('Error saving reply:', error);
      setFormError(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReply) return;

    setDeleting(true);

    try {
      const { error } = await db
        .from('support_quick_replies')
        .delete()
        .eq('id', selectedReply.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setSelectedReply(null);
      fetchReplies();
    } catch (error: any) {
      console.error('Error deleting reply:', error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (reply: QuickReply) => {
    try {
      const { error } = await db
        .from('support_quick_replies')
        .update({ is_active: !reply.is_active })
        .eq('id', reply.id);

      if (error) throw error;
      fetchReplies();
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  };

  const filteredReplies = replies.filter(reply => {
    const matchesSearch = reply.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          reply.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || reply.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link 
                to="/admin" 
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-800">Mensagens Rápidas</h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Gerenciar respostas do suporte</p>
                </div>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Mensagem</span>
              <span className="sm:hidden">Nova</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar mensagens..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterCategory === 'all'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas ({replies.length})
              </button>
              {CATEGORY_OPTIONS.map(cat => {
                const count = replies.filter(r => r.category === cat.value).length;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setFilterCategory(cat.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      filterCategory === cat.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                    <span className="hidden sm:inline">{cat.label}</span>
                    <span className="text-xs opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">
                {searchTerm || filterCategory !== 'all' ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem rápida'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {searchTerm || filterCategory !== 'all' ? 'Tente ajustar os filtros' : 'Crie a primeira mensagem rápida'}
              </p>
              {!searchTerm && filterCategory === 'all' && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Criar Mensagem
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredReplies.map((reply) => {
                const catInfo = getCategoryInfo(reply.category);
                return (
                  <div key={reply.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="hidden sm:flex items-center justify-center w-8 h-8 text-slate-300 cursor-grab">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-800 truncate">{reply.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${catInfo.color}-100 text-${catInfo.color}-700`}>
                            {catInfo.label}
                          </span>
                          {reply.shortcut && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono">
                              /{reply.shortcut}
                            </span>
                          )}
                          {!reply.is_active && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{reply.content}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleActive(reply)}
                          className={`p-2 rounded-lg transition-colors ${
                            reply.is_active
                              ? 'hover:bg-green-50 text-green-600'
                              : 'hover:bg-slate-100 text-slate-400'
                          }`}
                          title={reply.is_active ? 'Desativar' : 'Ativar'}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {reply.is_active ? 'toggle_on' : 'toggle_off'}
                          </span>
                        </button>
                        <button
                          onClick={() => openEditModal(reply)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(reply)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                {selectedReply ? 'Editar Mensagem' : 'Nova Mensagem Rápida'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {selectedReply ? 'Atualize os dados da mensagem' : 'Preencha os dados da nova mensagem'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Boas-vindas"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Digite o conteúdo da mensagem..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {CATEGORY_OPTIONS.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Atalho</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">/</span>
                    <input
                      type="text"
                      value={formShortcut}
                      onChange={(e) => setFormShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      placeholder="atalho"
                      className="w-full pl-7 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formIsActive ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      formIsActive ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700">
                  {formIsActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedReply(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  selectedReply ? 'Salvar' : 'Criar Mensagem'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedReply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 text-center mb-2">Excluir Mensagem</h2>
              <p className="text-sm text-slate-500 text-center">
                Tem certeza que deseja excluir <strong>"{selectedReply.title}"</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedReply(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportQuickReplies;
