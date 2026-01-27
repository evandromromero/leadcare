import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar configurações do Easypanel
    const { data: settings } = await supabase
      .from('settings')
      .select('easypanel_url, easypanel_token, easypanel_project, easypanel_service')
      .eq('id', 1)
      .single()

    if (!settings?.easypanel_url || !settings?.easypanel_token) {
      return new Response(
        JSON.stringify({ error: 'Configurações do Easypanel não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action } = body

    if (action === 'redeploy') {
      // Reiniciar serviço no Easypanel
      const response = await fetch(
        `${settings.easypanel_url}/api/trpc/services.redeploy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.easypanel_token}`,
          },
          body: JSON.stringify({
            json: {
              projectName: settings.easypanel_project || 'evolutionaoi',
              serviceName: settings.easypanel_service || 'evolution-api',
            }
          }),
        }
      )

      if (response.ok) {
        // Marcar todas as instâncias como desconectadas temporariamente
        await supabase
          .from('whatsapp_instances')
          .update({ status: 'disconnected' })
          .neq('status', 'disconnected')

        return new Response(
          JSON.stringify({ success: true, message: 'Evolution API reiniciando...' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: errorData.message || `Erro ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
