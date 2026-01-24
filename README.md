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

### Fase 8: Tarefas, Follow-ups e Melhorias ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Hook `useTasks` para gerenciamento de tarefas | ✅ Completo |
| Dropdown de tarefas no sino de notificações | ✅ Completo |
| Seção de tarefas no Dashboard (Atrasadas, Hoje, Semana) | ✅ Completo |
| Seção de Follow-ups agendados no Dashboard | ✅ Completo |
| Botões de follow-up alterados para 1/3/7 dias | ✅ Completo |
| Cancelamento de negociações (manter registro) | ✅ Completo |
| Botão excluir em orçamentos | ✅ Completo |
| Botão voltar para pendente em orçamentos | ✅ Completo |
| Busca automática de foto de perfil do WhatsApp | ✅ Completo |

### Sistema de Tarefas

- **Hook `useTasks`**: Busca tarefas da clínica, filtra por data e permite marcar como concluída
- **Categorias**: Atrasadas (overdue), Hoje (todayTasks), Próximas (upcomingTasks), Semana (weekTasks)
- **Dropdown no Sino**: Mostra tarefas pendentes com badge de contagem
- **Dashboard**: Cards visuais para cada categoria de tarefa
- **Navegação**: Clique na tarefa leva direto para o chat relacionado

### Sistema de Follow-ups

- **Botões Rápidos**: 1 dia, 3 dias, 7 dias (antes era 30/60/90)
- **Seção no Dashboard**: Lista de follow-ups agendados com data/hora
- **Navegação**: Clique no follow-up leva para o chat

### Cancelamento de Negociações

- **Campo `status`**: Adicionado na tabela `payments` ('active' ou 'cancelled')
- **Botão Cancelar**: Marca a negociação como cancelada (não exclui)
- **Visual**: Negociações canceladas aparecem com fundo vermelho, valor riscado e badge "CANCELADO"
- **Total**: Só conta negociações ativas no total faturado

### Foto de Perfil do WhatsApp

- **Busca Automática**: Ao selecionar um chat sem foto, busca via Evolution API
- **Endpoint**: `POST /chat/fetchProfilePictureUrl/{instance}`
- **Armazenamento**: Salva no campo `avatar_url` do chat
- **Limitações**: Só funciona se o contato permitir visualização da foto

### Novas Tabelas/Campos

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `payments` | `status` | 'active' ou 'cancelled' |
| `tasks` | - | Tarefas vinculadas a chats |

### Novos Hooks

| Hook | Descrição |
|------|-----------|
| `useTasks` | Gerencia tarefas por clínica/usuário |

### Funções Adicionadas

| Arquivo | Função | Descrição |
|---------|--------|-----------|
| `useWhatsApp.ts` | `fetchProfilePicture` | Busca foto de perfil via Evolution API |
| `useChats.ts` | `fetchAndUpdateAvatar` | Busca e salva foto no banco |

---

### Fase 9: Funcionalidades Avançadas de Chat ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Cadastro/edição de cliente vinculado ao chat | ✅ Completo |
| Marcar conversa como lida (visual dinâmico) | ✅ Completo |
| Gravação e envio de áudio | ✅ Completo |
| Responder mensagem específica (quote/reply) | ✅ Completo |
| Reações com emoji nas mensagens | ✅ Completo |
| Status de entrega (enviado/entregue/lido) | ✅ Completo |
| Envio de quote para WhatsApp via Evolution API | ✅ Completo |
| Envio de reações para WhatsApp via Evolution API | ✅ Completo |

### Cadastro de Cliente

- **Botão dinâmico**: Ícone `person_add` (novo) ou `person` (existente)
- **Modal completa**: Nome, Email, CPF, Data Nascimento, Endereço, Observações
- **Vinculação**: Cliente vinculado à tabela `leads` e ao chat
- **Sincronização**: Nome do cliente atualiza automaticamente no chat

### Marcar como Lida

- **Visual dinâmico**: Ícone muda de `radio_button_unchecked` para `check_circle`
- **Cor**: Cinza (não lida) → Verde (lida)
- **Função**: Zera o `unread_count` do chat

### Gravação de Áudio

- **MediaRecorder API**: Gravação direta do navegador
- **UI de gravação**: Timer, botão cancelar, botão enviar
- **Formato**: OGG (compatível com WhatsApp)
- **Envio**: Via Evolution API `sendWhatsAppAudio`

### Responder Mensagem (Quote/Reply)

- **Botão reply**: Aparece ao passar mouse sobre mensagem
- **Preview**: Barra acima do input mostrando mensagem sendo respondida
- **Envio**: Parâmetro `quoted` na Evolution API com `key` e `message`
- **Exibição**: Quote aparece dentro da mensagem com borda lateral

### Reações com Emoji

- **Emojis disponíveis**: 👍 ❤️ 😂 😮 😢 🙏
- **Seletor**: Aparece ao clicar no ícone de reação
- **Toggle**: Clique adiciona, clique novamente remove
- **WhatsApp**: Reação enviada via `sendReaction` da Evolution API
- **Exibição**: Emojis aparecem abaixo da mensagem com contador

### Status de Entrega

- **Ícones**:
  - ✓ (cinza) = Enviado (`sent`)
  - ✓✓ (cinza) = Entregue (`delivered`)
  - ✓✓ (azul) = Lido (`read`)
- **Campo**: `delivery_status` na tabela `messages`

### Novas Tabelas/Campos

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `messages` | `quoted_message_id` | ID da mensagem sendo respondida |
| `messages` | `quoted_content` | Conteúdo da mensagem citada |
| `messages` | `quoted_sender_name` | Nome do remetente da mensagem citada |
| `messages` | `remote_message_id` | ID da mensagem no WhatsApp (para quote/reação) |
| `messages` | `delivery_status` | Status de entrega (sent/delivered/read) |
| `message_reactions` | - | Tabela de reações (message_id, user_id, emoji) |

### Edge Function: evolution-webhook (v14)

Melhorias implementadas:
- Salva `remote_message_id` (key.id) em cada mensagem recebida
- Permite quote e reações funcionarem corretamente

---

### Melhorias - 14/01/2026

| Funcionalidade | Descrição |
|----------------|-----------|
| Tooltips customizados na Inbox | Tooltips com cor cyan do tema e quebra de linha automática |
| Marcar como não lida | Botão para marcar conversa como não lida e sair |
| Skeleton loading | Lista de chats mostra skeleton em vez de "Carregando..." |
| Realtime via Broadcast | Webhook envia broadcast quando chega mensagem (mais estável) |
| Polling inteligente | Backup a cada 30s, não afeta scroll da lista |
| Chat sobe ao topo | Conversa com nova mensagem sobe automaticamente para o topo |
| Otimização useAuth | Evita buscas repetidas de perfil do usuário |

### Detalhes das Implementações - 14/01/2026

#### Tooltips Customizados
- **Antes**: Tooltips nativos pretos do navegador
- **Depois**: Tooltips com fundo cyan, texto branco, quebra de linha automática
- **Seções**: Etapa do Pipeline, Responsável, Origem, Etiquetas, Orçamentos, Negociações, Tarefas, Follow-up, Observações

#### Marcar como Não Lida
- **Função**: `markAsUnread` no hook `useChats`
- **Comportamento**: Seta `unread_count = 1` e sai da conversa
- **Ícone**: `mark_chat_unread` (verde) quando conversa está lida

#### Realtime via Broadcast (Solução para bug do Supabase)
- **Problema**: `postgres_changes` dava erro "mismatch between server and client bindings"
- **Solução**: Webhook envia broadcast após salvar mensagem
- **Canal**: `leadcare-updates`
- **Evento**: `new_message` com `clinic_id` e `chat_id`

#### Polling Inteligente
- **Intervalo**: 30 segundos (backup caso broadcast falhe)
- **Otimização**: Só atualiza se houver mudanças reais
- **Scroll**: Não afeta posição do scroll da lista de chats

### Arquivos Modificados - 14/01/2026

| Arquivo | Alteração |
|---------|-----------|
| `pages/Inbox.tsx` | Tooltips customizados, skeleton loading, marcar como não lida |
| `hooks/useChats.ts` | `markAsUnread`, Realtime via Broadcast, polling inteligente |
| `hooks/useAuth.tsx` | Evita buscas repetidas de perfil |
| `supabase/functions/evolution-webhook/index.ts` | Envia broadcast após salvar mensagem |

### Edge Function: evolution-webhook (v19)

Melhorias implementadas:
- Envia broadcast para canal `leadcare-updates` após salvar mensagem
- Payload inclui `clinic_id`, `chat_id` e `from_client`
- Cliente recebe notificação instantânea de nova mensagem

---

### Correções de Bug - 13/01/2026

| Correção | Descrição |
|----------|-----------|
| Erro 406 no envio de mensagens | Corrigido uso de `.single()` quando havia múltiplas instâncias WhatsApp |
| Instâncias órfãs | Removidas instâncias desconectadas do banco de dados |
| Políticas RLS | Simplificadas políticas da tabela `whatsapp_instances` |
| Logs do webhook | Adicionados logs detalhados para debug de mensagens |
| Captura de perfil | Webhook agora captura `profileName` e `phoneNumber` na conexão |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `pages/Inbox.tsx` | Substituído `.single()` por `.limit(1)` em 4 locais para busca de instância WhatsApp |
| `hooks/useChats.ts` | Melhorada busca de instância conectada com logs de debug |
| `supabase/functions/evolution-webhook/index.ts` | Adicionados logs detalhados e captura de dados de perfil |

### Causa Raiz do Problema

O erro 406 (Not Acceptable) ocorria porque o método `.single()` do Supabase retorna erro quando a query retorna mais de uma linha. Como a clínica tinha múltiplas instâncias WhatsApp (algumas desconectadas), a query falhava.

**Solução**: 
1. Alterado para `.eq('status', 'connected').limit(1)` para buscar apenas a instância conectada
2. Removidas instâncias órfãs do banco de dados
3. Simplificadas políticas RLS para evitar conflitos

---

### Melhorias - 13/01/2026 (Sessão 2)

| Funcionalidade | Descrição |
|----------------|-----------|
| Edição de mensagens WhatsApp | Preparação para editar mensagens enviadas (até 15 min) |
| Etapas Mentoria/Recorrente | Adicionadas ao CHECK constraint da tabela `chats` |
| Sincronização Inbox/Kanban | Kanban agora recarrega dados ao ser montado |
| Origens de Lead com Dr. vinculado | Permite criar mesma origem (ex: Instagram) para diferentes Drs |
| Dashboard com Dr. na origem | Exibe nome e cor do Dr. vinculado na tabela de leads por origem |

### Detalhes das Implementações

#### Edição de Mensagens WhatsApp
- **Preparação**: Salvando `remote_message_id` ao enviar mensagens
- **Função `editMessage`**: Implementada no hook `useChats`
- **UI**: Botão de editar aparece em mensagens enviadas (até 15 min)
- **Modal**: Interface para editar o texto da mensagem
- **Limitação**: Evolution API pode não suportar edição dependendo da versão

#### Etapas do Funil
- **Novas etapas**: "Mentoria" e "Recorrente" adicionadas
- **Banco**: CHECK constraint atualizado para aceitar novos valores
- **Kanban**: Colunas já existiam, agora funcionam corretamente

#### Origens de Lead
- **Constraint alterada**: De `UNIQUE(clinic_id, name)` para `UNIQUE(clinic_id, name, tag_id)`
- **Permite**: Criar "Instagram Dra Carol", "Instagram Dra Kamylle", etc.
- **Dashboard**: Mostra badge colorido com nome do Dr. ao lado da origem

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `hooks/useChats.ts` | Função `editMessage`, salvar `remote_message_id` |
| `pages/Inbox.tsx` | Estados de edição, modal, botão editar, salvar `remote_message_id` |
| `pages/Kanban.tsx` | `refetch()` ao montar componente |
| `pages/Dashboard.tsx` | Exibir `tag_name` e `tag_color` na tabela de origens |
| `supabase/functions/evolution-webhook/index.ts` | Salvar `remote_message_id` em mensagens recebidas |

### Migrações de Banco

| Migração | Descrição |
|----------|-----------|
| `add_mentoria_recorrente_to_chats_status` | Adiciona "Mentoria" e "Recorrente" ao CHECK constraint |
| `change_lead_sources_unique_constraint_to_include_tag` | Permite mesmo nome de origem com diferentes tags |

---

## Próximos Passos (Fase 10)

| Funcionalidade | Status |
|----------------|--------|
| Relatórios avançados com exportação | 🔄 Pendente |
| Gestão de planos e assinaturas | 🔄 Pendente |
| Auto-registro de clínicas | 🔄 Pendente |
| Notificações push | 🔄 Pendente |
| Agendamentos integrados | 🔄 Pendente |
| Chatbot/IA para respostas automáticas | 🔄 Pendente |

---

## Atualizações - 14/01/2026 (Noite)

### O que foi feito hoje à noite? 🌙

Fizemos várias melhorias importantes no sistema, focando em **deixar tudo bonito no celular** e preparar o app para ser **instalado como aplicativo**.

---

### 1. Telas Responsivas (Funcionam bem no celular) 📱

Todas essas telas agora se adaptam automaticamente ao tamanho da tela do celular:

| Tela | O que melhorou |
|------|----------------|
| **Detalhes da Clínica (Admin)** | Header, cards, abas, tabelas - tudo se ajusta no celular |
| **Aba Usuários** | Lista vira cards empilhados no celular |
| **Aba Métricas** | Ranking de atendentes vira cards no celular |
| **Aba Lançamentos** | Tabelas viram cards com informações organizadas |
| **Lista de SuperAdmins** | Tabela vira cards com avatar, nome e botões |
| **Configurações (Admin)** | Abas com scroll horizontal, campos menores |
| **Aba SEO** | Campos de upload empilhados no celular |
| **Aba Login** | Campos de imagem empilhados no celular |
| **Modal Criar SuperAdmin** | Botões empilhados, scroll interno |
| **Modal Criar Clínica** | Campos em grid, scroll interno |
| **Modal Criar Usuário** | Já estava responsivo |

**O que significa "responsivo"?**
- No computador: tabelas normais com várias colunas
- No celular: cards empilhados verticalmente, fáceis de ler e tocar

---

### 2. App Instalável no iPhone (PWA) 📲

Agora o Belitx pode ser **instalado no iPhone** como se fosse um aplicativo da App Store!

**Como instalar no iPhone:**
1. Abra o site no **Safari** (tem que ser Safari!)
2. Toque no botão de **Compartilhar** (quadrado com seta pra cima)
3. Role para baixo e toque em **"Adicionar à Tela de Início"**
4. Confirme o nome e toque em **"Adicionar"**

**O que acontece:**
- Ícone do Belitx aparece na tela inicial do iPhone
- Abre em tela cheia (sem barra do Safari)
- Funciona offline para páginas já visitadas

**Arquivos criados:**
- `public/manifest.json` - Configurações do app (nome, ícone, cores)
- `public/sw.js` - Service Worker (permite funcionar offline)
- `index.html` - Adicionadas tags especiais para iOS

---

### 3. Resumo Técnico (Para desenvolvedores)

**Arquivos modificados:**
| Arquivo | Alteração |
|---------|-----------|
| `pages/admin/AdminClinicDetail.tsx` | Responsividade completa de todas as abas |
| `pages/admin/AdminUsers.tsx` | Header, tabela e modais responsivos |
| `pages/admin/AdminSettings.tsx` | Tabs e cards responsivos |
| `pages/admin/AdminClinics.tsx` | Modal de criar clínica responsivo |
| `index.html` | Meta tags PWA, manifest, service worker |
| `public/manifest.json` | Novo arquivo - configuração PWA |
| `public/sw.js` | Novo arquivo - cache offline |

**Técnicas usadas:**
- Tailwind CSS com breakpoints (`sm:`, `md:`)
- `hidden md:block` para mostrar tabela só no desktop
- `md:hidden` para mostrar cards só no mobile
- `flex-col sm:flex-row` para empilhar/alinhar elementos
- `overflow-x-auto` para scroll horizontal em tabelas
- `max-h-[90vh]` para modais não passarem da tela

---

### Próximos Passos (Futuro)

**Opção para App na App Store (Capacitor):**
- Transforma o React em app nativo iOS
- Precisa de Mac + conta Apple Developer ($99/ano)
- Permite notificações push e acesso a recursos nativos
- Será feito em outro momento

---

## Atualizações - 20/01/2026

### 📱 Atualização 1: Integração WhatsApp Melhorada

#### O que mudou?

Melhoramos a integração do WhatsApp com o painel.

#### ❌ Antes
- Só apareciam conversas quando o **cliente** enviava primeiro
- Contatos adicionados manualmente no celular não apareciam no sistema

#### ✅ Agora
- **Todas as conversas aparecem**, independente de quem iniciou
- Contato novo adicionado no celular já aparece automaticamente
- Status "Em Atendimento" quando você inicia, "Novo Lead" quando o cliente inicia
- `instance_id` agora é salvo em novos chats para rastreamento

#### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/evolution-webhook/index.ts` | Removido bloqueio de `isFromMe`, adicionado `instance_id` ao criar chat |

#### Edge Function: evolution-webhook (v20)

- Cria chat mesmo quando atendente inicia conversa (`isFromMe = true`)
- Status automático: "Em Atendimento" (atendente iniciou) ou "Novo Lead" (cliente iniciou)
- Associa `instance_id` ao chat para rastreamento de instância

---

### 📊 Atualização 2: Novo Menu "Relatórios"

#### O que é?

Um novo menu para **análise financeira** da clínica, separado do menu Lançamentos.

#### 👥 Quem tem acesso?
- 👑 SuperAdmin
- 👑 Admin
- 📋 Gerente
- 💰 Financeiro

#### 📈 O que você vai encontrar?

- **🟠 Valor Comercial** — Total fechado pelos vendedores
- **🟢 Receita Clínica** — Total recebido pela clínica
- **🟣 ROI** — Retorno sobre vendas (%)
- **👤 Por Comercial** — Ranking dos vendedores com vendas, valores e ROI individual
- **📝 Detalhamento** — Lista completa de todas as vendas com cliente, data, origem e status
- **🔍 Filtros** — Por período, origem ou vendedor
- **📥 Exportar** — Baixar relatório em CSV (planilha)

#### 🔄 Diferença dos menus

- **💳 Lançamentos** → Registrar recebimentos nas vendas
- **📊 Relatórios** → Visualizar e analisar dados

#### Arquivos Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `pages/Reports.tsx` | **NOVO** - Página de Relatórios Financeiros |
| `lib/permissions.ts` | Adicionado `reports` ao MenuPage e permissões dos perfis |
| `components/Layout.tsx` | Adicionado menu "Relatórios" com ícone `analytics` |
| `App.tsx` | Adicionada rota `/reports` |

#### Novas Permissões

| Perfil | Acesso a Relatórios |
|--------|---------------------|
| SuperAdmin | ✅ |
| Admin | ✅ |
| Gerente | ✅ |
| Financeiro | ✅ |
| Supervisor | ❌ |
| Comercial | ❌ |
| Recepcionista | ❌ |
| Visualizador | ❌ |

---

## Licença

Este projeto é privado e de uso exclusivo.

---

## Fase 10: WhatsApp Cloud API ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Suporte a WhatsApp Cloud API (oficial Meta) | ✅ Completo |
| Toggle de provedor (Evolution vs Cloud API) no Admin | ✅ Completo |
| Configuração de credenciais Cloud API | ✅ Completo |
| Webhook para receber mensagens Cloud API | ✅ Completo |
| Edge Function para envio de mensagens Cloud API | ✅ Completo |
| Download automático de mídia Cloud API | ✅ Completo |
| Suporte a reações via Cloud API | ✅ Completo |
| Templates de mensagens (sincronização do Meta) | ✅ Completo |
| Envio em massa com templates | ✅ Completo |
| Toggle "Permitir Cloud API" por clínica | ✅ Completo |
| Configuração de Cloud API no painel do cliente | ✅ Completo |

### WhatsApp Cloud API vs Evolution API

| Aspecto | Evolution API | Cloud API |
|---------|---------------|-----------|
| **Conexão** | QR Code | Token permanente |
| **Estabilidade** | Pode desconectar | 99.9% uptime |
| **Risco de banimento** | Alto | Zero (oficial) |
| **Envio em massa** | Limitado | Permitido com templates |
| **Custo** | Gratuito | ~R$ 0,25-0,50/msg |

### Novas Tabelas

| Tabela | Descrição |
|--------|-----------|
| `whatsapp_templates` | Templates de mensagens sincronizados do Meta |
| `mass_message_campaigns` | Campanhas de envio em massa |
| `mass_message_recipients` | Destinatários de cada campanha |

### Novos Campos em `clinics`

| Campo | Descrição |
|-------|-----------|
| `whatsapp_provider` | 'evolution' ou 'cloud_api' |
| `cloud_api_enabled` | Se Admin/Gerente pode configurar Cloud API |
| `cloud_api_phone_number_id` | ID do número no Meta |
| `cloud_api_access_token` | Token de acesso |
| `cloud_api_waba_id` | WhatsApp Business Account ID |
| `cloud_api_verify_token` | Token de verificação do webhook |

### Edge Functions

| Função | Descrição |
|--------|-----------|
| `whatsapp-cloud-webhook` | Recebe mensagens da Cloud API |
| `cloud-api-send` | Envia mensagens via Cloud API |
| `cloud-api-templates` | Sincroniza e envia templates |

### Fluxo de Configuração

1. SuperAdmin ativa "Permitir Cloud API" na clínica
2. Admin/Gerente acessa Configurações
3. Preenche credenciais do Meta (Phone Number ID, WABA ID, Access Token)
4. Configura webhook no Meta Business Suite
5. Sincroniza templates aprovados
6. Pode fazer envio em massa

### Detalhes das Edge Functions

#### `whatsapp-cloud-webhook`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook`
**JWT:** Desabilitado (necessário para webhook da Meta)

Recebe eventos da API oficial do WhatsApp:
- Mensagens de texto, imagem, vídeo, áudio, documento, sticker, localização, contato
- Respostas de botões e listas interativas
- Status de entrega (sent, delivered, read, failed)
- Reações a mensagens

**Configuração no Meta Business Suite:**
```
Webhook URL: https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/whatsapp-cloud-webhook
Verify Token: (valor do campo cloud_api_verify_token da clínica)
Campos: messages, message_status
```

#### `cloud-api-send`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/cloud-api-send`
**JWT:** Habilitado

Ações disponíveis:
| Action | Descrição | Parâmetros |
|--------|-----------|------------|
| `send_text` | Enviar texto | `phone`, `message` |
| `send_image` | Enviar imagem | `phone`, `media_url`, `caption` |
| `send_video` | Enviar vídeo | `phone`, `media_url`, `caption` |
| `send_audio` | Enviar áudio | `phone`, `media_url` |
| `send_document` | Enviar documento | `phone`, `media_url`, `caption` |
| `send_reaction` | Enviar reação | `phone`, `message_id`, `emoji` |
| `send_template` | Enviar template | `phone`, `template_name`, `template_language`, `template_components` |
| `send_location` | Enviar localização | `phone`, `latitude`, `longitude`, `name`, `address` |
| `send_contacts` | Enviar contato | `phone`, `contacts` |
| `mark_as_read` | Marcar como lida | `message_id` |

**Exemplo de uso:**
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

#### `cloud-api-templates`
**URL:** `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/cloud-api-templates`
**JWT:** Habilitado

Ações disponíveis:
| Action | Descrição | Parâmetros |
|--------|-----------|------------|
| `sync_templates` | Sincronizar templates do Meta | - |
| `list_templates` | Listar templates do banco | - |
| `send_template` | Enviar template individual | `phone`, `template_name`, `variables`, `header_params`, `button_params` |
| `send_bulk_template` | Envio em massa | `phones[]`, `template_name`, `variables_map` |

**Exemplo de envio em massa:**
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

### Coexistência WhatsApp Celular + Cloud API

| Cenário | Possível? | Observação |
|---------|-----------|------------|
| Cloud API + WhatsApp Business **mesmo número** | ❌ Não | Meta bloqueia |
| Cloud API + WhatsApp Business **números diferentes** | ✅ Sim | Cada canal funciona separado |
| Migrar número do celular para Cloud API | ✅ Sim | Requer aprovação do app |

**Importante:** Para usar coexistência (número ativo no celular + Cloud API), o app precisa estar aprovado na Meta.

---

## Fase 11: Integração Multi-Canal (Instagram + Facebook) ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Ícones de canal no Inbox (WhatsApp, Instagram, Facebook) | ✅ Completo |
| Toggle "Permitir Instagram" no Admin | ✅ Completo |
| Toggle "Permitir Facebook" no Admin | ✅ Completo |
| Configuração de credenciais Instagram (Page ID, Access Token) | ✅ Completo |
| Configuração de credenciais Facebook (Page ID, Access Token) | ✅ Completo |
| Cards de status no Settings do cliente | ✅ Completo |
| Filtro de conversas por canal | ✅ Completo |
| Ícones desabilitados (cinza) quando não habilitado | ✅ Completo |

### Novos Campos em `clinics`

| Campo | Descrição |
|-------|-----------|
| `instagram_enabled` | Se integração Instagram está habilitada |
| `instagram_page_id` | ID da página do Instagram |
| `instagram_access_token` | Token de acesso do Instagram |
| `facebook_enabled` | Se integração Facebook está habilitada |
| `facebook_page_id` | ID da página do Facebook |
| `facebook_access_token` | Token de acesso do Facebook |

### Novos Campos em `chats` e `messages`

| Campo | Descrição |
|-------|-----------|
| `channel` | Canal da conversa/mensagem: 'whatsapp', 'instagram', 'facebook' |

### Visual do Inbox

```
[💬] [📸] [📘]  ← Ícones pequenos e redondos no topo
  ↑     ↑    ↑
verde cinza cinza (quando desabilitados)
verde rosa  azul  (quando habilitados e ativos)
```

### Fluxo de Configuração

1. SuperAdmin ativa "Permitir Instagram" ou "Permitir Facebook"
2. SuperAdmin preenche Page ID e Access Token
3. Cliente vê ícones coloridos no Inbox
4. Cliente clica no ícone para ver conversas daquele canal

### Benefícios

- **Centralizado**: Todas as mensagens em um só lugar
- **Rápido**: Troca de canal com um clique
- **Controlado**: Admin decide quais canais cada cliente pode usar
- **Visual**: Ícones indicam claramente qual canal está ativo

### Permissão de Configuração pelo Cliente

| Campo | Descrição |
|-------|-----------|
| `instagram_client_can_configure` | Se cliente pode editar credenciais do Instagram |
| `facebook_client_can_configure` | Se cliente pode editar credenciais do Facebook |

**Comportamento no Settings do Cliente:**

| Situação | O que aparece |
|----------|---------------|
| Habilitado + Cliente pode configurar | Campos editáveis (Page ID, Access Token) + botão Salvar |
| Habilitado + Cliente NÃO pode configurar | Apenas status ("Configurado" ou "Aguardando") |
| Não habilitado | Não aparece nada |

---

## Atualizações - 22/01/2026 (Noite)

### Resumo das Melhorias 🚀

Nesta atualização implementamos **4 grandes melhorias** no sistema LeadCare.

---

### 1. Suporte a Grupos do WhatsApp 📱

**O que é?**
Agora o LeadCare consegue receber e enviar mensagens em **grupos do WhatsApp**, não apenas em conversas individuais.

**Como funciona?**
- Os grupos aparecem automaticamente na aba **"Grupos"** ao lado de "Todos", "Não lidos" e "Aguardando"
- Você pode enviar mensagens nos grupos da mesma forma que envia para clientes individuais
- Os grupos são sincronizados automaticamente quando você abre o painel
- Grupos têm um ícone verde de pessoas ao lado do nome

**Como usar?**
1. Abra o **Inbox** (Caixa de Entrada)
2. Clique no botão **"Grupos"** nos filtros
3. Selecione o grupo desejado
4. Envie mensagens normalmente

**Arquivos modificados:**
- `supabase/functions/evolution-webhook/index.ts` - Processar mensagens de grupos
- `hooks/useChats.ts` - Query com campos `is_group` e `group_id`
- `pages/Inbox.tsx` - Filtro de grupos, ícone, envio para grupos

**Migração de banco:**
- Campos `is_group` (boolean) e `group_id` (text) na tabela `chats`

---

### 2. Fixar Conversas 📌

**O que é?**
Agora você pode **fixar conversas importantes** no topo da lista para não perder de vista.

**Como funciona?**
- Passe o mouse sobre uma conversa e clique no ícone de **pin**
- A conversa vai para o topo da lista e fica lá mesmo quando outras mensagens chegam
- Clique novamente para desafixar

**Arquivos modificados:**
- `hooks/useChats.ts` - Função `togglePinChat`, ordenação por `is_pinned`
- `pages/Inbox.tsx` - Botão de pin, ícone visual

**Migração de banco:**
- Campo `is_pinned` (boolean) na tabela `chats`

---

### 3. Sincronização de Leitura WhatsApp ↔ Painel 🔄

**O que é?**
Agora quando você **responde pelo celular**, o contador de mensagens não lidas no painel é zerado automaticamente. E quando você **responde pelo painel**, o contador no celular também é zerado.

**Como funciona?**

| Ação | Resultado |
|------|-----------|
| Respondeu pelo **celular** | Painel zera o contador automaticamente |
| Respondeu pelo **painel** | WhatsApp do celular zera o contador |

**Configuração:**
- `readMessages: true` ativado automaticamente em novas instâncias
- Configurado via `POST /settings/set/{instance}` na Evolution API

**Arquivos modificados:**
- `supabase/functions/evolution-webhook/index.ts` - Zerar `unread_count` quando `fromMe=true`
- `hooks/useWhatsApp.ts` - Ativar `readMessages` ao criar instância
- `hooks/useChats.ts` - Marcar como lido no WhatsApp via API

---

### 4. Integração Facebook Conversions API 📊

**O que é?**
Quando você marca um lead como **"Convertido"**, o sistema envia automaticamente um evento de **compra (Purchase)** para o Facebook Ads, permitindo rastrear conversões e otimizar campanhas.

**Como funciona?**
1. Atendente clica em **"Convertido"** no funil
2. Sistema verifica se tem valor registrado (orçamento aprovado ou pagamento)
3. **Se tem valor**: Muda status e envia evento ao Facebook
4. **Se NÃO tem valor**: Abre modal pedindo o valor antes de converter

**Configuração (Admin):**
1. Acesse `/admin` → Clique na clínica
2. Role até **"Facebook Conversions API"**
3. Preencha:
   - **Dataset ID (Pixel ID)**: ID do pixel do Facebook
   - **Token da API**: Token de acesso do Facebook

**O que é enviado ao Facebook?**
- **Evento**: Purchase (Compra)
- **Valor**: Valor do orçamento/pagamento em BRL
- **Telefone**: Hasheado em SHA256 para privacidade
- **Endpoint**: `POST https://graph.facebook.com/v18.0/{dataset_id}/events`

**Arquivos modificados:**
- `pages/admin/AdminClinicDetail.tsx` - Seção de configuração Facebook
- `pages/Inbox.tsx` - Função `sendFacebookConversionEvent`, modal de valor

**Migração de banco:**
- Campos `facebook_dataset_id` e `facebook_api_token` na tabela `clinics`

---

### Resumo Técnico

| Funcionalidade | Arquivos Modificados | Migração |
|----------------|---------------------|----------|
| Grupos WhatsApp | `evolution-webhook`, `useChats.ts`, `Inbox.tsx` | `is_group`, `group_id` |
| Fixar Conversas | `useChats.ts`, `Inbox.tsx` | `is_pinned` |
| Sincronização Leitura | `evolution-webhook`, `useChats.ts`, `useWhatsApp.ts` | - |
| Facebook Conversions | `AdminClinicDetail.tsx`, `Inbox.tsx` | `facebook_dataset_id`, `facebook_api_token` |

---

## Fase 10: Sistema de Suporte ao Cliente ✅ COMPLETA

### Visão Geral

Sistema completo de suporte ao cliente com **chat ao vivo** e **tickets de suporte**, permitindo comunicação em tempo real entre clínicas e equipe de suporte.

### Funcionalidades Implementadas

| Funcionalidade | Status |
|----------------|--------|
| Página de Suporte do Cliente (`/support`) | ✅ Completo |
| Painel de Suporte Admin (`/suporte`) | ✅ Completo |
| Chat ao Vivo (quando suporte online) | ✅ Completo |
| Sistema de Tickets (quando suporte offline) | ✅ Completo |
| Categorias de Tickets (Suporte, Melhorias, Bug, Dúvida, Outro) | ✅ Completo |
| Realtime via Supabase (mensagens instantâneas) | ✅ Completo |
| Notificação sonora para novos tickets/mensagens | ✅ Completo |
| Notificação do navegador (browser notification) | ✅ Completo |
| Emoji Picker no chat | ✅ Completo |
| Mensagens Rápidas (Quick Replies) | ✅ Completo |
| Filtro por tipo (Chat ao Vivo / Ticket) | ✅ Completo |
| Diferenciação visual (cores) entre Chat e Ticket | ✅ Completo |
| Menu Suporte aparece em tempo real | ✅ Completo |
| Chat flutuante aparece em tempo real | ✅ Completo |

### Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Clínica)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /support - Página de Suporte                           │   │
│  │  ├── Chat Flutuante (quando suporte ONLINE)             │   │
│  │  ├── Botão Novo Ticket (quando suporte OFFLINE)         │   │
│  │  ├── Lista de Tickets com filtros                       │   │
│  │  └── Visualização de mensagens                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Realtime
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ support_tickets │  │support_messages │  │    settings    │  │
│  │ - id            │  │ - id            │  │ support_online │  │
│  │ - clinic_id     │  │ - ticket_id     │  │support_enabled │  │
│  │ - user_id       │  │ - sender_id     │  └────────────────┘  │
│  │ - subject       │  │ - content       │                      │
│  │ - status        │  │ - is_from_support│                     │
│  │ - category      │  │ - read_at       │                      │
│  │ - is_live_chat  │  │ - created_at    │                      │
│  │ - priority      │  └─────────────────┘                      │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Realtime
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPORTE (SuperAdmin)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /suporte - Painel de Suporte                           │   │
│  │  ├── Toggle Online/Offline                              │   │
│  │  ├── Toggle Habilitar/Desabilitar Suporte               │   │
│  │  ├── Lista de Tickets (todos as clínicas)               │   │
│  │  ├── Filtros por Status e Tipo                          │   │
│  │  ├── Emoji Picker + Quick Replies                       │   │
│  │  └── Notificações sonoras e do navegador                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `support_tickets` | Tickets de suporte (id, clinic_id, user_id, subject, status, category, is_live_chat, priority, assigned_to) |
| `support_messages` | Mensagens dos tickets (id, ticket_id, sender_id, content, is_from_support, read_at) |
| `support_quick_replies` | Mensagens rápidas do suporte (id, title, content, category, shortcut, is_active, sort_order) |
| `settings` | Configurações globais (support_enabled, support_online) |
| `clinics` | Campo `support_enabled` por clínica |

### Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `hooks/useSupport.ts` | Hook principal com toda lógica de suporte |
| `pages/Support.tsx` | Página do cliente para abrir tickets/chat |
| `pages/SupportPanel.tsx` | Painel do SuperAdmin para gerenciar suporte |
| `components/EmojiPicker.tsx` | Seletor de emojis por categorias |
| `components/QuickReplies.tsx` | Mensagens rápidas com busca e categorias |
| `components/Layout.tsx` | Menu dinâmico (mostra/esconde Suporte em tempo real) |

### Hook useSupport

```typescript
const {
  tickets,              // Lista de tickets
  messages,             // Mensagens do ticket selecionado
  selectedTicket,       // Ticket atualmente selecionado
  setSelectedTicket,    // Selecionar ticket
  loading,              // Estado de carregamento
  supportSettings,      // { support_enabled, support_online }
  clinicSupportEnabled, // Se a clínica tem suporte habilitado
  createTicket,         // Criar novo ticket
  sendMessage,          // Enviar mensagem
  markMessagesAsRead,   // Marcar como lidas
  updateTicketStatus,   // Atualizar status (open, in_progress, resolved, closed)
  assignTicket,         // Atribuir a um agente
  toggleSupportOnline,  // Alternar online/offline
  toggleSupportEnabled, // Habilitar/desabilitar suporte
  fetchTickets,         // Recarregar tickets
  fetchMessages,        // Recarregar mensagens
} = useSupport(clinicId, userId);
```

### Fluxo de Funcionamento

#### 1. Cliente abre página de Suporte
- Se `support_online = true`: Mostra chat flutuante para conversa em tempo real
- Se `support_online = false`: Mostra botão "Novo Ticket" para abrir formulário

#### 2. Criação de Ticket
- **Chat ao Vivo**: `is_live_chat = true`, assunto automático "Chat ao Vivo"
- **Ticket Normal**: `is_live_chat = false`, cliente escolhe categoria e assunto

#### 3. Diferenciação Visual
- **Chat ao Vivo**: Borda verde, badge verde com ícone de chat
- **Ticket Normal**: Borda laranja, badge laranja com ícone de ticket

#### 4. Realtime
- Subscriptions em `support_tickets`, `support_messages` e `settings`
- Mensagens aparecem instantaneamente sem refresh
- Menu "Suporte" aparece/desaparece em tempo real
- Chat flutuante aparece/desaparece em tempo real

### Categorias de Tickets

| Categoria | Valor | Ícone | Cor |
|-----------|-------|-------|-----|
| Suporte | `support` | support_agent | cyan |
| Melhorias | `improvement` | lightbulb | purple |
| Bug/Erro | `bug` | bug_report | red |
| Dúvida | `question` | help | blue |
| Outro | `other` | more_horiz | slate |

### Status de Tickets

| Status | Label | Cor |
|--------|-------|-----|
| `open` | Aberto | Amarelo |
| `in_progress` | Em Andamento | Azul |
| `resolved` | Resolvido | Verde |
| `closed` | Fechado | Cinza |

### Mensagens Rápidas (Quick Replies)

Categorias pré-definidas:
- **Saudações** (`greeting`): Boas-vindas, cumprimentos
- **Encerramentos** (`closing`): Despedidas, agradecimentos
- **Informações** (`info`): Respostas informativas
- **Problemas** (`problem`): Respostas para bugs/erros
- **Gerais** (`general`): Respostas genéricas

### Correções de Bugs Implementadas

| Bug | Solução |
|-----|---------|
| Mensagem duplicada ao enviar (Enter) | Trocado `onKeyPress` por `onKeyDown` |
| Mensagem duplicada ao receber | Verificação `prev.some(m => m.id === newMessage.id)` antes de adicionar |
| Menu não aparecia em tempo real | Subscription em `settings` no Layout.tsx |

---

## Desenvolvido por

**LeadCare** - CRM para Clínicas
React + TypeScript + Supabase
