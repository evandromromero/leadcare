# LeadCare

CRM de WhatsApp completo para clínicas com gestão de leads, caixa de entrada multicanal, funil kanban e gestão de usuários.

---

## Sobre o Projeto

**LeadCare** é uma plataforma de CRM desenvolvida para clínicas e consultórios que precisam gerenciar atendimentos via WhatsApp de forma profissional. O sistema permite acompanhar leads desde o primeiro contato até o fechamento, com visualização em kanban, métricas em tempo real e gestão de equipe.

---

## Status do Projeto

### Fase 1: Backend e Autenticação ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Configurar Supabase (banco + auth) | ✅ Completo |
| Criar tabelas no banco | ✅ Completo |
| Implementar autenticação real | ✅ Completo |
| Row Level Security (RLS) | ✅ Completo |
| Migrar para dados reais | ✅ Completo |
| Hooks de dados (useChats, useLeads, useUsers) | ✅ Completo |
| Realtime subscriptions | ✅ Completo |

### Fase 2: Integração WhatsApp ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Integrar Evolution API | ✅ Completo |
| Webhook para receber mensagens | ✅ Completo |
| Conexão via QR Code | ✅ Completo |
| Envio/recebimento em tempo real | ✅ Completo |
| Criação automática de instância | ✅ Completo |
| Tabela `settings` com API Key global | ✅ Completo |
| Tabela `whatsapp_instances` | ✅ Completo |
| Edge Function `evolution-webhook` | ✅ Completo |
| Realtime habilitado para chats/messages | ✅ Completo |

### Fase 3: Painel Super Admin ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Role `SuperAdmin` no banco de dados | ✅ Completo |
| Tabela `admin_access_logs` para auditoria | ✅ Completo |
| Campos de gestão em `clinics` (status, plan, max_users, expires_at) | ✅ Completo |
| RLS atualizado para SuperAdmin ter acesso global | ✅ Completo |
| Login separado para admin (`/admin/login`) | ✅ Completo |
| Dashboard administrativo (`/admin`) | ✅ Completo |
| Lista de clínicas (`/admin/clinics`) | ✅ Completo |
| Detalhes da clínica (`/admin/clinics/:id`) | ✅ Completo |
| Configurações do admin (`/admin/settings`) | ✅ Completo |
| Funcionalidade "Logar como cliente" (impersonate) | ✅ Completo |
| Banner de impersonate com botão "Voltar ao Admin" | ✅ Completo |
| Aprovar/Suspender clínicas | ✅ Completo |
| Criar nova clínica manualmente | ✅ Completo |

---

## Stack Tecnológica

- **Frontend**: React 19 + TypeScript + Vite 6
- **Estilização**: TailwindCSS (via CDN)
- **Roteamento**: React Router DOM 7
- **Ícones**: Material Symbols (Google Fonts)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Cliente DB**: @supabase/supabase-js

---

## Banco de Dados (Supabase)

### Projeto Supabase
- **URL**: `https://opuepzfqizmamdegdhbs.supabase.co`
- **Projeto**: LeadCare

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `clinics` | Clínicas (multi-tenancy) - campos: status, plan, max_users, expires_at |
| `users` | Usuários vinculados ao Supabase Auth - roles: SuperAdmin, Admin, Atendente |
| `tags` | Tags para categorização |
| `leads` | Leads/contatos |
| `lead_tags` | Relacionamento leads-tags (N:N) |
| `chats` | Conversas WhatsApp |
| `chat_tags` | Relacionamento chats-tags (N:N) |
| `messages` | Mensagens das conversas |
| `whatsapp_instances` | Instâncias WhatsApp por clínica |
| `settings` | Configurações globais (Evolution API) |
| `admin_access_logs` | Logs de acesso do SuperAdmin (auditoria) |

### Triggers

- `on_auth_user_created`: Cria perfil automaticamente na tabela `users` quando um novo usuário se registra no Supabase Auth

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado:
- **SuperAdmin**: Acesso total a todas as tabelas (via função `is_super_admin()`)
- **Usuários normais**: Acesso aos dados da própria clínica

---

## Estrutura do Projeto

```
LeadCare/
├── components/
│   ├── Layout.tsx            # Layout principal (sidebar + header)
│   ├── AdminLayout.tsx       # Layout do painel admin
│   └── ImpersonateBanner.tsx # Banner de "visualizando como cliente"
├── config/
│   └── assets.ts             # URLs de assets e imagens
├── hooks/
│   ├── useAuth.tsx           # Hook de autenticação (+ impersonate)
│   ├── useChats.ts           # Hook para chats e mensagens (+ Realtime)
│   ├── useLeads.ts           # Hook para leads
│   ├── useUsers.ts           # Hook para usuários
│   └── useWhatsApp.ts        # Hook para conexão WhatsApp
├── lib/
│   ├── supabase.ts           # Cliente Supabase configurado
│   └── database.types.ts     # Tipos TypeScript do banco
├── pages/
│   ├── Login.tsx             # Login com Supabase Auth
│   ├── Dashboard.tsx         # Métricas reais do banco
│   ├── Inbox.tsx             # Caixa de entrada (dados reais)
│   ├── Kanban.tsx            # Funil de leads (drag & drop)
│   ├── Users.tsx             # Gestão de usuários
│   ├── Settings.tsx          # Configurações
│   ├── Connect.tsx           # Conexão WhatsApp (QR Code)
│   └── admin/
│       ├── AdminLogin.tsx    # Login do Super Admin
│       ├── AdminDashboard.tsx # Dashboard administrativo
│       ├── AdminClinics.tsx  # Lista de clínicas
│       ├── AdminClinicDetail.tsx # Detalhes da clínica + impersonate
│       └── AdminSettings.tsx # Configurações do admin
├── store/
│   └── mockData.ts           # Dados mockados (legado)
├── types.ts                  # Tipos TypeScript
├── App.tsx                   # Rotas e autenticação
├── .env.local                # Variáveis de ambiente
└── .env.example              # Exemplo de variáveis
```

---

## Como Executar

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Copie .env.example para .env.local e preencha

# Execute em modo desenvolvimento
npm run dev
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://opuepzfqizmamdegdhbs.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## Credenciais de Acesso

### Super Admin
| Email | Senha | Perfil |
|-------|-------|--------|
| contato@alphabetadesign.com.br | 933755RaEv** | SuperAdmin |

### Usuários de Clínica
| Email | Senha | Perfil | Clínica |
|-------|-------|--------|---------|
| evandromromero@gmail.com | 933755RaEv** | Admin | LeadCare2 |

---

## Funcionalidades Implementadas

### Login
- Autenticação real com Supabase Auth
- Redirecionamento automático se já logado
- Mensagens de erro amigáveis

### Dashboard
- Métricas em tempo real do banco
- Contagem de leads por status
- Lista de conversas recentes

### Inbox
- Lista de conversas do banco
- Visualização de mensagens
- Envio de mensagens (salva no banco)
- Tags coloridas
- Realtime updates

### Kanban
- Pipeline de leads com 5 colunas
- Drag & drop funcional
- Atualiza status no banco
- Tags e timestamps

### Usuários
- Lista usuários da clínica
- Ativar/desativar usuários
- Exibe perfil e status

### Painel Super Admin
- **Login separado** em `/admin/login`
- **Dashboard** com métricas globais (total de clínicas, usuários, conversas, mensagens)
- **Lista de clínicas** com filtros por status e busca
- **Detalhes da clínica** com usuários, estatísticas e instância WhatsApp
- **Aprovar/Suspender** clínicas
- **Criar nova clínica** manualmente
- **Logar como cliente** (impersonate) para visualizar o painel do cliente
- **Banner de impersonate** com botão "Voltar ao Admin"
- **Configurações** da Evolution API

### Rotas do Admin

| Rota | Descrição |
|------|-----------|
| `/admin/login` | Login do Super Admin |
| `/admin` | Dashboard administrativo |
| `/admin/clinics` | Lista de clínicas |
| `/admin/clinics/:id` | Detalhes da clínica |
| `/admin/settings` | Configurações globais |

---

## Integração WhatsApp - Evolution API

### Arquitetura Implementada

```
Frontend (React) ──► Evolution API ──► WhatsApp
       │                    │
       │                    │ Webhook (POST)
       ▼                    ▼
              Supabase
    (Database + Edge Functions + Realtime)
```

### Fluxo de Conexão

1. Cliente acessa página "Conectar WhatsApp"
2. Sistema cria instância automaticamente na Evolution API
3. Webhook é configurado para receber eventos
4. QR Code é exibido para escanear
5. Após escanear, status muda para "Conectado"
6. Mensagens recebidas são salvas automaticamente via webhook

### Configurações

| Configuração | Valor |
|--------------|-------|
| Evolution API URL | `https://evolutionaoi-evolution-api.v6hnnf.easypanel.host` |
| API Key Global | Armazenada na tabela `settings` |
| Webhook URL | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/evolution-webhook` |
| Nome da Instância | `leadcare_{clinic_id}` (automático) |

### Edge Function: evolution-webhook

Processa eventos da Evolution API:
- `qrcode.updated` - Atualiza QR Code no banco
- `connection.update` - Atualiza status de conexão
- `messages.upsert` - Salva mensagens recebidas

### Hooks Criados

| Hook | Descrição |
|------|-----------|
| `useWhatsApp` | Gerencia conexão, QR Code, status |
| `useChats` | Lista chats com filtro por clínica + Realtime |
| `useAuth` | Autenticação com Supabase |

---

### Fase 4: Inbox Avançada ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Respostas rápidas (modal) | ✅ Completo |
| Mensagens rápidas configuráveis (CRUD) | ✅ Completo |
| Auto-scroll para novas mensagens | ✅ Completo |
| Observações internas por chat | ✅ Completo |
| Seletor de emojis | ✅ Completo |
| Envio de mídia (imagens, vídeos, áudios, documentos) | ✅ Completo |
| Visualização de mídia recebida | ✅ Completo |
| Etiquetas configuráveis (CRUD) | ✅ Completo |
| Marcar como lido ao abrir conversa | ✅ Completo |
| Filtros de conversas (todos, não lidos, aguardando, grupos) | ✅ Completo |

### Novas Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `chat_notes` | Observações internas por conversa |
| `quick_replies` | Mensagens rápidas por clínica |

### Storage

| Bucket | Descrição |
|--------|-----------|
| `chat-media` | Armazenamento de mídias (imagens, vídeos, áudios, documentos) |

---

### Fase 5: Gestão Multi-Usuário e Faturamento ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Criação de usuários pelo SuperAdmin | ✅ Completo |
| Edge Function `create-user` (Supabase Admin API) | ✅ Completo |
| Edge Function `delete-user` (exclusão segura) | ✅ Completo |
| Modal de edição de usuário | ✅ Completo |
| Modal de confirmação de exclusão | ✅ Completo |
| Campo `view_mode` (shared/personal) | ✅ Completo |
| Painel compartilhado vs painel zerado | ✅ Completo |
| Bloqueio de conversa (quando alguém está respondendo) | ✅ Completo |
| Nome do atendente nas mensagens enviadas | ✅ Completo |
| Faturamento da clínica no Admin | ✅ Completo |
| Faturamento por atendente | ✅ Completo |

### Novas Tabelas/Campos

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `users` | `view_mode` | 'shared' (vê faturamento de todos) ou 'personal' (só vê o próprio) |
| `users` | `default_instance_id` | Instância WhatsApp padrão do usuário |
| `users` | `can_create_instance` | Se pode criar própria instância |
| `chats` | `locked_by` | ID do usuário que está respondendo |
| `chats` | `locked_at` | Timestamp do bloqueio |

### Edge Functions

| Função | Descrição |
|--------|-----------|
| `create-user` | Cria usuário via Supabase Admin API (apenas SuperAdmin) |
| `delete-user` | Exclui usuário do Auth (apenas SuperAdmin) |

### Funcionalidades de Multi-Usuário

#### View Mode (Painel Compartilhado/Zerado)
- **shared**: Usuário vê faturamento de TODOS os atendimentos da clínica
- **personal**: Usuário só vê faturamento dos atendimentos DELE (assigned_to = user.id)
- Todos veem TODAS as conversas da instância WhatsApp

#### Bloqueio de Conversa
- Quando um atendente abre uma conversa, ela fica bloqueada para ele
- Outro atendente vê: "🔒 [Nome] está respondendo esta conversa"
- Timeout de 5 minutos de inatividade
- Desbloqueio automático ao sair da conversa

#### Nome do Atendente nas Mensagens
- Mensagem enviada ao cliente: `*Evandro Morais:* Posso ajudar?`
- No painel interno: nome do atendente aparece acima de cada mensagem

#### Faturamento no Admin
- Cards: Faturamento Total, Faturamento do Mês, Total Conversões
- Tabela por atendente com breakdown individual
- Categoria "(Não atribuído)" para chats sem assigned_to

#### Atribuição Automática de Chats
- Quando um atendente responde um chat, ele é automaticamente atribuído a ele
- O faturamento vai para quem está atribuído ao chat
- Funciona junto com o bloqueio de conversa

#### Sincronização de Mensagens do Celular
- Mensagens enviadas diretamente do celular WhatsApp agora aparecem no painel
- Webhook atualizado para processar mensagens `fromMe = true`
- Mensagens enviadas aparecem do lado direito (como enviadas)

#### Filtro Follow-up
- Novo filtro na Caixa de Entrada para mensagens agendadas
- Mostra apenas chats onde o usuário tem follow-ups pendentes
- Exibe data e hora do agendamento: "📅 10/01 às 14:30"
- Cada usuário vê apenas seus próprios follow-ups

---

### Fase 6: Sistema de Permissões e Metas ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Sistema de permissões por perfil (Admin/Atendente) | ✅ Completo |
| Modal de configuração de permissões no AdminClinicDetail | ✅ Completo |
| Gerenciamento de instância WhatsApp no modal de edição de usuário | ✅ Completo |
| Sistema de encaminhamento de atendimento | ✅ Completo |
| Gráficos de Evolução e Metas (Meta vs Realizado) | ✅ Completo |
| Configuração de metas mensais por atendente | ✅ Completo |
| Visualização de meta para atendente no Dashboard | ✅ Completo |
| Checkbox "Pode ver meta" por atendente | ✅ Completo |
| Correção de áudio/imagem do WhatsApp | ✅ Completo |
| Polling fallback para Realtime | ✅ Completo |

### Sistema de Permissões

| Permissão | Admin | Atendente |
|-----------|-------|-----------|
| `send_message` | ✅ | ✅ |
| `move_lead` | ✅ | ✅ |
| `add_payment` | ✅ | ❌ |
| `add_quote` | ✅ | ✅ |
| `view_reports` | ✅ | ❌ |
| `manage_users` | ✅ | ❌ |
| `manage_tags` | ✅ | ❌ |
| `manage_quick_replies` | ✅ | ❌ |

### Sistema de Metas

- **Meta da Clínica**: Configurável pelo SuperAdmin no AdminClinicDetail
- **Meta por Atendente**: Cada atendente pode ter sua meta individual
- **Visualização**: Atendentes só veem sua meta se `can_see_goal = true`
- **Gráfico**: Meta vs Realizado com barra de progresso e previsão

### Encaminhamento de Atendimento

- Encaminhar conversa para outro atendente
- Opção de bloquear conversa para o destinatário
- Liberar conversa (remover bloqueio)
- Assumir atendimento

### Correção de Mídia do WhatsApp

- **Problema**: Áudios e imagens não apareciam no chat
- **Causa**: Mimetype `audio/ogg; codecs=opus` não aceito pelo Supabase Storage
- **Solução**: Usar mimetype simplificado `audio/ogg`
- **Fluxo**: Webhook busca base64 via API `getBase64FromMediaMessage` → Upload para Storage → Salva URL no banco

### Realtime com Polling Fallback

- **Problema**: `CHANNEL_ERROR` no Realtime do Supabase (plano gratuito)
- **Solução**: Polling automático a cada 5 segundos quando Realtime falha
- **Comportamento**: Se Realtime funcionar (`SUBSCRIBED`), polling é desativado

### Novas Tabelas/Campos

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `clinics` | `monthly_goal` | Meta mensal da clínica |
| `users` | `monthly_goal` | Meta mensal individual do atendente |
| `users` | `can_see_goal` | Se o atendente pode ver sua meta |
| `chats` | `assigned_to` | Atendente responsável pelo chat |
| `webhook_debug` | - | Tabela para debug de payloads do webhook |

### Edge Function: evolution-webhook (v13)

Melhorias implementadas:
- Busca mídia via API `getBase64FromMediaMessage`
- Upload de mídia para Supabase Storage
- Mimetype corrigido para compatibilidade
- Suporte a áudio, imagem, vídeo e documentos

---

### Fase 7: Sistema de Lançamentos e Melhorias Admin ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Sistema de Lançamentos (Receitas da Clínica) | ✅ Completo |
| Página `/receipts` para Financeiro/Admin | ✅ Completo |
| Múltiplas formas de pagamento por lançamento | ✅ Completo |
| Vinculação de lançamento a pagamento comercial | ✅ Completo |
| Dashboard do Comercial com vendas próprias | ✅ Completo |
| Card "Minhas Vendas Detalhadas" no Dashboard | ✅ Completo |
| Aba "Lançamentos" no AdminClinicDetail | ✅ Completo |
| Página SuperAdmins (`/admin/users`) | ✅ Completo |
| Campo Instância WhatsApp na criação de usuário | ✅ Completo |
| RLS atualizado para SuperAdmin ver receitas | ✅ Completo |

### Novas Tabelas

| Tabela | Descrição |
|--------|-----------|
| `clinic_receipts` | Lançamentos/receitas da clínica |
| `receipt_payments` | Formas de pagamento por lançamento |

### Sistema de Lançamentos

- **Página Lançamentos** (`/receipts`): Visível para Financeiro e Admin
- **Vincular a Pagamento**: Cada lançamento pode ser vinculado a um pagamento comercial
- **Múltiplas Formas**: PIX, Cartão Crédito, Cartão Débito, Dinheiro, Boleto, Transferência
- **Status Automático**: Pendente, Parcial, Recebido (baseado no valor recebido vs comercial)

### Dashboard do Comercial

- **Faturamento do Mês**: Mostra apenas vendas criadas pelo comercial logado
- **Faturamento Total**: Mostra apenas vendas criadas pelo comercial logado
- **Minhas Vendas Detalhadas**: Tabela com Cliente, Data, Origem, Valor Comercial, Recebido, Status

### Aba Lançamentos no Admin

- **Cards de Resumo**: Valor Comercial, Receita Clínica, ROI
- **Por Comercial**: Tabela com vendas, valor comercial, recebido e ROI por atendente
- **Detalhamento**: Lista completa de vendas com cliente, data, origem, comercial, valor, recebido e status

### Página SuperAdmins

- **Rota**: `/admin/users`
- **Funcionalidades**: Listar, Criar, Editar, Excluir SuperAdmins
- **Menu lateral**: Novo item "SuperAdmins" no painel admin

### Criação de Usuário com Instância

- **Campo opcional**: Seleção de instância WhatsApp ao criar usuário
- **Comportamento**: Sem instância = usuário só visualiza, não envia mensagens
- **Ideal para**: Perfis como Financeiro e Visualizador

---

## Próximos Passos (Fase 8)

| Funcionalidade | Status |
|----------------|--------|
| Relatórios avançados com exportação | 🔄 Pendente |
| Gestão de planos e assinaturas | 🔄 Pendente |
| Auto-registro de clínicas | 🔄 Pendente |
| Notificações push | 🔄 Pendente |
| Agendamentos integrados | 🔄 Pendente |
| Chatbot/IA para respostas automáticas | 🔄 Pendente |

---

## Licença

Este projeto é privado e de uso exclusivo.

---

## Desenvolvido por

**LeadCare** - CRM para Clínicas
React + TypeScript + Supabase
