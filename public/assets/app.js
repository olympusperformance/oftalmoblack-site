/* ============================================================================
   Club OftalmoBlack — comportamento da home

   Substitui o runtime original (que baixava React 18 + Babel do unpkg.com e
   compilava a página no navegador a cada visita). O código do formulário, do
   canvas e do reveal foi trazido do arquivo original praticamente sem mudança —
   já era JavaScript puro manipulando o DOM. Só o FAQ dependia do React.
   ========================================================================= */
(function () {
  'use strict';

  /* ── style-hover: aplicado por CSS gerado (.obh-N:hover) ─────────────────
     Nada a fazer em JS. Ver styles.css no fim do arquivo.                  */

  /* ── reveal ao rolar ──────────────────────────────────────────────────── */
  function initReveal() {
    var nodes = document.querySelectorAll('.rev');
    var fired = false;
    var reveal = function (el) { el.style.opacity = '1'; el.style.transform = 'none'; };

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, reveal);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      fired = true;
      entries.forEach(function (e) {
        if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(nodes, function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(34px)';
      el.style.transition = 'opacity 1.15s cubic-bezier(.16,.7,.2,1), transform 1.15s cubic-bezier(.16,.7,.2,1)';
      io.observe(el);
    });

    // rede de segurança: se o observer não disparar, revela tudo
    setTimeout(function () {
      if (!fired) {
        Array.prototype.forEach.call(nodes, reveal);
        io.disconnect();
      }
    }, 1200);
  }

  /* ── fundo: barras verticais em canvas reagindo ao ponteiro ───────────── */
  var cw = 0, ch = 0, bars = null, t = 0, rafAlive = false, raf = null;
  var mouse = { x: -9999, y: 0, tx: -9999, ty: 0, active: false };

  function setupCanvas() {
    var cv = document.getElementById('ob-canvas');
    if (!cv) return;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = w * DPR; cv.height = h * DPR;
    cv.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
    cw = w; ch = h;
    bars = [];
    var x = 0;
    while (x < w) {
      var bw = 6 + Math.random() * 30;
      bars.push({ x: x, w: bw, base: 0.02 + Math.random() * 0.10, ph: Math.random() * Math.PI * 2, mid: 0.34 + Math.random() * 0.16 });
      x += bw + Math.random() * 3;
    }
  }

  function startDraw() {
    if (rafAlive) return;
    rafAlive = true;
    var step = function () {
      if (!rafAlive) return;
      var cv = document.getElementById('ob-canvas');
      if (!cv || !bars || !bars.length) { rafAlive = false; return; }
      var ctx = cv.getContext('2d');
      t += 0.006;
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i];
        var cx = b.x + b.w / 2;
        var lum = b.base + 0.06 * (0.5 + 0.5 * Math.sin(cx * 0.012 - t * 1.6 + b.ph));
        if (mouse.active) {
          var d = Math.abs(cx - mouse.x);
          var g = Math.max(0, 1 - d / 240);
          lum += g * g * 0.30;
        }
        lum = Math.min(0.92, lum);
        var gr = ctx.createLinearGradient(0, 0, 0, ch);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(b.mid, 'rgba(232,166,84,' + lum.toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(b.x, 0, b.w - 0.6, ch);
      }
      if (mouse.active) {
        var rg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 280);
        rg.addColorStop(0, 'rgba(232,166,84,0.06)');
        rg.addColorStop(1, 'rgba(232,166,84,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, cw, ch);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function initCanvas() {
    document.addEventListener('pointermove', function (e) {
      mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.active = true;
      if (!rafAlive) startDraw();
    });
    window.addEventListener('resize', setupCanvas);
    setupCanvas();
    startDraw();
  }

  /* ── FAQ ──────────────────────────────────────────────────────────────── */
  function initFaq() {
    var qs = Array.prototype.slice.call(document.querySelectorAll('.ob-faq-q'));
    qs.forEach(function (btn) {
      var body = btn.nextElementSibling;
      if (!body || !body.classList.contains('ob-faq-a')) return;
      btn.addEventListener('click', function () {
        var willOpen = btn.getAttribute('aria-expanded') !== 'true';
        // só um aberto por vez, como no original
        qs.forEach(function (other) {
          other.setAttribute('aria-expanded', 'false');
          var sign = other.querySelector('.ob-faq-sign');
          if (sign) sign.textContent = '+';
          var b = other.nextElementSibling;
          if (b && b.classList.contains('ob-faq-a')) b.classList.remove('is-open');
        });
        if (willOpen) {
          btn.setAttribute('aria-expanded', 'true');
          var s = btn.querySelector('.ob-faq-sign');
          if (s) s.textContent = '–';
          body.classList.add('is-open');
        }
      });
    });
  }

  /* ── formulário de aplicação (6 etapas) ───────────────────────────────── */
  function initApplyForm() {
    var form = document.getElementById('applicationForm');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';

    var CFG = { endpoint: 'https://hook.us2.make.com/p0nit1xj97m5qvfspo4pkzphlsw4a4b5', waFallback: '5592914418889' };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var draftT = null;

    $$('.obf-choices', form).forEach(function (group) {
      var isRadio = !!group.querySelector('input[type="radio"]');
      group.addEventListener('change', function () {
        if (isRadio) $$('.obf-choice', group).forEach(function (c) { c.classList.remove('is-selected'); });
        $$('input', group).forEach(function (input) {
          var label = input.closest('.obf-choice');
          if (input.checked) label.classList.add('is-selected');
          else if (!isRadio) label.classList.remove('is-selected');
        });
      });
    });

    var trafegoValor = document.getElementById('trafego-valor');
    var updateCond = function () {
      var checked = form.querySelector('input[name="trafego"]:checked');
      if (checked && checked.dataset.shows) trafegoValor.classList.remove('obf-hiddenf');
      else {
        trafegoValor.classList.add('obf-hiddenf');
        $$('input', trafegoValor).forEach(function (i) {
          i.checked = false;
          i.closest('.obf-choice').classList.remove('is-selected');
        });
      }
    };
    $$('input[name="trafego"]', form).forEach(function (i) { i.addEventListener('change', updateCond); });

    var maskPhone = function (v) {
      v = v.replace(/\D/g, '').slice(0, 11);
      if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
      if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
      if (v.length > 2) return v.replace(/(\d{2})(\d{0,5}).*/, '($1) $2');
      if (v.length > 0) return v.replace(/(\d{0,2}).*/, '($1');
      return '';
    };
    var phone = document.getElementById('f_whatsapp');
    phone.addEventListener('input', function (e) { e.target.value = maskPhone(e.target.value); });

    var ig = document.getElementById('f_instagram');
    ig.addEventListener('blur', function (e) {
      var v = e.target.value.trim();
      if (v && v.charAt(0) !== '@') v = '@' + v.replace(/^@+/, '');
      e.target.value = v;
    });

    var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    var isPhone = function (v) { return v.replace(/\D/g, '').length >= 10; };
    var MINLEN = { f_nome: 3, f_visao: 30 };
    var setErr = function (el, bad) { var w = el.closest('.obf-field'); if (w) w.classList.toggle('has-error', bad); };

    var validateStep = function (n) {
      var step = form.querySelector('.obf-step[data-step="' + n + '"]');
      var valid = true;
      $$('input[required],select[required],textarea[required]', step).forEach(function (el) {
        if (el.type === 'checkbox' || el.type === 'radio') return;
        var bad = !el.value.trim()
          || (el.type === 'email' && !isEmail(el.value))
          || (el.id === 'f_whatsapp' && !isPhone(el.value))
          || (MINLEN[el.id] && el.value.trim().length < MINLEN[el.id]);
        setErr(el, !!bad);
        if (bad) valid = false;
      });
      var names = {};
      $$('input[type="radio"][required]', step).forEach(function (r) { names[r.name] = 1; });
      Object.keys(names).forEach(function (name) {
        var checked = step.querySelector('input[name="' + name + '"]:checked');
        var group = step.querySelector('.obf-choices[data-name="' + name + '"]');
        if (group) { var w = group.closest('.obf-field'); if (w) w.classList.toggle('has-error', !checked); }
        if (!checked) valid = false;
      });
      if (n === 6) {
        var obj = $$('input[name="objetivos"]:checked', step);
        var g = step.querySelector('.obf-choices[data-name="objetivos"]');
        if (g) { var w2 = g.closest('.obf-field'); if (w2) w2.classList.toggle('has-error', obj.length === 0); }
        if (obj.length === 0) valid = false;
        var c = document.getElementById('f_consent');
        var cw2 = c.closest('.obf-consent');
        if (!c.checked) { valid = false; cw2.style.borderColor = '#d97a7a'; } else { cw2.style.borderColor = ''; }
      }
      return valid;
    };

    var TOTAL = 6;
    var cur = 1;
    var btnBack = document.getElementById('btnBack');
    var btnNext = document.getElementById('btnNext');
    var btnSubmit = document.getElementById('btnSubmit');
    var scrollTop = function () {
      var sec = document.getElementById('aplicacao');
      window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' });
    };

    var show = function (n) {
      $$('.obf-step', form).forEach(function (s) { s.classList.toggle('is-active', Number(s.dataset.step) === n); });
      $$('.obf-pstep', form).forEach(function (p) {
        var sn = Number(p.dataset.step);
        p.classList.toggle('is-active', sn === n);
        p.classList.toggle('is-done', sn < n);
      });
      btnBack.style.visibility = n > 1 ? 'visible' : 'hidden';
      btnNext.style.display = n < TOTAL ? 'inline-flex' : 'none';
      btnSubmit.style.display = n === TOTAL ? 'inline-flex' : 'none';
    };

    var KEY = 'black_application_draft_v3';
    var collect = function () {
      var fd = new FormData(form), d = {};
      fd.forEach(function (v, k) {
        if (d[k] === undefined) d[k] = v;
        else if (Array.isArray(d[k])) d[k].push(v);
        else d[k] = [d[k], v];
      });
      return d;
    };
    var saveDraft = function () {
      try { localStorage.setItem(KEY, JSON.stringify({ data: collect(), step: cur, ts: Date.now() })); } catch (e) {}
    };

    btnNext.addEventListener('click', function () {
      if (!validateStep(cur)) return;
      saveDraft();
      if (cur < TOTAL) { cur++; show(cur); scrollTop(); }
    });
    btnBack.addEventListener('click', function () { if (cur > 1) { cur--; show(cur); scrollTop(); } });

    [['f_visao', 'visaoCount'], ['f_gargalo', 'gargaloCount']].forEach(function (pair) {
      var t2 = document.getElementById(pair[0]), c = document.getElementById(pair[1]);
      if (!t2 || !c) return;
      var up = function () {
        if (t2.value.length > 500) t2.value = t2.value.slice(0, 500);
        c.textContent = t2.value.length;
      };
      t2.addEventListener('input', up);
      up();
    });

    var loadDraft = function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        var data = parsed && parsed.data;
        if (!data) return;
        Object.keys(data).forEach(function (k) {
          var v = data[k];
          var fields = $$('[name="' + k + '"]', form);
          if (!fields.length) return;
          if (fields[0].type === 'radio') {
            fields.forEach(function (f) {
              if (f.value === v) { f.checked = true; f.dispatchEvent(new Event('change', { bubbles: true })); }
            });
          } else if (fields[0].type === 'checkbox') {
            var arr = Array.isArray(v) ? v : [v];
            fields.forEach(function (f) {
              if (arr.indexOf(f.value) > -1) { f.checked = true; f.dispatchEvent(new Event('change', { bubbles: true })); }
            });
          } else {
            fields[0].value = v;
          }
        });
        if (phone.value) phone.value = maskPhone(phone.value);
        ['f_visao', 'f_gargalo'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.dispatchEvent(new Event('input'));
        });
        updateCond();
      } catch (e) {}
    };
    loadDraft();
    form.addEventListener('input', function () { clearTimeout(draftT); draftT = setTimeout(saveDraft, 600); });

    var genProtocol = function () {
      var r = Math.random().toString(36).slice(2, 6).toUpperCase();
      var ts = Date.now().toString(36).slice(-5).toUpperCase();
      return 'BLK-' + ts + '-' + r;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(6)) return;
      var protocol = genProtocol();
      var payload = {
        protocol: protocol,
        submittedAt: new Date().toISOString(),
        page: location.href,
        userAgent: navigator.userAgent,
        data: collect(),
      };
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Enviando…';

      fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        try { localStorage.removeItem(KEY); } catch (e2) {}
        if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'aplicacao_club_oftalmoblack' });
        form.style.display = 'none';
        var th = document.getElementById('obf-thanks');
        th.classList.add('is-active');
        document.getElementById('obfThanksId').textContent = 'Protocolo: ' + protocol;
        scrollTop();
      }).catch(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Tentar enviar novamente';
        alert('Não conseguimos enviar agora. Você pode falar direto com a equipe no WhatsApp: +' + CFG.waFallback);
      });
    });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        if (cur < TOTAL) { e.preventDefault(); btnNext.click(); }
      }
    });

    show(1);
  }

  function boot() {
    initReveal();
    initCanvas();
    initFaq();
    initApplyForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
