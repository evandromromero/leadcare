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

// Capturar IP real do visitante (tentar múltiplos headers)
$clientIp = 'unknown';
$ipHeaders = [
    'HTTP_CF_CONNECTING_IP',     // Cloudflare
    'HTTP_TRUE_CLIENT_IP',       // Akamai / Cloudflare Enterprise
    'HTTP_X_REAL_IP',            // Nginx proxy
    'HTTP_X_FORWARDED_FOR',      // Proxy padrão (pode ter múltiplos IPs)
    'HTTP_X_CLIENT_IP',          // Proxy alternativo
    'HTTP_X_CLUSTER_CLIENT_IP',  // Cluster
    'REMOTE_ADDR',               // Fallback direto
];

foreach ($ipHeaders as $header) {
    if (!empty($_SERVER[$header])) {
        // X-Forwarded-For pode ter múltiplos IPs: "client, proxy1, proxy2"
        $ip = explode(',', $_SERVER[$header])[0];
        $ip = trim($ip);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            $clientIp = $ip;
            break;
        }
    }
}

// Se nenhum IP público foi encontrado, usar REMOTE_ADDR como fallback
if ($clientIp === 'unknown') {
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
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
            'X-Forwarded-For: ' . $clientIp,
            'X-Real-IP: ' . $clientIp,
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
