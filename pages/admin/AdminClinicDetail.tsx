import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  ArrowLeft,
  Users,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  LogIn,
  Edit,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface ClinicDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  plan: string;
  max_users: number;
  can_create_users: boolean;
  created_at: string;
  updated_at: string;
}

interface ClinicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface ClinicStats {
  users_count: number;
  chats_count: number;
  messages_count: number;
  leads_count: number;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  status: string;
  phone_number: string | null;
  connected_at: string | null;
  is_shared: boolean;
  user_id: string | null;
}

const AdminClinicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [stats, setStats] = useState<ClinicStats>({ users_count: 0, chats_count: 0, messages_count: 0, leads_count: 0 });
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Atendente' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchClinicDetails();
    }
  }, [id]);

  const fetchClinicDetails = async () => {
    try {
      // Buscar clínica
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .single();

      if (clinicError) throw clinicError;
      setClinic(clinicData);

      // Buscar usuários da clínica
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, role, status, created_at')
        .eq('clinic_id', id)
        .order('created_at', { ascending: false });

      setUsers(usersData || []);

      // Buscar estatísticas
      const [usersCount, chatsCount, messagesCount, leadsCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('chats').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .in('chat_id', (await supabase.from('chats').select('id').eq('clinic_id', id)).data?.map(c => c.id) || []),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('clinic_id', id),
      ]);

      setStats({
        users_count: usersCount.count || 0,
        chats_count: chatsCount.count || 0,
        messages_count: messagesCount.count || 0,
        leads_count: leadsCount.count || 0,
      });

      // Buscar instâncias WhatsApp
      const { data: instancesData } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, display_name, status, phone_number, connected_at, is_shared, user_id')
        .eq('clinic_id', id)
        .order('created_at', { ascending: true });

      setWhatsappInstances(instancesData || []);

    } catch (error) {
      console.error('Error fetching clinic details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!clinic || !user) return;
    
    setImpersonating(true);
    
    try {
      // Registrar log de acesso
      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'impersonate',
        details: { clinic_name: clinic.name },
      });

      // Usar a função do useAuth para iniciar impersonate
      const { startImpersonate } = await import('../../hooks/useAuth').then(m => {
        // Precisamos chamar via contexto, então vamos usar sessionStorage
        return { startImpersonate: () => {} };
      });

      // Salvar dados do impersonate no sessionStorage
      sessionStorage.setItem('impersonateClinic', JSON.stringify({
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug || '',
        logoUrl: null,
      }));

      // Redirecionar para o dashboard
      navigate('/dashboard');
      
      // Forçar reload para aplicar o novo contexto
      window.location.reload();
      
    } catch (error) {
      console.error('Error impersonating:', error);
      setImpersonating(false);
    }
  };

  const updateClinicStatus = async (newStatus: string) => {
    if (!clinic || !user) return;

    try {
      const { error } = await supabase
        .from('clinics')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      // Registrar log
      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: newStatus === 'active' ? 'approve' : 'suspend',
        details: { previous_status: clinic.status, new_status: newStatus },
      });

      setClinic({ ...clinic, status: newStatus });
    } catch (error) {
      console.error('Error updating clinic status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Ativo
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pendente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Suspenso
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreateUser = async () => {
    if (!clinic || !newUser.name || !newUser.email || !newUser.password) {
      setCreateUserError('Preencha todos os campos');
      return;
    }

    setCreatingUser(true);
    setCreateUserError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
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

      setShowCreateUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'Atendente' });
      fetchClinicDetails();
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  const toggleCanCreateUsers = async () => {
    if (!clinic || !user) return;

    try {
      const newValue = !clinic.can_create_users;
      
      const { error } = await supabase
        .from('clinics')
        .update({ can_create_users: newValue, updated_at: new Date().toISOString() })
        .eq('id', clinic.id);

      if (error) throw error;

      await supabase.from('admin_access_logs').insert({
        super_admin_id: user.id,
        clinic_id: clinic.id,
        action: 'edit',
        details: { field: 'can_create_users', old_value: clinic.can_create_users, new_value: newValue },
      });

      setClinic({ ...clinic, can_create_users: newValue });
    } catch (error) {
      console.error('Error updating can_create_users:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Clínica não encontrada</p>
          <Link to="/admin/clinics" className="text-cyan-600 hover:text-cyan-700 mt-2 inline-block">
            Voltar para lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/clinics" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para clínicas
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{clinic.name}</h1>
              <p className="text-slate-500">{clinic.slug}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(clinic.status)}
            
            <button
              onClick={handleImpersonate}
              disabled={impersonating || clinic.status !== 'active'}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              {impersonating ? 'Entrando...' : 'Logar como cliente'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.users_count}</p>
              <p className="text-sm text-slate-500">Usuários</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.chats_count}</p>
              <p className="text-sm text-slate-500">Conversas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.messages_count}</p>
              <p className="text-sm text-slate-500">Mensagens</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.leads_count}</p>
              <p className="text-sm text-slate-500">Leads</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Informações</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Edit className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{clinic.email || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{clinic.phone || '-'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Plano</p>
                  <span className="text-slate-800 capitalize">{clinic.plan || 'Free'}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Máx. Usuários</p>
                  <span className="text-slate-800">{clinic.max_users}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Criada em</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-800">{formatDate(clinic.created_at)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Última atualização</p>
                  <span className="text-slate-800">{formatDate(clinic.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Usuários ({users.length}/{clinic.max_users})</h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Criar Usuário
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {users.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Nenhum usuário cadastrado
                </div>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.name}</p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {u.role}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* WhatsApp Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              WhatsApp ({whatsappInstances.length})
            </h2>
            {whatsappInstances.length > 0 ? (
              <div className="space-y-3">
                {whatsappInstances.map((instance) => (
                  <div key={instance.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {instance.status === 'connected' ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          instance.status === 'connected' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        instance.is_shared ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {instance.is_shared ? 'Compartilhada' : 'Pessoal'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {instance.display_name || instance.phone_number || 'Sem nome'}
                    </p>
                    {instance.phone_number && (
                      <p className="text-xs text-slate-500 mt-1">
                        <Phone className="w-3 h-3 inline mr-1" />
                        {instance.phone_number}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Nenhuma instância configurada</p>
            )}
          </div>

          {/* Permissões */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Permissões</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">Criar usuários</p>
                  <p className="text-sm text-slate-500">Permitir que a clínica crie seus próprios usuários</p>
                </div>
                <button
                  onClick={toggleCanCreateUsers}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    clinic.can_create_users ? 'bg-cyan-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      clinic.can_create_users ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Ações</h2>
            <div className="space-y-3">
              {clinic.status === 'pending' && (
                <button
                  onClick={() => updateClinicStatus('active')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Aprovar Clínica
                </button>
              )}
              {clinic.status === 'active' && (
                <button
                  onClick={() => updateClinicStatus('suspended')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  Suspender Clínica
                </button>
              )}
              {clinic.status === 'suspended' && (
                <button
                  onClick={() => updateClinicStatus('active')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Reativar Clínica
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Criar Usuário */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateUserModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Criar Usuário</h3>
              <p className="text-sm text-slate-500 mt-1">Adicionar novo usuário à clínica {clinic.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              {createUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {createUserError}
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                <input 
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Ex: Maria Silva"
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                <input 
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="maria@email.com"
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha Temporária</label>
                <input 
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfil</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full mt-2 h-11 rounded-lg border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4 text-sm"
                >
                  <option value="Atendente">Atendente</option>
                  <option value="Admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                  setShowCreateUserModal(false);
                  setNewUser({ name: '', email: '', password: '', role: 'Atendente' });
                  setCreateUserError(null);
                }}
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

export default AdminClinicDetail;
