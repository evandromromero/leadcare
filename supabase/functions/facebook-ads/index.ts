import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar configurações do Facebook Ads
    const { data: settings } = await supabase
      .from('settings')
      .select('facebook_ads_account_id, facebook_ads_token')
      .single()

    if (!settings?.facebook_ads_account_id || !settings?.facebook_ads_token) {
      return new Response(
        JSON.stringify({ error: 'Configurações do Facebook Ads não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, date_preset, time_range } = body

    const accountId = settings.facebook_ads_account_id
    const accessToken = settings.facebook_ads_token

    if (action === 'get_campaigns') {
      // Campos a buscar - lista completa de métricas disponíveis
      const fields = [
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'ad_id',
        'ad_name',
        'spend',
        'impressions',
        'clicks',
        'cpc',
        'cpm',
        'cpp',
        'ctr',
        'objective',
        'reach',
        'frequency',
        'unique_clicks',
        'unique_ctr',
        'cost_per_unique_click',
        'actions',
        'cost_per_action_type',
        'video_p25_watched_actions',
        'video_p50_watched_actions',
        'video_p75_watched_actions',
        'video_p100_watched_actions',
        'account_name'
      ].join(',')

      // Construir URL da API do Facebook
      let url = `https://graph.facebook.com/v18.0/act_${accountId}/insights?fields=${fields}&level=campaign&access_token=${accessToken}`
      
      // Adicionar filtro de data
      if (date_preset) {
        url += `&date_preset=${date_preset}`
      } else if (time_range) {
        url += `&time_range=${JSON.stringify(time_range)}`
      } else {
        url += `&date_preset=last_30d`
      }

      console.log('Buscando campanhas do Facebook Ads...')
      
      const response = await fetch(url)
      const data = await response.json()

      if (data.error) {
        console.error('Erro Facebook API:', data.error)
        return new Response(
          JSON.stringify({ error: data.error.message || 'Erro ao buscar campanhas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, data: data.data || [], paging: data.paging }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get_account_info') {
      const url = `https://graph.facebook.com/v18.0/act_${accountId}?fields=name,account_status,amount_spent,balance,currency&access_token=${accessToken}`
      
      const response = await fetch(url)
      const data = await response.json()

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
