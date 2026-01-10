
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useWhatsApp, WhatsAppInstance } from '../hooks/useWhatsApp';
import { useAuth } from '../hooks/useAuth';

interface ConnectProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Connect: React.FC<ConnectProps> = ({ state, setState }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { 
    instances, 
    selectedInstance, 
    loading, 
    error, 
    selectInstance,
    connect, 
    disconnect, 
    refreshStatus,
    deleteInstance 
  } = useWhatsApp(clinicId, user?.id);
  
  const [step, setStep] = useState<'list' | 'generating' | 'waiting' | 'connected'>('list');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showNewInstanceModal, setShowNewInstanceModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceShared, setNewInstanceShared] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  useEffect(() => {
    if (!clinicId && !state.currentUser) {
      navigate('/login');
    }
  }, [clinicId, state.currentUser, navigate]);

  useEffect(() => {
    if (loading) return;
    
    if (selectedInstance?.status === 'connected') {
      setStep('connected');
      setState(prev => ({ ...prev, whatsappStatus: 'connected' }));
    } else if (selectedInstance?.status === 'connecting' && selectedInstance.qrCode) {
      setStep('waiting');
    } else {
      setStep('list');
    }
  }, [selectedInstance, loading, setState]);

  useEffect(() => {
    if (step === 'waiting' || step === 'connected') {
      const interval = setInterval(() => {
        refreshStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step, refreshStatus]);

  const handleConnect = async (options?: { isShared?: boolean; displayName?: string }) => {
    setStep('generating');
    setConnectError(null);
    const result = await connect(options);
    
    if (result.error) {
      setConnectError(result.error);
      setStep('list');
    }
    setShowNewInstanceModal(false);
    setNewInstanceName('');
  };

  const handleDisconnect = async (instanceId?: string) => {
    await disconnect(instanceId);
    setState(prev => ({ ...prev, whatsappStatus: 'disconnected' }));
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return;
    setDeletingId(instanceId);
    await deleteInstance(instanceId);
    setDeletingId(null);
  };

  const handleSelectInstance = (instance: WhatsAppInstance) => {
    selectInstance(instance.id);
    if (instance.status === 'connected') {
      setStep('connected');
    } else if (instance.status === 'connecting' && instance.qrCode) {
      setStep('waiting');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-slate-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="p-8 min-h-full bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Conexões WhatsApp</h1>
            <p className="text-slate-500">Gerencie as instâncias de WhatsApp da sua clínica</p>
          </div>
          <button 
            onClick={() => setShowNewInstanceModal(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-cyan-500/30 flex items-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nova Conexão
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Instâncias */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Instâncias Disponíveis</h2>
            
            {loading && instances.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <div className="size-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-slate-500">Carregando...</p>
              </div>
            ) : instances.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">phone_iphone</span>
                <p className="text-sm text-slate-500 mb-4">Nenhuma instância configurada</p>
                <button 
                  onClick={() => setShowNewInstanceModal(true)}
                  className="text-cyan-600 hover:text-cyan-700 text-sm font-bold"
                >
                  + Criar primeira conexão
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => (
                  <div 
                    key={inst.id}
                    onClick={() => handleSelectInstance(inst)}
                    className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedInstance?.id === inst.id ? 'border-cyan-500 shadow-md' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`size-3 rounded-full ${getStatusColor(inst.status)}`}></div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {inst.displayName || inst.phoneNumber || 'Sem nome'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {inst.isShared ? '🔗 Compartilhada' : '👤 Pessoal'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                          inst.status === 'connected' ? 'bg-green-100 text-green-700' :
                          inst.status === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {getStatusText(inst.status)}
                        </span>
                        {(isAdmin || inst.userId === user?.id) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(inst.id); }}
                            disabled={deletingId === inst.id}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {deletingId === inst.id ? 'hourglass_empty' : 'delete'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                    {inst.phoneNumber && (
                      <p className="text-xs text-slate-400 mt-2 ml-6">{inst.phoneNumber}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Área do QR Code */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-cyan-400 to-teal-600"></div>
              
              <div className="p-10">
                {!selectedInstance ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">touch_app</span>
                    <h3 className="text-xl font-bold text-slate-400 mb-2">Selecione uma instância</h3>
                    <p className="text-sm text-slate-400">Escolha uma instância na lista ou crie uma nova conexão</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-black text-slate-900 mb-1">
                        {selectedInstance.displayName || 'WhatsApp'}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {selectedInstance.isShared ? 'Instância compartilhada' : 'Instância pessoal'}
                      </p>
                    </div>

                    <div className="flex justify-center mb-8">
                      <div className={`size-64 p-4 border-2 border-dashed rounded-2xl flex items-center justify-center transition-all ${
                        step === 'waiting' ? 'border-cyan-500' : 'border-slate-200'
                      }`}>
                        {loading ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="size-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-slate-400">Carregando...</span>
                          </div>
                        ) : step === 'generating' ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="size-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-slate-400">Gerando QR Code...</span>
                          </div>
                        ) : step === 'waiting' && selectedInstance.qrCode ? (
                          <img src={selectedInstance.qrCode} className="size-56 object-contain" alt="QR Code" />
                        ) : step === 'connected' ? (
                          <div className="flex flex-col items-center gap-3 text-green-600">
                            <span className="material-symbols-outlined text-6xl">check_circle</span>
                            <span className="text-lg font-bold">Conectado!</span>
                            {selectedInstance.phoneNumber && (
                              <span className="text-sm text-slate-500">{selectedInstance.phoneNumber}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <span className="material-symbols-outlined text-5xl">qr_code_2</span>
                            <span className="text-sm font-medium">Desconectado</span>
                            {connectError && (
                              <span className="text-xs text-red-500">{connectError}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center gap-3">
                      {step === 'connected' ? (
                        <button 
                          onClick={() => handleDisconnect(selectedInstance.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">logout</span>
                          Desconectar
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleConnect()}
                          disabled={loading}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {step === 'waiting' ? 'refresh' : 'qr_code_2'}
                          </span>
                          {step === 'waiting' ? 'Atualizar QR Code' : 'Gerar QR Code'}
                        </button>
                      )}
                    </div>

                    {step === 'waiting' && (
                      <div className="mt-6 text-center">
                        <div className="inline-flex items-center gap-2 bg-cyan-50 px-4 py-2 rounded-full">
                          <span className="material-symbols-outlined text-cyan-600 text-sm animate-pulse">wifi</span>
                          <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Aguardando leitura do QR Code...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Instruções */}
              {selectedInstance && step !== 'connected' && (
                <div className="border-t border-slate-100 p-6 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Como conectar</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { num: 1, text: 'Abra o WhatsApp' },
                      { num: 2, text: 'Vá em Configurações' },
                      { num: 3, text: 'Aparelhos conectados' },
                      { num: 4, text: 'Escaneie o QR Code' },
                    ].map(item => (
                      <div key={item.num} className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.num}
                        </div>
                        <span className="text-xs text-slate-600">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nova Instância */}
      {showNewInstanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNewInstanceModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">Nova Conexão WhatsApp</h3>
              <p className="text-sm text-slate-500 mt-1">Configure uma nova instância para sua clínica</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome da Instância</label>
                <input 
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Ex: Recepção, Atendimento, Meu WhatsApp..."
                  className="w-full mt-2 h-12 rounded-xl border-slate-200 focus:ring-cyan-500 focus:border-cyan-500 px-4"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Instância</label>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:bg-slate-50 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-50">
                      <input 
                        type="radio" 
                        name="instanceType" 
                        checked={newInstanceShared}
                        onChange={() => setNewInstanceShared(true)}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <p className="font-bold text-slate-800 text-sm">🔗 Compartilhada</p>
                        <p className="text-xs text-slate-500">Todos os atendentes podem usar</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:bg-slate-50 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-50">
                      <input 
                        type="radio" 
                        name="instanceType" 
                        checked={!newInstanceShared}
                        onChange={() => setNewInstanceShared(false)}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <p className="font-bold text-slate-800 text-sm">👤 Pessoal</p>
                        <p className="text-xs text-slate-500">Apenas você pode usar</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => handleConnect({ isShared: newInstanceShared, displayName: newInstanceName || undefined })}
                disabled={loading}
                className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Criar e Conectar
              </button>
              <button 
                onClick={() => setShowNewInstanceModal(false)}
                className="flex-1 h-12 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
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

export default Connect;
