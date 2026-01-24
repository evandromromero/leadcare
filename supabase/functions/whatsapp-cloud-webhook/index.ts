import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // GET = Verificação do Webhook (Meta envia challenge)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('[Cloud Webhook] Verification request:', { mode, token, challenge })

    // Buscar verify_token de alguma clínica que tenha configurado
    // Em produção, você pode ter um token global ou validar por clínica
    const { data: clinicWithToken } = await supabase
      .from('clinics')
      .select('cloud_api_verify_token')
      .not('cloud_api_verify_token', 'is', null)
      .limit(1)
      .single()

    const expectedToken = clinicWithToken?.cloud_api_verify_token || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'leadcare_webhook_token'

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Cloud Webhook] Verification successful')
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    } else {
      console.log('[Cloud Webhook] Verification failed - token mismatch')
      return new Response('Forbidden', { status: 403 })
    }
  }

  // POST = Receber eventos (mensagens, status, etc)
  try {
    const webhookData = await req.json()
    console.log('[Cloud Webhook] Received:', JSON.stringify(webhookData).substring(0, 1000))

    // Estrutura do payload da Meta:
    // {
    //   "object": "whatsapp_business_account",
    //   "entry": [{
    //     "id": "WABA_ID",
    //     "changes": [{
    //       "value": {
    //         "messaging_product": "whatsapp",
    //         "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
    //         "contacts": [{ "profile": { "name": "..." }, "wa_id": "..." }],
    //         "messages": [{ ... }],
    //         "statuses": [{ ... }]
    //       },
    //       "field": "messages"
    //     }]
    //   }]
    // }

    if (webhookData.object !== 'whatsapp_business_account') {
      console.log('[Cloud Webhook] Ignoring non-whatsapp event')
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    for (const entry of webhookData.entry || []) {
      const wabaId = entry.id

      for (const change of entry.changes || []) {
        const value = change.value
        if (!value) continue

        const phoneNumberId = value.metadata?.phone_number_id
        const displayPhoneNumber = value.metadata?.display_phone_number

        // Buscar clínica pelo phone_number_id
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id, cloud_api_access_token')
          .eq('cloud_api_phone_number_id', phoneNumberId)
          .single()

        if (!clinic) {
          console.log('[Cloud Webhook] No clinic found for phone_number_id:', phoneNumberId)
          continue
        }

        const clinicId = clinic.id
        const accessToken = clinic.cloud_api_access_token

        // Processar mensagens recebidas
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            await processIncomingMessage(supabase, clinicId, accessToken, msg, value.contacts, phoneNumberId)
          }
        }

        // Processar status de mensagens (sent, delivered, read)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await processMessageStatus(supabase, clinicId, status)
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[Cloud Webhook] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

// Processar mensagem recebida
async function processIncomingMessage(
  supabase: any,
  clinicId: string,
  accessToken: string | null,
  msg: any,
  contacts: any[],
  phoneNumberId: string
) {
  const messageId = msg.id
  const fromPhone = msg.from // número do cliente (sem @)
  const timestamp = msg.timestamp
  const messageType = msg.type

  // Dados do contato
  const contact = contacts?.find((c: any) => c.wa_id === fromPhone)
  const profileName = contact?.profile?.name || 'Cliente'

  console.log('[Cloud Webhook] Processing message:', { messageId, fromPhone, messageType, profileName })

  // Extrair conteúdo baseado no tipo
  let content = ''
  let mediaType: string | null = null
  let mediaUrl: string | null = null
  let mediaId: string | null = null

  switch (messageType) {
    case 'text':
      content = msg.text?.body || ''
      break

    case 'image':
      content = msg.image?.caption || '[Imagem]'
      mediaType = 'image'
      mediaId = msg.image?.id
      break

    case 'video':
      content = msg.video?.caption || '[Vídeo]'
      mediaType = 'video'
      mediaId = msg.video?.id
      break

    case 'audio':
      content = '[Áudio]'
      mediaType = 'audio'
      mediaId = msg.audio?.id
      break

    case 'document':
      content = msg.document?.filename || '[Documento]'
      mediaType = 'document'
      mediaId = msg.document?.id
      break

    case 'sticker':
      content = '[Sticker]'
      mediaType = 'image'
      mediaId = msg.sticker?.id
      break

    case 'location':
      const lat = msg.location?.latitude
      const lng = msg.location?.longitude
      content = `[Localização: ${lat}, ${lng}]`
      break

    case 'contacts':
      const contactName = msg.contacts?.[0]?.name?.formatted_name || 'Contato'
      content = `[Contato: ${contactName}]`
      break

    case 'button':
      content = msg.button?.text || '[Botão]'
      break

    case 'interactive':
      // Resposta de lista ou botão
      if (msg.interactive?.type === 'button_reply') {
        content = msg.interactive.button_reply?.title || '[Resposta de botão]'
      } else if (msg.interactive?.type === 'list_reply') {
        content = msg.interactive.list_reply?.title || '[Resposta de lista]'
      } else {
        content = '[Interativo]'
      }
      break

    case 'reaction':
      // Reação a uma mensagem
      const emoji = msg.reaction?.emoji
      const reactedMsgId = msg.reaction?.message_id
      console.log('[Cloud Webhook] Reaction received:', { emoji, reactedMsgId })
      // Processar reação separadamente se necessário
      return

    default:
      content = `[${messageType}]`
  }

  // Download de mídia se houver
  if (mediaId && accessToken) {
    try {
      mediaUrl = await downloadAndUploadMedia(supabase, mediaId, accessToken, clinicId, mediaType)
    } catch (e) {
      console.error('[Cloud Webhook] Error downloading media:', e)
    }
  }

  // Buscar ou criar chat
  let { data: chat } = await supabase
    .from('chats')
    .select('id, unread_count')
    .eq('clinic_id', clinicId)
    .eq('phone_number', fromPhone)
    .eq('channel', 'whatsapp')
    .single()

  if (!chat) {
    // Criar novo chat
    const { data: newChat } = await supabase
      .from('chats')
      .insert({
        clinic_id: clinicId,
        client_name: profileName,
        phone_number: fromPhone,
        channel: 'whatsapp',
        status: 'Novo Lead',
        unread_count: 1,
        last_message: content,
        last_message_time: new Date(parseInt(timestamp) * 1000).toISOString(),
      })
      .select('id, unread_count')
      .single()

    chat = newChat
    console.log('[Cloud Webhook] Created new chat:', chat?.id)
  } else {
    // Atualizar chat existente
    await supabase
      .from('chats')
      .update({
        unread_count: (chat.unread_count || 0) + 1,
        last_message: content,
        last_message_time: new Date(parseInt(timestamp) * 1000).toISOString(),
        last_message_from_client: true,
        client_name: profileName, // Atualizar nome se mudou
      })
      .eq('id', chat.id)
  }

  if (!chat) {
    console.error('[Cloud Webhook] Failed to get/create chat')
    return
  }

  // Salvar mensagem
  await supabase.from('messages').insert({
    chat_id: chat.id,
    content: content || '[Sem texto]',
    type: mediaType || 'text',
    media_url: mediaUrl,
    is_from_client: true,
    remote_message_id: messageId,
  })

  // Enviar Broadcast para notificar o cliente em tempo real
  const channel = supabase.channel('leadcare-updates')
  await channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: {
      clinic_id: clinicId,
      chat_id: chat.id,
      from_client: true,
    },
  })

  console.log('[Cloud Webhook] Message saved successfully')
}

// Processar status de mensagem (sent, delivered, read)
async function processMessageStatus(supabase: any, clinicId: string, status: any) {
  const messageId = status.id
  const recipientId = status.recipient_id
  const statusValue = status.status // sent, delivered, read, failed
  const timestamp = status.timestamp
  const errors = status.errors

  console.log('[Cloud Webhook] Status update:', { messageId, statusValue, recipientId })

  if (errors && errors.length > 0) {
    console.error('[Cloud Webhook] Message error:', errors)
  }

  // Mapear status da Meta para nosso formato
  let deliveryStatus: string | null = null
  switch (statusValue) {
    case 'sent':
      deliveryStatus = 'sent'
      break
    case 'delivered':
      deliveryStatus = 'delivered'
      break
    case 'read':
      deliveryStatus = 'read'
      break
    case 'failed':
      deliveryStatus = 'failed'
      break
  }

  if (deliveryStatus) {
    // Atualizar status da mensagem no banco
    const { error } = await supabase
      .from('messages')
      .update({ delivery_status: deliveryStatus })
      .eq('remote_message_id', messageId)

    if (error) {
      console.error('[Cloud Webhook] Error updating message status:', error)
    }
  }
}

// Download de mídia da Cloud API e upload para Supabase Storage
async function downloadAndUploadMedia(
  supabase: any,
  mediaId: string,
  accessToken: string,
  clinicId: string,
  mediaType: string | null
): Promise<string | null> {
  try {
    // 1. Obter URL da mídia
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!mediaInfoResponse.ok) {
      console.error('[Cloud Webhook] Failed to get media info:', await mediaInfoResponse.text())
      return null
    }

    const mediaInfo = await mediaInfoResponse.json()
    const mediaUrl = mediaInfo.url
    const mimeType = mediaInfo.mime_type

    if (!mediaUrl) {
      console.error('[Cloud Webhook] No media URL in response')
      return null
    }

    // 2. Baixar a mídia
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaResponse.ok) {
      console.error('[Cloud Webhook] Failed to download media:', await mediaResponse.text())
      return null
    }

    const mediaBlob = await mediaResponse.blob()

    // 3. Determinar extensão
    let ext = 'bin'
    if (mediaType === 'image') {
      if (mimeType?.includes('png')) ext = 'png'
      else if (mimeType?.includes('webp')) ext = 'webp'
      else ext = 'jpg'
    } else if (mediaType === 'video') {
      ext = 'mp4'
    } else if (mediaType === 'audio') {
      if (mimeType?.includes('ogg')) ext = 'ogg'
      else ext = 'mp3'
    } else if (mediaType === 'document') {
      if (mimeType?.includes('pdf')) ext = 'pdf'
      else if (mimeType?.includes('word')) ext = 'docx'
      else if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) ext = 'xlsx'
      else ext = 'bin'
    }

    // 4. Upload para Supabase Storage
    const fileName = `cloud_${clinicId}/${Date.now()}_${mediaId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, mediaBlob, { contentType: mimeType || 'application/octet-stream' })

    if (uploadError) {
      console.error('[Cloud Webhook] Upload error:', uploadError)
      return null
    }

    // 5. Obter URL pública
    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName)
    return urlData?.publicUrl || null
  } catch (e) {
    console.error('[Cloud Webhook] Media processing error:', e)
    return null
  }
}
