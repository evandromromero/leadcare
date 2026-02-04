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

## Fase 10: Integração Multi-Canal (Facebook + Instagram) ✅ PARCIALMENTE COMPLETA

### Status da Integração

| Funcionalidade | Status |
|----------------|--------|
| OAuth do Facebook (Login com Facebook) | ✅ Completo |
| Receber mensagens do Messenger | ✅ Completo |
| Enviar mensagens pelo Messenger | ✅ Completo |
| OAuth do Instagram (Login com Instagram) | ✅ Completo |
| Assinatura automática de webhook (Facebook) | ✅ Completo |
| Assinatura automática de webhook (Instagram) | ✅ Completo |
| Receber mensagens do Instagram Direct | ⚠️ Requer aprovação da Meta |
| Enviar mensagens pelo Instagram Direct | ⚠️ Requer aprovação da Meta |

### Edge Functions Criadas

| Função | Versão | Descrição |
|--------|--------|-----------|
| `facebook-oauth-callback` | v9 | Processa OAuth do Facebook, busca páginas, Instagram vinculado, assina webhooks |
| `instagram-oauth-callback` | v2 | Processa OAuth do Instagram com Login do Instagram, assina webhook |
| `meta-webhook` | v9 | Recebe eventos do Facebook e Instagram (mensagens, status, etc) |

### URLs para Meta for Developers

| Configuração | URL |
|--------------|-----|
| URI de Redirecionamento OAuth (Facebook) | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/facebook-oauth-callback` |
| URI de Redirecionamento OAuth (Instagram) | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/instagram-oauth-callback` |
| URL do Webhook | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/meta-webhook` |
| Token de Verificação | `belitx_meta_webhook_2024` |

### Colunas na tabela `clinics` (Meta)

| Campo | Descrição |
|-------|-----------|
| `facebook_page_id` | ID da página do Facebook |
| `facebook_page_name` | Nome da página |
| `facebook_page_access_token` | Token da página (longa duração) |
| `facebook_user_access_token` | Token do usuário (longa duração) |
| `facebook_enabled` | Boolean - Facebook ativo |
| `instagram_business_account_id` | ID da conta Instagram Business |
| `instagram_username` | Username do Instagram (@usuario) |
| `instagram_access_token` | Token do Instagram (longa duração) |
| `instagram_enabled` | Boolean - Instagram ativo |
| `instagram_connected_at` | Timestamp da conexão do Instagram |
| `meta_connected_at` | Timestamp da conexão do Facebook |

### Colunas na tabela `settings` (Credenciais do App)

| Campo | Descrição |
|-------|-----------|
| `meta_app_id` | ID do App no Meta for Developers |
| `meta_app_secret` | Chave secreta do App |
| `instagram_app_id` | ID do App do Instagram (pode ser o mesmo) |
| `instagram_app_secret` | Chave secreta do Instagram |

### Permissões Necessárias do App

| Permissão | Descrição | Status |
|-----------|-----------|--------|
| `pages_show_list` | Listar páginas do usuário | ✅ Disponível |
| `pages_messaging` | Enviar/receber mensagens do Messenger | ✅ Disponível |
| `pages_manage_metadata` | Gerenciar metadados da página | ✅ Disponível |
| `instagram_basic` | Acesso básico ao Instagram | ✅ Disponível |
| `instagram_manage_messages` | Enviar/receber mensagens do Instagram Direct | ⚠️ Requer aprovação |

### Fluxo de Conexão

```
1. Cliente clica em "Conectar Facebook" ou "Conectar Instagram"
2. Popup abre com OAuth da Meta/Instagram
3. Usuário autoriza o app
4. Callback processa o código e obtém tokens
5. Tokens são convertidos para longa duração (60 dias)
6. Páginas/contas são buscadas automaticamente
7. Webhooks são assinados automaticamente
8. Dados são salvos no banco
9. Popup fecha e página atualiza
```

### O que falta para Instagram funcionar

1. **Solicitar aprovação da permissão `instagram_manage_messages`** no Meta for Developers
2. **Passar pelo processo de revisão do App** (Business Verification)
3. **Colocar o App em modo Live** (não desenvolvimento)

**Alternativa para testes:**
- Adicionar a conta do Instagram como **Testador** no App
- Aceitar o convite na conta do Instagram
- Funciona apenas para testadores em modo de desenvolvimento

### Arquivos Criados/Modificados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/facebook-oauth-callback/index.ts` | OAuth Facebook + assinatura webhook Instagram |
| `supabase/functions/instagram-oauth-callback/index.ts` | OAuth Instagram com Login do Instagram |
| `supabase/functions/meta-webhook/index.ts` | Webhook para Facebook e Instagram |
| `pages/Integrations.tsx` | UI de conexão Facebook/Instagram |
| `pages/admin/AdminIntegrations.tsx` | Configuração das credenciais do App |

---

## Próximos Passos (Pendentes)

| Funcionalidade | Status | Prioridade |
|----------------|--------|------------|
| Aprovação `instagram_manage_messages` pela Meta | 🔄 Pendente | Alta |
| Funcionalidade de excluir conversa | 🔄 Pendente | Média |
| Relatórios avançados com exportação | 🔄 Pendente | Média |
| Gestão de planos e assinaturas | 🔄 Pendente | Baixa |
| Auto-registro de clínicas | 🔄 Pendente | Baixa |
| Notificações push | 🔄 Pendente | Baixa |
| Agendamentos integrados | 🔄 Pendente | Baixa |
| Chatbot/IA para respostas automáticas | 🔄 Pendente | Baixa |

---

## Atualizações - 29/01/2026 (Madrugada)

### O que foi feito hoje? 🌙

Implementamos a **Integração Multi-Canal com Facebook e Instagram**:

1. **Facebook/Messenger** - Funcionando 100%
   - OAuth com popup
   - Assinatura automática de webhook
   - Receber e enviar mensagens em tempo real

2. **Instagram Direct** - Estrutura pronta, aguardando aprovação da Meta
   - OAuth separado (Login com Instagram)
   - Assinatura automática de webhook
   - Webhook preparado para processar mensagens
   - **Bloqueio**: Permissão `instagram_manage_messages` requer aprovação

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

## Atualizações - 25/01/2026

### Dashboard - Leads por Origem

| Funcionalidade | Descrição |
|----------------|-----------|
| Coluna "Receita Clínica" | Nova coluna mostrando receita de `clinic_receipts` por origem |
| Coluna "Total" | Soma de Comercial + Receita Clínica por origem |
| Filtros de Período | Botões "Todos", "7 dias", "30 dias", "Este mês" |
| Filtro de Origens | Dropdown multi-select para filtrar origens específicas |

#### Detalhes da Implementação

**Interface `LeadSourceStats` atualizada:**
```typescript
interface LeadSourceStats {
  id: string;
  name: string;
  code: string | null;
  color: string;
  total_leads: number;
  converted_leads: number;
  revenue: number;        // Valor Comercial (payments)
  clinic_revenue: number; // Receita Clínica (clinic_receipts)
  tag_name: string | null;
  tag_color: string | null;
}
```

**Filtros de Período:**
- `all` - Todos os dados
- `7d` - Últimos 7 dias (baseado em `created_at` dos chats e `payment_date` dos payments)
- `30d` - Últimos 30 dias
- `month` - Mês atual

**Filtro de Origens:**
- Dropdown com checkboxes para cada origem
- Mostra cor e tag de cada origem
- Botão "Limpar" para resetar filtro
- Totais recalculados baseado nas origens selecionadas

### Métricas - Correção do Tempo Médio de Resposta

| Bug | Solução |
|-----|---------|
| Tempo de Resposta mostrando 0 min | Campo `from_me` não existe, corrigido para `is_from_client` |

**Correção aplicada em `Metrics.tsx`:**
```typescript
// Antes (errado):
.select('chat_id, created_at, from_me')
const firstClientMsg = msgs.find(m => !m.from_me);

// Depois (correto):
.select('chat_id, created_at, is_from_client')
const firstClientMsg = msgs.find(m => m.is_from_client === true);
const firstResponse = msgs.find(m => m.is_from_client === false && ...);
```

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `pages/Dashboard.tsx` | Coluna Receita Clínica, coluna Total, filtros de período e origens |
| `pages/Metrics.tsx` | Correção do campo `from_me` para `is_from_client` |

---

## Análise de Melhorias Futuras - Inbox

### Melhorias de UX Identificadas

| Melhoria | Complexidade | Impacto | Status |
|----------|--------------|---------|--------|
| Busca dentro da conversa | 🟢 Baixa | 🔴 Alto | Pendente |
| Atalhos de teclado (Esc, Ctrl+K) | 🟢 Baixa | 🟡 Médio | Pendente |
| Paginação/Lazy loading de chats | 🟡 Média | 🔴 Alto | Pendente |
| Indicador de digitação | 🟡 Média | 🟡 Médio | Pendente |
| Preview de links (Open Graph) | 🔴 Alta | 🟡 Médio | Pendente |

### Melhorias de Performance Identificadas

| Melhoria | Descrição |
|----------|-----------|
| Virtualização de mensagens | Usar `react-window` para listas longas |
| Batch de queries | Unificar queries ao selecionar chat |
| Lazy load do emoji picker | Carregar emojis sob demanda |

### Refatoração Sugerida

| Item | Descrição |
|------|-----------|
| Dividir Inbox.tsx (5276 linhas) | Separar em ChatList, MessageArea, DetailsPane, Modals |
| Agrupar estados com useReducer | Reduzir 60+ useState para contextos organizados |

---

## Atualizações - 26/01/2026

### O que foi feito hoje? 🚀

Implementamos várias funcionalidades importantes, incluindo **integração com Facebook Ads**, **busca de mensagens**, **proxy para Easypanel** e melhorias na **Inbox**.

---

### 1. Integração Facebook Ads API 📊

Nova página de **Integrações** no painel admin e página de **Campanhas** para visualizar dados do Facebook Ads.

| Funcionalidade | Status |
|----------------|--------|
| Menu "Integrações" no Admin (`/admin/integrations`) | ✅ Completo |
| Campos: ID da Conta de Anúncios e Token de Acesso | ✅ Completo |
| Edge Function `facebook-ads` para buscar campanhas | ✅ Completo |
| Página "Campanhas" no Admin (`/admin/campaigns`) | ✅ Completo |
| Cards de resumo: Gasto, Impressões, Cliques, CTR, CPC | ✅ Completo |
| Tabela de campanhas com filtro de período | ✅ Completo |

#### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `pages/admin/AdminIntegrations.tsx` | Página de configuração de integrações |
| `pages/Campaigns.tsx` | Página de visualização de campanhas |
| `supabase/functions/facebook-ads/index.ts` | Edge Function para API do Facebook |

#### Novos Campos na Tabela `settings`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `facebook_ads_account_id` | text | ID da conta de anúncios do Facebook |
| `facebook_ads_token` | text | Token de acesso da API do Facebook |

#### Como Configurar

1. Acesse `/admin/integrations`
2. Preencha o **ID da Conta de Anúncios** (encontre em Gerenciador de Anúncios → Configurações)
3. Preencha o **Token de Acesso** (gere em developers.facebook.com/tools/explorer)
   - **Importante**: Use o Access Token (começa com `EAA...`), não o Client Token
4. Clique em "Salvar Configurações"
5. Acesse `/admin/campaigns` para ver os dados

#### Parâmetros Disponíveis da API

```
campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
spend, impressions, clicks, cpc, cpm, cpp, ctr, objective, reach, actions, account_name
```

---

### 2. Busca de Mensagens na Conversa 🔍

Agora é possível buscar mensagens dentro de uma conversa específica.

| Funcionalidade | Status |
|----------------|--------|
| Botão de busca no header da conversa | ✅ Completo |
| Barra de busca com input e navegação | ✅ Completo |
| Highlight das mensagens encontradas | ✅ Completo |
| Navegação entre resultados (anterior/próximo) | ✅ Completo |
| Scroll automático para mensagem encontrada | ✅ Completo |

#### Como Usar

1. Abra uma conversa
2. Clique no ícone de lupa (🔍) no header
3. Digite o termo de busca
4. Use as setas para navegar entre os resultados
5. A mensagem atual fica destacada em amarelo

---

### 3. Proxy Easypanel para Reiniciar Evolution API 🔄

Edge Function que permite reiniciar a Evolution API diretamente do painel admin, contornando problemas de CORS.

| Funcionalidade | Status |
|----------------|--------|
| Edge Function `easypanel-proxy` | ✅ Completo |
| Botão "Reiniciar Evolution" em Admin → WhatsApp | ✅ Completo |
| Configurações de Easypanel em Admin → Configurações | ✅ Completo |

#### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/easypanel-proxy/index.ts` | Proxy para API do Easypanel |

#### Configurações Necessárias (Admin → Configurações → API)

| Campo | Descrição |
|-------|-----------|
| URL do EasyPanel | Ex: `http://72.61.40.210:3000` |
| Token de API | Token de autenticação do Easypanel |
| Nome do Projeto | Ex: `evolutionaoi` |
| Nome do Serviço | Ex: `evolution-api` |

---

### 4. Melhorias na Inbox 💬

| Melhoria | Descrição |
|----------|-----------|
| Botão "Cadastrar Cliente" | Botão no painel lateral agora abre modal de cadastro |
| Busca de mensagens | Nova funcionalidade de busca dentro da conversa |

---

### 5. Menu Admin Atualizado 📋

Novos itens no menu lateral do painel admin:

| Menu | Rota | Descrição |
|------|------|-----------|
| Campanhas | `/admin/campaigns` | Dados do Facebook Ads |
| Integrações | `/admin/integrations` | Configuração de APIs externas |

#### Ordem do Menu Admin

1. Dashboard
2. Clínicas
3. WhatsApp
4. **Campanhas** ← Novo
5. Planos
6. SuperAdmins
7. **Integrações** ← Novo
8. Configurações

---

### Edge Functions Criadas/Atualizadas

| Função | Versão | Descrição |
|--------|--------|-----------|
| `facebook-ads` | v1 | Busca dados de campanhas do Facebook Ads |
| `easypanel-proxy` | v1 | Proxy para reiniciar Evolution API via Easypanel |

---

### Otimização do Envio de Mensagens - 27/01/2026

| Melhoria | Descrição |
|----------|-----------|
| **Atualização Otimista** | Mensagem aparece instantaneamente na UI antes de enviar para o servidor |
| **Input limpa imediatamente** | Campo de texto limpa ao pressionar Enter, sem esperar resposta |
| **Queries em paralelo** | Busca de settings, clinicConfig e instances agora é paralela (`Promise.all`) |
| **Preservação de dados locais** | Realtime e refetch não sobrescrevem dados otimistas mais recentes |
| **Filtro de IDs temporários** | Evita erro 400 ao buscar reactions para mensagens otimistas |

#### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `hooks/useChats.ts` | Funções `addOptimisticMessage` e `updateOptimisticMessage`, preservação de `last_message` local em fetchChats, Realtime e polling |
| `pages/Inbox.tsx` | `handleSendMessage` refatorado para atualização otimista, filtro de IDs temporários em `fetchReactions` |

#### Fluxo de Envio Otimista

```
1. Enter pressionado
2. Mensagem aparece NA HORA na UI (otimista com id temp_*)
3. Input limpa NA HORA
4. Em background:
   - Busca nome do usuário
   - Busca settings + clinicConfig + instances (paralelo)
   - Envia para WhatsApp
   - Salva no banco
   - Substitui mensagem temp pela real
5. Se erro: remove mensagem otimista e mostra alert
```

#### Proteção contra Sobrescrita

O sistema agora compara timestamps antes de atualizar dados:
- **fetchChats (refetch)**: Preserva `last_message` local se for mais recente
- **Realtime Broadcast**: Ignora atualizações se mensagem já existe localmente
- **Polling de backup**: Preserva dados locais mais recentes

---

### Fase 7: Melhorias de Administração ✅ COMPLETA

| Funcionalidade | Status |
|----------------|--------|
| Edge Function `impersonate-user` (login como usuário) | ✅ Completo |
| Botão "Logar como" na lista de usuários do AdminClinicDetail | ✅ Completo |
| Correção de inconsistência de role entre auth.users e tabela users | ✅ Completo |
| Rodapé com direitos autorais (Betix/Alpha Omega MS) | ✅ Completo |
| Modal de solicitação de orçamento via WhatsApp | ✅ Completo |

#### Edge Function: impersonate-user

Permite que o SuperAdmin faça login como qualquer usuário da clínica para debug e suporte:
- Gera link de login mágico via `supabase.auth.admin.generateLink()`
- Apenas SuperAdmin pode usar
- Não permite impersonate de outros SuperAdmins
- Registra log de acesso para auditoria

#### Componente Footer

Rodapé presente em todas as páginas (Login e área logada):
- Texto: "© 2026 Betix - Todos os direitos reservados | Desenvolvido por Alpha Omega MS"
- Botão "Solicitar Orçamento" que abre modal
- Formulário com Nome, WhatsApp e Descrição do projeto
- Envio via Evolution API para o número do desenvolvedor

---

### Fase 8: Integração Meta (Facebook + Instagram) 🔄 EM ANDAMENTO

| Funcionalidade | Status |
|----------------|--------|
| Edge Function `facebook-oauth-callback` | ✅ Completo |
| Edge Function `meta-webhook` | ✅ Completo |
| Workflow de configuração documentado | ✅ Completo |
| Colunas no banco para Facebook/Instagram | 🔄 Pendente |
| Botão "Conectar Facebook/Instagram" na página Integrações | 🔄 Pendente |
| Recebimento de mensagens do Messenger | 🔄 Pendente |
| Recebimento de mensagens do Instagram Direct | 🔄 Pendente |
| Envio de mensagens para Messenger/Instagram | 🔄 Pendente |

#### Edge Functions Criadas

| Função | URL | JWT | Descrição |
|--------|-----|-----|-----------|
| `facebook-oauth-callback` | `/functions/v1/facebook-oauth-callback` | false | Recebe callback OAuth do Facebook |
| `meta-webhook` | `/functions/v1/meta-webhook` | false | Recebe mensagens do Messenger/Instagram |

#### URLs para Configurar no Meta for Developers

| Configuração | URL |
|--------------|-----|
| URI de Redirecionamento OAuth | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/facebook-oauth-callback` |
| URL do Webhook | `https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/meta-webhook` |
| Token de Verificação | `belitx_meta_webhook_2024` |

#### Fluxo de Autenticação

1. Usuário clica em "Conectar Facebook/Instagram" no Belitx
2. Abre popup do Facebook pedindo autorização
3. Usuário autoriza as permissões (pages_messaging, instagram_manage_messages)
4. Facebook redireciona para `facebook-oauth-callback` com código
5. Edge function troca código por access token de longa duração (60 dias)
6. Busca páginas do Facebook e contas do Instagram vinculadas
7. Salva tokens na tabela `clinics`
8. Redireciona de volta para o frontend

#### Fluxo de Mensagens

1. Cliente envia mensagem no Messenger ou Instagram Direct
2. Meta envia POST para `meta-webhook`
3. Edge function identifica a clínica pelo `facebook_page_id`
4. Cria ou atualiza chat na tabela `chats` com `channel = 'facebook'` ou `'instagram'`
5. Salva mensagem na tabela `messages`
6. Realtime do Supabase notifica o frontend

#### Colunas Necessárias na Tabela `clinics`

```sql
facebook_page_id TEXT
facebook_page_name TEXT
facebook_page_access_token TEXT
facebook_user_access_token TEXT
facebook_enabled BOOLEAN DEFAULT FALSE
instagram_business_account_id TEXT
instagram_enabled BOOLEAN DEFAULT FALSE
meta_connected_at TIMESTAMPTZ
```

#### Workflow

Use o comando `/integracaometafacebookinstagram` para ver o guia completo de configuração.

---

## Configuração de Seções do Painel Lateral (Inbox) - 29/01/2026

### Funcionalidade

Permite ao usuário **personalizar** o painel lateral direito do Inbox:
- **Esconder/Mostrar** seções que não usa
- **Reordenar** seções conforme preferência (1º, 2º, 3º...)
- **Persistência** automática no localStorage

### Seções Configuráveis

| Seção | Chave | Descrição |
|-------|-------|-----------|
| Etapa do Pipeline | `pipeline` | Funil de vendas do lead |
| Responsável | `responsavel` | Atendente responsável pelo chat |
| Origem do Lead | `origem` | De onde o lead veio |
| Etiquetas | `etiquetas` | Tags para categorização |
| Orçamentos | `orcamentos` | Propostas enviadas ao cliente |
| Negociações Comerciais | `negociacoes` | Vendas registradas |
| Lançamentos da Clínica | `lancamentos` | Recebimentos diretos |
| Tarefas | `tarefas` | Lista de tarefas pendentes |
| Follow-up | `followup` | Mensagens agendadas |
| Observações | `observacoes` | Notas internas |

### Arquivos Criados/Modificados

| Arquivo | Descrição |
|---------|-----------|
| `components/InboxDetailsSections.tsx` | Componente com hook e modal de configuração |
| `pages/Inbox.tsx` | Integração do componente e CSS order nas seções |

### Componente `InboxDetailsSections.tsx`

```typescript
// Hook para gerenciar seções
export const useSectionConfig = () => {
  // Estados
  const [hiddenSections, setHiddenSections] = useState<Record<SectionKey, boolean>>();
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>();
  
  // Funções
  const toggleSectionVisibility = (key: SectionKey) => { ... };
  const moveSectionUp = (key: SectionKey) => { ... };
  const moveSectionDown = (key: SectionKey) => { ... };
  const isSectionVisible = (key: SectionKey) => !hiddenSections[key];
  const getSectionOrder = (key: SectionKey) => sectionOrder.indexOf(key);
  
  return { ... };
};

// Modal de configuração
export const SectionConfigModal: React.FC<SectionConfigModalProps> = ({ ... });
```

### Persistência no localStorage

| Chave | Descrição |
|-------|-----------|
| `inbox_hidden_sections` | Objeto com seções ocultas `{ etiquetas: true, ... }` |
| `inbox_section_order` | Array com ordem das seções `['pipeline', 'etiquetas', ...]` |

### Como Usar

1. Clique no botão ⚙️ (engrenagem) no topo do painel lateral direito
2. No modal "Configurar Seções":
   - Use as setas ↑↓ para reordenar
   - Use os checkboxes para esconder/mostrar
   - O número (1º, 2º, 3º...) indica a posição atual
3. Clique em "Concluído"
4. As seções serão reorganizadas visualmente

### Implementação Técnica

- **Visibilidade**: Condicionais `{isSectionVisible('key') && ( ... )}`
- **Reordenação**: CSS `style={{ order: getSectionOrder('key') }}`
- **Container**: `flex flex-col gap-8` no div das seções

---

## Melhorias - 30/01/2026

### Múltiplas Contas Meta Ads

| Funcionalidade | Status |
|----------------|--------|
| Tabela `clinic_meta_accounts` para múltiplas contas | ✅ Completo |
| Migração de dados existentes | ✅ Completo |
| Página de Integrações com gerenciamento de contas | ✅ Completo |
| Edge function `meta-ads-api` atualizada | ✅ Completo |
| Abas dinâmicas no Dashboard por conta Meta Ads | ✅ Completo |
| Coluna `meta_account_id` na tabela `chats` | ✅ Completo |
| Webhook captura `meta_account_id` dos leads | ✅ Completo |
| Dashboard filtra leads por `meta_account_id` | ✅ Completo |

### Novas Tabelas

| Tabela | Descrição |
|--------|-----------|
| `clinic_meta_accounts` | Contas Meta Ads por clínica (account_id, account_name, access_token, is_active) |

### Novos Campos

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `chats` | `meta_account_id` | ID da conta Meta Ads de origem do lead |

### Dashboard - Cards de Faturamento

| Card | Descrição |
|------|-----------|
| **Receita Comercial** | Faturamento do comercial (tabela `payments`) |
| **Receita Clínica** | Faturamento da clínica (tabela `clinic_receipts`) |
| **Faturamento do Mês** | Comercial + Clínica do mês atual |
| **Faturamento Total** | Comercial + Clínica acumulado |

### Dashboard - Leads por Origem

| Funcionalidade | Descrição |
|----------------|-----------|
| Filtro "Hoje" | Mostra apenas leads do dia atual |
| Filtro "7 dias" | Padrão selecionado |
| Filtro "30 dias" | Últimos 30 dias |
| Filtro "Este mês" | Mês atual |
| Filtro "Todos" | Sem filtro de data |
| Paginação | Mínimo 10 itens por página |
| Mensagem vazia | "Nenhum lead encontrado para o período selecionado" |

### Restrições de Abas no Dashboard

| Aba | Visível para |
|-----|--------------|
| Visão Geral | Todos |
| Clínica Belizze (Meta Ads) | Apenas Admin |
| Dra. Kamylle (Meta Ads) | Apenas Admin |
| Tarefas | Todos |
| Produtividade | Todos |
| Links | Apenas Admin |
| Leads | Todos |

### Correção - Login como Cliente no /admin

- **Problema**: `navigate('/dashboard')` + `window.location.reload()` causava condição de corrida
- **Solução**: Usar `window.location.href = '/dashboard'` diretamente
- **Resultado**: Impersonate funciona corretamente em produção

### Edge Function: evolution-webhook

Melhorias implementadas:
- Busca `account_id` via Meta Graph API quando lead vem de anúncio
- Salva `meta_account_id` no chat para identificar conta de origem
- Permite filtrar leads por conta Meta Ads no Dashboard

---

## Fase 14: Links Rastreáveis e Remarketing ✅ COMPLETA

### Status da Implementação

| Funcionalidade | Status |
|----------------|--------|
| Sistema de Links Rastreáveis | ✅ Completo |
| Página de criação/edição de links | ✅ Completo |
| Redirect com página de loading | ✅ Completo |
| Registro de cliques com UTMs | ✅ Completo |
| Associação automática clique → chat | ✅ Completo |
| Dashboard de Links (aba no Dashboard) | ✅ Completo |
| Página LinkConversations (conversas por link) | ✅ Completo |
| Remarketing: tempo de resposta baseado no último clique | ✅ Completo |
| Histórico de contatos (modal com todos os cliques) | ✅ Completo |
| Badge Instagram/Facebook na lista de conversas | ✅ Completo |
| Regex para códigos alfanuméricos (ex: 6VME00) | ✅ Completo |

### Arquitetura do Sistema

```
Usuário clica no link
        ↓
belitx.com.br/w/CODIGO?utm_source=...
        ↓
Hostinger (PHP) → Supabase Edge Function
        ↓
redirect-to-whatsapp (registra clique)
        ↓
Página de loading (5 segundos)
        ↓
WhatsApp abre com mensagem: "Olá! [CODIGO]"
        ↓
Usuário envia mensagem
        ↓
evolution-webhook detecta [CODIGO]
        ↓
Associa clique ao chat (últimos 30 min)
```

### Tabelas do Banco

| Tabela | Descrição |
|--------|-----------|
| `trackable_links` | Links rastreáveis por clínica |
| `link_clicks` | Cliques registrados com UTMs, dispositivo, IP |
| `lead_sources` | Origens de lead (vinculadas aos links) |

### Campos da Tabela `trackable_links`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | ID único |
| `clinic_id` | uuid | Clínica dona do link |
| `code` | text | Código único (ex: 6VME00) |
| `name` | text | Nome do link |
| `phone_number` | text | Número WhatsApp destino |
| `message_template` | text | Mensagem pré-preenchida |
| `source_id` | uuid | Origem de lead vinculada |
| `utm_source` | text | UTM padrão |
| `utm_medium` | text | UTM padrão |
| `utm_campaign` | text | UTM padrão |
| `clicks_count` | int | Contador de cliques |
| `is_active` | boolean | Link ativo |

### Campos da Tabela `link_clicks`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | ID único |
| `link_id` | uuid | Link clicado |
| `clinic_id` | uuid | Clínica |
| `clicked_at` | timestamp | Data/hora do clique |
| `chat_id` | uuid | Chat associado (após mensagem) |
| `converted_to_lead` | boolean | Se virou lead |
| `converted_at` | timestamp | Data da conversão |
| `ip_address` | text | IP do usuário |
| `user_agent` | text | User agent completo |
| `browser` | text | Navegador (Chrome, Instagram, Facebook) |
| `os` | text | Sistema operacional |
| `device_type` | text | desktop/mobile/tablet |
| `device_model` | text | Modelo do dispositivo |
| `referrer` | text | Página de origem |
| `utm_source` | text | UTM capturado |
| `utm_medium` | text | UTM capturado |
| `utm_campaign` | text | UTM capturado |
| `utm_content` | text | UTM capturado |
| `utm_term` | text | UTM capturado |
| `fbclid` | text | Facebook Click ID |
| `gclid` | text | Google Click ID |
| `belitx_fbid` | text | ID customizado para Meta Ads |
| `ad_id` | text | ID do anúncio |
| `site_source` | text | Fonte do site (Meta) |
| `placement` | text | Posicionamento do anúncio |

### Edge Functions

| Função | Versão | Descrição |
|--------|--------|-----------|
| `redirect-to-whatsapp` | v3 | Registra clique e redireciona para WhatsApp |
| `evolution-webhook` | v50 | Detecta código na mensagem e associa clique |

### Padrões Regex para Detecção de Código

O webhook detecta códigos nos seguintes formatos:

| Padrão | Exemplo | Regex |
|--------|---------|-------|
| Colchetes | `[6VME00]` | `/\[([A-Za-z0-9]{3,10})\]/` |
| Parênteses | `(ABC123)` | `/\(([A-Za-z0-9]{3,10})\)/` |
| Hashtag | `#CODIGO` | `/#([A-Za-z0-9]{3,10})\b/` |
| Letras+Números | `AV7`, `ALV1` | `/\b([A-Z]{2,5}[0-9]{1,4})$/i` |
| Número+Letras+Números | `6VME00` | `/\b([0-9][A-Z]{2,4}[0-9]{2})\b/i` |

### URLs dos Links

| Tipo | URL |
|------|-----|
| Link Curto | `https://belitx.com.br/w/CODIGO` |
| Instagram Bio | `https://belitx.com.br/w/CODIGO?utm_source=instagram&utm_medium=bio` |
| Google Ads | `https://belitx.com.br/w/CODIGO?utm_source=google&utm_medium=cpc` |
| Meta Ads | `https://belitx.com.br/w/CODIGO` + UTMs dinâmicos |
| Botão no Site | `https://belitx.com.br/w/CODIGO?utm_source=website&utm_medium=button` |
| QR Code | `https://belitx.com.br/w/CODIGO?utm_source=offline&utm_medium=qrcode` |
| Email Marketing | `https://belitx.com.br/w/CODIGO?utm_source=email&utm_medium=newsletter` |

### Lógica de Remarketing

1. **Clique registrado** com `chat_id = null`
2. **Mensagem chega** com código `[CODIGO]`
3. **Webhook busca** clique sem `chat_id` nos últimos 30 minutos
4. **Associa clique** ao chat (`chat_id`, `converted_to_lead = true`)
5. **Dashboard calcula** tempo de resposta baseado no último clique

### Dashboard de Links

| Métrica | Descrição |
|---------|-----------|
| Total de Cliques | Soma de todos os cliques |
| Conversões | Cliques que viraram leads |
| Taxa de Conversão | Conversões / Cliques × 100 |
| Cliques Hoje | Cliques do dia atual |
| Por Dispositivo | Desktop vs Mobile |
| Por Navegador | Chrome, Instagram, Facebook, Safari |
| Por Origem | utm_source agrupado |

### Página LinkConversations

| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de conversas | Leads que vieram do link |
| Badge de origem | Instagram (rosa), Facebook (azul) |
| Tempo de resposta | Baseado no último clique |
| Respondido por | Quem respondeu primeiro |
| Histórico de contatos | Modal com todos os cliques do lead |
| Busca | Por nome ou telefone |
| Filtros | Período, status de resposta |

### Aba Leads no Dashboard

| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de leads | Com origem, data, tempo de resposta |
| Botão histórico | Abre modal com todos os cliques |
| Tempo de resposta | Calculado do último clique |
| Respondido por | Nome do atendente |
| Status | Respondido / Não respondido |

### Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `pages/TrackableLinks.tsx` | CRUD de links rastreáveis |
| `pages/LinkConversations.tsx` | Conversas por link |
| `components/DashboardLinksTab.tsx` | Aba Links no Dashboard |
| `components/DashboardLeadsTab.tsx` | Aba Leads no Dashboard |
| `hostinger-redirect/w/index.php` | Proxy PHP na Hostinger |
| `supabase/functions/redirect-to-whatsapp/index.ts` | Edge function de redirect |
| `supabase/functions/evolution-webhook/index.ts` | Webhook v50 com regex corrigido |

### Correções Importantes

| Correção | Versão | Descrição |
|----------|--------|-----------|
| `.single()` → `.maybeSingle()` | v48 | Evita erro quando não há clique para associar |
| Regex alfanumérico | v50 | Aceita códigos como `6VME00` que começam com número |
| Busca por array | v50 | Usa `.limit(1)` em vez de `.single()` para cliques |

---

## Fase 11: Adaptação Mobile/Tablet ✅ COMPLETA

### Data: 04/02/2026

| Funcionalidade | Status |
|----------------|--------|
| Kanban - Adaptação para Tablet | ✅ Completo |
| Kanban - Adaptação para Celular | ✅ Completo |
| Inbox - Header do Layout oculto | ✅ Completo |
| Inbox - Caixa de mensagem ampliada | ✅ Completo |
| Inbox - Painel do Lead como Drawer (Tablet) | ✅ Completo |
| Inbox - Drawer com paridade Desktop | ✅ Completo |
| Inbox - Lista de conversas responsiva | ✅ Completo |
| Inbox - Navegação em telas separadas (Celular) | ✅ Completo |
| Inbox - Otimizações visuais para Mobile | ✅ Completo |

### Kanban - Adaptação para Tablet
- Layout responsivo com cards redimensionados
- Colunas do pipeline ajustadas para telas menores
- Scroll horizontal suave entre etapas

### Kanban - Adaptação para Celular
- Visualização em coluna única
- Cards compactos e otimizados
- Navegação intuitiva entre etapas

### Inbox - Header do Layout
- Header do sistema ocultado na página Inbox para maximizar espaço útil
- Mais área disponível para conversas e mensagens

### Inbox - Caixa de Mensagem Ampliada
- Área de digitação expandida
- Placeholder adaptado para telas menores
- Melhor experiência de digitação em dispositivos móveis

### Inbox - Painel do Lead como Drawer (Tablet)
- Painel de detalhes do lead convertido em drawer lateral
- Abre ao clicar no botão ℹ️ no header do chat
- Overlay com animação suave de entrada
- Botão X para fechar o drawer

### Inbox - Drawer Completo com Paridade Desktop

**Header com 4 botões de ação:**
- 📧 Email (condicional - ativo se SMTP configurado)
- 📞 Ligar
- 👤 Editar/Cadastrar cliente
- ⚙️ Configurações

**Seções completas:**
- **Etapa do Pipeline** - Com barra de progresso colorida dinâmica e botão "Alterar"
- **Responsável** - Com avatar, botões "Encaminhar" e "Assumir"
- **Origem do Lead** - Dropdown funcional com origens cadastradas e cores
- **Etiquetas** - Com botão "+ Adicionar"
- **Orçamentos** - Com botão "+ Adicionar"
- **Negociações Comerciais** - Com botão "+ Adicionar"
- **Tarefas** - Com botão "+ Adicionar"
- **Lançamentos da Clínica** - Com botão "+ Adicionar"
- **Follow-up** - Com botão "+ Agendar"
- **Observações** - Com campo de input e botão "Salvar Observação"

### Inbox - Lista de Conversas Responsiva
- Largura ajustada: 240px (mobile) → 280px (md) → 320px (lg) → 380px (xl)
- Melhor aproveitamento do espaço em diferentes tamanhos de tela

### Inbox - Navegação em Telas Separadas (Celular)
- **Tela 1**: Lista de conversas ocupa 100% da largura quando não há chat selecionado
- **Tela 2**: Chat ocupa 100% da largura quando selecionado
- **Botão Voltar (←)**: Adicionado no header do chat para retornar à lista
- Seleção automática de conversa desabilitada em mobile (< 640px)

### Inbox - Otimizações Visuais para Mobile
- **Header**: Padding reduzido (`p-1.5` em mobile, `p-2` em desktop)
- **Barra de busca**: Mais compacta (`py-1.5` em mobile, `py-2` em desktop)
- **Avatares**: 40px em mobile (`size-10`), 48px em desktop (`size-12`)
- **Itens da lista**: Padding reduzido (`p-3` em mobile, `p-4` em desktop)
- **Botão de fixar conversa (📌)**: Sempre visível em mobile, hover em desktop

### Breakpoints Utilizados

| Breakpoint | Largura | Uso |
|------------|---------|-----|
| `sm:` | 640px | Mobile → Tablet |
| `md:` | 768px | Tablet pequeno → Tablet |
| `lg:` | 1024px | Tablet → Desktop |
| `xl:` | 1280px | Desktop → Desktop grande |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `pages/Inbox.tsx` | +450 linhas de código responsivo, drawer, navegação mobile |
| `components/Layout.tsx` | Header condicional para página Inbox |

### Benefícios

1. **Experiência unificada** - Mesmas funcionalidades em todos os dispositivos
2. **Produtividade** - Atendentes podem trabalhar de tablets e celulares
3. **Usabilidade** - Interface otimizada para touch e telas menores
4. **Performance** - Carregamento sob demanda de mensagens

---

## Desenvolvido por

**Betix** - CRM para Clínicas
Desenvolvido por **Alpha Omega MS**
React + TypeScript + Supabase
