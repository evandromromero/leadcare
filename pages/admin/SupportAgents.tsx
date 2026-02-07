import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  HeadphonesIcon,
  Plus,
  Edit,
  Trash2,
  Mail,
  Calendar,
  Shield,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SupportAgent {
  id: string;
  name: string;
  email: string;
  created_at: string;
  status: string;
}

const SupportAgents: React.FC = () => {
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SupportAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, created_at, status')
        .eq('role', 'Suporte')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (agent: SupportAgent) => {
    setSelectedAgent(agent);
    setFormName(agent.name);
    setFormEmail(agent.email);
    setFormPassword('');
    setFormError('');
    setShowEditModal(true);
  };

  const openDeleteConfirm = (agent: SupportAgent) => {
    setSelectedAgent(agent);
    setShowDeleteConfirm(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setFormError('Preencha todos os campos');
      return;
    }

    if (formPassword.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: {
          data: {
            name: formName,
            role: 'Suporte'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atualizar registro na tabela users (trigger já cria o registro)
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            name: formName,
            email: formEmail,
            role: 'Suporte',
            status: 'Ativo',
            clinic_id: null
          }, { onConflict: 'id' });

        if (userError) throw userError;
      }

      setShowCreateModal(false);
      fetchAgents();
    } catch (error: any) {
      console.error('Error creating agent:', error);
      setFormError(error.message || 'Erro ao criar agente');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAgent || !formName.trim() || !formEmail.trim()) {
      setFormError('Preencha todos os campos');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formName,
          email: formEmail
        })
        .eq('id', selectedAgent.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedAgent(null);
      fetchAgents();
    } catch (error: any) {
      console.error('Error updating agent:', error);
      setFormError(error.message || 'Erro ao atualizar agente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;

    setDeleting(true);

    try {
      // Deletar da tabela users
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedAgent.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setSelectedAgent(null);
      fetchAgents();
    } catch (error: any) {
      console.error('Error deleting agent:', error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (agent: SupportAgent) => {
    const newStatus = agent.status === 'Ativo' ? 'Inativo' : 'Ativo';
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', agent.id);

      if (error) throw error;
      fetchAgents();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

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
                  <HeadphonesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-800">Agentes de Suporte</h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Gerenciar equipe de atendimento</p>
                </div>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Agente</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <HeadphonesIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">Nenhum agente de suporte</h3>
              <p className="text-sm text-slate-500 mb-4">Crie o primeiro agente para começar</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Criar Agente
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table (lg+) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Agente</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Criado em</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{agent.name}</p>
                              <p className="text-xs text-slate-500">Agente de Suporte</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {agent.email}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => toggleStatus(agent)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              agent.status === 'Ativo'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {agent.status}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 text-slate-600 text-sm">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(agent.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(agent)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(agent)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Cards */}
              <div className="lg:hidden divide-y divide-slate-100">
                {agents.map((agent) => (
                  <div key={agent.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{agent.name}</p>
                          <p className="text-xs text-slate-500">{agent.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleStatus(agent)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          agent.status === 'Ativo'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {agent.status}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Criado em {new Date(agent.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(agent)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(agent)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Novo Agente de Suporte</h2>
              <p className="text-sm text-slate-500 mt-1">Preencha os dados do novo agente</p>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do agente"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Criando...
                  </>
                ) : (
                  'Criar Agente'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Editar Agente</h2>
              <p className="text-sm text-slate-500 mt-1">Atualize os dados do agente</p>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do agente"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAgent(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 text-center mb-2">Excluir Agente</h2>
              <p className="text-sm text-slate-500 text-center">
                Tem certeza que deseja excluir <strong>{selectedAgent.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedAgent(null);
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

export default SupportAgents;
