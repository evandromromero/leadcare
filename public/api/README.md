# API PHP - Meta Callbacks

## Arquivos

| Arquivo | Descrição | URL |
|---------|-----------|-----|
| `meta-callback.php` | OAuth callback para Facebook e Instagram | `https://belitx.com.br/api/meta-callback.php` |
| `whatsapp-callback.php` | OAuth callback para WhatsApp Embedded Signup | `https://belitx.com.br/api/whatsapp-callback.php` |
| `webhook.php` | Webhook unificado para receber mensagens | `https://belitx.com.br/api/webhook.php` |

## Configuração

### 1. Preencher SUPABASE_SERVICE_KEY

Em cada arquivo PHP, preencha a constante `SUPABASE_SERVICE_KEY` com a service_role key do Supabase:

```php
define('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
```

### 2. Configurar no Meta for Developers

#### Login com Facebook (OAuth)
1. Acesse: Meta Developers → App → Login com o Facebook → Configurações
2. Adicione em "URIs de redirecionamento do OAuth válidos":
   - `https://belitx.com.br/api/meta-callback.php`
   - `https://belitx.com.br/api/whatsapp-callback.php`

#### Domínios do JavaScript SDK
1. Acesse: Meta Developers → App → Login com o Facebook → Configurações
2. Adicione em "Domínios permitidos para o SDK do JavaScript":
   - `https://belitx.com.br`

#### Webhook (Mensagens)
1. Acesse: Meta Developers → App → WhatsApp → Configuração
2. Configure o Webhook:
   - URL de callback: `https://belitx.com.br/api/webhook.php`
   - Token de verificação: `leadcare_webhook_token`
3. Inscreva-se nos campos:
   - `messages`
   - `message_template_status_update`

#### Configurações Básicas do App
1. Acesse: Meta Developers → App → Configurações → Básica
2. Adicione em "Domínios do aplicativo":
   - `belitx.com.br`

### 3. Permissões Necessárias

O App deve ter as seguintes permissões aprovadas:
- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `business_management`
- `pages_messaging`
- `instagram_basic`
- `instagram_manage_messages`

## Fluxo de Autenticação

### WhatsApp Embedded Signup
```
1. Frontend abre popup com URL do Embedded Signup
2. Usuário autoriza no Meta
3. Meta redireciona para whatsapp-callback.php com ?code=xxx&state=clinic_id
4. PHP troca code por access_token
5. PHP salva tokens no Supabase
6. PHP exibe página de sucesso e fecha popup
7. Frontend recebe postMessage e atualiza UI
```

### Facebook/Instagram OAuth
```
1. Frontend abre popup com URL OAuth do Facebook
2. Usuário autoriza no Meta
3. Meta redireciona para meta-callback.php com ?code=xxx&state=clinic_id
4. PHP troca code por access_token
5. PHP busca páginas e contas Instagram
6. PHP inscreve páginas no webhook
7. PHP salva tokens no Supabase
8. PHP exibe página de sucesso e fecha popup
```

## Webhook de Mensagens

O `webhook.php` recebe todos os eventos da Meta e encaminha para as Edge Functions do Supabase:

| Tipo | Edge Function |
|------|---------------|
| WhatsApp (`whatsapp_business_account`) | `whatsapp-cloud-webhook` |
| Instagram (`instagram`) | `meta-webhook` |
| Facebook (`page`) | `meta-webhook` |

## Troubleshooting

### Tela preta no OAuth
- Verifique se a URL de callback está exatamente igual no Meta e no código
- Verifique se o domínio está adicionado nas configurações do App
- Verifique se HTTPS está funcionando corretamente

### Webhook não recebe mensagens
- Verifique se o token de verificação está correto
- Verifique se o webhook foi inscrito nos campos corretos
- Verifique os logs do PHP (`error_log`)

### Erro ao trocar code por token
- Verifique se `meta_app_id` e `meta_app_secret` estão configurados no banco
- Verifique se a URL de redirect é exatamente a mesma usada na autorização
