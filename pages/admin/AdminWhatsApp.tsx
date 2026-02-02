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
  RotateCcw,
  Activity,
  MessageSquare,
  Bell,
  History,
  QrCode,
  Send,
  Eye,
  ChevronDown,
  ChevronUp
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
  last_webhook_at?: string | null;
  webhook_errors_count?: number;
}

interface WebhookLog {
  id: string;
  instance_name: string;
  clinic_id: string | null;
  event_type: string;
  status: string;
  error_message: string | null;
  phone_number: string | null;
  message_preview: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

interface AlertSetting {
  id: string;
  alert_phone: string;
  alert_instance_name: string | null;
  enabled: boolean;
}

interface ConnectionHistory {
  id: string;
  instance_id: string;
  status: string;
  changed_at: string;
  instance_name?: string;
  clinic_name?: string;
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
  
  // Novos estados
  const [activeTab, setActiveTab] = useState<'instances' | 'logs' | 'alerts' | 'history'>('instances');
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSetting | null>(null);
  const [alertPhone, setAlertPhone] = useState('');
  const [alertInstanceName, setAlertInstanceName] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

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
        last_webhook_at,
        webhook_errors_count,
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

  const fetchWebhookLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await (supabase as any)
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) {
      setWebhookLogs(data as WebhookLog[]);
    }
    setLoadingLogs(false);
  }, []);

  const fetchAlertSettings = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('alert_settings')
      .select('*')
      .eq('enabled', true)
      .single();
    
    if (data) {
      setAlertSettings(data as AlertSetting);
      setAlertPhone((data as AlertSetting).alert_phone);
      setAlertInstanceName((data as AlertSetting).alert_instance_name || '');
    }
  }, []);

  const fetchConnectionHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await (supabase as any)
      .from('instance_connection_history')
      .select(`
        id,
        instance_id,
        status,
        changed_at,
        whatsapp_instances!inner(instance_name, clinics(name))
      `)
      .order('changed_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const mapped = data.map((item: any) => ({
        ...item,
        instance_name: item.whatsapp_instances?.instance_name,
        clinic_name: item.whatsapp_instances?.clinics?.name
      }));
      setConnectionHistory(mapped);
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchInstances();
    fetchAlertSettings();
  }, [fetchSettings, fetchInstances, fetchAlertSettings]);

  useEffect(() => {
    if (activeTab === 'logs') fetchWebhookLogs();
    if (activeTab === 'history') fetchConnectionHistory();
  }, [activeTab, fetchWebhookLogs, fetchConnectionHistory]);

  const saveAlertSettings = async () => {
    if (!alertPhone) {
      setMessage({ type: 'error', text: 'Informe o número de telefone para alertas' });
      return;
    }
    
    setSavingAlert(true);
    try {
      if (alertSettings) {
        await (supabase as any)
          .from('alert_settings')
          .update({ alert_phone: alertPhone, alert_instance_name: alertInstanceName || null })
          .eq('id', alertSettings.id);
      } else {
        await (supabase as any)
          .from('alert_settings')
          .insert({ alert_phone: alertPhone, alert_instance_name: alertInstanceName || null, enabled: true });
      }
      setMessage({ type: 'success', text: 'Configuração de alertas salva!' });
      fetchAlertSettings();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao salvar configuração' });
    } finally {
      setSavingAlert(false);
    }
  };

  const testHealthCheck = async () => {
    setTestingWebhook(true);
    setMessage(null);
    try {
      const response = await supabase.functions.invoke('check-instances-health');
      if (response.error) throw response.error;
      
      const result = response.data;
      setMessage({ 
        type: 'success', 
        text: `Verificação concluída: ${result.checked} instâncias, ${result.disconnected} desconectadas` 
      });
      fetchInstances();
      fetchConnectionHistory();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao executar verificação de saúde' });
    } finally {
      setTestingWebhook(false);
    }
  };

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
              onClick={testHealthCheck}
              disabled={testingWebhook || loading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Activity className={`w-5 h-5 ${testingWebhook ? 'animate-pulse' : ''}`} />
              {testingWebhook ? 'Verificando...' : 'Health Check'}
            </button>
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('instances')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'instances' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Instâncias
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'logs' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Logs Webhook
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'alerts' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            Alertas
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'history' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'instances' && (
        <>
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
        </>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Logs do Webhook</h2>
              <button
                onClick={fetchWebhookLogs}
                disabled={loadingLogs}
                className="text-cyan-600 hover:text-cyan-700 font-medium text-sm flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            {loadingLogs ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Carregando logs...
              </div>
            ) : webhookLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum log encontrado
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {webhookLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            log.status === 'success' ? 'bg-green-100 text-green-700' :
                            log.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">{log.event_type}</span>
                          {log.execution_time_ms && (
                            <span className="text-xs text-slate-400">{log.execution_time_ms}ms</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">{log.instance_name}</p>
                        {log.phone_number && (
                          <p className="text-xs text-slate-500">{log.phone_number}</p>
                        )}
                        {log.message_preview && (
                          <p className="text-xs text-slate-400 truncate mt-1">{log.message_preview}</p>
                        )}
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Configuração de Alertas</h2>
              <p className="text-sm text-slate-500 mt-1">Receba alertas no WhatsApp quando uma instância desconectar</p>
            </div>
            <div className="p-6">
              <div className="max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número para alertas (com DDD)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="5567992400040"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  <button
                    onClick={saveAlertSettings}
                    disabled={savingAlert}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingAlert ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Formato: código do país + DDD + número (ex: 5567992400040)
                </p>
                
                <label className="block text-sm font-medium text-slate-700 mb-2 mt-4">
                  Instância para enviar alertas
                </label>
                <select
                  value={alertInstanceName}
                  onChange={(e) => setAlertInstanceName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="">Selecione uma instância</option>
                  {instances.filter(i => i.status === 'connected').map(instance => (
                    <option key={instance.id} value={instance.instance_name}>
                      {instance.display_name || instance.instance_name} ({instance.clinic_name})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  Escolha qual instância WhatsApp enviará os alertas. Deve ser uma instância sua (interna).
                </p>
                
                {alertSettings && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">
                        Alertas configurados para: {alertSettings.alert_phone}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Histórico de Conexões</h2>
              <button
                onClick={fetchConnectionHistory}
                disabled={loadingHistory}
                className="text-cyan-600 hover:text-cyan-700 font-medium text-sm flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Carregando histórico...
              </div>
            ) : connectionHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum histórico encontrado
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {connectionHistory.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.status === 'connected' ? (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Wifi className="w-4 h-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <WifiOff className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{item.clinic_name || item.instance_name}</p>
                        <p className="text-xs text-slate-500">{item.instance_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        item.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.status === 'connected' ? 'Conectou' : 'Desconectou'}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(item.changed_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWhatsApp;
