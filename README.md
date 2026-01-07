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

## Próximos Passos (Fase 5)

| Funcionalidade | Status |
|----------------|--------|
| Relatórios e métricas | 🔄 Pendente |
| Gestão de planos e assinaturas | 🔄 Pendente |
| Auto-registro de clínicas | 🔄 Pendente |
| Notificações push | 🔄 Pendente |
| Agendamentos integrados | 🔄 Pendente |

---

## Licença

Este projeto é privado e de uso exclusivo.

---

## Desenvolvido por

**LeadCare** - CRM para Clínicas
React + TypeScript + Supabase
