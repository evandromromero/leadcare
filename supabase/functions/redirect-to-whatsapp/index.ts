import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Parser simples de User-Agent
function parseUserAgent(ua: string) {
  const result = {
    browser: 'Desconhecido',
    os: 'Desconhecido',
    device_type: 'desktop',
    device_model: '',
    is_mobile: false
  }
  
  if (!ua) return result
  
  // Browser
  if (ua.includes('Instagram')) result.browser = 'Instagram'
  else if (ua.includes('FBAN') || ua.includes('FBAV')) result.browser = 'Facebook'
  else if (ua.includes('Chrome')) result.browser = 'Chrome'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) result.browser = 'Safari'
  else if (ua.includes('Firefox')) result.browser = 'Firefox'
  else if (ua.includes('Edge')) result.browser = 'Edge'
  
  // OS
  if (ua.includes('iPhone')) {
    result.os = 'iOS'
    result.device_type = 'mobile'
    result.is_mobile = true
    const match = ua.match(/iPhone[^;]*/)
    if (match) result.device_model = match[0]
  } else if (ua.includes('iPad')) {
    result.os = 'iOS'
    result.device_type = 'tablet'
    result.is_mobile = true
    result.device_model = 'iPad'
  } else if (ua.includes('Android')) {
    result.os = 'Android'
    result.device_type = 'mobile'
    result.is_mobile = true
    const match = ua.match(/Android[^;]*;\s*([^)]+)/)
    if (match) result.device_model = match[1].trim()
  } else if (ua.includes('Windows')) {
    result.os = 'Windows'
  } else if (ua.includes('Mac OS')) {
    result.os = 'macOS'
  } else if (ua.includes('Linux')) {
    result.os = 'Linux'
  }
  
  return result
}

serve(async (req) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Espera formato: /redirect-to-whatsapp/CODIGO
  const code = pathParts[pathParts.length - 1]
  
  if (!code || code === 'redirect-to-whatsapp') {
    return new Response(null, {
      status: 302,
      headers: { 'Location': 'https://belitx.com.br' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar link pelo código (case insensitive)
    const { data: link, error } = await supabase
      .from('trackable_links')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .single()
    
    if (error || !link) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': 'https://belitx.com.br' }
      })
    }

    // Capturar dados do dispositivo
    const userAgent = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown'
    const referrer = req.headers.get('referer') || req.headers.get('referrer') || ''
    const deviceInfo = parseUserAgent(userAgent)
    
    // Capturar UTMs e parâmetros do Meta Ads
    const utmSource = url.searchParams.get('utm_source')
    const utmMedium = url.searchParams.get('utm_medium')
    const utmCampaign = url.searchParams.get('utm_campaign')
    const utmContent = url.searchParams.get('utm_content')
    const utmTerm = url.searchParams.get('utm_term')
    const fbclid = url.searchParams.get('fbclid')
    const gclid = url.searchParams.get('gclid')
    
    // Parâmetro especial para cruzar dados do Meta Ads
    // Formato: belitx_fbid={{ad.id}}_{{site_source_name}}_{{placement}}
    const belitxFbid = url.searchParams.get('belitx_fbid')
    let adId = ''
    let siteSource = ''
    let placement = ''
    
    if (belitxFbid) {
      const parts = belitxFbid.split('_')
      if (parts.length >= 1) adId = parts[0]
      if (parts.length >= 2) siteSource = parts[1]
      if (parts.length >= 3) placement = parts.slice(2).join('_')
    }

    // Salvar clique com dados completos
    await supabase.from('link_clicks').insert({
      link_id: link.id,
      clinic_id: link.clinic_id,
      ip_address: ip,
      user_agent: userAgent,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device_type: deviceInfo.device_type,
      device_model: deviceInfo.device_model,
      referrer: referrer,
      utm_source: utmSource || link.utm_source,
      utm_medium: utmMedium || link.utm_medium,
      utm_campaign: utmCampaign || link.utm_campaign,
      utm_content: utmContent || link.utm_content,
      utm_term: utmTerm || link.utm_term,
      fbclid: fbclid,
      gclid: gclid,
      belitx_fbid: belitxFbid,
      ad_id: adId,
      site_source: siteSource,
      placement: placement
    })

    // Incrementar contador de cliques
    await supabase
      .from('trackable_links')
      .update({ clicks_count: (link.clicks_count || 0) + 1 })
      .eq('id', link.id)

    // Montar mensagem com código (sempre maiúsculo)
    const codeUpper = link.code.toUpperCase()
    let message = link.message_template || 'Olá!'
    if (!message.includes(`[${codeUpper}]`)) {
      message = `${message} [${codeUpper}]`
    }
    
    // Montar URLs do WhatsApp
    const phoneClean = link.phone_number.replace(/\D/g, '')
    const encodedMessage = encodeURIComponent(message)
    
    // URL para desktop (wa.me)
    const whatsappWebUrl = `https://wa.me/${phoneClean}?text=${encodedMessage}`
    
    // URL para mobile (intent/universal link)
    // Android: intent://send/... ou whatsapp://send/...
    // iOS: whatsapp://send/...
    const whatsappAppUrl = `whatsapp://send?phone=${phoneClean}&text=${encodedMessage}`
    
    // Detectar origem para mostrar na página
    let origemTexto = 'Link Direto'
    if (referrer.includes('instagram')) origemTexto = 'Instagram'
    else if (referrer.includes('facebook')) origemTexto = 'Facebook'
    else if (referrer.includes('google')) origemTexto = 'Google'
    else if (referrer.includes('tiktok')) origemTexto = 'TikTok'
    else if (siteSource) origemTexto = siteSource
    else if (utmSource) origemTexto = utmSource.charAt(0).toUpperCase() + utmSource.slice(1)
    
    // Página HTML com detecção de dispositivo e redirecionamento correto
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecionando para WhatsApp</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .whatsapp-icon {
      width: 80px;
      height: 80px;
      background: #25D366;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      animation: pulse 2s infinite;
    }
    .whatsapp-icon svg {
      width: 44px;
      height: 44px;
      fill: white;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(37, 211, 102, 0); }
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #64748b;
      font-size: 15px;
      margin-bottom: 32px;
    }
    .progress-container {
      background: #e2e8f0;
      border-radius: 999px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .progress-bar {
      background: linear-gradient(90deg, #25D366, #128C7E);
      height: 100%;
      width: 0%;
      border-radius: 999px;
      transition: width 0.1s linear;
    }
    .countdown {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 28px;
    }
    .countdown span {
      font-weight: 700;
      color: #25D366;
      font-size: 16px;
    }
    .skip-btn {
      background: #25D366;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
    }
    .skip-btn:hover {
      background: #128C7E;
      transform: translateY(-2px);
    }
    .skip-btn svg {
      width: 20px;
      height: 20px;
      fill: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="whatsapp-icon">
      <svg viewBox="0 0 24 24"><path d="M7.25361 18.4944L7.97834 18.917C9.18909 19.623 10.5651 20 12.001 20C16.4193 20 20.001 16.4183 20.001 12C20.001 7.58172 16.4193 4 12.001 4C7.5827 4 4.00098 7.58172 4.00098 12C4.00098 13.4363 4.37821 14.8128 5.08466 16.0238L5.50704 16.7478L4.85355 19.1494L7.25361 18.4944ZM2.00516 22L3.35712 17.0315C2.49494 15.5536 2.00098 13.8345 2.00098 12C2.00098 6.47715 6.47813 2 12.001 2C17.5238 2 22.001 6.47715 22.001 12C22.001 17.5228 17.5238 22 12.001 22C10.1671 22 8.44851 21.5064 6.97086 20.6447L2.00516 22ZM8.39232 7.30833C8.5262 7.29892 8.66053 7.29748 8.79459 7.30402C8.84875 7.30758 8.90265 7.31384 8.95659 7.32007C9.11585 7.33846 9.29098 7.43545 9.34986 7.56894C9.64818 8.24536 9.93764 8.92565 10.2182 9.60963C10.2801 9.76062 10.2428 9.95633 10.125 10.1457C10.0652 10.2428 9.97128 10.379 9.86248 10.5183C9.74939 10.663 9.50599 10.9291 9.50599 10.9291C9.50599 10.9291 9.40738 11.0473 9.44455 11.1944C9.45903 11.25 9.50521 11.331 9.54708 11.3991C9.57027 11.4368 9.5918 11.4705 9.60577 11.4938C9.86169 11.9211 10.2057 12.3543 10.6259 12.7616C10.7463 12.8783 10.8631 12.9974 10.9887 13.108C11.457 13.5209 11.9868 13.8583 12.559 14.1082L12.5641 14.1105C12.6486 14.1469 12.692 14.1668 12.8157 14.2193C12.8781 14.2457 12.9419 14.2685 13.0074 14.2858C13.0311 14.292 13.0554 14.2955 13.0798 14.2972C13.2415 14.3069 13.335 14.2032 13.3749 14.1555C14.0984 13.279 14.1646 13.2218 14.1696 13.2222V13.2238C14.2647 13.1236 14.4142 13.0888 14.5476 13.097C14.6085 13.1007 14.6691 13.1124 14.7245 13.1377C15.2563 13.3803 16.1258 13.7587 16.1258 13.7587L16.7073 14.0201C16.8047 14.0671 16.8936 14.1778 16.8979 14.2854C16.9005 14.3523 16.9077 14.4603 16.8838 14.6579C16.8525 14.9166 16.7738 15.2281 16.6956 15.3913C16.6406 15.5058 16.5694 15.6074 16.4866 15.6934C16.3743 15.81 16.2909 15.8808 16.1559 15.9814C16.0737 16.0426 16.0311 16.0714 16.0311 16.0714C15.8922 16.159 15.8139 16.2028 15.6484 16.2909C15.391 16.428 15.1066 16.5068 14.8153 16.5218C14.6296 16.5313 14.4444 16.5447 14.2589 16.5347C14.2507 16.5342 13.6907 16.4482 13.6907 16.4482C12.2688 16.0742 10.9538 15.3736 9.85034 14.402C9.62473 14.2034 9.4155 13.9885 9.20194 13.7759C8.31288 12.8908 7.63982 11.9364 7.23169 11.0336C7.03043 10.5884 6.90299 10.1116 6.90098 9.62098C6.89729 9.01405 7.09599 8.4232 7.46569 7.94186C7.53857 7.84697 7.60774 7.74855 7.72709 7.63586C7.85348 7.51651 7.93392 7.45244 8.02057 7.40811C8.13607 7.34902 8.26293 7.31742 8.39232 7.30833Z"/></svg>
    </div>
    
    <h1>Redirecionando...</h1>
    <p class="subtitle">Você será enviado para o WhatsApp</p>
    
    <div class="progress-container">
      <div class="progress-bar" id="progress"></div>
    </div>
    
    <p class="countdown">Aguarde <span id="seconds">5</span> segundos</p>
    
    <a href="#" class="skip-btn" id="skipBtn" onclick="redirect(); return false;">
      <svg viewBox="0 0 24 24"><path d="M7.25361 18.4944L7.97834 18.917C9.18909 19.623 10.5651 20 12.001 20C16.4193 20 20.001 16.4183 20.001 12C20.001 7.58172 16.4193 4 12.001 4C7.5827 4 4.00098 7.58172 4.00098 12C4.00098 13.4363 4.37821 14.8128 5.08466 16.0238L5.50704 16.7478L4.85355 19.1494L7.25361 18.4944ZM2.00516 22L3.35712 17.0315C2.49494 15.5536 2.00098 13.8345 2.00098 12C2.00098 6.47715 6.47813 2 12.001 2C17.5238 2 22.001 6.47715 22.001 12C22.001 17.5228 17.5238 22 12.001 22C10.1671 22 8.44851 21.5064 6.97086 20.6447L2.00516 22ZM8.39232 7.30833C8.5262 7.29892 8.66053 7.29748 8.79459 7.30402C8.84875 7.30758 8.90265 7.31384 8.95659 7.32007C9.11585 7.33846 9.29098 7.43545 9.34986 7.56894C9.64818 8.24536 9.93764 8.92565 10.2182 9.60963C10.2801 9.76062 10.2428 9.95633 10.125 10.1457C10.0652 10.2428 9.97128 10.379 9.86248 10.5183C9.74939 10.663 9.50599 10.9291 9.50599 10.9291C9.50599 10.9291 9.40738 11.0473 9.44455 11.1944C9.45903 11.25 9.50521 11.331 9.54708 11.3991C9.57027 11.4368 9.5918 11.4705 9.60577 11.4938C9.86169 11.9211 10.2057 12.3543 10.6259 12.7616C10.7463 12.8783 10.8631 12.9974 10.9887 13.108C11.457 13.5209 11.9868 13.8583 12.559 14.1082L12.5641 14.1105C12.6486 14.1469 12.692 14.1668 12.8157 14.2193C12.8781 14.2457 12.9419 14.2685 13.0074 14.2858C13.0311 14.292 13.0554 14.2955 13.0798 14.2972C13.2415 14.3069 13.335 14.2032 13.3749 14.1555C14.0984 13.279 14.1646 13.2218 14.1696 13.2222V13.2238C14.2647 13.1236 14.4142 13.0888 14.5476 13.097C14.6085 13.1007 14.6691 13.1124 14.7245 13.1377C15.2563 13.3803 16.1258 13.7587 16.1258 13.7587L16.7073 14.0201C16.8047 14.0671 16.8936 14.1778 16.8979 14.2854C16.9005 14.3523 16.9077 14.4603 16.8838 14.6579C16.8525 14.9166 16.7738 15.2281 16.6956 15.3913C16.6406 15.5058 16.5694 15.6074 16.4866 15.6934C16.3743 15.81 16.2909 15.8808 16.1559 15.9814C16.0737 16.0426 16.0311 16.0714 16.0311 16.0714C15.8922 16.159 15.8139 16.2028 15.6484 16.2909C15.391 16.428 15.1066 16.5068 14.8153 16.5218C14.6296 16.5313 14.4444 16.5447 14.2589 16.5347C14.2507 16.5342 13.6907 16.4482 13.6907 16.4482C12.2688 16.0742 10.9538 15.3736 9.85034 14.402C9.62473 14.2034 9.4155 13.9885 9.20194 13.7759C8.31288 12.8908 7.63982 11.9364 7.23169 11.0336C7.03043 10.5884 6.90299 10.1116 6.90098 9.62098C6.89729 9.01405 7.09599 8.4232 7.46569 7.94186C7.53857 7.84697 7.60774 7.74855 7.72709 7.63586C7.85348 7.51651 7.93392 7.45244 8.02057 7.40811C8.13607 7.34902 8.26293 7.31742 8.39232 7.30833Z"/></svg>
      Ir agora
    </a>
  </div>
  
  <script>
    // URLs do WhatsApp
    const whatsappAppUrl = "${whatsappAppUrl}";
    const whatsappWebUrl = "${whatsappWebUrl}";
    
    // Detectar se é mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    let seconds = 5;
    let progress = 0;
    
    function redirect() {
      if (isMobile) {
        // No mobile, tentar abrir o app primeiro
        window.location.href = whatsappAppUrl;
        
        // Fallback para wa.me após 2 segundos se o app não abrir
        setTimeout(function() {
          window.location.href = whatsappWebUrl;
        }, 2000);
      } else {
        // No desktop, usar wa.me
        window.location.href = whatsappWebUrl;
      }
    }
    
    const interval = setInterval(() => {
      progress += 2;
      document.getElementById('progress').style.width = progress + '%';
      
      if (progress % 20 === 0) {
        seconds--;
        document.getElementById('seconds').textContent = seconds;
      }
      
      if (progress >= 100) {
        clearInterval(interval);
        redirect();
      }
    }, 100);
  </script>
</body>
</html>
`
    
    return new Response(html, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Erro:', error)
    return new Response(null, {
      status: 302,
      headers: { 'Location': 'https://belitx.com.br' }
    })
  }
})
