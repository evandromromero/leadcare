import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // clinic_id
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");
    
    // Se tem erro
    if (error) {
      console.error("Instagram OAuth error:", { error, errorReason, errorDescription });
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
            p { color: #64748b; margin: 0; }
            button { margin-top: 20px; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Erro ao conectar Instagram</h1>
            <p>${errorDescription || error}</p>
            <button onclick="window.close()">Fechar</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', success: false, error: '${(errorDescription || error).replace(/'/g, "\\'")}' }, '*');
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
    
    // Se não tem code, retorna OK (verificação)
    if (!code) {
      return new Response("OK", { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    }
    
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Buscar credenciais do Instagram App do banco
      const { data: settingsData } = await supabase
        .from("settings")
        .select("instagram_app_id, instagram_app_secret")
        .single();
      
      const appId = (settingsData as any)?.instagram_app_id;
      const appSecret = (settingsData as any)?.instagram_app_secret;
      const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;
      
      if (!appId || !appSecret) {
        throw new Error("Instagram App não configurado. Configure em Admin → Integrações");
      }
      
      console.log("Exchanging code for access token...");
      
      // Trocar code por access token (Instagram API)
      const tokenResponse = await fetch(
        `https://api.instagram.com/oauth/access_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code,
          }),
        }
      );
      
      const tokenData = await tokenResponse.json();
      console.log("Token response:", JSON.stringify(tokenData));
      
      if (tokenData.error_type || tokenData.error_message) {
        throw new Error(tokenData.error_message || "Failed to get access token");
      }
      
      const accessToken = tokenData.access_token;
      const userId = tokenData.user_id;
      
      // Obter token de longa duração (60 dias)
      console.log("Getting long-lived token...");
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?` +
        `grant_type=ig_exchange_token&` +
        `client_secret=${appSecret}&` +
        `access_token=${accessToken}`
      );
      
      const longLivedData = await longLivedResponse.json();
      console.log("Long-lived token response:", JSON.stringify(longLivedData));
      const longLivedToken = longLivedData.access_token || accessToken;
      
      // Buscar informações do usuário do Instagram
      console.log("Fetching Instagram user info...");
      const userResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type,name&access_token=${longLivedToken}`
      );
      const userData = await userResponse.json();
      console.log("User data:", JSON.stringify(userData));
      
      // Assinar webhook para receber mensagens automaticamente
      const igUserId = userId || userData.id;
      console.log("Subscribing to webhook for Instagram user:", igUserId);
      
      try {
        // Buscar app_id do settings para assinar webhook
        const subscribeResponse = await fetch(
          `https://graph.instagram.com/v18.0/${igUserId}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_seen', 'message_reactions'],
              access_token: longLivedToken,
            }),
          }
        );
        const subscribeData = await subscribeResponse.json();
        console.log("Webhook subscription response:", JSON.stringify(subscribeData));
      } catch (subErr) {
        console.error("Error subscribing to webhook:", subErr);
      }
      
      // Salvar no banco se tiver clinic_id no state
      if (state) {
        console.log("Saving Instagram data to clinic:", state);
        
        await supabase
          .from("clinics")
          .update({
            instagram_business_account_id: igUserId,
            instagram_username: userData.username,
            instagram_access_token: longLivedToken,
            instagram_enabled: true,
            instagram_connected_at: new Date().toISOString(),
          })
          .eq("id", state);
        
        console.log("Instagram data saved successfully");
      }
      
      // Retornar página HTML de sucesso
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conectado!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #E1306C 0%, #C13584 50%, #833AB4 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #10b981; margin: 0 0 8px 0; }
            p { color: #64748b; margin: 0; }
            .username { color: #E1306C; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Instagram Conectado!</h1>
            <p>Conta: <span class="username">@${userData.username || 'Instagram'}</span></p>
            <p style="margin-top: 8px; font-size: 14px;">Esta janela será fechada automaticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', success: true, username: '${userData.username || ''}' }, '*');
              }
              window.close();
            }, 2000);
          </script>
        </body>
        </html>
      `;
      
      return new Response(successHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      
    } catch (err) {
      console.error("Instagram OAuth error:", err);
      const errorMessage = (err as Error).message || "Erro ao conectar";
      
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
            button { margin-top: 20px; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Erro ao conectar Instagram</h1>
            <p>${errorMessage}</p>
            <button onclick="window.close()">Fechar</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', success: false, error: '${errorMessage.replace(/'/g, "\\'")}' }, '*');
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
