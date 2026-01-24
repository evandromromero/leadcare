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
    const { clinic_id, action } = body

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: 'clinic_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar configurações Cloud API da clínica
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('cloud_api_access_token, cloud_api_waba_id, cloud_api_phone_number_id')
      .eq('id', clinic_id)
      .single()

    if (clinicError || !clinic) {
      return new Response(JSON.stringify({ error: 'Clinic not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = clinic.cloud_api_access_token
    const wabaId = clinic.cloud_api_waba_id
    const phoneNumberId = clinic.cloud_api_phone_number_id

    if (!accessToken || !wabaId) {
      return new Response(JSON.stringify({ error: 'Cloud API not configured (need access_token and waba_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'sync_templates': {
        // Buscar templates do Meta
        const response = await fetch(
          `${GRAPH_API_URL}/${wabaId}/message_templates?limit=100`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('Error fetching templates:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch templates from Meta', details: error }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const data = await response.json()
        const templates = data.data || []

        console.log(`Found ${templates.length} templates for WABA ${wabaId}`)

        // Upsert templates no banco
        for (const template of templates) {
          await supabase
            .from('whatsapp_templates')
            .upsert({
              clinic_id: clinic_id,
              template_id: template.id,
              name: template.name,
              language: template.language || 'pt_BR',
              category: template.category,
              status: template.status,
              components: template.components,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'clinic_id,template_id'
            })
        }

        return new Response(JSON.stringify({ 
          success: true, 
          count: templates.length,
          templates: templates.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            category: t.category,
            language: t.language
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'list_templates': {
        // Listar templates salvos no banco
        const { data: templates, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('clinic_id', clinic_id)
          .order('name')

        if (error) {
          return new Response(JSON.stringify({ error: 'Failed to fetch templates from database' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ 
          success: true, 
          templates: templates || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'send_template': {
        const { phone, template_name, template_language, variables, header_params, button_params } = body

        if (!phone || !template_name) {
          return new Response(JSON.stringify({ error: 'phone and template_name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!phoneNumberId) {
          return new Response(JSON.stringify({ error: 'Phone number ID not configured' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Formatar número
        let formattedPhone = phone.replace(/\D/g, '')
        if (formattedPhone.length === 11 && formattedPhone.startsWith('0')) {
          formattedPhone = '55' + formattedPhone.substring(1)
        } else if (formattedPhone.length === 10 || formattedPhone.length === 11) {
          formattedPhone = '55' + formattedPhone
        }

        // Montar body do template
        const templateBody: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: template_name,
            language: { code: template_language || 'pt_BR' }
          }
        }

        // Montar componentes
        const components: any[] = []

        // Header params (imagem, documento, vídeo)
        if (header_params) {
          components.push({
            type: 'header',
            parameters: header_params
          })
        }

        // Body variables
        if (variables && variables.length > 0) {
          components.push({
            type: 'body',
            parameters: variables.map((v: string) => ({
              type: 'text',
              text: v
            }))
          })
        }

        // Button params (URL dinâmica, quick reply)
        if (button_params && button_params.length > 0) {
          button_params.forEach((btn: any, index: number) => {
            components.push({
              type: 'button',
              sub_type: btn.sub_type || 'url',
              index: btn.index ?? index,
              parameters: btn.parameters
            })
          })
        }

        if (components.length > 0) {
          templateBody.template.components = components
        }

        console.log('Sending template:', JSON.stringify(templateBody, null, 2))

        const response = await fetch(
          `${GRAPH_API_URL}/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateBody)
          }
        )

        const result = await response.json()

        if (result.error) {
          console.error('Error sending template:', result.error)
          return new Response(JSON.stringify({ 
            error: result.error.message || 'Failed to send template',
            details: result.error
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message_id: result.messages?.[0]?.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'send_bulk_template': {
        // Envio em massa de templates
        const { phones, template_name, template_language, variables_map } = body

        if (!phones || !Array.isArray(phones) || phones.length === 0) {
          return new Response(JSON.stringify({ error: 'phones array is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!template_name) {
          return new Response(JSON.stringify({ error: 'template_name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!phoneNumberId) {
          return new Response(JSON.stringify({ error: 'Phone number ID not configured' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const results: any[] = []
        let successCount = 0
        let errorCount = 0

        for (const phoneEntry of phones) {
          const phone = typeof phoneEntry === 'string' ? phoneEntry : phoneEntry.phone
          const variables = variables_map?.[phone] || (typeof phoneEntry === 'object' ? phoneEntry.variables : null)

          // Formatar número
          let formattedPhone = phone.replace(/\D/g, '')
          if (formattedPhone.length === 11 && formattedPhone.startsWith('0')) {
            formattedPhone = '55' + formattedPhone.substring(1)
          } else if (formattedPhone.length === 10 || formattedPhone.length === 11) {
            formattedPhone = '55' + formattedPhone
          }

          // Montar body
          const templateBody: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'template',
            template: {
              name: template_name,
              language: { code: template_language || 'pt_BR' }
            }
          }

          if (variables && variables.length > 0) {
            templateBody.template.components = [{
              type: 'body',
              parameters: variables.map((v: string) => ({ type: 'text', text: v }))
            }]
          }

          try {
            const response = await fetch(
              `${GRAPH_API_URL}/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateBody)
              }
            )

            const result = await response.json()

            if (result.error) {
              results.push({ phone, success: false, error: result.error.message })
              errorCount++
            } else {
              results.push({ phone, success: true, message_id: result.messages?.[0]?.id })
              successCount++
            }
          } catch (e: any) {
            results.push({ phone, success: false, error: e.message })
            errorCount++
          }

          // Rate limit: aguardar 100ms entre envios
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        return new Response(JSON.stringify({ 
          success: true,
          total: phones.length,
          sent: successCount,
          failed: errorCount,
          results
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
