import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clinicId, testEmail } = await req.json();

    if (!clinicId || !testEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "clinicId e testEmail são obrigatórios" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_encryption, name")
      .eq("id", clinicId)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, error: "Clínica não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!clinic.smtp_host || !clinic.smtp_user || !clinic.smtp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações SMTP incompletas. Preencha host, usuário e senha." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const client = new SMTPClient({
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

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: testEmail,
      subject: "Teste de Configuração SMTP - Belitx",
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Teste de Email</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Parabéns! Sua configuração SMTP está funcionando corretamente.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;"><strong>Detalhes da configuração:</strong></p>
              <ul style="color: #475569; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>Host: ${clinic.smtp_host}</li>
                <li>Porta: ${clinic.smtp_port || 465}</li>
                <li>Criptografia: ${(clinic.smtp_encryption || 'ssl').toUpperCase()}</li>
                <li>Remetente: ${fromEmail}</li>
              </ul>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              Este é um email de teste enviado pelo sistema Belitx.
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Email de teste enviado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro ao enviar email de teste:", error);
    
    let errorMessage = "Erro desconhecido";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (errorMessage.includes("authentication")) {
        errorMessage = "Falha na autenticação. Verifique usuário e senha.";
      } else if (errorMessage.includes("connect") || errorMessage.includes("timeout")) {
        errorMessage = "Não foi possível conectar ao servidor SMTP. Verifique host e porta.";
      } else if (errorMessage.includes("certificate")) {
        errorMessage = "Erro de certificado SSL. Tente alterar a criptografia.";
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
