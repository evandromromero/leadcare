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

## Licença

Este projeto é privado e de uso exclusivo.

---

## Desenvolvido por

**LeadCare** - CRM para Clínicas
React + TypeScript + Supabase
