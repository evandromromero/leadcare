import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaAdsRequest {
  clinic_id: string;
  action: 'get_campaigns' | 'get_adsets' | 'get_ads' | 'get_ad_details' | 'get_insights';
  ad_id?: string;
  date_preset?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, action, ad_id, date_preset = 'last_30d' }: MetaAdsRequest = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais da clínica
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('meta_ads_account_id, meta_ads_access_token')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: "Clínica não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meta_ads_account_id, meta_ads_access_token } = clinic;

    if (!meta_ads_account_id || !meta_ads_access_token) {
      return new Response(
        JSON.stringify({ error: "Meta Ads API não configurada para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = 'https://graph.facebook.com/v18.0';
    let endpoint = '';
    let fields = '';

    switch (action) {
      case 'get_campaigns':
        endpoint = `${baseUrl}/act_${meta_ads_account_id}/campaigns`;
        fields = 'id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget';
        break;

      case 'get_adsets':
        endpoint = `${baseUrl}/act_${meta_ads_account_id}/adsets`;
        fields = 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event';
        break;

      case 'get_ads':
        endpoint = `${baseUrl}/act_${meta_ads_account_id}/ads`;
        fields = 'id,name,status,adset_id,campaign_id,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec},created_time';
        break;

      case 'get_ad_details':
        if (!ad_id) {
          return new Response(
            JSON.stringify({ error: "ad_id é obrigatório para get_ad_details" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${baseUrl}/${ad_id}`;
        fields = 'id,name,status,adset_id,campaign_id,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec},created_time,effective_status';
        break;

      case 'get_insights':
        endpoint = `${baseUrl}/act_${meta_ads_account_id}/insights`;
        fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions,conversions';
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Fazer requisição para a Meta API
    const url = `${endpoint}?fields=${fields}&access_token=${meta_ads_access_token}&date_preset=${date_preset}&limit=100`;
    
    console.log(`Meta Ads API Request: ${action} for clinic ${clinic_id}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API Error:', data.error);
      return new Response(
        JSON.stringify({ 
          error: data.error.message || 'Erro na API do Meta',
          error_code: data.error.code,
          error_type: data.error.type
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Meta Ads API Success: ${action} returned ${data.data?.length || 0} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: data.data || data,
        paging: data.paging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in meta-ads-api:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
