<?php
// Teste simples de webhook
// PHP converte hub.mode para hub_mode automaticamente

$mode = $_GET['hub_mode'] ?? '';
$token = $_GET['hub_verify_token'] ?? '';
$challenge = $_GET['hub_challenge'] ?? '';

// Log para debug
error_log("Webhook test: mode=$mode, token=$token, challenge=$challenge");

// Aceitar qualquer subscribe com o token correto
if ($mode === 'subscribe' && $token === 'belitx_meta_webhook_2024') {
    http_response_code(200);
    echo $challenge;
    exit;
}

// Fallback - aceitar qualquer subscribe
if ($mode === 'subscribe' && !empty($challenge)) {
    http_response_code(200);
    echo $challenge;
    exit;
}

http_response_code(403);
echo 'Forbidden - mode:' . $mode . ' token:' . $token;
