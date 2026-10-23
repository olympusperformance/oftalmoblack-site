(() => {
  'use strict';
  const form = document.getElementById('club-form');
  if (!form) return;
  const endpoint = 'https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/club-cadastro';
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpweXhua3V2aXJjdWtqbGZleHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTk4NzksImV4cCI6MjEwMTk5NTg3OX0.YojmkK9fHsJwY1_81JeYdLJkIlI20xSQwqG-WuEZOrk';
  const nameInput = form.elements.full_name;
  const phoneInput = form.elements.phone;
  const submit = document.getElementById('club-submit');
  const error = document.getElementById('form-error');
  const success = document.getElementById('club-success');
  const whatsapp = document.getElementById('jean-whatsapp');
  const idleText = submit.textContent;
  const params = new URLSearchParams(location.search);
  const utm = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'aid']) {
    const value = (params.get(key) || '').trim();
    if (value && value.length <= 150 && !/[\u0000-\u001f@]/.test(value)) utm[key] = value;
  }
  const qa = params.get('qa') === '1' || (params.get('utm_source') || '').toLowerCase() === 'qa';
  const analytics = location.protocol === 'https:' && ['oftalmoblack.com.br', 'www.oftalmoblack.com.br'].includes(location.hostname) && !qa;
  let busy = false, completed = false, attempt = null, started = false;
  let ga = () => {}, meta = () => {};

  // Only fixed product/event details and allowlisted attribution enter analytics.
  if (analytics) {
    const pixel = '919253591198015';
    const safeUrl = new URL(location.origin + location.pathname);
    Object.entries(utm).forEach(([key, value]) => safeUrl.searchParams.set(key, value));
    for (const key of ['fbclid', 'gclid', 'gbraid', 'wbraid']) {
      const value = (params.get(key) || '').trim();
      if (/^[A-Za-z0-9_.-]{1,500}$/.test(value)) safeUrl.searchParams.set(key, value);
    }
    // Pixel also reads location directly. Remove arbitrary query fields before loading it.
    try { history.replaceState(history.state, '', safeUrl.href + (location.hash === '#cadastro' ? '#cadastro' : '')); } catch {}
    let referrer = '';
    try { const u = new URL(document.referrer); if (/^https?:$/.test(u.protocol)) referrer = u.origin + u.pathname; } catch {}
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-5NMXL3LD47', { send_page_view: false, page_location: safeUrl.href, page_referrer: referrer });
    ga = (event, extra = {}) => { try { window.gtag('event', event, { produto: 'club_oftalmoblack', page_version: 'cadastro_curto_v1', ...extra }); } catch {} };
    const script = document.createElement('script');
    script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5NMXL3LD47'; document.head.appendChild(script);
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, pixel);
    window.fbq('init', pixel);
    meta = (event, id) => { try { window.fbq('track', event, { content_name: 'Club OftalmoBlack', content_category: 'oftalmoblack_b2b' }, ...(id ? [{ eventID: id }] : [])); } catch {} };
    ga('page_view'); meta('PageView'); meta('ViewContent');
  }

  function fieldError(input, id, message) {
    const el = document.getElementById(id);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (el) { el.textContent = message; el.hidden = !message; }
  }
  function normalizedPhone(value) {
    const raw = value.trim();
    if (/[^+\d\s().-]/.test(raw) || (raw.includes('+') && !/^\+[^+]+$/.test(raw))) return '';
    let digits = raw.replace(/\D/g, '');
    if (!raw.startsWith('+')) {
      if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
      else if (!/^55\d{10,11}$/.test(digits)) return '';
    }
    if (!/^[1-9]\d{7,14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return '';
    if (digits.startsWith('55') && (!/^55[1-9]{2}\d{8,9}$/.test(digits) || /^(\d)\1+$/.test(digits.slice(4)))) return '';
    return '+' + digits;
  }
  function validate() {
    const nome = nameInput.value.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const whatsappNumber = normalizedPhone(phoneInput.value);
    const words = nome.split(' ');
    const nameOk = nome.length >= 5 && nome.length <= 120 && words.length >= 2 && words.every(word => /[\p{L}]/u.test(word)) && /^[\p{L}\p{M} .’'\-]+$/u.test(nome);
    fieldError(nameInput, 'name-error', nameOk ? '' : 'Informe seu nome e sobrenome.');
    fieldError(phoneInput, 'phone-error', whatsappNumber ? '' : 'Informe um telefone válido com DDD.');
    if (!nameOk || !whatsappNumber) { (nameOk ? phoneInput : nameInput).focus(); return null; }
    return { nome, whatsapp: whatsappNumber, pagina: '/club/', utm };
  }
  form.noValidate = true;
  form.addEventListener('input', (event) => {
    if (!started) { started = true; ga('form_start'); }
    if (event.target === nameInput) fieldError(nameInput, 'name-error', '');
    if (event.target === phoneInput) fieldError(phoneInput, 'phone-error', '');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || completed) return;
    error.hidden = true;
    const fields = validate();
    if (!fields) return;
    const fingerprint = JSON.stringify(fields);
    if (!attempt || attempt.fingerprint !== fingerprint) {
      if (!window.crypto?.randomUUID) { error.textContent = 'Atualize seu navegador para enviar o cadastro com segurança.'; error.hidden = false; return; }
      attempt = { fingerprint, payload: { submission_id: crypto.randomUUID(), ...fields } };
    }
    busy = true; form.setAttribute('aria-busy', 'true'); submit.disabled = true; nameInput.disabled = true; phoneInput.disabled = true;
    submit.textContent = 'Enviando seu cadastro…'; ga('form_submit_attempt');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let failure = 'Não foi possível confirmar seu cadastro. Tente novamente.';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify(attempt.payload), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      if (response.status === 429) failure = 'Aguarde um momento e tente enviar novamente.';
      const receipt = await response.json().catch(() => null);
      if (!response.ok || receipt?.ok !== true || receipt?.id !== attempt.payload.submission_id) throw new Error('unconfirmed');
      completed = true;
      whatsapp.href = 'https://wa.me/5511993436267?text=' + encodeURIComponent('Olá, Jean! Fiz meu cadastro na página do Club OftalmoBlack e quero saber mais sobre a mentoria.');
      whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer';
      form.hidden = true; success.hidden = false;
      ga('generate_lead'); meta('Lead', 'club:' + receipt.id + ':Lead');
      form.reset(); success.focus({ preventScroll: true });
      success.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } catch (e) {
      error.textContent = e.name === 'AbortError' ? 'A confirmação demorou mais que o esperado. Tente novamente; seu cadastro não será duplicado.' : failure;
      error.hidden = false; ga('form_error', { error_type: e.name === 'AbortError' ? 'timeout' : 'unconfirmed' });
    } finally {
      clearTimeout(timer); busy = false; form.removeAttribute('aria-busy'); submit.disabled = false; nameInput.disabled = false; phoneInput.disabled = false; submit.textContent = idleText;
    }
  });
  whatsapp.addEventListener('click', (event) => {
    if (!completed) { event.preventDefault(); return; }
    ga('whatsapp_click'); meta('Contact');
  });
  // HTML stays disabled if JavaScript fails; enable only after the submit guard exists.
  submit.disabled = false;
})();
