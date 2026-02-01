<?php
/**
 * Redirect para Links Rastreáveis - Belitx
 * 
 * Este arquivo redireciona URLs curtas para a Edge Function do Supabase
 * URL: belitx.com.br/r/CODIGO -> Supabase Edge Function
 * 
 * Instruções:
 * 1. Faça upload desta pasta 'r' para a raiz do seu site na Hostinger
 * 2. O link belitx.com.br/r/CODIGO vai redirecionar automaticamente
 */

// Pegar o código da URL
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Remover /r/ do início
$code = preg_replace('/^\/r\/?/', '', $path);

// Se não tiver código, redirecionar para o site principal
if (empty($code)) {
    header('Location: https://belitx.com.br');
    exit;
}

// Manter query string (UTMs)
$queryString = $_SERVER['QUERY_STRING'] ?? '';
$fullUrl = 'https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/redirect-link/' . $code;

if (!empty($queryString)) {
    $fullUrl .= '?' . $queryString;
}

// Redirecionar para a Edge Function
header('Location: ' . $fullUrl, true, 302);
exit;
?>
