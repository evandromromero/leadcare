import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_encryption: 'ssl' | 'tls' | 'none';
}

interface MetaConnection {
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  facebook_enabled: boolean;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  instagram_enabled: boolean;
  instagram_connected_at: string | null;
  meta_connected_at: string | null;
}

interface WhatsAppCloudConfig {
  cloud_api_enabled: boolean;
  cloud_api_phone_number_id: string | null;
  cloud_api_phone_number: string | null;
  cloud_api_waba_id: string | null;
  cloud_api_connected_at: string | null;
}

type TabType = 'email' | 'instagram' | 'facebook' | 'meta_ads' | 'whatsapp';

interface MetaAdsConfig {
  meta_ads_account_id: string | null;
  meta_ads_access_token: string | null;
}

interface MetaAdsAccount {
  id: string;
  account_id: string;
  account_name: string;
  is_active: boolean;
  has_token: boolean;
}

export default function Integrations() {
  const { user, loading: authLoading, isImpersonating, impersonatedClinic } = useAuth();
  // Usar clinicId do impersonate se estiver ativo, senão usar do usuário
  const clinicId = isImpersonating ? impersonatedClinic?.id : user?.clinicId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [emailMarketingEnabled, setEmailMarketingEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const [metaConnection, setMetaConnection] = useState<MetaConnection>({
    facebook_page_id: null,
    facebook_page_name: null,
    facebook_enabled: false,
    instagram_business_account_id: null,
    instagram_username: null,
    instagram_enabled: false,
    instagram_connected_at: null,
    meta_connected_at: null,
  });
  const [metaAppId, setMetaAppId] = useState<string | null>(null);
  const [metaAdsConfig, setMetaAdsConfig] = useState<MetaAdsConfig>({
    meta_ads_account_id: null,
    meta_ads_access_token: null,
  });
  const [savingMetaAds, setSavingMetaAds] = useState(false);
  const [metaAdsConfiguredByAdmin, setMetaAdsConfiguredByAdmin] = useState(false);
  const [metaAdsAccounts, setMetaAdsAccounts] = useState<MetaAdsAccount[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountToken, setNewAccountToken] = useState('');
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<{ id: string; name: string; token: string } | null>(null);
  const [editAccountToken, setEditAccountToken] = useState('');
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [disconnectingMeta, setDisconnectingMeta] = useState(false);
  const [showMetaHelpModal, setShowMetaHelpModal] = useState(false);
  const [showMetaAdsHelpModal, setShowMetaAdsHelpModal] = useState(false);
  const [whatsappCloudConfig, setWhatsappCloudConfig] = useState<WhatsAppCloudConfig | null>(null);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  
  // Estados para modal de teste SMTP
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    smtp_host: '',
    smtp_port: 465,
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_encryption: 'ssl',
  });

  useEffect(() => {
    const fetchConfig = async () => {
      // Aguardar auth carregar
      if (authLoading) return;
      
      if (!clinicId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Buscar todas as queries em paralelo
        const [
          { data, error },
          { data: settingsData },
          { data: accountsData }
        ] = await Promise.all([
          (supabase as any)
            .from('clinics')
            .select('email_marketing_enabled, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_encryption, facebook_page_id, facebook_page_name, facebook_enabled, instagram_business_account_id, instagram_username, instagram_enabled, instagram_connected_at, meta_connected_at, meta_ads_account_id, meta_ads_access_token, cloud_api_enabled, cloud_api_phone_number_id, cloud_api_phone_number, cloud_api_waba_id, cloud_api_connected_at')
            .eq('id', clinicId)
            .single(),
          (supabase as any)
            .from('settings')
            .select('meta_app_id')
            .single(),
          (supabase as any)
            .from('clinic_meta_accounts')
            .select('id, account_id, account_name, is_active, access_token')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: true })
        ]);
        
        if (settingsData?.meta_app_id) {
          setMetaAppId(settingsData.meta_app_id);
        }
        
        if (error) {
          console.error('Erro ao buscar configurações:', error);
        }
        
        if (accountsData) {
          setMetaAdsAccounts(accountsData.map((a: any) => ({
            id: a.id,
            account_id: a.account_id,
            account_name: a.account_name || 'Conta sem nome',
            is_active: a.is_active,
            has_token: !!a.access_token
          })));
        }
        
        if (data) {
          setEmailMarketingEnabled(data.email_marketing_enabled || false);
          setSmtpConfig({
            smtp_host: data.smtp_host || '',
            smtp_port: data.smtp_port || 465,
            smtp_user: data.smtp_user || '',
            smtp_password: data.smtp_password || '',
            smtp_from_email: data.smtp_from_email || '',
            smtp_from_name: data.smtp_from_name || '',
            smtp_encryption: data.smtp_encryption || 'ssl',
          });
          setMetaConnection({
            facebook_page_id: data.facebook_page_id || null,
            facebook_page_name: data.facebook_page_name || null,
            facebook_enabled: data.facebook_enabled || false,
            instagram_business_account_id: data.instagram_business_account_id || null,
            instagram_username: data.instagram_username || null,
            instagram_enabled: data.instagram_enabled || false,
            instagram_connected_at: data.instagram_connected_at || null,
            meta_connected_at: data.meta_connected_at || null,
          });
          // Meta Ads API config
          setMetaAdsConfig({
            meta_ads_account_id: data.meta_ads_account_id || null,
            meta_ads_access_token: data.meta_ads_access_token || null,
          });
          // Verificar se foi configurado pelo admin (tem dados mas não pode editar)
          setMetaAdsConfiguredByAdmin(!!(data.meta_ads_account_id && data.meta_ads_access_token));
          
          // WhatsApp Cloud API config
          setWhatsappCloudConfig({
            cloud_api_enabled: data.cloud_api_enabled || false,
            cloud_api_phone_number_id: data.cloud_api_phone_number_id || null,
            cloud_api_phone_number: data.cloud_api_phone_number || null,
            cloud_api_waba_id: data.cloud_api_waba_id || null,
            cloud_api_connected_at: data.cloud_api_connected_at || null,
          });
        }
      } catch (err) {
        console.error('Erro ao buscar configurações:', err);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [clinicId, authLoading, isImpersonating]);

  const handleSave = async () => {
    if (!clinicId) return;
    
    setSaving(true);
    setTestResult(null);
    
    const { error } = await (supabase as any)
      .from('clinics')
      .update({
        smtp_host: smtpConfig.smtp_host,
        smtp_port: smtpConfig.smtp_port,
        smtp_user: smtpConfig.smtp_user,
        smtp_password: smtpConfig.smtp_password,
        smtp_from_email: smtpConfig.smtp_from_email,
        smtp_from_name: smtpConfig.smtp_from_name,
        smtp_encryption: smtpConfig.smtp_encryption,
      })
      .eq('id', clinicId);
    
    setSaving(false);
    
    if (error) {
      setTestResult({ success: false, message: 'Erro ao salvar configurações: ' + error.message });
    } else {
      setTestResult({ success: true, message: 'Configurações salvas com sucesso!' });
    }
  };

  const handleOpenTestModal = () => {
    setTestEmail('');
    setTestResult(null);
    setShowTestModal(true);
  };

  const handleSaveMetaAds = async () => {
    if (!clinicId) return;
    
    setSavingMetaAds(true);
    setTestResult(null);
    
    const { error } = await (supabase as any)
      .from('clinics')
      .update({
        meta_ads_account_id: metaAdsConfig.meta_ads_account_id || null,
        meta_ads_access_token: metaAdsConfig.meta_ads_access_token || null,
      })
      .eq('id', clinicId);
    
    setSavingMetaAds(false);
    
    if (error) {
      setTestResult({ success: false, message: 'Erro ao salvar configurações: ' + error.message });
    } else {
      setTestResult({ success: true, message: 'Configurações do Meta Ads salvas com sucesso!' });
      setMetaAdsConfiguredByAdmin(true);
    }
  };

  const handleAddMetaAccount = async () => {
    if (!clinicId || !newAccountId || !newAccountName) return;
    
    setSavingMetaAds(true);
    
    const { data, error } = await (supabase as any)
      .from('clinic_meta_accounts')
      .insert({
        clinic_id: clinicId,
        account_id: newAccountId,
        account_name: newAccountName,
        access_token: newAccountToken || null,
        is_active: true
      })
      .select()
      .single();
    
    setSavingMetaAds(false);
    
    if (error) {
      setTestResult({ success: false, message: 'Erro ao adicionar conta: ' + error.message });
    } else {
      setMetaAdsAccounts(prev => [...prev, {
        id: data.id,
        account_id: data.account_id,
        account_name: data.account_name,
        is_active: data.is_active,
        has_token: !!data.access_token
      }]);
      setShowAddAccountModal(false);
      setNewAccountId('');
      setNewAccountName('');
      setNewAccountToken('');
      setTestResult({ success: true, message: 'Conta adicionada com sucesso!' });
    }
  };

  const handleDeleteMetaAccount = async (accountId: string) => {
    if (!clinicId) return;
    
    setDeletingAccountId(accountId);
    
    const { error } = await (supabase as any)
      .from('clinic_meta_accounts')
      .delete()
      .eq('id', accountId);
    
    setDeletingAccountId(null);
    
    if (error) {
      setTestResult({ success: false, message: 'Erro ao remover conta: ' + error.message });
    } else {
      setMetaAdsAccounts(prev => prev.filter(a => a.id !== accountId));
      setTestResult({ success: true, message: 'Conta removida com sucesso!' });
    }
  };

  const handleEditMetaAccount = (account: MetaAdsAccount) => {
    setEditingAccount({ id: account.id, name: account.account_name, token: '' });
    setEditAccountToken('');
  };

  const handleSaveEditAccount = async () => {
    if (!editingAccount || !clinicId) return;
    
    setSavingMetaAds(true);
    
    const { error } = await (supabase as any)
      .from('clinic_meta_accounts')
      .update({ access_token: editAccountToken || null })
      .eq('id', editingAccount.id);
    
    setSavingMetaAds(false);
    
    if (error) {
      setTestResult({ success: false, message: 'Erro ao atualizar token: ' + error.message });
    } else {
      setMetaAdsAccounts(prev => prev.map(a => 
        a.id === editingAccount.id ? { ...a, has_token: !!editAccountToken } : a
      ));
      setEditingAccount(null);
      setEditAccountToken('');
      setTestResult({ success: true, message: 'Token atualizado com sucesso!' });
    }
  };

  const handleTestConnection = async () => {
    if (!testEmail) return;
    
    setTesting(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          clinicId,
          testEmail,
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setTestResult({ success: true, message: 'Email de teste enviado com sucesso! Verifique sua caixa de entrada.' });
      } else {
        setTestResult({ success: false, message: result.error || 'Erro ao enviar email de teste' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Erro ao testar conexão. Salve as configurações primeiro e tente novamente.' 
      });
    }
    
    setTesting(false);
  };

  const handleConnectMeta = (platform: 'facebook' | 'instagram') => {
    if (!metaAppId || !clinicId) {
      setTestResult({ success: false, message: 'Integração Meta não configurada. Entre em contato com o suporte.' });
      return;
    }
    
    setConnectingMeta(true);
    
    let authUrl: string;
    
    // Usar PHP callback para evitar problemas com Edge Functions
    const phpCallbackUrl = 'https://belitx.com.br/api/meta-callback.php';
    
    if (platform === 'instagram') {
      // Instagram Business usa Facebook OAuth com permissões do Instagram
      // Isso busca a Página do Facebook + Instagram Business Account vinculado
      const scope = 'pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages';
      
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${metaAppId}&` +
        `redirect_uri=${encodeURIComponent(phpCallbackUrl)}&` +
        `scope=${scope}&` +
        `state=${clinicId}_instagram&` +
        `response_type=code`;
    } else {
      // Facebook OAuth
      const scope = 'pages_show_list,pages_messaging,pages_manage_metadata';
      
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${metaAppId}&` +
        `redirect_uri=${encodeURIComponent(phpCallbackUrl)}&` +
        `scope=${scope}&` +
        `state=${clinicId}&` +
        `response_type=code`;
    }
    
    // Abrir popup em vez de redirecionar
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'meta_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    // Verificar quando o popup fecha ou redireciona
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        setConnectingMeta(false);
        // Recarregar dados para verificar se conectou
        window.location.reload();
      }
    }, 500);
  };

  // Estado para modo de conexão
  const [connectionMode, setConnectionMode] = useState<'new' | 'coexistence'>('new');
  
  // Config ID para Embedded Signup (criado no Meta for Developers > Login do Facebook para Empresas > Configurações)
  const WHATSAPP_CONFIG_ID = '763626706332381';

  // Conectar WhatsApp via Embedded Signup (com suporte a Coexistência)
  const handleConnectWhatsApp = () => {
    if (!metaAppId || !clinicId) {
      setTestResult({ success: false, message: 'Integração Meta não configurada. Entre em contato com o suporte.' });
      return;
    }
    
    setConnectingWhatsApp(true);
    
    // Modo "Número Novo" usa OAuth tradicional (sempre funciona)
    // Modo "Coexistência" requer Embedded Signup com config_id
    if (connectionMode === 'new') {
      handleConnectWhatsAppFallback();
      return;
    }
    
    // Coexistência requer config_id
    if (!WHATSAPP_CONFIG_ID) {
      setTestResult({ 
        success: false, 
        message: 'Modo Coexistência não configurado. Entre em contato com o suporte para habilitar.' 
      });
      setConnectingWhatsApp(false);
      return;
    }
    
    // Verificar se o SDK do Facebook está carregado
    if (typeof (window as any).FB === 'undefined') {
      setTestResult({ success: false, message: 'SDK do Facebook não carregou. Tente novamente.' });
      setConnectingWhatsApp(false);
      return;
    }
    
    // Usar Embedded Signup com SDK do Facebook para Coexistência
    (window as any).FB.login(
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          processWhatsAppCode(code);
        } else {
          setConnectingWhatsApp(false);
          setTestResult({ success: false, message: 'Conexão cancelada pelo usuário.' });
        }
      },
      {
        config_id: WHATSAPP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3'
        }
      }
    );
  };
  
  // Fallback para OAuth tradicional (sem SDK)
  const handleConnectWhatsAppFallback = () => {
    const phpCallbackUrl = 'https://belitx.com.br/api/whatsapp-callback.php';
    const scope = 'whatsapp_business_messaging,whatsapp_business_management,business_management';
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${metaAppId}&` +
      `redirect_uri=${encodeURIComponent(phpCallbackUrl)}&` +
      `scope=${scope}&` +
      `state=${clinicId}&` +
      `response_type=code`;
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'whatsapp_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        setConnectingWhatsApp(false);
        window.location.reload();
      }
    }, 500);
  };
  
  // Processar code do Embedded Signup
  const processWhatsAppCode = async (code: string) => {
    try {
      // Chamar endpoint PHP para trocar code por token
      const response = await fetch('https://belitx.com.br/api/whatsapp-callback.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          clinic_id: clinicId,
          mode: connectionMode
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResult({ success: true, message: 'WhatsApp conectado com sucesso!' });
        window.location.reload();
      } else {
        setTestResult({ success: false, message: data.error || 'Erro ao conectar WhatsApp.' });
      }
    } catch (error) {
      console.error('Erro ao processar code:', error);
      setTestResult({ success: false, message: 'Erro ao processar conexão.' });
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  // Desconectar WhatsApp Cloud API
  const handleDisconnectWhatsApp = async () => {
    if (!clinicId) return;
    
    setConnectingWhatsApp(true);
    
    try {
      const { error } = await (supabase as any)
        .from('clinics')
        .update({
          cloud_api_enabled: false,
          cloud_api_phone_number_id: null,
          cloud_api_phone_number: null,
          cloud_api_waba_id: null,
          cloud_api_access_token: null,
          cloud_api_connected_at: null,
        })
        .eq('id', clinicId);
      
      if (error) throw error;
      
      setWhatsappCloudConfig({
        cloud_api_enabled: false,
        cloud_api_phone_number_id: null,
        cloud_api_phone_number: null,
        cloud_api_waba_id: null,
        cloud_api_connected_at: null,
      });
      
      setTestResult({ success: true, message: 'WhatsApp desconectado com sucesso!' });
    } catch (error: any) {
      setTestResult({ success: false, message: 'Erro ao desconectar: ' + error.message });
    }
    
    setConnectingWhatsApp(false);
  };

  const handleDisconnectMeta = async (platform: 'facebook' | 'instagram') => {
    if (!clinicId) return;
    
    setDisconnectingMeta(true);
    
    try {
      const updateData: any = {};
      
      if (platform === 'facebook') {
        updateData.facebook_page_id = null;
        updateData.facebook_page_name = null;
        updateData.facebook_page_access_token = null;
        updateData.facebook_enabled = false;
      } else {
        updateData.instagram_business_account_id = null;
        updateData.instagram_enabled = false;
      }
      
      const { error } = await (supabase as any)
        .from('clinics')
        .update(updateData)
        .eq('id', clinicId);
      
      if (error) throw error;
      
      setMetaConnection(prev => ({
        ...prev,
        ...(platform === 'facebook' ? {
          facebook_page_id: null,
          facebook_page_name: null,
          facebook_enabled: false,
        } : {
          instagram_business_account_id: null,
          instagram_enabled: false,
        })
      }));
      
      setTestResult({ success: true, message: `${platform === 'facebook' ? 'Facebook' : 'Instagram'} desconectado com sucesso!` });
    } catch (error: any) {
      setTestResult({ success: false, message: 'Erro ao desconectar: ' + error.message });
    }
    
    setDisconnectingMeta(false);
  };

  // Estado para controlar loading do Meta Business
  const [connectingMetaBusiness, setConnectingMetaBusiness] = useState(false);

  // Conectar Meta Business (fluxo unificado - WhatsApp, Instagram, Facebook)
  const handleConnectMetaBusiness = () => {
    if (!metaAppId || !clinicId) {
      setTestResult({ success: false, message: 'Integração Meta não configurada. Entre em contato com o suporte.' });
      return;
    }
    
    setConnectingMetaBusiness(true);
    
    // Todas as permissões necessárias para WhatsApp, Instagram e Facebook
    const scope = [
      // WhatsApp
      'whatsapp_business_messaging',
      'whatsapp_business_management',
      // Facebook
      'pages_show_list',
      'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement',
      // Instagram
      'instagram_basic',
      'instagram_manage_messages',
      // Business
      'business_management'
    ].join(',');
    
    const phpCallbackUrl = 'https://belitx.com.br/api/meta-business-callback.php';
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${metaAppId}&` +
      `redirect_uri=${encodeURIComponent(phpCallbackUrl)}&` +
      `scope=${scope}&` +
      `state=${clinicId}&` +
      `response_type=code`;
    
    const width = 700;
    const height = 800;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'meta_business_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        setConnectingMetaBusiness(false);
        window.location.reload();
      }
    }, 500);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!emailMarketingEnabled) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">lock</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Integrações não disponíveis</h2>
            <p className="text-slate-500">
              As integrações ainda não foram habilitadas para sua conta. 
              Entre em contato com o suporte para solicitar a ativação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">Integrações</h1>
          <p className="text-xs sm:text-base text-slate-500">Configure suas integrações externas</p>
        </div>

        {/* Card Conectar Meta Business - Fluxo Unificado */}
        {metaAppId && (
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="material-symbols-outlined text-xl sm:text-3xl">link</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold">Conectar Meta Business</h2>
                  <p className="text-white/80 text-[10px] sm:text-sm">WhatsApp, Instagram e Facebook</p>
                </div>
              </div>
              <button
                onClick={handleConnectMetaBusiness}
                disabled={connectingMetaBusiness}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-purple-700 rounded-lg sm:rounded-xl font-semibold hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
              >
                {connectingMetaBusiness ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Conectando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add_link</span>
                    Conectar
                  </>
                )}
              </button>
            </div>
            
            {/* Status dos canais conectados */}
            <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-[14px] sm:text-[18px]">chat</span>
                <span className="text-[10px] sm:text-sm">WhatsApp</span>
                {whatsappCloudConfig?.cloud_api_enabled ? (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></span>
                ) : (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 rounded-full"></span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-[14px] sm:text-[18px]">photo_camera</span>
                <span className="text-[10px] sm:text-sm">Instagram</span>
                {metaConnection.instagram_enabled ? (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></span>
                ) : (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 rounded-full"></span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-[14px] sm:text-[18px]">thumb_up</span>
                <span className="text-[10px] sm:text-sm">Facebook</span>
                {metaConnection.facebook_enabled ? (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></span>
                ) : (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 rounded-full"></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {/* Verificar se está em localhost para habilitar Instagram/Facebook */}
        {(() => {
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          return (
            <div className="flex gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto pb-px -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                onClick={() => { setActiveTab('email'); setTestResult(null); }}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'email'
                    ? 'bg-white border border-b-white border-slate-200 -mb-px text-purple-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] sm:text-[20px]">mail</span>
                <span className="hidden sm:inline">Email Marketing</span>
                <span className="sm:hidden">Email</span>
              </button>
              {isLocalhost ? (
                <>
                  <button
                    onClick={() => { setActiveTab('instagram'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'instagram'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-pink-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">photo_camera</span>
                    <span className="hidden sm:inline">Instagram</span>
                    <span className="sm:hidden">Insta</span>
                    {metaConnection.instagram_enabled && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('facebook'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'facebook'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-blue-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">thumb_up</span>
                    <span className="hidden sm:inline">Facebook</span>
                    <span className="sm:hidden">Face</span>
                    {metaConnection.facebook_enabled && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('meta_ads'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'meta_ads'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-pink-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">ads_click</span>
                    <span className="hidden sm:inline">Meta Ads</span>
                    <span className="sm:hidden">Ads</span>
                    {metaAdsConfiguredByAdmin && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('whatsapp'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'whatsapp'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-emerald-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">chat</span>
                    <span className="hidden sm:inline">WhatsApp API</span>
                    <span className="sm:hidden">Zap</span>
                    {whatsappCloudConfig?.cloud_api_enabled && whatsappCloudConfig?.cloud_api_phone_number_id && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  </>
              ) : (
                <>
                  <button
                    onClick={() => { setActiveTab('instagram'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'instagram'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-pink-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">photo_camera</span>
                    <span className="hidden sm:inline">Instagram</span>
                    <span className="sm:hidden">Insta</span>
                    {metaConnection.instagram_enabled && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('facebook'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'facebook'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-blue-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">thumb_up</span>
                    <span className="hidden sm:inline">Facebook</span>
                    <span className="sm:hidden">Face</span>
                    {metaConnection.facebook_enabled && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('meta_ads'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'meta_ads'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-pink-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">ads_click</span>
                    <span className="hidden sm:inline">Meta Ads</span>
                    <span className="sm:hidden">Ads</span>
                    {metaAdsConfiguredByAdmin && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('whatsapp'); setTestResult(null); }}
                    className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                      activeTab === 'whatsapp'
                        ? 'bg-white border border-b-white border-slate-200 -mb-px text-emerald-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[20px]">chat</span>
                    <span className="hidden sm:inline">WhatsApp API</span>
                    <span className="sm:hidden">Zap</span>
                    {whatsappCloudConfig?.cloud_api_enabled && whatsappCloudConfig?.cloud_api_phone_number_id && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* Tab Content */}
        {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Email Marketing SMTP */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-xl sm:text-2xl text-purple-600">mail</span>
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-semibold text-slate-800">Email Marketing (SMTP)</h2>
                <p className="text-[10px] sm:text-sm text-slate-500">Configure seu servidor SMTP</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Informações do servidor */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="material-symbols-outlined text-blue-600 mt-0.5 text-lg sm:text-xl">info</span>
                <div className="text-xs sm:text-sm text-blue-800">
                  <p className="font-medium mb-1">Como obter as credenciais SMTP?</p>
                  <p className="hidden sm:block">Acesse o painel do seu provedor de email (Hostinger, Gmail, etc.) e procure por "Configurações SMTP" ou "Email Settings".</p>
                  <p className="sm:hidden">Acesse o painel do seu provedor de email.</p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Host SMTP *
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                  placeholder="smtp.hostinger.com"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Porta *
                </label>
                <input
                  type="number"
                  value={smtpConfig.smtp_port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 465 })}
                  placeholder="465"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Usuário/Email *
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={smtpConfig.smtp_password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Email Remetente
                </label>
                <input
                  type="email"
                  value={smtpConfig.smtp_from_email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from_email: e.target.value })}
                  placeholder="contato@suaempresa.com"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Se vazio, usará o email de usuário</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Nome Remetente
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_from_name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from_name: e.target.value })}
                  placeholder="Sua Empresa"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                  Criptografia *
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  {[
                    { value: 'ssl', label: 'SSL (465)', labelFull: 'SSL (Porta 465)', desc: 'Recomendado' },
                    { value: 'tls', label: 'TLS (587)', labelFull: 'TLS (Porta 587)', desc: 'Alternativa' },
                    { value: 'none', label: 'Nenhuma', labelFull: 'Nenhuma', desc: 'Não recomendado' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex-1 p-2.5 sm:p-4 border rounded-lg cursor-pointer transition-all ${
                        smtpConfig.smtp_encryption === option.value
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="encryption"
                        value={option.value}
                        checked={smtpConfig.smtp_encryption === option.value}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_encryption: e.target.value as any })}
                        className="sr-only"
                      />
                      <span className="font-medium text-slate-800 text-xs sm:text-sm">
                        <span className="sm:hidden">{option.label}</span>
                        <span className="hidden sm:inline">{option.labelFull}</span>
                      </span>
                      <span className="block text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">{option.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado do teste */}
            {testResult && (
              <div className={`p-3 sm:p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`material-symbols-outlined text-lg sm:text-xl ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? 'check_circle' : 'error'}
                  </span>
                  <span className={`text-xs sm:text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-200">
              <button
                onClick={handleOpenTestModal}
                disabled={!smtpConfig.smtp_host || !smtpConfig.smtp_user}
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">send</span>
                Testar
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Salvando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">save</span>
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Configurações comuns de SMTP */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 h-fit">
          <h3 className="text-sm sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">Configurações Comuns</h3>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-xs sm:text-sm min-w-[300px]">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="pb-2 sm:pb-3 font-medium text-slate-600">Provedor</th>
                  <th className="pb-2 sm:pb-3 font-medium text-slate-600">Host</th>
                  <th className="pb-2 sm:pb-3 font-medium text-slate-600">Porta</th>
                  <th className="pb-2 sm:pb-3 font-medium text-slate-600 hidden sm:table-cell">Cripto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 sm:py-3 font-medium text-slate-800">Hostinger</td>
                  <td className="py-2 sm:py-3 text-slate-600 text-[10px] sm:text-sm">smtp.hostinger.com</td>
                  <td className="py-2 sm:py-3 text-slate-600">465</td>
                  <td className="py-2 sm:py-3 text-slate-600 hidden sm:table-cell">SSL</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-3 font-medium text-slate-800">Gmail</td>
                  <td className="py-2 sm:py-3 text-slate-600 text-[10px] sm:text-sm">smtp.gmail.com</td>
                  <td className="py-2 sm:py-3 text-slate-600">587</td>
                  <td className="py-2 sm:py-3 text-slate-600 hidden sm:table-cell">TLS</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-3 font-medium text-slate-800">Outlook</td>
                  <td className="py-2 sm:py-3 text-slate-600 text-[10px] sm:text-sm">smtp.office365.com</td>
                  <td className="py-2 sm:py-3 text-slate-600">587</td>
                  <td className="py-2 sm:py-3 text-slate-600 hidden sm:table-cell">TLS</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-3 font-medium text-slate-800">SendGrid</td>
                  <td className="py-2 sm:py-3 text-slate-600 text-[10px] sm:text-sm">smtp.sendgrid.net</td>
                  <td className="py-2 sm:py-3 text-slate-600">587</td>
                  <td className="py-2 sm:py-3 text-slate-600 hidden sm:table-cell">TLS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div>
        )}

        {/* Instagram Tab */}
        {activeTab === 'instagram' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl sm:text-2xl text-white">photo_camera</span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-semibold text-slate-800">Instagram Direct</h2>
                      <p className="text-[10px] sm:text-sm text-slate-500">Receba mensagens no Inbox</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMetaHelpModal(true)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Como funciona?"
                  >
                    <span className="material-symbols-outlined text-lg sm:text-xl">help</span>
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {metaConnection.instagram_enabled ? (
                  <>
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                      <span className="material-symbols-outlined text-green-600 text-lg sm:text-xl">check_circle</span>
                      <div>
                        <p className="font-medium text-green-800 text-sm sm:text-base">Instagram conectado</p>
                        <p className="text-xs sm:text-sm text-green-600">
                          {metaConnection.instagram_username ? `@${metaConnection.instagram_username}` : `ID: ${metaConnection.instagram_business_account_id}`}
                        </p>
                        {(metaConnection.instagram_connected_at || metaConnection.meta_connected_at) && (
                          <p className="text-[10px] sm:text-xs text-green-500 mt-1">
                            Conectado em {new Date(metaConnection.instagram_connected_at || metaConnection.meta_connected_at!).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-blue-700">
                          <p className="font-medium mb-1">Pronto para receber mensagens!</p>
                          <p className="hidden sm:block">As mensagens do Instagram Direct aparecerão automaticamente no seu Inbox.</p>
                          <p className="sm:hidden">Mensagens aparecerão no Inbox.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDisconnectMeta('instagram')}
                      disabled={disconnectingMeta}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      {disconnectingMeta ? (
                        <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link_off</span>
                      )}
                      Desconectar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-slate-500 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-slate-600">
                          <p className="font-medium mb-1">Como funciona:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Clique em "Conectar Instagram"</li>
                            <li>Faça login no Facebook</li>
                            <li>Autorize o acesso</li>
                            <li className="hidden sm:list-item">Pronto! As mensagens aparecerão no Inbox</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-amber-600 text-lg sm:text-xl">warning</span>
                        <div className="text-xs sm:text-sm text-amber-700">
                          <p className="font-medium mb-1">Requisitos:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Conta Instagram Business</li>
                            <li className="hidden sm:list-item">Instagram vinculado a uma Página do Facebook</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {!metaAppId && (
                      <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="material-symbols-outlined text-red-600 text-lg sm:text-xl">error</span>
                          <div className="text-xs sm:text-sm text-red-700">
                            <p className="font-medium">Integração não disponível</p>
                            <p className="hidden sm:block">Entre em contato com o suporte para habilitar esta integração.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleConnectMeta('instagram')}
                      disabled={!metaAppId || connectingMeta}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                    >
                      {connectingMeta ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link</span>
                      )}
                      Conectar
                    </button>
                  </>
                )}

                {testResult && (
                  <div className={`p-3 sm:p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className={`material-symbols-outlined text-lg sm:text-xl ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? 'check_circle' : 'error'}
                      </span>
                      <span className={`text-xs sm:text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Facebook Tab */}
        {activeTab === 'facebook' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl sm:text-2xl text-white">thumb_up</span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-semibold text-slate-800">Facebook Messenger</h2>
                      <p className="text-[10px] sm:text-sm text-slate-500">Receba mensagens no Inbox</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMetaHelpModal(true)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Como funciona?"
                  >
                    <span className="material-symbols-outlined text-lg sm:text-xl">help</span>
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {metaConnection.facebook_enabled ? (
                  <>
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                      <span className="material-symbols-outlined text-green-600 text-lg sm:text-xl">check_circle</span>
                      <div>
                        <p className="font-medium text-green-800 text-sm sm:text-base">Facebook conectado</p>
                        <p className="text-xs sm:text-sm text-green-600 truncate max-w-[200px] sm:max-w-none">
                          {metaConnection.facebook_page_name || metaConnection.facebook_page_id}
                        </p>
                        {metaConnection.meta_connected_at && (
                          <p className="text-[10px] sm:text-xs text-green-500 mt-1">
                            Conectado em {new Date(metaConnection.meta_connected_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-blue-700">
                          <p className="font-medium mb-1">Pronto para receber mensagens!</p>
                          <p className="hidden sm:block">As mensagens do Messenger aparecerão automaticamente no seu Inbox.</p>
                          <p className="sm:hidden">Mensagens aparecerão no Inbox.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDisconnectMeta('facebook')}
                      disabled={disconnectingMeta}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      {disconnectingMeta ? (
                        <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link_off</span>
                      )}
                      Desconectar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-slate-500 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-slate-600">
                          <p className="font-medium mb-1">Como funciona:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Clique em "Conectar Facebook"</li>
                            <li>Faça login no Facebook</li>
                            <li>Selecione a Página</li>
                            <li className="hidden sm:list-item">Pronto! As mensagens aparecerão no Inbox</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-amber-600 text-lg sm:text-xl">warning</span>
                        <div className="text-xs sm:text-sm text-amber-700">
                          <p className="font-medium mb-1">Requisitos:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Página do Facebook</li>
                            <li>Ser administrador</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {!metaAppId && (
                      <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="material-symbols-outlined text-red-600 text-lg sm:text-xl">error</span>
                          <div className="text-xs sm:text-sm text-red-700">
                            <p className="font-medium">Integração não disponível</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleConnectMeta('facebook')}
                      disabled={!metaAppId || connectingMeta}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                    >
                      {connectingMeta ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link</span>
                      )}
                      Conectar
                    </button>
                  </>
                )}

                {testResult && (
                  <div className={`p-3 sm:p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className={`material-symbols-outlined text-lg sm:text-xl ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? 'check_circle' : 'error'}
                      </span>
                      <span className={`text-xs sm:text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Meta Ads Tab */}
        {activeTab === 'meta_ads' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xl sm:text-2xl">ads_click</span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-slate-900">Meta Ads API</h2>
                      <p className="text-[10px] sm:text-sm text-slate-500">Gerencie contas de anúncios</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddAccountModal(true)}
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">add</span>
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Lista de contas configuradas */}
                {metaAdsAccounts.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="text-xs sm:text-sm font-medium text-slate-700">Contas ({metaAdsAccounts.length})</h3>
                    {metaAdsAccounts.map((account) => (
                      <div key={account.id} className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${account.has_token ? 'bg-green-100' : 'bg-amber-100'}`}>
                            <span className={`material-symbols-outlined text-lg sm:text-xl ${account.has_token ? 'text-green-600' : 'text-amber-600'}`}>
                              {account.has_token ? 'check_circle' : 'warning'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{account.account_name}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500">***{account.account_id.slice(-6)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          {!account.has_token && (
                            <span className="text-[9px] sm:text-xs text-amber-600 bg-amber-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hidden sm:inline">Sem token</span>
                          )}
                          <button
                            onClick={() => handleEditMetaAccount(account)}
                            className="p-1.5 sm:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar token"
                          >
                            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteMetaAccount(account.id)}
                            disabled={deletingAccountId === account.id}
                            className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Remover conta"
                          >
                            {deletingAccountId === account.id ? (
                              <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                            ) : (
                              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">delete</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-400 mb-2">ads_click</span>
                    <p className="text-slate-600 font-medium text-sm">Nenhuma conta</p>
                    <p className="text-xs text-slate-500 mt-1">Adicione uma conta</p>
                  </div>
                )}

                <div className="p-3 sm:p-4 bg-pink-50 rounded-lg border border-pink-200">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span className="material-symbols-outlined text-pink-600 mt-0.5 text-lg sm:text-xl">info</span>
                    <div className="text-xs sm:text-sm text-pink-700">
                      <p className="font-medium mb-1">O que você pode fazer:</p>
                      <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                        <li>Ver dados das campanhas</li>
                        <li>Identificar origem dos leads</li>
                        <li className="hidden sm:list-item">Analisar performance por campanha</li>
                        <li className="hidden sm:list-item">Gerenciar múltiplas contas</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Guia passo a passo */}
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <button 
                    onClick={() => setShowMetaAdsHelpModal(true)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="material-symbols-outlined text-slate-600 text-lg sm:text-xl">help</span>
                      <div>
                        <p className="font-medium text-slate-800 text-xs sm:text-sm">Como conectar?</p>
                        <p className="text-[10px] sm:text-xs text-slate-500">Ver passo a passo</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-lg sm:text-xl">chevron_right</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 sm:p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className={`material-symbols-outlined text-lg sm:text-xl ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? 'check_circle' : 'error'}
                      </span>
                      <span className={`text-xs sm:text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {testResult.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Teste SMTP */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !testing && setShowTestModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">mail</span>
                Testar Conexão SMTP
              </h3>
              <p className="text-sm text-slate-500 mt-1">Envie um email de teste para verificar a configuração</p>
            </div>
            
            <div className="p-6">
              {!testResult ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email para receber o teste</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={testing}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTestModal(false)}
                      disabled={testing}
                      className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleTestConnection}
                      disabled={!testEmail || testing}
                      className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {testing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">send</span>
                          Enviar Teste
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    testResult.success ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl ${
                      testResult.success ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {testResult.success ? 'check_circle' : 'error'}
                    </span>
                  </div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    testResult.success ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? 'Sucesso!' : 'Erro'}
                  </h4>
                  <p className="text-slate-600 text-sm mb-6">{testResult.message}</p>
                  <button
                    onClick={() => {
                      setTestResult(null);
                      setShowTestModal(false);
                    }}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      testResult.success 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuda Meta */}
      {showMetaHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMetaHelpModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined">help</span>
                  Como funciona a integração?
                </h3>
                <button onClick={() => setShowMetaHelpModal(false)} className="text-white/80 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
                  <div>
                    <p className="font-medium text-blue-800 mb-2">Por que abre o Facebook?</p>
                    <p className="text-sm text-blue-700">
                      O Instagram usa a API do Facebook para autenticação. A Meta (dona do Facebook e Instagram) 
                      unificou tudo em uma única plataforma. Por isso, você faz login pelo Facebook.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600">checklist</span>
                  Passo a passo
                </h4>
                <ol className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <span>Clique em "Conectar Instagram" ou "Conectar Facebook"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <span>Faça login na sua conta do <strong>Facebook</strong> (mesmo para Instagram)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <span>Autorize as permissões solicitadas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <span>Selecione a <strong>Página do Facebook</strong> que deseja conectar</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                    <span>Pronto! O popup fecha automaticamente e as mensagens aparecerão no Inbox</span>
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
                  <div>
                    <p className="font-medium text-amber-800 mb-2">Requisitos importantes</p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        Conta Instagram deve ser <strong>Business</strong> ou <strong>Creator</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        Instagram deve estar <strong>vinculado a uma Página do Facebook</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        Você deve ser <strong>administrador</strong> da Página
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-green-600 mt-0.5">lightbulb</span>
                  <div>
                    <p className="font-medium text-green-800 mb-2">Dica</p>
                    <p className="text-sm text-green-700">
                      Se você conectar uma Página que tem Instagram Business vinculado, 
                      <strong> ambos serão conectados automaticamente</strong> (Facebook Messenger + Instagram Direct).
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowMetaHelpModal(false)}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuda Meta Ads */}
      {showMetaAdsHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMetaAdsHelpModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-pink-500 to-rose-600">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined">ads_click</span>
                  Como conectar o Meta Ads
                </h3>
                <button onClick={() => setShowMetaAdsHelpModal(false)} className="text-white/80 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Encontrar o ID da Conta de Anúncios
                </h4>
                <ol className="space-y-2 text-sm text-slate-600 ml-8">
                  <li>1. Acesse <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">business.facebook.com/settings/ad-accounts</a></li>
                  <li>2. Selecione sua conta de anúncios</li>
                  <li>3. O ID aparece no topo da página (número de 15-16 dígitos)</li>
                  <li>4. Copie apenas o número, sem "act_"</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  Gerar o Access Token
                </h4>
                <ol className="space-y-2 text-sm text-slate-600 ml-8">
                  <li>1. Acesse <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">developers.facebook.com/tools/explorer</a></li>
                  <li>2. Selecione seu aplicativo no dropdown</li>
                  <li>3. Clique em "Gerar Token de Acesso"</li>
                  <li>4. Adicione as permissões: <strong>ads_read</strong>, <strong>ads_management</strong>, <strong>business_management</strong></li>
                  <li>5. Clique em "Gerar Token de Acesso" novamente</li>
                  <li>6. Copie o token gerado (começa com "EAAQ...")</li>
                </ol>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
                  <div>
                    <p className="font-medium text-amber-800 mb-1">Importante</p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• O token expira em 60 dias - será necessário renovar</li>
                      <li>• Use um token de <strong>Usuário</strong>, não de Aplicativo</li>
                      <li>• Você deve ter acesso de administrador à conta de anúncios</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-green-600 mt-0.5">lightbulb</span>
                  <div>
                    <p className="font-medium text-green-800 mb-1">O que você poderá ver</p>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Impressões, cliques, CTR e CPC de cada campanha</li>
                      <li>• Gasto total por período</li>
                      <li>• Performance detalhada por campanha</li>
                      <li>• Status das campanhas (ativas/pausadas)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowMetaAdsHelpModal(false)}
                className="w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Conta Meta Ads */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddAccountModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-pink-500 to-rose-600">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined">add_circle</span>
                Adicionar Conta Meta Ads
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome da Conta *</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Ex: Dra. Kamylle"
                  className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">ID da Conta de Anúncios *</label>
                <input
                  type="text"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  placeholder="Ex: 2069136123539168"
                  className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <p className="text-xs text-slate-400 mt-1">Encontre em: Meta Business Suite → Configurações → Conta de anúncios</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">Access Token (opcional)</label>
                <input
                  type="password"
                  value={newAccountToken}
                  onChange={(e) => setNewAccountToken(e.target.value)}
                  placeholder="Token com permissões ads_read"
                  className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <p className="text-xs text-slate-400 mt-1">Se não informar, usará o token da conta principal</p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddAccountModal(false);
                    setNewAccountId('');
                    setNewAccountName('');
                    setNewAccountToken('');
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddMetaAccount}
                  disabled={savingMetaAds || !newAccountId || !newAccountName}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingMetaAds ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  )}
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Cloud API Tab */}
      {activeTab === 'whatsapp' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl sm:text-2xl text-emerald-600">chat</span>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-semibold text-slate-800">WhatsApp Cloud API</h2>
                    <p className="text-[10px] sm:text-sm text-slate-500">API Oficial do Meta</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {whatsappCloudConfig?.cloud_api_enabled && whatsappCloudConfig?.cloud_api_phone_number_id ? (
                <>
                  <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                    <span className="material-symbols-outlined text-green-600 text-lg sm:text-xl">check_circle</span>
                    <div>
                      <p className="font-medium text-green-800 text-sm sm:text-base">WhatsApp conectado</p>
                      <p className="text-xs sm:text-sm text-green-600 truncate max-w-[180px] sm:max-w-none">
                        {whatsappCloudConfig.cloud_api_phone_number || `ID: ${whatsappCloudConfig.cloud_api_phone_number_id}`}
                      </p>
                      {whatsappCloudConfig.cloud_api_connected_at && (
                        <p className="text-[10px] sm:text-xs text-green-500 mt-1">
                          Conectado em {new Date(whatsappCloudConfig.cloud_api_connected_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">info</span>
                      <div className="text-xs sm:text-sm text-blue-700">
                        <p className="font-medium mb-1">Pronto para usar!</p>
                        <p className="hidden sm:block">Você pode enviar e receber mensagens via API Oficial do WhatsApp.</p>
                        <p className="sm:hidden">Envie e receba mensagens.</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnectWhatsApp}
                    disabled={connectingWhatsApp}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    {connectingWhatsApp ? (
                      <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link_off</span>
                    )}
                    Desconectar
                  </button>
                </>
              ) : (
                <>
                  {/* Seletor de modo de conexão */}
                  <div className="p-3 sm:p-4 bg-white rounded-lg border border-slate-200">
                    <p className="font-medium text-slate-700 mb-2 sm:mb-3 text-xs sm:text-sm">Modo de conexão:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={() => setConnectionMode('new')}
                        className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                          connectionMode === 'new'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <span className={`material-symbols-outlined text-lg sm:text-xl ${connectionMode === 'new' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            add_circle
                          </span>
                          <span className="font-medium text-slate-800 text-xs sm:text-sm">Número Novo</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500">
                          Número NÃO está no WhatsApp Business App
                        </p>
                      </button>
                      
                      <button
                        onClick={() => setConnectionMode('coexistence')}
                        className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                          connectionMode === 'coexistence'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <span className={`material-symbols-outlined text-lg sm:text-xl ${connectionMode === 'coexistence' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            sync
                          </span>
                          <span className="font-medium text-slate-800 text-xs sm:text-sm">Coexistência</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500">
                          Manter App + Cloud API
                        </p>
                      </button>
                    </div>
                  </div>

                  {connectionMode === 'coexistence' ? (
                    <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-blue-600 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-blue-700">
                          <p className="font-medium mb-1">Modo Coexistência:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Continue usando o App no celular</li>
                            <li>Mensagens espelhadas</li>
                            <li className="hidden sm:list-item">Histórico dos últimos 6 meses pode ser sincronizado</li>
                            <li className="hidden sm:list-item">Requer WhatsApp Business App 2.24.17+</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-slate-500 text-lg sm:text-xl">info</span>
                        <div className="text-xs sm:text-sm text-slate-600">
                          <p className="font-medium mb-1">Número Novo:</p>
                          <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                            <li>Número NÃO registrado no WhatsApp</li>
                            <li>Uso exclusivo pela Cloud API</li>
                            <li className="hidden sm:list-item">Não poderá usar o WhatsApp App com esse número</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="material-symbols-outlined text-amber-600 text-lg sm:text-xl">warning</span>
                      <div className="text-xs sm:text-sm text-amber-700">
                        <p className="font-medium mb-1">Requisitos:</p>
                        <ul className="list-disc list-inside space-y-0.5 sm:space-y-1">
                          <li>Conta WhatsApp Business</li>
                          <li>Meta Business Manager</li>
                          {connectionMode === 'coexistence' && (
                            <li className="hidden sm:list-item">WhatsApp Business App 2.24.17+</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {!metaAppId && (
                    <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="material-symbols-outlined text-red-600 text-lg sm:text-xl">error</span>
                        <div className="text-xs sm:text-sm text-red-700">
                          <p className="font-medium">Integração não disponível</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleConnectWhatsApp}
                    disabled={!metaAppId || connectingWhatsApp}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {connectingWhatsApp ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link</span>
                    )}
                    {connectionMode === 'coexistence' ? 'Conectar' : 'Conectar'}
                  </button>
                </>
              )}

              {testResult && (
                <div className={`p-3 sm:p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`material-symbols-outlined text-lg sm:text-xl ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult.success ? 'check_circle' : 'error'}
                    </span>
                    <p className={`text-xs sm:text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Token da Conta */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingAccount(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined">edit</span>
                Editar Token - {editingAccount.name}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Access Token</label>
                <input
                  type="password"
                  value={editAccountToken}
                  onChange={(e) => setEditAccountToken(e.target.value)}
                  placeholder="Cole o novo token aqui"
                  className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Gere em: developers.facebook.com → Graph API Explorer</p>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 mt-0.5">info</span>
                  <div className="text-sm text-amber-700">
                    <p className="font-medium mb-1">Permissões necessárias:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>ads_read</li>
                      <li>ads_management</li>
                      <li>business_management</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setEditingAccount(null);
                    setEditAccountToken('');
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditAccount}
                  disabled={savingMetaAds || !editAccountToken}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingMetaAds ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">save</span>
                  )}
                  Salvar Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
