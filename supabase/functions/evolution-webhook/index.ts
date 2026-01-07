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

    console.log('Event:', event, 'Instance:', instanceName)

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
        await supabase.from('whatsapp_instances').update({ status: 'connected', qr_code: null, connected_at: new Date().toISOString() }).eq('id', instance.id)
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
    if (!key || key.fromMe === true) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let phone = (key.remoteJid || '').replace('@s.whatsapp.net', '').replace('@g.us', '')
    if (phone.includes('-') || phone.length > 15) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const messageObj = data.message
    const messageType = data.messageType || ''
    const pushName = data.pushName || 'Cliente'

    let message = ''
    let mediaType: string | null = null
    let tempMediaUrl: string | null = null

    if (messageType === 'conversation') {
      message = messageObj?.conversation || ''
    } else if (messageType === 'extendedTextMessage') {
      message = messageObj?.extendedTextMessage?.text || ''
    } else if (messageType === 'imageMessage') {
      message = messageObj?.imageMessage?.caption || '[Imagem]'
      mediaType = 'image'
      tempMediaUrl = data.mediaUrl || messageObj?.imageMessage?.url
    } else if (messageType === 'videoMessage') {
      message = messageObj?.videoMessage?.caption || '[Video]'
      mediaType = 'video'
      tempMediaUrl = data.mediaUrl || messageObj?.videoMessage?.url
    } else if (messageType === 'audioMessage') {
      message = '[Audio]'
      mediaType = 'audio'
      tempMediaUrl = data.mediaUrl || messageObj?.audioMessage?.url
    } else if (messageType === 'documentMessage') {
      message = messageObj?.documentMessage?.fileName || '[Documento]'
      mediaType = 'document'
      tempMediaUrl = data.mediaUrl || messageObj?.documentMessage?.url
    } else {
      message = messageObj?.conversation || messageObj?.extendedTextMessage?.text || `[${messageType}]`
    }

    // Get or create chat
    let { data: chat } = await supabase
      .from('chats')
      .select('id, unread_count')
      .eq('clinic_id', clinicId)
      .eq('phone_number', phone)
      .single()

    if (!chat) {
      const { data: newChat } = await supabase
        .from('chats')
        .insert({
          clinic_id: clinicId,
          client_name: pushName,
          phone_number: phone,
          status: 'Novo Lead',
          unread_count: 1,
          last_message: message,
          last_message_time: new Date().toISOString()
        })
        .select('id, unread_count')
        .single()
      chat = newChat
    } else {
      await supabase
        .from('chats')
        .update({
          unread_count: (chat.unread_count || 0) + 1,
          last_message: message,
          last_message_time: new Date().toISOString()
        })
        .eq('id', chat.id)
    }

    // Upload media to storage if exists
    let finalMediaUrl: string | null = null
    if (tempMediaUrl && mediaType && chat) {
      try {
        const response = await fetch(tempMediaUrl)
        if (response.ok) {
          const blob = await response.blob()
          const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'ogg' : 'bin'
          const fileName = `${chat.id}/${Date.now()}.${ext}`
          
          const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(fileName, blob, { contentType: blob.type })
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName)
            finalMediaUrl = urlData?.publicUrl || null
          }
        }
      } catch (e) {
        console.error('Media upload failed:', e)
        finalMediaUrl = tempMediaUrl // fallback to original URL
      }
    }

    // Save message
    await supabase.from('messages').insert({
      chat_id: chat!.id,
      content: message || '[Sem texto]',
      type: mediaType || 'text',
      media_url: finalMediaUrl,
      is_from_client: true
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
