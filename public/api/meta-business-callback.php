<?php
/**
 * Meta Business Manager OAuth Callback
 * Fluxo unificado para conectar WhatsApp, Instagram e Facebook de uma vez
 */

// Headers CORS (Content-Type será definido depois baseado no tipo de resposta)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Definir Content-Type baseado no método
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
}

// Configurações
$supabaseUrl = 'https://opuepzfqizmamdegdhbs.supabase.co';
$supabaseKey = 'sb_secret_PPWGt1SMbZ5Ur2OXLXDYaQ_ri9ZvVPn';

// Buscar configurações do Meta
function getMetaConfig() {
    global $supabaseUrl, $supabaseKey;
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "$supabaseUrl/rest/v1/settings?select=meta_app_id,meta_app_secret",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "apikey: $supabaseKey",
            "Authorization: Bearer $supabaseKey"
        ]
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    return $data[0] ?? null;
}

// Trocar code por access token
function exchangeCodeForToken($code, $redirectUri) {
    $config = getMetaConfig();
    if (!$config) {
        return ['error' => 'Configuração Meta não encontrada'];
    }
    
    $url = "https://graph.facebook.com/v18.0/oauth/access_token?" . http_build_query([
        'client_id' => $config['meta_app_id'],
        'client_secret' => $config['meta_app_secret'],
        'redirect_uri' => $redirectUri,
        'code' => $code
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Buscar todos os ativos do Business Manager
function fetchBusinessAssets($accessToken) {
    $assets = [
        'businesses' => [],
        'whatsapp_accounts' => [],
        'pages' => [],
        'instagram_accounts' => []
    ];
    
    // 1. Buscar businesses do usuário
    $businessesUrl = "https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=$accessToken";
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $businessesUrl,
        CURLOPT_RETURNTRANSFER => true
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    $businessesData = json_decode($response, true);
    
    if (isset($businessesData['data'])) {
        $assets['businesses'] = $businessesData['data'];
        
        // Para cada business, buscar WhatsApp Business Accounts
        foreach ($businessesData['data'] as $business) {
            $wabaUrl = "https://graph.facebook.com/v18.0/{$business['id']}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}&access_token=$accessToken";
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $wabaUrl,
                CURLOPT_RETURNTRANSFER => true
            ]);
            $wabaResponse = curl_exec($ch);
            curl_close($ch);
            $wabaData = json_decode($wabaResponse, true);
            
            if (isset($wabaData['data'])) {
                foreach ($wabaData['data'] as $waba) {
                    $waba['business_id'] = $business['id'];
                    $waba['business_name'] = $business['name'];
                    $assets['whatsapp_accounts'][] = $waba;
                }
            }
        }
    }
    
    // 2. Buscar páginas do Facebook
    $pagesUrl = "https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=$accessToken";
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $pagesUrl,
        CURLOPT_RETURNTRANSFER => true
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    $pagesData = json_decode($response, true);
    
    if (isset($pagesData['data'])) {
        foreach ($pagesData['data'] as $page) {
            $assets['pages'][] = [
                'id' => $page['id'],
                'name' => $page['name'],
                'access_token' => $page['access_token']
            ];
            
            // Se a página tem Instagram conectado
            if (isset($page['instagram_business_account'])) {
                $assets['instagram_accounts'][] = [
                    'id' => $page['instagram_business_account']['id'],
                    'username' => $page['instagram_business_account']['username'] ?? null,
                    'page_id' => $page['id'],
                    'page_name' => $page['name'],
                    'page_access_token' => $page['access_token']
                ];
            }
        }
    }
    
    return $assets;
}

// Salvar ativos selecionados no banco
function saveSelectedAssets($clinicId, $assets, $accessToken) {
    global $supabaseUrl, $supabaseKey;
    
    $updateData = [
        'meta_access_token' => $accessToken,
        'meta_connected_at' => date('c')
    ];
    
    // WhatsApp
    if (isset($assets['whatsapp']) && $assets['whatsapp']) {
        $updateData['cloud_api_enabled'] = true;
        $updateData['cloud_api_waba_id'] = $assets['whatsapp']['waba_id'];
        $updateData['cloud_api_phone_number_id'] = $assets['whatsapp']['phone_number_id'];
        $updateData['cloud_api_phone_number'] = $assets['whatsapp']['phone_number'];
        $updateData['cloud_api_access_token'] = $accessToken;
        $updateData['cloud_api_connected_at'] = date('c');
    }
    
    // Facebook
    if (isset($assets['facebook']) && $assets['facebook']) {
        $updateData['facebook_enabled'] = true;
        $updateData['facebook_page_id'] = $assets['facebook']['page_id'];
        $updateData['facebook_page_name'] = $assets['facebook']['page_name'];
        $updateData['facebook_page_access_token'] = $assets['facebook']['page_access_token'];
    }
    
    // Instagram
    if (isset($assets['instagram']) && $assets['instagram']) {
        $updateData['instagram_enabled'] = true;
        $updateData['instagram_business_account_id'] = $assets['instagram']['account_id'];
        $updateData['instagram_username'] = $assets['instagram']['username'];
        $updateData['instagram_access_token'] = $assets['instagram']['access_token'];
        $updateData['instagram_connected_at'] = date('c');
    }
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "$supabaseUrl/rest/v1/clinics?id=eq.$clinicId",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PATCH',
        CURLOPT_POSTFIELDS => json_encode($updateData),
        CURLOPT_HTTPHEADER => [
            "apikey: $supabaseKey",
            "Authorization: Bearer $supabaseKey",
            "Content-Type: application/json",
            "Prefer: return=minimal"
        ]
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['success' => true];
    } else {
        return [
            'success' => false, 
            'error' => "HTTP $httpCode: " . ($response ?: $curlError)
        ];
    }
}

// Subscrever webhooks para os ativos
function subscribeWebhooks($assets, $accessToken) {
    // Subscrever webhook do WhatsApp
    if (isset($assets['whatsapp']) && $assets['whatsapp']) {
        $wabaId = $assets['whatsapp']['waba_id'];
        $url = "https://graph.facebook.com/v18.0/$wabaId/subscribed_apps";
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'access_token' => $accessToken
            ])
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
    
    // Subscrever webhook da página do Facebook
    if (isset($assets['facebook']) && $assets['facebook']) {
        $pageId = $assets['facebook']['page_id'];
        $pageToken = $assets['facebook']['page_access_token'];
        $url = "https://graph.facebook.com/v18.0/$pageId/subscribed_apps";
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'subscribed_fields' => 'messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads',
                'access_token' => $pageToken
            ])
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
}

// ========== MAIN ==========

// GET: OAuth callback - trocar code por token e buscar ativos
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
    $code = $_GET['code'];
    $clinicId = $_GET['state'] ?? null;
    
    if (!$clinicId) {
        showErrorPage('Clinic ID não encontrado');
        exit;
    }
    
    $redirectUri = 'https://belitx.com.br/api/meta-business-callback.php';
    $tokenData = exchangeCodeForToken($code, $redirectUri);
    
    // Debug: verificar resposta do token
    if (!$tokenData || !isset($tokenData['access_token'])) {
        $errorMsg = 'Erro desconhecido';
        if (isset($tokenData['error'])) {
            if (is_array($tokenData['error'])) {
                $errorMsg = $tokenData['error']['message'] ?? json_encode($tokenData['error']);
            } else {
                $errorMsg = $tokenData['error'];
            }
            if (isset($tokenData['error_description'])) {
                $errorMsg .= ' - ' . $tokenData['error_description'];
            }
        } elseif ($tokenData === null) {
            $errorMsg = 'Resposta vazia da API do Facebook';
        } else {
            $errorMsg = 'Resposta inesperada: ' . json_encode($tokenData);
        }
        showErrorPage('Erro ao obter token: ' . $errorMsg);
        exit;
    }
    
    $accessToken = $tokenData['access_token'];
    
    // Buscar todos os ativos disponíveis
    $assets = fetchBusinessAssets($accessToken);
    
    // Mostrar página de seleção de ativos
    showAssetSelectionPage($clinicId, $accessToken, $assets);
    exit;
}

// POST: Salvar ativos selecionados
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $clinicId = $input['clinic_id'] ?? null;
    $accessToken = $input['access_token'] ?? null;
    $selectedAssets = $input['selected_assets'] ?? [];
    
    if (!$clinicId || !$accessToken) {
        echo json_encode(['success' => false, 'error' => 'Dados incompletos']);
        exit;
    }
    
    // Salvar no banco
    $result = saveSelectedAssets($clinicId, $selectedAssets, $accessToken);
    
    if ($result['success']) {
        // Subscrever webhooks
        subscribeWebhooks($selectedAssets, $accessToken);
        
        echo json_encode(['success' => true, 'message' => 'Ativos conectados com sucesso!']);
    } else {
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'Erro ao salvar no banco de dados']);
    }
    exit;
}

// Página de seleção de ativos
function showAssetSelectionPage($clinicId, $accessToken, $assets) {
    $assetsJson = json_encode($assets);
    $accessTokenSafe = htmlspecialchars($accessToken);
    $clinicIdSafe = htmlspecialchars($clinicId);
    
    echo <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selecionar Canais - Belitx</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
    <style>
        .checkbox-item:has(input:checked) {
            border-color: #10b981;
            background-color: #ecfdf5;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen p-4">
    <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
            <!-- Header -->
            <div class="p-6 bg-gradient-to-r from-pink-500 to-rose-600 text-white">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl">link</span>
                    <div>
                        <h1 class="text-xl font-bold">Conectar Canais</h1>
                        <p class="text-pink-100 text-sm">Selecione os canais que deseja conectar ao Belitx</p>
                    </div>
                </div>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- WhatsApp Section -->
                <div class="space-y-3">
                    <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                        <span class="material-symbols-outlined text-emerald-600">chat</span>
                        WhatsApp Business
                    </h3>
                    <div id="whatsapp-list" class="space-y-2">
                        <!-- Populated by JS -->
                    </div>
                </div>
                
                <!-- Facebook Section -->
                <div class="space-y-3">
                    <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                        <span class="material-symbols-outlined text-blue-600">thumb_up</span>
                        Páginas do Facebook
                    </h3>
                    <div id="facebook-list" class="space-y-2">
                        <!-- Populated by JS -->
                    </div>
                </div>
                
                <!-- Instagram Section -->
                <div class="space-y-3">
                    <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                        <span class="material-symbols-outlined text-pink-600">photo_camera</span>
                        Contas do Instagram
                    </h3>
                    <div id="instagram-list" class="space-y-2">
                        <!-- Populated by JS -->
                    </div>
                </div>
                
                <!-- Info -->
                <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-blue-600">info</span>
                        <p class="text-sm text-blue-700">
                            Selecione pelo menos um canal para conectar. Você pode conectar mais canais depois.
                        </p>
                    </div>
                </div>
                
                <!-- Buttons -->
                <div class="flex gap-3 pt-4">
                    <button onclick="window.close()" class="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                        Cancelar
                    </button>
                    <button onclick="saveSelection()" id="save-btn" class="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">check</span>
                        Conectar Selecionados
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const assets = $assetsJson;
        const accessToken = '$accessTokenSafe';
        const clinicId = '$clinicIdSafe';
        
        let selectedWhatsApp = null;
        let selectedFacebook = null;
        let selectedInstagram = null;
        
        function renderAssets() {
            // WhatsApp
            const whatsappList = document.getElementById('whatsapp-list');
            if (assets.whatsapp_accounts.length === 0) {
                whatsappList.innerHTML = '<p class="text-sm text-slate-500 italic">Nenhuma conta WhatsApp Business encontrada</p>';
            } else {
                whatsappList.innerHTML = assets.whatsapp_accounts.map((waba, i) => {
                    const phones = waba.phone_numbers?.data || [];
                    return phones.map((phone, j) => `
                        <label class="checkbox-item flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
                            <input type="radio" name="whatsapp" value="\${waba.id}|\${phone.id}|\${phone.display_phone_number}" 
                                   onchange="selectedWhatsApp = {waba_id: '\${waba.id}', phone_number_id: '\${phone.id}', phone_number: '\${phone.display_phone_number}'}"
                                   class="w-5 h-5 text-emerald-600">
                            <div class="flex-1">
                                <p class="font-medium text-slate-800">\${phone.display_phone_number}</p>
                                <p class="text-sm text-slate-500">\${phone.verified_name || waba.name}</p>
                            </div>
                            <span class="material-symbols-outlined text-emerald-600">verified</span>
                        </label>
                    `).join('');
                }).join('');
            }
            
            // Facebook
            const facebookList = document.getElementById('facebook-list');
            if (assets.pages.length === 0) {
                facebookList.innerHTML = '<p class="text-sm text-slate-500 italic">Nenhuma página do Facebook encontrada</p>';
            } else {
                facebookList.innerHTML = assets.pages.map(page => `
                    <label class="checkbox-item flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                        <input type="radio" name="facebook" value="\${page.id}" 
                               onchange="selectedFacebook = {page_id: '\${page.id}', page_name: '\${page.name}', page_access_token: '\${page.access_token}'}"
                               class="w-5 h-5 text-blue-600">
                        <div class="flex-1">
                            <p class="font-medium text-slate-800">\${page.name}</p>
                            <p class="text-sm text-slate-500">Página do Facebook</p>
                        </div>
                        <span class="material-symbols-outlined text-blue-600">public</span>
                    </label>
                `).join('');
            }
            
            // Instagram
            const instagramList = document.getElementById('instagram-list');
            if (assets.instagram_accounts.length === 0) {
                instagramList.innerHTML = '<p class="text-sm text-slate-500 italic">Nenhuma conta do Instagram encontrada. Vincule seu Instagram a uma Página do Facebook.</p>';
            } else {
                instagramList.innerHTML = assets.instagram_accounts.map(ig => `
                    <label class="checkbox-item flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-pink-300 transition-colors">
                        <input type="radio" name="instagram" value="\${ig.id}" 
                               onchange="selectedInstagram = {account_id: '\${ig.id}', username: '\${ig.username || ''}', access_token: '\${ig.page_access_token}'}"
                               class="w-5 h-5 text-pink-600">
                        <div class="flex-1">
                            <p class="font-medium text-slate-800">@\${ig.username || 'Instagram'}</p>
                            <p class="text-sm text-slate-500">Vinculado a: \${ig.page_name}</p>
                        </div>
                        <span class="material-symbols-outlined text-pink-600">photo_camera</span>
                    </label>
                `).join('');
            }
        }
        
        async function saveSelection() {
            if (!selectedWhatsApp && !selectedFacebook && !selectedInstagram) {
                alert('Selecione pelo menos um canal para conectar.');
                return;
            }
            
            const btn = document.getElementById('save-btn');
            btn.disabled = true;
            btn.innerHTML = '<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Conectando...';
            
            try {
                const response = await fetch('https://belitx.com.br/api/meta-business-callback.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clinic_id: clinicId,
                        access_token: accessToken,
                        selected_assets: {
                            whatsapp: selectedWhatsApp,
                            facebook: selectedFacebook,
                            instagram: selectedInstagram
                        }
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Mostrar sucesso e fechar
                    document.body.innerHTML = `
                        <div class="min-h-screen flex items-center justify-center p-4">
                            <div class="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
                                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span class="material-symbols-outlined text-4xl text-green-600">check_circle</span>
                                </div>
                                <h2 class="text-xl font-bold text-slate-800 mb-2">Conectado com Sucesso!</h2>
                                <p class="text-slate-600 mb-6">Seus canais foram conectados ao Belitx.</p>
                                <p class="text-sm text-slate-500">Esta janela fechará automaticamente...</p>
                            </div>
                        </div>
                    `;
                    setTimeout(() => window.close(), 2000);
                } else {
                    alert('Erro: ' + (data.error || 'Erro desconhecido'));
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span> Conectar Selecionados';
                }
            } catch (err) {
                alert('Erro de conexão: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span> Conectar Selecionados';
            }
        }
        
        // Render on load
        renderAssets();
    </script>
</body>
</html>
HTML;
}

// Página de erro
function showErrorPage($message) {
    echo <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erro - Belitx</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-4xl text-red-600">error</span>
        </div>
        <h2 class="text-xl font-bold text-slate-800 mb-2">Erro na Conexão</h2>
        <p class="text-slate-600 mb-6">$message</p>
        <button onclick="window.close()" class="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium">
            Fechar
        </button>
    </div>
</body>
</html>
HTML;
}
