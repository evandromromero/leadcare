
import React, { useState } from 'react';
import { GlobalState, Chat, Message } from '../types';

interface InboxProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const Inbox: React.FC<InboxProps> = ({ state, setState }) => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(state.chats[0]?.id || null);
  const [msgInput, setMsgInput] = useState('');

  const selectedChat = state.chats.find(c => c.id === selectedChatId);

  const handleSendMessage = () => {
    if (!msgInput.trim() || !selectedChatId) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      text: msgInput,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => 
        chat.id === selectedChatId 
          ? { ...chat, messages: [...chat.messages, newMessage], lastMessage: msgInput, lastMessageTime: newMessage.timestamp } 
          : chat
      )
    }));

    setMsgInput('');
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Col 1: Chat List */}
      <aside className="w-[380px] flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar conversa..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-cyan-600"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Todos', 'Não lidos', 'Aguardando', 'Grupos'].map((f, i) => (
              <button 
                key={f} 
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${
                  i === 0 ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {state.chats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setSelectedChatId(chat.id)}
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors relative border-l-4 ${
                selectedChatId === chat.id ? 'bg-cyan-50/50 border-cyan-600' : 'hover:bg-slate-50 border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                <img src={chat.avatarUrl} className="size-12 rounded-full border border-slate-100" />
                <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{chat.clientName}</h3>
                  <span className="text-[10px] font-bold text-slate-400">{chat.lastMessageTime}</span>
                </div>
                <p className="text-xs text-slate-500 truncate leading-relaxed">{chat.lastMessage}</p>
                <div className="flex items-center gap-2 mt-2">
                  {chat.tags.map(tag => (
                    <span key={tag.label} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tag.color}`}>
                      {tag.label}
                    </span>
                  ))}
                  {chat.unreadCount > 0 && (
                    <span className="ml-auto bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Col 2: Active Chat Area */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 relative">
        {selectedChat ? (
          <>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
              <div className="flex items-center gap-3">
                <img src={selectedChat.avatarUrl} className="size-10 rounded-full" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">{selectedChat.clientName}</h2>
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-green-500"></span> Online agora
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(#cbd5e1 0.5px, transparent 0.5px)', backgroundSize: '15px 15px' }}>
              <div className="flex justify-center mb-8">
                <span className="bg-white/80 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100 uppercase tracking-widest">Hoje</span>
              </div>
              
              {selectedChat.messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'} w-full`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm relative ${
                    m.sender === 'me' 
                      ? 'bg-cyan-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${m.sender === 'me' ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {m.timestamp}
                      {m.sender === 'me' && <span className="material-symbols-outlined text-[12px]">done_all</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-cyan-600">bolt</span>
                  Respostas Rápidas
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-green-600">calendar_month</span>
                  Agendar
                </button>
              </div>
              <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-cyan-600 focus-within:border-transparent transition-all">
                <button className="p-2 text-slate-400 hover:text-cyan-600 rounded-full transition-colors">
                  <span className="material-symbols-outlined">sentiment_satisfied</span>
                </button>
                <textarea 
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Digite sua mensagem..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-0 resize-none max-h-32 min-h-[40px]"
                  rows={1}
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white size-10 flex items-center justify-center rounded-xl shadow-lg shadow-cyan-500/30 transition-all shrink-0 active:scale-95"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
             <span className="material-symbols-outlined text-7xl text-slate-100 mb-6">forum</span>
             <h2 className="text-xl font-black text-slate-900 mb-2">Selecione uma conversa</h2>
             <p className="text-slate-500 max-w-xs">Escolha um contato ao lado para visualizar o histórico de mensagens e responder.</p>
          </div>
        )}
      </section>

      {/* Col 3: Details Pane */}
      <aside className="hidden xl:flex w-[340px] flex-col bg-white border-l border-slate-200 h-full overflow-y-auto shrink-0">
        {selectedChat ? (
          <div className="flex flex-col h-full">
            <div className="p-8 text-center border-b border-slate-100">
              <img src={selectedChat.avatarUrl} className="size-24 rounded-full mx-auto mb-4 border-4 border-slate-50 shadow-md" />
              <h2 className="text-xl font-black text-slate-900 mb-1">{selectedChat.clientName}</h2>
              <p className="text-sm font-bold text-slate-400">{selectedChat.phoneNumber}</p>
              
              <div className="flex justify-center gap-4 mt-6">
                {[
                  { icon: 'chat', label: 'Conversar', color: 'green' },
                  { icon: 'call', label: 'Ligar', color: 'blue' },
                  { icon: 'edit', label: 'Editar', color: 'slate' },
                ].map(action => (
                  <button key={action.label} className={`size-10 rounded-full border border-${action.color}-100 bg-${action.color}-50 text-${action.color}-600 flex items-center justify-center hover:scale-110 transition-transform shadow-sm`}>
                    <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-8">
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funil de Vendas</h3>
                  <button className="text-xs font-bold text-cyan-600">Alterar</button>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Etapa Atual</p>
                   <p className="text-sm font-bold text-slate-800 mb-4">{selectedChat.status}</p>
                   <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-600 h-full" style={{ width: '60%' }}></div>
                   </div>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiquetas</h3>
                  <button className="text-xs font-bold text-cyan-600 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">add</span> Adicionar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedChat.tags.map(tag => (
                    <span key={tag.label} className={`px-2 py-1 rounded-lg text-xs font-bold border ${tag.color}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </section>

              <section className="flex-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Observações</h3>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-xs text-slate-700 leading-relaxed italic mb-4">
                  "Paciente interessada em tratamento estético. Precisa de orçamento detalhado na próxima consulta."
                </div>
                <textarea 
                  placeholder="Adicionar nota interna..."
                  className="w-full rounded-xl bg-slate-50 border-slate-200 text-xs p-3 focus:ring-cyan-600 focus:border-cyan-600 h-24 resize-none"
                />
              </section>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-4xl text-slate-100 mb-4">info</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informações do Contato</p>
          </div>
        )}
      </aside>
    </div>
  );
};

export default Inbox;
