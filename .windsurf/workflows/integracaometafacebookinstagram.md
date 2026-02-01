---
description: Integração Meta (Facebook + Instagram) via OAuth para receber mensagens
---

# Integração Meta (Facebook + Instagram)

Este workflow descreve como configurar a integração com Facebook Messenger e Instagram Direct para receber mensagens no Belitx.

## Pré-requisitos

1. Conta de desenvolvedor no Meta for Developers (https://developers.facebook.com)
2. App criado no Meta for Developers
3. Página do Facebook vinculada ao Instagram Business

## Edge Functions Criadas

| Função | URL | JWT | Descrição |
|--------|-----|-----|-----------|
| `facebook-oauth-callback` | `/functions/v1/facebook-oauth-callback` | false | Recebe callback OAuth do Facebook |
| `meta-webhook` | `/functions/v1/meta-webhook` | false | Recebe mensagens do Messenger/Instagram |

## URLs para Configurar no Meta

### 1. URI de Redirecionamento OAuth (Facebook Login)
```
https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/facebook-oauth-callback
```

### 2. URL do Webhook
```
https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/meta-webhook
```

### 3. Token de Verificação do Webhook
```
belitx_meta_webhook_2024
```

## Passo a Passo - Configuração no Meta for Developers

### 1. Criar App
1. Acesse https://developers.facebook.com
2. Clique em "Meus Apps" → "Criar App"
3. Escolha "Empresa" ou "Consumidor"
4. Dê um nome ao app (ex: "Belitx Integration")

### 2. Adicionar Produtos
No menu lateral, clique em "Adicionar produto" e adicione:
- **Facebook Login** - Para autenticação OAuth
- **Webhooks** - Para receber mensagens
- **Messenger** - Para Facebook Messenger
- **Instagram** - Para Instagram Direct

### 3. Configurar Facebook Login
1. Vá em **Facebook Login → Configurações**
2. Em "URIs de redirecionamento do OAuth válidos", adicione:
   ```
   https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/facebook-oauth-callback
   ```
3. Ative:
   - Login no OAuth do cliente: **Sim**
   - Login do OAuth na Web: **Sim**
   - Forçar HTTPS: **Sim**
   - Usar modo estrito para URIs: **Sim**
4. Clique em "Salvar alterações"

### 4. Configurar Webhooks
1. Vá em **Webhooks → Configurações** (ou na seção do produto Messenger/Instagram)
2. Em "URL de callback", cole:
   ```
   https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/meta-webhook
   ```
3. Em "Verificar token", cole:
   ```
   belitx_meta_webhook_2024
   ```
4. Clique em "Verificar e salvar"

### 5. Assinar Campos do Webhook
Após verificar, assine os seguintes campos:
- `messages` - Novas mensagens
- `messaging_postbacks` - Cliques em botões
- `message_deliveries` - Status de entrega
- `message_reads` - Confirmação de leitura

### 6. Configurar Instagram
1. Vá em **Instagram → Configurações**
2. Em "URL de redirecionamento", adicione:
   ```
   https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/facebook-oauth-callback
   ```
3. Salve as configurações

### 7. Obter App ID e App Secret
1. Vá em **Configurações → Básico**
2. Copie o **ID do App** e **Chave Secreta do App**
3. Configure como variáveis de ambiente no Supabase:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`

## Variáveis de Ambiente Necessárias (Supabase)

```bash
FACEBOOK_APP_ID=seu_app_id
FACEBOOK_APP_SECRET=seu_app_secret
FRONTEND_URL=https://app.belitx.com.br
```

## Colunas Necessárias na Tabela `clinics`

```sql
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_user_access_token TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMPTZ;
```

## Fluxo de Autenticação

1. Usuário clica em "Conectar Facebook/Instagram" no Belitx
2. Abre popup do Facebook pedindo autorização
3. Usuário autoriza as permissões
4. Facebook redireciona para `facebook-oauth-callback` com código
5. Edge function troca código por access token
6. Busca páginas do Facebook e contas do Instagram
7. Salva tokens na tabela `clinics`
8. Redireciona de volta para o frontend

## Fluxo de Mensagens

1. Cliente envia mensagem no Messenger ou Instagram Direct
2. Meta envia POST para `meta-webhook`
3. Edge function identifica a clínica pelo `page_id`
4. Cria ou atualiza chat na tabela `chats`
5. Salva mensagem na tabela `messages`
6. Realtime do Supabase notifica o frontend

## Permissões Necessárias do App

- `pages_messaging` - Enviar/receber mensagens do Messenger
- `pages_manage_metadata` - Gerenciar páginas
- `instagram_basic` - Acesso básico ao Instagram
- `instagram_manage_messages` - Enviar/receber mensagens do Instagram

## Publicar o App

Para receber mensagens de produção (não apenas de testers):
1. Vá em **Análise do app**
2. Solicite aprovação das permissões necessárias
3. Publique o app

## Arquivos Locais

- `supabase/functions/facebook-oauth-callback/index.ts`
- `supabase/functions/meta-webhook/index.ts`

## Troubleshooting

### Webhook não verifica
- Verifique se o token de verificação está correto: `belitx_meta_webhook_2024`
- Verifique se a edge function está deployada e ativa

### Mensagens não chegam
- Verifique se os campos do webhook estão assinados
- Verifique se o app está publicado (modo desenvolvimento só recebe de testers)
- Verifique os logs da edge function no Supabase

### Erro de OAuth
- Verifique se a URI de redirecionamento está exatamente igual no Meta e na edge function
- Verifique se o App ID e App Secret estão configurados como variáveis de ambiente
