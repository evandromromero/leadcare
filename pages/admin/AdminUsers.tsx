import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Users,
  Plus,
  Edit,
  Trash2,
  Mail,
  Calendar,
  Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  status: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, created_at, status')
        .eq('role', 'SuperAdmin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const openEditModal = (user: SuperAdminUser) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormError('');
    setShowEditModal(true);
  };

  const openDeleteConfirm = (user: SuperAdminUser) => {
    setSelectedUser(user);
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
            role: 'SuperAdmin'
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
            role: 'SuperAdmin',
            status: 'Ativo',
            clinic_id: null
          }, { onConflict: 'id' });

        if (userError) throw userError;
      }

      setShowCreateModal(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      setFormError(error.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser || !formName.trim() || !formEmail.trim()) {
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
        .eq('id', selectedUser.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      setFormError(error.message || 'Erro ao atualizar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setDeleting(true);

    try {
      // Deletar da tabela users
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
    } finally {
      setDeleting(false);
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
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-800">SuperAdmins</h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Gerenciar usuários administradores</p>
                </div>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo SuperAdmin</span>
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
          ) : users.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">Nenhum SuperAdmin encontrado</h3>
              <p className="text-sm text-slate-500 mb-4">Crie o primeiro SuperAdmin para começar</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Criar SuperAdmin
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                      <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Criado em</th>
                      <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{user.name}</p>
                              <p className="text-xs text-violet-600 font-medium">SuperAdmin</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {user.email}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.status === 'Ativo' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                            <Calendar className="w-4 h-4" />
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(user)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-500 hover:text-red-600"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {users.map(user => (
                  <div key={user.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(user)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-500"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 ml-13">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        user.status === 'Ativo' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.status}
                      </span>
                      <span className="text-xs text-violet-600 font-medium">SuperAdmin</span>
                      <span className="text-xs text-slate-400">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal Criar */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-600" />
                Novo SuperAdmin
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Preencha os dados do novo administrador</p>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  placeholder="Nome completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 h-10 sm:h-11 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  'Criar SuperAdmin'
                )}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="sm:flex-none sm:px-6 h-10 sm:h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-violet-600" />
                Editar SuperAdmin
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Altere os dados do administrador</p>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  placeholder="Nome completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 h-10 sm:h-11 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
              <button
                onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                className="sm:flex-none sm:px-6 h-10 sm:h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir SuperAdmin</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja excluir <strong>{selectedUser.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setSelectedUser(null); }}
                className="flex-1 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
