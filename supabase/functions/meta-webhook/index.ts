import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "belitx_meta_webhook_2024";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Verificação do webhook (GET) - Facebook envia isso para validar
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    console.log("Webhook verification:", { mode, token, challenge });
    
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }
    
    console.log("Webhook verification failed");
    return new Response("Forbidden", { status: 403 });
  }
  
  // Receber mensagens (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body, null, 2));
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Processar cada entrada
      for (const entry of body.entry || []) {
        const pageId = entry.id;
        
        // Buscar clínica pelo page_id ou instagram_business_account_id
        let { data: clinic } = await supabase
          .from("clinics")
          .select("id, name, facebook_page_access_token, instagram_access_token")
          .eq("facebook_page_id", pageId)
          .single();
        
        // Se não encontrou pelo facebook_page_id, tentar pelo instagram_business_account_id
        if (!clinic) {
          const { data: igClinic } = await supabase
            .from("clinics")
            .select("id, name, facebook_page_access_token, instagram_access_token")
            .eq("instagram_business_account_id", pageId)
            .single();
          clinic = igClinic;
        }
        
        if (!clinic) {
          console.log("Clinic not found for page/instagram:", pageId);
          continue;
        }
        
        // Usar token do Instagram se disponível, senão usar do Facebook
        const pageAccessToken = (clinic as any).instagram_access_token || (clinic as any).facebook_page_access_token;
        
        // Processar mensagens
        console.log("Processing entry.messaging:", JSON.stringify(entry.messaging));
        for (const messaging of entry.messaging || []) {
          const senderId = messaging.sender?.id;
          const recipientId = messaging.recipient?.id;
          const timestamp = messaging.timestamp;
          const message = messaging.message;
          
          console.log("Processing messaging:", { senderId, recipientId, pageId, hasMessage: !!message, messageText: message?.text });
          
          if (!message) {
            console.log("Skipping: no message object");
            continue;
          }
          
          // Ignorar mensagens enviadas pela própria página (echo)
          // O echo tem message.is_echo = true
          if (message.is_echo) {
            console.log("Ignoring echo message (is_echo=true)");
            continue;
          }
          
          // Também ignorar se o sender é a página
          if (senderId === pageId) {
            console.log("Ignoring message from page (senderId === pageId)");
            continue;
          }
          
          // Determinar canal (Instagram ou Facebook)
          const isInstagram = entry.id?.startsWith("17") || messaging.sender?.id?.startsWith("17");
          const channel = isInstagram ? "instagram" : "facebook";
          
          // Buscar perfil do usuário (nome e foto)
          let userName = `${channel === 'instagram' ? 'Instagram' : 'Facebook'} User`;
          let userProfilePic = null;
          
          if (pageAccessToken && senderId) {
            try {
              // Messenger API usa first_name, last_name, profile_pic
              const profileResponse = await fetch(
                `https://graph.facebook.com/v18.0/${senderId}?fields=first_name,last_name,name,profile_pic&access_token=${pageAccessToken}`
              );
              const profileData = await profileResponse.json();
              console.log("Profile API response:", JSON.stringify(profileData));
              
              // Tentar diferentes campos de nome
              if (profileData.name) {
                userName = profileData.name;
              } else if (profileData.first_name) {
                userName = profileData.first_name;
                if (profileData.last_name) {
                  userName += ` ${profileData.last_name}`;
                }
              }
              
              if (profileData.profile_pic) {
                userProfilePic = profileData.profile_pic;
              }
              console.log(`Profile fetched for ${senderId}:`, userName, userProfilePic ? 'has photo' : 'no photo');
            } catch (profileErr) {
              console.error("Error fetching profile:", profileErr);
            }
          }
          
          // Buscar ou criar chat
          let { data: chat } = await supabase
            .from("chats")
            .select("*")
            .eq("clinic_id", clinic.id)
            .eq("phone_number", senderId)
            .eq("channel", channel)
            .single();
          
          if (!chat) {
            // Criar novo chat
            const { data: newChat, error: chatError } = await supabase
              .from("chats")
              .insert({
                clinic_id: clinic.id,
                phone_number: senderId,
                client_name: userName,
                avatar_url: userProfilePic,
                channel: channel,
                status: "Novo Lead",
                unread_count: 1,
                last_message: message.text || "[Mídia]",
                last_message_time: new Date(timestamp).toISOString(),
              })
              .select()
              .single();
            
            if (chatError) {
              console.error("Error creating chat:", chatError);
              continue;
            }
            chat = newChat;
          } else {
            // Atualizar chat existente (incluir nome/foto se não tiver)
            const updateData: any = {
              unread_count: (chat.unread_count || 0) + 1,
              last_message: message.text || "[Mídia]",
              last_message_time: new Date(timestamp).toISOString(),
              last_message_from_client: true,
            };
            
            // Atualizar nome se ainda for genérico
            if (userName && (chat.client_name?.includes('User') || !chat.client_name)) {
              updateData.client_name = userName;
            }
            
            // Atualizar foto se não tiver
            if (userProfilePic && !chat.avatar_url) {
              updateData.avatar_url = userProfilePic;
            }
            
            await supabase
              .from("chats")
              .update(updateData)
              .eq("id", chat.id);
          }
          
          // Salvar mensagem
          const messageData: any = {
            chat_id: chat.id,
            content: message.text || "",
            is_from_client: true,
            remote_message_id: message.mid,
            created_at: new Date(timestamp).toISOString(),
          };
          
          // Se tem anexo (imagem, vídeo, etc)
          if (message.attachments?.length > 0) {
            const attachment = message.attachments[0];
            messageData.media_url = attachment.payload?.url;
            messageData.media_type = attachment.type;
            if (!messageData.content) {
              messageData.content = `[${attachment.type}]`;
            }
          }
          
          const { error: msgError } = await supabase
            .from("messages")
            .insert(messageData);
          
          if (msgError) {
            console.error("Error saving message:", msgError);
          } else {
            // Enviar Broadcast para notificar o cliente em tempo real (igual ao evolution-webhook)
            const broadcastChannel = supabase.channel('leadcare-updates');
            await broadcastChannel.send({
              type: 'broadcast',
              event: 'new_message',
              payload: {
                clinic_id: clinic.id,
                chat_id: chat.id,
                from_client: true
              }
            });
            console.log("Broadcast sent for chat:", chat.id);
          }
        }
        
        // Processar status de mensagens (delivered, read)
        for (const messaging of entry.messaging || []) {
          if (messaging.delivery) {
            // Mensagem entregue
            const mids = messaging.delivery.mids || [];
            for (const mid of mids) {
              await supabase
                .from("messages")
                .update({ status: "delivered" })
                .eq("remote_message_id", mid);
            }
          }
          
          if (messaging.read) {
            // Mensagem lida
            const watermark = messaging.read.watermark;
            // Marcar todas as mensagens anteriores ao watermark como lidas
            await supabase
              .from("messages")
              .update({ status: "read" })
              .lte("created_at", new Date(watermark).toISOString())
              .eq("sender_type", "user");
          }
        }
      }
      
      // Facebook espera 200 OK
      return new Response("EVENT_RECEIVED", { 
        status: 200,
        headers: corsHeaders
      });
      
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
});
