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

  const url = new URL(req.url);
  
  // Facebook envia GET para verificar a URL
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // clinic_id
    const error = url.searchParams.get("error");
    
    // Se tem erro, redireciona com erro
    if (error) {
      const errorDescription = url.searchParams.get("error_description") || "Autorização negada";
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${Deno.env.get("FRONTEND_URL") || "http://localhost:5173"}/integrations?error=${encodeURIComponent(errorDescription)}`,
        },
      });
    }
    
    // Se não tem code, é apenas verificação - retorna OK
    if (!code) {
      return new Response("OK", { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    }
    
    // Tem code - trocar por access token
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Buscar credenciais do Meta App do banco
      const { data: settingsData } = await supabase
        .from("settings")
        .select("meta_app_id, meta_app_secret")
        .single();
      
      const appId = (settingsData as any)?.meta_app_id;
      const appSecret = (settingsData as any)?.meta_app_secret;
      const redirectUri = `${supabaseUrl}/functions/v1/facebook-oauth-callback`;
      
      if (!appId || !appSecret) {
        throw new Error("Meta App não configurado. Configure em Admin → Integrações");
      }
      
      // Trocar code por access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${appSecret}&` +
        `code=${code}`
      );
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error.message || "Failed to get access token");
      }
      
      const accessToken = tokenData.access_token;
      
      // Obter token de longa duração (60 dias)
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${accessToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      const longLivedToken = longLivedData.access_token || accessToken;
      
      // Buscar páginas do usuário
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`
      );
      const pagesData = await pagesResponse.json();
      
      // Buscar contas do Instagram conectadas às páginas e inscrever no webhook
      console.log("Pages found:", JSON.stringify(pagesData.data?.map((p: any) => ({ id: p.id, name: p.name })) || []));
      const instagramAccounts: any[] = [];
      for (const page of pagesData.data || []) {
        // Buscar Instagram Business Account vinculado à página
        console.log(`Checking Instagram for page ${page.name} (${page.id})...`);
        const igResponse = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        const igData = await igResponse.json();
        console.log(`Instagram data for ${page.name}:`, JSON.stringify(igData));
        if (igData.instagram_business_account) {
          const igId = igData.instagram_business_account.id;
          console.log(`Found Instagram Business Account: ${igId}`);
          instagramAccounts.push({
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            instagram_id: igId,
          });
          
          // Assinar webhook do Instagram automaticamente
          try {
            const igSubscribeResponse = await fetch(
              `https://graph.facebook.com/v18.0/${igId}/subscribed_apps?` +
              `subscribed_fields=messages,messaging_postbacks,messaging_seen,message_reactions&` +
              `access_token=${page.access_token}`,
              { method: 'POST' }
            );
            const igSubscribeResult = await igSubscribeResponse.json();
            console.log(`Instagram ${igId} - Webhook subscription:`, JSON.stringify(igSubscribeResult));
          } catch (igSubErr) {
            console.error(`Error subscribing Instagram ${igId} to webhook:`, igSubErr);
          }
        } else {
          console.log(`No Instagram Business Account linked to page ${page.name}`);
        }
        
        // Inscrever a página no webhook do Messenger (automático)
        try {
          const subscribeResponse = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps?` +
            `subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads,messaging_referrals,message_echoes&` +
            `access_token=${page.access_token}`,
            { method: 'POST' }
          );
          const subscribeResult = await subscribeResponse.json();
          console.log(`Página ${page.name} (${page.id}) - Inscrição webhook:`, JSON.stringify(subscribeResult));
          
          if (!subscribeResponse.ok || subscribeResult.error) {
            console.error(`Erro ao inscrever página ${page.name}:`, subscribeResult.error?.message || 'Unknown error');
          }
        } catch (webhookErr) {
          console.error(`Erro ao inscrever página ${page.name} no webhook:`, webhookErr);
        }
      }
      
      // Salvar no banco se tiver clinic_id no state
      if (state) {
        // Pegar a primeira página/instagram (ou pode deixar o usuário escolher depois)
        const firstPage = pagesData.data?.[0];
        const firstInstagram = instagramAccounts[0];
        
        await supabase
          .from("clinics")
          .update({
            facebook_page_id: firstPage?.id || null,
            facebook_page_name: firstPage?.name || null,
            facebook_page_access_token: firstPage?.access_token || null,
            facebook_user_access_token: longLivedToken,
            instagram_business_account_id: firstInstagram?.instagram_id || null,
            instagram_enabled: !!firstInstagram,
            facebook_enabled: !!firstPage,
            meta_connected_at: new Date().toISOString(),
          })
          .eq("id", state);
      }
      
      // Retornar página HTML que fecha o popup e notifica a janela pai
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conectado!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #10b981; margin: 0 0 8px 0; }
            p { color: #64748b; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Conectado com sucesso!</h1>
            <p>Esta janela será fechada automaticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'META_CONNECTED', success: true }, '*');
              }
              window.close();
            }, 1500);
          </script>
        </body>
        </html>
      `;
      
      return new Response(successHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      
    } catch (err) {
      console.error("OAuth error:", err);
      const errorMessage = (err as Error).message || "Erro ao conectar";
      
      // Retornar página HTML de erro que fecha o popup
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Erro</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #ef4444; margin: 0 0 8px 0; }
            p { color: #64748b; margin: 0; word-break: break-word; }
            button { margin-top: 20px; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Erro ao conectar</h1>
            <p>${errorMessage}</p>
            <button onclick="window.close()">Fechar</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'META_CONNECTED', success: false, error: '${errorMessage.replace(/'/g, "\\'")}' }, '*');
            }
          </script>
        </body>
        </html>
      `;
      
      return new Response(errorHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
});
