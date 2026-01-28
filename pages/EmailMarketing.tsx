import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  json_content: any;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailCampaign {
  id: string;
  name: string;
  template_id: string | null;
  target_type: 'all' | 'stage' | 'source' | 'tag' | 'custom';
  target_stage_id: string | null;
  target_source_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
  template?: EmailTemplate;
}

interface PipelineStage {
  id: string;
  status_key: string;
  label: string;
  color: string;
}

interface LeadSource {
  id: string;
  name: string;
  color: string;
}

interface EmailLimits {
  email_daily_limit: number;
  email_sent_today: number;
  email_batch_size: number;
}

const categoryLabels: Record<string, string> = {
  welcome: 'Boas-vindas',
  reminder: 'Lembrete',
  promotion: 'Promoção',
  reengagement: 'Reengajamento',
  feedback: 'Feedback',
  general: 'Geral',
};

const categoryColors: Record<string, string> = {
  welcome: 'bg-green-100 text-green-700',
  reminder: 'bg-amber-100 text-amber-700',
  promotion: 'bg-purple-100 text-purple-700',
  reengagement: 'bg-blue-100 text-blue-700',
  feedback: 'bg-cyan-100 text-cyan-700',
  general: 'bg-slate-100 text-slate-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'Enviando',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function EmailMarketing() {
  const { user, isImpersonating, impersonatedClinic } = useAuth();
  const clinicId = isImpersonating ? impersonatedClinic?.id : user?.clinicId;
  
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [defaultTemplates, setDefaultTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [limits, setLimits] = useState<EmailLimits>({ email_daily_limit: 100, email_sent_today: 0, email_batch_size: 50 });
  
  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [templateEditorTab, setTemplateEditorTab] = useState<'visual' | 'code'>('visual');
  
  // Modais de confirmação e input (substituindo alert/confirm/prompt)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'template' | 'campaign'; id: string; name: string } | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState<{
    title: string;
    fields: { key: string; label: string; placeholder: string; value: string }[];
    onConfirm: (values: Record<string, string>) => void;
  } | null>(null);
  
  // Modal de Email Único
  const [showSingleEmailModal, setShowSingleEmailModal] = useState(false);
  const [singleEmailForm, setSingleEmailForm] = useState({
    template_id: '',
    recipient_email: '',
    recipient_name: '',
  });
  const [sendingSingleEmail, setSendingSingleEmail] = useState(false);
  
  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    category: 'general',
    html_content: '',
  });
  
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    template_id: '',
    target_type: 'all' as 'all' | 'stage' | 'source' | 'custom',
    target_stage_id: '',
    target_source_id: '',
    scheduled_at: '',
  });

  useEffect(() => {
    if (clinicId) {
      fetchData();
    }
  }, [clinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch templates
      const { data: templatesData } = await (supabase as any)
        .from('email_templates')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      
      setTemplates(templatesData || []);

      // Fetch campaigns with template info
      const { data: campaignsData } = await (supabase as any)
        .from('email_campaigns')
        .select('*, template:email_templates(id, name, subject)')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      
      setCampaigns(campaignsData || []);

      // Fetch pipeline stages
      const { data: stagesData } = await (supabase as any)
        .from('pipeline_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('position');
      
      setStages(stagesData || []);

      // Fetch lead sources
      const { data: sourcesData } = await (supabase as any)
        .from('lead_sources')
        .select('*')
        .eq('clinic_id', clinicId);
      
      setSources(sourcesData || []);

      // Fetch email limits
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('email_daily_limit, email_sent_today, email_batch_size')
        .eq('id', clinicId)
        .single();
      
      if (clinicData) {
        setLimits(clinicData);
      }

      // Fetch default templates
      const { data: defaultTemplatesData } = await (supabase as any)
        .from('email_templates_default')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      setDefaultTemplates(defaultTemplatesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const handleSaveTemplate = async () => {
    if (!clinicId || !templateForm.name || !templateForm.subject) return;

    try {
      if (editingTemplate) {
        await (supabase as any)
          .from('email_templates')
          .update({
            name: templateForm.name,
            subject: templateForm.subject,
            category: templateForm.category,
            html_content: templateForm.html_content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);
      } else {
        await (supabase as any)
          .from('email_templates')
          .insert({
            clinic_id: clinicId,
            name: templateForm.name,
            subject: templateForm.subject,
            category: templateForm.category,
            html_content: templateForm.html_content || getDefaultTemplate(),
            created_by: user?.id,
          });
      }

      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', subject: '', category: 'general', html_content: '' });
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
    }
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    setDeleteTarget({ type: 'template', id, name });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'template') {
        await (supabase as any)
          .from('email_templates')
          .delete()
          .eq('id', deleteTarget.id);
      } else {
        await (supabase as any)
          .from('email_campaigns')
          .delete()
          .eq('id', deleteTarget.id);
      }
      
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
    
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleUseDefaultTemplate = async (defaultTemplate: EmailTemplate) => {
    if (!clinicId) return;

    try {
      await (supabase as any)
        .from('email_templates')
        .insert({
          clinic_id: clinicId,
          name: defaultTemplate.name,
          subject: defaultTemplate.subject,
          html_content: defaultTemplate.html_content,
          category: defaultTemplate.category,
          created_by: user?.id,
        });

      fetchData();
      setActiveTab('templates');
    } catch (error) {
      console.error('Erro ao usar template:', error);
    }
  };

  const handleSendSingleEmail = async () => {
    if (!clinicId || !singleEmailForm.template_id || !singleEmailForm.recipient_email) return;

    setSendingSingleEmail(true);
    try {
      const template = templates.find(t => t.id === singleEmailForm.template_id);
      if (!template) throw new Error('Template não encontrado');

      // Buscar dados da clínica
      const { data: clinicData } = await (supabase as any)
        .from('clinics')
        .select('name, email, phone')
        .eq('id', clinicId)
        .single();

      // Substituir variáveis no template
      let htmlContent = template.html_content;
      let subject = template.subject;
      
      const variables: Record<string, string> = {
        '{{lead_name}}': singleEmailForm.recipient_name || 'Cliente',
        '{{clinic_name}}': clinicData?.name || '',
        '{{clinic_email}}': clinicData?.email || '',
        '{{clinic_phone}}': clinicData?.phone || '',
        '{{unsubscribe_url}}': '#',
      };

      Object.entries(variables).forEach(([key, value]) => {
        htmlContent = htmlContent.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      });

      // Chamar edge function para enviar email
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: singleEmailForm.recipient_email,
          subject: subject,
          html: htmlContent,
          clinic_id: clinicId,
        }
      });

      if (error) throw error;

      setShowSingleEmailModal(false);
      setSingleEmailForm({ template_id: '', recipient_email: '', recipient_name: '' });
      
      // Mostrar sucesso
      setInputModalConfig({
        title: '✅ Email Enviado!',
        fields: [],
        onConfirm: () => {}
      });
      setShowInputModal(true);
      setTimeout(() => setShowInputModal(false), 2000);
      
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      setInputModalConfig({
        title: '❌ Erro ao enviar email',
        fields: [{ key: 'error', label: 'Detalhes', placeholder: '', value: String(error) }],
        onConfirm: () => {}
      });
      setShowInputModal(true);
    } finally {
      setSendingSingleEmail(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!clinicId || !campaignForm.name || !campaignForm.template_id) return;

    try {
      const campaignData = {
        clinic_id: clinicId,
        name: campaignForm.name,
        template_id: campaignForm.template_id,
        target_type: campaignForm.target_type,
        target_stage_id: campaignForm.target_type === 'stage' ? campaignForm.target_stage_id : null,
        target_source_id: campaignForm.target_type === 'source' ? campaignForm.target_source_id : null,
        scheduled_at: campaignForm.scheduled_at || null,
        status: campaignForm.scheduled_at ? 'scheduled' : 'draft',
        created_by: user?.id,
      };

      if (editingCampaign) {
        await (supabase as any)
          .from('email_campaigns')
          .update({ ...campaignData, updated_at: new Date().toISOString() })
          .eq('id', editingCampaign.id);
      } else {
        await (supabase as any)
          .from('email_campaigns')
          .insert(campaignData);
      }

      setShowCampaignModal(false);
      setEditingCampaign(null);
      setCampaignForm({ name: '', template_id: '', target_type: 'all', target_stage_id: '', target_source_id: '', scheduled_at: '' });
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
    }
  };

  const handleDeleteCampaign = (id: string, name: string) => {
    setDeleteTarget({ type: 'campaign', id, name });
    setShowDeleteModal(true);
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      category: template.category,
      html_content: template.html_content,
    });
    setShowTemplateModal(true);
  };

  const openEditCampaign = (campaign: EmailCampaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      template_id: campaign.template_id || '',
      target_type: campaign.target_type,
      target_stage_id: campaign.target_stage_id || '',
      target_source_id: campaign.target_source_id || '',
      scheduled_at: campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '',
    });
    setShowCampaignModal(true);
  };

  const getDefaultTemplate = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">{{clinic_name}}</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        Olá <strong>{{lead_name}}</strong>,
      </p>
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        Escreva sua mensagem aqui...
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" style="display: inline-block; background: #9333ea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Saiba Mais
        </a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        © {{clinic_name}} - Todos os direitos reservados
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
        <a href="{{unsubscribe_url}}" style="color: #94a3b8;">Cancelar inscrição</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  };

  const remainingEmails = limits.email_daily_limit - limits.email_sent_today;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Email Marketing</h1>
            <p className="text-slate-500">Crie campanhas e envie emails em massa para seus leads</p>
          </div>
          
          {/* Limite diário */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-600">mail</span>
              </div>
              <div>
                <p className="text-sm text-slate-500">Limite diário</p>
                <p className="text-lg font-bold text-slate-800">
                  <span className={remainingEmails > 20 ? 'text-emerald-600' : remainingEmails > 0 ? 'text-amber-600' : 'text-red-600'}>
                    {remainingEmails}
                  </span>
                  <span className="text-slate-400 font-normal"> / {limits.email_daily_limit}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'campaigns'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] align-middle mr-2">campaign</span>
                Campanhas
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] align-middle mr-2">article</span>
                Templates
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Campanhas Tab */}
            {activeTab === 'campaigns' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Suas Campanhas</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSingleEmailForm({ template_id: '', recipient_email: '', recipient_name: '' });
                        setShowSingleEmailModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Email Único
                    </button>
                    <button
                      onClick={() => {
                        setEditingCampaign(null);
                        setCampaignForm({ name: '', template_id: '', target_type: 'all', target_stage_id: '', target_source_id: '', scheduled_at: '' });
                        setShowCampaignModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Nova Campanha
                    </button>
                  </div>
                </div>

                {campaigns.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">campaign</span>
                    <p className="text-slate-500">Nenhuma campanha criada ainda</p>
                    <p className="text-sm text-slate-400 mt-1">Crie sua primeira campanha de email</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="bg-slate-50 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                            <span className="material-symbols-outlined text-purple-600">campaign</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-800">{campaign.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[campaign.status]}`}>
                                {statusLabels[campaign.status]}
                              </span>
                              {campaign.template && (
                                <span className="text-xs text-slate-500">
                                  Template: {campaign.template.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          {/* Métricas */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-slate-400">Enviados</p>
                              <p className="font-bold text-slate-700">{campaign.sent_count}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Abertos</p>
                              <p className="font-bold text-emerald-600">{campaign.opened_count}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Cliques</p>
                              <p className="font-bold text-blue-600">{campaign.clicked_count}</p>
                            </div>
                          </div>
                          
                          {/* Ações */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditCampaign(campaign)}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Seus Templates</h2>
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateForm({ name: '', subject: '', category: 'general', html_content: '' });
                      setShowTemplateModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Novo Template
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">article</span>
                    <p className="text-slate-500">Nenhum template criado ainda</p>
                    <p className="text-sm text-slate-400 mt-1">Crie seu primeiro template de email</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-300 transition-colors"
                      >
                        <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-4xl text-purple-300">mail</span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-slate-800">{template.name}</h3>
                              <p className="text-sm text-slate-500 truncate">{template.subject}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[template.category]}`}>
                              {categoryLabels[template.category]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            <button
                              onClick={() => openEditTemplate(template)}
                              className="flex-1 px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template.id, template.name)}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Templates Prontos */}
                {defaultTemplates.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">Templates Prontos</h3>
                        <p className="text-sm text-slate-500">Clique para adicionar à sua biblioteca</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {defaultTemplates.map((dt) => {
                        const alreadyAdded = templates.some(t => t.name === dt.name && t.category === dt.category);
                        const categoryIcons: Record<string, string> = {
                          welcome: 'waving_hand',
                          reminder: 'schedule',
                          promotion: 'local_offer',
                          reengagement: 'favorite',
                          feedback: 'rate_review',
                          general: 'mail',
                        };
                        const categoryGradients: Record<string, string> = {
                          welcome: 'from-green-500 to-emerald-600',
                          reminder: 'from-amber-500 to-orange-600',
                          promotion: 'from-purple-500 to-violet-600',
                          reengagement: 'from-blue-500 to-indigo-600',
                          feedback: 'from-cyan-500 to-teal-600',
                          general: 'from-slate-500 to-slate-600',
                        };
                        return (
                          <div
                            key={dt.id}
                            className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                              alreadyAdded 
                                ? 'border-slate-200 opacity-60' 
                                : 'border-slate-200 hover:border-purple-300 hover:shadow-lg'
                            }`}
                          >
                            <div className={`h-24 bg-gradient-to-br ${categoryGradients[dt.category]} flex items-center justify-center relative`}>
                              <span className="material-symbols-outlined text-5xl text-white/80">{categoryIcons[dt.category]}</span>
                              {alreadyAdded && (
                                <div className="absolute top-2 right-2 bg-white/90 text-green-600 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  Adicionado
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold text-slate-800">{dt.name}</h4>
                                  <p className="text-xs text-slate-500 mt-0.5">{dt.subject}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[dt.category]}`}>
                                  {categoryLabels[dt.category]}
                                </span>
                              </div>
                              {!alreadyAdded ? (
                                <button
                                  onClick={() => handleUseDefaultTemplate(dt as any)}
                                  className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg hover:from-purple-700 hover:to-violet-700 transition-all text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[18px]">add</span>
                                  Usar este Template
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full mt-3 px-4 py-2.5 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed"
                                >
                                  Já adicionado
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Variáveis disponíveis */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Variáveis Disponíveis</h3>
          <p className="text-sm text-slate-500 mb-4">Use estas variáveis nos seus templates para personalizar os emails:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { var: '{{lead_name}}', desc: 'Nome do lead' },
              { var: '{{lead_email}}', desc: 'Email do lead' },
              { var: '{{lead_phone}}', desc: 'Telefone do lead' },
              { var: '{{lead_source}}', desc: 'Origem do lead' },
              { var: '{{clinic_name}}', desc: 'Nome da clínica' },
              { var: '{{clinic_phone}}', desc: 'Telefone da clínica' },
              { var: '{{clinic_email}}', desc: 'Email da clínica' },
              { var: '{{unsubscribe_url}}', desc: 'Link de descadastro' },
            ].map((v) => (
              <div key={v.var} className="p-3 bg-slate-50 rounded-lg">
                <code className="text-sm font-mono text-purple-600">{v.var}</code>
                <p className="text-xs text-slate-500 mt-1">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Template - Versão Melhorada */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)}></div>
          <div className="relative bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Campos básicos */}
            <div className="p-4 border-b border-slate-100 flex-shrink-0 bg-slate-50">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Template *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Ex: Boas-vindas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Assunto do Email *</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    placeholder="Ex: Bem-vindo à {{clinic_name}}!"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  >
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Abas Visual/Código */}
            <div className="border-b border-slate-200 flex-shrink-0 flex items-center justify-between px-4">
              <div className="flex">
                <button
                  onClick={() => setTemplateEditorTab('visual')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    templateEditorTab === 'visual'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  Editor Visual
                </button>
                <button
                  onClick={() => setTemplateEditorTab('code')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    templateEditorTab === 'code'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">code</span>
                  Código HTML
                </button>
              </div>
              {/* Variáveis */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Inserir:</span>
                {[
                  { var: '{{lead_name}}', label: 'Nome', icon: 'person' },
                  { var: '{{clinic_name}}', label: 'Clínica', icon: 'business' },
                  { var: '{{unsubscribe_url}}', label: 'Descadastro', icon: 'link_off' },
                ].map((v) => (
                  <button
                    key={v.var}
                    onClick={() => {
                      if (templateEditorTab === 'visual') {
                        document.execCommand('insertText', false, v.var);
                      } else {
                        setTemplateForm({ ...templateForm, html_content: templateForm.html_content + v.var });
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title={`Inserir ${v.label}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{v.icon}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Conteúdo das abas */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {templateEditorTab === 'visual' ? (
                <>
                  {/* Barra de ferramentas de formatação */}
                  <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 flex-wrap">
                    {/* Desfazer/Refazer */}
                    <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
                      <button
                        onClick={() => document.execCommand('undo')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Desfazer (Ctrl+Z)"
                      >
                        <span className="material-symbols-outlined text-[18px]">undo</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('redo')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Refazer (Ctrl+Y)"
                      >
                        <span className="material-symbols-outlined text-[18px]">redo</span>
                      </button>
                    </div>

                    {/* Formatação de texto */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <button
                        onClick={() => document.execCommand('bold')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Negrito (Ctrl+B)"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_bold</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('italic')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Itálico (Ctrl+I)"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_italic</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('underline')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Sublinhado (Ctrl+U)"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_underlined</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('strikeThrough')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Tachado"
                      >
                        <span className="material-symbols-outlined text-[18px]">strikethrough_s</span>
                      </button>
                    </div>

                    {/* Títulos */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <select
                        onChange={(e) => document.execCommand('formatBlock', false, e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded bg-white hover:border-slate-400 focus:ring-2 focus:ring-purple-500"
                        title="Estilo do texto"
                        defaultValue="p"
                      >
                        <option value="p">Parágrafo</option>
                        <option value="h1">Título 1</option>
                        <option value="h2">Título 2</option>
                        <option value="h3">Título 3</option>
                        <option value="h4">Título 4</option>
                        <option value="blockquote">Citação</option>
                        <option value="pre">Código</option>
                      </select>
                    </div>

                    {/* Tamanho da fonte */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <select
                        onChange={(e) => document.execCommand('fontSize', false, e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded bg-white hover:border-slate-400 focus:ring-2 focus:ring-purple-500"
                        title="Tamanho da fonte"
                        defaultValue="3"
                      >
                        <option value="1">10px</option>
                        <option value="2">12px</option>
                        <option value="3">14px</option>
                        <option value="4">16px</option>
                        <option value="5">18px</option>
                        <option value="6">24px</option>
                        <option value="7">32px</option>
                      </select>
                    </div>

                    {/* Cores */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <div className="relative">
                        <button
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors flex items-center"
                          title="Cor do texto"
                        >
                          <span className="material-symbols-outlined text-[18px]">format_color_text</span>
                        </button>
                        <input
                          type="color"
                          onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Cor do texto"
                        />
                      </div>
                      <div className="relative">
                        <button
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                          title="Cor de fundo"
                        >
                          <span className="material-symbols-outlined text-[18px]">format_color_fill</span>
                        </button>
                        <input
                          type="color"
                          onChange={(e) => document.execCommand('hiliteColor', false, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Cor de fundo"
                        />
                      </div>
                    </div>

                    {/* Alinhamento */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <button
                        onClick={() => document.execCommand('justifyLeft')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Alinhar à esquerda"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_align_left</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('justifyCenter')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Centralizar"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_align_center</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('justifyRight')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Alinhar à direita"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_align_right</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('justifyFull')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Justificar"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_align_justify</span>
                      </button>
                    </div>

                    {/* Listas e Indentação */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <button
                        onClick={() => document.execCommand('insertUnorderedList')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Lista com marcadores"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('insertOrderedList')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Lista numerada"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('outdent')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Diminuir recuo"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_indent_decrease</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('indent')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Aumentar recuo"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_indent_increase</span>
                      </button>
                    </div>

                    {/* Link, imagem e elementos */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <button
                        onClick={() => {
                          setInputModalConfig({
                            title: 'Inserir Link',
                            fields: [{ key: 'url', label: 'URL do link', placeholder: 'https://exemplo.com', value: '' }],
                            onConfirm: (values) => {
                              if (values.url) document.execCommand('createLink', false, values.url);
                            }
                          });
                          setShowInputModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Inserir link"
                      >
                        <span className="material-symbols-outlined text-[18px]">link</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('unlink')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Remover link"
                      >
                        <span className="material-symbols-outlined text-[18px]">link_off</span>
                      </button>
                      <button
                        onClick={() => {
                          setInputModalConfig({
                            title: 'Inserir Imagem',
                            fields: [{ key: 'url', label: 'URL da imagem', placeholder: 'https://exemplo.com/imagem.jpg', value: '' }],
                            onConfirm: (values) => {
                              if (values.url) document.execCommand('insertImage', false, values.url);
                            }
                          });
                          setShowInputModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Inserir imagem"
                      >
                        <span className="material-symbols-outlined text-[18px]">image</span>
                      </button>
                      <button
                        onClick={() => document.execCommand('insertHorizontalRule')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Linha horizontal"
                      >
                        <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
                      </button>
                    </div>

                    {/* Botão CTA */}
                    <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
                      <button
                        onClick={() => {
                          setInputModalConfig({
                            title: 'Inserir Botão',
                            fields: [
                              { key: 'text', label: 'Texto do botão', placeholder: 'Clique Aqui', value: 'Clique Aqui' },
                              { key: 'url', label: 'URL do botão', placeholder: 'https://exemplo.com', value: '' }
                            ],
                            onConfirm: (values) => {
                              if (values.text && values.url) {
                                const buttonHtml = `<a href="${values.url}" style="display: inline-block; background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">${values.text}</a>`;
                                document.execCommand('insertHTML', false, buttonHtml);
                              }
                            }
                          });
                          setShowInputModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Inserir botão"
                      >
                        <span className="material-symbols-outlined text-[18px]">smart_button</span>
                      </button>
                      <button
                        onClick={() => {
                          const tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <tr>
                              <td style="border: 1px solid #e2e8f0; padding: 10px;">Célula 1</td>
                              <td style="border: 1px solid #e2e8f0; padding: 10px;">Célula 2</td>
                            </tr>
                            <tr>
                              <td style="border: 1px solid #e2e8f0; padding: 10px;">Célula 3</td>
                              <td style="border: 1px solid #e2e8f0; padding: 10px;">Célula 4</td>
                            </tr>
                          </table>`;
                          document.execCommand('insertHTML', false, tableHtml);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Inserir tabela"
                      >
                        <span className="material-symbols-outlined text-[18px]">table</span>
                      </button>
                    </div>

                    {/* Limpar formatação */}
                    <div className="flex items-center gap-0.5 px-2">
                      <button
                        onClick={() => document.execCommand('removeFormat')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                        title="Limpar formatação"
                      >
                        <span className="material-symbols-outlined text-[18px]">format_clear</span>
                      </button>
                      <button
                        onClick={() => {
                          const editor = document.getElementById('visual-editor');
                          if (editor) {
                            editor.innerHTML = '';
                          }
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Limpar tudo"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                      </button>
                    </div>
                  </div>

                  {/* Editor visual editável */}
                  <div className="flex-1 overflow-auto bg-slate-100 p-4">
                    <div className="max-w-[650px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                      <div
                        id="visual-editor"
                        contentEditable
                        className="p-6 min-h-[400px] focus:outline-none prose prose-sm max-w-none"
                        style={{ minHeight: '450px' }}
                        dangerouslySetInnerHTML={{ 
                          __html: templateForm.html_content || `
                            <div style="text-align: center; padding: 20px;">
                              <h1 style="color: #9333ea; margin-bottom: 10px;">Título do seu Email</h1>
                              <p style="color: #64748b;">Clique aqui e comece a editar seu email...</p>
                            </div>
                          `
                        }}
                        onBlur={(e) => {
                          const content = (e.target as HTMLDivElement).innerHTML;
                          setTemplateForm({ ...templateForm, html_content: content });
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col">
                  <textarea
                    id="html-editor"
                    value={templateForm.html_content}
                    onChange={(e) => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                    placeholder="Cole ou edite o HTML do seu email aqui..."
                    className="flex-1 w-full p-4 border-0 focus:ring-0 font-mono text-sm resize-none bg-slate-900 text-slate-100"
                    style={{ minHeight: '400px' }}
                  />
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex-shrink-0 flex items-center justify-between bg-slate-50">
              <p className="text-xs text-slate-500">
                {templateEditorTab === 'edit' ? 'Dica: Use as variáveis acima para personalizar o email' : 'As variáveis são substituídas por dados de exemplo'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateForm.name || !templateForm.subject}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Salvar Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Campanha */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCampaignModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Campanha *</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="Ex: Promoção de Janeiro"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
                <select
                  value={campaignForm.template_id}
                  onChange={(e) => setCampaignForm({ ...campaignForm, template_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Selecione um template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enviar para</label>
                <select
                  value={campaignForm.target_type}
                  onChange={(e) => setCampaignForm({ ...campaignForm, target_type: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="all">Todos os leads com email</option>
                  <option value="stage">Leads de uma etapa específica</option>
                  <option value="source">Leads de uma origem específica</option>
                </select>
              </div>
              
              {campaignForm.target_type === 'stage' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Etapa do Kanban</label>
                  <select
                    value={campaignForm.target_stage_id}
                    onChange={(e) => setCampaignForm({ ...campaignForm, target_stage_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Selecione uma etapa</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {campaignForm.target_type === 'source' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                  <select
                    value={campaignForm.target_source_id}
                    onChange={(e) => setCampaignForm({ ...campaignForm, target_source_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Selecione uma origem</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Agendar envio (opcional)</label>
                <input
                  type="datetime-local"
                  value={campaignForm.scheduled_at}
                  onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">Deixe vazio para salvar como rascunho</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCampaign}
                disabled={!campaignForm.name || !campaignForm.template_id}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Email Único */}
      {showSingleEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSingleEmailModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-violet-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">send</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Enviar Email Único</h3>
                  <p className="text-purple-100 text-sm">Envie um email para um destinatário específico</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
                <select
                  value={singleEmailForm.template_id}
                  onChange={(e) => setSingleEmailForm({ ...singleEmailForm, template_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Selecione um template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do destinatário</label>
                <input
                  type="text"
                  value={singleEmailForm.recipient_name}
                  onChange={(e) => setSingleEmailForm({ ...singleEmailForm, recipient_name: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">Será usado na variável {'{{lead_name}}'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email do destinatário *</label>
                <input
                  type="email"
                  value={singleEmailForm.recipient_email}
                  onChange={(e) => setSingleEmailForm({ ...singleEmailForm, recipient_email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {singleEmailForm.template_id && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Preview do assunto:</p>
                  <p className="text-sm font-medium text-slate-700">
                    {templates.find(t => t.id === singleEmailForm.template_id)?.subject
                      .replace('{{lead_name}}', singleEmailForm.recipient_name || 'Cliente')
                      .replace('{{clinic_name}}', 'Sua Clínica')}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowSingleEmailModal(false)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendSingleEmail}
                disabled={!singleEmailForm.template_id || !singleEmailForm.recipient_email || sendingSingleEmail}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {sendingSingleEmail ? (
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

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-red-600">delete</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmar exclusão</h3>
              <p className="text-slate-500 mb-2">
                Tem certeza que deseja excluir {deleteTarget.type === 'template' ? 'o template' : 'a campanha'}:
              </p>
              <p className="font-medium text-slate-800 mb-6">"{deleteTarget.name}"</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTarget(null);
                  }} 
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete} 
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Input (para link, imagem, botão) */}
      {showInputModal && inputModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowInputModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{inputModalConfig.title}</h3>
            <div className="space-y-4">
              {inputModalConfig.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    defaultValue={field.value}
                    id={`input-modal-${field.key}`}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowInputModal(false)} 
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const values: Record<string, string> = {};
                  inputModalConfig.fields.forEach((field) => {
                    const input = document.getElementById(`input-modal-${field.key}`) as HTMLInputElement;
                    values[field.key] = input?.value || '';
                  });
                  inputModalConfig.onConfirm(values);
                  setShowInputModal(false);
                }} 
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
