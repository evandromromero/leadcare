
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobalState } from '../types';
import { useChats } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { hasPermission } from '../lib/permissions';

interface KanbanProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

type ChatStatus = 'Novo Lead' | 'Em Atendimento' | 'Agendado' | 'Convertido' | 'Recorrente' | 'Mentoria' | 'Perdido';

// Labels padrão para as colunas do pipeline
const DEFAULT_LABELS: Record<ChatStatus, string> = {
  'Novo Lead': 'Novos',
  'Em Atendimento': 'Atendimento',
  'Agendado': 'Agendados',
  'Convertido': 'Ganhos',
  'Recorrente': 'Recorrentes',
  'Mentoria': 'Mentoria',
  'Perdido': 'Perdidos',
};

// Hints para tooltip de ajuda
const STAGE_HINTS: Record<ChatStatus, string> = {
  'Novo Lead': 'Lead que acabou de entrar em contato',
  'Em Atendimento': 'Em negociação ou atendimento ativo',
  'Agendado': 'Consulta ou procedimento agendado',
  'Convertido': 'Fechou negócio / realizou procedimento',
  'Recorrente': 'Paciente que já é da clínica e retornou',
  'Mentoria': 'Lead interessado em mentoria/consultoria',
  'Perdido': 'Não fechou / desistiu do atendimento',
};

const Kanban: React.FC<KanbanProps> = ({ state, setState }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, updateChatStatus, refetch } = useChats(clinicId, user?.id);
  const columns: ChatStatus[] = ['Novo Lead', 'Em Atendimento', 'Agendado', 'Convertido', 'Recorrente', 'Mentoria', 'Perdido'];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, Array<{ service_type: string; value: number; status: string }>>>({});
  
  const canMoveLead = hasPermission(user?.role, 'move_lead');
  const canCreateLead = hasPermission(user?.role, 'create_lead');
  const canEditPipelineLabels = hasPermission(user?.role, 'edit_pipeline_labels');
  
  // Estados para modal de novo lead
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '' });
  const [savingLead, setSavingLead] = useState(false);
  
  // Estados para labels personalizados do pipeline
  const [pipelineLabels, setPipelineLabels] = useState<Record<string, string>>(DEFAULT_LABELS);
  const [showEditLabelsModal, setShowEditLabelsModal] = useState(false);
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});
  const [savingLabels, setSavingLabels] = useState(false);
  
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
  
  // Estados para envio de email
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string; html_content: string }>>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<{ leadId: string; leadName: string; leadEmail: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [leadsEmailMap, setLeadsEmailMap] = useState<Record<string, string>>({});

  // Recarregar chats quando o componente é montado
  useEffect(() => {
    refetch();
  }, []);

  // Buscar labels personalizados do pipeline
  useEffect(() => {
    const fetchPipelineLabels = async () => {
      if (!clinicId) return;
      
      try {
        const { data } = await supabase
          .from('pipeline_settings' as any)
          .select('status_key, label')
          .eq('clinic_id', clinicId);
        
        if (data && data.length > 0) {
          const customLabels: Record<string, string> = { ...DEFAULT_LABELS };
          (data as any[]).forEach(item => {
            customLabels[item.status_key] = item.label;
          });
          setPipelineLabels(customLabels);
        }
      } catch (err) {
        console.error('Error fetching pipeline labels:', err);
      }
    };
    
    fetchPipelineLabels();
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

  // Salvar labels personalizados
  const handleSaveLabels = async () => {
    if (!clinicId) return;
    
    setSavingLabels(true);
    try {
      // Upsert para cada label
      for (const [statusKey, label] of Object.entries(editingLabels)) {
        await supabase
          .from('pipeline_settings' as any)
          .upsert({
            clinic_id: clinicId,
            status_key: statusKey,
            label: label,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'clinic_id,status_key' });
      }
      
      setPipelineLabels(editingLabels);
      setShowEditLabelsModal(false);
    } catch (err) {
      console.error('Error saving pipeline labels:', err);
    } finally {
      setSavingLabels(false);
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

  const columnConfig: Record<ChatStatus, { color: string }> = {
    'Novo Lead': { color: 'blue' },
    'Em Atendimento': { color: 'orange' },
    'Agendado': { color: 'purple' },
    'Convertido': { color: 'green' },
    'Recorrente': { color: 'cyan' },
    'Mentoria': { color: 'yellow' },
    'Perdido': { color: 'red' },
  };

  const moveLead = async (id: string, newStage: ChatStatus) => {
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

  // Chats filtrados por período e busca
  const filteredChats = chats.filter(chat => filterByPeriod(chat) && filterBySearch(chat));

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

  const onDrop = (e: React.DragEvent, newStage: ChatStatus) => {
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
    <div className="p-8 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pipeline de Leads</h1>
          <p className="text-slate-500">Arraste e solte os leads para atualizar o status.</p>
        </div>
        <div className="flex items-center gap-3">
           {canEditPipelineLabels && (
           <button 
              onClick={() => {
                setEditingLabels({ ...pipelineLabels });
                setShowEditLabelsModal(true);
              }}
              className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Editar nomes das etapas"
           >
              <span className="material-symbols-outlined text-[20px]">settings</span>
           </button>
           )}
           <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Buscar por nome ou telefone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" 
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
           </div>
           {canCreateLead && (
           <button 
              onClick={() => setShowNewLeadModal(true)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm h-10 px-6 rounded-lg shadow-lg shadow-cyan-500/30 flex items-center gap-2"
           >
              <span className="material-symbols-outlined text-[20px]">add</span> Novo Lead
           </button>
           )}
        </div>
      </div>

      {/* Filtros de período */}
      <div className="flex items-center gap-2 mb-4 shrink-0 flex-wrap">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-2">Período:</span>
        <button
          onClick={() => { setPeriodFilter('all'); setShowDatePicker(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            periodFilter === 'all' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => { setPeriodFilter('today'); setShowDatePicker(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            periodFilter === 'today' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => { setPeriodFilter('7d'); setShowDatePicker(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            periodFilter === '7d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          7 dias
        </button>
        <button
          onClick={() => { setPeriodFilter('15d'); setShowDatePicker(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            periodFilter === '15d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          15 dias
        </button>
        <button
          onClick={() => { setPeriodFilter('30d'); setShowDatePicker(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            periodFilter === '30d' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          30 dias
        </button>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
            periodFilter === 'custom' 
              ? 'bg-cyan-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">calendar_month</span>
          Personalizado
        </button>
        
        {/* Date picker para período personalizado */}
        {showDatePicker && (
          <div className="flex items-center gap-2 ml-2 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => setCustomDateStart(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-xs"
            />
            <span className="text-slate-400 text-xs">até</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => setCustomDateEnd(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-xs"
            />
            <button
              onClick={() => {
                if (customDateStart && customDateEnd) {
                  setPeriodFilter('custom');
                }
              }}
              disabled={!customDateStart || !customDateEnd}
              className="px-3 py-1 bg-cyan-600 text-white rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-700"
            >
              Aplicar
            </button>
          </div>
        )}
        
        {/* Contador de leads filtrados */}
        <span className="ml-auto text-xs text-slate-400">
          {filteredChats.length} lead{filteredChats.length !== 1 ? 's' : ''} encontrado{filteredChats.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-6 pb-6 no-scrollbar">
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
              className="w-[320px] flex flex-col shrink-0"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column)}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full bg-${config.color}-500`}></div>
                  <h3 className="font-black text-slate-700 uppercase text-[11px] tracking-widest">{pipelineLabels[column]}</h3>
                  <span className={`bg-${config.color}-50 text-${config.color}-700 px-2 py-0.5 rounded-full text-[10px] font-black`}>
                    {leadsInCol.length}
                  </span>
                  <span 
                    className="material-symbols-outlined text-slate-300 text-[14px] cursor-help hover:text-slate-400" 
                    title={STAGE_HINTS[column]}
                  >
                    info
                  </span>
                </div>
                <button className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">more_horiz</span></button>
              </div>

              <div className={`flex-1 overflow-y-auto space-y-4 pr-1 rounded-xl transition-colors ${draggedId ? 'bg-slate-100/50' : ''}`}>
                {leadsInCol.map(lead => (
                  <div 
                    key={lead.id} 
                    draggable={canMoveLead}
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-400 transition-all ${canMoveLead ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} group relative ${draggedId === lead.id ? 'opacity-50' : ''}`}
                  >
                    {/* Ícones de ação no topo */}
                    <div className="flex items-center justify-end gap-1 mb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowLeadInfo(lead); }}
                        className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors"
                        title="Informações do cliente"
                      >
                        <span className="material-symbols-outlined text-[16px]">info</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGoToChat(lead.id); }}
                        className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                        title="WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                      {smtpConfigured && lead.lead_id && leadsEmailMap[lead.lead_id] ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEmailModal(lead); }}
                          className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors"
                          title={`Enviar email para ${leadsEmailMap[lead.lead_id]}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">mail</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed"
                          title={!smtpConfigured ? "Configure SMTP em Integrações" : "Lead sem email cadastrado"}
                        >
                          <span className="material-symbols-outlined text-[16px]">mail</span>
                        </button>
                      )}
                      <button
                        disabled
                        className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed"
                        title="SMS - Em breve"
                      >
                        <span className="material-symbols-outlined text-[16px]">sms</span>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-900 text-sm truncate pr-4">{lead.client_name}</h4>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="material-symbols-outlined text-slate-300 text-[18px]">drag_indicator</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-4">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      {lead.phone_number}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {lead.tags.map(tag => (
                        <span key={tag.id} className="px-1.5 py-0.5 rounded text-[9px] font-black border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Orçamentos */}
                    {quotesMap[lead.id]?.length > 0 && (
                      <div className="mb-4 space-y-1">
                        {quotesMap[lead.id].map((q, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border ${
                              q.status === 'approved' 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`material-symbols-outlined text-[14px] ${q.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                                {q.status === 'approved' ? 'check_circle' : 'schedule'}
                              </span>
                              <span className={q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}>{q.service_type}</span>
                            </div>
                            <span className={`font-black ml-2 ${q.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>
                              R$ {q.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {quotesMap[lead.id].length > 1 && (
                          <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-600">Total</span>
                            <span className="font-black text-slate-700">
                              R$ {quotesMap[lead.id].reduce((sum, q) => sum + q.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> {formatTimeAgo(lead.updated_at)}
                      </div>
                      <img src={lead.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.client_name)}&background=0891b2&color=fff&size=32`} className="size-6 rounded-full border border-white shadow-sm" />
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => setShowNewLeadModal(true)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50/50 border border-dashed border-slate-200 rounded-2xl transition-all text-sm font-medium"
                >
                   <span className="material-symbols-outlined text-[18px]">add</span> Adicionar Lead
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Editar Labels do Pipeline */}
      {showEditLabelsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditLabelsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Editar Etapas do Pipeline</h3>
              <button onClick={() => setShowEditLabelsModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {columns.map(column => (
                <div key={column}>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{column}</label>
                  <input
                    type="text"
                    value={editingLabels[column] || ''}
                    onChange={(e) => setEditingLabels(prev => ({ ...prev, [column]: e.target.value }))}
                    placeholder={DEFAULT_LABELS[column]}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                  />
                </div>
              ))}
              <button
                onClick={handleSaveLabels}
                disabled={savingLabels}
                className="w-full py-3 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLabels ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informações do Cliente */}
      {showLeadInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLeadInfoModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-cyan-600 to-cyan-700">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span className="material-symbols-outlined">person</span>
                Informações do Cliente
              </h3>
              <button onClick={() => setShowLeadInfoModal(false)} className="text-white/70 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {loadingLeadInfo ? (
              <div className="p-10 flex items-center justify-center">
                <div className="size-8 border-3 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
              </div>
            ) : selectedLeadInfo && (
              <div className="p-5 overflow-y-auto max-h-[60vh]">
                {/* Avatar e Nome */}
                <div className="text-center mb-6">
                  <img 
                    src={selectedLeadInfo.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLeadInfo.client_name)}&background=0891b2&color=fff&size=80`} 
                    className="size-20 rounded-full mx-auto mb-3 border-4 border-slate-100 shadow-md"
                  />
                  <h4 className="font-bold text-xl text-slate-900">{selectedLeadInfo.client_name}</h4>
                  <p className="text-sm text-slate-500">{selectedLeadInfo.status}</p>
                </div>
                
                {/* Dados básicos */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <span className="material-symbols-outlined text-slate-400">call</span>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone</p>
                      <p className="text-sm font-medium text-slate-700">{selectedLeadInfo.phone_number || '-'}</p>
                    </div>
                  </div>
                  
                  {selectedLeadInfo.leadData?.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400">mail</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                        <p className="text-sm font-medium text-slate-700">{selectedLeadInfo.leadData.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.cpf && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400">badge</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">CPF</p>
                        <p className="text-sm font-medium text-slate-700">{selectedLeadInfo.leadData.cpf}</p>
                      </div>
                    </div>
                  )}
                  
                  {(selectedLeadInfo.leadData?.city || selectedLeadInfo.leadData?.state) && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400">location_on</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Localização</p>
                        <p className="text-sm font-medium text-slate-700">
                          {[selectedLeadInfo.leadData.city, selectedLeadInfo.leadData.state].filter(Boolean).join(' - ')}
                          {selectedLeadInfo.leadData.zip_code && ` (${selectedLeadInfo.leadData.zip_code})`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.gender && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400">wc</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Gênero</p>
                        <p className="text-sm font-medium text-slate-700">
                          {selectedLeadInfo.leadData.gender === 'm' ? 'Masculino' : selectedLeadInfo.leadData.gender === 'f' ? 'Feminino' : 'Outro'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLeadInfo.leadData?.birth_date && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="material-symbols-outlined text-slate-400">cake</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Data de Nascimento</p>
                        <p className="text-sm font-medium text-slate-700">
                          {new Date(selectedLeadInfo.leadData.birth_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Sem cadastro completo */}
                {!selectedLeadInfo.leadData && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <span className="material-symbols-outlined text-amber-500 text-3xl mb-2">info</span>
                    <p className="text-sm text-amber-700 font-medium">Cliente sem cadastro completo</p>
                    <p className="text-xs text-amber-600 mt-1">Acesse a conversa para cadastrar os dados</p>
                  </div>
                )}
                
                {/* Botões de ação */}
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => { setShowLeadInfoModal(false); handleGoToChat(selectedLeadInfo.id); }}
                    className="flex-1 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewLeadModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Novo Lead</h3>
              <button onClick={() => setShowNewLeadModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nome do Cliente</label>
                <input
                  type="text"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Telefone (WhatsApp)</label>
                <input
                  type="text"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
                />
                <p className="text-[10px] text-slate-400 mt-1">Formato: código do país + DDD + número</p>
              </div>
              <button
                onClick={handleCreateLead}
                disabled={!newLeadForm.name.trim() || !newLeadForm.phone.trim() || savingLead}
                className="w-full py-3 bg-cyan-600 text-white text-sm font-bold rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLead ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
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
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-violet-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">mail</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Enviar Email</h3>
                  <p className="text-purple-100 text-sm">Para: {emailTarget.leadName}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Destinatário:</p>
                <p className="text-sm font-medium text-slate-700">{emailTarget.leadEmail}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Selecione um template</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedTemplateId && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-500 mb-1">Assunto:</p>
                  <p className="text-sm font-medium text-purple-700">
                    {emailTemplates.find(t => t.id === selectedTemplateId)?.subject
                      .replace('{{lead_name}}', emailTarget.leadName || 'Cliente')
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
                disabled={!selectedTemplateId || sendingEmail}
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
    </div>
  );
};

export default Kanban;
