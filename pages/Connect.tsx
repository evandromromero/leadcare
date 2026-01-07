
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useWhatsApp } from '../hooks/useWhatsApp';

interface ConnectProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Connect: React.FC<ConnectProps> = ({ state, setState }) => {
  const navigate = useNavigate();
  const clinicId = state.selectedClinic?.id;
  const { instance, loading, error, connect, disconnect, refreshStatus } = useWhatsApp(clinicId);
  
  const [step, setStep] = useState<'idle' | 'generating' | 'waiting' | 'connected'>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);

  // Se não tem clínica selecionada, redirecionar para login
  useEffect(() => {
    if (!clinicId && !state.currentUser) {
      navigate('/login');
    }
  }, [clinicId, state.currentUser, navigate]);

  // Atualizar step baseado no status da instância
  useEffect(() => {
    if (loading) return;
    
    if (instance?.status === 'connected') {
      setStep('connected');
      setState(prev => ({ ...prev, whatsappStatus: 'connected' }));
    } else if (instance?.status === 'connecting' && instance.qrCode) {
      setStep('waiting');
    } else {
      setStep('idle');
    }
  }, [instance, loading]);

  // Polling para atualizar status
  useEffect(() => {
    if (step === 'waiting' || step === 'connected') {
      const interval = setInterval(() => {
        refreshStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step, refreshStatus]);

  // Conectar automaticamente ao clicar
  const handleConnect = async () => {
    setStep('generating');
    setConnectError(null);
    const result = await connect();
    
    if (result.error) {
      setConnectError(result.error);
      setStep('idle');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setState(prev => ({ ...prev, whatsappStatus: 'disconnected' }));
  };

  return (
    <div className="p-8 min-h-full flex items-center justify-center bg-slate-50">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
        {/* Left Column: Instructions */}
        <div className="md:col-span-5 space-y-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Conexão WhatsApp</h1>
            <p className="text-slate-500 leading-relaxed">Gerencie a conexão do seu dispositivo para começar a atender seus pacientes em tempo real.</p>
          </div>

          <div className="space-y-6">
            {[
              { num: 1, title: 'Abra o WhatsApp', desc: 'No seu celular, abra o aplicativo do WhatsApp.' },
              { num: 2, title: 'Acesse o Menu', desc: 'Toque em Mais opções (Android) ou Configurações (iPhone).' },
              { num: 3, title: 'Conecte o Aparelho', desc: 'Selecione Aparelhos conectados e toque em Conectar um aparelho.' },
              { num: 4, title: 'Escaneie o Código', desc: 'Aponte a câmera do seu celular para o QR Code ao lado.' },
            ].map(item => (
              <div key={item.num} className="flex gap-4">
                <div className="size-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {item.num}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100 flex gap-3">
            <span className="material-symbols-outlined text-cyan-600">verified_user</span>
            <p className="text-xs text-cyan-800 font-medium">
              Seus dados são criptografados de ponta a ponta. Nós não temos acesso às suas mensagens privadas.
            </p>
          </div>
        </div>

        {/* Right Column: QR Code Display */}
        <div className="md:col-span-7 flex justify-center">
          <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-400 to-teal-600"></div>
            
            <h2 className="text-2xl font-black text-slate-900 mb-2">Conectar WhatsApp</h2>
            <p className="text-sm text-slate-400 mb-8">Escaneie o QR Code para sincronizar</p>

            <div className="relative group mx-auto w-fit mb-8">
              <div className={`size-64 p-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center transition-all ${step === 'waiting' ? 'border-cyan-500' : ''}`}>
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-slate-400">Carregando...</span>
                  </div>
                ) : step === 'idle' ? (
                  <button onClick={handleConnect} className="flex flex-col items-center gap-3 text-cyan-600 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-5xl">qr_code_2</span>
                    <span className="text-sm font-bold">Conectar WhatsApp</span>
                    {connectError && (
                      <span className="text-xs text-red-500 mt-2">{connectError}</span>
                    )}
                  </button>
                ) : step === 'generating' ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-slate-400">Gerando QR Code...</span>
                  </div>
                ) : step === 'waiting' && instance?.qrCode ? (
                  <div className="relative">
                    <img src={instance.qrCode} className="size-56 object-contain" alt="QR Code" />
                  </div>
                ) : step === 'connected' ? (
                  <div className="flex flex-col items-center gap-3 text-green-600">
                    <span className="material-symbols-outlined text-5xl">check_circle</span>
                    <span className="text-sm font-bold">Conectado!</span>
                    {instance?.phoneNumber && (
                      <span className="text-xs text-slate-500">{instance.phoneNumber}</span>
                    )}
                  </div>
                ) : null}
              </div>
              
              {step === 'waiting' && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2 whitespace-nowrap">
                  <span className="material-symbols-outlined text-green-500 text-sm animate-pulse">wifi</span>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Aguardando leitura...</span>
                </div>
              )}
            </div>

            {step === 'connected' ? (
              <button 
                onClick={handleDisconnect}
                className="text-red-600 hover:text-red-800 text-sm font-bold flex items-center gap-1 mx-auto"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Desconectar
              </button>
            ) : step === 'waiting' && (
              <button 
                disabled={step === 'generating'}
                className="text-cyan-600 hover:text-cyan-800 text-sm font-bold flex items-center gap-1 mx-auto disabled:opacity-50"
                onClick={handleConnect}
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                Atualizar QR Code
              </button>
            )}

            <div className="mt-12 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              <span>Versão 2.4.0</span>
              <a href="#" className="hover:text-cyan-600 transition-colors">Precisa de ajuda?</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connect;
