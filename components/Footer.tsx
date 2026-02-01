import React, { useState } from 'react';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    descricao: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      // Buscar configurações da Evolution API do banco
      const { data: settingsData } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      const settings = settingsData as unknown as { evolution_api_url: string; evolution_api_key: string } | null;
      
      if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
        throw new Error('Configurações da Evolution API não encontradas');
      }

      // Formatar mensagem
      const mensagem = `*Solicitação de Orçamento - Betix*\n\n` +
        `*Nome:* ${formData.nome}\n` +
        `*Telefone:* ${formData.telefone}\n\n` +
        `*Descrição do Projeto:*\n${formData.descricao}`;

      // Enviar via Evolution API (instância: evandromorais)
      const response = await fetch(`${settings.evolution_api_url}/message/sendText/evandromorais`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolution_api_key,
        },
        body: JSON.stringify({
          number: '5567992400040',
          text: mensagem,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem');
      }

      setSent(true);
      setFormData({ nome: '', telefone: '', descricao: '' });
      
      // Fechar modal após 3 segundos
      setTimeout(() => {
        setShowModal(false);
        setSent(false);
      }, 3000);
    } catch (err) {
      setError('Erro ao enviar. Tente novamente ou entre em contato pelo WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <footer className={`bg-white border-t border-slate-200 py-2 px-4 shrink-0 ${className}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-slate-500">
            <span>© 2026 Betix - Todos os direitos reservados</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>Desenvolvido por <strong className="text-cyan-600">Alpha Omega MS</strong></span>
          </div>
          
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-xs font-medium"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Solicitar Orçamento
          </button>
        </div>
      </footer>

      {/* Modal de Orçamento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Solicitar Orçamento</h3>
                <p className="text-xs text-slate-500">Desenvolva seu próprio sistema</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-2">Mensagem Enviada!</h4>
                  <p className="text-sm text-slate-500">Entraremos em contato em breve.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                      placeholder="(67) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Descreva seu projeto *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm resize-none"
                      placeholder="Descreva o sistema que você gostaria de desenvolver..."
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Orçamento
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
