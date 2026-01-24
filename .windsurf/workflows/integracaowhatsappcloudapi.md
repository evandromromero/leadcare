---
description: Integração WhatsApp Cloud API (API Oficial da Meta)
---

# Integração WhatsApp Cloud API - Guia Completo

Este workflow documenta como configurar e usar a API oficial do WhatsApp (Cloud API) no LeadCare.

## Pré-requisitos

1. **App Meta criado** no Facebook Developers
2. **Conta Business Manager** como administrador
3. **Número de telefone** verificado no Meta Business Suite
4. **App aprovado** pela Meta (para coexistência com celular)

---

## Passo 1: Criar System User Token

1. Acesse `business.facebook.com`
2. Vá em **Usuários > Usuários do sistema**
3. Crie novo usuário com função **Admin**
4. Clique em **"Gerar novo token"**
5. Selecione o aplicativo correto
6. Defina expiração como **"Nunca"** (produção)
7. Marque as permissões:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`
8. Copie e guarde o token em local seguro

---

## Passo 2: Configurar Webhook no Meta

1. No painel de desenvolvedores, acesse seu app
2. Vá em **WhatsApp > Configuração**
3. Configure o webhook:

```
URL: https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook
Verify Token: leadcare_webhook_token (ou o valor de cloud_api_verify_token da clínica)
```

4. Assine os campos:
   - ✅ `messages`
   - ✅ `message_status`

---

## Passo 3: Configurar no LeadCare

### No Admin (SuperAdmin)
1. Acesse **Admin > Clínicas > [Clínica]**
2. Ative **"Permitir Cloud API"**
3. Preencha os campos:
   - `cloud_api_phone_number_id`: ID do número no Meta
   - `cloud_api_access_token`: Token do System User
   - `cloud_api_waba_id`: WhatsApp Business Account ID
   - `cloud_api_verify_token`: Token de verificação do webhook
4. Mude `whatsapp_provider` para **"cloud_api"**

### No Settings (Cliente)
1. Acesse **Configurações > WhatsApp**
2. Verifique se os campos estão preenchidos
3. Clique em **"Sincronizar Templates"**

---

## Edge Functions Disponíveis

### `whatsapp-cloud-webhook`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook`
**JWT:** Desabilitado

Recebe eventos da Meta:
- Mensagens (texto, mídia, localização, contato, botões, listas)
- Status de entrega (sent, delivered, read, failed)
- Reações

### `cloud-api-send`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/cloud-api-send`
**JWT:** Habilitado

Ações:
- `send_text` - Enviar texto
- `send_image` - Enviar imagem
- `send_video` - Enviar vídeo
- `send_audio` - Enviar áudio
- `send_document` - Enviar documento
- `send_reaction` - Enviar reação
- `send_template` - Enviar template
- `send_location` - Enviar localização
- `send_contacts` - Enviar contato
- `mark_as_read` - Marcar como lida

### `cloud-api-templates`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/cloud-api-templates`
**JWT:** Habilitado

Ações:
- `sync_templates` - Sincronizar templates do Meta
- `list_templates` - Listar templates do banco
- `send_template` - Enviar template individual
- `send_bulk_template` - Envio em massa

---

## Exemplos de Código

### Enviar mensagem de texto
```typescript
await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    clinic_id: clinicId,
    action: 'send_text',
    phone: '5567999999999',
    message: 'Olá!'
  }),
});
```

### Enviar imagem
```typescript
await fetch(`${supabaseUrl}/functions/v1/cloud-api-send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    clinic_id: clinicId,
    action: 'send_image',
    phone: '5567999999999',
    media_url: 'https://exemplo.com/imagem.jpg',
    caption: 'Legenda da imagem'
  }),
});
```

### Sincronizar templates
```typescript
await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    clinic_id: clinicId,
    action: 'sync_templates'
  }),
});
```

### Enviar template com variáveis
```typescript
await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    clinic_id: clinicId,
    action: 'send_template',
    phone: '5567999999999',
    template_name: 'hello_world',
    template_language: 'pt_BR',
    variables: ['João', 'Clínica ABC']
  }),
});
```

### Envio em massa
```typescript
await fetch(`${supabaseUrl}/functions/v1/cloud-api-templates`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    clinic_id: clinicId,
    action: 'send_bulk_template',
    template_name: 'promocao',
    phones: [
      { phone: '5567999999999', variables: ['João'] },
      { phone: '5567888888888', variables: ['Maria'] }
    ]
  }),
});
```

---

## Coexistência WhatsApp Celular + Cloud API

| Cenário | Possível? | Observação |
|---------|-----------|------------|
| Cloud API + WhatsApp Business **mesmo número** | ❌ Não | Meta bloqueia |
| Cloud API + WhatsApp Business **números diferentes** | ✅ Sim | Cada canal funciona separado |
| Migrar número do celular para Cloud API | ✅ Sim | Requer aprovação do app |

**Para coexistência funcionar:**
1. App precisa estar **aprovado** na Meta
2. Número deve estar no **WhatsApp Business** (não WhatsApp comum)
3. Configurar **Embedded Signup** no app

---

## Campos no Banco de Dados

### Tabela `clinics`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `whatsapp_provider` | text | 'evolution' ou 'cloud_api' |
| `cloud_api_enabled` | boolean | Se Cloud API está habilitada |
| `cloud_api_phone_number_id` | text | ID do número no Meta |
| `cloud_api_access_token` | text | Token de acesso |
| `cloud_api_waba_id` | text | WhatsApp Business Account ID |
| `cloud_api_verify_token` | text | Token de verificação do webhook |

### Tabela `whatsapp_templates`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `clinic_id` | uuid | ID da clínica |
| `template_id` | text | ID do template no Meta |
| `name` | text | Nome do template |
| `language` | text | Idioma (pt_BR) |
| `category` | text | Categoria (MARKETING, UTILITY, etc) |
| `status` | text | Status (APPROVED, PENDING, REJECTED) |
| `components` | jsonb | Componentes do template |

---

## Troubleshooting

### Webhook não recebe mensagens
1. Verifique se o `verify_token` está correto
2. Confirme que os campos `messages` e `message_status` estão assinados
3. Verifique logs no Supabase Dashboard

### Erro ao enviar mensagem
1. Verifique se o `access_token` está válido
2. Confirme que o `phone_number_id` está correto
3. Para templates, verifique se está aprovado no Meta

### Templates não sincronizam
1. Verifique se o `waba_id` está correto
2. Confirme que o token tem permissão `whatsapp_business_management`

---

## Aprovação do App na Meta

### Passo 1: Acessar Painel de Desenvolvedores
1. Acesse: https://developers.facebook.com
2. Vá em **Meus Apps** → Selecione o app **Belitx**
3. No menu lateral, clique em **Análise do App**

### Passo 2: Solicitar Permissões

Solicite as 3 permissões abaixo com as justificativas prontas:

---

### Permissão: `whatsapp_business_messaging`

**Copie e cole esta resposta:**

```
O aplicativo Belitx utiliza a permissão whatsapp_business_messaging para 
possibilitar a comunicação entre empresas e seus clientes por meio da 
API oficial do WhatsApp Business.

A plataforma oferece um ambiente de multiatendimento, onde diferentes 
operadores podem receber, responder e gerenciar conversas de forma 
centralizada e organizada.

A permissão é necessária para:
- Enviar e receber mensagens de clientes que entram em contato pelo WhatsApp
- Carregar e recuperar mídias enviadas nas conversas (imagens, áudios, documentos e vídeos)
- Registrar e gerenciar números comerciais vinculados à conta WhatsApp Business da empresa
- Exibir e atualizar informações do perfil comercial
- Obter dados analíticos agregados para melhorar a experiência de atendimento, sempre sem identificação pessoal

Como valor agregado, o Belitx melhora a produtividade das empresas ao 
centralizar conversas, organizar atendimentos em equipe, reduzir tempo 
de resposta e garantir uma experiência mais eficiente e profissional 
para o cliente final.

A permissão é essencial, pois sem ela o aplicativo não conseguiria 
realizar sua função principal: permitir que empresas se comuniquem de 
forma oficial, segura e integrada com seus clientes pelo WhatsApp Business.
```

---

### Permissão: `whatsapp_business_management`

**Copie e cole esta resposta:**

```
O aplicativo Belitx utiliza a permissão whatsapp_business_management para 
gerenciar os ativos comerciais do WhatsApp Business que pertencem aos 
nossos clientes ou aos quais eles nos concedem acesso.

Essa permissão é necessária para que a plataforma ofereça as seguintes 
funcionalidades:
- Conectar e gerenciar contas do WhatsApp Business diretamente pelo painel do Belitx
- Criar, listar, editar e utilizar modelos de mensagem (message templates) aprovados pela Meta
- Administrar números de telefone comerciais, incluindo verificações, configurações e status de conexão
- Gerenciar assinaturas de webhook, essenciais para receber eventos de mensagens e atualizações em tempo real
- Gerar e acessar códigos QR usados para iniciar conversas com a empresa
- Coletar análises e métricas agregadas da conta, visando melhorar o desempenho do atendimento e a experiência do usuário

O valor para o usuário é permitir que empresas consigam configurar, 
administrar e monitorar toda sua operação de WhatsApp Business em um 
único painel, sem necessidade de ações manuais externas. Isso reduz 
tempo operacional, melhora a gestão de atendimento e garante maior eficiência.

A permissão é indispensável para que o Belitx ofereça sua funcionalidade 
principal: centralizar, organizar e gerenciar de forma segura todos os 
ativos do WhatsApp Business da empresa, permitindo uma operação de 
atendimento profissional e integrada.
```

---

### Permissão: `business_management`

**Copie e cole esta resposta:**

```
O aplicativo Belitx utiliza a permissão business_management para acessar 
e gerenciar ativos que pertencem às empresas clientes dentro do Business 
Manager, conforme autorizado por elas.

Essa permissão é necessária para:
- Vincular e gerenciar a conta do WhatsApp Business dentro do Gerenciador de Negócios do cliente
- Confirmar e validar ativos comerciais, como números de telefone e contas do WhatsApp
- Gerenciar permissões e acessos relacionados ao WhatsApp Business dentro do Business Manager
- Sincronizar informações administrativas importantes para o funcionamento correto da API oficial do WhatsApp dentro da plataforma
- Obter informações agregadas e anônimas de desempenho, que ajudam a melhorar as ferramentas e relatórios oferecidos aos usuários

O valor para o usuário é que o Belitx facilita toda a configuração e 
operação do WhatsApp Business sem que o cliente precise navegar 
manualmente pelo Business Manager. Isso torna o processo mais rápido, 
seguro e integrado, permitindo que a empresa configure sua operação de 
atendimento de forma simples e centralizada.

A permissão é essencial para o funcionamento da plataforma, pois sem ela 
o aplicativo não conseguiria vincular ativos, gerenciar configurações ou 
validar o uso da API oficial do WhatsApp, etapas fundamentais para que o 
cliente possa enviar e receber mensagens dentro do Belitx.
```

---

### Passo 3: Preparar Vídeos de Demonstração

A Meta exige vídeos mostrando o uso real do Belitx:

| Vídeo | O que mostrar |
|-------|---------------|
| **Vídeo 1** | Mensagem chegando no Inbox + notificação em tempo real |
| **Vídeo 2** | Envio de texto e mídia (imagem/documento) |
| **Vídeo 3** | Sincronização e envio de templates |
| **Vídeo 4** | Multiatendimento (múltiplos atendentes, atribuição de conversas) |

---

### Passo 4: Configurar Domínios (CRÍTICO)

Configure em **3 lugares** diferentes:

| Local | Caminho | O que adicionar |
|-------|---------|-----------------|
| Login com Facebook | Login com o Facebook → Configurações | URI de redirecionamento OAuth do Belitx |
| Configurações Básicas | Configurações → Básica | Domínio principal do Belitx |
| Cadastro Incorporado | WhatsApp → Personalizar → Cadastro Incorporado | Domínios e subdomínios do Belitx |

---

### Passo 5: Submeter para Análise

1. Vá em **Análise do App**
2. Clique em **Solicitar permissões**
3. Selecione as 3 permissões
4. Preencha as justificativas (copie os textos acima)
5. Faça upload dos vídeos
6. Clique em **Enviar para análise**

---

### Tempo de Aprovação

| Situação | Tempo estimado |
|----------|----------------|
| Primeira submissão | 5-15 dias úteis |
| Resubmissão (após correções) | 3-7 dias úteis |

---

### Após Aprovação

1. **Criar System User Token** (com as permissões aprovadas)
2. **Configurar Webhook** no Meta:
   ```
   URL: https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook
   Verify Token: leadcare_webhook_token
   Campos: messages, message_status
   ```
3. **Preencher credenciais** na clínica (Admin do Belitx)
4. **Testar** enviando mensagem
