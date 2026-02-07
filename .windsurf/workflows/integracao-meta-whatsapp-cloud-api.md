---
description: Integração completa Meta (WhatsApp Cloud API, Instagram, Facebook Messenger) usando Belitx como painel oficial
---

# Integração Meta - Guia Completo

Este workflow documenta como integrar WhatsApp Cloud API, Instagram e Facebook Messenger em qualquer painel usando o Belitx como App Meta oficial aprovado.

---

## 1. Visão Geral da Arquitetura

### 1.1 Componentes do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         META PLATFORM                           │
│                                                                 │
│  App ID: Belitx (aprovado pela Meta)                           │
│  ├── WhatsApp Business API                                      │
│  ├── Instagram Messaging API                                    │
│  └── Facebook Messenger API                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WEBHOOKS (Supabase)                        │
│                                                                 │
│  • meta-webhook (Instagram/Facebook)                            │
│  • whatsapp-cloud-webhook (WhatsApp Cloud API)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PAINÉIS (Clientes)                           │
│                                                                 │
│  • Belitx (principal)                                           │
│  • Serrana (usando mesma aprovação)                             │
│  • Outros painéis futuros                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Credenciais Centralizadas (Belitx)

| Credencial | Onde fica | Descrição |
|------------|-----------|-----------|
| `meta_app_id` | settings | ID do App Meta aprovado |
| `meta_app_secret` | settings | Secret do App Meta |
| `meta_system_user_token` | settings | Token do System User (opcional) |
| `meta_webhook_verify_token` | settings | Token para verificar webhooks |

---

## 2. Configuração no Meta for Developers

### 2.1 Criar App no Meta for Developers

1. Acesse https://developers.facebook.com/apps/
2. Clique em **"Criar App"**
3. Selecione **"Empresa"** como tipo
4. Preencha:
   - Nome: `Belitx`
   - Email: seu email
   - Business Manager: selecione ou crie

### 2.2 Adicionar Produtos ao App

No painel do App, adicione:

1. **Facebook Login para Empresas**
   - Configurações > URIs de redirecionamento OAuth válidos:
     ```
     https://belitx.com.br/api/meta-callback.php
     https://belitx.com.br/api/whatsapp-callback.php
     ```

2. **Messenger**
   - Configurações > Webhooks:
     ```
     URL: https://[SUPABASE_PROJECT_ID].supabase.co/functions/v1/meta-webhook
     Token: belitx_meta_webhook_2024
     ```
   - Campos: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`

3. **Instagram**
   - Configurações > Webhooks:
     ```
     URL: https://[SUPABASE_PROJECT_ID].supabase.co/functions/v1/meta-webhook
     Token: belitx_meta_webhook_2024
     ```
   - Campos: `messages`, `messaging_postbacks`, `messaging_seen`

4. **WhatsApp**
   - Configurações > Webhooks:
     ```
     URL: https://[SUPABASE_PROJECT_ID].supabase.co/functions/v1/whatsapp-cloud-webhook
     Token: leadcare_whatsapp_webhook_2024
     ```
   - Campos: `messages`, `message_template_status_update`

### 2.3 Configurar Embedded Signup (WhatsApp)

1. Vá em **Login do Facebook para Empresas > Configurações**
2. Clique em **"Criar configuração"**
3. Selecione:
   - Tipo: WhatsApp Embedded Signup
   - Permissões: `whatsapp_business_messaging`, `whatsapp_business_management`
4. Anote o **Config ID** (ex: `763626706332381`)

### 2.4 Permissões Necessárias

| Permissão | Uso | Obrigatória |
|-----------|-----|-------------|
| `pages_show_list` | Listar páginas do Facebook | Sim |
| `pages_messaging` | Enviar/receber mensagens Messenger | Sim |
| `pages_manage_metadata` | Gerenciar webhooks | Sim |
| `pages_read_engagement` | Ler dados de engajamento | Sim |
| `instagram_basic` | Informações básicas do Instagram | Sim |
| `instagram_manage_messages` | Enviar/receber DMs do Instagram | Sim |
| `whatsapp_business_messaging` | Enviar/receber mensagens WhatsApp | Sim |
| `whatsapp_business_management` | Gerenciar conta WhatsApp | Sim |
| `business_management` | Gerenciar Business Manager | Opcional |

---

## 3. Estrutura do Banco de Dados

### 3.1 Tabela `settings` (Configurações Globais)

```sql
-- Campos relacionados ao Meta
ALTER TABLE settings ADD COLUMN IF NOT EXISTS meta_app_id TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS meta_app_secret TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS meta_system_user_token TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS instagram_app_id TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS instagram_app_secret TEXT;
```

### 3.2 Tabela `clinics` ou equivalente (Por Cliente/Tenant)

```sql
-- Facebook Messenger
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_user_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_enabled BOOLEAN DEFAULT FALSE;

-- Instagram
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMPTZ;

-- WhatsApp Cloud API
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_phone_number_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_phone_number TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_waba_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_verify_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_connected_at TIMESTAMPTZ;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS cloud_api_coexistence BOOLEAN DEFAULT FALSE;

-- Meta geral
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMPTZ;
```

### 3.3 Tabela `chats` (Conversas)

```sql
-- Campo channel para diferenciar origem
ALTER TABLE chats ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'whatsapp';
-- Valores: 'whatsapp', 'instagram', 'facebook', 'whatsapp_cloud'

-- Campo para ID do remetente (phone_number para WhatsApp, user_id para Instagram/Facebook)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

---

## 4. Fluxo de Conexão OAuth

### 4.1 Instagram/Facebook (via Facebook OAuth)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Usuário   │────▶│   Frontend  │────▶│  Facebook   │────▶│  Callback   │
│  clica em   │     │  abre popup │     │   OAuth     │     │    PHP      │
│  Conectar   │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  Salva no   │
                                                            │  Supabase   │
                                                            └─────────────┘
```

**URL de Autorização (Instagram):**
```javascript
const scope = 'pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages';

const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${META_APP_ID}&` +
  `redirect_uri=${encodeURIComponent(CALLBACK_URL)}&` +
  `scope=${scope}&` +
  `state=${clinicId}_instagram&` +
  `response_type=code`;
```

**URL de Autorização (Facebook Messenger):**
```javascript
const scope = 'pages_show_list,pages_messaging,pages_manage_metadata';

const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${META_APP_ID}&` +
  `redirect_uri=${encodeURIComponent(CALLBACK_URL)}&` +
  `scope=${scope}&` +
  `state=${clinicId}&` +
  `response_type=code`;
```

### 4.2 WhatsApp Cloud API (Embedded Signup)

**Modo 1: OAuth Tradicional (Número Novo)**
```javascript
const scope = 'whatsapp_business_messaging,whatsapp_business_management,business_management';

const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${META_APP_ID}&` +
  `redirect_uri=${encodeURIComponent(CALLBACK_URL)}&` +
  `scope=${scope}&` +
  `state=${clinicId}&` +
  `response_type=code`;
```

**Modo 2: Embedded Signup com SDK (Coexistência)**
```javascript
// Requer SDK do Facebook carregado
FB.login(
  (response) => {
    if (response.authResponse) {
      const code = response.authResponse.code;
      // Processar code no backend
    }
  },
  {
    config_id: WHATSAPP_CONFIG_ID, // Ex: '763626706332381'
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3'
    }
  }
);
```

---

## 5. Callbacks PHP

### 5.1 meta-callback.php (Instagram/Facebook)

**Localização:** `public/api/meta-callback.php`

**Fluxo:**
1. Recebe `code` e `state` (clinic_id)
2. Troca `code` por `access_token`
3. Obtém token de longa duração
4. Busca páginas do Facebook
5. Para cada página, busca Instagram Business Account
6. Inscreve página/Instagram no webhook
7. Salva tokens no Supabase
8. Fecha popup e notifica frontend

**Funções principais:**
```php
// Trocar code por token
function exchangeCodeForToken($code, $redirectUri, $isInstagram = false) {
    $config = getMetaAppConfig();
    $url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
        'client_id' => $config['meta_app_id'],
        'redirect_uri' => $redirectUri,
        'client_secret' => $config['meta_app_secret'],
        'code' => $code
    ]);
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    return $data['access_token'];
}

// Token de longa duração
function getLongLivedToken($shortToken) {
    $config = getMetaAppConfig();
    $url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
        'grant_type' => 'fb_exchange_token',
        'client_id' => $config['meta_app_id'],
        'client_secret' => $config['meta_app_secret'],
        'fb_exchange_token' => $shortToken
    ]);
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    return $data['access_token'] ?? $shortToken;
}

// Buscar páginas
function getFacebookPages($accessToken) {
    $url = "https://graph.facebook.com/v18.0/me/accounts?access_token={$accessToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Buscar Instagram Business Account
function getInstagramAccount($pageId, $pageToken) {
    $url = "https://graph.facebook.com/v18.0/{$pageId}?fields=instagram_business_account&access_token={$pageToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Inscrever no webhook
function subscribeToWebhook($id, $token, $type = 'page') {
    $fields = $type === 'instagram' 
        ? 'messages,messaging_postbacks,messaging_seen,message_reactions'
        : 'messages,messaging_postbacks,message_deliveries,message_reads,messaging_referrals,message_echoes';
    
    $url = "https://graph.facebook.com/v18.0/{$id}/subscribed_apps?subscribed_fields={$fields}&access_token={$token}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}
```

### 5.2 whatsapp-callback.php (WhatsApp Cloud API)

**Localização:** `public/api/whatsapp-callback.php`

**Fluxo:**
1. Recebe `code` e `state` (clinic_id)
2. Troca `code` por `access_token`
3. Busca WABA ID do debug token
4. Busca números de telefone do WABA
5. Inscreve WABA no webhook
6. Se coexistência, inicia sincronização de histórico
7. Salva tokens no Supabase
8. Fecha popup e notifica frontend

**Funções principais:**
```php
// Buscar WABA ID do token
function getWABAFromToken($accessToken) {
    $url = "https://graph.facebook.com/v18.0/debug_token?input_token={$accessToken}&access_token={$accessToken}";
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    
    $wabaId = null;
    if (isset($data['data']['granular_scopes'])) {
        foreach ($data['data']['granular_scopes'] as $scope) {
            if ($scope['scope'] === 'whatsapp_business_messaging' && !empty($scope['target_ids'])) {
                $wabaId = $scope['target_ids'][0];
                break;
            }
        }
    }
    return $wabaId;
}

// Buscar números de telefone
function getPhoneNumbers($wabaId, $accessToken) {
    $url = "https://graph.facebook.com/v18.0/{$wabaId}/phone_numbers?access_token={$accessToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Inscrever no webhook
function subscribeWhatsAppWebhook($wabaId, $accessToken) {
    $url = "https://graph.facebook.com/v18.0/{$wabaId}/subscribed_apps";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Sincronização de histórico (coexistência)
function startHistorySync($phoneNumberId, $accessToken) {
    $url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/smb_app_data";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'messaging_product' => 'whatsapp',
        'sync_type' => 'history'
    ]));
    $response = curl_exec($ch);
    curl_close($ch);
    
    return true;
}
```

---

## 6. Edge Functions (Webhooks)

### 6.1 meta-webhook (Instagram/Facebook)

**Localização:** `supabase/functions/meta-webhook/index.ts`

**Verificação (GET):**
```typescript
if (req.method === "GET") {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}
```

**Receber Mensagens (POST):**
```typescript
// Estrutura do payload
{
  "object": "instagram" | "page",
  "entry": [{
    "id": "PAGE_OR_IG_ID",
    "messaging": [{
      "sender": { "id": "USER_ID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1234567890,
      "message": {
        "mid": "MESSAGE_ID",
        "text": "Olá!",
        "is_echo": false,
        "attachments": [...]
      }
    }]
  }]
}
```

**Lógica de processamento:**
1. Identificar clínica pelo `page_id` ou `instagram_business_account_id`
2. Ignorar mensagens echo (`message.is_echo = true`)
3. Ignorar se `senderId === pageId` (mensagem da própria página)
4. Buscar perfil do usuário (nome, foto)
5. Criar ou atualizar chat
6. Salvar mensagem
7. Enviar broadcast para realtime

**Código completo:**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "belitx_meta_webhook_2024";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Verificação do webhook (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }
  
  // Receber mensagens (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      for (const entry of body.entry || []) {
        const pageId = entry.id;
        
        // Buscar clínica pelo page_id ou instagram_business_account_id
        let { data: clinic } = await supabase
          .from("clinics")
          .select("id, name, facebook_page_access_token, instagram_access_token, instagram_business_account_id")
          .or(`facebook_page_id.eq.${pageId},instagram_business_account_id.eq.${pageId}`)
          .single();
        
        if (!clinic) continue;
        
        const pageAccessToken = clinic.instagram_access_token || clinic.facebook_page_access_token;
        const isInstagram = body.object === "instagram";
        const channel = isInstagram ? "instagram" : "facebook";
        
        for (const messaging of entry.messaging || []) {
          const senderId = messaging.sender?.id;
          const message = messaging.message;
          
          if (!message || message.is_echo) continue;
          if (senderId === pageId || senderId === clinic.instagram_business_account_id) continue;
          
          // Buscar perfil do usuário
          let userName = `${channel} User`;
          try {
            const profileResponse = await fetch(
              `https://graph.facebook.com/v18.0/${senderId}?fields=name,profile_pic&access_token=${pageAccessToken}`
            );
            const profileData = await profileResponse.json();
            if (profileData.name) userName = profileData.name;
          } catch {}
          
          // Buscar ou criar chat
          let { data: chat } = await supabase
            .from("chats")
            .select("*")
            .eq("clinic_id", clinic.id)
            .eq("phone_number", senderId)
            .eq("channel", channel)
            .single();
          
          if (!chat) {
            const { data: newChat } = await supabase
              .from("chats")
              .insert({
                clinic_id: clinic.id,
                phone_number: senderId,
                client_name: userName,
                channel: channel,
                status: "Novo Lead",
                unread_count: 1,
                last_message: message.text || "[Mídia]",
              })
              .select()
              .single();
            chat = newChat;
          } else {
            await supabase
              .from("chats")
              .update({
                unread_count: (chat.unread_count || 0) + 1,
                last_message: message.text || "[Mídia]",
              })
              .eq("id", chat.id);
          }
          
          // Salvar mensagem
          await supabase.from("messages").insert({
            chat_id: chat.id,
            content: message.text || "",
            is_from_client: true,
            remote_message_id: message.mid,
          });
        }
      }
      
      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
});
```

### 6.2 meta-send (Enviar Mensagens)

**Localização:** `supabase/functions/meta-send/index.ts`

**Payload de entrada:**
```typescript
{
  clinic_id: string,
  recipient_id: string,
  message: string,
  channel: 'instagram' | 'facebook',
  media_url?: string,
  media_type?: 'image' | 'video' | 'audio' | 'file'
}
```

**Código completo:**
```typescript
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

  try {
    const { clinic_id, recipient_id, message, channel, media_url, media_type } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: clinic } = await supabase
      .from("clinics")
      .select("facebook_page_id, facebook_page_access_token, instagram_business_account_id")
      .eq("id", clinic_id)
      .single();

    if (!clinic) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), { status: 404 });
    }

    const pageAccessToken = clinic.facebook_page_access_token;
    let apiUrl: string;
    
    if (channel === "instagram") {
      apiUrl = `https://graph.facebook.com/v18.0/${clinic.instagram_business_account_id}/messages`;
    } else {
      apiUrl = `https://graph.facebook.com/v18.0/${clinic.facebook_page_id}/messages`;
    }

    const messagePayload: any = {
      recipient: { id: recipient_id },
      message: media_url ? { attachment: { type: media_type, payload: { url: media_url } } } : { text: message }
    };

    if (channel === "facebook") {
      messagePayload.messaging_type = "RESPONSE";
    }

    const response = await fetch(`${apiUrl}?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result.error?.message }), { status: response.status });
    }

    return new Response(JSON.stringify({ success: true, message_id: result.message_id }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
```

---

## 7. Enviar Mensagens (WhatsApp Cloud API)

### 7.1 Mensagem de Texto

```typescript
const response = await fetch(
  `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone, // Ex: "5511999999999"
      type: "text",
      text: { body: message }
    })
  }
);
```

### 7.2 Mensagem com Mídia

```typescript
// Imagem
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "image",
  image: {
    link: "https://example.com/image.jpg",
    caption: "Legenda opcional"
  }
}

// Documento
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "document",
  document: {
    link: "https://example.com/file.pdf",
    filename: "arquivo.pdf",
    caption: "Legenda opcional"
  }
}

// Áudio
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "audio",
  audio: { link: "https://example.com/audio.mp3" }
}

// Vídeo
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "video",
  video: {
    link: "https://example.com/video.mp4",
    caption: "Legenda opcional"
  }
}
```

### 7.3 Template de Mensagem

```typescript
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "template",
  template: {
    name: "hello_world",
    language: { code: "pt_BR" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "João" }
        ]
      }
    ]
  }
}
```

---

## 8. Integrar Novo Painel (Ex: Serrana)

### 8.1 Pré-requisitos

1. App Belitx aprovado pela Meta
2. Supabase project configurado
3. Domínio com HTTPS

### 8.2 Passos de Implementação

**Passo 1: Criar tabela de configuração**
```sql
CREATE TABLE whatsapp_cloud_config (
  id SERIAL PRIMARY KEY,
  phone_number_id VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20),
  display_name VARCHAR(100),
  waba_id VARCHAR(50),
  access_token TEXT NOT NULL,
  webhook_verify_token VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Passo 2: Criar Edge Function de Webhook**
```typescript
// supabase/functions/whatsapp-cloud-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "seu_verify_token_aqui";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Verificação GET
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }
  
  // Receber mensagens POST
  if (req.method === "POST") {
    const body = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value.messages) continue;
        
        const phoneNumberId = value.metadata.phone_number_id;
        
        // Buscar config pelo phone_number_id
        const { data: config } = await supabase
          .from('whatsapp_cloud_config')
          .select('*')
          .eq('phone_number_id', phoneNumberId)
          .single();
        
        if (!config) continue;
        
        for (const msg of value.messages) {
          const from = msg.from;
          const text = msg.text?.body || '';
          
          // Buscar ou criar conversa
          let { data: conversation } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('customer_phone', from)
            .eq('source', 'whatsapp_cloud')
            .single();
          
          if (!conversation) {
            const { data: newConv } = await supabase
              .from('chat_conversations')
              .insert({
                customer_phone: from,
                customer_name: value.contacts?.[0]?.profile?.name || from,
                source: 'whatsapp_cloud',
                status: 'waiting'
              })
              .select()
              .single();
            conversation = newConv;
          }
          
          // Salvar mensagem
          await supabase.from('chat_messages').insert({
            conversation_id: conversation.id,
            sender_type: 'customer',
            message: text
          });
        }
      }
    }
    
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
```

**Passo 3: Configurar Webhook no Meta**
1. Acesse o App Belitx no Meta for Developers
2. WhatsApp > Configuração > Webhooks
3. Adicione novo webhook:
   ```
   URL: https://[SEU_SUPABASE].supabase.co/functions/v1/whatsapp-cloud-webhook
   Token: seu_verify_token_aqui
   ```

**Passo 4: Conectar Número**
1. No Meta Business Suite, adicione o número ao WABA
2. Verifique o número (SMS ou ligação)
3. Gere token de acesso
4. Salve na tabela `whatsapp_cloud_config`

**Passo 5: Integrar com Painel Existente**
```typescript
// Buscar config do WhatsApp Cloud
const { data: cloudConfig } = await supabase
  .from('whatsapp_cloud_config')
  .select('*')
  .eq('status', 'active')
  .single();

// Configurar serviço
whatsappCloudApiService.configure({
  phoneNumberId: cloudConfig.phone_number_id,
  accessToken: cloudConfig.access_token
});

// Enviar mensagem
await whatsappCloudApiService.sendText(phone, message);
```

---

## 9. Coexistência (WhatsApp Business App + Cloud API)

### 9.1 O que é Coexistência?

Permite usar o WhatsApp Cloud API sem desconectar o WhatsApp Business App do celular. O número continua funcionando no app e também recebe mensagens via API.

### 9.2 Requisitos

1. Config ID do Embedded Signup (criado no Meta for Developers)
2. Permissão `whatsapp_business_messaging` com escopo granular
3. Número já verificado no WhatsApp Business

### 9.3 Como Funciona

1. Usuário clica em "Conectar WhatsApp" no painel
2. Abre Embedded Signup com `config_id`
3. Usuário autoriza sem desconectar o app do celular
4. Sistema recebe token com permissão de coexistência
5. Mensagens chegam tanto no app quanto na API

### 9.4 Sincronização de Histórico

Após conectar em modo coexistência, é possível sincronizar histórico:
```php
function startHistorySync($phoneNumberId, $accessToken) {
  // Sincronizar contatos
  $url = "https://graph.facebook.com/v18.0/{$phoneNumberId}/smb_app_data";
  // POST com sync_type: 'smb_app_state_sync'
  
  // Sincronizar histórico de mensagens
  // POST com sync_type: 'history'
}
```

---

## 10. Troubleshooting

### 10.1 Webhook não recebe mensagens

1. Verificar se o webhook está inscrito:
   ```
   GET https://graph.facebook.com/v18.0/{PAGE_ID}/subscribed_apps?access_token={TOKEN}
   ```

2. Verificar logs do Supabase Edge Functions

3. Testar webhook manualmente:
   ```bash
   curl -X POST https://seu-webhook.com \
     -H "Content-Type: application/json" \
     -d '{"object":"page","entry":[...]}'
   ```

### 10.2 Token expirado

Tokens de página não expiram, mas tokens de usuário sim. Use tokens de longa duração:
```php
$url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
  'grant_type' => 'fb_exchange_token',
  'client_id' => $appId,
  'client_secret' => $appSecret,
  'fb_exchange_token' => $shortToken
]);
```

### 10.3 Mensagem não enviada

1. Verificar se está dentro da janela de 24h (WhatsApp/Instagram)
2. Verificar se o token tem permissão
3. Verificar logs da API:
   ```typescript
   const result = await response.json();
   console.log('API Response:', result);
   ```

### 10.4 Erro "User is not available"

O usuário bloqueou a página/conta ou não iniciou conversa. Só é possível responder após o usuário enviar mensagem.

### 10.5 Erro "(#100) No matching user found"

O `recipient_id` está incorreto ou o usuário não existe mais. Verifique se está usando o ID correto do usuário.

---

## 11. Referências

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer)
- [Meta for Developers](https://developers.facebook.com/)

---

## 12. Credenciais do Belitx (Referência)

| Item | Valor |
|------|-------|
| Supabase Project | `opuepzfqizmamdegdhbs` |
| Meta Webhook URL | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/meta-webhook` |
| WhatsApp Webhook URL | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook` |
| Meta Callback | `https://belitx.com.br/api/meta-callback.php` |
| WhatsApp Callback | `https://belitx.com.br/api/whatsapp-callback.php` |
| Webhook Verify Token (Meta) | `belitx_meta_webhook_2024` |
| Embedded Signup Config ID | `763626706332381` |

---

## 13. Checklist de Implementação

### Para Instagram/Facebook:
- [ ] Criar App no Meta for Developers
- [ ] Adicionar produtos: Facebook Login, Messenger, Instagram
- [ ] Configurar URIs de redirecionamento OAuth
- [ ] Configurar webhooks
- [ ] Solicitar permissões necessárias
- [ ] Criar `meta-callback.php`
- [ ] Criar Edge Function `meta-webhook`
- [ ] Criar Edge Function `meta-send`
- [ ] Testar conexão OAuth
- [ ] Testar recebimento de mensagens
- [ ] Testar envio de mensagens

### Para WhatsApp Cloud API:
- [ ] Adicionar produto WhatsApp ao App
- [ ] Criar configuração de Embedded Signup
- [ ] Configurar webhook do WhatsApp
- [ ] Criar `whatsapp-callback.php`
- [ ] Criar Edge Function `whatsapp-cloud-webhook`
- [ ] Adicionar número ao WABA
- [ ] Verificar número
- [ ] Testar conexão
- [ ] Testar recebimento de mensagens
- [ ] Testar envio de mensagens
- [ ] Testar templates (se necessário)
