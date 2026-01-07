import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface WhatsAppInstance {
  id: string;
  clinicId: string;
  instanceName: string;
  phoneNumber: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode: string | null;
  qrCodeExpiresAt: string | null;
  connectedAt: string | null;
}

interface UseWhatsAppReturn {
  instance: WhatsAppInstance | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<{ error: string | null }>;
  disconnect: () => Promise<{ error: string | null }>;
  refreshStatus: () => Promise<void>;
}

export function useWhatsApp(clinicId: string | undefined): UseWhatsAppReturn {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ apiUrl: string; apiKey: string } | null>(null);

  // Buscar configurações globais da Evolution API
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

  // Buscar instância existente
  const fetchInstance = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching instance:', fetchError);
        setLoading(false);
        return;
      }

      if (data) {
        setInstance({
          id: data.id,
          clinicId: data.clinic_id,
          instanceName: data.instance_name,
          phoneNumber: data.phone_number,
          status: data.status as 'disconnected' | 'connecting' | 'connected',
          qrCode: data.qr_code,
          qrCodeExpiresAt: data.qr_code_expires_at,
          connectedAt: data.connected_at,
        });
      }
    } catch (err) {
      console.error('Error fetching instance:', err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchSettings();
    fetchInstance();

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
            setInstance(null);
          } else {
            const data = payload.new as Record<string, unknown>;
            setInstance({
              id: data.id as string,
              clinicId: data.clinic_id as string,
              instanceName: data.instance_name as string,
              phoneNumber: data.phone_number as string | null,
              status: data.status as 'disconnected' | 'connecting' | 'connected',
              qrCode: data.qr_code as string | null,
              qrCodeExpiresAt: data.qr_code_expires_at as string | null,
              connectedAt: data.connected_at as string | null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, fetchInstance, fetchSettings]);

  // Criar instância automaticamente e conectar
  const connect = async () => {
    if (!clinicId) return { error: 'Clínica não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    setLoading(true);
    setError(null);

    try {
      const instanceName = `leadcare_${clinicId.replace(/-/g, '').substring(0, 12)}`;
      
      // Verificar se já existe instância no banco
      let currentInstance = instance;
      
      if (!currentInstance) {
        // Criar instância na Evolution API
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
          // Se já existe, continua
          if (!errorData.message?.includes('already exists')) {
            throw new Error(errorData.message || 'Erro ao criar instância');
          }
        }

        // Salvar no banco
        const { data: newInstance, error: insertError } = await supabase
          .from('whatsapp_instances')
          .insert({
            clinic_id: clinicId,
            instance_name: instanceName,
            status: 'connecting',
          })
          .select()
          .single();

        if (insertError && !insertError.message?.includes('duplicate')) {
          throw new Error(insertError.message);
        }

        if (newInstance) {
          currentInstance = {
            id: newInstance.id,
            clinicId: newInstance.clinic_id,
            instanceName: newInstance.instance_name,
            phoneNumber: newInstance.phone_number,
            status: 'connecting',
            qrCode: null,
            qrCodeExpiresAt: null,
            connectedAt: null,
          };
          setInstance(currentInstance);
        }

        // Configurar webhook
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
              ],
            },
          }),
        });
      }

      // Solicitar QR Code
      const connectResponse = await fetch(
        `${settings.apiUrl}/instance/connect/${currentInstance?.instanceName || instanceName}`,
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
      console.log('[useWhatsApp] Connect response:', data);
      const qrCode = data.base64 || data.qrcode?.base64 || null;

      if (qrCode && currentInstance) {
        // Atualizar no banco
        await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: qrCode,
            qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
            status: 'connecting',
          })
          .eq('id', currentInstance.id);

        // Atualizar estado local imediatamente
        setInstance({
          ...currentInstance,
          qrCode: qrCode,
          qrCodeExpiresAt: new Date(Date.now() + 60000).toISOString(),
          status: 'connecting',
        });
      } else {
        console.log('[useWhatsApp] No QR code in response, fetching instance...');
        // Se não veio QR code, buscar do banco (pode ter sido atualizado via webhook)
        await fetchInstance();
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

  const disconnect = async () => {
    if (!instance) return { error: 'Instância não encontrada' };
    if (!settings) return { error: 'Configurações não encontradas' };

    setLoading(true);
    setError(null);

    try {
      await fetch(
        `${settings.apiUrl}/instance/logout/${instance.instanceName}`,
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
        .eq('id', instance.id);

      setLoading(false);
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setLoading(false);
      return { error: errorMessage };
    }
  };

  const refreshStatus = async () => {
    if (!instance || !settings) return;

    try {
      const response = await fetch(
        `${settings.apiUrl}/instance/connectionState/${instance.instanceName}`,
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

        if (newStatus !== instance.status) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: newStatus,
              connected_at: newStatus === 'connected' ? new Date().toISOString() : null,
              qr_code: newStatus === 'connected' ? null : instance.qrCode,
            })
            .eq('id', instance.id);
        }
      }
    } catch (err) {
      console.error('Error refreshing status:', err);
    }
  };

  return {
    instance,
    loading,
    error,
    connect,
    disconnect,
    refreshStatus,
  };
}
