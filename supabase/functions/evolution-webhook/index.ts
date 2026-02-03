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
    // Usar remoteJidAlt se remoteJid for do tipo @lid (novo formato do WhatsApp)
    let remoteJid = key.remoteJid || ''
    if (remoteJid.endsWith('@lid') && key.remoteJidAlt) {
      remoteJid = key.remoteJidAlt
      console.log('Using remoteJidAlt instead of @lid:', remoteJid)
    }
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

    // Detectar se veio de anúncio Click to WhatsApp (Meta Ads)
    let isFromMetaAd = false
    let metaAdInfo: { title?: string; body?: string; sourceType?: string; sourceId?: string; sourceUrl?: string } | null = null
    
    // Verificar contextInfo em diferentes tipos de mensagem
    const contextInfo = messageObj?.extendedTextMessage?.contextInfo || 
                        messageObj?.conversation?.contextInfo ||
                        messageObj?.imageMessage?.contextInfo ||
                        messageObj?.videoMessage?.contextInfo ||
                        data.contextInfo
    
    if (contextInfo?.externalAdReply) {
      isFromMetaAd = true
      metaAdInfo = {
        title: contextInfo.externalAdReply.title,
        body: contextInfo.externalAdReply.body,
        sourceType: contextInfo.externalAdReply.sourceType,
        sourceId: contextInfo.externalAdReply.sourceId,
        sourceUrl: contextInfo.externalAdReply.sourceUrl
      }
      console.log('Mensagem de anúncio Meta detectada:', JSON.stringify(metaAdInfo))
    }

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
          .select('id, unread_count, source_id')
          .eq('clinic_id', clinicId)
          .eq('group_id', groupId)
          .single()
      : await supabase
          .from('chats')
          .select('id, unread_count, source_id')
          .eq('clinic_id', clinicId)
          .eq('phone_number', phone)
          .eq('is_group', false)
          .single()

    // Nome do grupo vem em pushName ou no subject do grupo
    const groupName = isGroup ? (data.pushName || data.groupSubject || `Grupo ${phone}`) : null
    // Para grupos, o remetente da mensagem vem em participant
    const senderName = isGroup ? (data.pushName || 'Participante') : pushName

    // Detectar código de campanha na mensagem OU anúncio Meta (para chat novo ou existente sem source)
    let detectedSourceId: string | null = null
    let detectedCode: string | null = null
    
    // Lista de marcadores de mídia que NÃO devem ser considerados códigos
    const mediaMarkers = ['AUDIO', 'IMAGEM', 'VIDEO', 'DOCUMENTO', 'STICKER', 'LOCALIZACAO', 'CONTATO', 'FIGURINHA', 'IMAGE', 'DOCUMENT', 'LOCATION', 'CONTACT']
    
    if (message && !isFromMe && !isGroup) {
      // PRIORIDADE 1: Buscar código na mensagem (padrões conhecidos) - códigos entre () ou []
      const codePatterns = [
        /\[([A-Z]{1,5}[0-9]{1,4})\]/i,              // [K1], [AV2], [KR1] - código entre colchetes (prioridade)
        /\(([A-Z]{1,5}[0-9]{1,3})\)/i,              // (AV2), (KR1) - código entre parênteses
        /\b(AV[0-9]{1,2})\b/i,                      // AV1, AV2 em qualquer lugar
        /\b(KR[0-9]{1,2})\b/i,                      // KR3, KR5 em qualquer lugar
        /\b(ACV[0-9]{1,2})\b/i,                     // ACV1, ACV3 em qualquer lugar
        /\b(K[0-9]{1,2})\b/i,                       // K1, K2 em qualquer lugar
        /\b(T[0-9]{1,2})\b/i,                       // T1, T2 em qualquer lugar
        /\b(A[0-9]{1,2})\b/i,                       // A1, A2, A3 em qualquer lugar
      ]
      
      for (const pattern of codePatterns) {
        const match = message.match(pattern)
        if (match && match[1]) {
          const potentialCode = match[1].toUpperCase()
          // Ignorar se for um marcador de mídia
          if (!mediaMarkers.includes(potentialCode)) {
            detectedCode = potentialCode
            break
          }
        }
      }
      
      // PRIORIDADE 2: Se não encontrou código na mensagem e veio de anúncio Meta, usar título do anúncio
      if (!detectedCode && isFromMetaAd && metaAdInfo?.title) {
        // Tentar extrair código do título do anúncio (ex: "Campanha AV1 - Dra Kamylle", "A9", "T1")
        // Aceita 1-5 letras + 1-4 números (A9, T1, AV1, KR5, etc.)
        const titleMatch = metaAdInfo.title.match(/\b([A-Z]{1,5}[0-9]{1,4})\b/i)
        if (titleMatch) {
          detectedCode = titleMatch[1].toUpperCase()
        } else {
          // Usar o título completo como código (limitado a 20 chars)
          detectedCode = metaAdInfo.title.substring(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, '_')
        }
      }
      
      if (detectedCode) {
        console.log('Código de campanha detectado:', detectedCode, 'isFromMetaAd:', isFromMetaAd)
        
        // PRIORIDADE 1: Buscar em trackable_links pelo código (links rastreáveis)
        const { data: trackableLink } = await supabase
          .from('trackable_links')
          .select('id, source_id')
          .eq('clinic_id', clinicId)
          .ilike('code', detectedCode)
          .maybeSingle()
        
        if (trackableLink) {
          // Se o link tem source_id, usar
          if (trackableLink.source_id) {
            detectedSourceId = trackableLink.source_id
            console.log('Source encontrado via trackable_link:', detectedCode, detectedSourceId)
          }
          
          // Associar o clique mais recente (últimos 30 min) ao chat quando ele for criado/atualizado
          // Isso será feito após criar/atualizar o chat
          console.log('Trackable link encontrado:', trackableLink.id, 'código:', detectedCode)
        }
        
        if (!trackableLink?.source_id) {
          // PRIORIDADE 2: Buscar lead_source existente com esse código
          const { data: existingSource } = await supabase
            .from('lead_sources')
            .select('id')
            .eq('clinic_id', clinicId)
            .ilike('code', detectedCode)
            .maybeSingle()
          
          if (existingSource) {
            detectedSourceId = existingSource.id
            console.log('Lead source encontrado:', detectedSourceId)
          } else {
            // Criar novo lead_source automaticamente
            const sourceName = isFromMetaAd && metaAdInfo?.title 
              ? `${metaAdInfo.title.substring(0, 30)}` 
              : detectedCode
            
            const { data: newSource } = await supabase
              .from('lead_sources')
              .insert({
                clinic_id: clinicId,
                name: sourceName,
                code: detectedCode,
                color: isFromMetaAd ? '#E1306C' : '#6366f1' // Rosa Instagram se Meta, Indigo se código manual
              })
              .select('id')
              .single()
            
            if (newSource) {
              detectedSourceId = newSource.id
              console.log('Novo lead source criado:', detectedCode, detectedSourceId, 'isFromMetaAd:', isFromMetaAd)
            }
          }
        }
      }
    }

    if (!chat) {
      // Criar chat (grupo ou individual)
      // Se a mensagem é do atendente (isFromMe), usar o telefone como nome temporário
      // pois o pushName seria o nome do perfil da clínica, não do cliente
      const clientName = isGroup 
        ? groupName 
        : (isFromMe ? phone : (pushName || 'Cliente'))
      
      // Identificar conta Meta Ads se for anúncio
      let metaAccountId: string | null = null
      if (isFromMetaAd && metaAdInfo?.sourceId) {
        try {
          // Buscar contas Meta da clínica
          const { data: metaAccounts } = await supabase
            .from('clinic_meta_accounts')
            .select('account_id, access_token')
            .eq('clinic_id', clinicId)
          
          if (metaAccounts && metaAccounts.length > 0) {
            // Tentar identificar qual conta possui o anúncio
            for (const account of metaAccounts) {
              if (!account.access_token) continue
              try {
                const adResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${metaAdInfo.sourceId}?fields=account_id&access_token=${account.access_token}`
                )
                if (adResponse.ok) {
                  const adData = await adResponse.json()
                  if (adData.account_id) {
                    metaAccountId = adData.account_id
                    console.log('Meta account identificado para anúncio:', metaAccountId)
                    break
                  }
                }
              } catch (e) {
                // Continuar tentando outras contas
              }
            }
            // Se não conseguiu identificar via API, usar a primeira conta como fallback
            if (!metaAccountId && metaAccounts.length === 1) {
              metaAccountId = metaAccounts[0].account_id
            }
          }
        } catch (e) {
          console.error('Erro ao identificar conta Meta:', e)
        }
      }
      
      const chatData = {
        clinic_id: clinicId,
        client_name: clientName,
        phone_number: isGroup ? phone : phone,
        group_id: groupId,
        is_group: isGroup,
        status: isFromMe ? 'Em Atendimento' : 'Novo Lead',
        unread_count: isFromMe ? 0 : 1,
        last_message: isGroup ? `${senderName}: ${message}` : message,
        last_message_time: new Date().toISOString(),
        instance_id: instance.id,
        source_id: detectedSourceId,
        // Dados do anúncio Meta (Click to WhatsApp)
        ad_title: isFromMetaAd ? metaAdInfo?.title : null,
        ad_body: isFromMetaAd ? metaAdInfo?.body : null,
        ad_source_id: isFromMetaAd ? metaAdInfo?.sourceId : null,
        ad_source_url: isFromMetaAd ? metaAdInfo?.sourceUrl : null,
        ad_source_type: isFromMetaAd ? metaAdInfo?.sourceType : null,
        meta_account_id: metaAccountId
      }
      
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert(chatData)
        .select('id, unread_count')
        .single()
      
      if (chatError) {
        console.error('ERRO CRÍTICO ao criar chat:', chatError, 'Dados:', JSON.stringify(chatData))
        // Tentar novamente uma vez
        const { data: retryChat, error: retryError } = await supabase
          .from('chats')
          .insert(chatData)
          .select('id, unread_count')
          .single()
        
        if (retryError) {
          console.error('ERRO CRÍTICO (retry) ao criar chat:', retryError)
          throw new Error(`Falha ao criar chat após retry: ${retryError.message}`)
        }
        chat = retryChat
      } else {
        chat = newChat
      }
      
      if (!chat) {
        console.error('ERRO CRÍTICO: Chat não foi criado e não houve erro. Dados:', JSON.stringify(chatData))
        throw new Error('Chat não foi criado - resultado null sem erro')
      }
      
      // Se não detectou código na mensagem, tentar cruzar com clique recente (últimos 5 minutos)
      if (!detectedSourceId && !isFromMe && !isGroup && newChat) {
        try {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          
          // Buscar clique mais recente da clínica que ainda não foi convertido
          const { data: recentClicks } = await supabase
            .from('link_clicks')
            .select('id, link_id, clicked_at')
            .eq('clinic_id', clinicId)
            .is('chat_id', null)
            .gte('clicked_at', fiveMinutesAgo)
            .order('clicked_at', { ascending: false })
            .limit(1)
          
          if (recentClicks && recentClicks.length > 0) {
            const recentClick = recentClicks[0]
            
            // Buscar o source_id do link
            const { data: linkData } = await supabase
              .from('trackable_links')
              .select('source_id')
              .eq('id', recentClick.link_id)
              .single()
            
            if (linkData?.source_id) {
              // Atualizar o chat com o source_id
              await supabase
                .from('chats')
                .update({ source_id: linkData.source_id })
                .eq('id', newChat.id)
              
              // Marcar o clique como convertido
              await supabase
                .from('link_clicks')
                .update({ 
                  chat_id: newChat.id, 
                  converted_to_lead: true,
                  converted_at: new Date().toISOString()
                })
                .eq('id', recentClick.id)
              
              // Incrementar contador de leads do link
              await supabase.rpc('increment_leads_count', { link_id: recentClick.link_id })
              
              console.log('Clique cruzado por tempo (5min):', recentClick.id, '-> chat:', newChat.id, 'source_id:', linkData.source_id)
            }
          }
        } catch (e) {
          console.error('Erro ao cruzar clique por tempo:', e)
        }
      }
      
      // Enviar evento Contact para Meta Conversions API (novo lead)
      if (newChat && !isFromMe && !isGroup) {
        try {
          // Buscar configurações do Facebook da clínica
          const { data: clinicData } = await supabase
            .from('clinics')
            .select('facebook_dataset_id, facebook_api_token, meta_funnel_events')
            .eq('id', clinicId)
            .single()
          
          if (clinicData?.facebook_dataset_id && clinicData?.facebook_api_token) {
            const funnelEvents = (clinicData as any).meta_funnel_events as Record<string, string> | null
            const eventName = funnelEvents?.['Novo Lead'] || 'Contact'
            
            // Hash SHA256 do telefone
            const encoder = new TextEncoder()
            const phoneNormalized = phone.toLowerCase().trim()
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(phoneNormalized))
            const phoneHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
            
            const eventTime = Math.floor(Date.now() / 1000)
            const eventId = `webhook_${eventName.toLowerCase()}_${newChat.id.substring(0, 8)}_${eventTime}`
            
            const eventData = {
              data: [{
                event_name: eventName,
                event_time: eventTime,
                event_id: eventId,
                action_source: 'website',
                user_data: { ph: phoneHash, external_id: newChat.id },
              }],
            }
            
            // Salvar log
            await supabase.from('meta_conversion_logs').insert({
              clinic_id: clinicId,
              chat_id: newChat.id,
              event_id: eventId,
              event_name: eventName,
              event_time: eventTime,
              value: 0,
              payload: eventData,
              status: 'pending',
            })
            
            // Enviar para Meta
            const response = await fetch(
              `https://graph.facebook.com/v18.0/${clinicData.facebook_dataset_id}/events?access_token=${clinicData.facebook_api_token}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData),
              }
            )
            
            if (response.ok) {
              console.log('Evento Contact enviado para Meta:', eventId)
              await supabase.from('meta_conversion_logs').update({ status: 'success' }).eq('event_id', eventId)
            } else {
              const errorData = await response.json()
              console.error('Erro ao enviar evento Contact:', errorData)
              await supabase.from('meta_conversion_logs').update({ status: 'error', response: errorData }).eq('event_id', eventId)
            }
          }
        } catch (e) {
          console.error('Erro ao enviar evento Meta:', e)
        }
      }
    } else {
      // Atualiza chat - zera unread se for mensagem enviada (fromMe), incrementa se for do cliente
      const updateData: Record<string, unknown> = {
        unread_count: isFromMe ? 0 : (chat.unread_count || 0) + 1,
        last_message: isGroup ? `${senderName}: ${message}` : message,
        last_message_time: new Date().toISOString(),
        last_message_from_client: !isFromMe
      }
      
      // Se detectamos um código de link rastreável, SEMPRE atualizar o source_id
      // Isso permite remarketing: pessoa que veio do Facebook pode clicar em link depois
      if (detectedSourceId) {
        try {
          // Verificar se o source_id detectado é de um link rastreável (tem prioridade)
          const { data: isTrackableSource } = await supabase
            .from('trackable_links')
            .select('id')
            .eq('source_id', detectedSourceId)
            .maybeSingle()
          
          if (isTrackableSource) {
            // É um link rastreável - sempre atualiza (remarketing)
            updateData.source_id = detectedSourceId
            console.log('Atualizando source_id para link rastreável (remarketing):', detectedSourceId, 'chat:', chat.id)
          } else if (!chat.source_id) {
            // Não é link rastreável e chat não tem source - vincular
            updateData.source_id = detectedSourceId
            console.log('Vinculando source_id ao chat existente:', detectedSourceId, 'chat:', chat.id)
          }
        } catch (e) {
          console.error('Erro ao verificar trackable_links:', e)
          // Continua sem atualizar source_id
        }
      }
      
      // Se a mensagem é do cliente e temos pushName, atualizar o nome do cliente
      // Isso corrige casos onde o chat foi criado pelo atendente e o nome ficou como telefone
      if (!isFromMe && !isGroup && pushName && pushName !== 'Cliente') {
        // Buscar o nome atual do chat
        const { data: currentChat } = await supabase
          .from('chats')
          .select('client_name')
          .eq('id', chat.id)
          .single()
        
        // Só atualiza se o nome atual for um número de telefone (não foi definido pelo cliente ainda)
        const currentName = (currentChat as any)?.client_name || ''
        if (/^\d+$/.test(currentName) || currentName === 'Cliente') {
          updateData.client_name = pushName
        }
      }
      
      await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chat.id)
    }

    // Associar clique do link rastreável ao chat (se detectamos um código de link)
    if (chat && detectedCode && !isFromMe && !isGroup) {
      try {
        // Buscar o trackable_link pelo código
        const { data: trackableLink } = await supabase
          .from('trackable_links')
          .select('id')
          .eq('clinic_id', clinicId)
          .ilike('code', detectedCode)
          .maybeSingle()
        
        if (trackableLink) {
          // Buscar o clique mais recente (últimos 7 dias) deste link que ainda não tem chat_id
          // Janela de 7 dias para capturar remarketing (pessoa clica hoje, envia mensagem amanhã)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          
          const { data: recentClicks } = await supabase
            .from('link_clicks')
            .select('id')
            .eq('link_id', trackableLink.id)
            .is('chat_id', null)
            .gte('clicked_at', sevenDaysAgo)
            .order('clicked_at', { ascending: false })
            .limit(1)
          
          const recentClick = recentClicks && recentClicks.length > 0 ? recentClicks[0] : null
          
          if (recentClick) {
            // Associar o clique ao chat
            await supabase
              .from('link_clicks')
              .update({ 
                chat_id: chat.id, 
                converted_to_lead: true,
                converted_at: new Date().toISOString()
              })
              .eq('id', recentClick.id)
            
            // Incrementar leads_count do link rastreável
            await supabase.rpc('increment_leads_count', { link_id: trackableLink.id })
            
            console.log('Clique associado ao chat (remarketing):', recentClick.id, '-> chat:', chat.id, 'código:', detectedCode)
          } else {
            console.log('Nenhum clique encontrado nos últimos 7 dias para associar. Link:', trackableLink.id, 'código:', detectedCode)
          }
        } else {
          console.log('Trackable link não encontrado para código:', detectedCode)
        }
      } catch (e) {
        console.error('Erro ao associar clique ao chat:', e)
      }
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

    // Save message (incluindo sender_name para grupos)
    const messageData = {
      chat_id: chat!.id,
      content: message || '[Sem texto]',
      type: mediaType || 'text',
      media_url: finalMediaUrl,
      is_from_client: !isFromMe,
      remote_message_id: messageId || null,
      sender_name: isGroup && !isFromMe ? senderName : null
    }
    
    const { error: msgError } = await supabase.from('messages').insert(messageData)
    
    if (msgError) {
      console.error('ERRO CRÍTICO ao salvar mensagem:', msgError, 'Dados:', JSON.stringify(messageData))
      // Tentar novamente uma vez
      const { error: retryMsgError } = await supabase.from('messages').insert(messageData)
      if (retryMsgError) {
        console.error('ERRO CRÍTICO (retry) ao salvar mensagem:', retryMsgError)
        // Não lançar erro aqui para não perder o chat já criado
        // Mas logar para investigação
      }
    }

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
