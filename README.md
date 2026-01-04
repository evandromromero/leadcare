# LeadCare

CRM de WhatsApp completo para clínicas com gestão de leads, caixa de entrada multicanal, funil kanban e gestão de usuários.

![LeadCare Logo](public/logo.png)

---

## Sobre o Projeto

**LeadCare** é uma plataforma de CRM desenvolvida para clínicas e consultórios que precisam gerenciar atendimentos via WhatsApp de forma profissional. O sistema permite acompanhar leads desde o primeiro contato até o fechamento, com visualização em kanban, métricas em tempo real e gestão de equipe.

### Funcionalidades Atuais

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Login** | Autenticação de usuários (Admin/Atendente) | ✅ Frontend |
| **Dashboard** | Métricas em tempo real (leads, atendimentos, vendas, tempo de resposta) | ✅ Frontend |
| **Inbox** | Caixa de entrada multicanal para conversas WhatsApp | ✅ Frontend |
| **Kanban** | Funil de leads com drag & drop (Novo Lead → Em Atendimento → Agendado → Fechado → Perdido) | ✅ Frontend |
| **Usuários** | Gestão de usuários e permissões (Admin) | ✅ Frontend |
| **Configurações** | Configurações do sistema e perfil da clínica | ✅ Frontend |
| **Conexão WhatsApp** | Tela de conexão via QR Code | ✅ Frontend |

---

## Stack Tecnológica

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Estilização**: TailwindCSS (via CDN)
- **Roteamento**: React Router DOM 7
- **Ícones**: Material Symbols (Google Fonts)
- **Estado**: React useState (local state)

---

## Estrutura do Projeto

```
LeadCare/
├── public/
│   └── logo.png              # Logo do LeadCare
├── components/
│   └── Layout.tsx            # Layout principal (sidebar + header)
├── config/
│   └── assets.ts             # URLs de assets e imagens
├── pages/
│   ├── Login.tsx             # Tela de login
│   ├── Dashboard.tsx         # Dashboard com métricas
│   ├── Inbox.tsx             # Caixa de entrada de mensagens
│   ├── Kanban.tsx            # Funil de leads
│   ├── Users.tsx             # Gestão de usuários
│   ├── Settings.tsx          # Configurações
│   └── Connect.tsx           # Conexão WhatsApp
├── store/
│   └── mockData.ts           # Dados mockados para desenvolvimento
├── types.ts                  # Tipos TypeScript
├── App.tsx                   # Componente principal com rotas
├── index.tsx                 # Entry point
├── index.html                # HTML principal
├── vite.config.ts            # Configuração do Vite
├── tsconfig.json             # Configuração TypeScript
└── package.json              # Dependências
```

---

## Como Executar

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/leadcare.git
cd leadcare

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

### Build para Produção

```bash
npm run build
npm run preview
```

---

## Credenciais de Teste

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@clinica.com | 123456 | Admin |

---

## Roadmap - O que falta fazer

### Fase 1: Backend e Autenticação
- [ ] Configurar Supabase (banco de dados + auth)
- [ ] Criar tabelas: users, clinics, chats, messages, leads, tags
- [ ] Implementar autenticação real com Supabase Auth
- [ ] Criar Row Level Security (RLS) para multi-tenancy
- [ ] Migrar dados mockados para banco real

### Fase 2: Integração WhatsApp
- [ ] Integrar com API do WhatsApp Business (ou Evolution API)
- [ ] Implementar webhook para receber mensagens
- [ ] Conexão real via QR Code
- [ ] Envio e recebimento de mensagens em tempo real
- [ ] Suporte a mídia (imagens, áudios, documentos)

### Fase 3: Funcionalidades Avançadas
- [ ] Notificações push/desktop
- [ ] Respostas rápidas configuráveis
- [ ] Chatbot com respostas automáticas
- [ ] Agendamento de mensagens
- [ ] Templates de mensagens (HSM)
- [ ] Transferência de atendimento entre atendentes

### Fase 4: Relatórios e Analytics
- [ ] Dashboard com dados reais
- [ ] Relatórios de performance por atendente
- [ ] Métricas de conversão do funil
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Histórico de atendimentos

### Fase 5: Multi-clínica e SaaS
- [ ] Suporte a múltiplas clínicas/unidades
- [ ] Planos e assinaturas
- [ ] Painel administrativo master
- [ ] Onboarding de novas clínicas

---

## Tipos de Dados

### User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Atendente';
  clinicId: string;
  avatarUrl: string;
  status: 'Ativo' | 'Inativo';
}
```

### Chat
```typescript
interface Chat {
  id: string;
  clientName: string;
  phoneNumber: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  tags: Tag[];
  messages: Message[];
  status: 'Novo Lead' | 'Em Atendimento' | 'Agendado' | 'Fechado' | 'Perdido';
}
```

### Lead
```typescript
interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  stage: Chat['status'];
  tags: Tag[];
  notes: string;
  lastUpdate: string;
}
```

---

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## Licença

Este projeto é privado e de uso exclusivo.

---

## Contato

**LeadCare** - CRM para Clínicas
Desenvolvido com React + TypeScript
