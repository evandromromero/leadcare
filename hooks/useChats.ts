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
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: chatsData, error: chatsError } = await supabase
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
        .eq('clinic_id', clinicId)
        .order('last_message_time', { ascending: false });

      if (chatsError) {
        console.error('[useChats] Error fetching chats:', chatsError);
        setError('Erro ao carregar conversas');
        setLoading(false);
        return;
      }

      const formattedChats: ChatWithMessages[] = (chatsData || []).map(chat => ({
        ...chat,
        messages: [...(chat.messages || [])].sort((a: DbMessage, b: DbMessage) => 
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        ),
        tags: chat.chat_tags?.map((ct: { tags: DbTag }) => ct.tags).filter(Boolean) || [],
      }));

      setChats([...formattedChats]);
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
    
    // Buscar nome do usuário para prefixar a mensagem
    let userName = '';
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();
    
    if (userData) {
      userName = (userData as any).name || '';
    }
    
    // Mensagem com nome do atendente para o WhatsApp
    const whatsappMessage = userName ? `*${userName}:* ${content}` : content;
    
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
            text: whatsappMessage,
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

    // Atribuir chat ao usuário que está respondendo (se ainda não estiver atribuído)
    await supabase
      .from('chats')
      .update({ 
        last_message: content, 
        last_message_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_to: userId
      })
      .eq('id', chatId);

    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { 
            ...c, 
            messages: [...c.messages, newMessage],
            last_message: content,
            last_message_time: new Date().toISOString(),
            assigned_to: userId
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
        .order('status', { ascending: false });

      if (data && data.length > 0) {
        const connectedInstance = data.find(i => i.status === 'connected');
        const instanceToUse = connectedInstance || data[0];
        setWhatsappInstance({
          instanceName: instanceToUse.instance_name,
          status: instanceToUse.status,
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
      fetchChats();
    }
  }, [userRole, userViewMode, clinicId]);

  useEffect(() => {
    fetchWhatsAppInstance();
    fetchEvolutionSettings();

    if (!clinicId) return;

    const chatsSubscription = supabase
      .channel(`chats-changes-${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `clinic_id=eq.${clinicId}` }, () => {
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances', filter: `clinic_id=eq.${clinicId}` }, (payload) => {
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

    const messagesSubscription = supabase
      .channel(`messages-changes-${clinicId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchChats();
      })
      .subscribe();

    // Polling a cada 7 segundos como fallback
    const pollingInterval = setInterval(() => {
      fetchChats();
    }, 7000);

    return () => {
      supabase.removeChannel(chatsSubscription);
      supabase.removeChannel(messagesSubscription);
      clearInterval(pollingInterval);
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
