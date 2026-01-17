import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Search,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Eye,
  UserCheck,
  Ban,
  Users,
  MessageSquare,
  Key
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Clinic {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  status: string;
  plan: string;
  created_at: string;
  users_count: number;
  chats_count: number;
}

const AdminClinics: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedClinicForPassword, setSelectedClinicForPassword] = useState<Clinic | null>(null);

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const { data: clinicsData, error } = await supabase
        .from('clinics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (clinicsData) {
        const clinicsWithCounts = await Promise.all(
          clinicsData.map(async (clinic) => {
            const [usersResult, chatsResult] = await Promise.all([
              supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinic.id),
              supabase
                .from('chats')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinic.id),
            ]);

            return {
              ...clinic,
              users_count: usersResult.count || 0,
              chats_count: chatsResult.count || 0,
            };
          })
        );

        setClinics(clinicsWithCounts);
      }
    } catch (error) {
      console.error('Error fetching clinics:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateClinicStatus = async (clinicId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', clinicId);

      if (error) throw error;

      setClinics(prev =>
        prev.map(c => (c.id === clinicId ? { ...c, status: newStatus } : c))
      );
      setActionMenuOpen(null);
    } catch (error) {
      console.error('Error updating clinic status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Ativo
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Suspenso
          </span>
        );
      default:
        return null;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-slate-100 text-slate-800',
      basic: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-cyan-100 text-cyan-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[plan] || colors.free}`}>
        {plan?.charAt(0).toUpperCase() + plan?.slice(1) || 'Free'}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredClinics = clinics.filter(clinic => {
    const matchesSearch = clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.slug.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || clinic.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Clínicas</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gerencie todas as clínicas cadastradas</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nova Clínica</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="pending">Pendentes</option>
            <option value="suspended">Suspensas</option>
          </select>
        </div>
      </div>

      {/* Clinics - Cards for mobile, Table for desktop */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Clínica
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Usuários
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Conversas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Criada em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma clínica encontrada
                  </td>
                </tr>
              ) : (
                filteredClinics.map((clinic) => (
                  <tr key={clinic.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{clinic.name}</div>
                          <div className="text-sm text-slate-500">{clinic.email || clinic.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(clinic.status)}
                    </td>
                    <td className="px-6 py-4">
                      {getPlanBadge(clinic.plan)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="w-4 h-4" />
                        {clinic.users_count}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <MessageSquare className="w-4 h-4" />
                        {clinic.chats_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(clinic.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === clinic.id ? null : clinic.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-slate-500" />
                        </button>
                        
                        {actionMenuOpen === clinic.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                            <Link
                              to={`/admin/clinics/${clinic.id}`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4" />
                              Ver detalhes
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedClinicForPassword(clinic);
                                setShowPasswordModal(true);
                                setActionMenuOpen(null);
                              }}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                            >
                              <Key className="w-4 h-4" />
                              Alterar Senha Admin
                            </button>
                            {clinic.status === 'pending' && (
                              <button
                                onClick={() => updateClinicStatus(clinic.id, 'active')}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50 w-full text-left"
                              >
                                <UserCheck className="w-4 h-4" />
                                Aprovar
                              </button>
                            )}
                            {clinic.status === 'active' && (
                              <button
                                onClick={() => updateClinicStatus(clinic.id, 'suspended')}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                              >
                                <Ban className="w-4 h-4" />
                                Suspender
                              </button>
                            )}
                            {clinic.status === 'suspended' && (
                              <button
                                onClick={() => updateClinicStatus(clinic.id, 'active')}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50 w-full text-left"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Reativar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-200">
          {filteredClinics.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500">
              Nenhuma clínica encontrada
            </div>
          ) : (
            filteredClinics.map((clinic) => (
              <div key={clinic.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{clinic.name}</div>
                      <div className="text-sm text-slate-500 truncate">{clinic.email || clinic.slug}</div>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setActionMenuOpen(actionMenuOpen === clinic.id ? null : clinic.id)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-slate-500" />
                    </button>
                    
                    {actionMenuOpen === clinic.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                        <Link
                          to={`/admin/clinics/${clinic.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="w-4 h-4" />
                          Ver detalhes
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedClinicForPassword(clinic);
                            setShowPasswordModal(true);
                            setActionMenuOpen(null);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                        >
                          <Key className="w-4 h-4" />
                          Alterar Senha
                        </button>
                        {clinic.status === 'pending' && (
                          <button
                            onClick={() => updateClinicStatus(clinic.id, 'active')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50 w-full text-left"
                          >
                            <UserCheck className="w-4 h-4" />
                            Aprovar
                          </button>
                        )}
                        {clinic.status === 'active' && (
                          <button
                            onClick={() => updateClinicStatus(clinic.id, 'suspended')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                          >
                            <Ban className="w-4 h-4" />
                            Suspender
                          </button>
                        )}
                        {clinic.status === 'suspended' && (
                          <button
                            onClick={() => updateClinicStatus(clinic.id, 'active')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50 w-full text-left"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Reativar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {getStatusBadge(clinic.status)}
                  {getPlanBadge(clinic.plan)}
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {clinic.users_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {clinic.chats_count}
                  </div>
                  <div className="text-slate-400">
                    {formatDate(clinic.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal - Simplified for now */}
      {showCreateModal && (
        <CreateClinicModal 
          onClose={() => setShowCreateModal(false)} 
          onCreated={() => {
            setShowCreateModal(false);
            fetchClinics();
          }}
        />
      )}

      {/* Password Modal */}
      {showPasswordModal && selectedClinicForPassword && (
        <ChangePasswordModal
          clinic={selectedClinicForPassword}
          onClose={() => {
            setShowPasswordModal(false);
            setSelectedClinicForPassword(null);
          }}
        />
      )}
    </div>
  );
};

interface CreateClinicModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateClinicModal: React.FC<CreateClinicModalProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Criar a clínica
      const { data: clinicData, error: insertError } = await supabase
        .from('clinics')
        .insert({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          email: formData.email || null,
          phone: formData.phone || null,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Criar o usuário admin se os campos foram preenchidos
      if (formData.adminName && formData.adminEmail && formData.adminPassword) {
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
            name: formData.adminName,
            email: formData.adminEmail,
            password: formData.adminPassword,
            role: 'Admin',
            clinic_id: clinicData.id,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Se falhar ao criar usuário, deletar a clínica criada
          await supabase.from('clinics').delete().eq('id', clinicData.id);
          throw new Error(result.error || 'Erro ao criar usuário administrador');
        }
      }

      onCreated();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar clínica');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Nova Clínica</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Cadastre uma nova clínica no sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome da Clínica *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="Ex: Clínica Odontológica Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slug (URL) *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="clinica-silva"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                placeholder="contato@clinica.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Usuário Administrador</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome do Admin *
                </label>
                <input
                  type="text"
                  required
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  placeholder="Nome completo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email do Admin *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="admin@clinica.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm order-2 sm:order-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 text-sm order-1 sm:order-2"
            >
              {loading ? 'Criando...' : 'Criar Clínica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ChangePasswordModalProps {
  clinic: Clinic;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ clinic, onClose }) => {
  const [adminUsers, setAdminUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newUserName, setNewUserName] = useState(clinic.name ? `Admin ${clinic.name}` : '');
  const [newUserEmail, setNewUserEmail] = useState(clinic.email || '');

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setAdminUsers(data || []);
      if (data && data.length > 0) {
        setSelectedUserId(data[0].id);
      } else {
        setIsCreatingNew(true);
      }
    } catch (err: any) {
      setError('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreatingNew) {
      if (!newUserName || !newUserEmail || !newPassword) {
        setError('Preencha todos os campos');
        return;
      }
    } else {
      if (!selectedUserId || !newPassword) {
        setError('Selecione um usuário e informe a nova senha');
        return;
      }
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      if (isCreatingNew) {
        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            name: newUserName,
            email: newUserEmail,
            password: newPassword,
            role: 'Admin',
            clinic_id: clinic.id,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário');
        }

        setSuccess('Usuário admin criado com sucesso!');
      } else {
        const response = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            user_id: selectedUserId,
            new_password: newPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar senha');
        }

        setSuccess('Senha atualizada com sucesso!');
      }

      setNewPassword('');
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {isCreatingNew ? 'Criar Usuário Admin' : 'Alterar Senha'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{clinic.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {loadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
            </div>
          ) : isCreatingNew ? (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                Esta clínica não possui usuários. Crie um administrador abaixo.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome do Admin *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="admin@clinica.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Usuário
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nova Senha *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingUsers}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : (isCreatingNew ? 'Criar Admin' : 'Alterar Senha')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminClinics;
