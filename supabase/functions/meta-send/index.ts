import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { 
      clinic_id, 
      recipient_id, 
      message, 
      channel,
      media_url,
      media_type 
    } = await req.json();

    if (!clinic_id || !recipient_id || !message) {
      return new Response(
        JSON.stringify({ error: "clinic_id, recipient_id e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da clínica (page_id e access_token)
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("facebook_page_id, facebook_page_access_token, instagram_business_account_id")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: "Clínica não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageAccessToken = clinic.facebook_page_access_token;
    const pageId = clinic.facebook_page_id;

    if (!pageAccessToken || !pageId) {
      return new Response(
        JSON.stringify({ error: "Facebook/Instagram não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let response;
    let messageId;

    if (channel === "instagram") {
      // Enviar mensagem via Instagram Graph API
      // Instagram usa o ID da conta Instagram Business como sender
      const igAccountId = clinic.instagram_business_account_id;
      
      if (!igAccountId) {
        return new Response(
          JSON.stringify({ error: "Instagram não configurado para esta clínica" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Instagram Messaging API
      const messagePayload: any = {
        recipient: { id: recipient_id },
        message: {}
      };

      if (media_url && media_type) {
        // Enviar mídia
        if (media_type === "image") {
          messagePayload.message.attachment = {
            type: "image",
            payload: { url: media_url }
          };
        } else if (media_type === "video") {
          messagePayload.message.attachment = {
            type: "video",
            payload: { url: media_url }
          };
        } else {
          // Fallback para texto com link
          messagePayload.message.text = `${message}\n${media_url}`;
        }
      } else {
        messagePayload.message.text = message;
      }

      response = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messagePayload),
        }
      );

    } else {
      // Enviar mensagem via Facebook Messenger API
      const messagePayload: any = {
        recipient: { id: recipient_id },
        message: {},
        messaging_type: "RESPONSE"
      };

      if (media_url && media_type) {
        // Enviar mídia
        if (media_type === "image") {
          messagePayload.message.attachment = {
            type: "image",
            payload: { url: media_url, is_reusable: true }
          };
        } else if (media_type === "video") {
          messagePayload.message.attachment = {
            type: "video",
            payload: { url: media_url, is_reusable: true }
          };
        } else if (media_type === "audio") {
          messagePayload.message.attachment = {
            type: "audio",
            payload: { url: media_url, is_reusable: true }
          };
        } else if (media_type === "file" || media_type === "document") {
          messagePayload.message.attachment = {
            type: "file",
            payload: { url: media_url, is_reusable: true }
          };
        } else {
          // Fallback para texto com link
          messagePayload.message.text = `${message}\n${media_url}`;
        }
      } else {
        messagePayload.message.text = message;
      }

      response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messagePayload),
        }
      );
    }

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Erro ao enviar mensagem" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    messageId = result.message_id;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageId,
        recipient_id: result.recipient_id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
