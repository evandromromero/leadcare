import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface NewChatModalProps {
  clinicId: string;
  userId: string;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export default function NewChatModal({ clinicId, userId, onClose, onChatCreated }: NewChatModalProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Formatar telefone para exibição
  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length <= 11) {
      setPhone(digits);
    }
  };

  const handleSubmit = async () => {
    setError('');

    // Validar telefone
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setError('Telefone inválido. Use DDD + número (10 ou 11 dígitos).');
      return;
    }

    if (!message.trim()) {
      setError('Digite uma mensagem para enviar.');
      return;
    }

    setSending(true);

    try {
      // Formatar número com código do país
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      // Verificar se já existe chat com esse número
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('phone_number', fullPhone)
        .eq('is_group', false)
        .maybeSingle();

      if (existingChat) {
        // Chat já existe — abrir e enviar mensagem nele
        await sendWhatsAppAndSave(existingChat.id, fullPhone, message.trim());
        onChatCreated(existingChat.id);
        return;
      }

      // Buscar instância ativa
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'connected')
        .maybeSingle();

      if (!instance) {
        setError('WhatsApp não está conectado. Conecte primeiro em Configurações.');
        setSending(false);
        return;
      }

      // Criar chat
      const clientName = name.trim() || fullPhone;
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          clinic_id: clinicId,
          client_name: clientName,
          phone_number: fullPhone,
          is_group: false,
          status: 'Em Atendimento',
          unread_count: 0,
          last_message: message.trim(),
          last_message_time: new Date().toISOString(),
          instance_id: instance.id,
          assigned_to: userId,
        })
        .select('id')
        .single();

      if (chatError) {
        // Pode ser unique constraint — chat foi criado por outro processo
        const { data: retryChat } = await supabase
          .from('chats')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('phone_number', fullPhone)
          .eq('is_group', false)
          .maybeSingle();

        if (retryChat) {
          await sendWhatsAppAndSave(retryChat.id, fullPhone, message.trim());
          onChatCreated(retryChat.id);
          return;
        }

        throw new Error(chatError.message);
      }

      // Enviar mensagem via WhatsApp e salvar no banco
      await sendWhatsAppAndSave(newChat.id, fullPhone, message.trim());
      onChatCreated(newChat.id);
    } catch (err: any) {
      console.error('Erro ao criar conversa:', err);
      setError(err.message || 'Erro ao criar conversa.');
      setSending(false);
    }
  };

  const sendWhatsAppAndSave = async (chatId: string, fullPhone: string, content: string) => {
    // Buscar settings da Evolution API
    const { data: settings } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key')
      .eq('id', 1 as any)
      .maybeSingle();

    // Buscar instância
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'connected')
      .maybeSingle();

    // Buscar nome do usuário para prefixar
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const userName = (userData as any)?.name || '';
    const whatsappMessage = userName ? `*${userName}:* ${content}` : content;

    let remoteMessageId: string | null = null;

    // Enviar via Evolution API
    if ((settings as any)?.evolution_api_url && (settings as any)?.evolution_api_key && instance) {
      try {
        const response = await fetch(`${(settings as any).evolution_api_url}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': (settings as any).evolution_api_key,
          },
          body: JSON.stringify({
            number: fullPhone,
            text: whatsappMessage,
          }),
        });

        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          remoteMessageId = responseData?.key?.id || null;
        } else {
          console.error('Erro ao enviar WhatsApp:', response.status);
        }
      } catch (err) {
        console.error('Erro ao enviar WhatsApp:', err);
      }
    }

    // Salvar mensagem no banco
    await supabase.from('messages').insert({
      chat_id: chatId,
      content,
      is_from_client: false,
      sent_by: userId,
      type: 'text',
      remote_message_id: remoteMessageId,
    });

    // Atualizar chat
    await supabase
      .from('chats')
      .update({
        last_message: content,
        last_message_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_to: userId,
      })
      .eq('id', chatId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-cyan-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white">chat_add_on</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Nova Conversa</h3>
              <p className="text-white/80 text-sm">Envie uma mensagem para um novo número</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Telefone */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Telefone <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">+55</span>
              <input
                type="tel"
                value={formatPhoneDisplay(phone)}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                className="w-full pl-12 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                autoFocus
              />
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nome <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Mensagem <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem inicial..."
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending || !phone || !message.trim()}
            className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                Enviando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
