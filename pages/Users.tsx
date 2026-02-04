
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { hasPermission, getRoleDescription, ROLE_PERMISSIONS, UserRole } from '../lib/permissions';

interface UsersProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  status: string;
}

const Users: React.FC<UsersProps> = ({ state, setState }) => {
  const { users, loading, updateUserStatus, updateUserRole, refetch } = useUsers();
  const { clinic, user, isImpersonating, impersonatedClinic } = useAuth();
  // Usar clinicId do impersonate se estiver ativo
  const clinicId = isImpersonating ? impersonatedClinic?.id : (clinic?.id || user?.clinicId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Comercial', default_instance_id: '' });
  const [canCreateUsers, setCanCreateUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);

  const canCreateUser = hasPermission(user?.role, 'create_user');
  const canEditUser = hasPermission(user?.role, 'edit_user');
  const canChangeRole = hasPermission(user?.role, 'change_role');
  const canChangeStatus = hasPermission(user?.role, 'change_status');
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!clinicId) return;
      
      const { data } = await supabase
        .from('clinics')
        .select('can_create_users')
        .eq('id', clinicId)
        .single();
      
      setCanCreateUsers(data?.can_create_users || false);
    };
    
    checkPermission();
  }, [clinicId]);

  // Buscar instâncias WhatsApp da clínica
  useEffect(() => {
    const fetchInstances = async () => {
      if (!clinicId) return;
      
      const { data } = await supabase
        .from('whatsapp_instances' as any)
        .select('id, instance_name, display_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected');
      
      setWhatsappInstances((data || []) as WhatsAppInstance[]);
    };
    
    fetchInstances();
  }, [clinicId]);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !clinicId) {
      setCreateUserError('Preencha todos os campos');
      return;
    }

    setCreatingUser(true);
    setCreateUserError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          clinic_id: clinicId,
          default_instance_id: newUser.default_instance_id || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      setIsModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'Comercial', default_instance_id: '' });
      refetch?.();
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="p-3 sm:p-8">
      <div className="space-y-4 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">Gestão de Equipe</h1>
            <p className="text-xs sm:text-base text-slate-500">Gerencie o acesso e permissões.</p>
          </div>
          {canCreateUser && canCreateUsers && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-9 sm:h-11 px-4 sm:px-6 rounded-lg sm:rounded-xl shadow-lg shadow-cyan-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">person_add</span>
              <span className="hidden sm:inline">Criar Usuário</span>
              <span className="sm:hidden">Criar</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-4">
             <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px] sm:text-[20px]">search</span>
                <input type="text" placeholder="Filtrar..." className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-50 border-none rounded-lg sm:rounded-xl text-sm" />
             </div>
             <select className="bg-slate-50 border-none rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-0 hidden sm:block">
                <option>Todas as Clínicas</option>
                {state.clinics.map(c => <option key={c.id}>{c.name}</option>)}
             </select>
          </div>

          {/* Mobile: Cards Expansíveis */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto mb-2"></div>
                <p className="text-xs text-slate-500">Carregando...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                Nenhum usuário encontrado
              </div>
            ) : users.map(usr => (
              <div key={usr.id} className="bg-white">
                {/* Header do Card - Sempre visível */}
                <button
                  onClick={() => setExpandedUserId(expandedUserId === usr.id ? null : usr.id)}
                  className="w-full p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <img src={usr.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.name)}&background=0891b2&color=fff`} className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">{usr.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${usr.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                        <span 
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            usr.role === 'Admin' ? 'bg-purple-50 text-purple-700' : 
                            usr.role === 'Gerente' ? 'bg-blue-50 text-blue-700' :
                            usr.role === 'Supervisor' ? 'bg-indigo-50 text-indigo-700' :
                            usr.role === 'Financeiro' ? 'bg-amber-50 text-amber-700' :
                            usr.role === 'Visualizador' ? 'bg-slate-100 text-slate-700' :
                            'bg-cyan-50 text-cyan-700'
                          }`}
                        >
                          {usr.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform ${expandedUserId === usr.id ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Conteúdo Expandido */}
                {expandedUserId === usr.id && (
                  <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Informações */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">mail</span>
                        <span className="text-xs text-slate-600 truncate">{usr.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">business</span>
                        <span className="text-xs text-slate-600">{clinic?.name || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">info</span>
                        <span className="text-xs text-slate-500">{getRoleDescription(usr.role)}</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      {canChangeStatus && (
                        <button 
                          onClick={() => updateUserStatus(usr.id, usr.status === 'Ativo' ? 'Inativo' : 'Ativo')}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${
                            usr.status === 'Ativo' 
                              ? 'bg-red-50 text-red-600 border border-red-200' 
                              : 'bg-green-50 text-green-600 border border-green-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{usr.status === 'Ativo' ? 'person_off' : 'person'}</span>
                          {usr.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                      {canChangeRole && (
                        <button 
                          onClick={() => {
                            setEditingUserId(usr.id);
                            setEditingRole(usr.role);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200"
                        >
                          <span className="material-symbols-outlined text-[16px]">badge</span>
                          Alterar Perfil
                        </button>
                      )}
                      {canEditUser && (
                        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-4 lg:px-6 py-3 lg:py-4">Usuário</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 hidden lg:table-cell">Clínica</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4">Perfil</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4">Status</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-2"></div>
                      <p className="text-sm text-slate-500">Carregando usuários...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : users.map(user => (
                  <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0891b2&color=fff`} className="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
                        <div>
                          <p className="text-xs lg:text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                          <p className="text-[10px] lg:text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4 hidden lg:table-cell">
                       <span className="text-xs font-bold text-slate-600">{clinic?.name || '-'}</span>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                       {editingUserId === user.id && canChangeRole ? (
                         <select
                           value={editingRole}
                           onChange={(e) => setEditingRole(e.target.value)}
                           className="h-7 lg:h-8 text-[10px] lg:text-xs rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-1.5 lg:px-2"
                         >
                           {Object.keys(ROLE_PERMISSIONS).filter(r => r !== 'SuperAdmin').map(role => (
                             <option key={role} value={role}>{role}</option>
                           ))}
                         </select>
                       ) : (
                         <span 
                           className={`px-1.5 lg:px-2 py-0.5 rounded-full text-[9px] lg:text-[10px] font-black border uppercase tracking-tighter cursor-help ${
                             user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                             user.role === 'Gerente' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                             user.role === 'Supervisor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                             user.role === 'Financeiro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                             user.role === 'Visualizador' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                             'bg-cyan-50 text-cyan-700 border-cyan-200'
                           }`}
                           title={getRoleDescription(user.role)}
                         >
                           {user.role}
                         </span>
                       )}
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                       <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Ativo' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                          <span className="text-[10px] lg:text-xs font-bold text-slate-700">{user.status}</span>
                       </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4 text-right">
                       <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingUserId === user.id ? (
                            <>
                              <button 
                                onClick={async () => {
                                  if (editingRole !== user.role) {
                                    await updateUserRole(user.id, editingRole);
                                  }
                                  setEditingUserId(null);
                                }}
                                className="p-1 lg:p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
                                title="Salvar"
                              >
                                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">check</span>
                              </button>
                              <button 
                                onClick={() => setEditingUserId(null)}
                                className="p-1 lg:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                                title="Cancelar"
                              >
                                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">close</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {canChangeStatus && (
                                <button 
                                  onClick={() => updateUserStatus(user.id, user.status === 'Ativo' ? 'Inativo' : 'Ativo')}
                                  className="p-1 lg:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                                  title={user.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                                >
                                  <span className="material-symbols-outlined text-[16px] lg:text-[18px]">{user.status === 'Ativo' ? 'person_off' : 'person'}</span>
                                </button>
                              )}
                              {canChangeRole && (
                                <button 
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditingRole(user.role);
                                  }}
                                  className="p-1 lg:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                                  title="Alterar perfil"
                                >
                                  <span className="material-symbols-outlined text-[16px] lg:text-[18px]">badge</span>
                                </button>
                              )}
                              {canEditUser && (
                                <button className="p-1 lg:p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Editar">
                                  <span className="material-symbols-outlined text-[16px] lg:text-[18px]">edit</span>
                                </button>
                              )}
                            </>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 sm:p-6 border-t border-slate-50 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
             <span>Mostrando {users.length} de {users.length}</span>
             <div className="flex gap-1">
                <button className="px-2 sm:px-3 py-1 bg-cyan-600 text-white font-bold rounded text-[10px] sm:text-xs">1</button>
             </div>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <header className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
              <h3 className="text-base sm:text-xl font-black text-slate-900">Novo Usuário</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                 <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
              </button>
            </header>
            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
               {createUserError && (
                 <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-700">
                   {createUserError}
                 </div>
               )}
               <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    type="text" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Ex: Maria Souza" 
                    className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-3 sm:px-4 text-sm"
                  />
               </div>
               <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="maria@clinica.com" 
                    className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-3 sm:px-4 text-sm"
                  />
               </div>
               <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Senha Temporária</label>
                  <input 
                    type="text" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres" 
                    className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-3 sm:px-4 text-sm"
                  />
               </div>
               <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Perfil</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-3 sm:px-4 text-sm font-medium"
                  >
                     <option value="Admin">Administrador</option>
                     <option value="Gerente">Gerente</option>
                     <option value="Supervisor">Supervisor</option>
                     <option value="Comercial">Comercial</option>
                     <option value="Recepcionista">Recepcionista</option>
                     <option value="Financeiro">Financeiro</option>
                     <option value="Visualizador">Visualizador</option>
                  </select>
               </div>
               {whatsappInstances.length > 0 && (
                 <div className="space-y-1 sm:space-y-1.5">
                    <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Instância WhatsApp</label>
                    <select 
                      value={newUser.default_instance_id}
                      onChange={(e) => setNewUser({...newUser, default_instance_id: e.target.value})}
                      className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-3 sm:px-4 text-sm font-medium"
                    >
                       <option value="">Selecione uma instância</option>
                       {whatsappInstances.map(instance => (
                         <option key={instance.id} value={instance.id}>
                           {instance.display_name || instance.instance_name}
                         </option>
                       ))}
                    </select>
                    <p className="text-[10px] sm:text-xs text-slate-400">Opcional - sem instância só visualiza</p>
                 </div>
               )}
            </div>
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
               <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setNewUser({ name: '', email: '', password: '', role: 'Comercial', default_instance_id: '' });
                  setCreateUserError(null);
                }}
                className="flex-1 h-10 sm:h-12 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg sm:rounded-xl hover:bg-slate-50 transition-all text-xs sm:text-sm"
              >
                Cancelar
               </button>
               <button 
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 h-10 sm:h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg sm:rounded-xl shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {creatingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Criando...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Criar Usuário</span>
                    <span className="sm:hidden">Criar</span>
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

export default Users;
