<?php
/**
 * Router para /w/ - Belitx
 * Este arquivo deve ser colocado na raiz do public_html
 * e o .htaccess deve redirecionar /w/* para este arquivo
 */

// Pegar o código da URL ou do parâmetro
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);
$code = null;

// Verificar se é uma requisição para /w/
if (preg_match('/^\/w\/(.+)$/', $path, $matches)) {
    $code = $matches[1];
} elseif (isset($_GET['code'])) {
    // Fallback: pegar do parâmetro code
    $code = $_GET['code'];
}

if ($code) {
    // Remover 'code' da query string para não duplicar
    $queryString = $_SERVER['QUERY_STRING'] ?? '';
    $queryString = preg_replace('/(&?)code=[^&]*/', '', $queryString);
    $queryString = ltrim($queryString, '&');
    
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
        header('Location: https://belitx.com.br');
        exit;
    }
    
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo $html;
    exit;
}

// Se não for /w/, deixar o React lidar
?>
