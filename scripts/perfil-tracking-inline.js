(() => {
  'use strict';
  const paths = new Set(['/perfil-clinica/', '/perfil-clinica/nivel-2/']);
  const params = new URLSearchParams(location.search);
  if (document.documentElement.dataset.perfilAnalytics !== 'true' || location.protocol !== 'https:'
    || !['oftalmoblack.com.br','www.oftalmoblack.com.br'].includes(location.hostname)
    || !paths.has(location.pathname) || Array.from(params).some(([key,value])=>key.toLowerCase()==='qa'&&value==='1')
    || (params.get('utm_source') || '').toLowerCase() === 'qa' || window.perfilTrackingLoaded) return;
  window.perfilTrackingLoaded = true;
  // Só estas duas fichas carregam os SDKs. O nível 1 e a presença não participam.
  const clean = new URL(location.origin + location.pathname);
  const origem = ['presencial','stories'].includes(params.get('origem')) ? params.get('origem') : 'direto';
  if (params.has('origem')) clean.searchParams.set('origem', origem);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
    const value = (params.get(key) || '').trim();
    if (value && value.length <= 200 && !/[@\x00-\x1f]|(?:\d[\s().+-]*){8,}/.test(value)) clean.searchParams.set(key, value);
  }
  for (const key of ['fbclid','gclid','aid']) {
    const value = params.get(key) || '';
    if (/^[A-Za-z0-9_.-]{1,500}$/.test(value)) clean.searchParams.set(key,value);
  }
  // O Pixel lê a URL do documento. Remover query arbitrária/hash antes do SDK.
  try { history.replaceState(history.state, '', clean.href); } catch { return; }
  const referrer = (() => { try { return new URL(document.referrer).origin + '/'; } catch { return ''; } })();
  // O SDK Meta também lê document.referrer; limitar à origem, sem query/path.
  try { Object.defineProperty(document,'referrer',{value:referrer,configurable:true}); } catch { return; }
  const base = { produto:'perfil_clinica_black', form_id:'perfil-form', origem };
  const PIXEL = '919253591198015';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config','G-5NMXL3LD47', { send_page_view:false, page_location:clean.href, page_referrer:referrer });
  const ga = (name, extra = {}) => { try { window.gtag('event',name,{...base,...extra}); } catch {} };
  const script = document.createElement('script'); script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5NMXL3LD47'; document.head.appendChild(script);
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('set','autoConfig',false,PIXEL);
  // Opt-out por página, sem alterar a configuração global do dataset.
  for(const feature of ['AutomaticMatching','AutomaticMatchingForPartnerIntegrations','AutomaticMatchingRegex','AutomaticMatchingAI']) window.fbq('optOut',PIXEL,feature);
  window.fbq('init',PIXEL);
  const meta = (name, extra = {}, options) => { try { window.fbq('track',name,extra,...(options?[options]:[])); } catch {} };
  ga('page_view'); meta('PageView');
  meta('ViewContent',{content_name:'Perfil da clínica Black',content_category:'oftalmoblack_b2b'});
  const once = new Set(), receipts = new Set();
  const gaOnce = (key,name,extra) => { if(once.has(key))return; once.add(key);ga(name,extra); };
  document.getElementById('perfil-form')?.addEventListener('input',()=>gaOnce('start','perfil_black_form_start',{form_step:1}));
  window.addEventListener('perfil-black:progress',event=>{
    const action=event.detail?.action;
    if(action==='contact_complete')gaOnce('contact','perfil_black_contact_complete',{form_step:1});
    if(action==='submit')ga('perfil_black_submit_attempt',{form_step:2});
    if(action==='error')ga('perfil_black_form_error',{error_type:event.detail?.error_type==='timeout'?'timeout':'unconfirmed'});
  });
  window.addEventListener('perfil-black:receipt',event=>{
    const r=event.detail;
    if(r?.ok!==true || typeof r.id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.id) || receipts.has(r.id))return;
    receipts.add(r.id);
    ga('generate_lead');
    meta('Lead',{content_name:'Perfil da clínica Black',content_category:'oftalmoblack_b2b'}, {eventID:'perfil-black:'+r.id+':Lead'});
  });
})();
