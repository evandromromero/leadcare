import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailSend {
  id: string;
  email: string;
  lead_name: string;
  lead_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaignId, action } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: "campaignId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar campanha com template
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select(`
        *,
        template:email_templates(*)
      `)
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campanha não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Buscar configurações da clínica
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("*, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_encryption, email_daily_limit, email_sent_today, email_sent_today_reset_at, email_batch_size, email_batch_delay_seconds")
      .eq("id", campaign.clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, error: "Clínica não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Verificar configurações SMTP
    if (!clinic.smtp_host || !clinic.smtp_user || !clinic.smtp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações SMTP não definidas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Resetar contador diário se necessário
    const today = new Date().toISOString().split('T')[0];
    let emailsSentToday = clinic.email_sent_today || 0;
    
    if (clinic.email_sent_today_reset_at !== today) {
      emailsSentToday = 0;
      await supabase
        .from("clinics")
        .update({ email_sent_today: 0, email_sent_today_reset_at: today })
        .eq("id", clinic.id);
    }

    // Verificar limite diário
    const dailyLimit = clinic.email_daily_limit || 100;
    const remainingToday = dailyLimit - emailsSentToday;

    if (remainingToday <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Limite diário de emails atingido. Tente novamente amanhã.",
          dailyLimit,
          emailsSentToday
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Se action é "prepare", preparar lista de destinatários
    if (action === "prepare") {
      // Buscar leads com email baseado no target_type
      let leadsQuery = supabase
        .from("chats")
        .select("id, client_name, client_email, source_id, status")
        .eq("clinic_id", campaign.clinic_id)
        .not("client_email", "is", null)
        .neq("client_email", "");

      if (campaign.target_type === "stage" && campaign.target_stage_id) {
        // Buscar status_key da etapa
        const { data: stage } = await supabase
          .from("pipeline_settings")
          .select("status_key")
          .eq("id", campaign.target_stage_id)
          .single();
        
        if (stage) {
          leadsQuery = leadsQuery.eq("status", stage.status_key);
        }
      } else if (campaign.target_type === "source" && campaign.target_source_id) {
        leadsQuery = leadsQuery.eq("source_id", campaign.target_source_id);
      }

      if (campaign.filter_created_after) {
        leadsQuery = leadsQuery.gte("created_at", campaign.filter_created_after);
      }
      if (campaign.filter_created_before) {
        leadsQuery = leadsQuery.lte("created_at", campaign.filter_created_before);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar leads: " + leadsError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Filtrar emails que já estão na lista de unsubscribe
      const { data: unsubscribes } = await supabase
        .from("email_unsubscribes")
        .select("email")
        .eq("clinic_id", campaign.clinic_id);

      const unsubscribedEmails = new Set((unsubscribes || []).map(u => u.email.toLowerCase()));
      
      const validLeads = (leads || []).filter(lead => 
        lead.client_email && !unsubscribedEmails.has(lead.client_email.toLowerCase())
      );

      // Criar registros de envio
      const emailSends = validLeads.map(lead => ({
        campaign_id: campaignId,
        lead_id: lead.id,
        email: lead.client_email,
        lead_name: lead.client_name || "Cliente",
        status: "pending",
      }));

      if (emailSends.length > 0) {
        // Deletar envios anteriores (se houver)
        await supabase
          .from("email_sends")
          .delete()
          .eq("campaign_id", campaignId);

        // Inserir novos envios
        await supabase
          .from("email_sends")
          .insert(emailSends);
      }

      // Atualizar campanha
      await supabase
        .from("email_campaigns")
        .update({ 
          total_recipients: emailSends.length,
          status: "draft",
          updated_at: new Date().toISOString()
        })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${emailSends.length} destinatários preparados`,
          totalRecipients: emailSends.length,
          remainingToday
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se action é "send", enviar emails
    if (action === "send") {
      // Buscar envios pendentes
      const batchSize = Math.min(clinic.email_batch_size || 50, remainingToday);
      
      const { data: pendingSends, error: sendsError } = await supabase
        .from("email_sends")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .limit(batchSize);

      if (sendsError || !pendingSends || pendingSends.length === 0) {
        // Verificar se campanha está completa
        const { data: remainingCount } = await supabase
          .from("email_sends")
          .select("id", { count: "exact" })
          .eq("campaign_id", campaignId)
          .eq("status", "pending");

        if (!remainingCount || remainingCount.length === 0) {
          await supabase
            .from("email_campaigns")
            .update({ 
              status: "completed",
              completed_at: new Date().toISOString()
            })
            .eq("id", campaignId);

          return new Response(
            JSON.stringify({ success: true, message: "Campanha concluída!", completed: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Nenhum email pendente encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Atualizar status da campanha para "sending"
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", started_at: campaign.started_at || new Date().toISOString() })
        .eq("id", campaignId);

      // Configurar cliente SMTP
      const smtpClient = new SMTPClient({
        connection: {
          hostname: clinic.smtp_host,
          port: clinic.smtp_port || 465,
          tls: clinic.smtp_encryption === "ssl",
          auth: {
            username: clinic.smtp_user,
            password: clinic.smtp_password,
          },
        },
      });

      const fromEmail = clinic.smtp_from_email || clinic.smtp_user;
      const fromName = clinic.smtp_from_name || clinic.name || "Sistema";
      const template = campaign.template;

      let sentCount = 0;
      let failedCount = 0;

      for (const send of pendingSends) {
        try {
          // Substituir variáveis no template
          let htmlContent = template.html_content
            .replace(/\{\{lead_name\}\}/g, send.lead_name || "Cliente")
            .replace(/\{\{lead_email\}\}/g, send.email)
            .replace(/\{\{clinic_name\}\}/g, clinic.name || "")
            .replace(/\{\{clinic_phone\}\}/g, clinic.phone || "")
            .replace(/\{\{clinic_email\}\}/g, clinic.email || "")
            .replace(/\{\{unsubscribe_url\}\}/g, `${supabaseUrl}/functions/v1/email-unsubscribe?id=${send.tracking_id}`);

          let subject = template.subject
            .replace(/\{\{lead_name\}\}/g, send.lead_name || "Cliente")
            .replace(/\{\{clinic_name\}\}/g, clinic.name || "");

          // Adicionar pixel de rastreamento
          const trackingPixel = `<img src="${supabaseUrl}/functions/v1/email-track?id=${send.tracking_id}" width="1" height="1" style="display:none;" />`;
          htmlContent = htmlContent.replace("</body>", `${trackingPixel}</body>`);

          await smtpClient.send({
            from: `${fromName} <${fromEmail}>`,
            to: send.email,
            subject: subject,
            content: "auto",
            html: htmlContent,
          });

          // Atualizar status para enviado
          await supabase
            .from("email_sends")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", send.id);

          sentCount++;
        } catch (error) {
          console.error(`Erro ao enviar para ${send.email}:`, error);
          
          await supabase
            .from("email_sends")
            .update({ 
              status: "failed", 
              error_message: error instanceof Error ? error.message : "Erro desconhecido"
            })
            .eq("id", send.id);

          failedCount++;
        }
      }

      await smtpClient.close();

      // Atualizar contadores da campanha
      await supabase
        .from("email_campaigns")
        .update({ 
          sent_count: campaign.sent_count + sentCount,
          failed_count: campaign.failed_count + failedCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaignId);

      // Atualizar contador diário da clínica
      await supabase
        .from("clinics")
        .update({ email_sent_today: emailsSentToday + sentCount })
        .eq("id", clinic.id);

      // Verificar se há mais emails pendentes
      const { count: remainingCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      const hasMore = (remainingCount || 0) > 0;

      if (!hasMore) {
        await supabase
          .from("email_campaigns")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", campaignId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Lote enviado: ${sentCount} enviados, ${failedCount} falharam`,
          sentCount,
          failedCount,
          hasMore,
          remainingCount: remainingCount || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida. Use 'prepare' ou 'send'" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
