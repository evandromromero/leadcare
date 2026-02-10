import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';
import { canSendMessage, recordMessageSent, waitForRateLimit } from '../lib/rateLimiter';

export type DbChat = Tables<'chats'>;
export type DbMessage = Tables<'messages'>;
export type DbTag = Tables<'tags'>;

export interface ChatWithMessages extends DbChat {
  messages: DbMessage[];
  tags: DbTag[];
}

interface OptimisticMessage {
  id: string;
  chat_id: string;
  content: string;
  type: string;
  is_from_client: boolean;
  sent_by: string | null;
  created_at: string;
  quoted_message_id?: string | null;
  quoted_content?: string | null;
  quoted_sender_name?: string | null;
  _optimistic?: boolean;
}

interface UseChatsReturn {
  chats: ChatWithMessages[];
  loading: boolean;
  error: string | null;
  whatsappConnected: boolean;
  refetch: () => Promise<void>;
  updateChatStatus: (chatId: string, status: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, userId: string) => Promise<{ success: boolean; error?: string } | void>;
  editMessage: (messageId: string, chatId: string, newContent: string, phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  markAsRead: (chatId: string) => Promise<void>;
  markAsUnread: (chatId: string) => Promise<void>;
  fetchAndUpdateAvatar: (chatId: string, phoneNumber: string) => Promise<void>;
  fetchMessages: (chatId: string, limit?: number, before?: string) => Promise<{ messages: DbMessage[]; hasMore: boolean }>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  addOptimisticMessage: (chatId: string, content: string, userId: string, replyingTo?: { id: string; content: string; senderName: string } | null) => string;
  updateOptimisticMessage: (chatId: string, tempId: string, realMessage: DbMessage | null) => void;
}

const MESSAGES_PER_PAGE = 50;

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
      // Carregar apenas metadados dos chats (sem mensagens)
      const { data: chatsData, error: chatsError } = await (supabase as any)
        .from('chats')
        .select(`
          id, clinic_id, lead_id, client_name, phone_number, avatar_url, avatar_updated_at, status,
          unread_count, last_message, last_message_time, assigned_to, created_at,
          updated_at, instance_id, locked_by, locked_at, last_message_from_client,
          channel, is_pinned, is_group, group_id, source_id,
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

      
      // Preservar mensagens e last_message locais se forem mais recentes
      setChats(prevChats => {
        const formattedChats: ChatWithMessages[] = (chatsData || []).map(chat => {
          const existingChat = prevChats.find(c => c.id === chat.id);
          
          // Preservar mensagens locais
          const messages = existingChat?.messages || [];
          
          // Preservar last_message local se for mais recente (evita sobrescrever otimista)
          const localTime = new Date(existingChat?.last_message_time || 0).getTime();
          const remoteTime = new Date(chat.last_message_time || 0).getTime();
          const useLocalData = existingChat && localTime >= remoteTime;
          
          return {
            ...chat,
            messages,
            tags: chat.chat_tags?.map((ct: { tags: DbTag }) => ct.tags).filter(Boolean) || [],
            // Manter last_message local se for mais recente
            last_message: useLocalData ? existingChat.last_message : chat.last_message,
            last_message_time: useLocalData ? existingChat.last_message_time : chat.last_message_time,
          };
        });

        // Ordenar: fixados primeiro, depois por last_message_time
        const sortedChats = formattedChats.sort((a, b) => {
          const aPinned = (a as any).is_pinned || false;
          const bPinned = (b as any).is_pinned || false;
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
        });

        return sortedChats;
      });
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

    // Se o status for "Convertido", enviar conversão para Google Ads
    if (status === 'Convertido' && clinicId) {
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        // Chamar Edge Function em background (não bloquear a UI)
        supabase.functions.invoke('google-ads-conversion', {
          body: {
            clinic_id: clinicId,
            chat_id: chatId,
            phone_number: chat.phone_number,
            gclid: (chat as any).gclid || null,
          }
        }).then(({ error: convError }) => {
          if (convError) {
            console.error('Error sending conversion to Google Ads:', convError);
          } else {
            console.log('Conversion sent to Google Ads for chat:', chatId);
          }
        }).catch(err => {
          console.error('Error calling google-ads-conversion:', err);
        });
      }
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

    // Marcar como lido no WhatsApp via Evolution API (em background)
    if (whatsappInstance?.status === 'connected' && evolutionSettings && chat.phone_number) {
      try {
        const isGroup = (chat as any).is_group;
        const remoteJid = isGroup 
          ? (chat as any).group_id 
          : `${chat.phone_number.replace(/\D/g, '')}@s.whatsapp.net`;
        
        // Buscar última mensagem do cliente para marcar como lida
        const lastClientMessage = chat.messages?.filter(m => m.is_from_client).pop();
        
        if (lastClientMessage?.remote_message_id) {
          await fetch(`${evolutionSettings.apiUrl}/chat/markMessageAsRead/${whatsappInstance.instanceName}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionSettings.apiKey,
            },
            body: JSON.stringify({
              readMessages: [{
                remoteJid: remoteJid,
                fromMe: false,
                id: lastClientMessage.remote_message_id
              }]
            }),
          });
        }
      } catch (err) {
        console.error('Error marking as read on WhatsApp:', err);
      }
    }
  };

  const markAsUnread = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const { error } = await supabase
      .from('chats')
      .update({ unread_count: 1, updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) {
      console.error('Error marking chat as unread:', error);
      return;
    }

    setChats(prev => prev.map(c => 
      c.id === chatId ? { ...c, unread_count: 1 } : c
    ));
  };

  const sendMessage = async (chatId: string, content: string, userId: string): Promise<{ success: boolean; error?: string }> => {
    const chat = chats.find(c => c.id === chatId);
    
    // Se o canal é Instagram ou Facebook, não enviar via WhatsApp (já foi enviado via meta-send)
    const chatChannel = (chat as any)?.channel || 'whatsapp';
    if (chatChannel === 'instagram' || chatChannel === 'facebook') {
      // Apenas salvar no banco, o envio já foi feito via meta-send
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
        console.error('Error saving message:', error);
        return { success: false, error: error.message };
      }

      // Atualizar chat
      await supabase
        .from('chats')
        .update({ 
          last_message: content, 
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assigned_to: userId
        })
        .eq('id', chatId);

      setChats(prev => {
        const chatIndex = prev.findIndex(c => c.id === chatId);
        if (chatIndex === -1) return prev;
        
        const updatedChat = {
          ...prev[chatIndex],
          messages: [...prev[chatIndex].messages, newMessage as any],
          last_message: content,
          last_message_time: new Date().toISOString()
        };
        
        const newChats = [...prev];
        newChats.splice(chatIndex, 1);
        return [updatedChat, ...newChats];
      });

      return { success: true };
    }
    
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
      // Verificar rate limit antes de enviar
      const rateLimitCheck = canSendMessage(whatsappInstance.instanceName);
      if (!rateLimitCheck.allowed) {
        console.warn('Rate limit atingido:', rateLimitCheck.reason);
        return { success: false, error: rateLimitCheck.reason };
      }

      try {
        let formattedPhone = chat.phone_number.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        // Aguardar delay mínimo entre mensagens
        await waitForRateLimit(whatsappInstance.instanceName);
        
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
          
          // Registrar envio no rate limiter
          recordMessageSent(whatsappInstance.instanceName);
          
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

          setChats(prev => {
            const chatIndex = prev.findIndex(c => c.id === chatId);
            if (chatIndex === -1) return prev;
            
            const updatedChat = {
              ...prev[chatIndex],
              messages: [...prev[chatIndex].messages, newMessage as any],
              last_message: content,
              last_message_time: new Date().toISOString()
            };
            
            // Mover chat para o topo
            return [
              updatedChat,
              ...prev.slice(0, chatIndex),
              ...prev.slice(chatIndex + 1)
            ];
          });
          return { success: true };
        }
      } catch (err) {
        console.error('Error sending WhatsApp message:', err);
        return { success: false, error: 'Erro ao enviar mensagem' };
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

    setChats(prev => {
      const chatIndex = prev.findIndex(c => c.id === chatId);
      if (chatIndex === -1) return prev;
      
      const updatedChat = {
        ...prev[chatIndex],
        messages: [...prev[chatIndex].messages, newMessage],
        last_message: content,
        last_message_time: new Date().toISOString(),
        assigned_to: userId
      };
      
      // Mover chat para o topo
      return [
        updatedChat,
        ...prev.slice(0, chatIndex),
        ...prev.slice(chatIndex + 1)
      ];
    });
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

    // Realtime via Broadcast (webhook envia quando chega mensagem)
    const subscription = supabase
      .channel('leadcare-updates')
      .on('broadcast', { event: 'new_message' }, async (payload) => {
        console.log('[Realtime] Broadcast received:', payload);
        // Só atualiza se for da clínica atual
        if (payload.payload?.clinic_id === clinicId) {
          const chatId = payload.payload?.chat_id;
          if (chatId) {
            // Buscar chat atualizado COM a última mensagem
            const { data: chatData } = await supabase
              .from('chats')
              .select('id, unread_count, last_message, last_message_time, status')
              .eq('id', chatId)
              .single();
            
            // Buscar a última mensagem do chat
            const { data: newMessage } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_id', chatId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (chatData) {
              setChats(prev => {
                const chatIndex = prev.findIndex(c => c.id === chatId);
                
                // Se chat não existe na lista, fazer refetch completo
                if (chatIndex === -1) {
                  console.log('[Realtime] Chat not in list, fetching all chats');
                  fetchChats();
                  return prev;
                }
                
                // Atualizar chat com novos dados e adicionar mensagem
                const existingChat = prev[chatIndex];
                const existingMessages = existingChat.messages || [];
                
                console.log('[Realtime] Processing message:', {
                  chatId,
                  newMessageId: newMessage?.id,
                  newMessageContent: newMessage?.content,
                  existingMessagesCount: existingMessages.length,
                  fromClient: payload.payload?.from_client
                });
                
                // Verificar se a mensagem já existe (incluindo mensagens otimistas com temp_)
                const messageExists = newMessage && existingMessages.some(m => 
                  m.id === newMessage.id || 
                  (m.id.startsWith('temp_') && m.content === newMessage.content && m.chat_id === newMessage.chat_id)
                );
                
                // Se mensagem já existe e dados do chat não mudaram, não atualizar
                if (messageExists && 
                    existingChat.last_message === chatData.last_message &&
                    existingChat.unread_count === chatData.unread_count) {
                  return prev;
                }
                
                const updatedMessages = messageExists 
                  ? existingMessages 
                  : newMessage 
                    ? [...existingMessages, newMessage]
                    : existingMessages;
                
                if (!messageExists && newMessage) {
                  console.log('[Realtime] Adding new message to chat panel:', newMessage.content);
                }
                
                // Preservar last_message local se for mais recente que o do banco
                // (evita sobrescrever atualização otimista com dados antigos)
                const localTime = new Date(existingChat.last_message_time || 0).getTime();
                const remoteTime = new Date(chatData.last_message_time || 0).getTime();
                const useLocalLastMessage = localTime >= remoteTime;
                
                const updatedChat = { 
                  ...existingChat, 
                  ...chatData,
                  messages: updatedMessages,
                  // Manter last_message local se for mais recente
                  last_message: useLocalLastMessage ? existingChat.last_message : chatData.last_message,
                  last_message_time: useLocalLastMessage ? existingChat.last_message_time : chatData.last_message_time,
                };
                
                // Remover chat da posição atual e reordenar
                const otherChats = [...prev.slice(0, chatIndex), ...prev.slice(chatIndex + 1)];
                const allChats = [updatedChat, ...otherChats];
                
                // Reordenar: fixados primeiro, depois por last_message_time
                const sortedList = allChats.sort((a, b) => {
                  const aPinned = (a as any).is_pinned || false;
                  const bPinned = (b as any).is_pinned || false;
                  if (aPinned && !bPinned) return -1;
                  if (!aPinned && bPinned) return 1;
                  return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
                });
                
                return sortedList;
              });
            }
          }
        }
      })
      .subscribe((status, err) => {
        console.log('[Realtime] Broadcast status:', status, err ? `Error: ${err.message}` : '');
      });

    // Nota: postgres_changes removido pois causa erro de binding
    // O broadcast já é suficiente para atualizar em tempo real

    // Polling de backup a cada 30 segundos (caso broadcast falhe)
    const pollingInterval = setInterval(() => {
      supabase
        .from('chats')
        .select('id, unread_count, last_message, last_message_time, status')
        .eq('clinic_id', clinicId)
        .then(({ data: chatsData }) => {
          if (!chatsData) return;
          setChats(prev => {
            let hasChanges = false;
            const updated = prev.map(chat => {
              const newData = chatsData.find(c => c.id === chat.id);
              if (newData && (
                chat.unread_count !== newData.unread_count ||
                chat.last_message !== newData.last_message
              )) {
                // Preservar last_message local se for mais recente (evita sobrescrever otimista)
                const localTime = new Date(chat.last_message_time || 0).getTime();
                const remoteTime = new Date(newData.last_message_time || 0).getTime();
                if (localTime >= remoteTime) {
                  // Dados locais são mais recentes, não atualizar last_message
                  if (chat.unread_count !== newData.unread_count) {
                    hasChanges = true;
                    return { ...chat, unread_count: newData.unread_count };
                  }
                  return chat;
                }
                hasChanges = true;
                // Preservar mensagens existentes ao atualizar metadados
                return { ...chat, ...newData, messages: chat.messages };
              }
              return chat;
            });
            return hasChanges ? updated : prev;
          });
        });
    }, 30000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollingInterval);
    };
  }, [clinicId]);

  // Editar mensagem enviada (até 15 minutos após envio)
  const editMessage = async (messageId: string, chatId: string, newContent: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> => {
    if (!whatsappInstance || whatsappInstance.status !== 'connected' || !evolutionSettings) {
      return { success: false, error: 'WhatsApp não conectado' };
    }

    try {
      // Buscar chat para verificar se é grupo
      const targetChat = chats.find(c => c.id === chatId);
      const isGroupChat = (targetChat as any)?.is_group === true;
      const groupId = (targetChat as any)?.group_id;

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
      if (!isGroupChat && !formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Determinar remoteJid baseado se é grupo ou individual
      const remoteJid = isGroupChat ? groupId : `${formattedPhone}@s.whatsapp.net`;

      // Chamar API da Evolution para editar mensagem (POST /chat/updateMessage)
      const response = await fetch(`${evolutionSettings.apiUrl}/chat/updateMessage/${whatsappInstance.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionSettings.apiKey,
        },
        body: JSON.stringify({
          number: isGroupChat ? groupId : formattedPhone,
          key: {
            remoteJid: remoteJid,
            fromMe: true,
            id: message.remote_message_id,
            participant: remoteJid,
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
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        
        const updatedMessages = c.messages.map(m => 
          m.id === messageId ? { ...m, content: newContent } : m
        );
        
        // Verificar se a mensagem editada é a última (para atualizar last_message na lateral)
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        const isLastMessage = lastMessage?.id === messageId;
        
        return { 
          ...c, 
          messages: updatedMessages,
          last_message: isLastMessage ? newContent : c.last_message
        };
      }));

      // Atualizar last_message no banco se for a última mensagem
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg?.id === messageId) {
          await supabase
            .from('chats')
            .update({ last_message: newContent })
            .eq('id', chatId);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error editing message:', err);
      return { success: false, error: 'Erro ao editar mensagem' };
    }
  };

  // Buscar e atualizar foto de perfil do WhatsApp (salva no Storage para não expirar)
  const fetchAndUpdateAvatar = async (chatId: string, phoneNumber: string) => {
    if (!whatsappInstance || whatsappInstance.status !== 'connected' || !evolutionSettings) return;
    
    // Verificar se precisa atualizar
    const existingChat = chats.find(c => c.id === chatId);
    const avatarUrl = existingChat?.avatar_url;
    const isStorageUrl = avatarUrl && avatarUrl.includes('supabase.co/storage');
    const avatarUpdatedAt = (existingChat as any)?.avatar_updated_at;
    
    if (isStorageUrl && avatarUpdatedAt) {
      const lastUpdate = new Date(avatarUpdatedAt).getTime();
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (lastUpdate > sevenDaysAgo) {
        return; // Avatar permanente e atualizado recentemente
      }
    }
    
    const forceRefresh = isStorageUrl; // Se já tem no storage mas está velho, forçar refresh
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    try {
      // Buscar URL do avatar na Evolution API
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
      const tempAvatarUrl = data.profilePictureUrl || data.picture || null;
      
      if (tempAvatarUrl) {
        // Chamar Edge Function para baixar e salvar no Storage
        const { data: saveResult, error: saveError } = await supabase.functions.invoke('save-avatar', {
          body: {
            chatId,
            phoneNumber: formattedPhone,
            avatarUrl: tempAvatarUrl,
            forceRefresh,
          },
        });
        
        if (saveError) {
          console.error('Error saving avatar to storage:', saveError);
          // Fallback: usar URL temporária
          const now = new Date().toISOString();
          await (supabase as any)
            .from('chats')
            .update({ avatar_url: tempAvatarUrl, avatar_updated_at: now, updated_at: now })
            .eq('id', chatId);
          
          setChats(prev => prev.map(c => 
            c.id === chatId ? { ...c, avatar_url: tempAvatarUrl } : c
          ));
          return;
        }
        
        const permanentUrl = saveResult?.avatarUrl || tempAvatarUrl;
        
        // Atualizar no estado local
        setChats(prev => prev.map(c => 
          c.id === chatId ? { ...c, avatar_url: permanentUrl } : c
        ));
      }
    } catch (err) {
      console.error('Error fetching profile picture:', err);
    }
  };

  // Buscar mensagens de um chat com paginação
  const fetchMessages = async (chatId: string, limit: number = MESSAGES_PER_PAGE, before?: string): Promise<{ messages: DbMessage[]; hasMore: boolean }> => {
    console.log('[fetchMessages] Loading messages for chat:', chatId);
    let query = supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Buscar 1 a mais para saber se tem mais

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], hasMore: false };
    }

    const hasMore = (data?.length || 0) > limit;
    const messages = (data || []).slice(0, limit).reverse(); // Reverter para ordem cronológica
    console.log('[fetchMessages] Loaded', messages.length, 'messages for chat:', chatId);

    // Atualizar estado local do chat
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      
      if (before) {
        // Carregar mais antigas: adicionar no início
        return { ...chat, messages: [...messages, ...chat.messages] };
      } else {
        // Primeira carga: substituir
        return { ...chat, messages };
      }
    }));

    return { messages, hasMore };
  };

  // Carregar mais mensagens antigas
  const loadMoreMessages = async (chatId: string): Promise<void> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || !chat.messages.length) return;

    const oldestMessage = chat.messages[0];
    await fetchMessages(chatId, MESSAGES_PER_PAGE, oldestMessage.created_at || undefined);
  };

  // Fixar/desafixar chat
  const togglePinChat = async (chatId: string): Promise<void> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const newPinnedState = !(chat as any).is_pinned;

    const { error } = await supabase
      .from('chats')
      .update({ is_pinned: newPinnedState } as any)
      .eq('id', chatId);

    if (error) {
      console.error('Error toggling pin:', error);
      return;
    }

    // Atualizar estado local e reordenar
    setChats(prev => {
      const updated = prev.map(c => 
        c.id === chatId ? { ...c, is_pinned: newPinnedState } as any : c
      );
      // Reordenar: fixados primeiro, depois por last_message_time
      return updated.sort((a, b) => {
        const aPinned = (a as any).is_pinned || false;
        const bPinned = (b as any).is_pinned || false;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
      });
    });
  };

  // Adicionar mensagem otimista (aparece instantaneamente na UI)
  const addOptimisticMessage = (
    chatId: string, 
    content: string, 
    odUserId: string, 
    replyingTo?: { id: string; content: string; senderName: string } | null
  ): string => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const optimisticMsg: OptimisticMessage = {
      id: tempId,
      chat_id: chatId,
      content,
      type: 'text',
      is_from_client: false,
      sent_by: odUserId,
      created_at: now,
      quoted_message_id: replyingTo?.id || null,
      quoted_content: replyingTo?.content || null,
      quoted_sender_name: replyingTo?.senderName || null,
      _optimistic: true,
    };

    setChats(prev => {
      const chatIndex = prev.findIndex(c => c.id === chatId);
      if (chatIndex === -1) return prev;
      
      const updatedChat = {
        ...prev[chatIndex],
        messages: [...prev[chatIndex].messages, optimisticMsg as any],
        last_message: content,
        last_message_time: now,
        last_message_from_client: false,
      };
      
      // Mover chat para o topo (após os fixados)
      const pinnedChats = prev.filter((c, i) => i !== chatIndex && (c as any).is_pinned);
      const unpinnedChats = prev.filter((c, i) => i !== chatIndex && !(c as any).is_pinned);
      
      if ((updatedChat as any).is_pinned) {
        return [updatedChat, ...pinnedChats, ...unpinnedChats];
      } else {
        return [...pinnedChats, updatedChat, ...unpinnedChats];
      }
    });

    return tempId;
  };

  // Atualizar mensagem otimista com dados reais ou remover em caso de erro
  const updateOptimisticMessage = (chatId: string, tempId: string, realMessage: DbMessage | null) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      
      if (realMessage) {
        // Substituir mensagem otimista pela real
        return {
          ...chat,
          messages: chat.messages.map(m => 
            m.id === tempId ? realMessage : m
          ),
        };
      } else {
        // Remover mensagem otimista (erro no envio)
        return {
          ...chat,
          messages: chat.messages.filter(m => m.id !== tempId),
        };
      }
    }));
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
    markAsUnread,
    fetchAndUpdateAvatar,
    fetchMessages,
    loadMoreMessages,
    togglePinChat,
    addOptimisticMessage,
    updateOptimisticMessage,
  };
}
