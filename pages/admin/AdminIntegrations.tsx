import React, { useState, useEffect } from 'react';
import { Save, Key, BarChart3, Facebook, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface IntegrationSettings {
  facebook_ads_account_id: string;
  facebook_ads_token: string;
}

const AdminIntegrations: React.FC = () => {
  const [settings, setSettings] = useState<IntegrationSettings>({
    facebook_ads_account_id: '',
    facebook_ads_token: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('facebook_ads_account_id, facebook_ads_token')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const d = data as any;
        setSettings({
          facebook_ads_account_id: d.facebook_ads_account_id || '',
          facebook_ads_token: d.facebook_ads_token || '',
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
        .update({
          facebook_ads_account_id: settings.facebook_ads_account_id,
          facebook_ads_token: settings.facebook_ads_token,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', 1 as any);

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
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Integrações</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Configure integrações com serviços externos</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Facebook Ads API */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Facebook className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-800">Facebook Ads API</h2>
                <p className="text-xs sm:text-sm text-slate-500">Exibir dados de campanhas no CRM</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <BarChart3 className="w-4 h-4 inline mr-2" />
                ID da Conta de Anúncios
              </label>
              <input
                type="text"
                value={settings.facebook_ads_account_id}
                onChange={(e) => setSettings({ ...settings, facebook_ads_account_id: e.target.value })}
                placeholder="2069136123539168"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Encontre em: Gerenciador de Anúncios → Configurações → ID da Conta
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Key className="w-4 h-4 inline mr-2" />
                Token de Acesso
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={settings.facebook_ads_token}
                  onChange={(e) => setSettings({ ...settings, facebook_ads_token: e.target.value })}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full px-4 py-2 pr-12 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Token de cliente do aplicativo Meta
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Parâmetros disponíveis:</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 
                  'ad_id', 'ad_name', 'spend', 'impressions', 'clicks', 
                  'cpc', 'cpm', 'cpp', 'ctr', 'objective', 'reach', 'actions', 'account_name'
                ].map(param => (
                  <span key={param} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                    {param}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminIntegrations;
