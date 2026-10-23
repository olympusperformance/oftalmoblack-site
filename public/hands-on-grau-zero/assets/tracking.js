(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const enabled = document.documentElement.dataset.analyticsEnabled === 'true'
    && location.protocol === 'https:'
    && ['oftalmoblack.com.br', 'www.oftalmoblack.com.br'].includes(location.hostname)
    && (params.get('utm_source') || '').toLowerCase() !== 'qa'
    && params.get('qa') !== '1';
  if (!enabled || window.handsOnTrackingLoaded) return;
  window.handsOnTrackingLoaded = true;

  const PRODUCT = 'hands_on_grau_zero';
  const PIXEL = '919253591198015';
  const base = { produto: PRODUCT, page_version: 'checkout_v1' };
  // Never read form values, free text or contact identifiers for analytics.
  const cleanUrl = (value, acquisition = false) => {
    try {
      const source = new URL(value);
      if (!['https:', 'http:'].includes(source.protocol)) return '';
      const clean = new URL(source.origin + source.pathname);
      if (acquisition) for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid','fbclid','gclid']) {
        if (source.searchParams.has(key)) clean.searchParams.set(key, source.searchParams.get(key).slice(0, 500));
      }
      return clean.href;
    } catch { return ''; }
  };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-5NMXL3LD47', {
    send_page_view: false,
    page_location: cleanUrl(location.href, true),
    page_referrer: cleanUrl(document.referrer)
  });
  const ga = (name, extra = {}) => {
    try { window.gtag('event', name, { ...base, ...extra }); } catch { /* Tracking must not block the form. */ }
  };
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5NMXL3LD47';
  document.head.appendChild(script);
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('set', 'autoConfig', false, PIXEL);
  window.fbq('init', PIXEL);
  const meta = (name, extra = {}, options) => {
    try { window.fbq('track', name, extra, ...(options ? [options] : [])); } catch { /* Keep the application usable. */ }
  };
  ga('page_view');
  const pageId=window.crypto?.randomUUID?.();
  const eventOptions=name=>pageId?{eventID:'hands-on:'+pageId+':'+name}:undefined;
  meta('PageView', {}, eventOptions('PageView'));
  meta('ViewContent', { content_name: 'Hands-on Grau Zero', content_category: 'oftalmoblack_b2b' }, eventOptions('ViewContent'));
  if(pageId&&window.handsOnCapi)window.setTimeout(()=>window.handsOnCapi.visit(pageId),800);

  let checkoutStarted = false;
  window.addEventListener('hands-on:checkout', (event) => {
    const detail = event.detail || {};
    const ctaLocation = ['hero', 'card', 'faq'].includes(detail.cta_location) ? detail.cta_location : 'unknown';
    ga('hands_on_cta_click', { cta_location: ctaLocation });
    if (checkoutStarted) return;
    checkoutStarted = true;
    ga('begin_checkout', { cta_location: ctaLocation });
    // A click records checkout intent only. Payment belongs to the provider.
    meta('InitiateCheckout', { content_name: 'Hands-on Grau Zero', content_category: 'oftalmoblack_b2b' }, eventOptions('InitiateCheckout'));
  });
  window.addEventListener('hands-on:contact', () => {
    ga('hands_on_whatsapp_click', { cta_location: 'floating' });
    meta('Contact', { content_name: 'Hands-on Grau Zero' });
  });
})();
