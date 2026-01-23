import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const webhookData = await req.json()
    const event = (webhookData.event || '').toLowerCase()
    const instanceName = webhookData.instance || ''

    console.log('Event:', event, 'Instance:', instanceName, 'Data:', JSON.stringify(webhookData.data).substring(0, 500))

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, clinic_id')
      .eq('instance_name', instanceName)
      .single()

    if (!instance) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const clinicId = instance.clinic_id

    // QR Code
    if (event === 'qrcode.updated') {
      await supabase.from('whatsapp_instances').update({ 
        qr_code: webhookData.data?.qrcode?.base64, 
        status: 'connecting' 
      }).eq('id', instance.id)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Connection
    if (event === 'connection.update') {
      const state = webhookData.data?.state
      if (state === 'open') {
        // Capturar nome do perfil e número de telefone do WhatsApp
        const profileName = webhookData.data?.profileName || webhookData.data?.pushName || null
        const phoneNumber = webhookData.data?.phoneNumber || webhookData.data?.wid?.replace('@s.whatsapp.net', '') || null
        
        const updateData: Record<string, unknown> = {
          status: 'connected',
          qr_code: null,
          connected_at: new Date().toISOString()
        }
        
        // Só atualiza se tiver valor (não sobrescreve com null)
        if (profileName) updateData.display_name = profileName
        if (phoneNumber) updateData.phone_number = phoneNumber
        
        await supabase.from('whatsapp_instances').update(updateData).eq('id', instance.id)
      } else if (state === 'close') {
        await supabase.from('whatsapp_instances').update({ status: 'disconnected', connected_at: null }).eq('id', instance.id)
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Messages
    if (event !== 'messages.upsert') {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const data = webhookData.data
    const key = data?.key
    if (!key) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const isFromMe = key.fromMe === true
    const remoteJid = key.remoteJid || ''
    const isGroup = remoteJid.endsWith('@g.us')
    let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    const groupId = isGroup ? remoteJid : null
    
    console.log('Message processing - Phone/GroupId:', phone, 'isFromMe:', isFromMe, 'isGroup:', isGroup, 'messageType:', data.messageType)
    
    // Validar: se não for grupo, verificar se é telefone válido
    if (!isGroup && (phone.includes('-') || phone.length > 15)) {
      console.log('Skipping invalid phone:', phone)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const messageObj = data.message
    const messageType = data.messageType || ''
    const pushName = data.pushName || 'Cliente'

    let message = ''
    let mediaType: string | null = null
    let tempMediaUrl: string | null = null
    const messageId = key.id

    // Capturar base64 se vier no payload (quando Webhook Base64 está ativado)
    const base64Media = data.base64 || messageObj?.base64 || webhookData.base64
    const mediaMimetype = data.mimetype || messageObj?.mimetype || webhookData.mimetype

    if (messageType === 'conversation') {
      message = messageObj?.conversation || ''
    } else if (messageType === 'extendedTextMessage') {
      message = messageObj?.extendedTextMessage?.text || ''
    } else if (messageType === 'imageMessage') {
      message = messageObj?.imageMessage?.caption || '[Imagem]'
      mediaType = 'image'
      if (base64Media) {
        tempMediaUrl = `data:${mediaMimetype || 'image/jpeg'};base64,${base64Media}`
      } else {
        tempMediaUrl = data.mediaUrl || messageObj?.imageMessage?.url || data.media?.url
      }
    } else if (messageType === 'videoMessage') {
      message = messageObj?.videoMessage?.caption || '[Video]'
      mediaType = 'video'
      if (base64Media) {
        tempMediaUrl = `data:${mediaMimetype || 'video/mp4'};base64,${base64Media}`
      } else {
        tempMediaUrl = data.mediaUrl || messageObj?.videoMessage?.url || data.media?.url
      }
    } else if (messageType === 'audioMessage' || messageType === 'pttMessage') {
      message = '[Audio]'
      mediaType = 'audio'
      if (base64Media) {
        tempMediaUrl = `data:${mediaMimetype || 'audio/ogg'};base64,${base64Media}`
      } else {
        tempMediaUrl = data.mediaUrl || messageObj?.audioMessage?.url || data.media?.url
      }
    } else if (messageType === 'documentMessage') {
      message = messageObj?.documentMessage?.fileName || '[Documento]'
      mediaType = 'document'
      // Capturar mimetype do documento para usar na extensão correta
      const docMimetype = messageObj?.documentMessage?.mimetype || mediaMimetype
      if (base64Media) {
        tempMediaUrl = `data:${docMimetype || 'application/octet-stream'};base64,${base64Media}`
      } else {
        tempMediaUrl = data.mediaUrl || messageObj?.documentMessage?.url || data.media?.url
      }
    } else if (messageType === 'stickerMessage') {
      message = '[Sticker]'
      mediaType = 'image'
      if (base64Media) {
        tempMediaUrl = `data:${mediaMimetype || 'image/webp'};base64,${base64Media}`
      } else {
        tempMediaUrl = data.mediaUrl || data.media?.url
      }
    } else {
      message = messageObj?.conversation || messageObj?.extendedTextMessage?.text || `[${messageType}]`
    }
    
    console.log('Message type:', messageType, 'Has base64:', !!base64Media, 'Has tempMediaUrl:', !!tempMediaUrl)

    // Se não temos URL da mídia mas temos mediaType, tentar buscar via API
    if (mediaType && !tempMediaUrl && messageId) {
      try {
        // Buscar configurações globais da Evolution API
        const { data: settings } = await supabase
          .from('settings')
          .select('evolution_api_url, evolution_api_key')
          .eq('id', 1)
          .single()
        
        if (settings?.evolution_api_url && settings?.evolution_api_key) {
          // Buscar mídia via API da Evolution
          const mediaResponse = await fetch(
            `${settings.evolution_api_url}/chat/getBase64FromMediaMessage/${instanceName}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': settings.evolution_api_key
              },
              body: JSON.stringify({
                message: {
                  key: key
                },
                convertToMp4: mediaType === 'video'
              })
            }
          )
          
          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json()
            if (mediaData.base64) {
              // Temos a mídia em base64, vamos fazer upload direto
              tempMediaUrl = `data:${mediaData.mimetype || 'application/octet-stream'};base64,${mediaData.base64}`
            }
          }
        }
      } catch (e) {
        console.error('Error fetching media from Evolution API:', e)
      }
    }

    // Get or create chat (diferente para grupos vs conversas individuais)
    let { data: chat } = isGroup 
      ? await supabase
          .from('chats')
          .select('id, unread_count')
          .eq('clinic_id', clinicId)
          .eq('group_id', groupId)
          .single()
      : await supabase
          .from('chats')
          .select('id, unread_count')
          .eq('clinic_id', clinicId)
          .eq('phone_number', phone)
          .eq('is_group', false)
          .single()

    // Nome do grupo vem em pushName ou no subject do grupo
    const groupName = isGroup ? (data.pushName || data.groupSubject || `Grupo ${phone}`) : null
    // Para grupos, o remetente da mensagem vem em participant
    const senderName = isGroup ? (data.pushName || 'Participante') : pushName

    if (!chat) {
      // Criar chat (grupo ou individual)
      const { data: newChat } = await supabase
        .from('chats')
        .insert({
          clinic_id: clinicId,
          client_name: isGroup ? groupName : (pushName || 'Cliente'),
          phone_number: isGroup ? phone : phone,
          group_id: groupId,
          is_group: isGroup,
          status: isFromMe ? 'Em Atendimento' : 'Novo Lead',
          unread_count: isFromMe ? 0 : 1,
          last_message: isGroup ? `${senderName}: ${message}` : message,
          last_message_time: new Date().toISOString(),
          instance_id: instance.id
        })
        .select('id, unread_count')
        .single()
      chat = newChat
    } else {
      // Atualiza chat - só incrementa unread se for do cliente/participante
      await supabase
        .from('chats')
        .update({
          unread_count: isFromMe ? (chat.unread_count || 0) : (chat.unread_count || 0) + 1,
          last_message: isGroup ? `${senderName}: ${message}` : message,
          last_message_time: new Date().toISOString(),
          last_message_from_client: !isFromMe
        })
        .eq('id', chat.id)
    }

    // Upload media to storage if exists
    let finalMediaUrl: string | null = null
    if (tempMediaUrl && mediaType && chat) {
      try {
        // Determinar extensão baseada no mimetype ou tipo de mídia
        let ext = 'bin'
        if (mediaType === 'image') ext = 'jpg'
        else if (mediaType === 'video') ext = 'mp4'
        else if (mediaType === 'audio') ext = 'ogg'
        else if (mediaType === 'document') {
          // Extrair extensão do nome do arquivo ou mimetype
          const fileName = messageObj?.documentMessage?.fileName || ''
          const fileExt = fileName.split('.').pop()?.toLowerCase()
          if (fileExt && fileExt.length <= 5) {
            ext = fileExt
          } else {
            // Fallback baseado no mimetype
            const docMime = messageObj?.documentMessage?.mimetype || ''
            if (docMime.includes('pdf')) ext = 'pdf'
            else if (docMime.includes('word') || docMime.includes('document')) ext = 'docx'
            else if (docMime.includes('excel') || docMime.includes('spreadsheet')) ext = 'xlsx'
            else if (docMime.includes('text')) ext = 'txt'
          }
        }
        const uploadFileName = `${chat.id}/${Date.now()}.${ext}`
        
        // Verificar se é base64
        if (tempMediaUrl.startsWith('data:')) {
          // Extrair base64 e mimetype
          const matches = tempMediaUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (matches) {
            const mimeType = matches[1]
            const base64Data = matches[2]
            // Converter base64 para Uint8Array
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            
            const { error: uploadError } = await supabase.storage
              .from('chat-media')
              .upload(uploadFileName, bytes, { contentType: mimeType })
            
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(uploadFileName)
              finalMediaUrl = urlData?.publicUrl || null
            } else {
              console.error('Upload error (base64):', uploadError)
            }
          }
        } else {
          // URL normal - fazer fetch
          const response = await fetch(tempMediaUrl)
          if (response.ok) {
            const blob = await response.blob()
            
            const { error: uploadError } = await supabase.storage
              .from('chat-media')
              .upload(uploadFileName, blob, { contentType: blob.type })
            
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(uploadFileName)
              finalMediaUrl = urlData?.publicUrl || null
            } else {
              console.error('Upload error (url):', uploadError)
            }
          }
        }
      } catch (e) {
        console.error('Media upload failed:', e)
      }
    }

    // Save message
    await supabase.from('messages').insert({
      chat_id: chat!.id,
      content: message || '[Sem texto]',
      type: mediaType || 'text',
      media_url: finalMediaUrl,
      is_from_client: !isFromMe,
      remote_message_id: messageId || null
    })

    // Enviar Broadcast para notificar o cliente em tempo real
    const channel = supabase.channel('leadcare-updates')
    await channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        clinic_id: instance.clinic_id,
        chat_id: chat!.id,
        from_client: !isFromMe
      }
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
