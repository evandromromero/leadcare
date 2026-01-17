import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  MessageSquare, 
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalClinics: number;
  activeClinics: number;
  pendingClinics: number;
  suspendedClinics: number;
  totalUsers: number;
  totalChats: number;
  totalMessages: number;
}

interface RecentClinic {
  id: string;
  name: string;
  status: string;
  created_at: string;
  users_count: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalClinics: 0,
    activeClinics: 0,
    pendingClinics: 0,
    suspendedClinics: 0,
    totalUsers: 0,
    totalChats: 0,
    totalMessages: 0,
  });
  const [recentClinics, setRecentClinics] = useState<RecentClinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentClinics();
  }, []);

  const fetchStats = async () => {
    try {
      // Total de clínicas por status
      const { data: clinics } = await supabase
        .from('clinics')
        .select('status');

      const totalClinics = clinics?.length || 0;
      const activeClinics = clinics?.filter(c => c.status === 'active').length || 0;
      const pendingClinics = clinics?.filter(c => c.status === 'pending').length || 0;
      const suspendedClinics = clinics?.filter(c => c.status === 'suspended').length || 0;

      // Total de usuários (excluindo SuperAdmin)
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .neq('role', 'SuperAdmin');

      // Total de chats
      const { count: totalChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true });

      // Total de mensagens
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalClinics,
        activeClinics,
        pendingClinics,
        suspendedClinics,
        totalUsers: totalUsers || 0,
        totalChats: totalChats || 0,
        totalMessages: totalMessages || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentClinics = async () => {
    try {
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (clinics) {
        // Buscar contagem de usuários para cada clínica
        const clinicsWithUsers = await Promise.all(
          clinics.map(async (clinic) => {
            const { count } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('clinic_id', clinic.id);
            
            return {
              ...clinic,
              users_count: count || 0,
            };
          })
        );
        
        setRecentClinics(clinicsWithUsers);
      }
    } catch (error) {
      console.error('Error fetching recent clinics:', error);
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Painel Administrativo</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Visão geral de todas as clínicas e métricas do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Total de Clínicas</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{stats.totalClinics}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm">
            <span className="text-green-600">{stats.activeClinics} ativas</span>
            <span className="text-yellow-600">{stats.pendingClinics} pendentes</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Total de Usuários</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{stats.totalUsers}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 hidden sm:block">Usuários cadastrados nas clínicas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Total de Conversas</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{stats.totalChats}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 hidden sm:block">Conversas em todas as clínicas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">Total de Mensagens</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{stats.totalMessages}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 hidden sm:block">Mensagens trocadas no sistema</p>
        </div>
      </div>

      {/* Recent Clinics */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Clínicas Recentes</h2>
            <p className="text-sm text-slate-500 mt-1">Últimas clínicas cadastradas no sistema</p>
          </div>
          <Link 
            to="/admin/clinics" 
            className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1 self-start sm:self-auto"
          >
            Ver todas
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="divide-y divide-slate-200">
          {recentClinics.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Nenhuma clínica cadastrada ainda
            </div>
          ) : (
            recentClinics.map((clinic) => (
              <div key={clinic.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-800 truncate">{clinic.name}</h3>
                      <p className="text-sm text-slate-500">
                        {clinic.users_count} usuário{clinic.users_count !== 1 ? 's' : ''} • 
                        Criada em {formatDate(clinic.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 ml-13 sm:ml-0">
                    {getStatusBadge(clinic.status)}
                    <Link
                      to={`/admin/clinics/${clinic.id}`}
                      className="text-cyan-600 hover:text-cyan-700 text-sm font-medium whitespace-nowrap"
                    >
                      Detalhes
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
