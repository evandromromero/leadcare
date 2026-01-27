import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Server,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Phone,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  connected_at: string | null;
  clinic_id: string;
  clinic_name?: string;
  api_status?: 'open' | 'connecting' | 'close' | 'unknown';
}

interface Settings {
  evolution_api_url: string;
  evolution_api_key: string;
  easypanel_url: string;
  easypanel_token: string;
  easypanel_project: string;
  easypanel_service: string;
}

const AdminWhatsApp: React.FC = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key, easypanel_url, easypanel_token, easypanel_project, easypanel_service')
      .single();
    
    if (data) {
      setSettings(data as Settings);
    }
  }, []);

  const fetchInstances = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select(`
        id,
        instance_name,
        display_name,
        phone_number,
        status,
        connected_at,
        clinic_id,
        clinics!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = data.map((item: any) => ({
        ...item,
        clinic_name: item.clinics?.name || 'Clínica não encontrada'
      }));
      setInstances(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchInstances();
  }, [fetchSettings, fetchInstances]);

  const checkAllConnections = async () => {
    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      setMessage({ type: 'error', text: 'Configurações da Evolution API não encontradas' });
      return;
    }

    setChecking(true);
    setMessage(null);

    let updated = 0;
    let errors = 0;
    let disconnected = 0;

    for (const instance of instances) {
      try {
        const response = await fetch(
          `${settings.evolution_api_url}/instance/connectionState/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': settings.evolution_api_key },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const apiState = data.instance?.state || data.state || 'unknown';
          
          let newStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
          if (apiState === 'open') newStatus = 'connected';
          else if (apiState === 'connecting') newStatus = 'connecting';
          else disconnected++;

          if (newStatus !== instance.status) {
            await supabase
              .from('whatsapp_instances')
              .update({
                status: newStatus,
                connected_at: newStatus === 'connected' ? new Date().toISOString() : null,
              })
              .eq('id', instance.id);
            updated++;
          }

          // Atualizar estado local
          setInstances(prev => prev.map(i => 
            i.id === instance.id 
              ? { ...i, status: newStatus, api_status: apiState }
              : i
          ));
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Erro ao verificar ${instance.instance_name}:`, err);
        errors++;
      }
    }

    setChecking(false);
    setLastCheck(new Date());

    if (errors > 0) {
      setMessage({ type: 'warning', text: `Verificação concluída. ${updated} atualizadas, ${errors} erros, ${disconnected} desconectadas.` });
    } else if (disconnected > 0) {
      setMessage({ type: 'warning', text: `${disconnected} instância(s) desconectada(s). Considere reiniciar a Evolution API.` });
    } else {
      setMessage({ type: 'success', text: `Todas as ${instances.length} instâncias verificadas. ${updated} atualizadas.` });
    }
  };

  const restartEvolution = async () => {
    if (!settings?.easypanel_url || !settings?.easypanel_token) {
      setMessage({ type: 'error', text: 'Configurações do EasyPanel não encontradas. Configure em Configurações > API.' });
      return;
    }

    if (!confirm('Tem certeza que deseja reiniciar a Evolution API? Todas as conexões serão temporariamente interrompidas.')) {
      return;
    }

    setRestarting(true);
    setMessage(null);

    try {
      // Usar Edge Function como proxy para evitar CORS
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/easypanel-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`,
          },
          body: JSON.stringify({ action: 'redeploy' }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Evolution API reiniciando... Aguarde 30-60 segundos e verifique as conexões.' });
        
        // Atualizar estado local
        setInstances(prev => prev.map(i => ({ ...i, status: 'disconnected' as const })));
      } else {
        throw new Error(result.error || `Erro ${response.status}`);
      }
    } catch (err) {
      console.error('Erro ao reiniciar Evolution:', err);
      setMessage({ type: 'error', text: `Erro ao reiniciar: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    } finally {
      setRestarting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'connecting':
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-700';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      default: return 'Desconectado';
    }
  };

  const stats = {
    total: instances.length,
    connected: instances.filter(i => i.status === 'connected').length,
    connecting: instances.filter(i => i.status === 'connecting').length,
    disconnected: instances.filter(i => i.status === 'disconnected').length,
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Monitoramento WhatsApp</h1>
            <p className="text-slate-500">Gerencie todas as instâncias de WhatsApp das clínicas</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={checkAllConnections}
              disabled={checking || loading}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Verificando...' : 'Verificar Conexões'}
            </button>
            <button
              onClick={restartEvolution}
              disabled={restarting}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-5 h-5 ${restarting ? 'animate-spin' : ''}`} />
              {restarting ? 'Reiniciando...' : 'Reiniciar Evolution'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            message.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             message.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
             <XCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Server className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500 font-medium">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-green-600">{stats.connected}</p>
                <p className="text-xs text-slate-500 font-medium">Conectadas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-yellow-600">{stats.connecting}</p>
                <p className="text-xs text-slate-500 font-medium">Conectando</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-red-600">{stats.disconnected}</p>
                <p className="text-xs text-slate-500 font-medium">Desconectadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Last Check */}
        {lastCheck && (
          <p className="text-sm text-slate-500 mb-4">
            Última verificação: {lastCheck.toLocaleString('pt-BR')}
          </p>
        )}

        {/* Instances Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Instâncias WhatsApp</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : instances.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Nenhuma instância encontrada
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Instância</th>
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Clínica</th>
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Telefone</th>
                      <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Conectado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {instances.map((instance) => (
                      <tr key={instance.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(instance.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusBadge(instance.status)}`}>
                              {getStatusText(instance.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{instance.display_name || instance.instance_name}</p>
                            <p className="text-xs text-slate-500">{instance.instance_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{instance.clinic_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {instance.phone_number ? (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-700">{instance.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-sm">
                          {instance.connected_at 
                            ? new Date(instance.connected_at).toLocaleString('pt-BR')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {instances.map((instance) => (
                  <div key={instance.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-slate-900">{instance.display_name || instance.instance_name}</p>
                        <p className="text-xs text-slate-500">{instance.instance_name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusBadge(instance.status)}`}>
                        {getStatusText(instance.status)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Building2 className="w-4 h-4" />
                        {instance.clinic_name}
                      </div>
                      {instance.phone_number && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-4 h-4" />
                          {instance.phone_number}
                        </div>
                      )}
                      {instance.connected_at && (
                        <p className="text-xs text-slate-400">
                          Conectado: {new Date(instance.connected_at).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* EasyPanel Config Warning */}
        {!settings?.easypanel_token && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Token do EasyPanel não configurado</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Para reiniciar a Evolution API remotamente, configure o token do EasyPanel em Configurações &gt; API.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWhatsApp;
