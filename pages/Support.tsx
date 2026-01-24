import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSupport, SupportTicket, SupportMessage } from '../hooks/useSupport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmojiPicker from '../components/EmojiPicker';

const Support: React.FC = () => {
  const { user } = useAuth();
  const clinicId = user?.clinicId;
  const {
    tickets,
    messages,
    selectedTicket,
    setSelectedTicket,
    loading,
    supportSettings,
    clinicSupportEnabled,
    createTicket,
    sendMessage,
    markMessagesAsRead,
  } = useSupport(clinicId, user?.id);

  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState<'support' | 'improvement' | 'bug' | 'question' | 'other'>('support');
  const [messageInput, setMessageInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [liveChatMessage, setLiveChatMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'ticket' | 'live_chat'

  // Categorias disponíveis
  const categories = [
    { value: 'support', label: 'Suporte', icon: 'support_agent', color: 'cyan' },
    { value: 'improvement', label: 'Melhorias', icon: 'lightbulb', color: 'purple' },
    { value: 'bug', label: 'Bug/Erro', icon: 'bug_report', color: 'red' },
    { value: 'question', label: 'Dúvida', icon: 'help', color: 'blue' },
    { value: 'other', label: 'Outro', icon: 'more_horiz', color: 'slate' },
  ] as const;

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Marcar mensagens como lidas quando abrir ticket
  useEffect(() => {
    if (selectedTicket) {
      markMessagesAsRead(selectedTicket.id, false);
    }
  }, [selectedTicket, markMessagesAsRead]);

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;
    
    setCreating(true);
    const ticket = await createTicket(newTicketSubject, newTicketMessage, newTicketCategory, false);
    setCreating(false);
    
    if (ticket) {
      setShowNewTicketModal(false);
      setNewTicketSubject('');
      setNewTicketMessage('');
      setNewTicketCategory('support');
      setSelectedTicket(ticket);
    }
  };

  // Iniciar chat ao vivo
  const handleStartLiveChat = async () => {
    if (!liveChatMessage.trim()) return;
    
    setCreating(true);
    const ticket = await createTicket('Chat ao Vivo', liveChatMessage, 'support', true);
    setCreating(false);
    
    if (ticket) {
      setLiveChatMessage('');
      setSelectedTicket(ticket);
      setShowLiveChat(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedTicket) return;
    
    setSending(true);
    await sendMessage(selectedTicket.id, messageInput, false);
    setSending(false);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-slate-600';
      default: return 'text-slate-600';
    }
  };

  const getCategoryInfo = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat || { label: 'Suporte', icon: 'support_agent', color: 'cyan' };
  };

  // Se suporte não está habilitado
  if (!supportSettings.support_enabled || !clinicSupportEnabled) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">support_agent</span>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Suporte Indisponível</h2>
          <p className="text-slate-500">O suporte não está habilitado no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <span className="material-symbols-outlined text-cyan-600">support_agent</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Suporte</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${supportSettings.support_online ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                <span className="text-sm text-slate-500">
                  {supportSettings.support_online ? 'Suporte Online' : 'Suporte Offline'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Ticket
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Tickets */}
        <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 bg-white border-r border-slate-200`}>
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-medium text-slate-700 mb-3">Meus Tickets</h2>
            {/* Filtro por Tipo */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'Todos', icon: 'list' },
                { key: 'live_chat', label: 'Chats', icon: 'chat' },
                { key: 'ticket', label: 'Tickets', icon: 'confirmation_number' },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setFilterType(filter.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-colors ${
                    filterType === filter.key
                      ? filter.key === 'live_chat' 
                        ? 'bg-green-600 text-white' 
                        : filter.key === 'ticket'
                          ? 'bg-orange-600 text-white'
                          : 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{filter.icon}</span>
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
              </div>
            ) : tickets.filter(t => 
                filterType === 'all' || 
                (filterType === 'live_chat' && (t as any).is_live_chat) ||
                (filterType === 'ticket' && !(t as any).is_live_chat)
              ).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">inbox</span>
                <p className="text-slate-500 text-center">Nenhum ticket ainda</p>
                <p className="text-slate-400 text-sm text-center mt-1">Clique em "Novo Ticket" para abrir uma solicitação</p>
              </div>
            ) : (
              tickets.filter(t => 
                filterType === 'all' || 
                (filterType === 'live_chat' && (t as any).is_live_chat) ||
                (filterType === 'ticket' && !(t as any).is_live_chat)
              ).map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 border-b cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedTicket?.id === ticket.id 
                      ? 'bg-cyan-50 border-l-4 border-l-cyan-600' 
                      : (ticket as any).is_live_chat 
                        ? 'border-l-4 border-l-green-500 border-b-slate-100' 
                        : 'border-l-4 border-l-orange-400 border-b-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 line-clamp-1">{ticket.subject}</h3>
                      {(ticket as any).is_live_chat ? (
                        <span className="flex items-center gap-0.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="material-symbols-outlined text-[10px]">chat</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full shrink-0">
                          <span className="material-symbols-outlined text-[10px]">confirmation_number</span>
                        </span>
                      )}
                    </div>
                    {(ticket.unread_count ?? 0) > 0 && (
                      <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {ticket.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                    <span className={`material-symbols-outlined text-[14px] ${getPriorityColor(ticket.priority)}`}>
                      flag
                    </span>
                  </div>
                  {ticket.last_message && (
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {ticket.last_message.is_from_support ? 'Suporte: ' : 'Você: '}
                      {ticket.last_message.content}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    {format(new Date(ticket.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat do Ticket */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col bg-slate-50">
            {/* Header do Chat */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex-1">
                <h3 className="font-medium text-slate-800">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(selectedTicket.status)}`}>
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                  <span className="text-xs text-slate-400">
                    Aberto em {format(new Date(selectedTicket.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_from_support ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.is_from_support
                        ? 'bg-white border border-slate-200 rounded-tl-sm'
                        : 'bg-cyan-600 text-white rounded-tr-sm'
                    }`}
                  >
                    {message.is_from_support && (
                      <p className="text-xs font-medium text-cyan-600 mb-1">Suporte</p>
                    )}
                    <p className={`text-sm ${message.is_from_support ? 'text-slate-700' : 'text-white'}`}>
                      {message.content}
                    </p>
                    <p className={`text-xs mt-1 ${message.is_from_support ? 'text-slate-400' : 'text-cyan-100'}`}>
                      {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            {selectedTicket.status !== 'closed' && (
              <div className="bg-white border-t border-slate-200 p-4">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    {showEmojiPicker && (
                      <EmojiPicker
                        onSelect={(emoji) => setMessageInput(prev => prev + emoji)}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2 rounded-lg transition-colors ${showEmojiPicker ? 'bg-cyan-100 text-cyan-600' : 'hover:bg-slate-100 text-slate-500'}`}
                        title="Emojis"
                      >
                        <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                      </button>
                    </div>
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Digite sua mensagem..."
                      rows={1}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="p-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              </div>
            )}

            {selectedTicket.status === 'closed' && (
              <div className="bg-slate-100 border-t border-slate-200 p-4 text-center">
                <p className="text-slate-500 text-sm">Este ticket foi fechado</p>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">chat</span>
              <p className="text-slate-500">Selecione um ticket para ver as mensagens</p>
            </div>
          </div>
        )}
      </div>

      {/* Botão Flutuante - Chat ao Vivo quando Online, Ticket quando Offline */}
      {supportSettings.support_online ? (
        // Chat ao Vivo Flutuante
        <div className="fixed bottom-6 right-6 z-50">
          {showLiveChat ? (
            <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 overflow-hidden border border-slate-200">
              {/* Header do Chat */}
              <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Chat ao Vivo</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-white/80 text-xs">Online agora</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowLiveChat(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-white">close</span>
                </button>
              </div>
              
              {/* Corpo do Chat */}
              <div className="p-4 bg-slate-50 min-h-[200px]">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
                  <p className="text-sm text-slate-600">
                    Olá! 👋 Como posso ajudar você hoje?
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Suporte</p>
                </div>
                
                <textarea
                  value={liveChatMessage}
                  onChange={(e) => setLiveChatMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
              
              {/* Footer */}
              <div className="p-3 bg-white border-t border-slate-100">
                <button
                  onClick={handleStartLiveChat}
                  disabled={!liveChatMessage.trim() || creating}
                  className="w-full py-3 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">send</span>
                      Iniciar Conversa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLiveChat(true)}
              className="w-16 h-16 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center relative"
            >
              <span className="material-symbols-outlined text-[28px]">chat</span>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>
          )}
        </div>
      ) : (
        // Botão de Ticket quando Offline
        <button
          onClick={() => setShowNewTicketModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-600 text-white rounded-full shadow-lg hover:bg-cyan-700 transition-all hover:scale-110 flex items-center justify-center md:hidden z-50"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      )}

      {/* Modal Novo Ticket (quando offline) */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-800">Novo Ticket de Suporte</h2>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setNewTicketCategory(cat.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        newTicketCategory === cat.value
                          ? `border-${cat.color}-500 bg-${cat.color}-50`
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${
                        newTicketCategory === cat.value ? `text-${cat.color}-600` : 'text-slate-400'
                      }`}>
                        {cat.icon}
                      </span>
                      <span className={`text-sm font-medium ${
                        newTicketCategory === cat.value ? `text-${cat.color}-700` : 'text-slate-600'
                      }`}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assunto</label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Descreva brevemente o problema"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                <textarea
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  placeholder="Descreva detalhadamente sua solicitação..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">schedule</span>
                <p className="text-sm text-amber-700">
                  O suporte está offline. Sua mensagem será respondida assim que possível.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || creating}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {creating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Enviar Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
