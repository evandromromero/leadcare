import React, { useState, useEffect } from 'react';
import { Save, Key, Globe } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Settings {
  evolution_api_url: string;
  evolution_api_key: string;
}

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    evolution_api_url: '',
    evolution_api_key: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setSettings({
          evolution_api_url: data.evolution_api_url || '',
          evolution_api_key: data.evolution_api_key || '',
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
          updated_at: new Date().toISOString(),
        });

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
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500 mt-1">Configurações globais do sistema</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Evolution API</h2>
            <p className="text-sm text-slate-500 mt-1">Configurações de integração com WhatsApp</p>
          </div>

          <div className="p-6 space-y-6">
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

            {message && (
              <div className={`p-4 rounded-lg ${
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
    </div>
  );
};

export default AdminSettings;
