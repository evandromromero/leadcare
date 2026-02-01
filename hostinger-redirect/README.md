# Redirect para Links Rastreáveis - Belitx

## Instruções de Instalação na Hostinger

### Passo 1: Acesse o Gerenciador de Arquivos
1. Entre no painel da Hostinger
2. Vá em **Gerenciador de Arquivos**
3. Navegue até a pasta `public_html` (raiz do site)

### Passo 2: Faça upload da pasta `r`
1. Faça upload de toda a pasta `r` para dentro de `public_html`
2. A estrutura deve ficar assim:
```
public_html/
├── r/
│   ├── index.php
│   └── .htaccess
├── (outros arquivos do site)
```

### Passo 3: Teste
Acesse: `https://belitx.com.br/r/TESTE`

Se redirecionar para o WhatsApp, está funcionando!

## Como funciona

```
belitx.com.br/r/CODIGO
       ↓
index.php captura o código
       ↓
Redireciona para Edge Function do Supabase
       ↓
Edge Function incrementa cliques e redireciona para WhatsApp
```

## URLs de exemplo

| Plataforma | URL |
|------------|-----|
| Instagram Bio | `belitx.com.br/r/INSTA1` |
| Google Ads | `belitx.com.br/r/GADS01?utm_source=google&utm_medium=cpc` |
| Meta Ads | `belitx.com.br/r/META01?utm_source=facebook&utm_medium=paid` |
| Site | `belitx.com.br/r/SITE01?utm_source=website&utm_medium=button` |

## Suporte
Em caso de problemas, verifique:
1. Se o arquivo `.htaccess` foi enviado (arquivos com ponto podem ficar ocultos)
2. Se o `mod_rewrite` está habilitado na Hostinger
3. Se as permissões dos arquivos estão corretas (644 para arquivos, 755 para pastas)
