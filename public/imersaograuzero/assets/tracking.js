/* ============================================================================
   Meta Pixel + Google Analytics 4 + eventos de clique (checkout e WhatsApp).
   Repassa UTM e fbclid para o link do checkout.
   v2 de 10/08/2026.
   ========================================================================= */

/* ── Google Analytics 4 ─────────────────────────────────────────────────── */
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-5NMXL3LD47', { transport_type: 'beacon' });

document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest
    ? e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]')
    : null;
  if (!a) return;
  gtag('event', 'whatsapp_click', { page_path: location.pathname, link_url: a.href });
});

/* ── Meta Pixel ─────────────────────────────────────────────────────────── */
!function (f, b, e, v, n, t, s) {
  if (f.fbq) return; n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
  n.queue = []; t = b.createElement(e); t.async = !0;
  t.src = v; s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '919253591198015');
fbq('track', 'PageView');

/* ── UTM/fbclid -> checkout + eventos de clique ─────────────────────────── */
(function () {
  var KEY = 'norte_trk';
  function readCookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  try {
    var q = new URLSearchParams(location.search);
    var keep = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    if (cur._ts && Date.now() - cur._ts > 7 * 24 * 3600 * 1000) cur = {};
    var has = false;
    keep.forEach(function (k) { if (q.get(k)) { cur[k] = q.get(k); has = true; } });
    if (has) cur._ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
  } catch (e) {}

  function trkParams() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    delete p._ts;
    var fbp = readCookie('_fbp');
    if (fbp) p.fbp = fbp;
    var fbc = readCookie('_fbc');
    if (!fbc && p.fbclid) fbc = 'fb.1.' + Date.now() + '.' + p.fbclid;
    if (fbc) p.fbc = fbc;
    return p;
  }

  function decorate(a) {
    try {
      var u = new URL(a.href, location.href);
      var p = trkParams();
      Object.keys(p).forEach(function (k) { if (!u.searchParams.get(k)) u.searchParams.set(k, p[k]); });
      a.href = u.toString();
    } catch (e) {}
  }

  /* click e auxclick (botão do meio) usam o mesmo handler */
  function onLinkActivate(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;
    if (!e.target || !e.target.closest) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('greenn.com.br') > -1) {
      decorate(a);
      if (typeof fbq === 'function') fbq('trackCustom', 'ClickCheckout', { content_name: 'imersao_grau_zero', content_category: 'oftalmoblack_b2b' });
      if (typeof gtag === 'function') gtag('event', 'begin_checkout', { currency: 'BRL' });
    } else if (h.indexOf('wa.me/') > -1 || h.indexOf('api.whatsapp.com') > -1) {
      if (typeof fbq === 'function') fbq('track', 'Contact', { content_name: 'imersao_grau_zero', content_category: 'oftalmoblack_b2b' });
    }
  }

  document.addEventListener('click', onLinkActivate, true);
  document.addEventListener('auxclick', onLinkActivate, true);
})();
