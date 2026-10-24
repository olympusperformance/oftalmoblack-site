/* Entrada pública e ficha do Club na própria home. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const attribution = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'aid']) {
    const value = (params.get(key) || '').trim();
    if (value && value.length <= 150 && !/[\u0000-\u001f@]/.test(value)) attribution[key] = value;
  }
  const safeUrl = new URL(location.origin + location.pathname);
  Object.entries(attribution).forEach(([key, value]) => safeUrl.searchParams.set(key, value));
  for (const key of ['fbclid', 'gclid', 'gbraid', 'wbraid']) {
    const value = (params.get(key) || '').trim();
    if (/^[A-Za-z0-9_.-]{1,500}$/.test(value)) safeUrl.searchParams.set(key, value);
  }
  if (['stories', 'presencial'].includes(params.get('origem'))) safeUrl.searchParams.set('origem', params.get('origem'));
  const qa = params.get('qa') === '1' || (params.get('utm_source') || '').toLowerCase() === 'qa';
  if (qa || location.protocol !== 'https:' || !['oftalmoblack.com.br', 'www.oftalmoblack.com.br'].includes(location.hostname)) return;
  const allowedHashes = ['#top', '#black', '#recebe', '#clinico', '#mls', '#mentor', '#perfil', '#aplicacao', '#formacoes', '#duvidas'];
  try { history.replaceState(history.state, '', safeUrl.href + (allowedHashes.includes(location.hash) ? location.hash : '')); } catch {}
  let referrer = '';
  try { const url = new URL(document.referrer); if (/^https?:$/.test(url.protocol)) referrer = url.origin + url.pathname; } catch {}
  try { Object.defineProperty(document, 'referrer', {value: referrer, configurable: true}); } catch {}
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-5NMXL3LD47', { send_page_view: false, page_location: safeUrl.href, page_referrer: referrer });
  const ga = (event, extra = {}) => window.gtag('event', event, { produto: 'club_oftalmoblack', page_version: 'home_perfil_20261024', form_id: 'perfil-form', ...extra });
  const tag = document.createElement('script');
  tag.async = true; tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-5NMXL3LD47'; document.head.appendChild(tag);
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('set', 'autoConfig', false, '919253591198015');
  for (const feature of ['AutomaticMatching', 'AutomaticMatchingForPartnerIntegrations', 'AutomaticMatchingRegex', 'AutomaticMatchingAI']) window.fbq('optOut', '919253591198015', feature);
  window.fbq('init', '919253591198015');
  const meta = (event, id) => window.fbq('track', event, { content_name: 'Club OftalmoBlack', content_category: 'oftalmoblack_b2b' }, ...(id ? [{eventID: id}] : []));
  ga('page_view'); meta('PageView'); meta('ViewContent');
  document.querySelectorAll('a[href="#aplicacao"]').forEach(link => link.addEventListener('click', () => ga('club_registration_click')));
  const once = new Set(), receipts = new Set();
  const gaOnce = (key, event, extra) => { if (once.has(key)) return; once.add(key); ga(event, extra); };
  document.getElementById('perfil-form')?.addEventListener('input', () => gaOnce('start', 'perfil_black_form_start', {form_step: 1}));
  window.addEventListener('perfil-black:progress', event => {
    const action = event.detail?.action;
    if (action === 'contact_complete') gaOnce('contact', 'perfil_black_contact_complete', {form_step: 1});
    if (action === 'submit') ga('perfil_black_submit_attempt', {form_step: 2});
    if (action === 'error') ga('perfil_black_form_error', {error_type: event.detail?.error_type === 'timeout' ? 'timeout' : 'unconfirmed'});
  });
  window.addEventListener('perfil-black:receipt', event => {
    const receipt = event.detail;
    if (receipt?.ok !== true || typeof receipt.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(receipt.id) || receipts.has(receipt.id)) return;
    receipts.add(receipt.id); ga('generate_lead'); meta('Lead', 'perfil-black:' + receipt.id + ':Lead');
  });
  document.getElementById('home-commercial')?.addEventListener('click', event => {
    if (!receipts.size) { event.preventDefault(); return; }
    ga('whatsapp_click'); meta('Contact');
  });
})();
