/* Entrada pública do Club. O cadastro segue centralizado em /club/. */
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
  const qa = params.get('qa') === '1' || (params.get('utm_source') || '').toLowerCase() === 'qa';
  const target = new URL('/club/', location.origin);
  safeUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  if (qa) target.searchParams.set('qa', '1');
  target.hash = 'cadastro';
  document.querySelectorAll('[data-club-link]').forEach(link => { link.href = target.href; });
  if (qa || location.protocol !== 'https:' || !['oftalmoblack.com.br', 'www.oftalmoblack.com.br'].includes(location.hostname)) return;
  const allowedHashes = ['#top', '#black', '#recebe', '#clinico', '#mls', '#mentor', '#perfil', '#aplicacao', '#formacoes', '#duvidas'];
  try { history.replaceState(history.state, '', safeUrl.href + (allowedHashes.includes(location.hash) ? location.hash : '')); } catch {}
  let referrer = '';
  try { const url = new URL(document.referrer); if (/^https?:$/.test(url.protocol)) referrer = url.origin + url.pathname; } catch {}
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-5NMXL3LD47', { send_page_view: false, page_location: safeUrl.href, page_referrer: referrer });
  const ga = event => window.gtag('event', event, { produto: 'club_oftalmoblack', page_version: 'home_20261024' });
  const tag = document.createElement('script');
  tag.async = true; tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-5NMXL3LD47'; document.head.appendChild(tag);
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('set', 'autoConfig', false, '919253591198015');
  window.fbq('init', '919253591198015');
  const meta = event => window.fbq('track', event, { content_name: 'Club OftalmoBlack', content_category: 'oftalmoblack_b2b' });
  ga('page_view'); meta('PageView'); meta('ViewContent');
  document.querySelectorAll('[data-club-link]').forEach(link => link.addEventListener('click', () => ga('club_registration_click')));
})();
