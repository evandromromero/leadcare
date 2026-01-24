import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH_API_VERSION = 'v18.0'
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.json()
    const { clinic_id, action, phone, message, media_url, media_type, caption, message_id, emoji, template_name, template_language, template_components } = body

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar configurações Cloud API da clínica
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('cloud_api_access_token, cloud_api_phone_number_id')
      .eq('id', clinic_id)
      .single()

    if (clinicError || !clinic) {
      return new Response(JSON.stringify({ error: 'Clinic not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = clinic.cloud_api_access_token
    const phoneNumberId = clinic.cloud_api_phone_number_id

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: 'Cloud API not configured for this clinic' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Formatar número de telefone (remover caracteres especiais, adicionar código país)
    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.length === 11 && formattedPhone.startsWith('0')) {
      formattedPhone = '55' + formattedPhone.substring(1)
    } else if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = '55' + formattedPhone
    }

    let result: any = null

    switch (action) {
      case 'send_text': {
        // Enviar mensagem de texto
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: { body: message }
          })
        })
        result = await response.json()
        break
      }

      case 'send_image': {
        // Enviar imagem via URL
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'image',
            image: {
              link: media_url,
              caption: caption || ''
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_video': {
        // Enviar vídeo via URL
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'video',
            video: {
              link: media_url,
              caption: caption || ''
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_audio': {
        // Enviar áudio via URL
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'audio',
            audio: {
              link: media_url
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_document': {
        // Enviar documento/PDF via URL
        const fileName = media_url.split('/').pop() || 'document'
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'document',
            document: {
              link: media_url,
              caption: caption || '',
              filename: fileName
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_reaction': {
        // Enviar reação a uma mensagem
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'reaction',
            reaction: {
              message_id: message_id,
              emoji: emoji || '' // Emoji vazio remove a reação
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_template': {
        // Enviar mensagem de template (HSM)
        const templatePayload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: template_name,
            language: {
              code: template_language || 'pt_BR'
            }
          }
        }

        // Adicionar componentes se fornecidos (header, body, buttons)
        if (template_components && template_components.length > 0) {
          templatePayload.template.components = template_components
        }

        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templatePayload)
        })
        result = await response.json()
        break
      }

      case 'send_location': {
        // Enviar localização
        const { latitude, longitude, name, address } = body
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'location',
            location: {
              latitude,
              longitude,
              name: name || '',
              address: address || ''
            }
          })
        })
        result = await response.json()
        break
      }

      case 'send_contacts': {
        // Enviar contato
        const { contacts } = body
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'contacts',
            contacts: contacts
          })
        })
        result = await response.json()
        break
      }

      case 'mark_as_read': {
        // Marcar mensagem como lida
        const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: message_id
          })
        })
        result = await response.json()
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Verificar se houve erro na resposta do Meta
    if (result.error) {
      console.error('Cloud API error:', result.error)
      return new Response(JSON.stringify({ 
        error: result.error.message || 'Cloud API error',
        details: result.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extrair message_id da resposta
    const remoteMessageId = result.messages?.[0]?.id || null

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: remoteMessageId,
      result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
