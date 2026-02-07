
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useChats, ChatWithMessages, DbTag } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { hasPermission } from '../lib/permissions';
import { canSendMessage as checkRateLimit, recordMessageSent, waitForRateLimit } from '../lib/rateLimiter';
import { SectionConfigModal, useSectionConfig, SectionKey, SECTION_KEYS, SECTION_LABELS } from '../components/InboxDetailsSections';
import { usePipelineStages } from '../hooks/usePipelineStages';

const DEFAULT_QUICK_REPLIES = [
  { id: '1', text: 'Olá! Como posso ajudar você hoje?' },
  { id: '2', text: 'Obrigado pelo contato! Em breve retornaremos.' },
  { id: '3', text: 'Poderia me informar seu nome completo?' },
];

interface InboxProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

type FilterType = 'todos' | 'nao_lidos' | 'aguardando' | 'followup' | 'grupos';
type ChannelType = 'whatsapp' | 'instagram' | 'facebook';


const formatDateOnly = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Inbox: React.FC<InboxProps> = ({ state, setState }) => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, sendMessage, editMessage, markAsRead, markAsUnread, updateChatStatus, refetch, fetchAndUpdateAvatar, fetchMessages, loadMoreMessages, togglePinChat, addOptimisticMessage, updateOptimisticMessage } = useChats(clinicId, user?.id);
  const { stages } = usePipelineStages(clinicId);
  const PIPELINE_STAGES = stages.map(s => ({ value: s.status_key, label: s.label, color: s.color, hint: s.label }));
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [activeChannel, setActiveChannel] = useState<ChannelType>('whatsapp');
  const [channelConfig, setChannelConfig] = useState<{ instagram_enabled: boolean; facebook_enabled: boolean }>({ instagram_enabled: false, facebook_enabled: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingGroups, setSyncingGroups] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastRestartAt, setLastRestartAt] = useState<number>(0);
  const [restartAttempts, setRestartAttempts] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionModal, setConnectionModal] = useState<{ show: boolean; title: string; message: string; needsQrCode: boolean }>({ show: false, title: '', message: '', needsQrCode: false });
  
  const canSendMessage = hasPermission(user?.role, 'send_message');
  const canMoveLead = hasPermission(user?.role, 'move_lead');
  const canAddPayment = hasPermission(user?.role, 'add_payment');
  const canAddQuote = hasPermission(user?.role, 'add_quote');
  
  // Estado para drawer do painel do lead (tablet)
  const [showLeadPanelDrawer, setShowLeadPanelDrawer] = useState(false);
  
  // Estados para modais
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [availableTags, setAvailableTags] = useState<DbTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  // Estados para criar nova etiqueta
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [savingTag, setSavingTag] = useState(false);
  
  // Cores expandidas para etiquetas
  const tagColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#14B8A6', '#6366F1', '#A855F7', '#F43F5E', '#0EA5E9', '#22C55E', '#EAB308',
    '#DC2626', '#7C3AED', '#DB2777', '#0891B2', '#65A30D', '#CA8A04', '#9333EA', '#E11D48'
  ];
  
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
  const [leadSources, setLeadSources] = useState<Array<{ id: string; name: string; code: string | null; color: string; tag_id: string | null }>>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceForm, setNewSourceForm] = useState({ name: '', code: '', tag_id: '' });
  const [savingSource, setSavingSource] = useState(false);
  
  // Estados para dados do anúncio Meta (Click to WhatsApp)
  const [adInfo, setAdInfo] = useState<{ 
    ad_title: string | null; 
    ad_body: string | null; 
    ad_source_id: string | null; 
    ad_source_url: string | null; 
    ad_source_type: string | null; 
  } | null>(null);
  
  // Estados para pagamentos/negociações comerciais
  const [payments, setPayments] = useState<Array<{
    id: string;
    value: number;
    description: string | null;
    payment_date: string;
    created_at: string;
    status: 'active' | 'cancelled';
    payment_method: string | null;
  }>>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ value: '', description: '', payment_date: getLocalDateString(), payment_method: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  
  // Estados para lançamentos diretos da clínica (sem comercial)
  const [clinicReceipts, setClinicReceipts] = useState<Array<{
    id: string;
    total_value: number;
    description: string | null;
    receipt_date: string;
    created_at: string;
    payment_method: string | null;
  }>>([]);
  const [showClinicReceiptModal, setShowClinicReceiptModal] = useState(false);
  const [clinicReceiptForm, setClinicReceiptForm] = useState({ value: '', description: '', receipt_date: getLocalDateString(), payment_method: '' });
  const [savingClinicReceipt, setSavingClinicReceipt] = useState(false);
  
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
  
  // Estados para modal de valor na conversão
  const [showConversionValueModal, setShowConversionValueModal] = useState(false);
  const [conversionValue, setConversionValue] = useState('');
  const [pendingConversionChatId, setPendingConversionChatId] = useState<string | null>(null);
  
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
  
  // Estados para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para responder mensagem específica
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
    isFromClient: boolean;
  } | null>(null);
  
  // Estados para edição de mensagem
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Estados para reações de mensagens
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Array<{ emoji: string; user_id: string }>>>({});
  const reactionEmojis = ['👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', '💯', '✅', '🎉', '👏'];
  
  // Estados para bloqueio de conversa
  const [chatLock, setChatLock] = useState<{ locked_by: string | null; locked_by_name: string | null; isForwardLock?: boolean; locked_at?: string } | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  
  // Estado para modal de rate limit
  const [rateLimitModal, setRateLimitModal] = useState<{ show: boolean; message: string; waitSeconds: number }>({ show: false, message: '', waitSeconds: 0 });
  
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

  // Estados para cadastro/edição de cliente
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientData, setClientData] = useState<{
    id: string | null;
    name: string;
    phone: string;
    email: string;
    cpf: string;
    birth_date: string;
    address: string;
    notes: string;
    city: string;
    state: string;
    zip_code: string;
    gender: string;
  } | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [chatLeadId, setChatLeadId] = useState<string | null>(null);

  // Estados para busca de mensagens na conversa
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Hook para configuração de seções do painel lateral
  const { hiddenSections, toggleSectionVisibility, isSectionVisible, sectionOrder, moveSectionUp, moveSectionDown, getSectionOrder } = useSectionConfig();
  const [showSectionConfigModal, setShowSectionConfigModal] = useState(false);

  // Estados para envio de email
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string; html_content: string }>>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);

  // Emojis comuns
  const commonEmojis = [
    // Rostos felizes
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜',
    // Rostos neutros/pensativos
    '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤',
    // Rostos negativos
    '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '😳', '🥺', '😢', '😭', '😱', '😖', '😣', '😞',
    // Rostos especiais
    '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
    // Gestos e mãos
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎',
    '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
    // Corações e amor
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
    // Símbolos e objetos
    '⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '🎉', '🎊', '🎈',
    // Checkmarks e status
    '✅', '❌', '❓', '❔', '❕', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '▶️', '⏸️', '⏹️', '⏺️'
  ];

  // Constantes para cooldown de restart
  const RESTART_COOLDOWN_MS = 60000; // 60 segundos entre restarts
  const MAX_RESTARTS_IN_WINDOW = 3; // máximo 3 restarts em 10 min
  const RESTART_WINDOW_MS = 600000; // 10 minutos

  // Helper: verificar connectionState
  const checkConnectionState = async (apiUrl: string, apiKey: string, instanceName: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `${apiUrl}/instance/connectionState/${instanceName}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data?.instance?.state || data?.state || null;
    } catch {
      return null;
    }
  };

  // Helper: tentar connect
  const tryConnect = async (apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> => {
    try {
      await fetch(
        `${apiUrl}/instance/connect/${instanceName}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        }
      );
      await new Promise(resolve => setTimeout(resolve, 3000));
      const state = await checkConnectionState(apiUrl, apiKey, instanceName);
      return state === 'open' || state === 'connected';
    } catch {
      return false;
    }
  };

  // Helper: logout da instância
  const tryLogout = async (apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> => {
    try {
      await fetch(
        `${apiUrl}/instance/logout/${instanceName}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        }
      );
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } catch {
      return false;
    }
  };

  // Função para verificar e garantir conexão da instância (3 níveis de recuperação)
  const ensureInstanceConnected = async (): Promise<{ connected: boolean; needsQrCode: boolean; error?: string; level?: number }> => {
    try {
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
        return { connected: false, needsQrCode: false, error: 'Evolution API não configurada' };
      }
      
      const apiUrl = settings.evolution_api_url;
      const apiKey = settings.evolution_api_key;
      
      // Buscar instância WhatsApp
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status')
        .eq('clinic_id', clinicId)
        .limit(1);
      
      const instance = instances?.[0];
      if (!instance) {
        return { connected: false, needsQrCode: false, error: 'Nenhuma instância WhatsApp encontrada' };
      }
      
      const instanceName = instance.instance_name;
      
      // Verificar estado real da conexão via API
      const connectionState = await checkConnectionState(apiUrl, apiKey, instanceName);
      
      // Se está conectado, retorna sucesso
      if (connectionState === 'open' || connectionState === 'connected') {
        setConnectionError(null);
        return { connected: true, needsQrCode: false };
      }
      
      // Verificar cooldown antes de tentar recuperação
      const now = Date.now();
      const timeSinceLastRestart = now - lastRestartAt;
      
      if (timeSinceLastRestart < RESTART_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESTART_COOLDOWN_MS - timeSinceLastRestart) / 1000);
        return { connected: false, needsQrCode: false, error: `Aguarde ${waitSeconds}s antes de tentar reconectar` };
      }
      
      // Verificar limite de restarts na janela
      if (restartAttempts >= MAX_RESTARTS_IN_WINDOW) {
        setConnectionError('Requer QR Code');
        return { connected: false, needsQrCode: true, error: 'Muitas tentativas de reconexão. Escaneie o QR Code novamente.', level: 3 };
      }
      
      setIsReconnecting(true);
      setLastRestartAt(now);
      setRestartAttempts(prev => prev + 1);
      
      // ========== NÍVEL 1: Tentar connect (preserva sessão) ==========
      console.log('[Recovery] Nível 1: Tentando connect...');
      const level1Success = await tryConnect(apiUrl, apiKey, instanceName);
      
      if (level1Success) {
        console.log('[Recovery] Nível 1: Sucesso!');
        setIsReconnecting(false);
        setConnectionError(null);
        setRestartAttempts(0);
        return { connected: true, needsQrCode: false, level: 1 };
      }
      
      // ========== NÍVEL 2: Logout + Reconnect ==========
      console.log('[Recovery] Nível 2: Tentando logout + reconnect...');
      await tryLogout(apiUrl, apiKey, instanceName);
      const level2Success = await tryConnect(apiUrl, apiKey, instanceName);
      
      if (level2Success) {
        console.log('[Recovery] Nível 2: Sucesso!');
        setIsReconnecting(false);
        setConnectionError(null);
        setRestartAttempts(0);
        return { connected: true, needsQrCode: false, level: 2 };
      }
      
      // ========== NÍVEL 3: Requer novo QR Code ==========
      console.log('[Recovery] Nível 3: Requer QR Code');
      setIsReconnecting(false);
      setConnectionError('Requer QR Code');
      return { 
        connected: false, 
        needsQrCode: true, 
        error: 'Não foi possível reconectar automaticamente. Escaneie o QR Code em Configurações > WhatsApp.',
        level: 3 
      };
      
    } catch (err) {
      console.error('Erro ao verificar conexão:', err);
      setIsReconnecting(false);
      return { connected: false, needsQrCode: false, error: 'Erro ao verificar conexão' };
    }
  };

  // Reset do contador de restarts a cada 10 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      setRestartAttempts(0);
    }, RESTART_WINDOW_MS);
    return () => clearInterval(interval);
  }, []);

  // Verificar estado real da conexão ao carregar (não confiar apenas no banco)
  useEffect(() => {
    const checkRealConnectionState = async () => {
      if (!clinicId) return;
      
      try {
        // Buscar configurações da Evolution API
        const { data: settings } = await supabase
          .from('settings')
          .select('evolution_api_url, evolution_api_key')
          .single();
        
        if (!settings?.evolution_api_url || !settings?.evolution_api_key) return;
        
        // Buscar instância WhatsApp
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, status')
          .eq('clinic_id', clinicId)
          .limit(1);
        
        const instance = instances?.[0];
        if (!instance) return;
        
        // Verificar estado real via API
        const state = await checkConnectionState(
          settings.evolution_api_url, 
          settings.evolution_api_key, 
          instance.instance_name
        );
        
        console.log('[Connection Check] Estado real:', state, '| Status no banco:', instance.status);
        
        // Se o banco diz "connected" mas a API diz diferente, mostrar erro
        if (instance.status === 'connected' && state !== 'open' && state !== 'connected') {
          console.warn('[Connection Check] Discrepância detectada! Banco: connected, API:', state);
          setConnectionError('Conexão instável. Clique para verificar.');
        } else if (state === 'open' || state === 'connected') {
          setConnectionError(null);
        }
      } catch (err) {
        console.error('[Connection Check] Erro:', err);
      }
    };
    
    // Verificar após 3 segundos do carregamento
    const timer = setTimeout(checkRealConnectionState, 3000);
    return () => clearTimeout(timer);
  }, [clinicId]);

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

  // Buscar configuração de canais (Instagram/Facebook)
  useEffect(() => {
    const fetchChannelConfig = async () => {
      if (!clinicId) return;
      const { data } = await (supabase as any)
        .from('clinics')
        .select('instagram_enabled, facebook_enabled')
        .eq('id', clinicId)
        .single();
      if (data) {
        setChannelConfig({
          instagram_enabled: data.instagram_enabled || false,
          facebook_enabled: data.facebook_enabled || false,
        });
      }
    };
    fetchChannelConfig();
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

  // Sincronizar grupos do WhatsApp automaticamente (em background)
  useEffect(() => {
    const syncGroups = async () => {
      if (!clinicId) return;
      
      try {
        setConnectionError(null);
        
        // Buscar configurações da Evolution API
        const { data: settings } = await supabase
          .from('settings')
          .select('evolution_api_url, evolution_api_key')
          .single();
        
        if (!settings?.evolution_api_url || !settings?.evolution_api_key) return;
        
        // Buscar instância WhatsApp conectada
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, status')
          .eq('clinic_id', clinicId)
          .eq('status', 'connected')
          .limit(1);
        
        const instance = instances?.[0];
        if (!instance) return;
        
        // Buscar grupos da Evolution API
        const response = await fetch(
          `${settings.evolution_api_url}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': settings.evolution_api_key,
            },
          }
        );
        
        if (!response.ok) {
          if (response.status === 500) {
            setConnectionError('Erro de conexão com WhatsApp. Verifique se a instância está conectada.');
          }
          return;
        }
        
        const groups = await response.json();
        if (!Array.isArray(groups) || groups.length === 0) return;
        
        // Cadastrar cada grupo no banco (silenciosamente)
        for (const group of groups) {
          const groupId = group.id;
          const groupName = group.subject || group.name || 'Grupo sem nome';
          const groupPhone = groupId.replace('@g.us', '');
          
          // Verificar se já existe
          const { data: existingChat } = await supabase
            .from('chats')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('group_id', groupId)
            .single();
          
          if (!existingChat) {
            await (supabase as any)
              .from('chats')
              .insert({
                clinic_id: clinicId,
                client_name: groupName,
                phone_number: groupPhone,
                group_id: groupId,
                is_group: true,
                status: 'Em Atendimento',
                unread_count: 0,
                last_message: '',
                last_message_time: new Date().toISOString(),
                instance_id: instance.id,
              });
          }
        }
        
        // Recarregar lista de chats silenciosamente
        refetch();
      } catch (err) {
        console.error('Erro ao sincronizar grupos (background):', err);
        setConnectionError('Erro de conexão. Clique para tentar novamente.');
      }
    };
    
    // Executar após 2 segundos para não travar o carregamento inicial
    const timer = setTimeout(syncGroups, 2000);
    return () => clearTimeout(timer);
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

  // Função auxiliar para normalizar e hashear em SHA256 (conforme regras da Meta)
  const hashSHA256 = async (value: string): Promise<string | null> => {
    if (!value || !value.trim()) return null;
    // Normalizar: minúsculo, trim, remover acentos
    const normalized = value
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Função para enviar evento de conversão ao Facebook (Payload otimizado conforme regras da Meta)
  const sendFacebookConversionEvent = async (chatId: string, value: number, funnelStage?: string) => {
    if (!clinicId) return;
    
    try {
      // Buscar configurações do Facebook da clínica
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('facebook_dataset_id, facebook_api_token, meta_event_name, meta_action_source, meta_funnel_events')
        .eq('id', clinicId)
        .single();
      
      if (!clinicData?.facebook_dataset_id || !clinicData?.facebook_api_token) {
        console.log('Facebook Conversions API não configurada');
        return;
      }
      
      // Determinar qual evento enviar baseado na etapa do funil
      const funnelEvents = clinicData.meta_funnel_events as Record<string, string> | null;
      let eventName: string | null = null;
      
      if (funnelStage && funnelEvents && funnelEvents[funnelStage]) {
        // Usar configuração por etapa do funil
        eventName = funnelEvents[funnelStage];
      } else if (!funnelStage || funnelStage === 'Convertido') {
        // Fallback para configuração antiga (compatibilidade)
        eventName = clinicData.meta_event_name || 'Purchase';
      }
      
      // Se não há evento configurado para esta etapa, não enviar
      if (!eventName) {
        console.log(`Nenhum evento Meta configurado para a etapa: ${funnelStage}`);
        return;
      }
      
      const actionSource = clinicData.meta_action_source || 'website';
      
      // Buscar dados completos do chat (incluindo lead e origem)
      const { data: chatData } = await (supabase as any)
        .from('chats')
        .select(`
          id,
          phone_number, 
          client_name,
          lead_id,
          source_id,
          leads(email, name, city, state, zip_code, gender, birth_date),
          lead_sources(name, code)
        `)
        .eq('id', chatId)
        .single();
      
      // Preparar dados do usuário
      const phone = chatData?.phone_number?.replace(/\D/g, '') || '';
      const clientName = chatData?.client_name || chatData?.leads?.name || '';
      const nameParts = clientName.split(' ').filter((p: string) => p.trim());
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const email = chatData?.leads?.email || '';
      const city = chatData?.leads?.city || '';
      const state = chatData?.leads?.state || '';
      const zipCode = chatData?.leads?.zip_code?.replace(/\D/g, '') || '';
      const gender = chatData?.leads?.gender || '';
      const birthDate = chatData?.leads?.birth_date || '';
      const sourceName = chatData?.lead_sources?.name || chatData?.lead_sources?.code || '';
      
      // Hashear todos os campos (SHA256, normalizado)
      const [phoneHash, emailHash, fnHash, lnHash, externalIdHash, cityHash, stateHash, zipHash, genderHash, dobHash] = await Promise.all([
        phone ? hashSHA256(phone) : null,
        email ? hashSHA256(email) : null,
        firstName ? hashSHA256(firstName) : null,
        lastName ? hashSHA256(lastName) : null,
        hashSHA256(chatId),
        city ? hashSHA256(city) : null,
        state ? hashSHA256(state.toLowerCase()) : null,
        zipCode ? hashSHA256(zipCode) : null,
        gender ? hashSHA256(gender) : null,
        birthDate ? hashSHA256(birthDate.replace(/-/g, '')) : null, // YYYYMMDD
      ]);
      
      // Montar user_data (só incluir campos que existem)
      const userData: Record<string, string> = {};
      if (phoneHash) userData.ph = phoneHash;
      if (emailHash) userData.em = emailHash;
      if (fnHash) userData.fn = fnHash;
      if (lnHash) userData.ln = lnHash;
      if (externalIdHash) userData.external_id = externalIdHash;
      if (cityHash) userData.ct = cityHash;
      if (stateHash) userData.st = stateHash;
      if (zipHash) userData.zp = zipHash;
      if (genderHash) userData.ge = genderHash;
      if (dobHash) userData.db = dobHash;
      
      // Montar custom_data (incluindo origem da campanha)
      const customData: Record<string, string | number> = {
        currency: 'BRL',
        value: value,
      };
      if (sourceName) {
        customData.content_name = sourceName;
        const sourceNameLower = sourceName.toLowerCase();
        if (sourceNameLower.includes('instagram')) customData.content_category = 'Instagram';
        else if (sourceNameLower.includes('facebook') || sourceNameLower.includes('fb')) customData.content_category = 'Facebook';
        else if (sourceNameLower.includes('google')) customData.content_category = 'Google';
        else if (sourceNameLower.includes('tiktok')) customData.content_category = 'TikTok';
        else customData.content_category = 'Outros';
      }
      
      // Gerar event_id único (evita duplicação)
      const eventTime = Math.floor(Date.now() / 1000);
      const eventId = `crm_${eventName.toLowerCase()}_${chatId.substring(0, 8)}_${eventTime}`;
      
      // Montar payload final
      const eventData = {
        data: [{
          event_name: eventName,
          event_time: eventTime,
          event_id: eventId,
          action_source: actionSource,
          user_data: userData,
          custom_data: customData,
        }],
      };
      
      console.log('Enviando evento Meta Conversions API:', JSON.stringify(eventData, null, 2));
      
      // Salvar log antes de enviar
      const { data: logEntry } = await (supabase as any)
        .from('meta_conversion_logs')
        .insert({
          clinic_id: clinicId,
          chat_id: chatId,
          event_id: eventId,
          event_name: eventName,
          event_time: eventTime,
          value: value,
          payload: eventData,
          status: 'pending',
        })
        .select('id')
        .single();
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${clinicData.facebook_dataset_id}/events?access_token=${clinicData.facebook_api_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('Evento de conversão enviado ao Facebook com sucesso:', result);
        // Atualizar log com sucesso
        if (logEntry?.id) {
          await (supabase as any)
            .from('meta_conversion_logs')
            .update({ status: 'success', response: result })
            .eq('id', logEntry.id);
        }
      } else {
        const errorData = await response.json();
        console.error('Erro ao enviar evento ao Facebook:', errorData);
        // Atualizar log com erro
        if (logEntry?.id) {
          await (supabase as any)
            .from('meta_conversion_logs')
            .update({ 
              status: 'error', 
              response: errorData,
              error_message: errorData?.error?.message || 'Erro desconhecido'
            })
            .eq('id', logEntry.id);
        }
      }
    } catch (err) {
      console.error('Erro ao enviar evento de conversão:', err);
    }
  };

  // Alterar etapa do funil
  const handleChangeStage = async (newStatus: string) => {
    if (!selectedChatId) return;
    
    // Se está mudando para "Convertido", verificar se tem valor
    if (newStatus === 'Convertido') {
      // Verificar se tem orçamento aprovado ou pagamentos
      const totalQuotes = quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + q.value, 0);
      const totalPayments = payments.reduce((sum, p) => sum + p.value, 0);
      const totalValue = totalQuotes || totalPayments;
      
      if (totalValue > 0) {
        // Tem valor, enviar evento e mudar status
        await updateChatStatus(selectedChatId, newStatus);
        await sendFacebookConversionEvent(selectedChatId, totalValue, newStatus);
        setShowStageDropdown(false);
      } else {
        // Não tem valor, abrir modal para pedir
        setPendingConversionChatId(selectedChatId);
        setConversionValue('');
        setShowConversionValueModal(true);
        setShowStageDropdown(false);
      }
      return;
    }
    
    await updateChatStatus(selectedChatId, newStatus);
    // Enviar evento Meta para outras etapas (se configurado)
    await sendFacebookConversionEvent(selectedChatId, 0, newStatus);
    setShowStageDropdown(false);
  };

  // Confirmar conversão com valor informado
  const handleConfirmConversion = async () => {
    if (!pendingConversionChatId || !conversionValue) return;
    
    const value = parseFloat(conversionValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      alert('Informe um valor válido');
      return;
    }
    
    // Salvar como pagamento
    await supabase.from('payments' as any).insert({
      chat_id: pendingConversionChatId,
      clinic_id: clinicId,
      value: value,
      description: 'Valor da conversão',
      payment_date: getLocalDateString(),
      created_by: user?.id,
    });
    
    // Mudar status e enviar evento
    await updateChatStatus(pendingConversionChatId, 'Convertido');
    await sendFacebookConversionEvent(pendingConversionChatId, value, 'Convertido');
    
    // Recarregar pagamentos
    if (selectedChatId === pendingConversionChatId) {
      await fetchPayments(pendingConversionChatId);
    }
    
    // Fechar modal
    setShowConversionValueModal(false);
    setPendingConversionChatId(null);
    setConversionValue('');
  };

  // Buscar responsável atual do chat e status de bloqueio
  const fetchChatAssignment = async (chatId: string) => {
    const { data: chatData } = await supabase
      .from('chats')
      .select('assigned_to, locked_by, locked_at')
      .eq('id', chatId)
      .single();
    
    const chat = chatData as any;
    
    // Buscar responsável (assigned_to)
    if (chat?.assigned_to) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', chat.assigned_to)
        .single();
      
      if (userData) {
        setChatAssignedTo({ id: (userData as any).id, name: (userData as any).name });
      } else {
        setChatAssignedTo(null);
      }
    } else {
      setChatAssignedTo(null);
    }
    
    // Buscar bloqueio (locked_by)
    if (chat?.locked_by) {
      const { data: lockerData } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', chat.locked_by)
        .single();
      
      if (lockerData) {
        setChatLock({ 
          locked_by: chat.locked_by, 
          locked_by_name: (lockerData as any).name, 
          locked_at: chat.locked_at 
        });
      }
    } else {
      setChatLock(null);
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

  // Bloquear conversa quando usuário seleciona (apenas bloqueio temporário de digitação)
  const lockChat = async (chatId: string) => {
    if (!user?.id) return;
    setIsLocking(true);
    
    try {
      // Verificar se já está bloqueada (por encaminhamento ou outro usuário)
      const { data: chatData } = await supabase
        .from('chats')
        .select('locked_by, locked_at, assigned_to')
        .eq('id', chatId)
        .single();
      
      const chat = chatData as any;
      const lockTimeout = 5 * 60 * 1000; // 5 minutos
      const now = new Date();
      
      // Se tem assigned_to E locked_by, é bloqueio de encaminhamento - NÃO sobrescrever
      if (chat?.assigned_to && chat?.locked_by) {
        // Buscar nome do usuário que bloqueou
        const { data: lockerData } = await supabase
          .from('users')
          .select('name')
          .eq('id', chat.locked_by)
          .single();
        
        setChatLock({ 
          locked_by: chat.locked_by, 
          locked_by_name: (lockerData as any)?.name || 'Outro usuário',
          isForwardLock: true // Marcar como bloqueio de encaminhamento
        });
        return;
      }
      
      // Bloqueio temporário de outro usuário
      if (chat?.locked_by && chat.locked_by !== user.id) {
        const lockedAt = new Date(chat.locked_at);
        if (now.getTime() - lockedAt.getTime() < lockTimeout) {
          const { data: lockerData } = await supabase
            .from('users')
            .select('name')
            .eq('id', chat.locked_by)
            .single();
          
          setChatLock({ 
            locked_by: chat.locked_by, 
            locked_by_name: (lockerData as any)?.name || 'Outro usuário',
            isForwardLock: false
          });
          return;
        }
      }
      
      // Bloquear temporariamente para este usuário (apenas se não tem bloqueio de encaminhamento)
      if (!chat?.assigned_to || !chat?.locked_by) {
        await supabase
          .from('chats')
          .update({ locked_by: user.id, locked_at: now.toISOString() } as any)
          .eq('id', chatId);
      }
      
      setChatLock(null);
    } catch (err) {
      console.error('Error locking chat:', err);
    } finally {
      setIsLocking(false);
    }
  };

  // Desbloquear conversa (apenas bloqueio temporário, não de encaminhamento)
  const unlockChat = async (chatId: string) => {
    if (!user?.id) return;
    
    try {
      // Desbloquear apenas se o bloqueio é do usuário atual
      // O .eq('locked_by', user.id) garante que só desbloqueia se foi ele quem bloqueou
      await supabase
        .from('chats')
        .update({ locked_by: null, locked_at: null } as any)
        .eq('id', chatId)
        .eq('locked_by', user.id);
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
        .select('locked_by, locked_at, assigned_to')
        .eq('id', selectedChatId)
        .single();
      
      const chat = chatData as any;
      
      // Se é bloqueio de encaminhamento (tem assigned_to E locked_by), manter o lock
      if (chat?.assigned_to && chat?.locked_by) {
        const { data: lockerData } = await supabase
          .from('users')
          .select('name')
          .eq('id', chat.locked_by)
          .single();
        
        setChatLock({ 
          locked_by: chat.locked_by, 
          locked_by_name: (lockerData as any)?.name || 'Outro usuário',
          isForwardLock: true
        });
        return;
      }
      
      // Bloqueio temporário de outro usuário
      if (chat?.locked_by && chat.locked_by !== user?.id) {
        const lockTimeout = 5 * 60 * 1000;
        const now = new Date();
        const lockedAt = new Date(chat.locked_at);
        
        if (now.getTime() - lockedAt.getTime() < lockTimeout) {
          const { data: lockerData } = await supabase
            .from('users')
            .select('name')
            .eq('id', chat.locked_by)
            .single();
          
          setChatLock({ 
            locked_by: chat.locked_by, 
            locked_by_name: (lockerData as any)?.name || 'Outro usuário',
            isForwardLock: false
          });
        } else {
          setChatLock(null);
        }
      } else if (!chat?.assigned_to) {
        // Só reseta se não for bloqueio de encaminhamento
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
    setShowCreateTag(false);
    setNewTagName('');
    setNewTagColor('#3B82F6');
  };

  // Criar nova etiqueta
  const handleCreateTag = async () => {
    if (!newTagName.trim() || !clinicId) return;
    
    setSavingTag(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ 
          clinic_id: clinicId, 
          name: newTagName.trim(), 
          color: newTagColor 
        })
        .select()
        .single();
      
      if (!error && data) {
        // Adicionar a nova tag à lista
        setAvailableTags(prev => [...prev, data]);
        // Resetar form
        setNewTagName('');
        setNewTagColor('#3B82F6');
        setShowCreateTag(false);
      }
    } catch (err) {
      console.error('Error creating tag:', err);
    } finally {
      setSavingTag(false);
    }
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

  // Excluir orçamento
  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
    
    try {
      const { error } = await supabase
        .from('quotes' as any)
        .delete()
        .eq('id', quoteId);
      
      if (!error && selectedChatId) {
        await fetchQuotes(selectedChatId);
      }
    } catch (err) {
      console.error('Error deleting quote:', err);
    }
  };

  // Buscar origens de leads da clínica
  const fetchLeadSources = async () => {
    if (!clinicId) return;
    try {
      const { data, error } = await supabase
        .from('lead_sources' as any)
        .select('id, name, code, color, tag_id')
        .eq('clinic_id', clinicId)
        .order('name');
      
      if (!error && data) {
        setLeadSources(data as any);
      }
    } catch (err) {
      console.error('Error fetching lead sources:', err);
    }
  };
  
  // Função auxiliar para obter a cor da origem (da etiqueta vinculada ou cor própria)
  const getSourceColor = (source: { color: string; tag_id: string | null }) => {
    if (source.tag_id) {
      const linkedTag = availableTags.find(t => t.id === source.tag_id);
      if (linkedTag) return linkedTag.color;
    }
    return source.color || '#6B7280';
  };

  // Buscar origem e dados do anúncio do chat selecionado
  const fetchChatSource = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('source_id, ad_title, ad_body, ad_source_id, ad_source_url, ad_source_type')
        .eq('id', chatId)
        .single();
      
      if (!error && data) {
        setSelectedSourceId((data as any).source_id);
        // Verificar se tem dados de anúncio Meta
        if ((data as any).ad_title || (data as any).ad_source_id) {
          setAdInfo({
            ad_title: (data as any).ad_title,
            ad_body: (data as any).ad_body,
            ad_source_id: (data as any).ad_source_id,
            ad_source_url: (data as any).ad_source_url,
            ad_source_type: (data as any).ad_source_type
          });
        } else {
          setAdInfo(null);
        }
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
      // Obter cor da etiqueta selecionada ou usar cor padrão
      const selectedTag = availableTags.find(t => t.id === newSourceForm.tag_id);
      const sourceColor = selectedTag?.color || '#6B7280';
      
      const { data, error } = await supabase
        .from('lead_sources' as any)
        .insert({
          clinic_id: clinicId,
          name: newSourceForm.name.trim(),
          code: newSourceForm.code.trim() || null,
          tag_id: newSourceForm.tag_id || null,
          color: sourceColor,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          alert('Já existe uma origem com esse nome. Escolha outro nome.');
        } else {
          alert('Erro ao criar origem: ' + error.message);
        }
        return;
      }
      
      if (data) {
        await fetchLeadSources();
        setNewSourceForm({ name: '', code: '', tag_id: '' });
        setShowAddSourceModal(false);
      }
    } catch (err) {
      console.error('Error creating source:', err);
      alert('Erro ao criar origem');
    } finally {
      setSavingSource(false);
    }
  };

  // Buscar pagamentos do chat selecionado
  const fetchPayments = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments' as any)
        .select('id, value, description, payment_date, created_at, status, payment_method')
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
          payment_method: paymentForm.payment_method || null,
          created_by: user.id,
        });
      
      if (!error) {
        // Enviar evento Purchase para Meta (Negociação Comercial = fechou negócio)
        const totalValue = parseFloat(paymentForm.value.replace(',', '.'));
        await sendFacebookConversionEvent(selectedChatId, totalValue, 'Convertido');
        
        setPaymentForm({ value: '', description: '', payment_date: getLocalDateString(), payment_method: '' });
        setShowPaymentModal(false);
        await fetchPayments(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving payment:', err);
    } finally {
      setSavingPayment(false);
    }
  };

  // Cancelar pagamento/negociação
  const handleCancelPayment = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta negociação?')) return;
    
    try {
      const { error } = await supabase
        .from('payments' as any)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', paymentId);
      
      if (!error && selectedChatId) {
        await fetchPayments(selectedChatId);
      }
    } catch (err) {
      console.error('Error cancelling payment:', err);
    }
  };

  // Buscar lançamentos diretos da clínica (sem comercial)
  const fetchClinicReceipts = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('clinic_receipts' as any)
        .select('id, total_value, description, receipt_date, created_at, receipt_payments(payment_method)')
        .eq('chat_id', chatId)
        .is('payment_id', null)
        .order('receipt_date', { ascending: false });
      
      if (!error && data) {
        const receiptsWithMethod = (data as any[]).map(r => ({
          ...r,
          payment_method: r.receipt_payments?.[0]?.payment_method || null
        }));
        setClinicReceipts(receiptsWithMethod);
      }
    } catch (err) {
      console.error('Error fetching clinic receipts:', err);
    }
  };

  // Salvar novo lançamento direto da clínica
  const handleSaveClinicReceipt = async () => {
    if (!clinicReceiptForm.value || !selectedChatId || !user || !clinicId) return;
    
    setSavingClinicReceipt(true);
    try {
      const totalValue = parseFloat(clinicReceiptForm.value.replace(',', '.'));
      
      // Criar o recebimento sem payment_id (lançamento direto)
      const { data: newReceipt, error } = await supabase
        .from('clinic_receipts' as any)
        .insert({
          clinic_id: clinicId,
          chat_id: selectedChatId,
          payment_id: null,
          total_value: totalValue,
          description: clinicReceiptForm.description.trim() || null,
          receipt_date: clinicReceiptForm.receipt_date,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (!error && newReceipt && clinicReceiptForm.payment_method) {
        // Criar o registro de forma de pagamento
        await supabase.from('receipt_payments' as any).insert({
          receipt_id: (newReceipt as any).id,
          value: totalValue,
          payment_method: clinicReceiptForm.payment_method,
          installments: 1
        });
      }
      
      if (!error) {
        // Enviar evento Purchase para Meta (Lançamento da Clínica = procedimento realizado)
        await sendFacebookConversionEvent(selectedChatId, totalValue, 'Convertido');
        
        setClinicReceiptForm({ value: '', description: '', receipt_date: getLocalDateString(), payment_method: '' });
        setShowClinicReceiptModal(false);
        await fetchClinicReceipts(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving clinic receipt:', err);
    } finally {
      setSavingClinicReceipt(false);
    }
  };

  // Excluir lançamento direto da clínica
  const handleDeleteClinicReceipt = async (receiptId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    
    try {
      const { error } = await supabase
        .from('clinic_receipts' as any)
        .delete()
        .eq('id', receiptId);
      
      if (!error && selectedChatId) {
        await fetchClinicReceipts(selectedChatId);
      }
    } catch (err) {
      console.error('Error deleting clinic receipt:', err);
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

  // Buscar dados do cliente vinculado ao chat
  const fetchChatClient = async (chatId: string) => {
    try {
      const { data: chatData } = await supabase
        .from('chats')
        .select('lead_id')
        .eq('id', chatId)
        .single();
      
      if (chatData?.lead_id) {
        setChatLeadId(chatData.lead_id);
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, name, phone, email, cpf, birth_date, address, notes')
          .eq('id', chatData.lead_id)
          .single();
        
        if (leadData) {
          setClientData({
            id: (leadData as any).id,
            name: (leadData as any).name || '',
            phone: (leadData as any).phone || '',
            email: (leadData as any).email || '',
            cpf: (leadData as any).cpf || '',
            birth_date: (leadData as any).birth_date || '',
            address: (leadData as any).address || '',
            notes: (leadData as any).notes || '',
            city: (leadData as any).city || '',
            state: (leadData as any).state || '',
            zip_code: (leadData as any).zip_code || '',
            gender: (leadData as any).gender || '',
          });
        }
      } else {
        setChatLeadId(null);
        setClientData(null);
      }
    } catch (err) {
      console.error('Error fetching chat client:', err);
    }
  };

  // Abrir modal de cadastro de cliente
  const openClientModal = () => {
    if (chatLeadId && clientData) {
      // Editar cliente existente
      setShowClientModal(true);
    } else {
      // Novo cliente - preencher com dados do chat
      setClientData({
        id: null,
        name: selectedChat?.client_name || '',
        phone: selectedChat?.phone_number || '',
        email: '',
        cpf: '',
        birth_date: '',
        address: '',
        notes: '',
        city: '',
        state: '',
        zip_code: '',
        gender: '',
      });
      setShowClientModal(true);
    }
  };

  // Salvar cliente (criar ou atualizar)
  const handleSaveClient = async () => {
    if (!clientData || !clientData.name.trim() || !clinicId || !selectedChatId) return;
    
    setSavingClient(true);
    try {
      if (clientData.id) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('leads')
          .update({
            name: clientData.name.trim(),
            phone: clientData.phone.trim(),
            email: clientData.email.trim() || null,
            cpf: clientData.cpf.trim() || null,
            birth_date: clientData.birth_date || null,
            address: clientData.address.trim() || null,
            notes: clientData.notes.trim() || null,
            city: clientData.city?.trim() || null,
            state: clientData.state?.trim() || null,
            zip_code: clientData.zip_code?.trim() || null,
            gender: clientData.gender || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', clientData.id);
        
        if (error) throw error;
        
        // Atualizar nome no chat
        await supabase
          .from('chats')
          .update({ client_name: clientData.name.trim() })
          .eq('id', selectedChatId);
      } else {
        // Criar novo cliente
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            clinic_id: clinicId,
            name: clientData.name.trim(),
            phone: clientData.phone.trim(),
            email: clientData.email.trim() || null,
            cpf: clientData.cpf.trim() || null,
            birth_date: clientData.birth_date || null,
            address: clientData.address.trim() || null,
            notes: clientData.notes.trim() || null,
            city: clientData.city?.trim() || null,
            state: clientData.state?.trim() || null,
            zip_code: clientData.zip_code?.trim() || null,
            gender: clientData.gender || null,
            stage: 'Novo Lead',
          } as any)
          .select('id')
          .single();
        
        if (error) throw error;
        
        // Vincular cliente ao chat e atualizar nome
        if (newLead) {
          await supabase
            .from('chats')
            .update({ 
              lead_id: (newLead as any).id,
              client_name: clientData.name.trim()
            })
            .eq('id', selectedChatId);
          
          setChatLeadId((newLead as any).id);
          setClientData(prev => prev ? { ...prev, id: (newLead as any).id } : null);
        }
      }
      
      setShowClientModal(false);
      refetch();
    } catch (err) {
      console.error('Error saving client:', err);
      alert('Erro ao salvar cliente');
    } finally {
      setSavingClient(false);
    }
  };

  // Buscar origens ao carregar
  useEffect(() => {
    fetchLeadSources();
  }, [clinicId]);

  // Buscar configuração SMTP e templates de email
  useEffect(() => {
    const fetchEmailConfig = async () => {
      if (!clinicId) return;
      
      try {
        // Verificar se SMTP está configurado
        const { data: clinicData } = await supabase
          .from('clinics' as any)
          .select('smtp_host, smtp_user, email_marketing_enabled')
          .eq('id', clinicId)
          .single();
        
        const hasSmtp = (clinicData as any)?.smtp_host && (clinicData as any)?.smtp_user && (clinicData as any)?.email_marketing_enabled;
        setSmtpConfigured(!!hasSmtp);
        
        // Se SMTP configurado, buscar templates
        if (hasSmtp) {
          const { data: templates } = await supabase
            .from('email_templates' as any)
            .select('id, name, subject, html_content')
            .eq('clinic_id', clinicId)
            .order('name');
          
          if (templates) {
            setEmailTemplates(templates as any);
          }
        }
      } catch (err) {
        console.error('Error fetching email config:', err);
      }
    };
    
    fetchEmailConfig();
  }, [clinicId]);

  // Buscar email do lead quando mudar de chat
  useEffect(() => {
    const fetchLeadEmail = async () => {
      if (!selectedChatId || !chatLeadId) {
        setLeadEmail(null);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('leads' as any)
          .select('email')
          .eq('id', chatLeadId)
          .single();
        
        setLeadEmail((data as any)?.email || null);
      } catch (err) {
        setLeadEmail(null);
      }
    };
    
    fetchLeadEmail();
  }, [selectedChatId, chatLeadId]);

  // Função para enviar email
  const handleSendEmail = async () => {
    if (!selectedChatId || !selectedEmailTemplateId || !clinicId || !leadEmail) return;
    
    const selectedChat = chats.find(c => c.id === selectedChatId);
    if (!selectedChat) return;
    
    setSendingEmail(true);
    try {
      const template = emailTemplates.find(t => t.id === selectedEmailTemplateId);
      if (!template) throw new Error('Template não encontrado');
      
      // Buscar dados da clínica
      const { data: clinicData } = await supabase
        .from('clinics' as any)
        .select('name, email, phone')
        .eq('id', clinicId)
        .single();
      
      // Substituir variáveis no template
      let htmlContent = template.html_content;
      let subject = template.subject;
      
      const variables: Record<string, string> = {
        '{{lead_name}}': selectedChat.client_name || 'Cliente',
        '{{clinic_name}}': (clinicData as any)?.name || '',
        '{{clinic_email}}': (clinicData as any)?.email || '',
        '{{clinic_phone}}': (clinicData as any)?.phone || '',
        '{{unsubscribe_url}}': '#',
      };
      
      Object.entries(variables).forEach(([key, value]) => {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      });
      
      // Chamar edge function para enviar email
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: leadEmail,
          subject: subject,
          html: htmlContent,
          clinic_id: clinicId,
        }
      });
      
      if (error) throw error;
      
      setShowEmailModal(false);
      setSelectedEmailTemplateId('');
      
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    } finally {
      setSendingEmail(false);
    }
  };

  // Buscar notas, orçamentos, origem, pagamentos, tarefas, mensagens agendadas e cliente quando mudar de chat
  useEffect(() => {
    if (selectedChatId) {
      fetchNotes(selectedChatId);
      fetchQuotes(selectedChatId);
      fetchChatSource(selectedChatId);
      fetchPayments(selectedChatId);
      fetchClinicReceipts(selectedChatId);
      fetchTasks(selectedChatId);
      fetchScheduledMessages(selectedChatId);
      fetchChatClient(selectedChatId);
    } else {
      setNotes([]);
      setQuotes([]);
      setSelectedSourceId(null);
      setPayments([]);
      setClinicReceipts([]);
      setTasks([]);
      setScheduledMessages([]);
      setChatLeadId(null);
      setClientData(null);
    }
  }, [selectedChatId]);

  // Filtrar chats baseado no filtro ativo e busca
  const filteredChats = chats.filter(chat => {
    // Filtro de canal
    const chatChannel = (chat as any).channel || 'whatsapp';
    if (chatChannel !== activeChannel) return false;

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
        return !(chat as any).is_group && (chat.unread_count || 0) > 0;
      case 'aguardando':
        // Chats onde a última mensagem foi do cliente E já foi lida (aguardando resposta)
        return !(chat as any).is_group && (chat as any).last_message_from_client === true && (chat.unread_count || 0) === 0;
      case 'followup':
        return !(chat as any).is_group && chat.id in followupData;
      case 'grupos':
        return (chat as any).is_group === true;
      case 'todos':
      default:
        return !(chat as any).is_group; // Todos mostra apenas conversas individuais
    }
  });

  // Ler chatId da URL (vindo do Kanban) e selecionar automaticamente
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatIdFromUrl = params.get('chatId');
    
    if (chatIdFromUrl && chats?.length) {
      const exists = chats.some(c => c.id === chatIdFromUrl);
      if (exists) {
        setSelectedChatId(chatIdFromUrl);
        markAsRead(chatIdFromUrl);
        // Limpar o parâmetro da URL após selecionar
        navigate('/inbox', { replace: true });
      }
    }
  }, [location.search, chats]);

  // Selecionar primeira conversa automaticamente apenas em telas maiores (não mobile)
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId && window.innerWidth >= 640) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Buscar mensagens na conversa
  const handleMessageSearch = (query: string) => {
    setMessageSearchQuery(query);
    if (!query.trim() || !selectedChat?.messages) {
      setMessageSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    const results = selectedChat.messages
      .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
      .map(m => m.id);
    
    setMessageSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    
    // Scroll para primeira mensagem encontrada
    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  };

  // Scroll para mensagem específica
  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight temporário
      element.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2');
      }, 2000);
    }
  };

  // Navegar entre resultados da busca
  const navigateSearchResults = (direction: 'prev' | 'next') => {
    if (messageSearchResults.length === 0) return;
    
    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % messageSearchResults.length;
    } else {
      newIndex = currentSearchIndex === 0 ? messageSearchResults.length - 1 : currentSearchIndex - 1;
    }
    
    setCurrentSearchIndex(newIndex);
    scrollToMessage(messageSearchResults[newIndex]);
  };

  // Limpar busca ao trocar de chat
  useEffect(() => {
    setShowMessageSearch(false);
    setMessageSearchQuery('');
    setMessageSearchResults([]);
    setCurrentSearchIndex(0);
  }, [selectedChatId]);

  // Ref para manter o chatId anterior (para desbloquear corretamente)
  const previousChatIdRef = useRef<string | null>(null);

  // Bloquear chat quando selecionado, desbloquear o anterior
  useEffect(() => {
    // Desbloquear chat anterior se existir
    if (previousChatIdRef.current && previousChatIdRef.current !== selectedChatId) {
      unlockChat(previousChatIdRef.current);
    }
    
    // Bloquear novo chat
    if (selectedChatId) {
      lockChat(selectedChatId);
      fetchChatAssignment(selectedChatId);
      
      // Buscar foto de perfil do WhatsApp se não tiver
      const chat = chats.find(c => c.id === selectedChatId);
      if (chat && !chat.avatar_url && chat.phone_number) {
        fetchAndUpdateAvatar(selectedChatId, chat.phone_number);
      }
    }
    
    // Atualizar ref com o chatId atual
    previousChatIdRef.current = selectedChatId;
    
    // Cleanup: desbloquear ao desmontar componente
    return () => {
      if (previousChatIdRef.current) {
        unlockChat(previousChatIdRef.current);
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

  // Buscar reações das mensagens
  const fetchReactions = async (messageIds: string[]) => {
    // Filtrar IDs temporários (mensagens otimistas)
    const validIds = messageIds.filter(id => !id.startsWith('temp_'));
    if (!validIds.length) return;
    
    const { data } = await (supabase as any)
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', validIds);
    
    if (data) {
      const reactionsMap: Record<string, Array<{ emoji: string; user_id: string }>> = {};
      data.forEach((r: any) => {
        if (!reactionsMap[r.message_id]) {
          reactionsMap[r.message_id] = [];
        }
        reactionsMap[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
      });
      setMessageReactions(reactionsMap);
    }
  };

  // Buscar reações quando mudar de chat
  useEffect(() => {
    if (selectedChat?.messages?.length) {
      const messageIds = selectedChat.messages.map(m => m.id);
      fetchReactions(messageIds);
    }
  }, [selectedChat?.messages]);

  // Adicionar/remover reação
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user || !selectedChat) return;
    
    const existingReactions = messageReactions[messageId] || [];
    const userReaction = existingReactions.find(r => r.user_id === user.id && r.emoji === emoji);
    const isRemoving = !!userReaction;
    
    if (isRemoving) {
      // Remover reação do banco
      await (supabase as any)
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      // Adicionar reação ao banco
      await (supabase as any)
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji,
        });
    }
    
    // Enviar reação para o WhatsApp
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      // Buscar configuração de provider da clínica
      const { data: clinicConfig } = await supabase
        .from('clinics')
        .select('whatsapp_provider, cloud_api_phone_number_id')
        .eq('id', clinicId)
        .single();
      
      const isCloudApi = (clinicConfig as any)?.whatsapp_provider === 'cloud_api' && (clinicConfig as any)?.cloud_api_phone_number_id;
      
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1);
      
      const instance = instances?.[0];
      
      // Buscar remote_message_id da mensagem
      const { data: msgData } = await (supabase as any)
        .from('messages')
        .select('remote_message_id, is_from_client')
        .eq('id', messageId)
        .single();
      
      // Enviar via Cloud API se configurado
      if (isCloudApi && msgData?.remote_message_id && selectedChat.phone_number) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: 'send_reaction',
            phone: selectedChat.phone_number,
            message_id: msgData.remote_message_id,
            emoji: isRemoving ? '' : emoji,
          }),
        });
      }
      // Enviar via Evolution API se conectado
      else if (instance?.status === 'connected' && settings?.evolution_api_url && msgData?.remote_message_id && selectedChat.phone_number) {
        // Verificar se é grupo ou conversa individual
        const isGroupChat = (selectedChat as any).is_group === true;
        const groupId = (selectedChat as any).group_id;

        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!isGroupChat && !formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }

        const remoteJid = isGroupChat ? groupId : `${formattedPhone}@s.whatsapp.net`;
        
        await fetch(`${settings.evolution_api_url}/message/sendReaction/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
          body: JSON.stringify({
            key: {
              remoteJid: remoteJid,
              fromMe: !msgData.is_from_client,
              id: msgData.remote_message_id,
            },
            reaction: isRemoving ? '' : emoji,
          }),
        });
      }
    } catch (err) {
      console.error('Error sending reaction to WhatsApp:', err);
    }
    
    // Atualizar reações localmente
    if (selectedChat?.messages) {
      const messageIds = selectedChat.messages.map(m => m.id);
      await fetchReactions(messageIds);
    }
    
    setShowReactionPicker(null);
  };

  // Função para salvar edição de mensagem
  const handleSaveEdit = async () => {
    if (!editingMessage || !editingContent.trim() || !selectedChat || savingEdit) return;
    
    setSavingEdit(true);
    try {
      const result = await editMessage(
        editingMessage.id, 
        selectedChat.id, 
        editingContent.trim(), 
        selectedChat.phone_number || ''
      );
      
      if (result.success) {
        setEditingMessage(null);
        setEditingContent('');
      } else {
        alert(result.error || 'Erro ao editar mensagem');
      }
    } catch (err) {
      console.error('Error saving edit:', err);
      alert('Erro ao editar mensagem');
    } finally {
      setSavingEdit(false);
    }
  };

  // Função para verificar se mensagem pode ser editada (até 15 min)
  const canEditMessage = (message: any) => {
    if (message.is_from_client) return false;
    if (message.type !== 'text') return false;
    
    const messageTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    return (now - messageTime) <= fifteenMinutes;
  };

  // Sincronizar grupos do WhatsApp
  const syncWhatsAppGroups = async () => {
    if (!clinicId) return;
    
    setSyncingGroups(true);
    try {
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
        alert('Configurações da Evolution API não encontradas');
        return;
      }
      
      // Buscar instância WhatsApp conectada
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1);
      
      const instance = instances?.[0];
      if (!instance) {
        alert('Nenhuma instância WhatsApp conectada');
        return;
      }
      
      // Buscar grupos da Evolution API
      const response = await fetch(
        `${settings.evolution_api_url}/group/fetchAllGroups/${instance.instance_name}?getParticipants=false`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Erro ao buscar grupos:', errorData);
        alert('Erro ao buscar grupos do WhatsApp');
        return;
      }
      
      const groups = await response.json();
      console.log('Grupos encontrados:', groups);
      
      if (!Array.isArray(groups) || groups.length === 0) {
        alert('Nenhum grupo encontrado');
        return;
      }
      
      // Cadastrar cada grupo no banco
      let cadastrados = 0;
      for (const group of groups) {
        const groupId = group.id; // formato: 123456789-1234567890@g.us
        const groupName = group.subject || group.name || 'Grupo sem nome';
        const groupPhone = groupId.replace('@g.us', '');
        
        // Verificar se já existe
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('group_id', groupId)
          .single();
        
        if (!existingChat) {
          // Criar chat para o grupo
          await (supabase as any)
            .from('chats')
            .insert({
              clinic_id: clinicId,
              client_name: groupName,
              phone_number: groupPhone,
              group_id: groupId,
              is_group: true,
              status: 'Em Atendimento',
              unread_count: 0,
              last_message: 'Grupo sincronizado',
              last_message_time: new Date().toISOString(),
              instance_id: instance.id,
            });
          cadastrados++;
        }
      }
      
      // Recarregar lista de chats
      await refetch();
      
      alert(`Sincronização concluída! ${cadastrados} grupo(s) adicionado(s).`);
    } catch (err) {
      console.error('Erro ao sincronizar grupos:', err);
      alert('Erro ao sincronizar grupos');
    } finally {
      setSyncingGroups(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !selectedChatId || !user || !selectedChat) return;
    
    // Capturar valores antes de limpar o input
    const messageContent = msgInput.trim();
    const currentReplyingTo = replyingTo;
    const currentChatId = selectedChatId;
    
    // ATUALIZAÇÃO OTIMISTA: Mostrar mensagem imediatamente na UI
    const tempId = addOptimisticMessage(
      currentChatId, 
      messageContent, 
      user.id, 
      currentReplyingTo ? { id: currentReplyingTo.id, content: currentReplyingTo.content, senderName: currentReplyingTo.senderName } : null
    );
    
    // Limpar input imediatamente (UX instantânea)
    setMsgInput('');
    setReplyingTo(null);
    
    // Enviar em background
    try {
      // Buscar nome do usuário para prefixar a mensagem
      let userName = '';
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        userName = (userData as any).name || '';
      }
      
      // Mensagem com nome do atendente para o WhatsApp
      const whatsappMessage = userName ? `*${userName}:* ${messageContent}` : messageContent;
      
      // Detectar canal do chat
      const chatChannel = (selectedChat as any).channel || 'whatsapp';
      
      let remoteMessageId = null;
      
      // Enviar via Meta API (Instagram ou Facebook)
      if (chatChannel === 'instagram' || chatChannel === 'facebook') {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/meta-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            recipient_id: selectedChat.phone_number,
            message: userName ? `${userName}: ${messageContent}` : messageContent,
            channel: chatChannel,
          }),
        });
        
        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          remoteMessageId = responseData?.message_id || null;
          console.log(`${chatChannel} message sent, messageId:`, remoteMessageId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`${chatChannel} API error:`, errorData);
          // Remover mensagem otimista se falhou
          updateOptimisticMessage(currentChatId, tempId, null);
          return;
        }
        
        // Salvar mensagem no banco
        const savedMessage = await sendMessage(
          currentChatId,
          messageContent,
          user.id,
          currentReplyingTo ? { id: currentReplyingTo.id, content: currentReplyingTo.content, senderName: currentReplyingTo.senderName } : null,
          remoteMessageId
        );
        
        // Atualizar mensagem otimista com ID real
        if (savedMessage) {
          updateOptimisticMessage(currentChatId, tempId, savedMessage.id);
        }
        
        return;
      }
      
      // Buscar configurações em paralelo para melhor performance (WhatsApp)
      const [settingsResult, clinicConfigResult, instancesResult] = await Promise.all([
        supabase.from('settings').select('evolution_api_url, evolution_api_key').single(),
        supabase.from('clinics').select('whatsapp_provider, cloud_api_phone_number_id, cloud_api_access_token').eq('id', clinicId).single(),
        supabase.from('whatsapp_instances').select('id, instance_name, status').eq('clinic_id', clinicId).eq('status', 'connected').limit(1),
      ]);
      
      const settings = settingsResult.data;
      const clinicConfig = clinicConfigResult.data;
      const instances = instancesResult.data;
      
      const isCloudApi = clinicConfig?.whatsapp_provider === 'cloud_api' && clinicConfig?.cloud_api_phone_number_id;
      const instance = instances?.[0];
      
      // Enviar via Cloud API se configurado
      if (isCloudApi && selectedChat.phone_number) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: 'send_text',
            phone: selectedChat.phone_number,
            message: whatsappMessage,
          }),
        });
        
        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          remoteMessageId = responseData?.message_id || null;
          console.log('Cloud API message sent, messageId:', remoteMessageId);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Cloud API error:', errorData);
        }
      }
      // Salvar mensagem no banco PRIMEIRO (aparece instantaneamente no painel)
      const { data: newMsg, error: insertError } = await supabase.from('messages').insert({
        chat_id: currentChatId,
        content: messageContent,
        type: 'text',
        is_from_client: false,
        sent_by: user.id,
        quoted_message_id: currentReplyingTo?.id || null,
        quoted_content: currentReplyingTo?.content || null,
        quoted_sender_name: currentReplyingTo?.senderName || null,
      }).select().single();
      
      if (insertError) {
        console.error('Error inserting message:', insertError);
        updateOptimisticMessage(currentChatId, tempId, null);
        alert('Erro ao salvar mensagem');
        return;
      }
      
      // Atualizar mensagem otimista com dados reais do banco
      if (newMsg) {
        updateOptimisticMessage(currentChatId, tempId, newMsg as any);
      }
      
      // Atualizar chat no banco
      supabase.from('chats').update({
        last_message: messageContent,
        last_message_time: new Date().toISOString(),
        last_message_from_client: false,
      }).eq('id', currentChatId);

      // Enviar via Evolution API - adicionar na fila de envio
      if (instance?.status === 'connected' && settings?.evolution_api_url && selectedChat.phone_number) {
        const isGroupChat = (selectedChat as any).is_group === true;
        const groupId = (selectedChat as any).group_id;
        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!isGroupChat && !formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }

        // Buscar remote_message_id da mensagem original (se for resposta)
        let quotedMessageId: string | null = null;
        let quotedContent: string | null = null;
        if (currentReplyingTo) {
          const { data: originalMsg } = await (supabase as any)
            .from('messages')
            .select('remote_message_id')
            .eq('id', currentReplyingTo.id)
            .single();
          if (originalMsg?.remote_message_id) {
            quotedMessageId = originalMsg.remote_message_id;
            quotedContent = currentReplyingTo.content;
          }
        }

        // Adicionar na fila de envio (será processada pela Edge Function)
        const { error: queueError } = await (supabase as any).from('message_queue').insert({
          clinic_id: clinicId,
          instance_id: instance.id,
          chat_id: currentChatId,
          message_id: newMsg?.id,
          content: whatsappMessage,
          phone_number: formattedPhone,
          is_group: isGroupChat,
          group_id: isGroupChat ? groupId : null,
          quoted_message_id: quotedMessageId,
          quoted_content: quotedContent,
          sent_by: user.id,
          scheduled_at: new Date().toISOString(),
        });

        if (queueError) {
          console.error('Error adding to queue:', queueError);
        } else {
          console.log('[Queue] Message added to queue for sending (cron will process)');
        }
      }
      // Enviar via Cloud API se configurado (mantém envio direto)
      else if (isCloudApi && selectedChat.phone_number) {
        // Cloud API não precisa de fila - já é gerenciada pela Meta
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: 'send_text',
            phone: selectedChat.phone_number,
            message: whatsappMessage,
          }),
        }).then(async (response) => {
          if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            const remoteId = responseData?.message_id || null;
            if (remoteId && newMsg) {
              await supabase.from('messages').update({ remote_message_id: remoteId }).eq('id', newMsg.id);
            }
          }
        }).catch(console.error);
      }
      
    } catch (err) {
      console.error('Error sending message:', err);
      // Remover mensagem otimista em caso de erro
      updateOptimisticMessage(currentChatId, tempId, null);
      alert('Erro ao enviar mensagem');
    }
  };

  // Enviar mídia (imagem/vídeo)
  const handleSendMedia = async (file: File) => {
    if (!selectedChatId || !user || !selectedChat) return;
    
    setSendingMedia(true);
    try {
      // Buscar nome do usuário para prefixar a legenda
      let userName = '';
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        userName = (userData as any).name || '';
      }
      
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
      
      // Legenda com nome do atendente
      const mediaCaption = userName ? `*${userName}*` : '';
      
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      // Buscar configuração de provider da clínica
      const { data: clinicConfig } = await supabase
        .from('clinics')
        .select('whatsapp_provider, cloud_api_phone_number_id')
        .eq('id', clinicId)
        .single();
      
      const isCloudApi = (clinicConfig as any)?.whatsapp_provider === 'cloud_api' && (clinicConfig as any)?.cloud_api_phone_number_id;
      
      // Buscar instância WhatsApp conectada (para Evolution API)
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1);
      
      const instance = instances?.[0];
      
      // Enviar via Cloud API se configurado
      if (isCloudApi && selectedChat.phone_number) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const actionMap: Record<string, string> = {
          'image': 'send_image',
          'video': 'send_video',
          'audio': 'send_audio',
          'document': 'send_document',
        };
        
        await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: actionMap[mediaType] || 'send_document',
            phone: selectedChat.phone_number,
            media_url: mediaUrl,
            caption: mediaCaption,
          }),
        });
      }
      // Enviar via Evolution API se conectado
      else if (instance?.status === 'connected' && settings?.evolution_api_url && selectedChat.phone_number) {
        // Verificar rate limit antes de enviar
        const rateLimitCheck = checkRateLimit(instance.instance_name);
        if (!rateLimitCheck.allowed) {
          setRateLimitModal({
            show: true,
            message: rateLimitCheck.reason || 'Aguarde alguns segundos antes de enviar outra mensagem.',
            waitSeconds: Math.ceil(rateLimitCheck.waitMs / 1000)
          });
          return;
        }

        // Aguardar delay mínimo entre mensagens
        await waitForRateLimit(instance.instance_name);

        // Verificar se é grupo ou conversa individual
        const isGroupChat = (selectedChat as any).is_group === true;
        const groupId = (selectedChat as any).group_id;

        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!isGroupChat && !formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        const endpoint = mediaType === 'image' ? 'sendMedia' : 
                         mediaType === 'video' ? 'sendMedia' : 
                         mediaType === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
        
        const mediaResponse = await fetch(`${settings.evolution_api_url}/message/${endpoint}/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
          body: JSON.stringify({
            number: isGroupChat ? groupId : formattedPhone,
            mediatype: mediaType,
            media: mediaUrl,
            caption: mediaCaption,
          }),
        });
        
        // Registrar envio no rate limiter
        recordMessageSent(instance.instance_name);
        
        // Marcar mensagens recebidas como lidas no WhatsApp (zera contador no celular)
        if (mediaResponse.ok) {
          try {
            const { data: unreadMessages } = await supabase
              .from('messages')
              .select('remote_message_id')
              .eq('chat_id', selectedChatId)
              .eq('is_from_client', true)
              .not('remote_message_id', 'is', null);
            
            if (unreadMessages && unreadMessages.length > 0) {
              const remoteJid = isGroupChat ? groupId : `${formattedPhone}@s.whatsapp.net`;
              const readMessages = unreadMessages
                .filter((m: any) => m.remote_message_id)
                .map((m: any) => ({
                  remoteJid,
                  id: m.remote_message_id,
                }));
              
              if (readMessages.length > 0) {
                // Marcar mensagens recebidas como lidas
                const payload = {
                  readMessages: readMessages.map((m: any) => ({
                    remoteJid: m.remoteJid,
                    fromMe: false,
                    id: m.id,
                  })),
                };
                
                await fetch(`${settings.evolution_api_url}/chat/markMessageAsRead/${instance.instance_name}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': settings.evolution_api_key,
                  },
                  body: JSON.stringify(payload),
                });
                console.log('[Evolution] Marked messages as read (media):', readMessages.length);
              }
            }
          } catch (readErr) {
            console.error('[Evolution] Error marking messages as read:', readErr);
          }
        }
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
        last_message_from_client: false,
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

  // Iniciar gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer para mostrar tempo de gravação
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  // Cancelar gravação
  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
    setMediaRecorder(null);
    audioChunksRef.current = [];
  };

  // Parar e enviar áudio
  const stopAndSendRecording = async () => {
    if (!mediaRecorder || !selectedChatId || !user || !selectedChat) return;
    
    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.ogg`, { type: 'audio/ogg' });
        
        setIsRecording(false);
        setRecordingTime(0);
        setMediaRecorder(null);
        
        // Enviar o áudio
        await handleSendAudio(audioFile);
        resolve();
      };
      
      mediaRecorder.stop();
    });
  };

  // Enviar áudio gravado
  const handleSendAudio = async (audioFile: File) => {
    if (!selectedChatId || !user || !selectedChat) return;
    
    setSendingMedia(true);
    try {
      // Upload para Supabase Storage
      const fileName = `${selectedChatId}/${Date.now()}_${audioFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, audioFile, { contentType: 'audio/ogg' });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Erro ao fazer upload do áudio');
        return;
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      const mediaUrl = urlData?.publicUrl;
      
      if (!mediaUrl) {
        alert('Erro ao obter URL do áudio');
        return;
      }
      
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      // Buscar configuração de provider da clínica
      const { data: clinicConfig } = await supabase
        .from('clinics')
        .select('whatsapp_provider, cloud_api_phone_number_id')
        .eq('id', clinicId)
        .single();
      
      const isCloudApi = (clinicConfig as any)?.whatsapp_provider === 'cloud_api' && (clinicConfig as any)?.cloud_api_phone_number_id;
      
      // Buscar instância WhatsApp conectada (para Evolution API)
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .limit(1);
      
      const instance = instances?.[0];
      
      // Enviar via Cloud API se configurado
      if (isCloudApi && selectedChat.phone_number) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            action: 'send_audio',
            phone: selectedChat.phone_number,
            media_url: mediaUrl,
          }),
        });
      }
      // Enviar via Evolution API se conectado
      else if (instance?.status === 'connected' && settings?.evolution_api_url && selectedChat.phone_number) {
        // Verificar rate limit antes de enviar
        const rateLimitCheck = checkRateLimit(instance.instance_name);
        if (!rateLimitCheck.allowed) {
          setRateLimitModal({
            show: true,
            message: rateLimitCheck.reason || 'Aguarde alguns segundos antes de enviar outra mensagem.',
            waitSeconds: Math.ceil(rateLimitCheck.waitMs / 1000)
          });
          return;
        }

        // Aguardar delay mínimo entre mensagens
        await waitForRateLimit(instance.instance_name);

        // Verificar se é grupo ou conversa individual
        const isGroupChat = (selectedChat as any).is_group === true;
        const groupId = (selectedChat as any).group_id;

        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!isGroupChat && !formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        const audioResponse = await fetch(`${settings.evolution_api_url}/message/sendWhatsAppAudio/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
          body: JSON.stringify({
            number: isGroupChat ? groupId : formattedPhone,
            audio: mediaUrl,
          }),
        });
        
        // Registrar envio no rate limiter
        recordMessageSent(instance.instance_name);
        
        // Marcar mensagens recebidas como lidas no WhatsApp (zera contador no celular)
        if (audioResponse.ok) {
          try {
            const { data: unreadMessages } = await supabase
              .from('messages')
              .select('remote_message_id')
              .eq('chat_id', selectedChatId)
              .eq('is_from_client', true)
              .not('remote_message_id', 'is', null);
            
            if (unreadMessages && unreadMessages.length > 0) {
              const remoteJid = isGroupChat ? groupId : `${formattedPhone}@s.whatsapp.net`;
              const readMessages = unreadMessages
                .filter((m: any) => m.remote_message_id)
                .map((m: any) => ({
                  remoteJid,
                  id: m.remote_message_id,
                }));
              
              if (readMessages.length > 0) {
                // Marcar mensagens recebidas como lidas
                const payload = {
                  readMessages: readMessages.map((m: any) => ({
                    remoteJid: m.remoteJid,
                    fromMe: false,
                    id: m.id,
                  })),
                };
                
                await fetch(`${settings.evolution_api_url}/chat/markMessageAsRead/${instance.instance_name}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': settings.evolution_api_key,
                  },
                  body: JSON.stringify(payload),
                });
                console.log('[Evolution] Marked messages as read (audio):', readMessages.length);
              }
            }
          } catch (readErr) {
            console.error('[Evolution] Error marking messages as read:', readErr);
          }
        }
      }
      
      // Salvar mensagem no banco
      await supabase.from('messages').insert({
        chat_id: selectedChatId,
        content: '[Áudio]',
        type: 'audio',
        media_url: mediaUrl,
        is_from_client: false,
        sent_by: user.id,
      });
      
      // Atualizar chat
      await supabase.from('chats').update({
        last_message: '[Áudio]',
        last_message_time: new Date().toISOString(),
        last_message_from_client: false,
      }).eq('id', selectedChatId);
      
      // Recarregar chats
      await refetch();
      
    } catch (err) {
      console.error('Error sending audio:', err);
      alert('Erro ao enviar áudio');
    } finally {
      setSendingMedia(false);
    }
  };

  // Formatar tempo de gravação (mm:ss)
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Col 1: Chat List - Em mobile, ocupa tela cheia quando não há chat selecionado */}
      <aside className={`${selectedChat ? 'hidden sm:flex' : 'flex'} w-full sm:w-[240px] md:w-[280px] lg:w-[320px] xl:w-[380px] flex-col bg-white border-r border-slate-200 h-full overflow-hidden shrink-0`}>
        {/* Channel Selector + Status */}
        <div className="flex items-center justify-between gap-2 p-1.5 sm:p-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            {/* Botão Menu Mobile - abre sidebar do Layout */}
            <button
              onClick={() => {
                // Dispara evento customizado para abrir menu mobile no Layout
                window.dispatchEvent(new CustomEvent('openMobileMenu'));
              }}
              className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors sm:hidden"
              title="Menu"
            >
              <span className="material-symbols-outlined text-slate-600 text-[18px]">menu</span>
            </button>
            {/* WhatsApp */}
            <button
              onClick={() => setActiveChannel('whatsapp')}
              className={`p-1.5 rounded-full transition-all ${
                activeChannel === 'whatsapp' 
                  ? 'bg-[#25D366] shadow-md shadow-[#25D366]/30' 
                  : 'bg-slate-100 hover:bg-[#25D366]/10'
              }`}
              title="WhatsApp"
            >
              <svg className={`w-4 h-4 ${activeChannel === 'whatsapp' ? 'text-white' : 'text-[#25D366]'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>

          {/* Instagram - sempre visível, desabilitado se não configurado */}
          <button
            onClick={() => channelConfig.instagram_enabled && setActiveChannel('instagram')}
            disabled={!channelConfig.instagram_enabled}
            className={`p-1.5 rounded-full transition-all ${
              !channelConfig.instagram_enabled
                ? 'bg-slate-100 cursor-not-allowed opacity-50'
                : activeChannel === 'instagram' 
                  ? 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] shadow-md shadow-pink-500/30' 
                  : 'bg-slate-100 hover:bg-pink-50'
            }`}
            title={channelConfig.instagram_enabled ? 'Instagram' : 'Instagram (não habilitado)'}
          >
            <svg className={`w-4 h-4 ${
              !channelConfig.instagram_enabled 
                ? 'text-slate-400' 
                : activeChannel === 'instagram' 
                  ? 'text-white' 
                  : 'text-pink-500'
            }`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </button>

          {/* Facebook - sempre visível, desabilitado se não configurado */}
          <button
            onClick={() => channelConfig.facebook_enabled && setActiveChannel('facebook')}
            disabled={!channelConfig.facebook_enabled}
            className={`p-1.5 rounded-full transition-all ${
              !channelConfig.facebook_enabled
                ? 'bg-slate-100 cursor-not-allowed opacity-50'
                : activeChannel === 'facebook' 
                  ? 'bg-[#1877F2] shadow-md shadow-[#1877F2]/30' 
                  : 'bg-slate-100 hover:bg-blue-50'
            }`}
            title={channelConfig.facebook_enabled ? 'Facebook Messenger' : 'Facebook (não habilitado)'}
          >
            <svg className={`w-4 h-4 ${
              !channelConfig.facebook_enabled 
                ? 'text-slate-400' 
                : activeChannel === 'facebook' 
                  ? 'text-white' 
                  : 'text-[#1877F2]'
            }`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.627 0-12 4.975-12 11.111 0 3.497 1.745 6.616 4.472 8.652v4.237l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111 0-6.136-5.373-11.111-12-11.111zm1.193 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.889-3.259-6.559 6.963z"/>
            </svg>
          </button>
          </div>

          {/* Status/Error Banner */}
          {connectionError || isReconnecting ? (
            <button
              onClick={async () => {
                if (isReconnecting) return; // Evitar cliques durante reconexão
                const result = await ensureInstanceConnected();
                if (result.connected) {
                  refetch();
                } else if (result.needsQrCode) {
                  setConnectionModal({
                    show: true,
                    title: 'WhatsApp Desconectado',
                    message: result.error || 'Não foi possível reconectar. Escaneie o QR Code em Configurações > WhatsApp.',
                    needsQrCode: true
                  });
                }
              }}
              disabled={isReconnecting}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                isReconnecting 
                  ? 'bg-blue-50 border border-blue-200 cursor-wait' 
                  : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
              }`}
              title={isReconnecting ? 'Reconectando...' : 'Clique para reconectar'}
            >
              {isReconnecting ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-blue-600 animate-spin">sync</span>
                  <span className="text-[10px] font-medium text-blue-700">Reconectando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px] text-amber-600">warning</span>
                  <span className="text-[10px] font-medium text-amber-700">Reconectar</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-lg">
              <span className="size-1.5 rounded-full bg-green-500"></span>
              <span className="text-[10px] font-semibold text-green-700 uppercase">Conectado</span>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar conversa..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-cyan-600"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: 'todos' as FilterType, label: 'Todos', count: chats.filter(c => !(c as any).is_group).length, tooltip: 'Todas as conversas individuais' },
              { key: 'nao_lidos' as FilterType, label: 'Não lidos', count: chats.filter(c => !(c as any).is_group && (c.unread_count || 0) > 0).length, tooltip: 'Conversas com mensagens não lidas' },
              { key: 'aguardando' as FilterType, label: 'Aguardando', count: chats.filter(c => !(c as any).is_group && (c as any).last_message_from_client === true && (c.unread_count || 0) === 0).length, tooltip: 'Conversas lidas mas não respondidas - cliente aguardando sua resposta' },
              { key: 'grupos' as FilterType, label: 'Grupos', count: chats.filter(c => (c as any).is_group).length, tooltip: 'Grupos do WhatsApp' },
            ].map((f) => (
              <button 
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                title={f.tooltip}
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
            <div className="divide-y divide-slate-50">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start gap-3 p-4 animate-pulse">
                  <div className="size-12 rounded-full bg-slate-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
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
                onClick={async () => {
                  console.log('[Inbox] Chat clicked:', chat.id, 'messages:', chat.messages?.length || 0);
                  setSelectedChatId(chat.id);
                  markAsRead(chat.id);
                  // Carregar mensagens sob demanda se ainda não carregadas
                  if (!chat.messages || chat.messages.length === 0) {
                    console.log('[Inbox] Loading messages for chat:', chat.id);
                    setLoadingMessages(true);
                    const { hasMore } = await fetchMessages(chat.id);
                    setHasMoreMessages(prev => ({ ...prev, [chat.id]: hasMore }));
                    setLoadingMessages(false);
                    console.log('[Inbox] Messages loaded, hasMore:', hasMore);
                  }
                }}
                className={`group flex items-start gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer transition-colors relative border-l-4 ${
                  selectedChatId === chat.id ? 'bg-cyan-50/50 border-cyan-600' : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <img 
                    src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} 
                    className="size-10 sm:size-12 rounded-full border border-slate-100"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`;
                    }}
                  />
                  <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {(chat as any).is_group && (
                        <span className="material-symbols-outlined text-emerald-600 text-sm shrink-0">groups</span>
                      )}
                      {(chat as any).is_pinned && (
                        <span className="material-symbols-outlined text-cyan-600 text-sm shrink-0">push_pin</span>
                      )}
                      <h3 className="text-sm font-bold text-slate-900 truncate">{chat.client_name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinChat(chat.id);
                        }}
                        className={`p-1 rounded hover:bg-slate-200 transition-colors ${(chat as any).is_pinned ? 'opacity-100' : 'hidden sm:block sm:opacity-0 sm:group-hover:opacity-100'}`}
                        title={(chat as any).is_pinned ? 'Desafixar' : 'Fixar'}
                      >
                        <span className={`material-symbols-outlined text-sm ${(chat as any).is_pinned ? 'text-cyan-600' : 'text-slate-400'}`}>
                          push_pin
                        </span>
                      </button>
                      <span className="text-[10px] font-bold text-slate-400">{formatTime(chat.last_message_time)}</span>
                    </div>
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

      {/* Col 2: Active Chat Area - Em mobile, ocupa tela cheia quando há chat selecionado */}
      <section className={`${selectedChat ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0 bg-[#e5ddd5]/30 relative`}>
        {selectedChat ? (
          <>
            <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-2 sm:px-3 md:px-6 shrink-0 z-10">
              <div className="flex items-center gap-1 sm:gap-2 md:gap-3 min-w-0 flex-1">
                {/* Botão voltar - apenas mobile */}
                <button 
                  onClick={() => setSelectedChatId(null)}
                  className="sm:hidden p-1.5 -ml-1 rounded-full text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                  title="Voltar para lista"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <img 
                  src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} 
                  className="size-9 md:size-10 rounded-full shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`;
                  }}
                />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 leading-tight truncate">{selectedChat.client_name}</h2>
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-green-500"></span> <span className="hidden sm:inline">Online agora</span><span className="sm:hidden">Online</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {/* Botão de busca de mensagens */}
                <button 
                  onClick={() => setShowMessageSearch(!showMessageSearch)}
                  className={`p-2 rounded-full transition-colors ${
                    showMessageSearch 
                      ? 'text-cyan-600 bg-cyan-50' 
                      : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
                  }`}
                  title="Buscar mensagens"
                >
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </button>
                <button 
                  onClick={openClientModal}
                  className={`p-2 rounded-full transition-colors ${
                    chatLeadId 
                      ? 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50' 
                      : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
                  }`}
                  title={chatLeadId ? 'Ver/Editar Cliente' : 'Cadastrar Cliente'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {chatLeadId ? 'person' : 'person_add'}
                  </span>
                </button>
                {(selectedChat?.unread_count || 0) > 0 ? (
                  <button 
                    onClick={() => selectedChatId && markAsRead(selectedChatId)}
                    className="hidden md:flex p-2 rounded-full transition-colors text-slate-400 hover:text-green-600 hover:bg-green-50"
                    title="Marcar como lida"
                  >
                    <span className="material-symbols-outlined text-[20px]">mark_chat_read</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if (selectedChatId) {
                        markAsUnread(selectedChatId);
                        setSelectedChatId(null);
                      }
                    }}
                    className="hidden md:flex p-2 rounded-full transition-colors text-green-600 hover:text-amber-600 hover:bg-amber-50"
                    title="Marcar como não lida"
                  >
                    <span className="material-symbols-outlined text-[20px]">mark_chat_unread</span>
                  </button>
                )}
                <button className="hidden lg:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
                {/* Botão para abrir painel do lead (visível apenas em tablets) */}
                <button 
                  onClick={() => setShowLeadPanelDrawer(true)}
                  className="xl:hidden p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-full transition-colors"
                  title="Ver detalhes do lead"
                >
                  <span className="material-symbols-outlined text-[20px]">info</span>
                </button>
              </div>
            </header>

            {/* Barra de busca de mensagens */}
            {showMessageSearch && (
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
                  <input
                    type="text"
                    value={messageSearchQuery}
                    onChange={(e) => handleMessageSearch(e.target.value)}
                    placeholder="Buscar mensagens na conversa..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                {messageSearchResults.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 mr-2">
                      {currentSearchIndex + 1} de {messageSearchResults.length}
                    </span>
                    <button
                      onClick={() => navigateSearchResults('prev')}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      title="Anterior"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                    </button>
                    <button
                      onClick={() => navigateSearchResults('next')}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      title="Próximo"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                    </button>
                  </div>
                )}
                {messageSearchQuery && messageSearchResults.length === 0 && (
                  <span className="text-xs text-slate-400">Nenhum resultado</span>
                )}
                <button
                  onClick={() => {
                    setShowMessageSearch(false);
                    setMessageSearchQuery('');
                    setMessageSearchResults([]);
                  }}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                  title="Fechar busca"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(#cbd5e1 0.5px, transparent 0.5px)', backgroundSize: '15px 15px' }}>
              {/* Botão carregar mais mensagens */}
              {hasMoreMessages[selectedChat.id] && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={async () => {
                      setLoadingMessages(true);
                      const { hasMore } = await loadMoreMessages(selectedChat.id).then(() => 
                        ({ hasMore: hasMoreMessages[selectedChat.id] })
                      );
                      // Atualizar hasMore após carregar
                      const chat = chats.find(c => c.id === selectedChat.id);
                      if (chat && chat.messages.length > 0) {
                        const oldestMsg = chat.messages[0];
                        const { data } = await supabase
                          .from('messages')
                          .select('id')
                          .eq('chat_id', selectedChat.id)
                          .lt('created_at', oldestMsg.created_at || '')
                          .limit(1);
                        setHasMoreMessages(prev => ({ ...prev, [selectedChat.id]: (data?.length || 0) > 0 }));
                      }
                      setLoadingMessages(false);
                    }}
                    disabled={loadingMessages}
                    className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-xs font-medium text-slate-600 shadow-sm border border-slate-200 hover:bg-white hover:shadow-md transition-all disabled:opacity-50"
                  >
                    {loadingMessages ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span> Carregando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">expand_less</span>
                        Carregar mensagens anteriores
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Loading inicial de mensagens */}
              {loadingMessages && (!selectedChat.messages || selectedChat.messages.length === 0) && (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="animate-spin">⏳</span>
                    <span className="text-sm">Carregando mensagens...</span>
                  </div>
                </div>
              )}

              {selectedChat.messages.map((m, index, arr) => {
                // Função para formatar label de data
                const getDateLabel = (dateStr: string) => {
                  const msgDate = new Date(dateStr);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  
                  const isSameDay = (d1: Date, d2: Date) => 
                    d1.getDate() === d2.getDate() && 
                    d1.getMonth() === d2.getMonth() && 
                    d1.getFullYear() === d2.getFullYear();
                  
                  if (isSameDay(msgDate, today)) return 'HOJE';
                  if (isSameDay(msgDate, yesterday)) return 'ONTEM';
                  return msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                };
                
                // Verificar se deve mostrar separador de data
                const currentDate = new Date(m.created_at).toDateString();
                const prevDate = index > 0 ? new Date(arr[index - 1].created_at).toDateString() : null;
                const showDateSeparator = index === 0 || currentDate !== prevDate;
                
                return (
                <React.Fragment key={m.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <span className="bg-white/80 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100 uppercase tracking-widest">
                        {getDateLabel(m.created_at)}
                      </span>
                    </div>
                  )}
                <div 
                  ref={(el) => { messageRefs.current[m.id] = el; }}
                  className={`flex ${!m.is_from_client ? 'justify-end' : 'justify-start'} w-full group transition-all duration-300`}
                >
                  <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm relative break-words overflow-hidden ${
                    !m.is_from_client 
                      ? 'bg-cyan-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  } ${messageSearchResults.includes(m.id) ? 'ring-2 ring-yellow-400' : ''}`}>
                    {/* Quote/Reply - mensagem sendo respondida */}
                    {(m as any).quoted_content && (
                      <div className={`mb-2 p-2 rounded-lg border-l-4 ${
                        !m.is_from_client 
                          ? 'bg-cyan-700/50 border-cyan-300' 
                          : 'bg-slate-100 border-slate-400'
                      }`}>
                        <p className={`text-[10px] font-bold ${!m.is_from_client ? 'text-cyan-200' : 'text-slate-500'}`}>
                          {(m as any).quoted_sender_name || 'Mensagem'}
                        </p>
                        <p className={`text-xs line-clamp-2 ${!m.is_from_client ? 'text-cyan-100' : 'text-slate-600'}`}>
                          {(m as any).quoted_content}
                        </p>
                      </div>
                    )}
                    {/* Nome do remetente em grupos (mensagens do cliente) */}
                    {(selectedChat as any).is_group && m.is_from_client && (m as any).sender_name && (
                      <p className="text-[10px] font-bold text-slate-500 mb-1">{(m as any).sender_name}</p>
                    )}
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
                        <span className="material-symbols-outlined shrink-0">description</span>
                        <span className="text-sm underline truncate">{m.content}</span>
                      </a>
                    )}
                    {/* Texto da mensagem (exceto para mídia sem legenda) */}
                    {(m.type === 'text' || (m.content && !m.content.startsWith('['))) && (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>
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
                    {/* Reações exibidas */}
                    {messageReactions[m.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(
                          messageReactions[m.id].reduce((acc: Record<string, number>, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <span 
                            key={emoji} 
                            className={`text-xs px-1.5 py-0.5 rounded-full cursor-pointer hover:scale-110 transition-transform ${
                              !m.is_from_client ? 'bg-cyan-500' : 'bg-slate-100'
                            }`}
                            onClick={() => toggleReaction(m.id, emoji)}
                          >
                            {emoji} {(count as number) > 1 && <span className="text-[10px]">{count as number}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${!m.is_from_client ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {formatTime(m.created_at)}
                      {!m.is_from_client && (
                        <span className={`material-symbols-outlined text-[12px] ${
                          (m as any).delivery_status === 'read' ? 'text-blue-400' : ''
                        }`}>
                          {(m as any).delivery_status === 'sent' ? 'check' : 'done_all'}
                        </span>
                      )}
                    </div>
                    {/* Botões de ação - aparecem no hover */}
                    {canSendMessage && (
                      <div className={`absolute ${m.is_from_client ? '-right-20' : '-left-28'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1 transition-all`}>
                        <button
                          onClick={() => setReplyingTo({
                            id: m.id,
                            content: m.content,
                            senderName: m.is_from_client ? selectedChat.client_name : (userNames[m.sent_by || ''] || 'Você'),
                            isFromClient: m.is_from_client,
                          })}
                          className="p-1.5 rounded-full bg-white shadow-md hover:bg-slate-100 transition-all"
                          title="Responder"
                        >
                          <span className="material-symbols-outlined text-[16px] text-slate-500">reply</span>
                        </button>
                        {/* Botão Editar - só para mensagens enviadas até 15 min */}
                        {canEditMessage(m) && (
                          <button
                            onClick={() => {
                              setEditingMessage({ id: m.id, content: m.content });
                              setEditingContent(m.content);
                            }}
                            className="p-1.5 rounded-full bg-white shadow-md hover:bg-slate-100 transition-all"
                            title="Editar (até 15 min)"
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-500">edit</span>
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                            className="p-1.5 rounded-full bg-white shadow-md hover:bg-slate-100 transition-all"
                            title="Reagir"
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-500">add_reaction</span>
                          </button>
                          {showReactionPicker === m.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(null)} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-full shadow-xl border border-slate-200 p-1 z-50 flex gap-1">
                                {reactionEmojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(m.id, emoji)}
                                    className="text-lg hover:scale-125 transition-transform p-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </React.Fragment>
                );
              })}
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
              
              {/* Preview da mensagem sendo respondida */}
              {replyingTo && (
                <div className="mb-2 p-3 bg-slate-100 rounded-xl border-l-4 border-cyan-500 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-cyan-600 mb-0.5">
                      Respondendo a {replyingTo.senderName}
                    </p>
                    <p className="text-sm text-slate-600 truncate">{replyingTo.content}</p>
                  </div>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors ml-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-3 focus-within:ring-2 focus-within:ring-cyan-600 focus-within:border-transparent transition-all">
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
                {chatLock && chatLock.locked_by !== user?.id ? (
                  <div className="flex-1 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-lg">lock</span>
                    <span className="text-sm font-medium">{chatLock.locked_by_name} está respondendo esta conversa</span>
                  </div>
                ) : !canSendMessage ? (
                  <div className="flex-1 flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    <span className="text-sm font-medium">Modo visualização - sem permissão para responder</span>
                  </div>
                ) : isRecording ? (
                  <div className="flex-1 flex items-center gap-3">
                    <button 
                      onClick={cancelRecording}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                      Cancelar
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-3 bg-red-50 rounded-xl py-2 px-4">
                      <span className="size-3 bg-red-500 rounded-full animate-pulse"></span>
                      <span className="text-red-600 font-bold text-lg">{formatRecordingTime(recordingTime)}</span>
                      <span className="text-red-500 text-sm">Gravando...</span>
                    </div>
                    <button 
                      onClick={stopAndSendRecording}
                      disabled={sendingMedia}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Enviar
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea 
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Mensagem..." 
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-0 resize-none max-h-40 min-h-[48px]"
                      rows={1}
                    />
                    <button 
                      onClick={startRecording}
                      disabled={sendingMedia}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                      title="Gravar áudio"
                    >
                      <span className="material-symbols-outlined">mic</span>
                    </button>
                    <button 
                      onClick={handleSendMessage}
                      disabled={sendingMedia || !msgInput.trim()}
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
              <img 
                src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} 
                className="size-24 rounded-full mx-auto mb-4 border-4 border-slate-50 shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`;
                }}
              />
              <h2 className="text-xl font-black text-slate-900 mb-1">{selectedChat.client_name}</h2>
              <p className="text-sm font-bold text-slate-400">{selectedChat.phone_number}</p>
              
              <div className="flex justify-center gap-4 mt-6">
                {smtpConfigured && leadEmail ? (
                  <button 
                    onClick={() => {
                      setSelectedEmailTemplateId('');
                      setShowEmailModal(true);
                    }}
                    className="size-10 rounded-full border border-purple-100 bg-purple-50 text-purple-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                    title={`Enviar email para ${leadEmail}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                  </button>
                ) : (
                  <button 
                    disabled
                    className="size-10 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center cursor-not-allowed shadow-sm"
                    title={!smtpConfigured ? "Configure SMTP em Integrações" : "Cliente sem email cadastrado"}
                  >
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                  </button>
                )}
                <button 
                  onClick={() => window.open(`tel:${selectedChat.phone_number}`, '_self')}
                  className="size-10 rounded-full border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                  title="Ligar"
                >
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </button>
                <button 
                  onClick={openClientModal}
                  className="size-10 rounded-full border border-cyan-100 bg-cyan-50 text-cyan-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                  title={chatLeadId ? 'Editar Cliente' : 'Cadastrar Cliente'}
                >
                  <span className="material-symbols-outlined text-[20px]">{chatLeadId ? 'edit' : 'person_add'}</span>
                </button>
                <button 
                  onClick={() => setShowSectionConfigModal(true)}
                  className="size-10 rounded-full border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center hover:scale-110 transition-transform shadow-sm hover:bg-slate-100"
                  title="Configurar seções visíveis"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-8">
              <section className="relative" style={{ order: getSectionOrder('pipeline') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapa do Pipeline</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Etapa atual do lead no funil de vendas. Muda conforme o atendimento avança (Novo Lead → Em Atendimento → Agendado → Convertido)
                      </div>
                    </div>
                  </div>
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
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                    {PIPELINE_STAGES.map(stage => (
                      <button
                        key={stage.value}
                        onClick={() => handleChangeStage(stage.value)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 group ${
                          selectedChat.status === stage.value ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }}></span>
                        <span className="flex-1">{stage.label}</span>
                        <span 
                          className="material-symbols-outlined text-slate-300 text-[16px] cursor-help group-hover:text-slate-400" 
                          title={stage.hint}
                        >
                          info
                        </span>
                        {selectedChat.status === stage.value && (
                          <span className="material-symbols-outlined text-cyan-600 text-[16px]">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Seção Responsável pelo Atendimento */}
              <section style={{ order: getSectionOrder('responsavel') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Atendente responsável por esta conversa. Pode assumir, encaminhar ou liberar o atendimento
                      </div>
                    </div>
                  </div>
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
                      {chatLock && chatAssignedTo.id === user?.id && (
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
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-[16px]">lock</span>
                      <p className="text-xs text-amber-700">
                        <strong>{chatLock.locked_by_name}</strong> está atendendo esta conversa
                      </p>
                    </div>
                    {(isAdmin || user?.role === 'Gerente') && (
                      <button
                        onClick={handleReleaseChat}
                        className="mt-2 w-full text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">lock_open</span>
                        Desbloquear Conversa
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Seção Origem do Lead */}
              <section className="relative" style={{ order: getSectionOrder('origem') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem do Lead</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        De onde este lead veio (Instagram, Facebook, Indicação, etc). Usado para medir performance de campanhas
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { fetchAvailableTags(); setShowAddSourceModal(true); }}
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
                    {selectedSourceId ? (() => {
                      const selectedSource = leadSources.find(s => s.id === selectedSourceId);
                      const sourceColor = selectedSource ? getSourceColor(selectedSource) : '#6B7280';
                      return (
                        <div className="flex items-center gap-2">
                          <span 
                            className="size-3 rounded-full" 
                            style={{ backgroundColor: sourceColor }}
                          ></span>
                          <span className="text-sm font-bold text-slate-700">
                            {selectedSource?.name}
                          </span>
                          {selectedSource?.code && (
                            <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                              {selectedSource.code}
                            </span>
                          )}
                        </div>
                      );
                    })() : (
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
                          <span className="size-3 rounded-full" style={{ backgroundColor: getSourceColor(source) }}></span>
                          {source.name}
                          {source.code && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                              {source.code}
                            </span>
                          )}
                          {source.tag_id && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({availableTags.find(t => t.id === source.tag_id)?.name})
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
                
                {/* Informações do Anúncio Meta (Click to WhatsApp) */}
                {adInfo && (adInfo.ad_title || adInfo.ad_source_id) && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-pink-600 text-[16px]">ads_click</span>
                      <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest">Anúncio Meta</span>
                    </div>
                    {adInfo.ad_title && (
                      <div className="mb-2">
                        <span className="text-[10px] text-slate-500 block">Nome do Anúncio</span>
                        <span className="text-sm font-semibold text-slate-700">{adInfo.ad_title}</span>
                      </div>
                    )}
                    {adInfo.ad_body && (
                      <div className="mb-2">
                        <span className="text-[10px] text-slate-500 block">Texto do Anúncio</span>
                        <span className="text-xs text-slate-600">{adInfo.ad_body}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {adInfo.ad_source_type && (
                        <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                          {adInfo.ad_source_type === 'AD' ? 'Anúncio Pago' : adInfo.ad_source_type}
                        </span>
                      )}
                      {adInfo.ad_source_id && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          ID: {adInfo.ad_source_id}
                        </span>
                      )}
                    </div>
                    {adInfo.ad_source_url && (
                      <a 
                        href={adInfo.ad_source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 text-[11px] text-pink-600 hover:text-pink-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Ver anúncio original
                      </a>
                    )}
                  </div>
                )}
              </section>

              {isSectionVisible('etiquetas') && (
              <section style={{ order: getSectionOrder('etiquetas') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiquetas</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Tags para categorizar e filtrar conversas (ex: VIP, Retorno, Procedimento X)
                      </div>
                    </div>
                  </div>
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
              )}

              {/* Modal de Edição de Mensagem */}
              {editingMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setEditingMessage(null); setEditingContent(''); }}>
                  <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Editar Mensagem</h3>
                      <button onClick={() => { setEditingMessage(null); setEditingContent(''); }} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Nova mensagem</label>
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent resize-none"
                          rows={4}
                          placeholder="Digite a nova mensagem..."
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        A mensagem será editada no WhatsApp do cliente.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingMessage(null); setEditingContent(''); }}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editingContent.trim() || editingContent === editingMessage.content || savingEdit}
                          className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
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
              {isSectionVisible('orcamentos') && (
              <section style={{ order: getSectionOrder('orcamentos') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamentos</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Propostas de serviços enviadas ao cliente com valores. Podem ser aprovados ou recusados
                      </div>
                    </div>
                  </div>
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
                          <div className="flex gap-1">
                            {quote.status === 'pending' && (
                              <>
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
                              </>
                            )}
                            {quote.status !== 'pending' && (
                              <button
                                onClick={() => handleUpdateQuoteStatus(quote.id, 'pending')}
                                className="p-1 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                                title="Voltar para Pendente"
                              >
                                <span className="material-symbols-outlined text-[16px]">undo</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteQuote(quote.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
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
              )}

              {/* Seção de Negociações Comerciais */}
              {isSectionVisible('negociacoes') && (
              <section style={{ order: getSectionOrder('negociacoes') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Negociações Comerciais</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Vendas registradas pelo comercial. Alimenta o Dashboard de Vendas Concluídas e Faturamento
                      </div>
                    </div>
                  </div>
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
                        className={`p-3 rounded-xl border ${
                          payment.status === 'cancelled' 
                            ? 'bg-red-50 border-red-200 opacity-60' 
                            : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black ${
                              payment.status === 'cancelled' ? 'text-red-600 line-through' : 'text-emerald-700'
                            }`}>
                              R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {payment.status === 'cancelled' && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                CANCELADO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {formatDateOnly(payment.payment_date)}
                            </span>
                            {payment.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelPayment(payment.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Cancelar"
                              >
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {payment.payment_method && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            payment.status === 'cancelled' ? 'bg-slate-100 text-slate-400' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {payment.payment_method === 'pix' ? 'PIX' :
                             payment.payment_method === 'dinheiro' ? 'Dinheiro' :
                             payment.payment_method === 'cartao_credito' ? 'Cartão Crédito' :
                             payment.payment_method === 'cartao_debito' ? 'Cartão Débito' :
                             payment.payment_method === 'boleto' ? 'Boleto' :
                             payment.payment_method === 'link' ? 'Link' :
                             payment.payment_method === 'transferencia' ? 'Transferência' :
                             'Outro'}
                          </span>
                        )}
                        {payment.description && (
                          <p className={`text-[11px] mt-1 ${payment.status === 'cancelled' ? 'text-slate-400' : 'text-slate-600'}`}>{payment.description}</p>
                        )}
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="pt-2 border-t border-slate-200 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Total Faturado:</span>
                        <span className="text-sm font-black text-emerald-600">
                          R$ {payments
                            .filter(p => p.status !== 'cancelled')
                            .reduce((sum, p) => sum + p.value, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Seção de Lançamentos da Clínica (sem comercial) */}
              {isSectionVisible('lancamentos') && (
              <section style={{ order: getSectionOrder('lancamentos') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lançamentos da Clínica</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Recebimentos diretos da clínica, sem vínculo com venda comercial
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowClinicReceiptModal(true)}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                
                {clinicReceipts.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum lançamento direto</p>
                ) : (
                  <div className="space-y-2">
                    {clinicReceipts.map(receipt => (
                      <div 
                        key={receipt.id} 
                        className="p-3 rounded-xl border bg-teal-50 border-teal-200"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-black text-teal-700">
                            R$ {receipt.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {formatDateOnly(receipt.receipt_date)}
                            </span>
                            <button
                              onClick={() => handleDeleteClinicReceipt(receipt.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>
                        {receipt.payment_method && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                            {receipt.payment_method === 'pix' ? 'PIX' :
                             receipt.payment_method === 'dinheiro' ? 'Dinheiro' :
                             receipt.payment_method === 'cartao_credito' ? 'Cartão Crédito' :
                             receipt.payment_method === 'cartao_debito' ? 'Cartão Débito' :
                             receipt.payment_method === 'boleto' ? 'Boleto' :
                             receipt.payment_method === 'transferencia' ? 'Transferência' :
                             'Outro'}
                          </span>
                        )}
                        {receipt.description && (
                          <p className="text-[11px] mt-1 text-slate-600">{receipt.description}</p>
                        )}
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="pt-2 border-t border-slate-200 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Total Lançado:</span>
                        <span className="text-sm font-black text-teal-600">
                          R$ {clinicReceipts
                            .reduce((sum, r) => sum + r.total_value, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Modal de Valor para Conversão */}
              {showConversionValueModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConversionValueModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600">paid</span>
                        <h3 className="font-bold text-slate-800">Valor da Conversão</h3>
                      </div>
                      <button onClick={() => setShowConversionValueModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-slate-600">
                        Informe o valor da venda para registrar a conversão:
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                        <input
                          type="text"
                          value={conversionValue}
                          onChange={(e) => setConversionValue(e.target.value)}
                          placeholder="0,00"
                          autoFocus
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-lg font-bold"
                        />
                      </div>
                      <button
                        onClick={handleConfirmConversion}
                        disabled={!conversionValue}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Confirmar Conversão
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Tarefas */}
              {isSectionVisible('tarefas') && (
              <section style={{ order: getSectionOrder('tarefas') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefas</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Lista de tarefas pendentes relacionadas a este cliente (ligar, enviar documento, etc)
                      </div>
                    </div>
                  </div>
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
                              {formatDateOnly(task.due_date)}
                              {!task.completed && new Date(task.due_date) < new Date() && ' (atrasada)'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}

              {/* Seção de Mensagens Agendadas */}
              {isSectionVisible('followup') && (
              <section style={{ order: getSectionOrder('followup') }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow-up</h3>
                    <div className="relative group/tip">
                      <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                      <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                        Mensagens programadas para envio automático em data/hora futura
                      </div>
                    </div>
                  </div>
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
              )}

              {isSectionVisible('observacoes') && (
              <section className="flex-1 flex flex-col" style={{ order: getSectionOrder('observacoes') }}>
                <div className="flex items-center gap-1 mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações</h3>
                  <div className="relative group/tip">
                    <span className="material-symbols-outlined text-[12px] text-slate-400 cursor-help hover:text-cyan-600">info</span>
                    <div className="absolute left-0 top-full mt-1 w-56 p-2 bg-cyan-600 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-[9999] shadow-lg leading-relaxed">
                      Notas internas sobre o cliente. Visíveis apenas para a equipe, não são enviadas ao cliente
                    </div>
                  </div>
                </div>
                
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
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-4xl text-slate-100 mb-4">info</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informações do Contato</p>
          </div>
        )}
      </aside>

      {/* Drawer do Painel do Lead (Tablet) */}
      {showLeadPanelDrawer && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-40 xl:hidden"
            onClick={() => setShowLeadPanelDrawer(false)}
          />
          <aside className="fixed right-0 top-0 h-full w-[340px] max-w-[90vw] bg-white border-l border-slate-200 z-50 xl:hidden overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Botão fechar */}
            <button 
              onClick={() => setShowLeadPanelDrawer(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors z-10"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            
            {selectedChat ? (
              <div className="flex flex-col h-full">
                <div className="p-6 text-center border-b border-slate-100">
                  <img 
                    src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} 
                    className="size-20 rounded-full mx-auto mb-3 border-4 border-slate-50 shadow-md"
                  />
                  <h2 className="text-lg font-black text-slate-900 mb-1">{selectedChat.client_name}</h2>
                  <p className="text-sm font-bold text-slate-400">{selectedChat.phone_number}</p>
                  
                  <div className="flex justify-center gap-3 mt-4">
                    {smtpConfigured && leadEmail ? (
                      <button 
                        onClick={() => { setSelectedEmailTemplateId(''); setShowEmailModal(true); }}
                        className="size-9 rounded-full border border-purple-100 bg-purple-50 text-purple-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                        title={`Enviar email para ${leadEmail}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </button>
                    ) : (
                      <button 
                        disabled
                        className="size-9 rounded-full border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center cursor-not-allowed shadow-sm"
                        title={!smtpConfigured ? "Configure SMTP" : "Sem email"}
                      >
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </button>
                    )}
                    <button 
                      onClick={() => window.open(`tel:${selectedChat.phone_number}`, '_self')}
                      className="size-9 rounded-full border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                      title="Ligar"
                    >
                      <span className="material-symbols-outlined text-[18px]">call</span>
                    </button>
                    <button 
                      onClick={() => { openClientModal(); }}
                      className="size-9 rounded-full border border-cyan-100 bg-cyan-50 text-cyan-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                      title={chatLeadId ? 'Editar Cliente' : 'Cadastrar Cliente'}
                    >
                      <span className="material-symbols-outlined text-[18px]">{chatLeadId ? 'edit' : 'person_add'}</span>
                    </button>
                    <button 
                      onClick={() => { setShowSectionConfigModal(true); }}
                      className="size-9 rounded-full border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                      title="Configurar seções"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">
                  {/* Etapa do Pipeline */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapa do Pipeline</h3>
                      {canMoveLead && (
                        <button 
                          onClick={() => { setShowStageDropdown(!showStageDropdown); }}
                          className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                        >
                          Alterar
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Etapa Atual</p>
                      <p className="text-sm font-bold text-slate-700">{selectedChat.status}</p>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className="h-1.5 rounded-full transition-all" 
                          style={{ 
                            width: `${((PIPELINE_STAGES.findIndex(s => s.value === selectedChat.status) + 1) / PIPELINE_STAGES.length) * 100}%`,
                            backgroundColor: PIPELINE_STAGES.find(s => s.value === selectedChat.status)?.color || '#0891b2'
                          }}
                        ></div>
                      </div>
                    </div>
                  </section>

                  {/* Responsável */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</h3>
                      {canSendMessage && (
                        <button 
                          onClick={() => { setShowForwardModal(true); }}
                          className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                        >
                          Encaminhar
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                      {chatAssignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="size-8 bg-cyan-100 rounded-full flex items-center justify-center">
                            <span className="text-cyan-700 font-bold text-xs">
                              {chatAssignedTo.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">
                              {chatAssignedTo.id === user?.id ? 'Você' : chatAssignedTo.name}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Nenhum responsável</p>
                      )}
                      {!chatAssignedTo && canSendMessage && (
                        <button 
                          onClick={() => { handleAssumeChat(); }}
                          className="text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg"
                        >
                          Assumir
                        </button>
                      )}
                    </div>
                  </section>

                  {/* Origem do Lead */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem do Lead</h3>
                      <button 
                        onClick={() => { fetchAvailableTags(); setShowAddSourceModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Nova
                      </button>
                    </div>
                    <button
                      onClick={() => { setShowSourceDropdown(!showSourceDropdown); }}
                      className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:border-cyan-300 transition-colors"
                    >
                      {selectedSourceId ? (() => {
                        const selectedSource = leadSources.find(s => s.id === selectedSourceId);
                        const sourceColor = selectedSource ? getSourceColor(selectedSource) : '#6B7280';
                        return (
                          <div className="flex items-center gap-2">
                            <span 
                              className="size-3 rounded-full" 
                              style={{ backgroundColor: sourceColor }}
                            ></span>
                            <span className="text-sm font-bold text-slate-700">
                              {selectedSource?.name}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-sm text-slate-400">Selecionar origem...</span>
                      )}
                      <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_more</span>
                    </button>
                  </section>

                  {/* Etiquetas */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiquetas</h3>
                      <button 
                        onClick={() => { setShowTagsModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                      </button>
                    </div>
                    {selectedChat.tags && selectedChat.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedChat.tags.map(tag => (
                          <span 
                            key={tag.id}
                            className="px-2 py-1 rounded-full text-[10px] font-bold border"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Nenhuma etiqueta</p>
                    )}
                  </section>

                  {/* Orçamentos */}
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamentos</h3>
                      <button 
                        onClick={() => { setShowQuoteModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                      </button>
                    </div>
                    {quotes.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum orçamento</p>
                    ) : (
                      <div className="space-y-2">
                        {quotes.slice(0, 3).map(quote => (
                          <div 
                            key={quote.id}
                            className={`p-2.5 rounded-xl border ${
                              quote.status === 'approved' ? 'bg-green-50 border-green-200' :
                              quote.status === 'rejected' ? 'bg-red-50 border-red-200' :
                              'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600 truncate">{quote.service_type}</span>
                              <span className={`text-sm font-bold ${
                                quote.status === 'approved' ? 'text-green-700' :
                                quote.status === 'rejected' ? 'text-red-700' :
                                'text-amber-700'
                              }`}>
                                R$ {quote.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {quotes.length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center">+{quotes.length - 3} orçamentos</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Negociações Comerciais */}
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Negociações</h3>
                      <button 
                        onClick={() => { setShowPaymentModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                      </button>
                    </div>
                    {payments.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum pagamento</p>
                    ) : (
                      <div className="space-y-2">
                        {payments.filter(p => p.status !== 'cancelled').slice(0, 3).map(payment => (
                          <div key={payment.id} className="p-2.5 rounded-xl border bg-emerald-50 border-emerald-200">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">{payment.payment_method || 'Pagamento'}</span>
                              <span className="text-sm font-bold text-emerald-700">
                                R$ {payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {payments.filter(p => p.status !== 'cancelled').length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center">+{payments.filter(p => p.status !== 'cancelled').length - 3} pagamentos</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Tarefas */}
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefas</h3>
                      <button 
                        onClick={() => { setShowTaskModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                      </button>
                    </div>
                    {tasks.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma tarefa</p>
                    ) : (
                      <div className="space-y-2">
                        {tasks.filter(t => !t.completed).slice(0, 3).map(task => (
                          <div key={task.id} className="p-2.5 rounded-xl border bg-purple-50 border-purple-200">
                            <p className="text-xs text-slate-700">{task.title}</p>
                            {task.due_date && (
                              <p className="text-[10px] text-purple-600 mt-1">
                                {formatDateOnly(task.due_date)}
                              </p>
                            )}
                          </div>
                        ))}
                        {tasks.filter(t => !t.completed).length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center">+{tasks.filter(t => !t.completed).length - 3} tarefas</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Lançamentos da Clínica */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lançamentos da Clínica</h3>
                      <button 
                        onClick={() => { setShowClinicReceiptModal(true); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                      </button>
                    </div>
                    {clinicReceipts.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum lançamento direto</p>
                    ) : (
                      <div className="space-y-2">
                        {clinicReceipts.slice(0, 2).map(receipt => (
                          <div key={receipt.id} className="p-2.5 rounded-xl border bg-teal-50 border-teal-200">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600">{receipt.payment_method || 'Recebimento'}</span>
                              <span className="text-sm font-bold text-teal-700">
                                R$ {receipt.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {clinicReceipts.length > 2 && (
                          <p className="text-[10px] text-slate-400 text-center">+{clinicReceipts.length - 2} lançamentos</p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Follow-up */}
                  <section>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow-up</h3>
                      <button 
                        onClick={() => { setShowScheduleModal(true); setShowLeadPanelDrawer(false); }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Agendar
                      </button>
                    </div>
                    {scheduledMessages.filter(m => m.status === 'pending').length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhum follow-up agendado</p>
                    ) : (
                      <div className="space-y-2">
                        {scheduledMessages.filter(m => m.status === 'pending').slice(0, 2).map(msg => (
                          <div key={msg.id} className="p-2.5 rounded-xl border bg-blue-50 border-blue-200">
                            <p className="text-[11px] text-slate-700 line-clamp-1">{msg.message}</p>
                            <p className="text-[10px] text-blue-600 mt-1">
                              {new Date(msg.scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Observações */}
                  <section>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observações</h3>
                    {notes.length === 0 ? (
                      <p className="text-xs text-slate-400 mb-3">Nenhuma observação ainda</p>
                    ) : (
                      <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                        {notes.slice(0, 3).map(note => (
                          <div key={note.id} className="bg-yellow-50 p-2.5 rounded-xl border border-yellow-200">
                            <p className="text-[11px] text-slate-700 italic line-clamp-2">"{note.content}"</p>
                            <p className="text-[10px] text-slate-400 mt-1">{note.user_name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea 
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Adicionar nota interna..."
                      className="w-full rounded-xl bg-slate-50 border-slate-200 text-xs p-2.5 focus:ring-cyan-600 focus:border-cyan-600 h-16 resize-none"
                    />
                    <button
                      onClick={() => { handleSaveNote(); }}
                      disabled={!noteInput.trim() || savingNote}
                      className="w-full mt-2 py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingNote ? (
                        <>
                          <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">save</span>
                          Salvar Observação
                        </>
                      )}
                    </button>
                  </section>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <span className="material-symbols-outlined text-4xl text-slate-100 mb-4">info</span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione uma conversa</p>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Modal de Conexão WhatsApp */}
      {connectionModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConnectionModal({ show: false, title: '', message: '', needsQrCode: false })}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="size-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600 text-3xl">link_off</span>
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">{connectionModal.title}</h3>
              <p className="text-slate-600 text-sm mb-4">
                {connectionModal.message}
              </p>
              {connectionModal.needsQrCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 text-amber-700">
                    <span className="material-symbols-outlined">qr_code_2</span>
                    <span className="font-medium text-sm">Escaneie o QR Code</span>
                  </div>
                  <p className="text-amber-600 text-xs mt-1">Clique no botão abaixo para gerar</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setConnectionModal({ show: false, title: '', message: '', needsQrCode: false })}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  Fechar
                </button>
                {connectionModal.needsQrCode && (
                  <button
                    onClick={async () => {
                      setConnectionModal({ show: false, title: '', message: '', needsQrCode: false });
                      
                      // Fazer logout da instância antes de redirecionar
                      try {
                        const { data: settings } = await supabase
                          .from('settings')
                          .select('evolution_api_url, evolution_api_key')
                          .single();
                        
                        const { data: instances } = await supabase
                          .from('whatsapp_instances')
                          .select('instance_name')
                          .eq('clinic_id', clinicId)
                          .limit(1);
                        
                        const instance = instances?.[0];
                        if (settings?.evolution_api_url && settings?.evolution_api_key && instance) {
                          // Fazer logout para limpar a sessão
                          await fetch(
                            `${settings.evolution_api_url}/instance/logout/${instance.instance_name}`,
                            {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json', 'apikey': settings.evolution_api_key },
                            }
                          );
                          
                          // Atualizar status no banco
                          await supabase
                            .from('whatsapp_instances')
                            .update({ status: 'disconnected' })
                            .eq('clinic_id', clinicId);
                        }
                      } catch (err) {
                        console.error('Erro ao fazer logout:', err);
                      }
                      
                      // Redirecionar para página de conexão
                      window.location.href = '/connect-whatsapp';
                    }}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                    Gerar QR Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rate Limit */}
      {rateLimitModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRateLimitModal({ show: false, message: '', waitSeconds: 0 })}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="size-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-amber-600 text-3xl">schedule</span>
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">Aguarde um momento</h3>
              <p className="text-slate-600 text-sm mb-4">
                Para proteger sua conta do WhatsApp, aguarde antes de enviar outra mensagem.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-center gap-2 text-amber-700">
                  <span className="material-symbols-outlined">timer</span>
                  <span className="font-bold text-2xl">{rateLimitModal.waitSeconds}s</span>
                </div>
                <p className="text-amber-600 text-xs mt-1">tempo restante</p>
              </div>
              <button
                onClick={() => setRateLimitModal({ show: false, message: '', waitSeconds: 0 })}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal de Cadastro/Edição de Cliente */}
      {showClientModal && clientData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">
                    {clientData.id ? 'person' : 'person_add'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {clientData.id ? 'Editar Cliente' : 'Cadastrar Cliente'}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {clientData.id ? 'Atualize os dados do cliente' : 'Preencha os dados do cliente'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowClientModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={clientData.name}
                    onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                    className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={clientData.phone}
                      onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-slate-50"
                      placeholder="(00) 00000-0000"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={clientData.cpf}
                      onChange={(e) => setClientData({ ...clientData, cpf: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={clientData.email}
                      onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={clientData.birth_date}
                      onChange={(e) => setClientData({ ...clientData, birth_date: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={clientData.address}
                    onChange={(e) => setClientData({ ...clientData, address: e.target.value })}
                    className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Rua, número, bairro"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={clientData.city}
                      onChange={(e) => setClientData({ ...clientData, city: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Ex: Campo Grande"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Estado</label>
                    <select
                      value={clientData.state}
                      onChange={(e) => setClientData({ ...clientData, state: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    >
                      <option value="">UF</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">CEP</label>
                    <input
                      type="text"
                      value={clientData.zip_code}
                      onChange={(e) => setClientData({ ...clientData, zip_code: e.target.value })}
                      className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Gênero</label>
                  <select
                    value={clientData.gender}
                    onChange={(e) => setClientData({ ...clientData, gender: e.target.value })}
                    className="w-full h-11 px-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Selecione</option>
                    <option value="m">Masculino</option>
                    <option value="f">Feminino</option>
                    <option value="o">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={clientData.notes}
                    onChange={(e) => setClientData({ ...clientData, notes: e.target.value })}
                    className="w-full h-24 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                    placeholder="Observações sobre o cliente..."
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleSaveClient}
                disabled={!clientData.name.trim() || savingClient}
                className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingClient ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {clientData.id ? 'Atualizar' : 'Cadastrar'}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowClientModal(false)}
                className="px-6 h-11 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Email */}
      {showEmailModal && selectedChat && leadEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEmailModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-violet-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">mail</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Enviar Email</h3>
                  <p className="text-purple-100 text-sm">Para: {selectedChat.client_name}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Destinatário:</p>
                <p className="text-sm font-medium text-slate-700">{leadEmail}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
                <select
                  value={selectedEmailTemplateId}
                  onChange={(e) => setSelectedEmailTemplateId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Selecione um template</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedEmailTemplateId && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-500 mb-1">Assunto:</p>
                  <p className="text-sm font-medium text-purple-700">
                    {emailTemplates.find(t => t.id === selectedEmailTemplateId)?.subject
                      .replace('{{lead_name}}', selectedChat.client_name || 'Cliente')
                      .replace('{{clinic_name}}', state.selectedClinic?.name || '')}
                  </p>
                </div>
              )}

              {emailTemplates.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <span className="material-symbols-outlined text-amber-500 text-2xl mb-2">warning</span>
                  <p className="text-sm text-amber-700">Nenhum template de email encontrado.</p>
                  <p className="text-xs text-amber-600 mt-1">Crie templates em Email Marketing.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!selectedEmailTemplateId || sendingEmail}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Enviar Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tags (movido para fora do aside para funcionar em tablet/mobile) */}
      {showTagsModal && selectedChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowTagsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 max-w-[90vw] max-h-[500px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{showCreateTag ? 'Nova Etiqueta' : 'Etiquetas'}</h3>
              <button onClick={() => setShowTagsModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Formulário para criar nova etiqueta */}
            {showCreateTag ? (
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome da Etiqueta</label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Ex: Dra. Maria"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Cor</label>
                  <div className="grid grid-cols-8 gap-2">
                    {tagColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`size-8 rounded-lg transition-all ${newTagColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateTag(false)}
                    className="flex-1 h-10 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || savingTag}
                    className="flex-1 h-10 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {savingTag ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Criar
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Botão para criar nova etiqueta */}
                <div className="p-3 border-b border-slate-100">
                  <button
                    onClick={() => setShowCreateTag(true)}
                    className="w-full px-3 py-2 rounded-lg text-sm font-medium text-cyan-600 bg-cyan-50 hover:bg-cyan-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Criar Nova Etiqueta
                  </button>
                </div>
                
                {/* Lista de etiquetas existentes */}
                <div className="p-4 max-h-64 overflow-y-auto">
                  {loadingTags ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto"></div>
                    </div>
                  ) : availableTags.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Nenhuma etiqueta criada ainda</p>
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
                              <span className="size-4 rounded-full" style={{ backgroundColor: tag.color }}></span>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Nova Origem (movido para fora do aside) */}
      {showAddSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowAddSourceModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">Código do Criativo (opcional)</label>
                <input
                  type="text"
                  value={newSourceForm.code}
                  onChange={(e) => setNewSourceForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Ex: AV1, AV2, IG01..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Vincular à Dra (cor)</label>
                <select
                  value={newSourceForm.tag_id}
                  onChange={(e) => setNewSourceForm(prev => ({ ...prev, tag_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent bg-white"
                >
                  <option value="">Sem vínculo (cor padrão)</option>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
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

      {/* Modal de Novo Orçamento (movido para fora do aside) */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowQuoteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
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

      {/* Modal de Novo Pagamento (movido para fora do aside) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">Forma de Pagamento</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="boleto">Boleto</option>
                  <option value="link">Link de Pagamento</option>
                  <option value="transferencia">Transferência</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição</label>
                <select
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Entrada de Procedimento">Entrada de Procedimento</option>
                  <option value="Consulta">Consulta</option>
                  <option value="Procedimento">Procedimento</option>
                  <option value="Mentoria">Mentoria</option>
                </select>
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

      {/* Modal de Nova Tarefa (movido para fora do aside) */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
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

      {/* Modal de Agendar Follow-up (movido para fora do aside) */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                    min={getLocalDateString()}
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
                    date.setDate(date.getDate() + 1);
                    setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                  }}
                  className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  1 dia
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 3);
                    setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                  }}
                  className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  3 dias
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 7);
                    setScheduleForm(prev => ({ ...prev, scheduled_date: date.toISOString().split('T')[0], scheduled_time: '09:00' }));
                  }}
                  className="flex-1 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  7 dias
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

      {/* Modal de Novo Lançamento da Clínica (movido para fora do aside) */}
      {showClinicReceiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowClinicReceiptModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-teal-50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">account_balance</span>
                <h3 className="font-bold text-slate-800">Lançamento Direto</h3>
              </div>
              <button onClick={() => setShowClinicReceiptModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  value={clinicReceiptForm.value}
                  onChange={(e) => setClinicReceiptForm(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Data do Recebimento</label>
                <input
                  type="date"
                  value={clinicReceiptForm.receipt_date}
                  onChange={(e) => setClinicReceiptForm(prev => ({ ...prev, receipt_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Forma de Pagamento</label>
                <select
                  value={clinicReceiptForm.payment_method}
                  onChange={(e) => setClinicReceiptForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="boleto">Boleto</option>
                  <option value="transferencia">Transferência</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição</label>
                <input
                  type="text"
                  value={clinicReceiptForm.description}
                  onChange={(e) => setClinicReceiptForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Consulta, Procedimento, Entrada..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSaveClinicReceipt}
                disabled={!clinicReceiptForm.value || savingClinicReceipt}
                className="w-full py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingClinicReceipt ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                    Registrar Lançamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown de Etapas do Pipeline (movido para fora do aside) */}
      {showStageDropdown && selectedChat && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => setShowStageDropdown(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-72 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Alterar Etapa</h3>
              <button onClick={() => setShowStageDropdown(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {PIPELINE_STAGES.map(stage => (
                <button
                  key={stage.value}
                  onClick={() => handleChangeStage(stage.value)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0 ${
                    selectedChat.status === stage.value ? 'bg-cyan-50 font-bold' : ''
                  }`}
                >
                  <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }}></span>
                  <span className="flex-1">{stage.label}</span>
                  {selectedChat.status === stage.value && (
                    <span className="material-symbols-outlined text-cyan-600 text-[16px]">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dropdown de Origem do Lead (movido para fora do aside) */}
      {showSourceDropdown && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => setShowSourceDropdown(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-72 max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Origem do Lead</h3>
              <button onClick={() => setShowSourceDropdown(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <button
                onClick={() => handleUpdateSource(null)}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 ${
                  !selectedSourceId ? 'bg-cyan-50 font-bold' : ''
                }`}
              >
                <span className="size-3 rounded-full bg-slate-300"></span>
                <span className="flex-1">Sem origem definida</span>
                {!selectedSourceId && (
                  <span className="material-symbols-outlined text-cyan-600 text-[16px]">check</span>
                )}
              </button>
              {leadSources.map(source => {
                const sourceColor = getSourceColor(source);
                return (
                  <button
                    key={source.id}
                    onClick={() => handleUpdateSource(source.id)}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0 ${
                      selectedSourceId === source.id ? 'bg-cyan-50 font-bold' : ''
                    }`}
                  >
                    <span className="size-3 rounded-full" style={{ backgroundColor: sourceColor }}></span>
                    <span className="flex-1">{source.name}</span>
                    {source.code && <span className="text-[10px] text-slate-400">{source.code}</span>}
                    {selectedSourceId === source.id && (
                      <span className="material-symbols-outlined text-cyan-600 text-[16px]">check</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Seções */}
      <SectionConfigModal
        isOpen={showSectionConfigModal}
        onClose={() => setShowSectionConfigModal(false)}
        hiddenSections={hiddenSections}
        onToggle={toggleSectionVisibility}
        sectionOrder={sectionOrder}
        onMoveUp={moveSectionUp}
        onMoveDown={moveSectionDown}
      />
    </div>
  );
};

export default Inbox;
