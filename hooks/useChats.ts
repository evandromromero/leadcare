import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

export type DbChat = Tables<'chats'>;
export type DbMessage = Tables<'messages'>;
export type DbTag = Tables<'tags'>;

export interface ChatWithMessages extends DbChat {
  messages: DbMessage[];
  tags: DbTag[];
}

interface UseChatsReturn {
  chats: ChatWithMessages[];
  loading: boolean;
  error: string | null;
  whatsappConnected: boolean;
  refetch: () => Promise<void>;
  updateChatStatus: (chatId: string, status: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, userId: string) => Promise<void>;
  markAsRead: (chatId: string) => Promise<void>;
}

export function useChats(clinicId?: string, userId?: string): UseChatsReturn {
  const [chats, setChats] = useState<ChatWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappInstance, setWhatsappInstance] = useState<{ instanceName: string; status: string } | null>(null);
  const [evolutionSettings, setEvolutionSettings] = useState<{ apiUrl: string; apiKey: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userViewMode, setUserViewMode] = useState<string | null>(null);

  // Buscar role e view_mode do usuário
  const fetchUserSettings = async () => {
    if (!userId) {
      setUserRole(null);
      setUserViewMode(null);
      return;
    }
    
    const { data } = await supabase
      .from('users')
      .select('view_mode, role')
      .eq('id', userId)
      .single();
    
    if (data) {
      setUserRole((data as any).role || null);
      setUserViewMode((data as any).view_mode || 'personal');
    }
  };

  const fetchChats = async () => {
    console.log('[useChats] fetchChats called, clinicId:', clinicId, 'userId:', userId, 'viewMode:', userViewMode, 'role:', userRole);
    
    if (!clinicId) {
      console.log('[useChats] No clinicId, setting loading false');
      setLoading(false);
      return;
    }
    
    // Esperar userRole e userViewMode serem carregados se tiver userId
    if (userId && (userRole === null || userViewMode === null)) {
      console.log('[useChats] Waiting for user settings to load...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useChats] Fetching chats from Supabase...');
      let query = supabase
        .from('chats')
        .select(`
          *,
          messages (
            *
          ),
          chat_tags (
            tags (*)
          )
        `)
        .eq('clinic_id', clinicId);
      
      // Todos os usuários da mesma clínica/instância veem TODAS as conversas
      // view_mode só afeta faturamento/relatórios, não a visualização de chats
      console.log('[useChats] Showing all chats for clinic');
      
      const { data: chatsData, error: chatsError } = await query.order('last_message_time', { ascending: false });

      if (chatsError) {
        console.error('[useChats] Error fetching chats:', chatsError);
        setError('Erro ao carregar conversas');
        setLoading(false);
        return;
      }

      console.log('[useChats] Chats fetched:', chatsData?.length || 0);

      const formattedChats: ChatWithMessages[] = (chatsData || []).map(chat => ({
        ...chat,
        messages: chat.messages || [],
        tags: chat.chat_tags?.map((ct: { tags: DbTag }) => ct.tags).filter(Boolean) || [],
      }));

      setChats(formattedChats);
    } catch (err) {
      console.error('[useChats] Exception fetching chats:', err);
      setError('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const updateChatStatus = async (chatId: string, status: string) => {
    const { error } = await supabase
      .from('chats')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) {
      console.error('Error updating chat status:', error);
      return;
    }

    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, status } : chat
    ));
  };

  const markAsRead = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || (chat.unread_count || 0) === 0) return;

    const { error } = await supabase
      .from('chats')
      .update({ unread_count: 0, updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) {
      console.error('Error marking chat as read:', error);
      return;
    }

    setChats(prev => prev.map(c => 
      c.id === chatId ? { ...c, unread_count: 0 } : c
    ));
  };

  const sendMessage = async (chatId: string, content: string, userId: string) => {
    const chat = chats.find(c => c.id === chatId);
    
    // Enviar via WhatsApp se conectado
    if (whatsappInstance && whatsappInstance.status === 'connected' && evolutionSettings && chat?.phone_number) {
      try {
        let formattedPhone = chat.phone_number.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }

        await fetch(`${evolutionSettings.apiUrl}/message/sendText/${whatsappInstance.instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionSettings.apiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: content,
          }),
        });
      } catch (err) {
        console.error('Error sending WhatsApp message:', err);
      }
    }

    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        content,
        is_from_client: false,
        sent_by: userId,
        type: 'text',
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    await supabase
      .from('chats')
      .update({ 
        last_message: content, 
        last_message_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { 
            ...c, 
            messages: [...c.messages, newMessage],
            last_message: content,
            last_message_time: new Date().toISOString()
          } 
        : c
    ));
  };

  const fetchWhatsAppInstance = async () => {
    if (!clinicId) {
      setWhatsappInstance(null);
      return;
    }
    
    try {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (data) {
        setWhatsappInstance({
          instanceName: data.instance_name,
          status: data.status,
        });
      } else {
        setWhatsappInstance(null);
      }
    } catch (err) {
      console.error('Error fetching WhatsApp instance:', err);
    }
  };

  const fetchEvolutionSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .maybeSingle();

      if (data && data.evolution_api_url && data.evolution_api_key) {
        setEvolutionSettings({
          apiUrl: data.evolution_api_url,
          apiKey: data.evolution_api_key,
        });
      }
    } catch (err) {
      console.error('Error fetching Evolution settings:', err);
    }
  };

  // Buscar settings do usuário quando userId mudar
  useEffect(() => {
    fetchUserSettings();
  }, [userId]);

  // Refetch chats quando userRole/viewMode ou clinicId mudar
  useEffect(() => {
    if (clinicId) {
      console.log('[useChats] Fetching chats - role:', userRole, 'viewMode:', userViewMode);
      fetchChats();
    }
  }, [userRole, userViewMode, clinicId]);

  useEffect(() => {
    console.log('[useChats] useEffect triggered, clinicId:', clinicId);
    
    fetchWhatsAppInstance();
    fetchEvolutionSettings();

    if (!clinicId) {
      console.log('[useChats] No clinicId, skipping subscriptions');
      return;
    }

    console.log('[useChats] Setting up realtime subscriptions...');
    const chatsSubscription = supabase
      .channel(`chats-changes-${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `clinic_id=eq.${clinicId}` }, () => {
        console.log('[useChats] Chat change detected');
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        console.log('[useChats] Message change detected');
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances', filter: `clinic_id=eq.${clinicId}` }, (payload) => {
        console.log('[useChats] WhatsApp instance change detected:', payload);
        // Atualizar imediatamente com os dados do payload se disponível
        if (payload.new && typeof payload.new === 'object' && 'status' in payload.new) {
          const newData = payload.new as { instance_name: string; status: string };
          setWhatsappInstance({
            instanceName: newData.instance_name,
            status: newData.status,
          });
        } else {
          fetchWhatsAppInstance();
        }
      })
      .subscribe();

    return () => {
      console.log('[useChats] Cleaning up subscriptions');
      supabase.removeChannel(chatsSubscription);
    };
  }, [clinicId]);

  return {
    chats,
    loading,
    error,
    whatsappConnected: whatsappInstance?.status === 'connected',
    refetch: fetchChats,
    updateChatStatus,
    sendMessage,
    markAsRead,
  };
}
