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
  const FORM = 'candidatura-form';
  const PIXEL = '919253591198015';
  const base = { produto: PRODUCT, form_id: FORM, page_version: 'application_v1' };
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

  const once = new Set();
  const emitOnce = (key, name, extra) => {
    if (once.has(key)) return;
    once.add(key);
    ga(name, extra);
  };
  document.querySelectorAll('a[href="#candidatura"]').forEach((button) => {
    const ctaLocation = button.closest('.hero-copy') ? 'hero' : 'faq';
    button.addEventListener('click', () => ga('hands_on_cta_click', { cta_location: ctaLocation }));
  });
  window.addEventListener('hands-on:progress', (event) => {
    const detail = event.detail || {};
    if (detail.action === 'start') emitOnce('start', 'hands_on_form_start', { form_step: 1 });
    if (detail.action === 'advance') {
      emitOnce('start', 'hands_on_form_start', { form_step: 1 });
      emitOnce('step1', 'hands_on_step_complete', { form_step: 1 });
    }
    if (detail.action === 'submit') ga('hands_on_submit_attempt', { form_step: 2 });
    if (detail.action === 'error' && ['http','network','timeout','unconfirmed'].includes(detail.error_type)) {
      ga('hands_on_form_error', { form_step: 2, error_type: detail.error_type });
    }
  });
  document.querySelectorAll('[data-whatsapp]').forEach((button) => {
    button.addEventListener('click', () => {
      ga('hands_on_whatsapp_click', { cta_location: 'floating' });
      meta('Contact', { content_name: 'Hands-on Grau Zero' });
    });
  });
  const receipts = new Set();
  window.addEventListener('hands-on:receipt', (event) => {
    const receipt = event.detail;
    if (!receipt || receipt.ok !== true || typeof receipt.request_id !== 'string'
      || (receipt.tracking_mode && receipt.tracking_mode !== 'production')
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(receipt.request_id)
      || receipts.has(receipt.request_id)) return;
    receipts.add(receipt.request_id);
    // This signal is produced only after the receiver echoes the saved request_id.
    ga('generate_lead');
    meta('Lead', { content_name: 'Hands-on Grau Zero', content_category: 'oftalmoblack_b2b' },
      { eventID: 'hands-on:' + receipt.request_id + ':Lead' });
  });
})();
