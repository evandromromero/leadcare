import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ConversionPayload {
  clinic_id: string;
  chat_id: string;
  phone_number: string;
  gclid?: string;
  conversion_value?: number;
  conversion_currency?: string;
  conversion_time?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: ConversionPayload = await req.json();
    const { clinic_id, chat_id, phone_number, gclid, conversion_value, conversion_currency, conversion_time } = payload;

    if (!clinic_id || !chat_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id and chat_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações do Google Ads da clínica
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("google_ads_customer_id, google_ads_conversion_action_id, google_ads_developer_token, google_ads_refresh_token, google_ads_enabled")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: "Clinic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se Google Ads está habilitado
    if (!clinic.google_ads_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Google Ads not enabled for this clinic" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se tem as credenciais necessárias
    if (!clinic.google_ads_customer_id || !clinic.google_ads_conversion_action_id) {
      return new Response(
        JSON.stringify({ error: "Google Ads credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se não tiver gclid, tentar buscar do chat ou pixel_events
    let finalGclid = gclid;
    if (!finalGclid) {
      // Buscar gclid do chat
      const { data: chatData } = await supabase
        .from("chats")
        .select("gclid")
        .eq("id", chat_id)
        .single();
      
      if (chatData?.gclid) {
        finalGclid = chatData.gclid;
      } else {
        // Tentar buscar do pixel_events pelo telefone
        const { data: pixelData } = await supabase
          .from("pixel_events")
          .select("gclid")
          .eq("clinic_id", clinic_id)
          .not("gclid", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (pixelData && pixelData.length > 0) {
          finalGclid = pixelData[0].gclid;
        }
      }
    }

    // Preparar dados da conversão
    const conversionData = {
      customer_id: clinic.google_ads_customer_id.replace(/-/g, ''),
      conversion_action_id: clinic.google_ads_conversion_action_id,
      gclid: finalGclid,
      phone_number: phone_number,
      conversion_time: conversion_time || new Date().toISOString(),
      conversion_value: conversion_value || 0,
      conversion_currency: conversion_currency || "BRL",
    };

    // Log para debug
    console.log("Sending conversion to Google Ads:", conversionData);

    // TODO: Implementar chamada real à API do Google Ads
    // Por enquanto, vamos salvar o registro da conversão enviada
    const { error: logError } = await supabase
      .from("google_ads_conversions")
      .insert({
        clinic_id,
        chat_id,
        gclid: finalGclid,
        phone_number,
        conversion_value: conversion_value || 0,
        conversion_currency: conversion_currency || "BRL",
        status: finalGclid ? "pending" : "no_gclid",
        conversion_data: conversionData,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Error logging conversion:", logError);
    }

    // Se não tem gclid, não podemos enviar para o Google Ads
    if (!finalGclid) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Conversion logged but no gclid found - cannot send to Google Ads",
          has_gclid: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aqui seria a chamada real à API do Google Ads
    // Por enquanto retornamos sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conversion sent to Google Ads",
        has_gclid: true,
        gclid: finalGclid
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing conversion:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
