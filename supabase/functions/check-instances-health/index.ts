import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar configurações da Evolution API
    const { data: settings } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key')
      .single()

    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar todas as instâncias
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, status, clinic_id, last_webhook_at, clinics(name)')

    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma instância encontrada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar configuração de alertas
    const { data: alertSettings } = await supabase
      .from('alert_settings')
      .select('alert_phone, alert_instance_name')
      .eq('enabled', true)
      .single()

    const results: any[] = []
    const disconnectedInstances: any[] = []
    const silentInstances: any[] = [] // Instâncias conectadas mas sem mensagens

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    for (const instance of instances) {
      const startTime = Date.now()
      let apiStatus = 'unknown'
      let errorMessage: string | null = null

      try {
        const response = await fetch(
          `${settings.evolution_api_url}/instance/connectionState/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { 'apikey': settings.evolution_api_key },
          }
        )

        const responseTime = Date.now() - startTime

        if (response.ok) {
          const data = await response.json()
          apiStatus = data.instance?.state || data.state || 'unknown'
        } else {
          apiStatus = 'error'
          errorMessage = `HTTP ${response.status}`
        }

        // Salvar métrica de saúde
        await supabase.from('instance_health').insert({
          instance_id: instance.id,
          api_status: apiStatus,
          response_time_ms: responseTime,
          error_message: errorMessage
        })

        // Determinar novo status
        let newStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected'
        if (apiStatus === 'open') newStatus = 'connected'
        else if (apiStatus === 'connecting') newStatus = 'connecting'

        // Se mudou de conectado para desconectado, registrar e alertar
        if (instance.status === 'connected' && newStatus === 'disconnected') {
          // Registrar no histórico
          await supabase.from('instance_connection_history').insert({
            instance_id: instance.id,
            status: 'disconnected'
          })

          disconnectedInstances.push({
            name: instance.instance_name,
            clinic: (instance as any).clinics?.name || 'Desconhecida'
          })
        }

        // Verificar "silêncio" - conectada mas sem mensagens há mais de 1 hora
        if (newStatus === 'connected' && instance.last_webhook_at) {
          const lastWebhook = new Date(instance.last_webhook_at)
          const now = new Date()
          const diffHours = (now.getTime() - lastWebhook.getTime()) / (1000 * 60 * 60)
          
          if (diffHours > 1) {
            silentInstances.push({
              name: instance.instance_name,
              clinic: (instance as any).clinics?.name || 'Desconhecida',
              lastMessage: Math.round(diffHours) + 'h atrás'
            })
          }
        }

        // Atualizar status da instância
        if (newStatus !== instance.status) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: newStatus,
              connected_at: newStatus === 'connected' ? new Date().toISOString() : null
            })
            .eq('id', instance.id)
        }

        results.push({
          instance: instance.instance_name,
          previousStatus: instance.status,
          currentStatus: newStatus,
          apiStatus,
          responseTime,
          lastWebhook: instance.last_webhook_at
        })

      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
        
        await supabase.from('instance_health').insert({
          instance_id: instance.id,
          api_status: 'error',
          error_message: errorMessage
        })

        results.push({
          instance: instance.instance_name,
          error: errorMessage
        })
      }
    }

    // Enviar alertas - USAR INSTÂNCIA CONFIGURADA
    if (alertSettings?.alert_phone) {
      // Usar instância configurada ou buscar uma conectada como fallback
      let alertInstanceName = alertSettings.alert_instance_name
      
      if (!alertInstanceName) {
        // Fallback: buscar primeira instância conectada
        const { data: connectedInstance } = await supabase
          .from('whatsapp_instances')
          .select('instance_name')
          .eq('status', 'connected')
          .limit(1)
          .single()
        
        alertInstanceName = connectedInstance?.instance_name
      }

      if (alertInstanceName) {
        // Alerta de desconexão
        if (disconnectedInstances.length > 0) {
          const alertMessage = `⚠️ *ALERTA BELITX*\n\n` +
            `${disconnectedInstances.length} instância(s) desconectada(s):\n\n` +
            disconnectedInstances.map(i => `• ${i.clinic} (${i.name})`).join('\n') +
            `\n\n_Verificação automática_`

          try {
            await fetch(
              `${settings.evolution_api_url}/message/sendText/${alertInstanceName}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': settings.evolution_api_key
                },
                body: JSON.stringify({
                  number: alertSettings.alert_phone,
                  text: alertMessage
                })
              }
            )
            console.log('Alerta de desconexão enviado via', alertInstanceName)
          } catch (alertErr) {
            console.error('Erro ao enviar alerta:', alertErr)
          }
        }

        // Alerta de silêncio (instância conectada mas sem mensagens)
        if (silentInstances.length > 0) {
          const silentMessage = `🔇 *ALERTA BELITX - SILÊNCIO*\n\n` +
            `${silentInstances.length} instância(s) conectada(s) mas sem receber mensagens:\n\n` +
            silentInstances.map(i => `• ${i.clinic}\n  Última msg: ${i.lastMessage}`).join('\n') +
            `\n\n_Pode indicar problema no webhook_`

          try {
            await fetch(
              `${settings.evolution_api_url}/message/sendText/${alertInstanceName}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': settings.evolution_api_key
                },
                body: JSON.stringify({
                  number: alertSettings.alert_phone,
                  text: silentMessage
                })
              }
            )
            console.log('Alerta de silêncio enviado via', alertInstanceName)
          } catch (alertErr) {
            console.error('Erro ao enviar alerta de silêncio:', alertErr)
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: results.length,
      disconnected: disconnectedInstances.length,
      silent: silentInstances.length,
      results,
      silentInstances
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
