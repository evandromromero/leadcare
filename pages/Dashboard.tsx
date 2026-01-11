
import React, { useState, useEffect } from 'react';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getDataAccess } from '../lib/permissions';

interface DashboardProps {
  state: GlobalState;
}

interface LeadSourceStats {
  id: string;
  name: string;
  code: string | null;
  color: string;
  total_leads: number;
  converted_leads: number;
  revenue: number;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading } = useChats(clinicId, user?.id);
  
  const dataAccess = getDataAccess(user?.role);
  const canSeeBilling = dataAccess !== 'no_billing';
  
  // Estados para métricas avançadas
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [leadSourceStats, setLeadSourceStats] = useState<LeadSourceStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const novosLeads = chats.filter(c => c.status === 'Novo Lead').length;
  const emAtendimento = chats.filter(c => c.status === 'Em Atendimento').length;
  const fechados = chats.filter(c => c.status === 'Convertido').length;
  const totalChats = chats.length;

  // Calcular métricas baseado no view_mode do usuário
  // view_mode 'shared' = vê faturamento de todos
  // view_mode 'personal' = só vê faturamento dos atendimentos dele
  useEffect(() => {
    const fetchStats = async () => {
      if (!clinicId || loading) return;
      setLoadingStats(true);
      
      try {
        // Buscar view_mode do usuário para filtrar faturamento
        let userViewModeForStats = 'shared';
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('view_mode, role')
            .eq('id', user.id)
            .single();
          
          // Admin/SuperAdmin sempre veem tudo
          if (userData && (userData as any).role !== 'Admin' && (userData as any).role !== 'SuperAdmin') {
            userViewModeForStats = (userData as any).view_mode || 'personal';
          }
        }
        
        // Determinar quais chats usar para faturamento
        let chatIdsForStats: string[] = [];
        if (userViewModeForStats === 'personal' && user?.id) {
          // Só chats onde o usuário respondeu (assigned_to = user.id)
          const chatsAtendidos = chats.filter(c => c.assigned_to === user.id);
          chatIdsForStats = chatsAtendidos.map(c => c.id);
        } else {
          // Todos os chats
          chatIdsForStats = chats.map(c => c.id);
        }
        
        if (chatIdsForStats.length === 0) {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setLeadSourceStats([]);
          setLoadingStats(false);
          return;
        }
        
        // Buscar faturamento
        const { data: paymentsData } = await supabase
          .from('payments' as any)
          .select('value, payment_date, chat_id')
          .in('chat_id', chatIdsForStats);
        
        if (paymentsData) {
          const total = (paymentsData as any[]).reduce((sum, p) => sum + Number(p.value), 0);
          setTotalRevenue(total);
          
          // Faturamento do mês atual
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthly = (paymentsData as any[])
            .filter(p => new Date(p.payment_date) >= firstDayOfMonth)
            .reduce((sum, p) => sum + Number(p.value), 0);
          setMonthlyRevenue(monthly);
        } else {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
        }
        
        // Buscar origens de leads apenas se houver chats visíveis
        if (chatIdsForStats.length > 0) {
          const { data: sourcesData } = await supabase
            .from('lead_sources' as any)
            .select('id, name, code, color')
            .eq('clinic_id', clinicId);
          
          if (sourcesData && sourcesData.length > 0) {
            // Calcular estatísticas por origem usando apenas os chats visíveis
            const stats: LeadSourceStats[] = (sourcesData as any[]).map(source => {
              const sourceChats = chats.filter(c => (c as any).source_id === source.id);
              const convertedChats = sourceChats.filter(c => c.status === 'Convertido');
              const sourceChatIds = sourceChats.map(c => c.id);
              const revenue = (paymentsData as any[] || [])
                .filter(p => sourceChatIds.includes(p.chat_id))
                .reduce((sum, p) => sum + Number(p.value), 0);
              
              return {
                id: source.id,
                name: source.name,
                code: source.code,
                color: source.color,
                total_leads: sourceChats.length,
                converted_leads: convertedChats.length,
                revenue,
              };
            });
            
            // Ordenar por total de leads e filtrar apenas os que têm leads
            stats.sort((a, b) => b.total_leads - a.total_leads);
            setLeadSourceStats(stats.filter(s => s.total_leads > 0));
          } else {
            setLeadSourceStats([]);
          }
        } else {
          setLeadSourceStats([]);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    
    fetchStats();
  }, [clinicId, chats, loading]);

  const stats = [
    { label: 'Novos Leads', value: String(novosLeads), change: '+12%', color: 'blue', icon: 'person_add' },
    { label: 'Em Atendimento', value: String(emAtendimento), change: '+4%', color: 'orange', icon: 'forum' },
    { label: 'Vendas Concluídas', value: String(fechados), change: '+10%', color: 'green', icon: 'check_circle' },
    { label: 'Total Conversas', value: String(totalChats), change: '', color: 'purple', icon: 'chat' },
  ];

  return (
    <div className="p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500">Resumo em tempo real da performance da sua clínica hoje.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                <span className={`material-symbols-outlined text-${stat.color}-600`}>{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{stat.value}</span>
                {stat.change && <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{stat.change}</span>}
              </div>
              <span className="text-xs text-slate-400">vs. ontem</span>
            </div>
          ))}
        </div>

        {/* Faturamento Cards */}
        {canSeeBilling && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider">Faturamento do Mês</p>
                <p className="text-4xl font-black mt-1">
                  R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">trending_up</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-100 text-sm">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-cyan-100 text-sm font-medium uppercase tracking-wider">Faturamento Total</p>
                <p className="text-4xl font-black mt-1">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-cyan-100 text-sm">
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
              Acumulado geral
            </div>
          </div>
        </div>
        )}

        {/* Leads por Origem */}
        {canSeeBilling && leadSourceStats.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Leads por Origem</h3>
                <p className="text-sm text-slate-500">Performance de cada canal de aquisição</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Leads</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Convertidos</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Taxa</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadSourceStats.map(source => {
                    const conversionRate = source.total_leads > 0 
                      ? ((source.converted_leads / source.total_leads) * 100).toFixed(1) 
                      : '0.0';
                    return (
                      <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: source.color }}></span>
                            <span className="font-medium text-slate-800">{source.name}</span>
                            {source.code && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{source.code}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-slate-800">{source.total_leads}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-green-600">{source.converted_leads}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${Number(conversionRate) >= 30 ? 'text-green-600' : Number(conversionRate) >= 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {conversionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-emerald-600">
                            R$ {source.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-700">Total</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {leadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-green-600">
                      {leadSourceStats.reduce((sum, s) => sum + s.converted_leads, 0)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">
                      {leadSourceStats.reduce((sum, s) => sum + s.total_leads, 0) > 0 
                        ? ((leadSourceStats.reduce((sum, s) => sum + s.converted_leads, 0) / leadSourceStats.reduce((sum, s) => sum + s.total_leads, 0)) * 100).toFixed(1)
                        : '0.0'}%
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      R$ {leadSourceStats.reduce((sum, s) => sum + s.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Chart Section Simulation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-96 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Fluxo de Mensagens</h3>
                <p className="text-sm text-slate-500">Volume de entrada e saída nas últimas 24h</p>
              </div>
              <select className="bg-slate-50 border-slate-200 rounded-lg text-sm font-medium">
                <option>Hoje</option>
                <option>Últimos 7 dias</option>
              </select>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-2 px-2">
              {/* Simulated Chart Bars */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-full bg-cyan-100 rounded-t-sm hover:bg-cyan-600 transition-colors cursor-pointer"
                  style={{ height: `${20 + Math.random() * 80}%` }}
                  title={`${i}h: ${Math.floor(Math.random() * 100)} msg`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Leads Recentes</h3>
              <a href="#" className="text-xs font-bold text-cyan-600">Ver todos</a>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-50">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto"></div>
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conversa ainda</div>
              ) : chats.slice(0, 6).map(chat => (
                <div key={chat.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <img src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} className="size-10 rounded-full border border-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{chat.client_name}</p>
                    <p className="text-xs text-slate-500 truncate">{chat.last_message || 'Sem mensagens'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
