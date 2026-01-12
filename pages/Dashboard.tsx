
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
  
  // Estados para meta do atendente
  const [userGoalData, setUserGoalData] = useState<{
    monthlyGoal: number;
    canSeeGoal: boolean;
    myMonthlyRevenue: number;
  } | null>(null);
  
  // Estados para receita clínica (lançamentos) do comercial
  const [clinicReceiptsData, setClinicReceiptsData] = useState<{
    totalComercial: number;
    totalRecebido: number;
    roi: string;
  } | null>(null);
  
  // Estado para lista detalhada de vendas do comercial
  const [mySalesDetails, setMySalesDetails] = useState<Array<{
    id: string;
    clientName: string;
    paymentDate: string;
    sourceName: string;
    sourceColor: string;
    commercialValue: number;
    receivedValue: number;
    status: 'pending' | 'received' | 'partial';
  }>>([]);

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
        let userMonthlyGoal = 0;
        let userCanSeeGoal = false;
        let userRole = '';
        
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('view_mode, role, monthly_goal, can_see_goal')
            .eq('id', user.id)
            .single();
          
          userRole = (userData as any)?.role || '';
          
          // Admin/SuperAdmin sempre veem tudo
          if (userData && userRole !== 'Admin' && userRole !== 'SuperAdmin') {
            userViewModeForStats = (userData as any).view_mode || 'personal';
          }
          
          // Dados de meta do usuário
          userMonthlyGoal = (userData as any)?.monthly_goal || 0;
          userCanSeeGoal = (userData as any)?.can_see_goal || false;
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
          // Setar dados de meta mesmo sem faturamento
          if (userCanSeeGoal && userMonthlyGoal > 0) {
            setUserGoalData({
              monthlyGoal: userMonthlyGoal,
              canSeeGoal: userCanSeeGoal,
              myMonthlyRevenue: 0
            });
          } else {
            setUserGoalData(null);
          }
          setLoadingStats(false);
          return;
        }
        
        // Buscar faturamento
        // Para Comercial: buscar apenas payments que ELE CRIOU (created_by)
        // Para outros: buscar payments dos chats visíveis
        const isComercial = userRole === 'Comercial';
        
        let paymentsData: any[] | null = null;
        
        if (isComercial && user?.id) {
          // Comercial vê apenas o que ele criou
          const { data } = await supabase
            .from('payments' as any)
            .select('value, payment_date, chat_id, created_by')
            .eq('clinic_id', clinicId)
            .eq('created_by', user.id);
          paymentsData = data as any[];
        } else {
          // Outros perfis veem baseado nos chats
          const { data } = await supabase
            .from('payments' as any)
            .select('value, payment_date, chat_id, created_by')
            .in('chat_id', chatIdsForStats);
          paymentsData = data as any[];
        }
        
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
          
          // Calcular faturamento pessoal do mês para meta do atendente
          if (userCanSeeGoal && userMonthlyGoal > 0 && user?.id) {
            // Buscar apenas chats do usuário
            const myChats = chats.filter(c => c.assigned_to === user.id);
            const myChatIds = myChats.map(c => c.id);
            const myMonthlyRevenue = (paymentsData as any[])
              .filter(p => myChatIds.includes(p.chat_id) && new Date(p.payment_date) >= firstDayOfMonth)
              .reduce((sum, p) => sum + Number(p.value), 0);
            
            setUserGoalData({
              monthlyGoal: userMonthlyGoal,
              canSeeGoal: userCanSeeGoal,
              myMonthlyRevenue
            });
          } else {
            setUserGoalData(null);
          }
        } else {
          setTotalRevenue(0);
          setMonthlyRevenue(0);
          setUserGoalData(null);
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
        
        // Buscar dados de receita clínica (lançamentos) para o comercial
        // Só mostra se o usuário for Comercial e tiver vendas
        if (user?.id && userRole === 'Comercial') {
          // Buscar payments criados por este comercial com detalhes do chat
          const { data: myPayments } = await supabase
            .from('payments' as any)
            .select('id, value, payment_date, chat_id, chat:chats(id, client_name, source_id)')
            .eq('clinic_id', clinicId)
            .eq('created_by', user.id)
            .order('payment_date', { ascending: false });
          
          if (myPayments && myPayments.length > 0) {
            const myPaymentIds = (myPayments as any[]).map(p => p.id);
            const totalComercial = (myPayments as any[]).reduce((sum, p) => sum + Number(p.value), 0);
            
            // Buscar receitas vinculadas aos payments deste comercial
            const { data: myReceipts } = await supabase
              .from('clinic_receipts' as any)
              .select('total_value, payment_id')
              .in('payment_id', myPaymentIds);
            
            const totalRecebido = (myReceipts as any[] || []).reduce((sum, r) => sum + Number(r.total_value), 0);
            const roi = totalComercial > 0 ? ((totalRecebido / totalComercial) * 100).toFixed(1) : '0';
            
            setClinicReceiptsData({ totalComercial, totalRecebido, roi });
            
            // Buscar origens para os detalhes
            const { data: sourcesData } = await supabase
              .from('lead_sources' as any)
              .select('id, name, color')
              .eq('clinic_id', clinicId);
            
            // Montar lista detalhada de vendas
            const salesDetails = (myPayments as any[]).map(p => {
              const receiptsForPayment = (myReceipts as any[] || []).filter(r => r.payment_id === p.id);
              const receivedValue = receiptsForPayment.reduce((sum, r) => sum + Number(r.total_value), 0);
              const source = (sourcesData as any[] || []).find(s => s.id === p.chat?.source_id);
              
              let status: 'pending' | 'received' | 'partial' = 'pending';
              if (receivedValue > 0) {
                status = receivedValue >= Number(p.value) ? 'received' : 'partial';
              }
              
              return {
                id: p.id,
                clientName: p.chat?.client_name || 'Cliente',
                paymentDate: p.payment_date,
                sourceName: source?.name || '-',
                sourceColor: source?.color || '#94a3b8',
                commercialValue: Number(p.value),
                receivedValue,
                status
              };
            });
            
            setMySalesDetails(salesDetails);
          } else {
            setClinicReceiptsData(null);
            setMySalesDetails([]);
          }
        } else {
          setClinicReceiptsData(null);
          setMySalesDetails([]);
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

        {/* Minha Meta do Mês - Visível apenas para atendentes com permissão */}
        {userGoalData && userGoalData.canSeeGoal && userGoalData.monthlyGoal > 0 && (
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-violet-100 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">flag</span>
                  Minha Meta do Mês
                </p>
                <p className="text-4xl font-black mt-1">
                  {((userGoalData.myMonthlyRevenue / userGoalData.monthlyGoal) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-2xl">
                  {userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal ? 'emoji_events' : 'target'}
                </span>
              </div>
            </div>
            
            {/* Barra de progresso */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-violet-100">
                  R$ {userGoalData.myMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-violet-200">
                  Meta: R$ {userGoalData.monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal 
                      ? 'bg-emerald-400' 
                      : 'bg-white'
                  }`}
                  style={{ width: `${Math.min((userGoalData.myMonthlyRevenue / userGoalData.monthlyGoal) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-violet-100 text-sm">
              {userGoalData.myMonthlyRevenue >= userGoalData.monthlyGoal ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Parabéns! Meta atingida! 🎉
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  Faltam R$ {(userGoalData.monthlyGoal - userGoalData.myMonthlyRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para a meta
                </>
              )}
            </div>
          </div>
        )}

        {/* Minhas Vendas e Receita Clínica - Visível apenas para Comercial */}
        {clinicReceiptsData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-2xl shadow-lg text-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">Minhas Vendas</p>
                  <p className="text-2xl font-black mt-1">
                    R$ {clinicReceiptsData.totalComercial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white/20 p-2 rounded-xl">
                  <span className="material-symbols-outlined text-xl">sell</span>
                </div>
              </div>
              <p className="text-amber-100 text-xs">Valor total fechado por mim</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-5 rounded-2xl shadow-lg text-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-teal-100 text-xs font-medium uppercase tracking-wider">Receita Clinica</p>
                  <p className="text-2xl font-black mt-1">
                    R$ {clinicReceiptsData.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white/20 p-2 rounded-xl">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
              </div>
              <p className="text-teal-100 text-xs">Recebido pela clinica das minhas vendas</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-5 rounded-2xl shadow-lg text-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-purple-100 text-xs font-medium uppercase tracking-wider">ROI</p>
                  <p className="text-2xl font-black mt-1">{clinicReceiptsData.roi}%</p>
                </div>
                <div className="bg-white/20 p-2 rounded-xl">
                  <span className="material-symbols-outlined text-xl">trending_up</span>
                </div>
              </div>
              <p className="text-purple-100 text-xs">Retorno sobre minhas vendas</p>
            </div>
          </div>
        )}

        {/* Minhas Vendas Detalhadas - Visível apenas para Comercial */}
        {mySalesDetails.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Minhas Vendas Detalhadas</h3>
                <p className="text-sm text-slate-500">Acompanhe o recebimento de cada venda</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comercial</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recebido</th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySalesDetails.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{sale.clientName}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-slate-600">
                        {new Date(sale.paymentDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${sale.sourceColor}20`, color: sale.sourceColor }}
                        >
                          {sale.sourceName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-amber-600">
                          R$ {sale.commercialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${sale.receivedValue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {sale.receivedValue > 0 
                            ? `R$ ${sale.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : '-'
                          }
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sale.status === 'received' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Recebido
                          </span>
                        )}
                        {sale.status === 'partial' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                            Parcial
                          </span>
                        )}
                        {sale.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-700" colSpan={3}>Total</td>
                    <td className="py-3 px-4 text-right font-black text-amber-600">
                      R$ {mySalesDetails.reduce((sum, s) => sum + s.commercialValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      R$ {mySalesDetails.reduce((sum, s) => sum + s.receivedValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              </table>
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
