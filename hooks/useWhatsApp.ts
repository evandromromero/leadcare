import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface WhatsAppInstance {
  id: string;
  clinicId: string;
  userId: string | null;
  instanceName: string;
  displayName: string | null;
  phoneNumber: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode: string | null;
  qrCodeExpiresAt: string | null;
  connectedAt: string | null;
  isShared: boolean;
  provider: 'evolution' | 'cloud_api';
  cloudPhoneNumberId: string | null;
  cloudWabaId: string | null;
}

export interface ClinicCloudApiConfig {
  whatsappProvider: 'evolution' | 'cloud_api';
  cloudApiAccessToken: string | null;
  cloudApiPhoneNumberId: string | null;
  cloudApiWabaId: string | null;
}

interface UseWhatsAppReturn {
  instances: WhatsAppInstance[];
  selectedInstance: WhatsAppInstance | null;
  loading: boolean;
  error: string | null;
  selectInstance: (instanceId: string) => void;
  connect: (options?: { isShared?: boolean; displayName?: string }) => Promise<{ error: string | null }>;
  reconnect: (instanceId: string) => Promise<{ error: string | null }>;
  disconnect: (instanceId?: string) => Promise<{ error: string | null }>;
  refreshStatus: (instanceId?: string) => Promise<void>;
  deleteInstance: (instanceId: string) => Promise<{ error: string | null }>;
  fetchProfilePicture: (phoneNumber: string, instanceName?: string) => Promise<string | null>;
  clinicCloudConfig: ClinicCloudApiConfig | null;
  settings: { apiUrl: string; apiKey: string } | null;
}

export function useWhatsApp(clinicId: string | undefined, userId?: string): UseWhatsAppReturn {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ 
    apiUrl: string; 
    apiKey: string;
    proxyHost?: string;
    proxyPort?: string;
    proxyProtocol?: string;
    proxyUsername?: string;
    proxyPassword?: string;
  } | null>(null);
  const [clinicCloudConfig, setClinicCloudConfig] = useState<ClinicCloudApiConfig | null>(null);

  const selectedInstance = instances.find(i => i.id === selectedInstanceId) || null;

  const mapInstanceData = (data: Record<string, unknown>): WhatsAppInstance => ({
    id: data.id as string,
    clinicId: data.clinic_id as string,
    userId: data.user_id as string | null,
    instanceName: data.instance_name as string,
    displayName: data.display_name as string | null,
    phoneNumber: data.phone_number as string | null,
    status: data.status as 'disconnected' | 'connecting' | 'connected',
    qrCode: data.qr_code as string | null,
    qrCodeExpiresAt: data.qr_code_expires_at as string | null,
    connectedAt: data.connected_at as string | null,
    isShared: data.is_shared as boolean ?? true,
    provider: (data.provider as 'evolution' | 'cloud_api') || 'evolution',
    cloudPhoneNumberId: data.cloud_phone_number_id as string | null,
    cloudWabaId: data.cloud_waba_id as string | null,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key, proxy_host, proxy_port, proxy_protocol, proxy_username, proxy_password')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      const d = data as any;
      if (d && d.evolution_api_url && d.evolution_api_key) {
        setSettings({
          apiUrl: d.evolution_api_url,
          apiKey: d.evolution_api_key,
          proxyHost: d.proxy_host || undefined,
          proxyPort: d.proxy_port || undefined,
          proxyProtocol: d.proxy_protocol || undefined,
          proxyUsername: d.proxy_username || undefined,
          proxyPassword: d.proxy_password || undefined,
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  const fetchClinicCloudConfig = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('whatsapp_provider, cloud_api_access_token, cloud_api_phone_number_id, cloud_api_waba_id')
        .eq('id', clinicId)
        .single();

      if (error) {
        console.error('Error fetching clinic cloud config:', error);
        return;
      }

      const d = data as any;
      if (d) {
        setClinicCloudConfig({
          whatsappProvider: d.whatsapp_provider || 'evolution',
          cloudApiAccessToken: d.cloud_api_access_token || null,
          cloudApiPhoneNumberId: d.cloud_api_phone_number_id || null,
          cloudApiWabaId: d.cloud_api_waba_id || null,
        });
      }
    } catch (err) {
      console.error('Error fetching clinic cloud config:', err);
    }
  }, [clinicId]);

  const fetchInstances = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching instances:', fetchError);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const mappedInstances = data.map(d => mapInstanceData(d as Record<string, unknown>));
        setInstances(mappedInstances);
        if (!selectedInstanceId) {
          setSelectedInstanceId(mappedInstances[0].id);
        }
      } else {
        setInstances([]);
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
    } finally {
      setLoading(false);
    }
  }, [clinicId, selectedInstanceId]);

  useEffect(() => {
    fetchSettings();
    fetchInstances();
    fetchClinicCloudConfig();

    if (!clinicId) return;

    const channel = supabase
      .channel('whatsapp_instances_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, unknown>).id as string;
            setInstances(prev => prev.filter(i => i.id !== deletedId));
            if (selectedInstanceId === deletedId) {
              setSelectedInstanceId(null);
            }
          } else if (payload.eventType === 'INSERT') {
            const newInstance = mapInstanceData(payload.new as Record<string, unknown>);
            setInstances(prev => [...prev, newInstance]);
            if (!selectedInstanceId) {
              setSelectedInstanceId(newInstance.id);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedInstance = mapInstanceData(payload.new as Record<string, unknown>);
            setInstances(prev => prev.map(i => i.id === updatedInstance.id ? updatedInstance : i));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, fetchInstances, fetchSettings, selectedInstanceId]);

  const selectInstance = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
  };

  const connect = async (options?: { isShared?: boolean; displayName?: string }) => {
    if (!clinicId) return { error: 'Clínica não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    const isShared = options?.isShared ?? true;
    const displayName = options?.displayName || null;

    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now().toString(36);
      const instanceName = `leadcare_${clinicId.replace(/-/g, '').substring(0, 8)}_${timestamp}`;
      
      const createBody: Record<string, unknown> = {
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      };

      if (settings.proxyHost && settings.proxyPort) {
        createBody.proxy = {
          host: settings.proxyHost,
          port: settings.proxyPort,
          protocol: settings.proxyProtocol || 'http',
          username: settings.proxyUsername || '',
          password: settings.proxyPassword || '',
        };
      }

      const createResponse = await fetch(`${settings.apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
        },
        body: JSON.stringify(createBody),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        if (!errorData.message?.includes('already exists')) {
          throw new Error(errorData.message || 'Erro ao criar instância');
        }
      }

      const { data: newInstance, error: insertError } = await supabase
        .from('whatsapp_instances')
        .insert({
          clinic_id: clinicId,
          instance_name: instanceName,
          display_name: displayName,
          status: 'connecting',
          is_shared: isShared,
          user_id: isShared ? null : userId,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;

      await fetch(`${settings.apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: [
              'QRCODE_UPDATED',
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'SEND_MESSAGE',
            ],
          },
        }),
      });

      // Configurar instância (readMessages: false - marcação manual ao responder)
      await fetch(`${settings.apiUrl}/settings/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
        },
        body: JSON.stringify({
          rejectCall: false,
          groupsIgnore: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: true,
        }),
      });

      const connectResponse = await fetch(
        `${settings.apiUrl}/instance/connect/${instanceName}`,
        {
          method: 'GET',
          headers: {
            'apikey': settings.apiKey,
          },
        }
      );

      if (!connectResponse.ok) {
        throw new Error('Erro ao conectar instância');
      }

      const data = await connectResponse.json();
      const qrCode = data.base64 || data.qrcode?.base64 || null;

      if (qrCode && newInstance) {
        await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: qrCode,
            qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
            status: 'connecting',
          })
          .eq('id', newInstance.id);

        setSelectedInstanceId(newInstance.id);
      }

      setLoading(false);
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  const reconnect = async (instanceId: string) => {
    const targetInstance = instances.find(i => i.id === instanceId);
    if (!targetInstance) return { error: 'Instância não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    setLoading(true);
    setError(null);

    try {
      // Primeiro, fazer logout para garantir que a instância está desconectada
      console.log('[useWhatsApp] reconnect: Fazendo logout primeiro...');
      try {
        await fetch(
          `${settings.apiUrl}/instance/logout/${targetInstance.instanceName}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'apikey': settings.apiKey,
            },
          }
        );
        // Aguardar um pouco para a Evolution processar o logout
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (logoutErr) {
        console.log('[useWhatsApp] reconnect: Logout falhou (pode ser normal):', logoutErr);
      }
      
      // Agora tentar conectar para gerar novo QR Code
      console.log('[useWhatsApp] reconnect: Tentando connect...');
      const connectResponse = await fetch(
        `${settings.apiUrl}/instance/connect/${targetInstance.instanceName}`,
        {
          method: 'GET',
          headers: {
            'apikey': settings.apiKey,
          },
        }
      );

      if (!connectResponse.ok) {
        const errorData = await connectResponse.json().catch(() => ({}));
        if (errorData.message?.includes('not found') || errorData.error?.includes('not found')) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'disconnected',
              qr_code: null,
            })
            .eq('id', instanceId);
          setLoading(false);
          return { error: 'Instância não existe mais na Evolution API. Delete e crie uma nova.' };
        }
        throw new Error(errorData.message || 'Erro ao reconectar instância');
      }

      const data = await connectResponse.json();
      const qrCode = data.base64 || data.qrcode?.base64 || null;
      
      console.log('[useWhatsApp] reconnect: QR Code recebido:', qrCode ? 'Sim' : 'Não');

      await supabase
        .from('whatsapp_instances')
        .update({
          qr_code: qrCode,
          qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
          status: 'connecting',
        })
        .eq('id', instanceId);

      // Refetch para atualizar o estado local com o QR Code
      await fetchInstances();
      
      setSelectedInstanceId(instanceId);
      setLoading(false);
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  const disconnect = async (instanceId?: string) => {
    const targetInstance = instanceId 
      ? instances.find(i => i.id === instanceId) 
      : selectedInstance;
    
    if (!targetInstance) return { error: 'Instância não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    setLoading(true);
    setError(null);

    try {
      await fetch(
        `${settings.apiUrl}/instance/logout/${targetInstance.instanceName}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': settings.apiKey,
          },
        }
      );

      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          connected_at: null,
        })
        .eq('id', targetInstance.id);

      setLoading(false);
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  const deleteInstance = async (instanceId: string) => {
    const targetInstance = instances.find(i => i.id === instanceId);
    if (!targetInstance) return { error: 'Instância não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    setLoading(true);
    setError(null);

    try {
      await fetch(
        `${settings.apiUrl}/instance/delete/${targetInstance.instanceName}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': settings.apiKey,
          },
        }
      );

      await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', instanceId);

      setLoading(false);
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  const refreshStatus = async (instanceId?: string) => {
    const targetInstance = instanceId 
      ? instances.find(i => i.id === instanceId) 
      : selectedInstance;

    if (!targetInstance || !settings) return;

    try {
      const response = await fetch(
        `${settings.apiUrl}/instance/connectionState/${targetInstance.instanceName}`,
        {
          method: 'GET',
          headers: {
            'apikey': settings.apiKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const state = data.instance?.state || data.state || 'close';
        const newStatus = state === 'open' ? 'connected' : 'disconnected';

        if (newStatus !== targetInstance.status) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: newStatus,
              connected_at: newStatus === 'connected' ? new Date().toISOString() : null,
              qr_code: newStatus === 'connected' ? null : targetInstance.qrCode,
            })
            .eq('id', targetInstance.id);
        }
      }
    } catch (err) {
      console.error('Error refreshing status:', err);
    }
  };

  // Buscar foto de perfil do WhatsApp
  const fetchProfilePicture = async (phoneNumber: string, instanceName?: string): Promise<string | null> => {
    if (!settings) return null;
    
    // Usar a instância conectada ou a primeira disponível
    const instance = instanceName || instances.find(i => i.status === 'connected')?.instanceName;
    if (!instance) return null;
    
    // Formatar número (remover caracteres especiais)
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    
    try {
      const response = await fetch(`${settings.apiUrl}/chat/fetchProfilePictureUrl/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
        },
        body: JSON.stringify({
          number: formattedNumber,
        }),
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.profilePictureUrl || data.picture || null;
    } catch (err) {
      console.error('Error fetching profile picture:', err);
      return null;
    }
  };

  return {
    instances,
    selectedInstance,
    loading,
    error,
    selectInstance,
    connect,
    reconnect,
    disconnect,
    refreshStatus,
    deleteInstance,
    fetchProfilePicture,
    clinicCloudConfig,
    settings,
  };
}
