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
}

interface UseWhatsAppReturn {
  instances: WhatsAppInstance[];
  selectedInstance: WhatsAppInstance | null;
  loading: boolean;
  error: string | null;
  selectInstance: (instanceId: string) => void;
  connect: (options?: { isShared?: boolean; displayName?: string }) => Promise<{ error: string | null }>;
  disconnect: (instanceId?: string) => Promise<{ error: string | null }>;
  refreshStatus: (instanceId?: string) => Promise<void>;
  deleteInstance: (instanceId: string) => Promise<{ error: string | null }>;
}

export function useWhatsApp(clinicId: string | undefined, userId?: string): UseWhatsAppReturn {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ apiUrl: string; apiKey: string } | null>(null);

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
  });

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      if (data && data.evolution_api_url && data.evolution_api_key) {
        setSettings({
          apiUrl: data.evolution_api_url,
          apiKey: data.evolution_api_key,
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

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
      
      const createResponse = await fetch(`${settings.apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
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

  return {
    instances,
    selectedInstance,
    loading,
    error,
    selectInstance,
    connect,
    disconnect,
    refreshStatus,
    deleteInstance,
  };
}
