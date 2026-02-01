---
description: Implementar sistema completo de Email Marketing com SMTP, templates e envio
---

# Email Marketing - Workflow de Implementação

Este workflow descreve como implementar um sistema completo de Email Marketing em projetos React + Supabase.

---

## 1. Estrutura do Banco de Dados

### 1.1 Criar tabela de templates de email
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_clinic ON email_templates(clinic_id);
```

### 1.2 Criar tabela de campanhas (opcional)
```sql
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  target_audience VARCHAR(100),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 Adicionar campos SMTP na tabela de clínicas/configurações
```sql
ALTER TABLE clinics ADD COLUMN smtp_host VARCHAR(255);
ALTER TABLE clinics ADD COLUMN smtp_port INT DEFAULT 465;
ALTER TABLE clinics ADD COLUMN smtp_user VARCHAR(255);
ALTER TABLE clinics ADD COLUMN smtp_password VARCHAR(255);
ALTER TABLE clinics ADD COLUMN smtp_from_email VARCHAR(255);
ALTER TABLE clinics ADD COLUMN smtp_from_name VARCHAR(255);
ALTER TABLE clinics ADD COLUMN smtp_encryption VARCHAR(10) DEFAULT 'ssl';
ALTER TABLE clinics ADD COLUMN email_marketing_enabled BOOLEAN DEFAULT false;
```

---

## 2. Edge Functions (Supabase)

### 2.1 Criar edge function `send-email`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, clinic_id } = await req.json();

    // Validação
    if (!to || !subject || !html || !clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios: to, subject, html, clinic_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Conectar ao Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações SMTP
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_encryption, name, email_marketing_enabled")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, error: "Clínica não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!clinic.email_marketing_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Email Marketing não habilitado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    if (!clinic.smtp_host || !clinic.smtp_user || !clinic.smtp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações SMTP incompletas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Criar cliente SMTP
    const client = new SMTPClient({
      connection: {
        hostname: clinic.smtp_host,
        port: clinic.smtp_port || 465,
        tls: clinic.smtp_encryption === "ssl",
        auth: {
          username: clinic.smtp_user,
          password: clinic.smtp_password,
        },
      },
    });

    const fromEmail = clinic.smtp_from_email || clinic.smtp_user;
    const fromName = clinic.smtp_from_name || clinic.name || "Sistema";

    // Enviar email
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: to,
      subject: subject,
      content: "auto",
      html: html,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro ao enviar email:", error);
    
    let errorMessage = "Erro desconhecido";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (errorMessage.includes("authentication")) {
        errorMessage = "Falha na autenticação SMTP";
      } else if (errorMessage.includes("connect") || errorMessage.includes("timeout")) {
        errorMessage = "Não foi possível conectar ao servidor SMTP";
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

### 2.2 Criar edge function `test-smtp` (para testar configuração)

Similar à `send-email`, mas envia um email de teste para validar a configuração.

---

## 3. Estados React para Envio de Email

Adicionar em qualquer componente que precise enviar email:

```typescript
// Estados para envio de email
const [smtpConfigured, setSmtpConfigured] = useState(false);
const [emailTemplates, setEmailTemplates] = useState<Array<{
  id: string;
  name: string;
  subject: string;
  html_content: string;
}>>([]);
const [showEmailModal, setShowEmailModal] = useState(false);
const [selectedTemplateId, setSelectedTemplateId] = useState('');
const [sendingEmail, setSendingEmail] = useState(false);
```

---

## 4. useEffect para Buscar Configuração SMTP

```typescript
useEffect(() => {
  const fetchEmailConfig = async () => {
    if (!clinicId) return;
    
    try {
      // Verificar se SMTP está configurado
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('smtp_host, smtp_user, email_marketing_enabled')
        .eq('id', clinicId)
        .single();
      
      const hasSmtp = clinicData?.smtp_host && 
                      clinicData?.smtp_user && 
                      clinicData?.email_marketing_enabled;
      setSmtpConfigured(!!hasSmtp);
      
      // Se SMTP configurado, buscar templates
      if (hasSmtp) {
        const { data: templates } = await supabase
          .from('email_templates')
          .select('id, name, subject, html_content')
          .eq('clinic_id', clinicId)
          .order('name');
        
        if (templates) {
          setEmailTemplates(templates);
        }
      }
    } catch (err) {
      console.error('Error fetching email config:', err);
    }
  };
  
  fetchEmailConfig();
}, [clinicId]);
```

---

## 5. Função de Substituição de Variáveis

```typescript
const replaceVariables = (
  content: string, 
  variables: Record<string, string>
): string => {
  let result = content;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(
      new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), 
      value
    );
  });
  return result;
};

// Uso:
const variables: Record<string, string> = {
  '{{lead_name}}': leadName || 'Cliente',
  '{{clinic_name}}': clinicData?.name || '',
  '{{clinic_email}}': clinicData?.email || '',
  '{{clinic_phone}}': clinicData?.phone || '',
  '{{unsubscribe_url}}': `${baseUrl}/unsubscribe?id=${leadId}`,
};

const htmlContent = replaceVariables(template.html_content, variables);
const subject = replaceVariables(template.subject, variables);
```

---

## 6. Função de Envio de Email

```typescript
const handleSendEmail = async () => {
  if (!clinicId || !selectedTemplateId || !recipientEmail) return;
  
  setSendingEmail(true);
  try {
    const template = emailTemplates.find(t => t.id === selectedTemplateId);
    if (!template) throw new Error('Template não encontrado');
    
    // Buscar dados da clínica para variáveis
    const { data: clinicData } = await supabase
      .from('clinics')
      .select('name, email, phone')
      .eq('id', clinicId)
      .single();
    
    // Substituir variáveis
    const variables = {
      '{{lead_name}}': recipientName || 'Cliente',
      '{{clinic_name}}': clinicData?.name || '',
      '{{clinic_email}}': clinicData?.email || '',
      '{{clinic_phone}}': clinicData?.phone || '',
      '{{unsubscribe_url}}': '#',
    };
    
    const htmlContent = replaceVariables(template.html_content, variables);
    const subject = replaceVariables(template.subject, variables);
    
    // Chamar edge function
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        clinic_id: clinicId,
      }
    });
    
    if (error) throw error;
    
    // Sucesso
    setShowEmailModal(false);
    setSelectedTemplateId('');
    // Mostrar toast de sucesso
    
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    // Mostrar toast de erro
  } finally {
    setSendingEmail(false);
  }
};
```

---

## 7. Botão de Email Condicional

```tsx
{smtpConfigured && recipientEmail ? (
  <button 
    onClick={() => {
      setSelectedTemplateId('');
      setShowEmailModal(true);
    }}
    className="size-10 rounded-full border border-purple-100 bg-purple-50 text-purple-600 flex items-center justify-center hover:scale-110 transition-transform"
    title={`Enviar email para ${recipientEmail}`}
  >
    <span className="material-symbols-outlined text-[20px]">mail</span>
  </button>
) : (
  <button 
    disabled
    className="size-10 rounded-full border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
    title={!smtpConfigured ? "Configure SMTP em Integrações" : "Sem email cadastrado"}
  >
    <span className="material-symbols-outlined text-[20px]">mail</span>
  </button>
)}
```

---

## 8. Modal de Envio de Email

```tsx
{showEmailModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
         onClick={() => setShowEmailModal(false)}></div>
    <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-violet-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white">mail</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Enviar Email</h3>
            <p className="text-purple-100 text-sm">Para: {recipientName}</p>
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Email do destinatário */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Destinatário:</p>
          <p className="text-sm font-medium text-slate-700">{recipientEmail}</p>
        </div>
        
        {/* Seletor de template */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Selecione um template</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Preview do assunto */}
        {selectedTemplateId && (
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
            <p className="text-xs text-purple-500 mb-1">Assunto:</p>
            <p className="text-sm font-medium text-purple-700">
              {emailTemplates.find(t => t.id === selectedTemplateId)?.subject
                .replace('{{lead_name}}', recipientName || 'Cliente')
                .replace('{{clinic_name}}', clinicName || '')}
            </p>
          </div>
        )}

        {/* Aviso se não houver templates */}
        {emailTemplates.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <span className="material-symbols-outlined text-amber-500 text-2xl mb-2">warning</span>
            <p className="text-sm text-amber-700">Nenhum template encontrado.</p>
            <p className="text-xs text-amber-600 mt-1">Crie templates em Email Marketing.</p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          onClick={() => setShowEmailModal(false)}
          className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={handleSendEmail}
          disabled={!selectedTemplateId || sendingEmail}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {sendingEmail ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Enviando...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Enviar Email
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 9. Página de Configuração SMTP

Criar formulário com os campos:
- Host SMTP
- Porta (padrão: 465)
- Usuário
- Senha
- Email remetente
- Nome remetente
- Criptografia (SSL/TLS)
- Toggle para habilitar/desabilitar

---

## 10. Variáveis Dinâmicas Suportadas

| Variável | Descrição |
|----------|-----------|
| `{{lead_name}}` | Nome do lead/cliente |
| `{{clinic_name}}` | Nome da clínica/empresa |
| `{{clinic_email}}` | Email da clínica/empresa |
| `{{clinic_phone}}` | Telefone da clínica/empresa |
| `{{unsubscribe_url}}` | Link de descadastro |

---

## Checklist de Implementação

- [ ] Criar tabelas no banco (email_templates, email_campaigns)
- [ ] Adicionar campos SMTP na tabela de configurações
- [ ] Criar edge function `send-email`
- [ ] Criar edge function `test-smtp`
- [ ] Criar página de configuração SMTP
- [ ] Criar página de templates de email
- [ ] Adicionar estados de email nos componentes
- [ ] Implementar useEffect para buscar config SMTP
- [ ] Implementar função de envio de email
- [ ] Adicionar botão de email condicional
- [ ] Criar modal de envio de email
- [ ] Testar envio de email
