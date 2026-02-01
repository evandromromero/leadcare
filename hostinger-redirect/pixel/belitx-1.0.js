/**
 * Belitx Pixel - Rastreamento de Conversões
 * Versão 1.1
 * 
 * Este script captura dados do visitante e envia para o Belitx
 * quando o usuário clica em links de WhatsApp rastreáveis.
 * 
 * Captura: UTMs, gclid, fbclid, tempo na página, scroll depth, cliques
 */

(function() {
  'use strict';

  // Configuração
  var BELITX_API = 'https://opuepzfqizmamdegdhbs.supabase.co/functions/v1/pixel-track';
  var BELITX_LINK_PATTERN = /belitx\.com\.br\/(r|w)\//;

  // Métricas de engajamento
  var pageLoadTime = Date.now();
  var maxScrollDepth = 0;
  var clickCount = 0;
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

  // Dados do visitante
  var visitorData = {
    clinic_id: window.belitx ? window.belitx.clinicId : null,
    page_url: window.location.href,
    page_title: document.title,
    referrer: document.referrer || null,
    
    // UTMs
    utm_source: getUrlParam('utm_source'),
    utm_medium: getUrlParam('utm_medium'),
    utm_campaign: getUrlParam('utm_campaign'),
    utm_content: getUrlParam('utm_content'),
    utm_term: getUrlParam('utm_term'),
    
    // IDs de clique de anúncios
    fbclid: getUrlParam('fbclid'),
    gclid: getUrlParam('gclid'),
    
    // Dispositivo
    device_type: getDeviceType(),
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    
    // Navegador
    user_agent: navigator.userAgent,
    language: navigator.language,
    
    // Timestamp
    timestamp: new Date().toISOString(),
    
    // Session
    session_id: getOrCreateSessionId()
  };

  // Salvar gclid no localStorage para usar depois (conversões offline)
  if (visitorData.gclid) {
    localStorage.setItem('belitx_gclid', visitorData.gclid);
    localStorage.setItem('belitx_gclid_time', Date.now().toString());
  }

  // Funções auxiliares
  function getUrlParam(param) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || null;
  }

  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getOrCreateSessionId() {
    var sessionId = sessionStorage.getItem('belitx_session_id');
    if (!sessionId) {
      sessionId = 'bx_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      sessionStorage.setItem('belitx_session_id', sessionId);
    }
    return sessionId;
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    return 'Other';
  }

  function getOS() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Windows') > -1) return 'Windows';
    if (ua.indexOf('Mac') > -1) return 'MacOS';
    if (ua.indexOf('Linux') > -1) return 'Linux';
    if (ua.indexOf('Android') > -1) return 'Android';
    if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
    return 'Other';
  }

  // Adicionar dados do navegador e OS
  visitorData.browser = getBrowser();
  visitorData.os = getOS();

  // Enviar dados para o servidor
  function sendToServer(eventType, extraData) {
    if (!visitorData.clinic_id) {
      console.warn('[Belitx Pixel] clinic_id não configurado');
      return;
    }

    var data = Object.assign({}, visitorData, extraData || {}, { event_type: eventType });

    // Usar sendBeacon para garantir envio mesmo ao sair da página
    if (navigator.sendBeacon) {
      navigator.sendBeacon(BELITX_API, JSON.stringify(data));
    } else {
      // Fallback para fetch
      fetch(BELITX_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function() {});
    }
  }

  // Calcular tempo na página
  function getTimeOnPage() {
    return Math.round((Date.now() - pageLoadTime) / 1000);
  }

  // Calcular scroll depth
  function calculateScrollDepth() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    var winHeight = window.innerHeight;
    var scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
    return Math.min(scrollPercent, 100);
  }

  // Rastrear scroll
  function setupScrollTracking() {
    window.addEventListener('scroll', function() {
      var depth = calculateScrollDepth();
      if (depth > maxScrollDepth) {
        maxScrollDepth = depth;
      }
      
      // Enviar eventos em marcos de scroll
      [25, 50, 75, 100].forEach(function(milestone) {
        if (depth >= milestone && !scrollMilestones[milestone]) {
          scrollMilestones[milestone] = true;
          sendToServer('scroll_depth', { scroll_percent: milestone });
        }
      });
    }, { passive: true });
  }

  // Rastrear cliques gerais
  function setupClickTracking() {
    document.addEventListener('click', function(e) {
      clickCount++;
      var target = e.target;
      
      // Identificar elemento clicado
      var elementInfo = {
        tag: target.tagName,
        id: target.id || null,
        class: target.className || null,
        text: (target.textContent || '').substring(0, 50)
      };
      
      // Subir na árvore DOM para encontrar link
      var linkTarget = target;
      while (linkTarget && linkTarget.tagName !== 'A') {
        linkTarget = linkTarget.parentElement;
      }
      
      // Se for link Belitx, rastrear com dados extras
      if (linkTarget && linkTarget.href && BELITX_LINK_PATTERN.test(linkTarget.href)) {
        var match = linkTarget.href.match(/belitx\.com\.br\/(r|w)\/([^?#]+)/);
        var linkCode = match ? match[2] : null;
        
        sendToServer('link_click', {
          link_url: linkTarget.href,
          link_code: linkCode,
          time_on_page: getTimeOnPage(),
          scroll_depth: maxScrollDepth,
          click_count: clickCount,
          element: elementInfo
        });
      }
      // Se for botão ou link com texto "whatsapp", rastrear também
      else if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        var text = (target.textContent || '').toLowerCase();
        var href = (linkTarget && linkTarget.href || '').toLowerCase();
        if (text.indexOf('whatsapp') > -1 || href.indexOf('whatsapp') > -1 || href.indexOf('wa.me') > -1) {
          sendToServer('whatsapp_click', {
            link_url: linkTarget ? linkTarget.href : null,
            time_on_page: getTimeOnPage(),
            scroll_depth: maxScrollDepth,
            click_count: clickCount,
            element: elementInfo
          });
        }
      }
    }, true);
  }

  // Rastrear pageview
  function trackPageView() {
    sendToServer('pageview', {
      // Recuperar gclid do localStorage se não vier na URL
      gclid: visitorData.gclid || localStorage.getItem('belitx_gclid') || null
    });
  }

  // Rastrear saída da página
  function setupExitTracking() {
    window.addEventListener('beforeunload', function() {
      sendToServer('page_exit', {
        time_on_page: getTimeOnPage(),
        scroll_depth: maxScrollDepth,
        click_count: clickCount
      });
    });
  }

  // Inicializar
  function init() {
    // Registrar pageview
    trackPageView();
    
    // Configurar rastreamentos
    setupScrollTracking();
    setupClickTracking();
    setupExitTracking();
    
    // Expor API pública
    window.belitx = window.belitx || {};
    window.belitx.track = function(eventType, data) {
      sendToServer(eventType, data);
    };
    window.belitx.getGclid = function() {
      return visitorData.gclid || localStorage.getItem('belitx_gclid') || null;
    };
    window.belitx.getSessionId = function() {
      return visitorData.session_id;
    };
    
    console.log('[Belitx Pixel] v1.1 Inicializado - Clinic ID:', visitorData.clinic_id);
  }

  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
