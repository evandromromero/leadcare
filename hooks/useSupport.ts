import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Type casting para tabelas novas que ainda não estão nos tipos gerados
const db = supabase as any;
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SupportTicket {
  id: string;
  clinic_id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  clinic?: { name: string };
  user?: { name: string; email: string };
  assignee?: { name: string };
  last_message?: SupportMessage;
  unread_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_from_support: boolean;
  read_at: string | null;
  created_at: string;
  sender?: { name: string };
}

export interface SupportSettings {
  support_enabled: boolean;
  support_online: boolean;
}

export function useSupport(clinicId?: string, userId?: string) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportSettings, setSupportSettings] = useState<SupportSettings>({ support_enabled: false, support_online: false });
  const [clinicSupportEnabled, setClinicSupportEnabled] = useState(true);

  // Buscar configurações de suporte
  const fetchSupportSettings = useCallback(async () => {
    const { data } = await db
      .from('settings')
      .select('support_enabled, support_online')
      .single();
    
    if (data) {
      setSupportSettings(data as SupportSettings);
    }

    // Buscar se a clínica tem suporte habilitado
    if (clinicId) {
      const { data: clinicData } = await db
        .from('clinics')
        .select('support_enabled')
        .eq('id', clinicId)
        .single();
      
      if (clinicData) {
        setClinicSupportEnabled(clinicData.support_enabled ?? true);
      }
    }
  }, [clinicId]);

  // Buscar tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    
    let query = db
      .from('support_tickets')
      .select(`
        *,
        clinic:clinics(name),
        user:users!support_tickets_user_id_fkey(name, email),
        assignee:users!support_tickets_assigned_to_fkey(name)
      `)
      .order('updated_at', { ascending: false });

    // Se for cliente, filtrar por clínica
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Buscar última mensagem e contagem de não lidas para cada ticket
      const ticketsWithMessages = await Promise.all(
        data.map(async (ticket: any) => {
          const { data: lastMsg } = await db
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticket.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count } = await db
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('ticket_id', ticket.id)
            .is('read_at', null)
            .eq('is_from_support', clinicId ? true : false); // Cliente vê não lidas do suporte, suporte vê não lidas do cliente

          return {
            ...ticket,
            last_message: lastMsg,
            unread_count: count || 0,
          };
        })
      );

      setTickets(ticketsWithMessages);
    }

    setLoading(false);
  }, [clinicId]);

  // Buscar mensagens de um ticket
  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await db
      .from('support_messages')
      .select(`
        *,
        sender:users(name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, []);

  // Criar novo ticket
  const createTicket = async (
    subject: string, 
    message: string, 
    category: 'support' | 'improvement' | 'bug' | 'question' | 'other' = 'support',
    isLiveChat: boolean = false
  ) => {
    if (!clinicId || !userId) return null;

    const { data: ticket, error: ticketError } = await db
      .from('support_tickets')
      .insert({
        clinic_id: clinicId,
        user_id: userId,
        subject,
        status: 'open',
        priority: 'medium',
        category,
        is_live_chat: isLiveChat,
      })
      .select()
      .single();

    if (ticketError || !ticket) return null;

    // Criar primeira mensagem
    await db
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: userId,
        content: message,
        is_from_support: false,
      });

    await fetchTickets();
    return ticket;
  };

  // Enviar mensagem
  const sendMessage = async (ticketId: string, content: string, isFromSupport: boolean) => {
    if (!userId) return null;

    const { data, error } = await db
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: userId,
        content,
        is_from_support: isFromSupport,
      })
      .select()
      .single();

    if (!error && data) {
      // Atualizar updated_at do ticket
      await db
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      setMessages(prev => [...prev, data]);
    }

    return data;
  };

  // Marcar mensagens como lidas
  const markMessagesAsRead = async (ticketId: string, isSupport: boolean) => {
    await db
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('ticket_id', ticketId)
      .eq('is_from_support', !isSupport) // Marcar mensagens do outro lado como lidas
      .is('read_at', null);
  };

  // Atualizar status do ticket
  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status']) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await db
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (!error) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
      }
    }
  };

  // Atribuir ticket a um agente
  const assignTicket = async (ticketId: string, agentId: string | null) => {
    const { error } = await db
      .from('support_tickets')
      .update({ 
        assigned_to: agentId, 
        status: agentId ? 'in_progress' : 'open',
        updated_at: new Date().toISOString() 
      })
      .eq('id', ticketId);

    if (!error) {
      await fetchTickets();
    }
  };

  // Toggle suporte online/offline
  const toggleSupportOnline = async () => {
    const newValue = !supportSettings.support_online;
    
    const { data: settingsData } = await db.from('settings').select('id').single();
    const { error } = await db
      .from('settings')
      .update({ support_online: newValue })
      .eq('id', settingsData?.id);

    if (!error) {
      setSupportSettings(prev => ({ ...prev, support_online: newValue }));
    }
  };

  // Toggle suporte habilitado/desabilitado
  const toggleSupportEnabled = async () => {
    const newValue = !supportSettings.support_enabled;
    
    const { data: settingsData } = await db.from('settings').select('id').single();
    const { error } = await db
      .from('settings')
      .update({ support_enabled: newValue })
      .eq('id', settingsData?.id);

    if (!error) {
      setSupportSettings(prev => ({ ...prev, support_enabled: newValue }));
    }
  };

  // Realtime subscriptions
  useEffect(() => {
    let ticketsChannel: RealtimeChannel;
    let messagesChannel: RealtimeChannel;
    let settingsChannel: RealtimeChannel;

    const setupRealtime = () => {
      // Subscription para tickets
      ticketsChannel = supabase
        .channel('support_tickets_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'support_tickets' },
          () => {
            fetchTickets();
          }
        )
        .subscribe();

      // Subscription para mensagens
      messagesChannel = supabase
        .channel('support_messages_changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_messages' },
          (payload) => {
            const newMessage = payload.new as SupportMessage;
            if (selectedTicket && newMessage.ticket_id === selectedTicket.id) {
              // Evitar duplicação - só adiciona se não existir
              setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            }
            fetchTickets(); // Atualizar lista de tickets
          }
        )
        .subscribe();

      // Subscription para settings (status online/offline)
      settingsChannel = supabase
        .channel('support_settings_changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'settings' },
          () => {
            fetchSupportSettings();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (ticketsChannel) supabase.removeChannel(ticketsChannel);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (settingsChannel) supabase.removeChannel(settingsChannel);
    };
  }, [fetchTickets, fetchSupportSettings, selectedTicket]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchSupportSettings();
    fetchTickets();
  }, [fetchSupportSettings, fetchTickets]);

  // Carregar mensagens quando selecionar ticket
  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket, fetchMessages]);

  return {
    tickets,
    messages,
    selectedTicket,
    setSelectedTicket,
    loading,
    supportSettings,
    clinicSupportEnabled,
    createTicket,
    sendMessage,
    markMessagesAsRead,
    updateTicketStatus,
    assignTicket,
    toggleSupportOnline,
    toggleSupportEnabled,
    fetchTickets,
    fetchMessages,
  };
}
