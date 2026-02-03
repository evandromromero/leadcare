<?php
/**
 * WhatsApp Embedded Signup Callback
 * Belitx CRM
 * 
 * Este arquivo recebe o callback do Embedded Signup do WhatsApp Business API.
 * 
 * URL para configurar no Meta:
 * - https://belitx.com.br/api/whatsapp-callback.php
 * 
 * Fluxo:
 * 1. Usuário clica em "Conectar WhatsApp" no Belitx
 * 2. Abre popup com Embedded Signup da Meta
 * 3. Usuário autoriza e Meta redireciona para este callback
 * 4. Este script troca o code por tokens e salva no Supabase
 * 5. Fecha popup e notifica a janela pai
 */

// Configurações do Supabase
define('SUPABASE_URL', 'https://opuepzfqizmamdegdhbs.supabase.co');
define('SUPABASE_SERVICE_KEY', 'sb_secret_PPWGt1SMbZ5Ur2OXLXDYaQ_ri9ZvVPn');
define('FRONTEND_URL', 'https://belitx.com.br');

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
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

// Função para buscar configurações do Meta App
function getMetaAppConfig() {
    $result = supabaseRequest('settings?select=meta_app_id,meta_app_secret,meta_system_user_token&limit=1');
    if ($result['status'] === 200 && !empty($result['data'])) {
        return $result['data'][0];
    }
    return null;
}

// Função para trocar code por access token (WhatsApp Embedded Signup)
function exchangeCodeForToken($code, $redirectUri) {
    $config = getMetaAppConfig();
    if (!$config || empty($config['meta_app_id']) || empty($config['meta_app_secret'])) {
        throw new Exception('Meta App não configurado. Configure em Admin → Integrações');
    }
    
    $url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
        'client_id' => $config['meta_app_id'],
        'redirect_uri' => $redirectUri,
        'client_secret' => $config['meta_app_secret'],
        'code' => $code
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if (isset($data['error'])) {
        throw new Exception($data['error']['message'] ?? 'Erro ao obter token');
    }
    
    return $data['access_token'];
}

// Função para obter WABAs compartilhados com o app
function getSharedWABAs($accessToken) {
    // Buscar WABAs compartilhados via Business Management API
    $url = "https://graph.facebook.com/v18.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token={$accessToken}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    error_log('Shared WABAs response: ' . json_encode($data));
    
    return $data;
}

// Função para buscar WABA diretamente do debug token
function getWABAFromToken($accessToken) {
    // Debug token para ver granular_scopes
    $url = "https://graph.facebook.com/v18.0/debug_token?input_token={$accessToken}&access_token={$accessToken}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    error_log('Debug token response: ' . json_encode($data));
    
    // Extrair WABA ID dos granular_scopes
    $wabaId = null;
    if (isset($data['data']['granular_scopes'])) {
        foreach ($data['data']['granular_scopes'] as $scope) {
            if ($scope['scope'] === 'whatsapp_business_messaging' && !empty($scope['target_ids'])) {
                $wabaId = $scope['target_ids'][0];
                break;
            }
            if ($scope['scope'] === 'whatsapp_business_management' && !empty($scope['target_ids'])) {
                $wabaId = $scope['target_ids'][0];
            }
        }
    }
    
    return $wabaId;
}

// Função para buscar números de telefone do WABA
function getPhoneNumbers($wabaId, $accessToken) {
    $url = "https://graph.facebook.com/v18.0/{$wabaId}/phone_numbers?access_token={$accessToken}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Função para registrar webhook do WhatsApp
function subscribeWhatsAppWebhook($wabaId, $accessToken) {
    $webhookUrl = SUPABASE_URL . '/functions/v1/whatsapp-cloud-webhook';
    
    $url = "https://graph.facebook.com/v18.0/{$wabaId}/subscribed_apps";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Função para iniciar sincronização de histórico (Coexistência)
function startHistorySync($phoneNumberId, $accessToken) {
    // Iniciar sincronização de contatos
    $contactsUrl = "https://graph.facebook.com/v18.0/{$phoneNumberId}/smb_app_data";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $contactsUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'messaging_product' => 'whatsapp',
        'sync_type' => 'smb_app_state_sync'
    ]));
    $contactsResponse = curl_exec($ch);
    curl_close($ch);
    
    error_log('Contacts sync response: ' . $contactsResponse);
    
    // Iniciar sincronização de histórico de mensagens
    $historyUrl = "https://graph.facebook.com/v18.0/{$phoneNumberId}/smb_app_data";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $historyUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'messaging_product' => 'whatsapp',
        'sync_type' => 'history'
    ]));
    $historyResponse = curl_exec($ch);
    curl_close($ch);
    
    error_log('History sync response: ' . $historyResponse);
    
    return true;
}

// Função para exibir página de sucesso
function showSuccessPage($phoneNumber = '', $wabaName = '') {
    $message = 'WhatsApp conectado com sucesso!';
    if ($phoneNumber) {
        $message .= " Número: {$phoneNumber}";
    }
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Conectado!</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #25D366; margin: 0 0 8px 0; font-size: 24px; }
            p { color: #64748b; margin: 0; }
            .phone { font-size: 18px; font-weight: bold; color: #1e293b; margin-top: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">✅</div>
            <h1>WhatsApp Conectado!</h1>
            <p>Sua conta do WhatsApp Business foi conectada com sucesso.</p>
            <?php if ($phoneNumber): ?>
            <p class="phone"><?php echo htmlspecialchars($phoneNumber); ?></p>
            <?php endif; ?>
            <p style="margin-top: 16px; font-size: 14px;">Esta janela será fechada automaticamente...</p>
        </div>
        <script>
            setTimeout(() => {
                if (window.opener) {
                    window.opener.postMessage({ 
                        type: 'WHATSAPP_CONNECTED', 
                        success: true,
                        phone: '<?php echo addslashes($phoneNumber); ?>'
                    }, '*');
                }
                window.close();
            }, 2000);
        </script>
    </body>
    </html>
    <?php
    exit;
}

// Função para exibir página de erro
function showErrorPage($error) {
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Erro</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #ef4444; margin: 0 0 8px 0; }
            p { color: #64748b; margin: 0; word-break: break-word; }
            button { margin-top: 20px; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
            .details { margin-top: 16px; padding: 12px; background: #fef2f2; border-radius: 8px; font-size: 12px; text-align: left; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">❌</div>
            <h1>Erro ao conectar WhatsApp</h1>
            <p><?php echo htmlspecialchars($error); ?></p>
            <button onclick="window.close()">Fechar</button>
        </div>
        <script>
            if (window.opener) {
                window.opener.postMessage({ 
                    type: 'WHATSAPP_CONNECTED', 
                    success: false, 
                    error: '<?php echo addslashes($error); ?>' 
                }, '*');
            }
        </script>
    </body>
    </html>
    <?php
    exit;
}

// ============================================
// PROCESSAMENTO PRINCIPAL
// ============================================

// Log para debug
error_log('WhatsApp Callback - Method: ' . $_SERVER['REQUEST_METHOD']);
error_log('WhatsApp Callback - GET: ' . json_encode($_GET));

// Processar POST do Embedded Signup (SDK do Facebook)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    error_log('WhatsApp Callback POST: ' . $input);
    
    if (empty($data['code']) || empty($data['clinic_id'])) {
        echo json_encode(['success' => false, 'error' => 'Parâmetros inválidos']);
        exit;
    }
    
    $code = $data['code'];
    $state = $data['clinic_id'];
    $mode = $data['mode'] ?? 'new'; // 'new' ou 'coexistence'
    $isCoexistence = ($mode === 'coexistence');
    
    try {
        // Redirect URI para Embedded Signup
        $redirectUri = FRONTEND_URL . '/api/whatsapp-callback.php';
        
        // Trocar code por access token
        $accessToken = exchangeCodeForToken($code, $redirectUri);
        
        if (empty($accessToken)) {
            throw new Exception('Não foi possível obter o token de acesso');
        }
        
        // Buscar WABA ID e phone_number_id
        $wabaId = getWABAFromToken($accessToken);
        $phoneNumberId = null;
        $phoneNumber = '';
        
        if ($wabaId) {
            $phoneNumbers = getPhoneNumbers($wabaId, $accessToken);
            if (!empty($phoneNumbers['data'])) {
                $firstPhone = $phoneNumbers['data'][0];
                $phoneNumberId = $firstPhone['id'];
                $phoneNumber = $firstPhone['display_phone_number'] ?? '';
            }
            
            // Inscrever no webhook
            subscribeWhatsAppWebhook($wabaId, $accessToken);
        }
        
        // Salvar no banco
        $updateData = [
            'cloud_api_enabled' => true,
            'cloud_api_access_token' => $accessToken,
            'cloud_api_phone_number_id' => $phoneNumberId,
            'cloud_api_waba_id' => $wabaId,
            'cloud_api_phone_number' => $phoneNumber,
            'cloud_api_connected_at' => date('c'),
            'cloud_api_verify_token' => 'leadcare_' . bin2hex(random_bytes(8)),
            'cloud_api_coexistence' => $isCoexistence
        ];
        
        $result = supabaseRequest("clinics?id=eq.{$state}", 'PATCH', $updateData);
        
        if ($result['status'] >= 400) {
            throw new Exception('Erro ao salvar no banco');
        }
        
        // Se coexistência, iniciar sincronização de histórico
        if ($isCoexistence && $phoneNumberId && $accessToken) {
            // Chamar endpoint de sincronização (assíncrono)
            startHistorySync($phoneNumberId, $accessToken);
        }
        
        echo json_encode([
            'success' => true,
            'waba_id' => $wabaId,
            'phone_number_id' => $phoneNumberId,
            'phone_number' => $phoneNumber,
            'coexistence' => $isCoexistence
        ]);
        exit;
        
    } catch (Exception $e) {
        error_log('WhatsApp Callback POST Error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
}

try {
    // Verificar se é callback com erro
    if (isset($_GET['error'])) {
        $errorDesc = $_GET['error_description'] ?? $_GET['error_reason'] ?? 'Autorização negada';
        showErrorPage($errorDesc);
    }
    
    // Verificar se tem code (callback OAuth GET)
    if (!isset($_GET['code'])) {
        // Sem code = apenas verificação de URL
        echo 'OK - WhatsApp Callback Ready';
        exit;
    }
    
    $code = $_GET['code'];
    $state = $_GET['state'] ?? ''; // clinic_id
    
    // Redirect URI deve ser exatamente o mesmo usado na URL de autorização
    $redirectUri = FRONTEND_URL . '/api/whatsapp-callback.php';
    
    // Trocar code por access token
    $accessToken = exchangeCodeForToken($code, $redirectUri);
    
    if (empty($accessToken)) {
        throw new Exception('Não foi possível obter o token de acesso');
    }
    
    // Tentar buscar WABA ID dos parâmetros ou do token
    $wabaId = $_GET['waba_id'] ?? null;
    $phoneNumberId = $_GET['phone_number_id'] ?? null;
    $phoneNumber = '';
    $wabaName = '';
    
    // Se não veio nos parâmetros, buscar do debug token
    if (!$wabaId) {
        $wabaId = getWABAFromToken($accessToken);
        error_log('WABA ID from debug token: ' . $wabaId);
    }
    
    // Se ainda não tem, buscar dos businesses compartilhados
    if (!$wabaId) {
        $businesses = getSharedWABAs($accessToken);
        if (!empty($businesses['data'])) {
            foreach ($businesses['data'] as $business) {
                if (!empty($business['owned_whatsapp_business_accounts']['data'])) {
                    $waba = $business['owned_whatsapp_business_accounts']['data'][0];
                    $wabaId = $waba['id'];
                    $wabaName = $waba['name'] ?? '';
                    
                    if (!empty($waba['phone_numbers']['data'])) {
                        $phone = $waba['phone_numbers']['data'][0];
                        $phoneNumberId = $phone['id'];
                        $phoneNumber = $phone['display_phone_number'] ?? '';
                    }
                    break;
                }
            }
        }
    }
    
    // Se temos WABA ID mas não temos phone_number_id, buscar
    if ($wabaId && !$phoneNumberId) {
        $phoneNumbers = getPhoneNumbers($wabaId, $accessToken);
        error_log('Phone numbers response: ' . json_encode($phoneNumbers));
        
        if (!empty($phoneNumbers['data'])) {
            $firstPhone = $phoneNumbers['data'][0];
            $phoneNumberId = $firstPhone['id'];
            $phoneNumber = $firstPhone['display_phone_number'] ?? $firstPhone['verified_name'] ?? '';
        }
    }
    
    // Inscrever no webhook se temos WABA ID
    if ($wabaId) {
        $webhookResult = subscribeWhatsAppWebhook($wabaId, $accessToken);
        error_log('Webhook subscription result: ' . json_encode($webhookResult));
    }
    
    error_log('Final values - WABA: ' . $wabaId . ', Phone ID: ' . $phoneNumberId . ', Phone: ' . $phoneNumber);
    
    // Salvar no banco se tiver clinic_id
    if (!empty($state)) {
        $updateData = [
            'cloud_api_enabled' => true,
            'cloud_api_access_token' => $accessToken,
            'cloud_api_phone_number_id' => $phoneNumberId,
            'cloud_api_waba_id' => $wabaId,
            'cloud_api_phone_number' => $phoneNumber,
            'cloud_api_connected_at' => date('c'),
            'cloud_api_verify_token' => 'leadcare_' . bin2hex(random_bytes(8))
        ];
        
        $result = supabaseRequest("clinics?id=eq.{$state}", 'PATCH', $updateData);
        
        if ($result['status'] >= 400) {
            error_log('Erro ao salvar no Supabase: ' . json_encode($result));
        }
    }
    
    showSuccessPage($phoneNumber, $wabaName);
    
} catch (Exception $e) {
    error_log('WhatsApp OAuth Error: ' . $e->getMessage());
    showErrorPage($e->getMessage());
}
