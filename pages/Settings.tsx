
import React from 'react';
import { GlobalState } from '../types';

interface SettingsProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Settings: React.FC<SettingsProps> = ({ state, setState }) => {
  return (
    <div className="p-8 space-y-12">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500 text-lg">Gerencie as preferências da sua clínica e do seu perfil.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900">Perfil da Clínica</h3>
          <p className="text-sm text-slate-500">Informações públicas exibidas nos relatórios e para sua equipe.</p>
        </div>
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-6 mb-4">
            <div className="relative group">
              <img src={state.selectedClinic?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.selectedClinic?.name || 'C')}&background=0891b2&color=fff&size=80`} className="size-20 rounded-2xl object-cover border border-slate-100" />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <span className="material-symbols-outlined text-white">edit</span>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900">{state.selectedClinic?.name}</h4>
              <p className="text-xs text-slate-400">ID da Clínica: {state.selectedClinic?.idCode}</p>
              <button className="mt-2 text-xs font-bold text-cyan-600 hover:underline">Alterar Logo</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome da Unidade</label>
                <input type="text" defaultValue={state.selectedClinic?.name} className="w-full h-11 bg-slate-50 border-slate-200 rounded-xl px-4 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">CNPJ / ID Fiscal</label>
                <input type="text" defaultValue="00.000.000/0001-00" className="w-full h-11 bg-slate-50 border-slate-200 rounded-xl px-4 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Endereço</label>
              <input type="text" defaultValue="Av. Central, 1234 - Sala 102" className="w-full h-11 bg-slate-50 border-slate-200 rounded-xl px-4 text-sm" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-50 flex justify-end">
            <button className="bg-cyan-600 text-white font-bold h-11 px-8 rounded-xl hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-500/20">Salvar Alterações</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-12 border-t border-slate-100">
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900">Integração WhatsApp</h3>
          <p className="text-sm text-slate-500">Configurações de API, webhooks e status do robô de atendimento.</p>
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="size-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                 <span className="material-symbols-outlined">api</span>
               </div>
               <div>
                  <h4 className="text-sm font-bold text-slate-900">Webhook Status</h4>
                  <p className="text-xs text-slate-400">Ativo e recebendo dados</p>
               </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase">Online</span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="size-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
                 <span className="material-symbols-outlined">auto_fix_high</span>
               </div>
               <div>
                  <h4 className="text-sm font-bold text-slate-900">Auto-Resposta (IA)</h4>
                  <p className="text-xs text-slate-400">Responder automaticamente fora do horário</p>
               </div>
            </div>
            <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
              <div className="absolute left-1 top-1 size-4 bg-white rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
