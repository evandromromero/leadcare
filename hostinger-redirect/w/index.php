<?php
/**
 * Redirect para WhatsApp com delay (estilo TinTim) - Belitx
 * 
 * Este arquivo busca o HTML da Edge Function e serve diretamente
 * URL: belitx.com.br/w/CODIGO -> Página de redirecionamento (5 seg)
 * 
 * Usar para Meta Ads com UTMs:
 * belitx.com.br/w/CODIGO?utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{adset.name}}_{{ad.name}}&belitx_fbid={{ad.id}}_{{site_source_name}}_{{placement}}
 */

// Pegar o código da URL
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Remover /w/ do início
$code = preg_replace('/^\/w\/?/', '', $path);

// Se não tiver código, redirecionar para o site principal
if (empty($code)) {
    header('Location: https://belitx.com.br');
    exit;
}

// Manter query string (UTMs e belitx_fbid)
$queryString = $_SERVER['QUERY_STRING'] ?? '';
$fullUrl = 'https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/redirect-to-whatsapp/' . $code;

if (!empty($queryString)) {
    $fullUrl .= '?' . $queryString;
}

// Buscar o HTML da Edge Function e servir diretamente
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => [
            'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0'),
            'X-Forwarded-For: ' . ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown'),
            'X-Real-IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
            'Referer: ' . ($_SERVER['HTTP_REFERER'] ?? ''),
        ],
        'timeout' => 10,
    ],
]);

$html = @file_get_contents($fullUrl, false, $context);

if ($html === false) {
    // Se falhar, redirecionar para o site principal
    header('Location: https://belitx.com.br');
    exit;
}

// Servir o HTML diretamente
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
echo $html;
?>
