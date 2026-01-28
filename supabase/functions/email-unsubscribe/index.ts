import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");

  if (!trackingId) {
    return new Response(getHtmlPage("Erro", "Link inválido."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar envio pelo tracking_id
    const { data: send, error: sendError } = await supabase
      .from("email_sends")
      .select("id, email, campaign_id, campaign:email_campaigns(clinic_id)")
      .eq("tracking_id", trackingId)
      .single();

    if (sendError || !send) {
      return new Response(getHtmlPage("Erro", "Link inválido ou expirado."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 404,
      });
    }

    const clinicId = (send.campaign as any)?.clinic_id;

    if (!clinicId) {
      return new Response(getHtmlPage("Erro", "Não foi possível processar sua solicitação."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 500,
      });
    }

    // Adicionar à lista de unsubscribe
    await supabase
      .from("email_unsubscribes")
      .upsert({
        clinic_id: clinicId,
        email: send.email,
        unsubscribed_at: new Date().toISOString(),
      }, { onConflict: "clinic_id,email" });

    // Atualizar status do envio
    await supabase
      .from("email_sends")
      .update({ status: "unsubscribed" })
      .eq("id", send.id);

    return new Response(
      getHtmlPage(
        "Inscrição Cancelada",
        `O email <strong>${send.email}</strong> foi removido da nossa lista de envios. Você não receberá mais emails de marketing.`
      ),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  } catch (error) {
    console.error("Erro ao cancelar inscrição:", error);
    return new Response(
      getHtmlPage("Erro", "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde."),
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 500 }
    );
  }
});

function getHtmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 500px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: ${title === "Erro" ? "#fee2e2" : "#d1fae5"};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 40px;
      height: 40px;
      fill: ${title === "Erro" ? "#dc2626" : "#059669"};
    }
    h1 {
      color: #1e293b;
      font-size: 24px;
      margin-bottom: 16px;
    }
    p {
      color: #64748b;
      font-size: 16px;
      line-height: 1.6;
    }
    p strong {
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      ${title === "Erro" 
        ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
      }
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
