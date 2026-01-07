
import React from 'react';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';

interface DashboardProps {
  state: GlobalState;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const clinicId = state.selectedClinic?.id;
  const { chats, loading } = useChats(clinicId);

  const novosLeads = chats.filter(c => c.status === 'Novo Lead').length;
  const emAtendimento = chats.filter(c => c.status === 'Em Atendimento').length;
  const fechados = chats.filter(c => c.status === 'Fechado').length;
  const totalChats = chats.length;

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
                <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{stat.change}</span>
              </div>
              <span className="text-xs text-slate-400">vs. ontem</span>
            </div>
          ))}
        </div>

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
