
import React, { useState, useEffect, useRef } from 'react';
import { GlobalState } from '../types';
import { useChats, ChatWithMessages, DbTag } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { hasPermission } from '../lib/permissions';

const DEFAULT_QUICK_REPLIES = [
  { id: '1', text: 'Olá! Como posso ajudar você hoje?' },
  { id: '2', text: 'Obrigado pelo contato! Em breve retornaremos.' },
  { id: '3', text: 'Poderia me informar seu nome completo?' },
];

interface InboxProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

type FilterType = 'todos' | 'nao_lidos' | 'aguardando' | 'grupos' | 'followup';

const PIPELINE_STAGES = [
  { value: 'Novo Lead', label: 'Novo Lead', color: '#0891b2' },
  { value: 'Agendado', label: 'Agendado', color: '#8b5cf6' },
  { value: 'Em Atendimento', label: 'Em Atendimento', color: '#f59e0b' },
  { value: 'Convertido', label: 'Convertido', color: '#10b981' },
  { value: 'Perdido', label: 'Perdido', color: '#ef4444' },
];

const Inbox: React.FC<InboxProps> = ({ state, setState }) => {
  const { user } = useAuth();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, sendMessage, markAsRead, updateChatStatus, refetch } = useChats(clinicId, user?.id);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  const canSendMessage = hasPermission(user?.role, 'send_message');
  const canMoveLead = hasPermission(user?.role, 'move_lead');
  const canAddPayment = hasPermission(user?.role, 'add_payment');
  const canAddQuote = hasPermission(user?.role, 'add_quote');
  
  // Estados para modais
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [availableTags, setAvailableTags] = useState<DbTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  // Estados para notas/observações
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string; user_name: string }>>([]);
  const [savingNote, setSavingNote] = useState(false);
  
  // Estados para orçamentos
  const [quotes, setQuotes] = useState<Array<{
    id: string;
    service_type: string;
    value: number;
    status: 'pending' | 'approved' | 'rejected';
    notes: string | null;
    created_at: string;
  }>>([]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ service_type: '', value: '', notes: '' });
  const [savingQuote, setSavingQuote] = useState(false);
  
  // Estados para origem do lead
  const [leadSources, setLeadSources] = useState<Array<{ id: string; name: string; code: string | null; color: string }>>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceForm, setNewSourceForm] = useState({ name: '', code: '' });
  const [savingSource, setSavingSource] = useState(false);
  
  // Estados para pagamentos/negociações
  const [payments, setPayments] = useState<Array<{
    id: string;
    value: number;
    description: string | null;
    payment_date: string;
    created_at: string;
  }>>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ value: '', description: '', payment_date: new Date().toISOString().split('T')[0] });
  const [savingPayment, setSavingPayment] = useState(false);
  
  // Estados para tarefas
  const [tasks, setTasks] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    completed: boolean;
    created_at: string;
  }>>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '' });
  const [savingTask, setSavingTask] = useState(false);
  
  // Estados para mensagens agendadas
  const [scheduledMessages, setScheduledMessages] = useState<Array<{
    id: string;
    message: string;
    scheduled_for: string;
    status: 'pending' | 'sent' | 'cancelled';
    created_at: string;
  }>>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ message: '', scheduled_date: '', scheduled_time: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  // Estados para envio de mídia
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para bloqueio de conversa
  const [chatLock, setChatLock] = useState<{ locked_by: string | null; locked_by_name: string | null } | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  
  // Estados para encaminhamento de atendimento
  const [clinicUsers, setClinicUsers] = useState<Array<{ id: string; name: string; role: string; status: string }>>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const [forwardWithLock, setForwardWithLock] = useState(true);
  const [savingForward, setSavingForward] = useState(false);
  const [chatAssignedTo, setChatAssignedTo] = useState<{ id: string; name: string } | null>(null);
  
  // Cache de nomes de usuários para exibir nas mensagens
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  
  // Chats com follow-up pendente (mensagens agendadas) - inclui data/hora
  const [followupData, setFollowupData] = useState<Record<string, { scheduled_for: string; message: string }>>({});
  
  // Estados para mensagens rápidas do banco
  const [quickReplies, setQuickReplies] = useState<Array<{ id: string; text: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Emojis comuns
  const commonEmojis = ['😀', '😂', '😍', '🥰', '😊', '👍', '👏', '🙏', '❤️', '🔥', '✅', '⭐', '🎉', '💪', '🤝', '👋', '😉', '🤔', '😅', '🙌'];

  // Buscar mensagens rápidas do banco
  useEffect(() => {
    const fetchQuickReplies = async () => {
      if (!clinicId) return;
      const { data } = await supabase
        .from('quick_replies' as any)
        .select('id, text')
        .eq('clinic_id', clinicId)
        .order('created_at');
      if (data && data.length > 0) {
        setQuickReplies(data as Array<{ id: string; text: string }>);
      } else {
        setQuickReplies(DEFAULT_QUICK_REPLIES);
      }
    };
    fetchQuickReplies();
  }, [clinicId]);

  // Buscar usuários da clínica para encaminhamento
  useEffect(() => {
    const fetchClinicUsers = async () => {
      if (!clinicId) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'Ativo')
        .order('name');
      
      console.log('[Inbox] Buscando usuários da clínica:', clinicId, 'Resultado:', data, 'Erro:', error);
      
      if (data) {
        setClinicUsers(data as Array<{ id: string; name: string; role: string; status: string }>);
      }
    };
    fetchClinicUsers();
  }, [clinicId]);

  // Buscar chats com follow-up pendente (mensagens agendadas)
  useEffect(() => {
    const fetchFollowupChats = async () => {
      if (!clinicId || !user?.id) return;
      
      const { data } = await supabase
        .from('scheduled_messages' as any)
        .select('chat_id, scheduled_for, message')
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .eq('created_by', user.id)
        .order('scheduled_for', { ascending: true });
      
      if (data) {
        const followups: Record<string, { scheduled_for: string; message: string }> = {};
        (data as any[]).forEach(d => {
          // Pegar apenas o primeiro (mais próximo) se houver múltiplos
          if (!followups[d.chat_id]) {
            followups[d.chat_id] = { scheduled_for: d.scheduled_for, message: d.message };
          }
        });
        setFollowupData(followups);
      }
    };
    
    fetchFollowupChats();
  }, [clinicId, user?.id]);
  
  // Ref para auto-scroll das mensagens
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Enviar resposta rápida
  const handleQuickReply = (text: string) => {
    setMsgInput(text);
    setShowQuickReplies(false);
  };

  // Buscar tags disponíveis da clínica
  const fetchAvailableTags = async () => {
    if (!clinicId) return;
    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name');
      
      if (!error && data) {
        setAvailableTags(data);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // Alterar etapa do funil
  const handleChangeStage = async (newStatus: string) => {
    if (!selectedChatId) return;
    await updateChatStatus(selectedChatId, newStatus);
    setShowStageDropdown(false);
  };

  // Buscar responsável atual do chat
  const fetchChatAssignment = async (chatId: string) => {
    const { data: chatData } = await supabase
      .from('chats')
      .select('assigned_to, locked_by')
      .eq('id', chatId)
      .single();
    
    if (chatData?.assigned_to) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', (chatData as any).assigned_to)
        .single();
      
      if (userData) {
        setChatAssignedTo({ id: (userData as any).id, name: (userData as any).name });
      } else {
        setChatAssignedTo(null);
      }
    } else {
      setChatAssignedTo(null);
    }
  };

  // Encaminhar conversa para outro usuário
  const handleForwardChat = async () => {
    if (!selectedChatId || !forwardingTo) return;
    
    setSavingForward(true);
    try {
      const updateData: any = {
        assigned_to: forwardingTo,
        updated_at: new Date().toISOString(),
      };
      
      // Se marcou para bloquear, adiciona o bloqueio
      if (forwardWithLock) {
        updateData.locked_by = forwardingTo;
        updateData.locked_at = new Date().toISOString();
      }
      
      await supabase
        .from('chats')
        .update(updateData)
        .eq('id', selectedChatId);
      
      // Atualizar estado local
      const forwardedUser = clinicUsers.find(u => u.id === forwardingTo);
      if (forwardedUser) {
        setChatAssignedTo({ id: forwardedUser.id, name: forwardedUser.name });
      }
      
      // Se bloqueou para outro usuário, mostrar o lock
      if (forwardWithLock && forwardingTo !== user?.id) {
        setChatLock({ 
          locked_by: forwardingTo, 
          locked_by_name: forwardedUser?.name || 'Outro usuário' 
        });
      }
      
      setShowForwardModal(false);
      setForwardingTo(null);
      refetch();
    } catch (err) {
      console.error('Error forwarding chat:', err);
    } finally {
      setSavingForward(false);
    }
  };

  // Liberar conversa (remover bloqueio e responsável)
  const handleReleaseChat = async () => {
    if (!selectedChatId) return;
    
    try {
      await supabase
        .from('chats')
        .update({ 
          locked_by: null, 
          locked_at: null,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', selectedChatId);
      
      setChatLock(null);
      refetch();
    } catch (err) {
      console.error('Error releasing chat:', err);
    }
  };

  // Assumir atendimento
  const handleAssumeChat = async () => {
    if (!selectedChatId || !user?.id) return;
    
    try {
      await supabase
        .from('chats')
        .update({ 
          assigned_to: user.id,
          locked_by: user.id,
          locked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', selectedChatId);
      
      setChatAssignedTo({ id: user.id, name: user.name || 'Você' });
      setChatLock(null);
      refetch();
    } catch (err) {
      console.error('Error assuming chat:', err);
    }
  };

  // Bloquear conversa quando usuário seleciona
  const lockChat = async (chatId: string) => {
    if (!user?.id) return;
    setIsLocking(true);
    
    try {
      // Verificar se já está bloqueada por outro usuário
      const { data: chatData } = await supabase
        .from('chats')
        .select('locked_by, locked_at')
        .eq('id', chatId)
        .single();
      
      const lockTimeout = 5 * 60 * 1000; // 5 minutos
      const now = new Date();
      
      if (chatData?.locked_by && chatData.locked_by !== user.id) {
        const lockedAt = new Date(chatData.locked_at);
        if (now.getTime() - lockedAt.getTime() < lockTimeout) {
          // Buscar nome do usuário que bloqueou
          const { data: lockerData } = await supabase
            .from('users')
            .select('name')
            .eq('id', chatData.locked_by)
            .single();
          
          setChatLock({ 
            locked_by: chatData.locked_by, 
            locked_by_name: (lockerData as any)?.name || 'Outro usuário' 
          });
          return;
        }
      }
      
      // Bloquear para este usuário
      await supabase
        .from('chats')
        .update({ locked_by: user.id, locked_at: now.toISOString() })
        .eq('id', chatId);
      
      setChatLock(null);
    } catch (err) {
      console.error('Error locking chat:', err);
    } finally {
      setIsLocking(false);
    }
  };

  // Desbloquear conversa
  const unlockChat = async (chatId: string) => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('chats')
        .update({ locked_by: null, locked_at: null })
        .eq('id', chatId)
        .eq('locked_by', user.id); // Só desbloqueia se foi ele que bloqueou
    } catch (err) {
      console.error('Error unlocking chat:', err);
    }
  };

  // Verificar bloqueio periodicamente
  useEffect(() => {
    if (!selectedChatId) return;
    
    const checkLock = async () => {
      const { data: chatData } = await supabase
        .from('chats')
        .select('locked_by, locked_at')
        .eq('id', selectedChatId)
        .single();
      
      if (chatData?.locked_by && chatData.locked_by !== user?.id) {
        const lockTimeout = 5 * 60 * 1000;
        const now = new Date();
        const lockedAt = new Date(chatData.locked_at);
        
        if (now.getTime() - lockedAt.getTime() < lockTimeout) {
          const { data: lockerData } = await supabase
            .from('users')
            .select('name')
            .eq('id', chatData.locked_by)
            .single();
          
          setChatLock({ 
            locked_by: chatData.locked_by, 
            locked_by_name: (lockerData as any)?.name || 'Outro usuário' 
          });
        } else {
          setChatLock(null);
        }
      } else {
        setChatLock(null);
      }
    };
    
    const interval = setInterval(checkLock, 10000); // Verificar a cada 10 segundos
    return () => clearInterval(interval);
  }, [selectedChatId, user?.id]);

  // Adicionar tag ao chat
  const handleAddTag = async (tagId: string) => {
    if (!selectedChatId) return;
    try {
      await supabase
        .from('chat_tags')
        .insert({ chat_id: selectedChatId, tag_id: tagId });
      await refetch();
    } catch (err) {
      console.error('Error adding tag:', err);
    }
  };

  // Remover tag do chat
  const handleRemoveTag = async (tagId: string) => {
    if (!selectedChatId) return;
    try {
      await supabase
        .from('chat_tags')
        .delete()
        .eq('chat_id', selectedChatId)
        .eq('tag_id', tagId);
      await refetch();
    } catch (err) {
      console.error('Error removing tag:', err);
    }
  };

  // Abrir modal de tags
  const openTagsModal = () => {
    fetchAvailableTags();
    setShowTagsModal(true);
  };

  // Buscar notas do chat selecionado
  const fetchNotes = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_notes' as any)
        .select('id, content, created_at, user_id')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // Buscar nomes dos usuários
        const notesData = data as Array<{ id: string; content: string; created_at: string; user_id: string }>;
        const userIds = [...new Set(notesData.map(n => n.user_id))];
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);
        
        const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
        
        setNotes(notesData.map(n => ({
          id: n.id,
          content: n.content,
          created_at: n.created_at,
          user_name: userMap.get(n.user_id) || 'Usuário',
        })));
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  };

  // Salvar nova nota
  const handleSaveNote = async () => {
    if (!noteInput.trim() || !selectedChatId || !user) return;
    
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('chat_notes' as any)
        .insert({
          chat_id: selectedChatId,
          user_id: user.id,
          content: noteInput.trim(),
        });
      
      if (!error) {
        setNoteInput('');
        await fetchNotes(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Buscar orçamentos do chat selecionado
  const fetchQuotes = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('quotes' as any)
        .select('id, service_type, value, status, notes, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setQuotes(data as any);
      }
    } catch (err) {
      console.error('Error fetching quotes:', err);
    }
  };

  // Salvar novo orçamento
  const handleSaveQuote = async () => {
    if (!quoteForm.service_type.trim() || !quoteForm.value || !selectedChatId || !user || !clinicId) return;
    
    setSavingQuote(true);
    try {
      const { error } = await supabase
        .from('quotes' as any)
        .insert({
          chat_id: selectedChatId,
          clinic_id: clinicId,
          service_type: quoteForm.service_type.trim(),
          value: parseFloat(quoteForm.value.replace(',', '.')),
          notes: quoteForm.notes.trim() || null,
          created_by: user.id,
          status: 'pending',
        });
      
      if (!error) {
        setQuoteForm({ service_type: '', value: '', notes: '' });
        setShowQuoteModal(false);
        await fetchQuotes(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving quote:', err);
    } finally {
      setSavingQuote(false);
    }
  };

  // Atualizar status do orçamento
  const handleUpdateQuoteStatus = async (quoteId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('quotes' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', quoteId);
      
      if (!error && selectedChatId) {
        await fetchQuotes(selectedChatId);
      }
    } catch (err) {
      console.error('Error updating quote status:', err);
    }
  };

  // Buscar origens de leads da clínica
  const fetchLeadSources = async () => {
    if (!clinicId) return;
    try {
      const { data, error } = await supabase
        .from('lead_sources' as any)
        .select('id, name, code, color')
        .eq('clinic_id', clinicId)
        .order('name');
      
      if (!error && data) {
        setLeadSources(data as any);
      }
    } catch (err) {
      console.error('Error fetching lead sources:', err);
    }
  };

  // Buscar origem do chat selecionado
  const fetchChatSource = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('source_id')
        .eq('id', chatId)
        .single();
      
      if (!error && data) {
        setSelectedSourceId((data as any).source_id);
      }
    } catch (err) {
      console.error('Error fetching chat source:', err);
    }
  };

  // Atualizar origem do lead
  const handleUpdateSource = async (sourceId: string | null) => {
    if (!selectedChatId) return;
    try {
      const { error } = await supabase
        .from('chats')
        .update({ source_id: sourceId })
        .eq('id', selectedChatId);
      
      if (!error) {
        setSelectedSourceId(sourceId);
        setShowSourceDropdown(false);
      }
    } catch (err) {
      console.error('Error updating source:', err);
    }
  };

  // Criar nova origem
  const handleCreateSource = async () => {
    if (!newSourceForm.name.trim() || !clinicId) return;
    setSavingSource(true);
    try {
      const { data, error } = await supabase
        .from('lead_sources' as any)
        .insert({
          clinic_id: clinicId,
          name: newSourceForm.name.trim(),
          code: newSourceForm.code.trim() || null,
        })
        .select()
        .single();
      
      if (!error && data) {
        await fetchLeadSources();
        setNewSourceForm({ name: '', code: '' });
        setShowAddSourceModal(false);
      }
    } catch (err) {
      console.error('Error creating source:', err);
    } finally {
      setSavingSource(false);
    }
  };

  // Buscar pagamentos do chat selecionado
  const fetchPayments = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments' as any)
        .select('id, value, description, payment_date, created_at')
        .eq('chat_id', chatId)
        .order('payment_date', { ascending: false });
      
      if (!error && data) {
        setPayments(data as any);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  // Salvar novo pagamento
  const handleSavePayment = async () => {
    if (!paymentForm.value || !selectedChatId || !user || !clinicId) return;
    
    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from('payments' as any)
        .insert({
          chat_id: selectedChatId,
          clinic_id: clinicId,
          value: parseFloat(paymentForm.value.replace(',', '.')),
          description: paymentForm.description.trim() || null,
          payment_date: paymentForm.payment_date,
          created_by: user.id,
        });
      
      if (!error) {
        setPaymentForm({ value: '', description: '', payment_date: new Date().toISOString().split('T')[0] });
        setShowPaymentModal(false);
        await fetchPayments(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving payment:', err);
    } finally {
      setSavingPayment(false);
    }
  };

  // Buscar tarefas do chat selecionado
  const fetchTasks = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks' as any)
        .select('id, title, description, due_date, completed, created_at')
        .eq('chat_id', chatId)
        .order('completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (!error && data) {
        setTasks(data as any);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  // Salvar nova tarefa
  const handleSaveTask = async () => {
    if (!taskForm.title.trim() || !selectedChatId || !user || !clinicId) return;
    
    setSavingTask(true);
    try {
      const { error } = await supabase
        .from('tasks' as any)
        .insert({
          chat_id: selectedChatId,
          clinic_id: clinicId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          due_date: taskForm.due_date || null,
          created_by: user.id,
        });
      
      if (!error) {
        setTaskForm({ title: '', description: '', due_date: '' });
        setShowTaskModal(false);
        await fetchTasks(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSavingTask(false);
    }
  };

  // Marcar tarefa como concluída/pendente
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks' as any)
        .update({ 
          completed: !completed, 
          completed_at: !completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
      
      if (!error && selectedChatId) {
        await fetchTasks(selectedChatId);
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  // Buscar mensagens agendadas do chat selecionado
  const fetchScheduledMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('scheduled_messages' as any)
        .select('id, message, scheduled_for, status, created_at')
        .eq('chat_id', chatId)
        .order('scheduled_for', { ascending: true });
      
      if (!error && data) {
        setScheduledMessages(data as any);
      }
    } catch (err) {
      console.error('Error fetching scheduled messages:', err);
    }
  };

  // Salvar nova mensagem agendada
  const handleSaveSchedule = async () => {
    if (!scheduleForm.message.trim() || !scheduleForm.scheduled_date || !scheduleForm.scheduled_time || !selectedChatId || !user || !clinicId) return;
    
    setSavingSchedule(true);
    try {
      const scheduledFor = new Date(`${scheduleForm.scheduled_date}T${scheduleForm.scheduled_time}`).toISOString();
      
      const { error } = await supabase
        .from('scheduled_messages' as any)
        .insert({
          chat_id: selectedChatId,
          clinic_id: clinicId,
          message: scheduleForm.message.trim(),
          scheduled_for: scheduledFor,
          created_by: user.id,
        });
      
      if (!error) {
        setScheduleForm({ message: '', scheduled_date: '', scheduled_time: '' });
        setShowScheduleModal(false);
        await fetchScheduledMessages(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving scheduled message:', err);
    } finally {
      setSavingSchedule(false);
    }
  };

  // Cancelar mensagem agendada
  const handleCancelSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages' as any)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', scheduleId);
      
      if (!error && selectedChatId) {
        await fetchScheduledMessages(selectedChatId);
      }
    } catch (err) {
      console.error('Error cancelling scheduled message:', err);
    }
  };

  // Buscar origens ao carregar
  useEffect(() => {
    fetchLeadSources();
  }, [clinicId]);

  // Buscar notas, orçamentos, origem, pagamentos, tarefas e mensagens agendadas quando mudar de chat
  useEffect(() => {
    if (selectedChatId) {
      fetchNotes(selectedChatId);
      fetchQuotes(selectedChatId);
      fetchChatSource(selectedChatId);
      fetchPayments(selectedChatId);
      fetchTasks(selectedChatId);
      fetchScheduledMessages(selectedChatId);
    } else {
      setNotes([]);
      setQuotes([]);
      setSelectedSourceId(null);
      setPayments([]);
      setTasks([]);
      setScheduledMessages([]);
    }
  }, [selectedChatId]);

  // Filtrar chats baseado no filtro ativo e busca
  const filteredChats = chats.filter(chat => {
    // Filtro de busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = chat.client_name?.toLowerCase().includes(query);
      const matchesPhone = chat.phone_number?.toLowerCase().includes(query);
      const matchesMessage = chat.last_message?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesMessage) return false;
    }

    // Filtros de categoria
    switch (activeFilter) {
      case 'nao_lidos':
        return (chat.unread_count || 0) > 0;
      case 'aguardando':
        return chat.status === 'Aguardando' || chat.status === 'Novo Lead';
      case 'followup':
        return chat.id in followupData;
      case 'grupos':
        // Grupos geralmente têm telefone com hífen ou mais de 15 dígitos
        return chat.phone_number?.includes('-') || (chat.phone_number?.length || 0) > 15;
      case 'todos':
      default:
        return true;
    }
  });

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Bloquear chat quando selecionado, desbloquear quando sair
  useEffect(() => {
    if (selectedChatId) {
      lockChat(selectedChatId);
      fetchChatAssignment(selectedChatId);
    }
    
    // Cleanup: desbloquear ao sair da conversa
    return () => {
      if (selectedChatId) {
        unlockChat(selectedChatId);
      }
    };
  }, [selectedChatId]);

  const selectedChat = chats.find(c => c.id === selectedChatId);

  // Buscar nomes dos usuários que enviaram mensagens
  useEffect(() => {
    const fetchUserNames = async () => {
      if (!selectedChat?.messages) return;
      
      const userIds = [...new Set(
        selectedChat.messages
          .filter(m => !m.is_from_client && m.sent_by)
          .map(m => m.sent_by)
      )].filter(Boolean) as string[];
      
      if (userIds.length === 0) return;
      
      const missingIds = userIds.filter(id => !userNames[id]);
      if (missingIds.length === 0) return;
      
      const { data } = await supabase
        .from('users')
        .select('id, name')
        .in('id', missingIds);
      
      if (data) {
        const newNames: Record<string, string> = {};
        (data as any[]).forEach(u => {
          newNames[u.id] = u.name;
        });
        setUserNames(prev => ({ ...prev, ...newNames }));
      }
    };
    
    fetchUserNames();
  }, [selectedChat?.messages]);

  // Scroll quando mudar de chat ou receber novas mensagens
  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages?.length, selectedChatId]);

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !selectedChatId || !user) return;
    await sendMessage(selectedChatId, msgInput, user.id);
    setMsgInput('');
  };

  // Enviar mídia (imagem/vídeo)
  const handleSendMedia = async (file: File) => {
    if (!selectedChatId || !user || !selectedChat) return;
    
    setSendingMedia(true);
    try {
      // Upload para Supabase Storage
      const fileName = `${selectedChatId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Erro ao fazer upload do arquivo');
        return;
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      const mediaUrl = urlData?.publicUrl;
      
      if (!mediaUrl) {
        alert('Erro ao obter URL do arquivo');
        return;
      }
      
      // Determinar tipo de mídia
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                        file.type.startsWith('video/') ? 'video' : 
                        file.type.startsWith('audio/') ? 'audio' : 'document';
      
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      // Buscar instância WhatsApp
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .single();
      
      // Enviar via WhatsApp se conectado
      if (instance?.status === 'connected' && settings?.evolution_api_url && selectedChat.phone_number) {
        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        const endpoint = mediaType === 'image' ? 'sendMedia' : 
                         mediaType === 'video' ? 'sendMedia' : 
                         mediaType === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
        
        await fetch(`${settings.evolution_api_url}/message/${endpoint}/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            mediatype: mediaType,
            media: mediaUrl,
            caption: '',
          }),
        });
      }
      
      // Salvar mensagem no banco
      await supabase.from('messages').insert({
        chat_id: selectedChatId,
        content: `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Arquivo'}]`,
        type: mediaType,
        media_url: mediaUrl,
        is_from_client: false,
        sent_by: user.id,
      });
      
      // Atualizar chat
      await supabase.from('chats').update({
        last_message: `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Arquivo'}]`,
        last_message_time: new Date().toISOString(),
      }).eq('id', selectedChatId);
      
      // Recarregar chats
      await refetch();
      
    } catch (err) {
      console.error('Error sending media:', err);
      alert('Erro ao enviar mídia');
    } finally {
      setSendingMedia(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSendMedia(file);
    }
    e.target.value = '';
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Col 1: Chat List */}
      <aside className="w-[380px] flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar conversa..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-cyan-600"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: 'todos' as FilterType, label: 'Todos', count: chats.length },
              { key: 'nao_lidos' as FilterType, label: 'Não lidos', count: chats.filter(c => (c.unread_count || 0) > 0).length },
              { key: 'aguardando' as FilterType, label: 'Aguardando', count: chats.filter(c => c.status === 'Aguardando' || c.status === 'Novo Lead').length },
              { key: 'followup' as FilterType, label: 'Follow-up', count: Object.keys(followupData).length },
              { key: 'grupos' as FilterType, label: 'Grupos', count: chats.filter(c => c.phone_number?.includes('-') || (c.phone_number?.length || 0) > 15).length },
            ].map((f) => (
              <button 
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border flex items-center gap-1.5 transition-colors ${
                  activeFilter === f.key 
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeFilter === f.key ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-2">Carregando conversas...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">chat</span>
              <p className="text-sm text-slate-500">
                {chats.length === 0 ? 'Nenhuma conversa ainda' : 'Nenhuma conversa encontrada'}
              </p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => {
                  setSelectedChatId(chat.id);
                  markAsRead(chat.id);
                }}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors relative border-l-4 ${
                  selectedChatId === chat.id ? 'bg-cyan-50/50 border-cyan-600' : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} className="size-12 rounded-full border border-slate-100" />
                  <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{chat.client_name}</h3>
                    <span className="text-[10px] font-bold text-slate-400">{formatTime(chat.last_message_time)}</span>
                  </div>
                  {activeFilter === 'followup' && followupData[chat.id] ? (
                    <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span className="font-medium">
                        {new Date(followupData[chat.id].scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(followupData[chat.id].scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 truncate leading-relaxed">{chat.last_message || 'Sem mensagens'}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {chat.tags.map(tag => (
                      <span key={tag.id} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                        {tag.name}
                      </span>
                    ))}
                    {(chat.unread_count || 0) > 0 && (
                      <span className="ml-auto bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Col 2: Active Chat Area */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 relative">
        {selectedChat ? (
          <>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
              <div className="flex items-center gap-3">
                <img src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} className="size-10 rounded-full" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">{selectedChat.client_name}</h2>
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-green-500"></span> Online agora
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(#cbd5e1 0.5px, transparent 0.5px)', backgroundSize: '15px 15px' }}>
              <div className="flex justify-center mb-8">
                <span className="bg-white/80 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100 uppercase tracking-widest">Hoje</span>
              </div>
              
              {selectedChat.messages.map((m) => (
                <div key={m.id} className={`flex ${!m.is_from_client ? 'justify-end' : 'justify-start'} w-full`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm relative ${
                    !m.is_from_client 
                      ? 'bg-cyan-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}>
                    {/* Nome do atendente */}
                    {!m.is_from_client && m.sent_by && userNames[m.sent_by] && (
                      <p className="text-[10px] font-bold text-cyan-200 mb-1">{userNames[m.sent_by]}</p>
                    )}
                    {/* Renderizar mídia se existir */}
                    {m.type === 'image' && m.media_url && (
                      <img 
                        src={m.media_url} 
                        alt="Imagem" 
                        className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(m.media_url || '', '_blank')}
                      />
                    )}
                    {m.type === 'video' && m.media_url && (
                      <video 
                        src={m.media_url} 
                        controls 
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    {m.type === 'audio' && m.media_url && (
                      <audio 
                        src={m.media_url} 
                        controls 
                        className="w-full mb-2"
                      />
                    )}
                    {m.type === 'document' && m.media_url && (
                      <a 
                        href={m.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${!m.is_from_client ? 'bg-cyan-500' : 'bg-slate-100'}`}
                      >
                        <span className="material-symbols-outlined">description</span>
                        <span className="text-sm underline">{m.content}</span>
                      </a>
                    )}
                    {/* Texto da mensagem (exceto para mídia sem legenda) */}
                    {(m.type === 'text' || (m.content && !m.content.startsWith('['))) && (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    )}
                    {/* Placeholder para mídia sem URL */}
                    {m.type !== 'text' && !m.media_url && (
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${!m.is_from_client ? 'bg-cyan-500' : 'bg-slate-100'}`}>
                        <span className="material-symbols-outlined">
                          {m.type === 'image' ? 'image' : m.type === 'video' ? 'videocam' : m.type === 'audio' ? 'mic' : 'attachment'}
                        </span>
                        <span className="text-sm">{m.content}</span>
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${!m.is_from_client ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {formatTime(m.created_at)}
                      {!m.is_from_client && <span className="material-symbols-outlined text-[12px]">done_all</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 relative">
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                <div className="relative">
                  <button 
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
                      showQuickReplies 
                        ? 'bg-cyan-50 border-cyan-200 text-cyan-700' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-cyan-600">bolt</span>
                    Respostas Rápidas
                  </button>
                  
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-green-600">calendar_month</span>
                  Agendar
                </button>
              </div>
              <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-cyan-600 focus-within:border-transparent transition-all">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                />
                <label className="p-2 text-slate-400 hover:text-cyan-600 rounded-full transition-colors cursor-pointer">
                  <input 
                    type="file" 
                    onChange={handleFileSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    className="sr-only"
                    disabled={sendingMedia}
                  />
                  <span className="material-symbols-outlined">{sendingMedia ? 'hourglass_empty' : 'attach_file'}</span>
                </label>
                <div className="relative">
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-cyan-600 bg-cyan-50' : 'text-slate-400 hover:text-cyan-600'}`}
                  >
                    <span className="material-symbols-outlined">sentiment_satisfied</span>
                  </button>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 w-64">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Emojis</p>
                        <div className="grid grid-cols-10 gap-1">
                          {commonEmojis.map((emoji, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setMsgInput(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="text-xl hover:bg-slate-100 rounded p-1 transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {chatLock ? (
                  <div className="flex-1 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-lg">lock</span>
                    <span className="text-sm font-medium">{chatLock.locked_by_name} está respondendo esta conversa</span>
                  </div>
                ) : !canSendMessage ? (
                  <div className="flex-1 flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    <span className="text-sm font-medium">Modo visualização - sem permissão para responder</span>
                  </div>
                ) : (
                  <>
                    <textarea 
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Digite sua mensagem..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-0 resize-none max-h-32 min-h-[40px]"
                      rows={1}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={sendingMedia}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white size-10 flex items-center justify-center rounded-xl shadow-lg shadow-cyan-500/30 transition-all shrink-0 active:scale-95 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
             <span className="material-symbols-outlined text-7xl text-slate-100 mb-6">forum</span>
             <h2 className="text-xl font-black text-slate-900 mb-2">Selecione uma conversa</h2>
             <p className="text-slate-500 max-w-xs">Escolha um contato ao lado para visualizar o histórico de mensagens e responder.</p>
          </div>
        )}
      </section>

      {/* Col 3: Details Pane */}
      <aside className="hidden xl:flex w-[340px] flex-col bg-white border-l border-slate-200 h-full overflow-y-auto shrink-0">
        {selectedChat ? (
          <div className="flex flex-col h-full">
            <div className="p-8 text-center border-b border-slate-100">
              <img src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} className="size-24 rounded-full mx-auto mb-4 border-4 border-slate-50 shadow-md" />
              <h2 className="text-xl font-black text-slate-900 mb-1">{selectedChat.client_name}</h2>
              <p className="text-sm font-bold text-slate-400">{selectedChat.phone_number}</p>
              
              <div className="flex justify-center gap-4 mt-6">
                {[
                  { icon: 'chat', label: 'Conversar', color: 'green' },
                  { icon: 'call', label: 'Ligar', color: 'blue' },
                  { icon: 'edit', label: 'Editar', color: 'slate' },
                ].map(action => (
                  <button key={action.label} className={`size-10 rounded-full border border-${action.color}-100 bg-${action.color}-50 text-${action.color}-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm`}>
                    <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-8">
              <section className="relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funil de Vendas</h3>
                  {canMoveLead && (
                  <button 
                    onClick={() => setShowStageDropdown(!showStageDropdown)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                  >
                    Alterar
                  </button>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Etapa Atual</p>
                   <p className="text-sm font-bold text-slate-800 mb-4">{selectedChat.status}</p>
                   <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ 
                          width: `${((PIPELINE_STAGES.findIndex(s => s.value === selectedChat.status) + 1) / PIPELINE_STAGES.length) * 100}%`,
                          backgroundColor: PIPELINE_STAGES.find(s => s.value === selectedChat.status)?.color || '#0891b2'
                        }}
                      ></div>
                   </div>
                </div>
                
                {/* Dropdown de etapas */}
                {showStageDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                    {PIPELINE_STAGES.map(stage => (
                      <button
                        key={stage.value}
                        onClick={() => handleChangeStage(stage.value)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                          selectedChat.status === stage.value ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="size-3 rounded-full" style={{ backgroundColor: stage.color }}></span>
                        {stage.label}
                        {selectedChat.status === stage.value && (
                          <span className="material-symbols-outlined text-cyan-600 text-[16px] ml-auto">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Seção Responsável pelo Atendimento */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</h3>
                  {canSendMessage && (
                    <button 
                      onClick={() => setShowForwardModal(true)}
                      className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                    >
                      Encaminhar
                    </button>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {chatAssignedTo ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-cyan-100 rounded-full flex items-center justify-center">
                          <span className="text-cyan-700 font-bold text-sm">
                            {chatAssignedTo.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {chatAssignedTo.id === user?.id ? 'Você' : chatAssignedTo.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {chatLock ? 'Atendendo agora' : 'Responsável'}
                          </p>
                        </div>
                      </div>
                      {chatAssignedTo.id === user?.id && chatLock && (
                        <button
                          onClick={handleReleaseChat}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded-lg"
                        >
                          Liberar
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">Nenhum responsável</p>
                      {canSendMessage && (
                        <button
                          onClick={handleAssumeChat}
                          className="text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg"
                        >
                          Assumir
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {chatLock && chatLock.locked_by !== user?.id && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[16px]">lock</span>
                    <p className="text-xs text-amber-700">
                      <strong>{chatLock.locked_by_name}</strong> está atendendo esta conversa
                    </p>
                  </div>
                )}
              </section>

              {/* Seção Origem do Lead */}
              <section className="relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem do Lead</h3>
                  <button 
                    onClick={() => setShowAddSourceModal(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Nova
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:border-cyan-300 transition-colors"
                  >
                    {selectedSourceId ? (
                      <div className="flex items-center gap-2">
                        <span 
                          className="size-3 rounded-full" 
                          style={{ backgroundColor: leadSources.find(s => s.id === selectedSourceId)?.color || '#6B7280' }}
                        ></span>
                        <span className="text-sm font-bold text-slate-700">
                          {leadSources.find(s => s.id === selectedSourceId)?.name}
                        </span>
                        {leadSources.find(s => s.id === selectedSourceId)?.code && (
                          <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                            {leadSources.find(s => s.id === selectedSourceId)?.code}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Selecionar origem...</span>
                    )}
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_more</span>
                  </button>
                  
                  {/* Dropdown de origens */}
                  {showSourceDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => handleUpdateSource(null)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                          !selectedSourceId ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="size-3 rounded-full bg-slate-300"></span>
                        Sem origem
                      </button>
                      {leadSources.map(source => (
                        <button
                          key={source.id}
                          onClick={() => handleUpdateSource(source.id)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                            selectedSourceId === source.id ? 'bg-slate-50 font-bold' : ''
                          }`}
                        >
                          <span className="size-3 rounded-full" style={{ backgroundColor: source.color }}></span>
                          {source.name}
                          {source.code && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                              {source.code}
                            </span>
                          )}
                          {selectedSourceId === source.id && (
                            <span className="material-symbols-outlined text-cyan-600 text-[16px] ml-auto">check</span>
                          )}
                        </button>
                      ))}
                      {leadSources.length === 0 && (
                        <p className="px-4 py-2 text-xs text-slate-400">Nenhuma origem cadastrada</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Modal Nova Origem */}
              {showAddSourceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddSourceModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Nova Origem</h3>
                      <button onClick={() => setShowAddSourceModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Nome da Origem</label>
                        <input
                          type="text"
                          value={newSourceForm.name}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Instagram, Indicação, AV1..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Código (opcional)</label>
                        <input
                          type="text"
                          value={newSourceForm.code}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, code: e.target.value }))}
                          placeholder="Ex: AV1, AV2, IG01..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Use para identificar criativos de anúncios</p>
                      </div>
                      <button
                        onClick={handleCreateSource}
                        disabled={!newSourceForm.name.trim() || savingSource}
                        className="w-full py-2 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingSource ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Criar Origem
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiquetas</h3>
                  <button 
                    onClick={openTagsModal}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedChat.tags.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma etiqueta</p>
                  ) : (
                    selectedChat.tags.map(tag => (
                      <span 
                        key={tag.id} 
                        className="px-2 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 group cursor-pointer" 
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                        onClick={() => handleRemoveTag(tag.id)}
                        title="Clique para remover"
                      >
                        {tag.name}
                        <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">close</span>
                      </span>
                    ))
                  )}
                </div>
              </section>

              {/* Modal de Tags */}
              {showTagsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTagsModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Adicionar Etiqueta</h3>
                      <button onClick={() => setShowTagsModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 max-h-64 overflow-y-auto">
                      {loadingTags ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto"></div>
                        </div>
                      ) : availableTags.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">Nenhuma etiqueta disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {availableTags.map(tag => {
                            const isAdded = selectedChat.tags.some(t => t.id === tag.id);
                            return (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  if (isAdded) {
                                    handleRemoveTag(tag.id);
                                  } else {
                                    handleAddTag(tag.id);
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center justify-between transition-colors ${
                                  isAdded ? 'bg-slate-100' : 'hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="size-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                  {tag.name}
                                </span>
                                {isAdded && (
                                  <span className="material-symbols-outlined text-cyan-600 text-[18px]">check_circle</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Respostas Rápidas */}
              {showQuickReplies && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQuickReplies(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Respostas Rápidas</h3>
                      <button onClick={() => setShowQuickReplies(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {quickReplies.map(reply => (
                        <button
                          key={reply.id}
                          onClick={() => handleQuickReply(reply.text)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-cyan-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-slate-700">{reply.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Orçamentos */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamento</h3>
                  <button 
                    onClick={() => setShowQuoteModal(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                
                {quotes.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum orçamento</p>
                ) : (
                  <div className="space-y-2">
                    {quotes.map(quote => (
                      <div 
                        key={quote.id} 
                        className={`p-3 rounded-xl border ${
                          quote.status === 'approved' ? 'bg-green-50 border-green-200' :
                          quote.status === 'rejected' ? 'bg-red-50 border-red-200' :
                          'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-700">{quote.service_type}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            quote.status === 'approved' ? 'bg-green-100 text-green-700' :
                            quote.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {quote.status === 'approved' ? 'Aprovado' : 
                             quote.status === 'rejected' ? 'Recusado' : 'Pendente'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-900 mb-2">
                          R$ {quote.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {quote.notes && (
                          <p className="text-[10px] text-slate-500 mb-2 italic">"{quote.notes}"</p>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">
                            {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          {quote.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdateQuoteStatus(quote.id, 'approved')}
                                className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                title="Aprovar"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </button>
                              <button
                                onClick={() => handleUpdateQuoteStatus(quote.id, 'rejected')}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Recusar"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="pt-2 border-t border-slate-200 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Total Aprovado:</span>
                        <span className="text-sm font-black text-green-600">
                          R$ {quotes
                            .filter(q => q.status === 'approved')
                            .reduce((sum, q) => sum + q.value, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Modal de Novo Orçamento */}
              {showQuoteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQuoteModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Novo Orçamento</h3>
                      <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Serviço</label>
                        <input
                          type="text"
                          value={quoteForm.service_type}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, service_type: e.target.value }))}
                          placeholder="Ex: Consulta, Procedimento..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                        <input
                          type="text"
                          value={quoteForm.value}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Observações (opcional)</label>
                        <textarea
                          value={quoteForm.notes}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Detalhes do orçamento..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent h-20 resize-none"
                        />
                      </div>
                      <button
                        onClick={handleSaveQuote}
                        disabled={!quoteForm.service_type.trim() || !quoteForm.value || savingQuote}
                        className="w-full py-2 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingQuote ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Salvar Orçamento
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Negociações/Pagamentos */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Negociações</h3>
                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum pagamento registrado</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map(payment => (
                      <div 
                        key={payment.id} 
                        className="p-3 rounded-xl border bg-emerald-50 border-emerald-200"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-black text-emerald-700">
                            R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {payment.description && (
                          <p className="text-[11px] text-slate-600">{payment.description}</p>
                        )}
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="pt-2 border-t border-slate-200 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Total Faturado:</span>
                        <span className="text-sm font-black text-emerald-600">
                          R$ {payments
                            .reduce((sum, p) => sum + p.value, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Modal de Novo Pagamento */}
              {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Registrar Pagamento</h3>
                      <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                        <input
                          type="text"
                          value={paymentForm.value}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Data do Pagamento</label>
                        <input
                          type="date"
                          value={paymentForm.payment_date}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Descrição (opcional)</label>
                        <input
                          type="text"
                          value={paymentForm.description}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Ex: Consulta, Preenchimento labial..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={handleSavePayment}
                        disabled={!paymentForm.value || savingPayment}
                        className="w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingPayment ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                            Registrar Pagamento
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Tarefas */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefas</h3>
                  <button 
                    onClick={() => setShowTaskModal(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma tarefa</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tasks.map(task => (
                      <div 
                        key={task.id} 
                        className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                          task.completed ? 'bg-slate-50 border-slate-200' : 'bg-purple-50 border-purple-200'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTask(task.id, task.completed)}
                          className={`mt-0.5 size-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            task.completed 
                              ? 'bg-slate-400 border-slate-400 text-white' 
                              : 'border-purple-400 hover:bg-purple-100'
                          }`}
                        >
                          {task.completed && (
                            <span className="material-symbols-outlined text-[12px]">check</span>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p className={`text-[10px] mt-0.5 ${
                              task.completed ? 'text-slate-400' :
                              new Date(task.due_date) < new Date() ? 'text-red-500 font-bold' : 'text-slate-400'
                            }`}>
                              <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">event</span>
                              {new Date(task.due_date).toLocaleDateString('pt-BR')}
                              {!task.completed && new Date(task.due_date) < new Date() && ' (atrasada)'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Modal de Nova Tarefa */}
              {showTaskModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTaskModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Nova Tarefa</h3>
                      <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Título</label>
                        <input
                          type="text"
                          value={taskForm.title}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Ex: Ligar para confirmar consulta"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Data de Vencimento (opcional)</label>
                        <input
                          type="date"
                          value={taskForm.due_date}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Descrição (opcional)</label>
                        <textarea
                          value={taskForm.description}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Detalhes da tarefa..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent h-16 resize-none"
                        />
                      </div>
                      <button
                        onClick={handleSaveTask}
                        disabled={!taskForm.title.trim() || savingTask}
                        className="w-full py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingTask ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">task_alt</span>
                            Criar Tarefa
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Mensagens Agendadas */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow-up</h3>
                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Agendar
                  </button>
                </div>
                
                {scheduledMessages.filter(m => m.status === 'pending').length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum follow-up agendado</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {scheduledMessages.filter(m => m.status === 'pending').map(msg => (
                      <div 
                        key={msg.id} 
                        className="p-2.5 rounded-xl border bg-blue-50 border-blue-200"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-[11px] text-slate-700 flex-1 line-clamp-2">{msg.message}</p>
                          <button
                            onClick={() => handleCancelSchedule(msg.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Cancelar"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-blue-600 mt-1 font-medium">
                          <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">schedule_send</span>
                          {new Date(msg.scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Modal de Agendar Mensagem */}
              {showScheduleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScheduleModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Agendar Follow-up</h3>
                      <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Mensagem</label>
                        <textarea
                          value={scheduleForm.message}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Mensagem para enviar..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent h-20 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Data</label>
                          <input
                            type="date"
                            value={scheduleForm.scheduled_date}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Hora</label>
                          <input
                            type="time"
                            value={scheduleForm.scheduled_time}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 30);
                            setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                          }}
                          className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          30 dias
                        </button>
                        <button
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 60);
                            setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                          }}
                          className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          60 dias
                        </button>
                        <button
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 90);
                            setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                          }}
                          className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          90 dias
                        </button>
                      </div>
                      <button
                        onClick={handleSaveSchedule}
                        disabled={!scheduleForm.message.trim() || !scheduleForm.scheduled_date || !scheduleForm.scheduled_time || savingSchedule}
                        className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingSchedule ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Agendando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">schedule_send</span>
                            Agendar Mensagem
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <section className="flex-1 flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Observações</h3>
                
                {/* Histórico de notas */}
                <div className="flex-1 space-y-3 max-h-48 overflow-y-auto mb-4">
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhuma observação ainda</p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                        <p className="text-xs text-slate-700 leading-relaxed italic mb-2">"{note.content}"</p>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-medium">{note.user_name}</span>
                          <span>{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Input para nova nota */}
                <div className="space-y-2">
                  <textarea 
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Adicionar nota interna..."
                    className="w-full rounded-xl bg-slate-50 border-slate-200 text-xs p-3 focus:ring-cyan-600 focus:border-cyan-600 h-20 resize-none"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteInput.trim() || savingNote}
                    className="w-full py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingNote ? (
                      <>
                        <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        Salvar Observação
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-4xl text-slate-100 mb-4">info</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informações do Contato</p>
          </div>
        )}
      </aside>

      {/* Modal de Encaminhamento */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForwardModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-cyan-500 to-blue-600">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">forward_to_inbox</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Encaminhar Atendimento</h3>
                  <p className="text-white/80 text-sm">Selecione o responsável</p>
                </div>
              </div>
              <button 
                onClick={() => setShowForwardModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                {clinicUsers.filter(u => u.id !== user?.id).map(u => (
                  <button
                    key={u.id}
                    onClick={() => setForwardingTo(u.id)}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      forwardingTo === u.id 
                        ? 'border-cyan-500 bg-cyan-50' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`size-10 rounded-full flex items-center justify-center ${
                      forwardingTo === u.id ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="font-bold text-sm">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.role}</p>
                    </div>
                    {forwardingTo === u.id && (
                      <span className="material-symbols-outlined text-cyan-600">check_circle</span>
                    )}
                  </button>
                ))}
                
                {clinicUsers.filter(u => u.id !== user?.id).length === 0 && (
                  <p className="text-center text-slate-500 py-4">Nenhum outro usuário disponível</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={forwardWithLock}
                    onChange={(e) => setForwardWithLock(e.target.checked)}
                    className="size-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <p className="font-bold text-sm text-slate-800">Bloquear conversa</p>
                    <p className="text-xs text-slate-500">Apenas o responsável poderá responder</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleForwardChat}
                disabled={!forwardingTo || savingForward}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingForward ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Encaminhando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Encaminhar
                  </>
                )}
              </button>
              <button
                onClick={() => setShowForwardModal(false)}
                className="px-6 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
