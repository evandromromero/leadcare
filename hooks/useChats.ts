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
  editMessage: (messageId: string, chatId: string, newContent: string, phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  markAsRead: (chatId: string) => Promise<void>;
  fetchAndUpdateAvatar: (chatId: string, phoneNumber: string) => Promise<void>;
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
    console.log('WhatsApp send check:', { 
      instance: whatsappInstance?.instanceName, 
      status: whatsappInstance?.status, 
      hasSettings: !!evolutionSettings,
      phone: chat?.phone_number 
    });
    
    if (whatsappInstance && whatsappInstance.status === 'connected' && evolutionSettings && chat?.phone_number) {
      try {
        let formattedPhone = chat.phone_number.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        console.log('Sending WhatsApp message via instance:', whatsappInstance.instanceName, 'to:', formattedPhone);

        const response = await fetch(`${evolutionSettings.apiUrl}/message/sendText/${whatsappInstance.instanceName}`, {
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
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('WhatsApp send failed:', response.status, errorData);
        } else {
          const responseData = await response.json().catch(() => ({}));
          console.log('WhatsApp message sent successfully to:', formattedPhone, 'messageId:', responseData?.key?.id);
          
          // Salvar mensagem com remote_message_id para permitir edição
          const remoteMessageId = responseData?.key?.id || null;
          const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
              chat_id: chatId,
              content,
              is_from_client: false,
              sent_by: userId,
              type: 'text',
              remote_message_id: remoteMessageId,
            })
            .select()
            .single();

          if (error) {
            console.error('Error sending message:', error);
            return;
          }

          // Atribuir chat ao usuário que está respondendo
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
              ? { ...c, messages: [...c.messages, newMessage as any], last_message: content, last_message_time: new Date().toISOString() }
              : c
          ));
          return;
        }
      } catch (err) {
        console.error('Error sending WhatsApp message:', err);
      }
    }

    // Fallback: salvar mensagem sem remote_message_id (WhatsApp não conectado)
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
      // Buscar apenas a instância conectada primeiro
      const { data: connectedData, error: connectedError } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1);

      if (!connectedError && connectedData && connectedData.length > 0) {
        console.log('WhatsApp connected instance found:', connectedData[0]);
        setWhatsappInstance({
          instanceName: connectedData[0].instance_name,
          status: connectedData[0].status,
        });
        return;
      }

      // Se não encontrou conectada, buscar qualquer uma
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .limit(1);

      if (error) {
        console.error('Error fetching WhatsApp instances:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log('WhatsApp instance selected:', data[0]);
        setWhatsappInstance({
          instanceName: data[0].instance_name,
          status: data[0].status,
        });
      } else {
        console.log('No WhatsApp instances found for clinic:', clinicId);
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

  // Editar mensagem enviada (até 15 minutos após envio)
  const editMessage = async (messageId: string, chatId: string, newContent: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> => {
    if (!whatsappInstance || whatsappInstance.status !== 'connected' || !evolutionSettings) {
      return { success: false, error: 'WhatsApp não conectado' };
    }

    try {
      // Buscar mensagem para obter remote_message_id
      const { data: messageData } = await supabase
        .from('messages')
        .select('remote_message_id, created_at, is_from_client')
        .eq('id', messageId)
        .single();

      const message = messageData as unknown as { remote_message_id: string | null; created_at: string; is_from_client: boolean } | null;

      if (!message) {
        return { success: false, error: 'Mensagem não encontrada' };
      }

      if (message.is_from_client) {
        return { success: false, error: 'Só é possível editar mensagens enviadas por você' };
      }

      if (!message.remote_message_id) {
        return { success: false, error: 'Mensagem não pode ser editada (sem ID do WhatsApp)' };
      }

      // Verificar se passou mais de 15 minutos
      const messageTime = new Date(message.created_at).getTime();
      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;
      if (now - messageTime > fifteenMinutes) {
        return { success: false, error: 'Só é possível editar mensagens até 15 minutos após o envio' };
      }

      // Formatar número
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Chamar API da Evolution para editar mensagem (POST /chat/updateMessage)
      const response = await fetch(`${evolutionSettings.apiUrl}/chat/updateMessage/${whatsappInstance.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionSettings.apiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: true,
            id: message.remote_message_id,
            participant: `${formattedPhone}@s.whatsapp.net`,
          },
          text: newContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Edit message failed:', response.status, errorData);
        return { success: false, error: errorData.message || 'Erro ao editar mensagem no WhatsApp' };
      }

      // Atualizar mensagem no banco de dados
      await supabase
        .from('messages')
        .update({ content: newContent })
        .eq('id', messageId);

      // Atualizar estado local
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { 
              ...c, 
              messages: c.messages.map(m => 
                m.id === messageId ? { ...m, content: newContent } : m
              )
            }
          : c
      ));

      return { success: true };
    } catch (err) {
      console.error('Error editing message:', err);
      return { success: false, error: 'Erro ao editar mensagem' };
    }
  };

  // Buscar e atualizar foto de perfil do WhatsApp
  const fetchAndUpdateAvatar = async (chatId: string, phoneNumber: string) => {
    if (!whatsappInstance || whatsappInstance.status !== 'connected' || !evolutionSettings) return;
    
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    try {
      const response = await fetch(`${evolutionSettings.apiUrl}/chat/fetchProfilePictureUrl/${whatsappInstance.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionSettings.apiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
        }),
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const avatarUrl = data.profilePictureUrl || data.picture || null;
      
      if (avatarUrl) {
        // Atualizar no banco de dados
        await supabase
          .from('chats')
          .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq('id', chatId);
        
        // Atualizar no estado local
        setChats(prev => prev.map(c => 
          c.id === chatId ? { ...c, avatar_url: avatarUrl } : c
        ));
      }
    } catch (err) {
      console.error('Error fetching profile picture:', err);
    }
  };

  return {
    chats,
    loading,
    error,
    whatsappConnected: whatsappInstance?.status === 'connected',
    refetch: fetchChats,
    updateChatStatus,
    sendMessage,
    editMessage,
    markAsRead,
    fetchAndUpdateAvatar,
  };
}
