
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { usePipelineStages, PipelineStage } from '../hooks/usePipelineStages';
import { supabase } from '../lib/supabase';
import { hasPermission } from '../lib/permissions';

interface KanbanProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

// Cores disponíveis para etapas customizadas
const STAGE_COLORS = [
  '#3B82F6', '#F97316', '#F59E0B', '#8B5CF6', '#10B981',
  '#0891B2', '#EAB308', '#EF4444', '#EC4899', '#6366F1',
  '#14B8A6', '#84CC16', '#F43F5E', '#0EA5E9',
];

const Kanban: React.FC<KanbanProps> = ({ state, setState }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, updateChatStatus, refetch } = useChats(clinicId, user?.id);
  const { stages, loading: stagesLoading, createStage, updateStage, deleteStage, reorderStages, fetchStages } = usePipelineStages(clinicId);
  const columns = stages.map(s => s.status_key);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, Array<{ service_type: string; value: number; status: string }>>>({});
  
  const canMoveLead = hasPermission(user?.role, 'move_lead');
  const canCreateLead = hasPermission(user?.role, 'create_lead');
  const canEditPipelineLabels = hasPermission(user?.role, 'edit_pipeline_labels');
  
  // Estados para modal de novo lead
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '' });
  const [savingLead, setSavingLead] = useState(false);
  
  // Estados para modal de gerenciamento de etapas
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [stageForm, setStageForm] = useState({ label: '', color: '#3B82F6' });
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const [showDeleteStageModal, setShowDeleteStageModal] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null);
  const [moveToStage, setMoveToStage] = useState('');

  // Helpers derivados das stages
  const pipelineLabels: Record<string, string> = {};
  const stageColorMap: Record<string, string> = {};
  stages.forEach(s => {
    pipelineLabels[s.status_key] = s.label;
    stageColorMap[s.status_key] = s.color;
  });
  
  // Estado para modal de informações do cliente
  const [selectedLeadInfo, setSelectedLeadInfo] = useState<any>(null);
  const [showLeadInfoModal, setShowLeadInfoModal] = useState(false);
  const [loadingLeadInfo, setLoadingLeadInfo] = useState(false);
  
  // Estados para filtro de período
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '15d' | '30d' | 'custom'>('all');
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Estado para busca por nome/telefone
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para aba selecionada no mobile
  const [mobileSelectedColumn, setMobileSelectedColumn] = useState('Novo Lead');
  
  // Estados para envio de email
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string; html_content: string }>>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<{ leadId: string; leadName: string; leadEmail: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [leadsEmailMap, setLeadsEmailMap] = useState<Record<string, string>>({});
  
  // Estado para códigos de campanha (link rastreável)
  const [campaignCodesMap, setCampaignCodesMap] = useState<Record<string, { code: string; name: string }>>({});
  
  // Estado para fontes de lead (lead_sources - Meta Ads, Instagram, etc)
  const [leadSourcesMap, setLeadSourcesMap] = useState<Record<string, { name: string; code: string | null; color: string }>>({});
  
  // Estados para filtro por etiqueta
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [showTagFilterDropdown, setShowTagFilterDropdown] = useState(false);

  // Refs para sincronizar scroll horizontal
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  // Sincronizar scroll do topo com o principal
  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  // Sincronizar scroll principal com o topo
  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  };

  // Atualizar largura do scroll quando colunas carregam
  useEffect(() => {
    if (mainScrollRef.current) {
      setScrollWidth(mainScrollRef.current.scrollWidth);
    }
  }, [chats, loading]);

  // Recarregar chats quando o componente é montado
  useEffect(() => {
    refetch();
  }, []);

  // MobileSelectedColumn: garantir que seja uma coluna válida
  useEffect(() => {
    if (columns.length > 0 && !columns.includes(mobileSelectedColumn)) {
      setMobileSelectedColumn(columns[0]);
    }
  }, [columns]);

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

  // Buscar emails dos leads quando chats mudam
  useEffect(() => {
    const fetchLeadsEmails = async () => {
      if (!clinicId || chats.length === 0) return;
      
      const leadIds = chats.filter(c => c.lead_id).map(c => c.lead_id);
      if (leadIds.length === 0) return;
      
      try {
        const { data } = await supabase
          .from('leads' as any)
          .select('id, email')
          .in('id', leadIds);
        
        if (data) {
          const emailMap: Record<string, string> = {};
          (data as any[]).forEach(lead => {
            if (lead.email) {
              emailMap[lead.id] = lead.email;
            }
          });
          setLeadsEmailMap(emailMap);
        }
      } catch (err) {
        console.error('Error fetching leads emails:', err);
      }
    };
    
    fetchLeadsEmails();
  }, [clinicId, chats]);

  // Buscar códigos de campanha (links rastreáveis) dos chats
  useEffect(() => {
    const fetchCampaignCodes = async () => {
      if (!clinicId || chats.length === 0) return;
      
      const chatIds = new Set(chats.map(c => c.id));
      
      try {
        // Buscar por clinic_id via trackable_links para evitar URL muito longa
        const { data } = await supabase
          .from('link_clicks' as any)
          .select('chat_id, trackable_links!inner(code, name, clinic_id)')
          .eq('trackable_links.clinic_id', clinicId)
          .not('chat_id', 'is', null);
        
        if (data) {
          const codesMap: Record<string, { code: string; name: string }> = {};
          (data as any[]).forEach(item => {
            // Filtrar apenas chats que estão na lista atual
            if (item.chat_id && item.trackable_links && chatIds.has(item.chat_id)) {
              codesMap[item.chat_id] = {
                code: item.trackable_links.code,
                name: item.trackable_links.name,
              };
            }
          });
          setCampaignCodesMap(codesMap);
        }
      } catch (err) {
        console.error('Error fetching campaign codes:', err);
      }
    };
    
    fetchCampaignCodes();
  }, [clinicId, chats]);

  // Buscar fontes de lead (lead_sources - Meta Ads, Instagram, etc)
  useEffect(() => {
    const fetchLeadSources = async () => {
      if (!clinicId || chats.length === 0) return;
      
      const sourceIds = chats.filter(c => c.source_id).map(c => c.source_id);
      if (sourceIds.length === 0) return;
      
      try {
        const { data } = await supabase
          .from('lead_sources' as any)
          .select('id, name, code, color')
          .in('id', sourceIds);
        
        if (data) {
          const sourcesMap: Record<string, { name: string; code: string | null; color: string }> = {};
          (data as any[]).forEach(source => {
            sourcesMap[source.id] = {
              name: source.name,
              code: source.code,
              color: source.color || '#6B7280',
            };
          });
          setLeadSourcesMap(sourcesMap);
        }
      } catch (err) {
        console.error('Error fetching lead sources:', err);
      }
    };
    
    fetchLeadSources();
  }, [clinicId, chats]);

  // Buscar etiquetas disponíveis para filtro
  useEffect(() => {
    const fetchTags = async () => {
      if (!clinicId) return;
      
      try {
        const { data } = await supabase
          .from('tags' as any)
          .select('id, name, color')
          .eq('clinic_id', clinicId)
          .order('name');
        
        if (data) {
          setAvailableTags(data as any[]);
        }
      } catch (err) {
        console.error('Error fetching tags:', err);
      }
    };
    
    fetchTags();
  }, [clinicId]);

  // Função para abrir modal de email
  const handleOpenEmailModal = (lead: any) => {
    const email = lead.lead_id ? leadsEmailMap[lead.lead_id] : null;
    if (!email) return;
    
    setEmailTarget({
      leadId: lead.id,
      leadName: lead.client_name,
      leadEmail: email,
    });
    setSelectedTemplateId('');
    setShowEmailModal(true);
  };

  // Função para enviar email
  const handleSendEmail = async () => {
    if (!emailTarget || !selectedTemplateId || !clinicId) return;
    
    setSendingEmail(true);
    try {
      const template = emailTemplates.find(t => t.id === selectedTemplateId);
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
        '{{lead_name}}': emailTarget.leadName || 'Cliente',
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
          to: emailTarget.leadEmail,
          subject: subject,
          html: htmlContent,
          clinic_id: clinicId,
        }
      });
      
      if (error) throw error;
      
      setShowEmailModal(false);
      setEmailTarget(null);
      setSelectedTemplateId('');
      
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    } finally {
      setSendingEmail(false);
    }
  };

  // Mover etapa para cima ou para baixo
  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    const idx = stages.findIndex(s => s.id === stageId);
    if (idx < 0) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= stages.length) return;
    
    // Não permitir mover Novo Lead para baixo da posição 0
    if (stages[idx].status_key === 'Novo Lead' && direction === 'down') return;
    // Não permitir mover Perdido para cima da última posição
    if (stages[idx].status_key === 'Perdido' && direction === 'up') return;
    // Não permitir mover algo para a posição do Novo Lead (posição 0)
    if (stages[targetIdx].status_key === 'Novo Lead' && direction === 'up') return;
    // Não permitir mover algo para a posição do Perdido (última)
    if (stages[targetIdx].status_key === 'Perdido' && direction === 'down') return;
    
    const newOrder = [...stages];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    await reorderStages(newOrder);
  };

  // Salvar etapa (criar ou editar)
  const handleSaveStage = async () => {
    if (!stageForm.label.trim()) return;
    
    setSavingStage(true);
    try {
      if (editingStage) {
        await updateStage(editingStage.id, stageForm.label, stageForm.color);
      } else {
        await createStage(stageForm.label, stageForm.color);
      }
      setStageForm({ label: '', color: '#3B82F6' });
      setEditingStage(null);
    } catch (err) {
      console.error('Error saving stage:', err);
    } finally {
      setSavingStage(false);
    }
  };

  // Confirmar exclusão de etapa
  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete || !moveToStage) return;
    
    setSavingStage(true);
    try {
      await deleteStage(stageToDelete.id, moveToStage);
      setShowDeleteStageModal(false);
      setStageToDelete(null);
      setMoveToStage('');
    } catch (err) {
      console.error('Error deleting stage:', err);
    } finally {
      setSavingStage(false);
    }
  };

  // Buscar orçamentos (pendentes e aprovados) de todos os chats
  useEffect(() => {
    const fetchQuotes = async () => {
      if (!clinicId || chats.length === 0) return;
      
      const chatIds = chats.map(c => c.id);
      // Buscar por clinic_id e filtrar no frontend para evitar erro 400 com muitos IDs
      const { data } = await supabase
        .from('quotes' as any)
        .select('chat_id, service_type, value, status')
        .eq('clinic_id', clinicId)
        .in('status', ['approved', 'pending']);
      
      if (data) {
        const map: Record<string, Array<{ service_type: string; value: number; status: string }>> = {};
        (data as any[]).filter((q: any) => chatIds.includes(q.chat_id)).forEach((q: any) => {
          if (!map[q.chat_id]) map[q.chat_id] = [];
          map[q.chat_id].push({ service_type: q.service_type, value: Number(q.value), status: q.status });
        });
        setQuotesMap(map);
      }
    };
    fetchQuotes();
  }, [clinicId, chats]);

  // Helper: converter hex para classe Tailwind aproximada
  const hexToTailwind = (hex: string): string => {
    const map: Record<string, string> = {
      '#3B82F6': 'blue', '#F97316': 'orange', '#F59E0B': 'amber', '#8B5CF6': 'purple',
      '#10B981': 'green', '#0891B2': 'cyan', '#EAB308': 'yellow', '#EF4444': 'red',
      '#EC4899': 'pink', '#6366F1': 'indigo', '#14B8A6': 'teal', '#84CC16': 'lime',
      '#F43F5E': 'rose', '#0EA5E9': 'sky',
    };
    return map[hex] || 'slate';
  };

  const columnConfig: Record<string, { color: string }> = {};
  stages.forEach(s => {
    columnConfig[s.status_key] = { color: hexToTailwind(s.color) };
  });

  const moveLead = async (id: string, newStage: string) => {
    await updateChatStatus(id, newStage);
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Agora';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  // Filtrar leads por período
  const filterByPeriod = (chat: any) => {
    if (periodFilter === 'all') return true;
    
    const chatDate = new Date(chat.created_at || chat.updated_at);
    const now = new Date();
    
    if (periodFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return chatDate >= todayStart;
    }
    
    if (periodFilter === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return chatDate >= sevenDaysAgo;
    }
    
    if (periodFilter === '15d') {
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      return chatDate >= fifteenDaysAgo;
    }
    
    if (periodFilter === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return chatDate >= thirtyDaysAgo;
    }
    
    if (periodFilter === 'custom' && customDateStart && customDateEnd) {
      const startDate = new Date(customDateStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
      return chatDate >= startDate && chatDate <= endDate;
    }
    
    return true;
  };

  // Filtrar por busca (nome ou telefone)
  const filterBySearch = (chat: any) => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase().trim();
    const clientName = (chat.client_name || '').toLowerCase();
    const phoneNumber = (chat.phone_number || '').replace(/\D/g, '');
    const searchDigits = term.replace(/\D/g, '');
    
    // Busca por nome (texto) ou por telefone (apenas dígitos)
    const matchesName = clientName.includes(term);
    const matchesPhone = searchDigits.length > 0 && phoneNumber.includes(searchDigits);
    
    return matchesName || matchesPhone;
  };

  // Filtrar por etiqueta
  const filterByTag = (chat: any) => {
    if (!selectedTagFilter) return true;
    return chat.tags && chat.tags.some((tag: any) => tag.id === selectedTagFilter);
  };

  // Chats filtrados por período, busca e etiqueta
  const filteredChats = chats.filter(chat => !chat.is_group && filterByPeriod(chat) && filterBySearch(chat) && filterByTag(chat));

  // Buscar informações completas do cliente
  const handleShowLeadInfo = async (lead: any) => {
    setLoadingLeadInfo(true);
    setShowLeadInfoModal(true);
    
    try {
      // Buscar dados do lead vinculado se existir
      let leadData = null;
      if (lead.lead_id) {
        const { data } = await supabase
          .from('leads')
          .select('*')
          .eq('id', lead.lead_id)
          .single();
        leadData = data;
      }
      
      setSelectedLeadInfo({
        ...lead,
        leadData
      });
    } catch (err) {
      console.error('Erro ao buscar dados do lead:', err);
      setSelectedLeadInfo(lead);
    } finally {
      setLoadingLeadInfo(false);
    }
  };

  // Ir para conversa no WhatsApp (Inbox)
  const handleGoToChat = (chatId: string) => {
    navigate(`/inbox?chatId=${encodeURIComponent(chatId)}`);
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    if (!canMoveLead) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!canMoveLead) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, newStage: string) => {
    if (!canMoveLead) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      moveLead(id, newStage);
      setDraggedId(null);
    }
  };

  // Criar novo lead
  const handleCreateLead = async () => {
    if (!newLeadForm.name.trim() || !newLeadForm.phone.trim() || !clinicId) return;
    
    setSavingLead(true);
    try {
      const { error } = await supabase
        .from('chats')
        .insert({
          clinic_id: clinicId,
          client_name: newLeadForm.name.trim(),
          phone_number: newLeadForm.phone.trim(),
          status: 'Novo Lead',
        });
      
      if (!error) {
        setNewLeadForm({ name: '', phone: '' });
        setShowNewLeadModal(false);
        refetch();
      }
    } catch (err) {
      console.error('Error creating lead:', err);
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-4 md:mb-6 lg:mb-8 shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Pipeline de Leads</h1>
          <p className="text-slate-500 text-sm lg:text-base">Arraste e solte os leads para atualizar o status.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
           {canEditPipelineLabels && (
           <button 
              onClick={() => setShowStagesModal(true)}
              className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Gerenciar etapas do pipeline"
           >
              <span className="material-symbols-outlined text-[20px]">settings</span>
           </button>
           )}
           <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px] md:text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 md:pl-10 pr-8 md:pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm w-36 md:w-48 lg:w-64 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">close</span>
                </button>
              )}
           </div>
           {canCreateLead && (
           <button 
              onClick={() => setShowNewLeadModal(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm h-9 md:h-10 px-3 md:px-6 rounded-lg shadow-lg shadow-cyan-500/30 flex items-center gap-1.5 md:gap-2"
           >
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">add</span>
              <span className="hidden md:inline">Novo Lead</span>
              <span className="md:hidden">Novo</span>
           </button>
           )}
        </div>
      </div>

      {/* Filtros de período */}
      <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1 md:mr-2 flex-shrink-0">Período:</span>
        <button
          onClick={() => { setPeriodFilter('all'); setShowDatePicker(false); }}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
            periodFilter === 'all' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => { setPeriodFilter('today'); setShowDatePicker(false); }}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
            periodFilter === 'today' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => { setPeriodFilter('7d'); setShowDatePicker(false); }}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
            periodFilter === '7d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          7d
        </button>
        <button
          onClick={() => { setPeriodFilter('15d'); setShowDatePicker(false); }}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
            periodFilter === '15d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          15d
        </button>
        <button
          onClick={() => { setPeriodFilter('30d'); setShowDatePicker(false); }}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
            periodFilter === '30d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          30d
        </button>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0 ${
            periodFilter === 'custom' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">calendar_month</span>
          <span className="hidden md:inline">Personalizado</span>
        </button>
        
        {/* Filtro por etiqueta */}
        <div className="relative ml-2 md:ml-4 flex-shrink-0">
          <button
            onClick={() => setShowTagFilterDropdown(!showTagFilterDropdown)}
            className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 md:gap-1.5 ${
              selectedTagFilter 
                ? 'bg-violet-100 text-violet-700 border border-violet-200' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">label</span>
            <span className="hidden md:inline">
              {selectedTagFilter 
                ? availableTags.find(t => t.id === selectedTagFilter)?.name || 'Etiqueta'
                : 'Etiqueta'
              }
            </span>
            <span className="material-symbols-outlined text-[12px]">
              {showTagFilterDropdown ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          
          {showTagFilterDropdown && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="p-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">Filtrar por etiqueta</span>
                {selectedTagFilter && (
                  <button
                    onClick={() => { setSelectedTagFilter(null); setShowTagFilterDropdown(false); }}
                    className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                {availableTags.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">Nenhuma etiqueta cadastrada</p>
                ) : (
                  availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => { setSelectedTagFilter(tag.id); setShowTagFilterDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                        selectedTagFilter === tag.id 
                          ? 'bg-violet-50' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      ></span>
                      <span className="text-sm text-slate-700 truncate">{tag.name}</span>
                      {selectedTagFilter === tag.id && (
                        <span className="material-symbols-outlined text-violet-600 text-[14px] ml-auto">check</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Contador de leads filtrados */}
        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
          {filteredChats.length} lead{filteredChats.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Date picker para período personalizado - linha separada */}
      {showDatePicker && (
        <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0 bg-white border border-slate-200 rounded-lg p-2 shadow-sm overflow-x-auto">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => setCustomDateStart(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded text-xs flex-shrink-0"
          />
          <span className="text-slate-400 text-xs flex-shrink-0">até</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => setCustomDateEnd(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded text-xs flex-shrink-0"
          />
          <button
            onClick={() => {
              if (customDateStart && customDateEnd) {
                setPeriodFilter('custom');
              }
            }}
            disabled={!customDateStart || !customDateEnd}
            className="px-3 py-1 bg-cyan-600 text-white rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-700 flex-shrink-0"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* ========== VERSÃO MOBILE - Abas com lista de cards ========== */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Abas de etapas */}
        <div className="flex overflow-x-auto gap-1 pb-2 mb-3 -mx-4 px-4 shrink-0">
          {columns.map(column => {
            const leadsInCol = filteredChats.filter(c => c.status === column);
            const config = columnConfig[column];
            const isSelected = mobileSelectedColumn === column;
            return (
              <button
                key={column}
                onClick={() => setMobileSelectedColumn(column)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${
                  isSelected 
                    ? `bg-${config.color}-100 text-${config.color}-700 border border-${config.color}-200` 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <div className={`size-2 rounded-full bg-${config.color}-500`}></div>
                <span className="truncate max-w-[60px]">{pipelineLabels[column]}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isSelected ? `bg-${config.color}-200 text-${config.color}-800` : 'bg-slate-200 text-slate-600'
                }`}>
                  {leadsInCol.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lista de cards da etapa selecionada */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-3"></div>
                <p className="text-slate-500 text-sm">Carregando...</p>
              </div>
            </div>
          ) : (
            <>
              {filteredChats.filter(c => c.status === mobileSelectedColumn).length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-slate-300 text-4xl mb-2">inbox</span>
                  <p className="text-slate-400 text-sm">Nenhum lead nesta etapa</p>
                </div>
              ) : (
                filteredChats.filter(c => c.status === mobileSelectedColumn).map(lead => (
                  <div 
                    key={lead.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
                  >
                    {/* Header do card com nome e ações */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{lead.client_name}</h4>
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                          <span className="material-symbols-outlined text-[12px]">call</span>
                          {lead.phone_number}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleShowLeadInfo(lead)}
                          className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600"
                        >
                          <span className="material-symbols-outlined text-[18px]">info</span>
                        </button>
                        <button
                          onClick={() => handleGoToChat(lead.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </button>
                        {smtpConfigured && lead.lead_id && leadsEmailMap[lead.lead_id] && (
                          <button
                            onClick={() => handleOpenEmailModal(lead)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600"
                          >
                            <span className="material-symbols-outlined text-[18px]">mail</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {lead.source_id && leadSourcesMap[lead.source_id] && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-black border flex items-center gap-1"
                          style={{ 
                            backgroundColor: `${leadSourcesMap[lead.source_id].color}15`, 
                            color: leadSourcesMap[lead.source_id].color, 
                            borderColor: `${leadSourcesMap[lead.source_id].color}40` 
                          }}
                        >
                          {leadSourcesMap[lead.source_id].icon && (
                            <span className="material-symbols-outlined text-[10px]">{leadSourcesMap[lead.source_id].icon}</span>
                          )}
                          {leadSourcesMap[lead.source_id].name}
                        </span>
                      )}
                      {campaignCodesMap[lead.id] && (!lead.source_id || !leadSourcesMap[lead.source_id]?.code || leadSourcesMap[lead.source_id].code !== campaignCodesMap[lead.id].code) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black border bg-violet-50 text-violet-700 border-violet-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">link</span>
                          {campaignCodesMap[lead.id].code}
                        </span>
                      )}
                      {lead.tags.map(tag => (
                        <span key={tag.id} className="px-1.5 py-0.5 rounded text-[9px] font-black border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Orçamentos */}
                    {quotesMap[lead.id]?.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {quotesMap[lead.id].map((q, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${
                              q.status === 'approved' 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`material-symbols-outlined text-[14px] ${q.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                                {q.status === 'approved' ? 'check_circle' : 'schedule'}
                              </span>
                              <span className={`truncate ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>{q.service_type}</span>
                            </div>
                            <span className={`font-black ml-2 flex-shrink-0 ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>
                              R$ {q.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer com tempo e seletor de etapa */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        {formatTimeAgo(lead.updated_at)}
                      </div>
                      {canMoveLead && (
                        <select
                          value={lead.status}
                          onChange={(e) => updateChatStatus(lead.id, e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-medium"
                        >
                          {columns.map(col => (
                            <option key={col} value={col}>{pipelineLabels[col]}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {/* Botão adicionar lead */}
              {canCreateLead && (
                <button 
                  onClick={() => setShowNewLeadModal(true)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50/50 border border-dashed border-slate-200 rounded-xl transition-all text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Adicionar Lead
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========== VERSÃO DESKTOP/TABLET - Kanban tradicional ========== */}
      {/* Scroll horizontal duplicado no topo */}
      <div 
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="hidden md:block overflow-x-auto overflow-y-hidden shrink-0 mb-2"
        style={{ height: '12px' }}
      >
        <div style={{ width: scrollWidth, height: '1px' }}></div>
      </div>

      <div 
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden gap-4 lg:gap-6 pb-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto mb-4"></div>
              <p className="text-slate-500">Carregando pipeline...</p>
            </div>
          </div>
        ) : columns.map(column => {
          const leadsInCol = filteredChats.filter(c => c.status === column);
          const config = columnConfig[column];

          return (
            <div 
              key={column} 
              className="w-[260px] md:w-[280px] lg:w-[320px] h-full flex flex-col shrink-0 pb-2"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column)}
            >
              <div className="flex items-center justify-between mb-3 md:mb-4 px-1 md:px-2 shrink-0">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className={`size-2 md:size-2.5 rounded-full bg-${config.color}-500`}></div>
                  <h3 className="font-black text-slate-700 uppercase text-[10px] md:text-[11px] tracking-widest truncate max-w-[100px] md:max-w-none">{pipelineLabels[column]}</h3>
                  <span className={`bg-${config.color}-50 text-${config.color}-700 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black`}>
                    {leadsInCol.length}
                  </span>
                  <span 
                    className="material-symbols-outlined text-slate-300 text-[12px] md:text-[14px] cursor-help hover:text-slate-400 hidden md:inline" 
                    title={pipelineLabels[column] || column}
                  >
                    info
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {canCreateLead && (
                    <button 
                      onClick={() => setShowNewLeadModal(true)}
                      className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors"
                      title="Adicionar Lead"
                    >
                      <span className="material-symbols-outlined text-[18px] md:text-[20px]">add</span>
                    </button>
                  )}
                  <button className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[18px] md:text-[20px]">more_horiz</span></button>
                </div>
              </div>

              <div className={`flex-1 min-h-0 overflow-y-auto space-y-3 md:space-y-4 pr-1 rounded-xl transition-colors ${draggedId ? 'bg-slate-100/50' : ''}`}>
                {leadsInCol.map(lead => (
                  <div 
                    key={lead.id} 
                    draggable={canMoveLead}
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    className={`bg-white p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-400 transition-all ${canMoveLead ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} group relative ${draggedId === lead.id ? 'opacity-50' : ''}`}
                  >
                    {/* Ícones de ação no topo */}
                    <div className="flex items-center justify-end gap-0.5 md:gap-1 mb-1.5 md:mb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowLeadInfo(lead); }}
                        className="p-1 md:p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors"
                        title="Informações do cliente"
                      >
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">info</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGoToChat(lead.id); }}
                        className="p-1 md:p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                        title="WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                      {smtpConfigured && lead.lead_id && leadsEmailMap[lead.lead_id] ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEmailModal(lead); }}
                          className="p-1 md:p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors"
                          title={`Enviar email para ${leadsEmailMap[lead.lead_id]}`}
                        >
                          <span className="material-symbols-outlined text-[14px] md:text-[16px]">mail</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-1 md:p-1.5 rounded-lg text-slate-300 cursor-not-allowed"
                          title={!smtpConfigured ? "Configure SMTP em Integrações" : "Lead sem email cadastrado"}
                        >
                          <span className="material-symbols-outlined text-[14px] md:text-[16px]">mail</span>
                        </button>
                      )}
                      <button
                        disabled
                        className="p-1 md:p-1.5 rounded-lg text-slate-300 cursor-not-allowed hidden md:block"
                        title="SMS - Em breve"
                      >
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">sms</span>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-start mb-2 md:mb-3">
                      <h4 className="font-bold text-slate-900 text-xs md:text-sm truncate pr-2 md:pr-4">{lead.client_name}</h4>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-slate-300 text-[16px] md:text-[18px]">drag_indicator</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 md:gap-1.5 text-slate-400 text-[10px] md:text-xs mb-3 md:mb-4">
                      <span className="material-symbols-outlined text-[12px] md:text-[14px]">call</span>
                      {lead.phone_number}
                    </div>

                    <div className="flex flex-wrap gap-1 md:gap-1.5 mb-3 md:mb-4">
                      {/* Fonte do lead (Meta Ads, Instagram, etc) */}
                      {lead.source_id && leadSourcesMap[lead.source_id] && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-black border flex items-center gap-1"
                          style={{ 
                            backgroundColor: `${leadSourcesMap[lead.source_id].color}15`, 
                            color: leadSourcesMap[lead.source_id].color, 
                            borderColor: `${leadSourcesMap[lead.source_id].color}40` 
                          }}
                          title={`Origem: ${leadSourcesMap[lead.source_id].name}`}
                        >
                          <span className="material-symbols-outlined text-[10px]">ads_click</span>
                          {leadSourcesMap[lead.source_id].code || leadSourcesMap[lead.source_id].name}
                        </span>
                      )}
                      {/* Código do link rastreável (se diferente da fonte) */}
                      {campaignCodesMap[lead.id] && (!lead.source_id || !leadSourcesMap[lead.source_id]?.code || leadSourcesMap[lead.source_id].code !== campaignCodesMap[lead.id].code) && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-black border bg-violet-50 text-violet-700 border-violet-200 flex items-center gap-1"
                          title={`Link: ${campaignCodesMap[lead.id].name}`}
                        >
                          <span className="material-symbols-outlined text-[10px]">link</span>
                          {campaignCodesMap[lead.id].code}
                        </span>
                      )}
                      {lead.tags.map(tag => (
                        <span key={tag.id} className="px-1 md:px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Orçamentos */}
                    {quotesMap[lead.id]?.length > 0 && (
                      <div className="mb-3 md:mb-4 space-y-1">
                        {quotesMap[lead.id].map((q, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-lg border ${
                              q.status === 'approved' 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-1 md:gap-1.5 truncate">
                              <span className={`material-symbols-outlined text-[12px] md:text-[14px] ${q.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                                {q.status === 'approved' ? 'check_circle' : 'schedule'}
                              </span>
                              <span className={`truncate ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>{q.service_type}</span>
                            </div>
                            <span className={`font-black ml-1 md:ml-2 flex-shrink-0 ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>
                              R$ {q.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {quotesMap[lead.id].length > 1 && (
                          <div className="flex items-center justify-between text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-600">Total</span>
                            <span className="font-black text-slate-700">
                              R$ {quotesMap[lead.id].reduce((sum, q) => sum + q.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">schedule</span> {formatTimeAgo(lead.updated_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        {canMoveLead && (
                          <select
                            value={lead.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateChatStatus(lead.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] md:text-xs bg-slate-50 border border-slate-200 rounded-lg px-1.5 md:px-2 py-0.5 md:py-1 text-slate-600 font-medium cursor-pointer hover:border-cyan-400 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          >
                            {columns.map(col => (
                              <option key={col} value={col}>{pipelineLabels[col]}</option>
                            ))}
                          </select>
                        )}
                        <img src={lead.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.client_name)}&background=0891b2&color=fff&size=32`} className="size-5 md:size-6 rounded-full border border-white shadow-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Gerenciar Etapas do Pipeline */}
      {showStagesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowStagesModal(false); setEditingStage(null); setStageForm({ label: '', color: '#3B82F6' }); }}>
          <div className="bg-white rounded-xl md:rounded-2xl shadow-xl w-full max-w-sm md:max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base md:text-lg text-slate-800">Gerenciar Etapas</h3>
              <button onClick={() => { setShowStagesModal(false); setEditingStage(null); setStageForm({ label: '', color: '#3B82F6' }); }} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
              {/* Lista de etapas existentes */}
              {stages.map((stage, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === stages.length - 1;
                const canMoveUp = !isFirst && stage.status_key !== 'Novo Lead' && stages[idx - 1]?.status_key !== 'Novo Lead';
                const canMoveDown = !isLast && stage.status_key !== 'Perdido' && stages[idx + 1]?.status_key !== 'Perdido';
                
                return (
                  <div key={stage.id} className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Setas de reordenação */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMoveStage(stage.id, 'up')}
                        disabled={!canMoveUp}
                        className={`p-0.5 rounded transition-colors ${canMoveUp ? 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50' : 'text-slate-200 cursor-not-allowed'}`}
                        title="Mover para cima"
                      >
                        <span className="material-symbols-outlined text-[14px]">keyboard_arrow_up</span>
                      </button>
                      <button
                        onClick={() => handleMoveStage(stage.id, 'down')}
                        disabled={!canMoveDown}
                        className={`p-0.5 rounded transition-colors ${canMoveDown ? 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50' : 'text-slate-200 cursor-not-allowed'}`}
                        title="Mover para baixo"
                      >
                        <span className="material-symbols-outlined text-[14px]">keyboard_arrow_down</span>
                      </button>
                    </div>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{stage.label}</p>
                      <p className="text-[10px] text-slate-400">{stage.status_key}{stage.is_system ? ' (obrigatória)' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingStage(stage);
                          setStageForm({ label: stage.label, color: stage.color });
                        }}
                        className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {!stage.is_system && (
                        <button
                          onClick={() => {
                            setStageToDelete(stage);
                            setMoveToStage(stages.find(s => s.status_key === 'Novo Lead')?.status_key || stages[0].status_key);
                            setShowDeleteStageModal(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulário criar/editar etapa */}
            <div className="p-4 md:p-5 border-t border-slate-100 shrink-0">
              <p className="text-xs font-bold text-slate-500 mb-2">{editingStage ? 'Editar Etapa' : 'Nova Etapa'}</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={stageForm.label}
                  onChange={(e) => setStageForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Nome da etapa"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {STAGE_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setStageForm(prev => ({ ...prev, color }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${stageForm.color === color ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {editingStage && (
                  <button
                    onClick={() => { setEditingStage(null); setStageForm({ label: '', color: '#3B82F6' }); }}
                    className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleSaveStage}
                  disabled={!stageForm.label.trim() || savingStage}
                  className="flex-1 py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingStage ? (
                    <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Salvando...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">{editingStage ? 'save' : 'add'}</span> {editingStage ? 'Salvar' : 'Criar Etapa'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Etapa */}
      {showDeleteStageModal && stageToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteStageModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600">delete</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir etapa</h3>
              <p className="text-slate-500 text-sm mb-4">
                A etapa <strong>"{stageToDelete.label}"</strong> será excluída. Para onde mover os leads desta etapa?
              </p>
              <select
                value={moveToStage}
                onChange={(e) => setMoveToStage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-red-500"
              >
                {stages.filter(s => s.id !== stageToDelete.id).map(s => (
                  <option key={s.id} value={s.status_key}>{s.label}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteStageModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDeleteStage} 
                  disabled={savingStage}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {savingStage ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informações do Cliente */}
      {showLeadInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLeadInfoModal(false)}>
          <div className="bg-white rounded-xl md:rounded-2xl shadow-xl w-full max-w-sm md:max-w-md max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-cyan-600 to-cyan-700">
              <h3 className="font-bold text-base md:text-lg text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">person</span>
                Informações do Cliente
              </h3>
              <button onClick={() => setShowLeadInfoModal(false)} className="text-white/70 hover:text-white">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>
            
            {loadingLeadInfo ? (
              <div className="p-8 md:p-10 flex items-center justify-center">
                <div className="size-8 border-3 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
              </div>
            ) : selectedLeadInfo && (
              <div className="p-4 md:p-5 overflow-y-auto max-h-[65vh]">
                {/* Avatar e Nome */}
                <div className="text-center mb-4 md:mb-6">
                  <img 
                    src={selectedLeadInfo.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLeadInfo.client_name)}&background=0891b2&color=fff&size=80`} 
                    className="size-16 md:size-20 rounded-full mx-auto mb-2 md:mb-3 border-4 border-slate-100 shadow-md"
                  />
                  <h4 className="font-bold text-lg md:text-xl text-slate-900">{selectedLeadInfo.client_name}</h4>
                  <p className="text-xs md:text-sm text-slate-500">{selectedLeadInfo.status}</p>
                </div>
                
                {/* Dados básicos */}
                <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                    <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">call</span>
                    <div>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Telefone</p>
                      <p className="text-xs md:text-sm font-medium text-slate-700">{selectedLeadInfo.phone_number || '-'}</p>
                    </div>
                  </div>
                  
                  {selectedLeadInfo.leadData?.email && (
                    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">mail</span>
                      <div>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Email</p>
                        <p className="text-xs md:text-sm font-medium text-slate-700 break-all">{selectedLeadInfo.leadData.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.cpf && (
                    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">badge</span>
                      <div>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">CPF</p>
                        <p className="text-xs md:text-sm font-medium text-slate-700">{selectedLeadInfo.leadData.cpf}</p>
                      </div>
                    </div>
                  )}
                  
                  {(selectedLeadInfo.leadData?.city || selectedLeadInfo.leadData?.state) && (
                    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">location_on</span>
                      <div>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Localização</p>
                        <p className="text-xs md:text-sm font-medium text-slate-700">
                          {[selectedLeadInfo.leadData.city, selectedLeadInfo.leadData.state].filter(Boolean).join(' - ')}
                          {selectedLeadInfo.leadData.zip_code && ` (${selectedLeadInfo.leadData.zip_code})`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.gender && (
                    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">wc</span>
                      <div>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Gênero</p>
                        <p className="text-xs md:text-sm font-medium text-slate-700">
                          {selectedLeadInfo.leadData.gender === 'm' ? 'Masculino' : selectedLeadInfo.leadData.gender === 'f' ? 'Feminino' : 'Outro'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.birth_date && (
                    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
                      <span className="material-symbols-outlined text-slate-400 text-[20px] md:text-[24px]">cake</span>
                      <div>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Data de Nascimento</p>
                        <p className="text-xs md:text-sm font-medium text-slate-700">
                          {new Date(selectedLeadInfo.leadData.birth_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Sem cadastro completo */}
                {!selectedLeadInfo.leadData && (
                  <div className="p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-lg md:rounded-xl text-center">
                    <span className="material-symbols-outlined text-amber-500 text-2xl md:text-3xl mb-2">info</span>
                    <p className="text-xs md:text-sm text-amber-700 font-medium">Cliente sem cadastro completo</p>
                    <p className="text-[10px] md:text-xs text-amber-600 mt-1">Acesse a conversa para cadastrar os dados</p>
                  </div>
                )}
                
                {/* Botões de ação */}
                <div className="flex gap-2 mt-4 md:mt-6">
                  <button
                    onClick={() => { setShowLeadInfoModal(false); handleGoToChat(selectedLeadInfo.id); }}
                    className="flex-1 py-2.5 md:py-3 bg-green-600 text-white text-xs md:text-sm font-bold rounded-lg md:rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">chat</span>
                    Ir para Conversa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo Lead */}
      {showNewLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewLeadModal(false)}>
          <div className="bg-white rounded-xl md:rounded-2xl shadow-xl w-full max-w-sm md:max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-base md:text-lg text-slate-800">Novo Lead</h3>
              <button onClick={() => setShowNewLeadModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>
            <div className="p-4 md:p-5 space-y-3 md:space-y-4">
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-slate-600 mb-1 md:mb-1.5">Nome do Cliente</label>
                <input
                  type="text"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-slate-200 rounded-lg md:rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-slate-600 mb-1 md:mb-1.5">Telefone (WhatsApp)</label>
                <input
                  type="text"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-slate-200 rounded-lg md:rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
                <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">Formato: código do país + DDD + número</p>
              </div>
              <button
                onClick={handleCreateLead}
                disabled={!newLeadForm.name.trim() || !newLeadForm.phone.trim() || savingLead}
                className="w-full py-2.5 md:py-3 bg-cyan-600 text-white text-xs md:text-sm font-bold rounded-lg md:rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLead ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">person_add</span>
                    Criar Lead
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Email */}
      {showEmailModal && emailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEmailModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm md:max-w-md rounded-xl md:rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-violet-600">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[20px] md:text-[24px]">mail</span>
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold text-white">Enviar Email</h3>
                  <p className="text-purple-100 text-xs md:text-sm">Para: {emailTarget.leadName}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 md:p-6 space-y-3 md:space-y-4">
              <div className="bg-slate-50 rounded-lg p-2.5 md:p-3 border border-slate-200">
                <p className="text-[10px] md:text-xs text-slate-500 mb-1">Destinatário:</p>
                <p className="text-xs md:text-sm font-medium text-slate-700 break-all">{emailTarget.leadEmail}</p>
              </div>
              
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">Template *</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="">Selecione um template</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedTemplateId && (
                <div className="bg-purple-50 rounded-lg p-2.5 md:p-3 border border-purple-200">
                  <p className="text-[10px] md:text-xs text-purple-500 mb-1">Assunto:</p>
                  <p className="text-xs md:text-sm font-medium text-purple-700">
                    {emailTemplates.find(t => t.id === selectedTemplateId)?.subject
                      .replace('{{lead_name}}', emailTarget.leadName || 'Cliente')
                      .replace('{{clinic_name}}', state.selectedClinic?.name || '')}
                  </p>
                </div>
              )}

              {emailTemplates.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4 text-center">
                  <span className="material-symbols-outlined text-amber-500 text-xl md:text-2xl mb-2">warning</span>
                  <p className="text-xs md:text-sm text-amber-700">Nenhum template de email encontrado.</p>
                  <p className="text-[10px] md:text-xs text-amber-600 mt-1">Crie templates em Email Marketing.</p>
                </div>
              )}
            </div>
            
            <div className="p-3 md:p-4 border-t border-slate-100 flex justify-end gap-2 md:gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-3 md:px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium text-xs md:text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!selectedTemplateId || sendingEmail}
                className="px-4 md:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm"
              >
                {sendingEmail ? (
                  <>
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">send</span>
                    Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Kanban;
