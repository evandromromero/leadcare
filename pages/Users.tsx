
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface UsersProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Users: React.FC<UsersProps> = ({ state, setState }) => {
  const { users, loading, updateUserStatus, updateUserRole, refetch } = useUsers();
  const { clinic, user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Atendente' });
  const [canCreateUsers, setCanCreateUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  useEffect(() => {
    const checkPermission = async () => {
      if (!clinic?.id) return;
      
      const { data } = await supabase
        .from('clinics')
        .select('can_create_users')
        .eq('id', clinic.id)
        .single();
      
      setCanCreateUsers(data?.can_create_users || false);
    };
    
    checkPermission();
  }, [clinic?.id]);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !clinic?.id) {
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
          clinic_id: clinic.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      setIsModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'Atendente' });
      refetch?.();
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="p-8">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Equipe</h1>
            <p className="text-slate-500">Gerencie o acesso e permissões dos membros da sua clínica.</p>
          </div>
          {isAdmin && canCreateUsers && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-cyan-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span> Criar Usuário
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-4">
             <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
                <input type="text" placeholder="Filtrar por nome ou email..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm" />
             </div>
             <select className="bg-slate-50 border-none rounded-xl text-sm font-medium px-4">
                <option>Todas as Clínicas</option>
                {state.clinics.map(c => <option key={c.id}>{c.name}</option>)}
             </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Clínica</th>
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0891b2&color=fff`} className="size-10 rounded-full" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-bold text-slate-600">{clinic?.name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-tighter ${
                         user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                       }`}>
                         {user.role}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1.5">
                          <div className={`size-1.5 rounded-full ${user.status === 'Ativo' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                          <span className="text-xs font-bold text-slate-700">{user.status}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => updateUserStatus(user.id, user.status === 'Ativo' ? 'Inativo' : 'Ativo')}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                            title={user.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                          >
                            <span className="material-symbols-outlined text-[20px]">{user.status === 'Ativo' ? 'person_off' : 'person'}</span>
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
             <span>Mostrando {users.length} de {users.length} usuários</span>
             <div className="flex gap-1">
                <button className="px-3 py-1 bg-cyan-600 text-white font-bold rounded">1</button>
             </div>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900">Novo Usuário</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                 <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-8 space-y-6">
               {createUserError && (
                 <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                   {createUserError}
                 </div>
               )}
               <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    type="text" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Ex: Maria Souza" 
                    className="w-full h-12 rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-4 text-sm"
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="maria@clinica.com" 
                    className="w-full h-12 rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-4 text-sm"
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Senha Temporária</label>
                  <input 
                    type="text" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres" 
                    className="w-full h-12 rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-4 text-sm"
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Perfil</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full h-12 rounded-xl border-slate-200 focus:ring-cyan-600 focus:border-cyan-600 px-4 text-sm font-medium"
                  >
                     <option value="Atendente">Atendente</option>
                     <option value="Admin">Administrador</option>
                  </select>
               </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 flex gap-3">
               <button 
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingUser ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
               </button>
               <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setNewUser({ name: '', email: '', password: '', role: 'Atendente' });
                  setCreateUserError(null);
                }}
                className="flex-1 h-12 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all"
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

export default Users;
