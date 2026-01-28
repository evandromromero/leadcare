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

export default function Integrations() {
  const { user, loading: authLoading, isImpersonating, impersonatedClinic } = useAuth();
  // Usar clinicId do impersonate se estiver ativo, senão usar do usuário
  const clinicId = isImpersonating ? impersonatedClinic?.id : user?.clinicId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [emailMarketingEnabled, setEmailMarketingEnabled] = useState(false);
  
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
        const { data, error } = await (supabase as any)
          .from('clinics')
          .select('email_marketing_enabled, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_encryption')
          .eq('id', clinicId)
          .single();
        
        if (error) {
          console.error('Erro ao buscar configurações:', error);
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
    <div className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Integrações</h1>
          <p className="text-slate-500">Configure suas integrações externas</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Marketing SMTP */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-purple-600">mail</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Email Marketing (SMTP)</h2>
                <p className="text-sm text-slate-500">Configure seu servidor SMTP para envio de emails</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Informações do servidor */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Como obter as credenciais SMTP?</p>
                  <p>Acesse o painel do seu provedor de email (Hostinger, Gmail, etc.) e procure por "Configurações SMTP" ou "Email Settings".</p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Host SMTP *
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                  placeholder="smtp.hostinger.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Porta *
                </label>
                <input
                  type="number"
                  value={smtpConfig.smtp_port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 465 })}
                  placeholder="465"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Usuário/Email *
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={smtpConfig.smtp_password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Remetente
                </label>
                <input
                  type="email"
                  value={smtpConfig.smtp_from_email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from_email: e.target.value })}
                  placeholder="contato@suaempresa.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">Se vazio, usará o email de usuário</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome Remetente
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtp_from_name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from_name: e.target.value })}
                  placeholder="Sua Empresa"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Criptografia *
                </label>
                <div className="flex gap-4">
                  {[
                    { value: 'ssl', label: 'SSL (Porta 465)', desc: 'Recomendado' },
                    { value: 'tls', label: 'TLS (Porta 587)', desc: 'Alternativa' },
                    { value: 'none', label: 'Nenhuma', desc: 'Não recomendado' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex-1 p-4 border rounded-lg cursor-pointer transition-all ${
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
                      <span className="font-medium text-slate-800">{option.label}</span>
                      <span className="block text-xs text-slate-500 mt-1">{option.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado do teste */}
            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? 'check_circle' : 'error'}
                  </span>
                  <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={handleOpenTestModal}
                disabled={!smtpConfig.smtp_host || !smtpConfig.smtp_user}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Testar Conexão
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Configurações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Configurações comuns de SMTP */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Configurações Comuns de SMTP</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="pb-3 font-medium text-slate-600">Provedor</th>
                  <th className="pb-3 font-medium text-slate-600">Host</th>
                  <th className="pb-3 font-medium text-slate-600">Porta</th>
                  <th className="pb-3 font-medium text-slate-600">Criptografia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-800">Hostinger</td>
                  <td className="py-3 text-slate-600">smtp.hostinger.com</td>
                  <td className="py-3 text-slate-600">465</td>
                  <td className="py-3 text-slate-600">SSL</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-800">Gmail</td>
                  <td className="py-3 text-slate-600">smtp.gmail.com</td>
                  <td className="py-3 text-slate-600">587</td>
                  <td className="py-3 text-slate-600">TLS</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-800">Outlook/Office 365</td>
                  <td className="py-3 text-slate-600">smtp.office365.com</td>
                  <td className="py-3 text-slate-600">587</td>
                  <td className="py-3 text-slate-600">TLS</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-800">SendGrid</td>
                  <td className="py-3 text-slate-600">smtp.sendgrid.net</td>
                  <td className="py-3 text-slate-600">587</td>
                  <td className="py-3 text-slate-600">TLS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div>
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
    </div>
  );
}
