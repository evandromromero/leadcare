
import React, { useState, useEffect, useRef } from 'react';
import { GlobalState } from '../types';
import { useChats, ChatWithMessages, DbTag } from '../hooks/useChats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const DEFAULT_QUICK_REPLIES = [
  { id: '1', text: 'Olá! Como posso ajudar você hoje?' },
  { id: '2', text: 'Obrigado pelo contato! Em breve retornaremos.' },
  { id: '3', text: 'Poderia me informar seu nome completo?' },
];

interface InboxProps {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

type FilterType = 'todos' | 'nao_lidos' | 'aguardando' | 'grupos';

const PIPELINE_STAGES = [
  { value: 'Novo Lead', label: 'Novo Lead', color: '#0891b2' },
  { value: 'Agendado', label: 'Agendado', color: '#8b5cf6' },
  { value: 'Em Atendimento', label: 'Em Atendimento', color: '#f59e0b' },
  { value: 'Convertido', label: 'Convertido', color: '#10b981' },
  { value: 'Perdido', label: 'Perdido', color: '#ef4444' },
];

const Inbox: React.FC<InboxProps> = ({ state, setState }) => {
  const clinicId = state.selectedClinic?.id;
  const { chats, loading, sendMessage, markAsRead, updateChatStatus, refetch } = useChats(clinicId);
  const { user } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados para modais
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [availableTags, setAvailableTags] = useState<DbTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  // Estados para notas/observações
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string; user_name: string }>>([]);
  const [savingNote, setSavingNote] = useState(false);
  
  // Estados para envio de mídia
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para mensagens rápidas do banco
  const [quickReplies, setQuickReplies] = useState<Array<{ id: string; text: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Emojis comuns
  const commonEmojis = ['😀', '😂', '😍', '🥰', '😊', '👍', '👏', '🙏', '❤️', '🔥', '✅', '⭐', '🎉', '💪', '🤝', '👋', '😉', '🤔', '😅', '🙌'];

  // Buscar mensagens rápidas do banco
  useEffect(() => {
    const fetchQuickReplies = async () => {
      if (!clinicId) return;
      const { data } = await supabase
        .from('quick_replies' as any)
        .select('id, text')
        .eq('clinic_id', clinicId)
        .order('created_at');
      if (data && data.length > 0) {
        setQuickReplies(data as Array<{ id: string; text: string }>);
      } else {
        setQuickReplies(DEFAULT_QUICK_REPLIES);
      }
    };
    fetchQuickReplies();
  }, [clinicId]);
  
  // Ref para auto-scroll das mensagens
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Enviar resposta rápida
  const handleQuickReply = (text: string) => {
    setMsgInput(text);
    setShowQuickReplies(false);
  };

  // Buscar tags disponíveis da clínica
  const fetchAvailableTags = async () => {
    if (!clinicId) return;
    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name');
      
      if (!error && data) {
        setAvailableTags(data);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  // Alterar etapa do funil
  const handleChangeStage = async (newStatus: string) => {
    if (!selectedChatId) return;
    await updateChatStatus(selectedChatId, newStatus);
    setShowStageDropdown(false);
  };

  // Adicionar tag ao chat
  const handleAddTag = async (tagId: string) => {
    if (!selectedChatId) return;
    try {
      await supabase
        .from('chat_tags')
        .insert({ chat_id: selectedChatId, tag_id: tagId });
      await refetch();
    } catch (err) {
      console.error('Error adding tag:', err);
    }
  };

  // Remover tag do chat
  const handleRemoveTag = async (tagId: string) => {
    if (!selectedChatId) return;
    try {
      await supabase
        .from('chat_tags')
        .delete()
        .eq('chat_id', selectedChatId)
        .eq('tag_id', tagId);
      await refetch();
    } catch (err) {
      console.error('Error removing tag:', err);
    }
  };

  // Abrir modal de tags
  const openTagsModal = () => {
    fetchAvailableTags();
    setShowTagsModal(true);
  };

  // Buscar notas do chat selecionado
  const fetchNotes = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_notes' as any)
        .select('id, content, created_at, user_id')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // Buscar nomes dos usuários
        const notesData = data as Array<{ id: string; content: string; created_at: string; user_id: string }>;
        const userIds = [...new Set(notesData.map(n => n.user_id))];
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);
        
        const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
        
        setNotes(notesData.map(n => ({
          id: n.id,
          content: n.content,
          created_at: n.created_at,
          user_name: userMap.get(n.user_id) || 'Usuário',
        })));
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  };

  // Salvar nova nota
  const handleSaveNote = async () => {
    if (!noteInput.trim() || !selectedChatId || !user) return;
    
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('chat_notes' as any)
        .insert({
          chat_id: selectedChatId,
          user_id: user.id,
          content: noteInput.trim(),
        });
      
      if (!error) {
        setNoteInput('');
        await fetchNotes(selectedChatId);
      }
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Buscar notas quando mudar de chat
  useEffect(() => {
    if (selectedChatId) {
      fetchNotes(selectedChatId);
    } else {
      setNotes([]);
    }
  }, [selectedChatId]);

  // Filtrar chats baseado no filtro ativo e busca
  const filteredChats = chats.filter(chat => {
    // Filtro de busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = chat.client_name?.toLowerCase().includes(query);
      const matchesPhone = chat.phone_number?.toLowerCase().includes(query);
      const matchesMessage = chat.last_message?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesMessage) return false;
    }

    // Filtros de categoria
    switch (activeFilter) {
      case 'nao_lidos':
        return (chat.unread_count || 0) > 0;
      case 'aguardando':
        return chat.status === 'Aguardando' || chat.status === 'Novo Lead';
      case 'grupos':
        // Grupos geralmente têm telefone com hífen ou mais de 15 dígitos
        return chat.phone_number?.includes('-') || (chat.phone_number?.length || 0) > 15;
      case 'todos':
      default:
        return true;
    }
  });

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  const selectedChat = chats.find(c => c.id === selectedChatId);

  // Scroll quando mudar de chat ou receber novas mensagens
  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages?.length, selectedChatId]);

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !selectedChatId || !user) return;
    await sendMessage(selectedChatId, msgInput, user.id);
    setMsgInput('');
  };

  // Enviar mídia (imagem/vídeo)
  const handleSendMedia = async (file: File) => {
    if (!selectedChatId || !user || !selectedChat) return;
    
    setSendingMedia(true);
    try {
      // Upload para Supabase Storage
      const fileName = `${selectedChatId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Erro ao fazer upload do arquivo');
        return;
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      const mediaUrl = urlData?.publicUrl;
      
      if (!mediaUrl) {
        alert('Erro ao obter URL do arquivo');
        return;
      }
      
      // Determinar tipo de mídia
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                        file.type.startsWith('video/') ? 'video' : 
                        file.type.startsWith('audio/') ? 'audio' : 'document';
      
      // Buscar configurações da Evolution API
      const { data: settings } = await supabase
        .from('settings')
        .select('evolution_api_url, evolution_api_key')
        .single();
      
      // Buscar instância WhatsApp
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, status')
        .eq('clinic_id', clinicId)
        .single();
      
      // Enviar via WhatsApp se conectado
      if (instance?.status === 'connected' && settings?.evolution_api_url && selectedChat.phone_number) {
        let formattedPhone = selectedChat.phone_number.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        
        const endpoint = mediaType === 'image' ? 'sendMedia' : 
                         mediaType === 'video' ? 'sendMedia' : 
                         mediaType === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
        
        await fetch(`${settings.evolution_api_url}/message/${endpoint}/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.evolution_api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            mediatype: mediaType,
            media: mediaUrl,
            caption: '',
          }),
        });
      }
      
      // Salvar mensagem no banco
      await supabase.from('messages').insert({
        chat_id: selectedChatId,
        content: `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Arquivo'}]`,
        type: mediaType,
        media_url: mediaUrl,
        is_from_client: false,
        sent_by: user.id,
      });
      
      // Atualizar chat
      await supabase.from('chats').update({
        last_message: `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Arquivo'}]`,
        last_message_time: new Date().toISOString(),
      }).eq('id', selectedChatId);
      
      // Recarregar chats
      await refetch();
      
    } catch (err) {
      console.error('Error sending media:', err);
      alert('Erro ao enviar mídia');
    } finally {
      setSendingMedia(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSendMedia(file);
    }
    e.target.value = '';
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-cyan-600"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: 'todos' as FilterType, label: 'Todos', count: chats.length },
              { key: 'nao_lidos' as FilterType, label: 'Não lidos', count: chats.filter(c => (c.unread_count || 0) > 0).length },
              { key: 'aguardando' as FilterType, label: 'Aguardando', count: chats.filter(c => c.status === 'Aguardando' || c.status === 'Novo Lead').length },
              { key: 'grupos' as FilterType, label: 'Grupos', count: chats.filter(c => c.phone_number?.includes('-') || (c.phone_number?.length || 0) > 15).length },
            ].map((f) => (
              <button 
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border flex items-center gap-1.5 transition-colors ${
                  activeFilter === f.key 
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeFilter === f.key ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-2">Carregando conversas...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">chat</span>
              <p className="text-sm text-slate-500">
                {chats.length === 0 ? 'Nenhuma conversa ainda' : 'Nenhuma conversa encontrada'}
              </p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => {
                  setSelectedChatId(chat.id);
                  markAsRead(chat.id);
                }}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors relative border-l-4 ${
                  selectedChatId === chat.id ? 'bg-cyan-50/50 border-cyan-600' : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={chat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.client_name)}&background=0891b2&color=fff`} className="size-12 rounded-full border border-slate-100" />
                  <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{chat.client_name}</h3>
                    <span className="text-[10px] font-bold text-slate-400">{formatTime(chat.last_message_time)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate leading-relaxed">{chat.last_message || 'Sem mensagens'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {chat.tags.map(tag => (
                      <span key={tag.id} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                        {tag.name}
                      </span>
                    ))}
                    {(chat.unread_count || 0) > 0 && (
                      <span className="ml-auto bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Col 2: Active Chat Area */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 relative">
        {selectedChat ? (
          <>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
              <div className="flex items-center gap-3">
                <img src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} className="size-10 rounded-full" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">{selectedChat.client_name}</h2>
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
                <div key={m.id} className={`flex ${!m.is_from_client ? 'justify-end' : 'justify-start'} w-full`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm relative ${
                    !m.is_from_client 
                      ? 'bg-cyan-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}>
                    {/* Renderizar mídia se existir */}
                    {m.type === 'image' && m.media_url && (
                      <img 
                        src={m.media_url} 
                        alt="Imagem" 
                        className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(m.media_url || '', '_blank')}
                      />
                    )}
                    {m.type === 'video' && m.media_url && (
                      <video 
                        src={m.media_url} 
                        controls 
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    {m.type === 'audio' && m.media_url && (
                      <audio 
                        src={m.media_url} 
                        controls 
                        className="w-full mb-2"
                      />
                    )}
                    {m.type === 'document' && m.media_url && (
                      <a 
                        href={m.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${!m.is_from_client ? 'bg-cyan-500' : 'bg-slate-100'}`}
                      >
                        <span className="material-symbols-outlined">description</span>
                        <span className="text-sm underline">{m.content}</span>
                      </a>
                    )}
                    {/* Texto da mensagem (exceto para mídia sem legenda) */}
                    {(m.type === 'text' || (m.content && !m.content.startsWith('['))) && (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    )}
                    {/* Placeholder para mídia sem URL */}
                    {m.type !== 'text' && !m.media_url && (
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${!m.is_from_client ? 'bg-cyan-500' : 'bg-slate-100'}`}>
                        <span className="material-symbols-outlined">
                          {m.type === 'image' ? 'image' : m.type === 'video' ? 'videocam' : m.type === 'audio' ? 'mic' : 'attachment'}
                        </span>
                        <span className="text-sm">{m.content}</span>
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${!m.is_from_client ? 'text-cyan-100' : 'text-slate-400'}`}>
                      {formatTime(m.created_at)}
                      {!m.is_from_client && <span className="material-symbols-outlined text-[12px]">done_all</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 relative">
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                <div className="relative">
                  <button 
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
                      showQuickReplies 
                        ? 'bg-cyan-50 border-cyan-200 text-cyan-700' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-cyan-600">bolt</span>
                    Respostas Rápidas
                  </button>
                  
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-green-600">calendar_month</span>
                  Agendar
                </button>
              </div>
              <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-cyan-600 focus-within:border-transparent transition-all">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                />
                <label className="p-2 text-slate-400 hover:text-cyan-600 rounded-full transition-colors cursor-pointer">
                  <input 
                    type="file" 
                    onChange={handleFileSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    className="sr-only"
                    disabled={sendingMedia}
                  />
                  <span className="material-symbols-outlined">{sendingMedia ? 'hourglass_empty' : 'attach_file'}</span>
                </label>
                <div className="relative">
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-cyan-600 bg-cyan-50' : 'text-slate-400 hover:text-cyan-600'}`}
                  >
                    <span className="material-symbols-outlined">sentiment_satisfied</span>
                  </button>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 w-64">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Emojis</p>
                        <div className="grid grid-cols-10 gap-1">
                          {commonEmojis.map((emoji, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setMsgInput(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="text-xl hover:bg-slate-100 rounded p-1 transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                  disabled={sendingMedia}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white size-10 flex items-center justify-center rounded-xl shadow-lg shadow-cyan-500/30 transition-all shrink-0 active:scale-95 disabled:opacity-50"
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
              <img src={selectedChat.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.client_name)}&background=0891b2&color=fff`} className="size-24 rounded-full mx-auto mb-4 border-4 border-slate-50 shadow-md" />
              <h2 className="text-xl font-black text-slate-900 mb-1">{selectedChat.client_name}</h2>
              <p className="text-sm font-bold text-slate-400">{selectedChat.phone_number}</p>
              
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
              <section className="relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funil de Vendas</h3>
                  <button 
                    onClick={() => setShowStageDropdown(!showStageDropdown)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700"
                  >
                    Alterar
                  </button>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Etapa Atual</p>
                   <p className="text-sm font-bold text-slate-800 mb-4">{selectedChat.status}</p>
                   <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ 
                          width: `${((PIPELINE_STAGES.findIndex(s => s.value === selectedChat.status) + 1) / PIPELINE_STAGES.length) * 100}%`,
                          backgroundColor: PIPELINE_STAGES.find(s => s.value === selectedChat.status)?.color || '#0891b2'
                        }}
                      ></div>
                   </div>
                </div>
                
                {/* Dropdown de etapas */}
                {showStageDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-20">
                    {PIPELINE_STAGES.map(stage => (
                      <button
                        key={stage.value}
                        onClick={() => handleChangeStage(stage.value)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                          selectedChat.status === stage.value ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="size-3 rounded-full" style={{ backgroundColor: stage.color }}></span>
                        {stage.label}
                        {selectedChat.status === stage.value && (
                          <span className="material-symbols-outlined text-cyan-600 text-[16px] ml-auto">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiquetas</h3>
                  <button 
                    onClick={openTagsModal}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedChat.tags.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma etiqueta</p>
                  ) : (
                    selectedChat.tags.map(tag => (
                      <span 
                        key={tag.id} 
                        className="px-2 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 group cursor-pointer" 
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                        onClick={() => handleRemoveTag(tag.id)}
                        title="Clique para remover"
                      >
                        {tag.name}
                        <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">close</span>
                      </span>
                    ))
                  )}
                </div>
              </section>

              {/* Modal de Tags */}
              {showTagsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTagsModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Adicionar Etiqueta</h3>
                      <button onClick={() => setShowTagsModal(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="p-4 max-h-64 overflow-y-auto">
                      {loadingTags ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mx-auto"></div>
                        </div>
                      ) : availableTags.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">Nenhuma etiqueta disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {availableTags.map(tag => {
                            const isAdded = selectedChat.tags.some(t => t.id === tag.id);
                            return (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  if (isAdded) {
                                    handleRemoveTag(tag.id);
                                  } else {
                                    handleAddTag(tag.id);
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center justify-between transition-colors ${
                                  isAdded ? 'bg-slate-100' : 'hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="size-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                  {tag.name}
                                </span>
                                {isAdded && (
                                  <span className="material-symbols-outlined text-cyan-600 text-[18px]">check_circle</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Respostas Rápidas */}
              {showQuickReplies && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQuickReplies(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Respostas Rápidas</h3>
                      <button onClick={() => setShowQuickReplies(false)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {quickReplies.map(reply => (
                        <button
                          key={reply.id}
                          onClick={() => handleQuickReply(reply.text)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-cyan-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <p className="text-slate-700">{reply.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <section className="flex-1 flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Observações</h3>
                
                {/* Histórico de notas */}
                <div className="flex-1 space-y-3 max-h-48 overflow-y-auto mb-4">
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhuma observação ainda</p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                        <p className="text-xs text-slate-700 leading-relaxed italic mb-2">"{note.content}"</p>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-medium">{note.user_name}</span>
                          <span>{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Input para nova nota */}
                <div className="space-y-2">
                  <textarea 
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Adicionar nota interna..."
                    className="w-full rounded-xl bg-slate-50 border-slate-200 text-xs p-3 focus:ring-cyan-600 focus:border-cyan-600 h-20 resize-none"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteInput.trim() || savingNote}
                    className="w-full py-2 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingNote ? (
                      <>
                        <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        Salvar Observação
                      </>
                    )}
                  </button>
                </div>
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
