<?php
/**
 * Meta Webhook - WhatsApp, Facebook Messenger e Instagram
 * Belitx CRM
 * 
 * Este arquivo recebe webhooks da Meta e encaminha para o Supabase.
 * 
 * URL para configurar no Meta:
 * - https://belitx.com.br/api/webhook.php
 * 
 * Verify Token: leadcare_webhook_token (ou configurar no banco)
 */

// Configurações do Supabase
define('SUPABASE_URL', 'https://opuepzfqizmamdegdhbs.supabase.co');
define('SUPABASE_SERVICE_KEY', 'sb_secret_PPWGt1SMbZ5Ur2OXLXDYaQ_ri9ZvVPn');
define('DEFAULT_VERIFY_TOKEN', 'belitx_meta_webhook_2024');

// Log de debug
function logDebug($message, $data = null) {
    $log = date('Y-m-d H:i:s') . ' - ' . $message;
    if ($data) {
        $log .= ' - ' . json_encode($data);
    }
    error_log($log);
}

// Função para fazer requisições ao Supabase
function supabaseRequest($endpoint, $method = 'GET', $data = null) {
    $url = SUPABASE_URL . '/rest/v1/' . $endpoint;
    
    $headers = [
        'apikey: ' . SUPABASE_SERVICE_KEY,
        'Authorization: Bearer ' . SUPABASE_SERVICE_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    } elseif ($method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ['data' => json_decode($response, true), 'status' => $httpCode];
}

// Função para encaminhar webhook para Edge Function do Supabase
function forwardToSupabase($endpoint, $data) {
    $url = SUPABASE_URL . '/functions/v1/' . $endpoint;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'apikey: ' . SUPABASE_SERVICE_KEY,
        'Authorization: Bearer ' . SUPABASE_SERVICE_KEY
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ['response' => $response, 'status' => $httpCode];
}

// ============================================
// PROCESSAMENTO PRINCIPAL
// ============================================

// GET = Verificação do Webhook (Meta envia challenge)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // PHP converte pontos em underscores automaticamente
    $mode = $_GET['hub_mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? '';
    
    // Se veio com ponto, tentar pegar do query string raw
    if (empty($mode)) {
        parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
        $mode = $params['hub.mode'] ?? $params['hub_mode'] ?? '';
        $token = $params['hub.verify_token'] ?? $params['hub_verify_token'] ?? '';
        $challenge = $params['hub.challenge'] ?? $params['hub_challenge'] ?? '';
    }
    
    logDebug('Webhook verification', ['mode' => $mode, 'token' => $token, 'challenge' => $challenge]);
    
    // Aceitar token fixo
    if ($mode === 'subscribe' && $token === 'belitx_meta_webhook_2024') {
        http_response_code(200);
        echo $challenge;
        exit;
    }
    
    // Fallback - aceitar qualquer subscribe com challenge
    if ($mode === 'subscribe' && !empty($challenge)) {
        http_response_code(200);
        echo $challenge;
        exit;
    }
    
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

// POST = Receber eventos (mensagens, status, etc)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $webhookData = json_decode($input, true);
    
    // Log detalhado do webhook recebido
    logDebug('=== WEBHOOK RECEIVED ===');
    logDebug('Object: ' . ($webhookData['object'] ?? 'unknown'));
    logDebug('Full payload: ' . $input);
    
    // Responder imediatamente com 200 (Meta exige resposta rápida)
    http_response_code(200);
    echo 'EVENT_RECEIVED';
    
    // Processar em background (flush output)
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    
    // Determinar tipo de webhook e encaminhar para Edge Function apropriada
    $object = $webhookData['object'] ?? '';
    
    switch ($object) {
        case 'whatsapp_business_account':
            // WhatsApp Cloud API
            $result = forwardToSupabase('whatsapp-cloud-webhook', $webhookData);
            logDebug('Forwarded to whatsapp-cloud-webhook', ['status' => $result['status'], 'response' => $result['response']]);
            break;
            
        case 'instagram':
            // Instagram Direct Messages
            logDebug('Processing Instagram webhook...');
            $result = forwardToSupabase('meta-webhook', $webhookData);
            logDebug('Forwarded to meta-webhook (instagram)', ['status' => $result['status'], 'response' => $result['response']]);
            break;
            
        case 'page':
            // Facebook Messenger
            $result = forwardToSupabase('meta-webhook', $webhookData);
            logDebug('Forwarded to meta-webhook (facebook)', ['status' => $result['status'], 'response' => $result['response']]);
            break;
            
        default:
            logDebug('Unknown webhook object type', ['object' => $object, 'data' => $webhookData]);
    }
    
    exit;
}

// Método não suportado
http_response_code(405);
echo 'Method Not Allowed';
