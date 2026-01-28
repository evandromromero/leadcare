import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pixel transparente 1x1 em base64
const TRANSPARENT_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");

  if (trackingId) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Atualizar status para "opened" se ainda não foi
      const { data: send } = await supabase
        .from("email_sends")
        .select("id, campaign_id, status")
        .eq("tracking_id", trackingId)
        .single();

      if (send && send.status !== "opened" && send.status !== "clicked") {
        await supabase
          .from("email_sends")
          .update({ status: "opened", opened_at: new Date().toISOString() })
          .eq("id", send.id);

        // Incrementar contador de abertos na campanha
        await supabase.rpc("increment_campaign_opened", { campaign_id: send.campaign_id });
      }
    } catch (error) {
      console.error("Erro ao rastrear abertura:", error);
    }
  }

  // Retornar pixel transparente
  return new Response(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});
