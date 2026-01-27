import React, { useState, useEffect } from 'react';
import { Save, Key, Globe, Search, Image, Type, FileText, Upload, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Settings {
  evolution_api_url: string;
  evolution_api_key: string;
  // Proxy
  proxy_host: string;
  proxy_port: string;
  proxy_protocol: string;
  proxy_username: string;
  proxy_password: string;
  // EasyPanel
  easypanel_url: string;
  easypanel_token: string;
  easypanel_project: string;
  easypanel_service: string;
  // SEO
  site_title: string;
  site_description: string;
  site_keywords: string;
  favicon_url: string;
  // Login Page
  login_logo_url: string;
  login_background_url: string;
  login_title: string;
  login_subtitle: string;
  login_footer_text: string;
  // Suporte
  support_enabled: boolean;
  support_online: boolean;
}

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    evolution_api_url: '',
    evolution_api_key: '',
    // Proxy
    proxy_host: '',
    proxy_port: '12321',
    proxy_protocol: 'http',
    proxy_username: '',
    proxy_password: '',
    // EasyPanel
    easypanel_url: '',
    easypanel_token: '',
    easypanel_project: 'evolutionaoi',
    easypanel_service: 'evolution-api',
    // SEO
    site_title: 'Belitx',
    site_description: 'CRM de WhatsApp completo para clínicas',
    site_keywords: 'crm, whatsapp, clínicas, leads, atendimento',
    favicon_url: '',
    // Login Page
    login_logo_url: '',
    login_background_url: '',
    login_title: 'Potencialize suas vendas e gerencie clínicas em um só lugar.',
    login_subtitle: 'A plataforma completa para gestão de leads, atendimento multicanal e performance de equipe.',
    login_footer_text: '+2k Clínicas conectadas hoje.',
    // Suporte
    support_enabled: false,
    support_online: false,
  });
  const [activeTab, setActiveTab] = useState<'api' | 'seo' | 'login'>('api');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const uploadImage = async (file: File, fieldName: string) => {
    setUploading(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${fieldName}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, [fieldName]: publicUrl }));
      setMessage({ type: 'success', text: 'Imagem enviada com sucesso!' });
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao enviar imagem' });
    } finally {
      setUploading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Arquivo muito grande. Máximo 5MB.' });
        return;
      }
      uploadImage(file, fieldName);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const d = data as any;
        setSettings({
          evolution_api_url: d.evolution_api_url || '',
          evolution_api_key: d.evolution_api_key || '',
          // Proxy
          proxy_host: d.proxy_host || '',
          proxy_port: d.proxy_port || '12321',
          proxy_protocol: d.proxy_protocol || 'http',
          proxy_username: d.proxy_username || '',
          proxy_password: d.proxy_password || '',
          // EasyPanel
          easypanel_url: d.easypanel_url || '',
          easypanel_token: d.easypanel_token || '',
          easypanel_project: d.easypanel_project || 'evolutionaoi',
          easypanel_service: d.easypanel_service || 'evolution-api',
          // SEO
          site_title: d.site_title || 'Belitx',
          site_description: d.site_description || 'CRM de WhatsApp completo para clínicas',
          site_keywords: d.site_keywords || 'crm, whatsapp, clínicas, leads, atendimento',
          favicon_url: d.favicon_url || '',
          // Login Page
          login_logo_url: d.login_logo_url || '',
          login_background_url: d.login_background_url || '',
          login_title: d.login_title || 'Potencialize suas vendas e gerencie clínicas em um só lugar.',
          login_subtitle: d.login_subtitle || 'A plataforma completa para gestão de leads, atendimento multicanal e performance de equipe.',
          login_footer_text: d.login_footer_text || '+2k Clínicas conectadas hoje.',
          // Suporte
          support_enabled: d.support_enabled || false,
          support_online: d.support_online || false,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 1,
          evolution_api_url: settings.evolution_api_url,
          evolution_api_key: settings.evolution_api_key,
          // Proxy
          proxy_host: settings.proxy_host,
          proxy_port: settings.proxy_port,
          proxy_protocol: settings.proxy_protocol,
          proxy_username: settings.proxy_username,
          proxy_password: settings.proxy_password,
          // EasyPanel
          easypanel_url: settings.easypanel_url,
          easypanel_token: settings.easypanel_token,
          easypanel_project: settings.easypanel_project,
          easypanel_service: settings.easypanel_service,
          // SEO
          site_title: settings.site_title,
          site_description: settings.site_description,
          site_keywords: settings.site_keywords,
          favicon_url: settings.favicon_url,
          // Login Page
          login_logo_url: settings.login_logo_url,
          login_background_url: settings.login_background_url,
          login_title: settings.login_title,
          login_subtitle: settings.login_subtitle,
          login_footer_text: settings.login_footer_text,
          // Suporte
          support_enabled: settings.support_enabled,
          support_online: settings.support_online,
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Configurações globais do sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
            activeTab === 'api'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Evolution </span>API
        </button>
        <button
          onClick={() => setActiveTab('seo')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
            activeTab === 'seo'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Search className="w-4 h-4 inline mr-1 sm:mr-2" />
          SEO
        </button>
        <button
          onClick={() => setActiveTab('login')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
            activeTab === 'login'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Image className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Página de </span>Login
        </button>
      </div>

      <div className="max-w-2xl">
        {/* Evolution API Tab */}
        {activeTab === 'api' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">Evolution API</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Configurações de integração com WhatsApp</p>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-2" />
                  URL da API
                </label>
                <input
                  type="url"
                  value={settings.evolution_api_url}
                  onChange={(e) => setSettings({ ...settings, evolution_api_url: e.target.value })}
                  placeholder="https://api.evolution.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Key className="w-4 h-4 inline mr-2" />
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.evolution_api_key}
                  onChange={(e) => setSettings({ ...settings, evolution_api_key: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Proxy Config - Shown when API tab is active */}
        {activeTab === 'api' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">
                <Shield className="w-5 h-5 inline mr-2 text-green-600" />
                Configuração de Proxy
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Proxy residencial para proteção contra banimento</p>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Host
                  </label>
                  <input
                    type="text"
                    value={settings.proxy_host}
                    onChange={(e) => setSettings({ ...settings, proxy_host: e.target.value })}
                    placeholder="geo.iproyal.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Porta
                  </label>
                  <input
                    type="text"
                    value={settings.proxy_port}
                    onChange={(e) => setSettings({ ...settings, proxy_port: e.target.value })}
                    placeholder="12321"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Protocolo
                </label>
                <select
                  value={settings.proxy_protocol}
                  onChange={(e) => setSettings({ ...settings, proxy_protocol: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={settings.proxy_username}
                    onChange={(e) => setSettings({ ...settings, proxy_username: e.target.value })}
                    placeholder="username"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={settings.proxy_password}
                    onChange={(e) => setSettings({ ...settings, proxy_password: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {settings.proxy_host && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Proxy configurado:</span> {settings.proxy_protocol}://{settings.proxy_host}:{settings.proxy_port}
                  </p>
                </div>
              )}

              {settings.proxy_host && (
                <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <strong>Nota:</strong> O proxy será aplicado automaticamente em novas instâncias. Instâncias existentes precisam ser recriadas para usar o proxy.
                </p>
              )}
            </div>
          </div>
        )}

        {/* EasyPanel Config - Shown when API tab is active */}
        {activeTab === 'api' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">
                <Globe className="w-5 h-5 inline mr-2 text-orange-600" />
                EasyPanel (Restart Evolution)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Configurações para reiniciar a Evolution API remotamente</p>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    URL do EasyPanel
                  </label>
                  <input
                    type="url"
                    value={settings.easypanel_url}
                    onChange={(e) => setSettings({ ...settings, easypanel_url: e.target.value })}
                    placeholder="http://72.61.40.210:3000"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Token de API
                  </label>
                  <input
                    type="password"
                    value={settings.easypanel_token}
                    onChange={(e) => setSettings({ ...settings, easypanel_token: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Projeto
                  </label>
                  <input
                    type="text"
                    value={settings.easypanel_project}
                    onChange={(e) => setSettings({ ...settings, easypanel_project: e.target.value })}
                    placeholder="evolutionaoi"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Serviço
                  </label>
                  <input
                    type="text"
                    value={settings.easypanel_service}
                    onChange={(e) => setSettings({ ...settings, easypanel_service: e.target.value })}
                    placeholder="evolution-api"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Essas configurações permitem reiniciar a Evolution API diretamente do painel Admin &gt; WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">Configurações SEO</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Meta tags e otimização para buscadores</p>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Type className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Título do Site
                </label>
                <input
                  type="text"
                  value={settings.site_title}
                  onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
                  placeholder="Belitx"
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Aparece na aba do navegador</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <FileText className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Descrição do Site
                </label>
                <textarea
                  value={settings.site_description}
                  onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                  placeholder="CRM de WhatsApp completo para clínicas"
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Meta description (máx. 160 caracteres)</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Search className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Palavras-chave
                </label>
                <input
                  type="text"
                  value={settings.site_keywords}
                  onChange={(e) => setSettings({ ...settings, site_keywords: e.target.value })}
                  placeholder="crm, whatsapp, clínicas, leads"
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Separadas por vírgula</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Image className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Favicon
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={settings.favicon_url}
                    onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
                    placeholder="https://exemplo.com/favicon.ico"
                    className="flex-1 px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <label className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors text-sm ${uploading === 'favicon_url' ? 'opacity-50' : ''}`}>
                    <Upload className="w-4 h-4" />
                    {uploading === 'favicon_url' ? 'Enviando...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*,.ico"
                      onChange={(e) => handleFileChange(e, 'favicon_url')}
                      className="hidden"
                      disabled={uploading === 'favicon_url'}
                    />
                  </label>
                </div>
                {settings.favicon_url && (
                  <div className="mt-2 p-2 bg-slate-100 rounded-lg inline-block">
                    <img src={settings.favicon_url} alt="Favicon Preview" className="h-8 w-8 object-contain" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Login Page Tab */}
        {activeTab === 'login' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">Página de Login</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Personalize a aparência da tela de login</p>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Upload className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Logomarca
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={settings.login_logo_url}
                    onChange={(e) => setSettings({ ...settings, login_logo_url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                    className="flex-1 px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <label className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors text-sm ${uploading === 'login_logo_url' ? 'opacity-50' : ''}`}>
                    <Upload className="w-4 h-4" />
                    {uploading === 'login_logo_url' ? 'Enviando...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'login_logo_url')}
                      className="hidden"
                      disabled={uploading === 'login_logo_url'}
                    />
                  </label>
                </div>
                {settings.login_logo_url && (
                  <div className="mt-2 p-3 sm:p-4 bg-slate-100 rounded-lg">
                    <img src={settings.login_logo_url} alt="Preview" className="h-10 sm:h-12 object-contain" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Image className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Imagem de Fundo
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={settings.login_background_url}
                    onChange={(e) => setSettings({ ...settings, login_background_url: e.target.value })}
                    placeholder="https://exemplo.com/background.jpg"
                    className="flex-1 px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <label className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors text-sm ${uploading === 'login_background_url' ? 'opacity-50' : ''}`}>
                    <Upload className="w-4 h-4" />
                    {uploading === 'login_background_url' ? 'Enviando...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'login_background_url')}
                      className="hidden"
                      disabled={uploading === 'login_background_url'}
                    />
                  </label>
                </div>
                {settings.login_background_url && (
                  <div className="mt-2 p-2 bg-slate-100 rounded-lg">
                    <img src={settings.login_background_url} alt="Preview" className="h-20 sm:h-24 w-full object-cover rounded" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Type className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Título Principal
                </label>
                <textarea
                  value={settings.login_title}
                  onChange={(e) => setSettings({ ...settings, login_title: e.target.value })}
                  placeholder="Potencialize suas vendas..."
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <FileText className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Subtítulo
                </label>
                <textarea
                  value={settings.login_subtitle}
                  onChange={(e) => setSettings({ ...settings, login_subtitle: e.target.value })}
                  placeholder="A plataforma completa..."
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  <Type className="w-4 h-4 inline mr-1 sm:mr-2" />
                  Texto do Rodapé
                </label>
                <input
                  type="text"
                  value={settings.login_footer_text}
                  onChange={(e) => setSettings({ ...settings, login_footer_text: e.target.value })}
                  placeholder="+2k Clínicas conectadas hoje."
                  className="w-full px-3 sm:px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Message and Save Button */}
        <div className="mt-6">
          {message && (
            <div className={`p-4 rounded-lg mb-4 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
