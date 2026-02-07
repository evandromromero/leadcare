<?php
/**
 * Meta OAuth Callback - WhatsApp, Facebook e Instagram
 * Belitx CRM
 * 
 * Este arquivo recebe o callback OAuth da Meta e salva os tokens no Supabase.
 * 
 * URLs para configurar no Meta:
 * - https://belitx.com.br/api/meta-callback.php
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
    $result = supabaseRequest('settings?select=meta_app_id,meta_app_secret,instagram_app_id,instagram_app_secret&limit=1');
    if ($result['status'] === 200 && !empty($result['data'])) {
        return $result['data'][0];
    }
    return null;
}

// Função para trocar code por access token (Facebook/Instagram)
function exchangeCodeForToken($code, $redirectUri, $isInstagram = false) {
    $config = getMetaAppConfig();
    
    if ($isInstagram) {
        // Instagram usa endpoints e credenciais diferentes
        if (!$config || empty($config['instagram_app_id']) || empty($config['instagram_app_secret'])) {
            throw new Exception('Instagram App não configurado. Configure em Admin → Integrações');
        }
        
        // Instagram OAuth usa endpoint diferente
        $url = 'https://api.instagram.com/oauth/access_token';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'client_id' => $config['instagram_app_id'],
            'client_secret' => $config['instagram_app_secret'],
            'grant_type' => 'authorization_code',
            'redirect_uri' => $redirectUri,
            'code' => $code
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        
        if (isset($data['error_message'])) {
            throw new Exception($data['error_message'] ?? 'Erro ao obter token do Instagram');
        }
        
        return [
            'access_token' => $data['access_token'],
            'user_id' => $data['user_id']
        ];
    } else {
        // Facebook OAuth
        if (!$config || empty($config['meta_app_id']) || empty($config['meta_app_secret'])) {
            throw new Exception('Meta App não configurado. Configure em Admin → Integrações');
        }
        
        $url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
            'client_id' => $config['meta_app_id'],
            'redirect_uri' => $redirectUri,
            'client_secret' => $config['meta_app_secret'],
            'code' => $code
        ]);
        
        $response = file_get_contents($url);
        $data = json_decode($response, true);
        
        if (isset($data['error'])) {
            throw new Exception($data['error']['message'] ?? 'Erro ao obter token');
        }
        
        return $data['access_token'];
    }
}

// Função para obter token de longa duração (Facebook)
function getLongLivedToken($shortToken) {
    $config = getMetaAppConfig();
    
    $url = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
        'grant_type' => 'fb_exchange_token',
        'client_id' => $config['meta_app_id'],
        'client_secret' => $config['meta_app_secret'],
        'fb_exchange_token' => $shortToken
    ]);
    
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    
    return $data['access_token'] ?? $shortToken;
}

// Função para obter token de longa duração do Instagram
function getInstagramLongLivedToken($shortToken) {
    $config = getMetaAppConfig();
    
    $url = 'https://graph.instagram.com/access_token?' . http_build_query([
        'grant_type' => 'ig_exchange_token',
        'client_secret' => $config['instagram_app_secret'],
        'access_token' => $shortToken
    ]);
    
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    
    return $data['access_token'] ?? $shortToken;
}

// Função para buscar informações do usuário do Instagram
function getInstagramUserInfo($accessToken) {
    $url = "https://graph.instagram.com/me?fields=id,username&access_token={$accessToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Função para buscar páginas do Facebook
function getFacebookPages($accessToken) {
    $url = "https://graph.facebook.com/v18.0/me/accounts?access_token={$accessToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Função para buscar Instagram Business Account de uma página
function getInstagramAccount($pageId, $pageToken) {
    $url = "https://graph.facebook.com/v18.0/{$pageId}?fields=instagram_business_account&access_token={$pageToken}";
    $response = file_get_contents($url);
    return json_decode($response, true);
}

// Função para inscrever página/instagram no webhook
function subscribeToWebhook($id, $token, $type = 'page') {
    $fields = $type === 'instagram' 
        ? 'messages,messaging_postbacks,messaging_seen,message_reactions'
        : 'messages,messaging_postbacks,message_deliveries,message_reads,messaging_referrals,message_echoes';
    
    $url = "https://graph.facebook.com/v18.0/{$id}/subscribed_apps?subscribed_fields={$fields}&access_token={$token}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Função para exibir página de sucesso
function showSuccessPage($message = 'Conectado com sucesso!') {
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Conectado!</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #10b981; margin: 0 0 8px 0; }
            p { color: #64748b; margin: 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">✅</div>
            <h1><?php echo htmlspecialchars($message); ?></h1>
            <p>Esta janela será fechada automaticamente...</p>
        </div>
        <script>
            setTimeout(() => {
                if (window.opener) {
                    window.opener.postMessage({ type: 'META_CONNECTED', success: true }, '*');
                }
                window.close();
            }, 1500);
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
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">❌</div>
            <h1>Erro ao conectar</h1>
            <p><?php echo htmlspecialchars($error); ?></p>
            <button onclick="window.close()">Fechar</button>
        </div>
        <script>
            if (window.opener) {
                window.opener.postMessage({ type: 'META_CONNECTED', success: false, error: '<?php echo addslashes($error); ?>' }, '*');
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

try {
    // Verificar se é callback com erro
    if (isset($_GET['error'])) {
        $errorDesc = $_GET['error_description'] ?? 'Autorização negada';
        showErrorPage($errorDesc);
    }
    
    // Verificar se tem code (callback OAuth)
    if (!isset($_GET['code'])) {
        // Sem code = apenas verificação de URL
        echo 'OK';
        exit;
    }
    
    $code = $_GET['code'];
    $state = $_GET['state'] ?? ''; // clinic_id ou clinic_id_instagram
    
    // Detectar se é conexão do Instagram pelo state (termina com _instagram)
    // ou pelo referer (vem de instagram.com)
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $isInstagramOAuth = strpos($referer, 'instagram.com') !== false;
    $isInstagramFromFacebook = strpos($state, '_instagram') !== false;
    
    // Extrair clinic_id do state (remover _instagram se existir)
    $clinicId = str_replace('_instagram', '', $state);
    
    // Determinar redirect_uri
    $redirectUri = FRONTEND_URL . '/api/meta-callback.php';
    
    if ($isInstagramOAuth) {
        // ============================================
        // FLUXO INSTAGRAM (Login do Instagram)
        // ============================================
        
        // Trocar code por access token do Instagram
        $tokenData = exchangeCodeForToken($code, $redirectUri, true);
        $shortToken = $tokenData['access_token'];
        $userId = $tokenData['user_id'];
        
        // Obter token de longa duração do Instagram
        $longToken = getInstagramLongLivedToken($shortToken);
        
        // Buscar informações do usuário
        $userInfo = getInstagramUserInfo($longToken);
        $username = $userInfo['username'] ?? '';
        
        // Salvar no banco se tiver clinic_id
        if (!empty($clinicId)) {
            $updateData = [
                'instagram_business_account_id' => $userId,
                'instagram_username' => $username,
                'instagram_access_token' => $longToken,
                'instagram_enabled' => true,
                'instagram_connected_at' => date('c')
            ];
            
            supabaseRequest("clinics?id=eq.{$clinicId}", 'PATCH', $updateData);
        }
        
        showSuccessPage('Instagram conectado!');
        
    } else {
        // ============================================
        // FLUXO FACEBOOK (Facebook Login)
        // ============================================
        
        // Trocar code por access token
        $shortToken = exchangeCodeForToken($code, $redirectUri, false);
        
        // Obter token de longa duração
        $longToken = getLongLivedToken($shortToken);
        
        // Buscar páginas do Facebook
        $pagesData = getFacebookPages($longToken);
        $pages = $pagesData['data'] ?? [];
        
        $instagramAccounts = [];
        
        // Para cada página, buscar Instagram e inscrever no webhook
        foreach ($pages as $page) {
            // Buscar Instagram Business Account
            $igData = getInstagramAccount($page['id'], $page['access_token']);
            if (isset($igData['instagram_business_account'])) {
                $igId = $igData['instagram_business_account']['id'];
                $instagramAccounts[] = [
                    'page_id' => $page['id'],
                    'page_name' => $page['name'],
                    'page_access_token' => $page['access_token'],
                    'instagram_id' => $igId
                ];
                
                // Inscrever Instagram no webhook
                subscribeToWebhook($igId, $page['access_token'], 'instagram');
            }
            
            // Inscrever página no webhook do Messenger
            subscribeToWebhook($page['id'], $page['access_token'], 'page');
        }
        
        // Salvar no banco se tiver clinic_id
        if (!empty($clinicId)) {
            $firstPage = $pages[0] ?? null;
            $firstInstagram = $instagramAccounts[0] ?? null;
            
            // Se veio do fluxo Instagram (via Facebook OAuth), priorizar dados do Instagram
            if ($isInstagramFromFacebook && !empty($firstInstagram)) {
                // Buscar username do Instagram
                $igUsername = '';
                try {
                    $igInfoUrl = "https://graph.facebook.com/v18.0/{$firstInstagram['instagram_id']}?fields=username&access_token={$firstInstagram['page_access_token']}";
                    $igInfoResponse = file_get_contents($igInfoUrl);
                    $igInfo = json_decode($igInfoResponse, true);
                    $igUsername = $igInfo['username'] ?? '';
                } catch (Exception $e) {}
                
                $updateData = [
                    'facebook_page_id' => $firstPage['id'] ?? null,
                    'facebook_page_name' => $firstPage['name'] ?? null,
                    'facebook_page_access_token' => $firstPage['access_token'] ?? null,
                    'facebook_user_access_token' => $longToken,
                    'instagram_business_account_id' => $firstInstagram['instagram_id'],
                    'instagram_username' => $igUsername,
                    'instagram_access_token' => $firstPage['access_token'] ?? null,
                    'instagram_enabled' => true,
                    'facebook_enabled' => !empty($firstPage),
                    'instagram_connected_at' => date('c'),
                    'meta_connected_at' => date('c')
                ];
            } else {
                // Fluxo Facebook normal
                $updateData = [
                    'facebook_page_id' => $firstPage['id'] ?? null,
                    'facebook_page_name' => $firstPage['name'] ?? null,
                    'facebook_page_access_token' => $firstPage['access_token'] ?? null,
                    'facebook_user_access_token' => $longToken,
                    'instagram_business_account_id' => $firstInstagram['instagram_id'] ?? null,
                    'instagram_enabled' => !empty($firstInstagram),
                    'facebook_enabled' => !empty($firstPage),
                    'meta_connected_at' => date('c')
                ];
            }
            
            supabaseRequest("clinics?id=eq.{$clinicId}", 'PATCH', $updateData);
        }
        
        $successMsg = $isInstagramFromFacebook ? 'Instagram conectado!' : 'Facebook conectado!';
        showSuccessPage($successMsg);
    }
    
} catch (Exception $e) {
    error_log('Meta OAuth Error: ' . $e->getMessage());
    showErrorPage($e->getMessage());
}
