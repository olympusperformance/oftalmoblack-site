/* ============================================================================
   Imersão Grau Zero — comportamento da página (vanilla JS, sem framework)
   Substitui o runtime React/DCLogic da versão original.
   A animação de abertura (intro da lente) foi removida.
   ========================================================================= */
(function () {
  'use strict';

  var onReady = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  /* ── reveal on scroll ──────────────────────────────────────────────────── */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    var showAll = function () { els.forEach(function (el) { el.classList.add('rv-in'); }); };
    if (!('IntersectionObserver' in window)) { showAll(); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    els.forEach(function (el) { io.observe(el); });
    // rede de segurança: se algo travar o observer, o conteúdo aparece.
    setTimeout(showAll, 2500);
  }

  /* ── contadores ────────────────────────────────────────────────────────── */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var dur = 1900, start = performance.now();
    var tick = function (now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initCounters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!('IntersectionObserver' in window)) { nums.forEach(countUp); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ── nav + parallax do herói ───────────────────────────────────────────── */
  function initScrollFx() {
    var nav = document.getElementById('gz-nav');
    var stage = document.getElementById('gz-lens-stage');
    var onScroll = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      if (nav) nav.classList.toggle('is-stuck', y > 40);
      if (stage && y < window.innerHeight * 1.4) {
        stage.style.transform = 'translateY(' + (y * 0.16) + 'px) scale(' + (1 - Math.min(y, 700) / 4600) + ')';
        stage.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.82)));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── parallax 3D da lente com o ponteiro ───────────────────────────────── */
  function initLens() {
    var stage = document.getElementById('gz-lens-stage');
    var lens = document.getElementById('gz-lens');
    if (!stage || !lens) return;
    var reset = function () {
      lens.style.transform = 'rotateX(0deg) rotateY(0deg)';
      lens.style.setProperty('--gx', '50%');
      lens.style.setProperty('--gy', '32%');
    };
    window.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      var dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      lens.style.transform = 'rotateX(' + (dy * -15) + 'deg) rotateY(' + (dx * 17) + 'deg)';
      lens.style.setProperty('--gx', (50 + dx * 32) + '%');
      lens.style.setProperty('--gy', (32 + dy * 30) + '%');
    }, { passive: true });
    window.addEventListener('blur', reset);
  }

  /* ── vídeo de fundo do herói ───────────────────────────────────────────── */
  function initHeroVideo() {
    var v = document.getElementById('gz-hero-video');
    if (!v) return;
    v.muted = true;
    var tryPlay = function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    tryPlay();
    window.addEventListener('pointerdown', tryPlay, { once: true });
    window.addEventListener('scroll', tryPlay, { once: true, passive: true });
  }

  /* ── vídeos com botão de play e retomada de posição ────────────────────── */
  function wireVideo(video, btn, storageKey) {
    var save = function () {
      try { localStorage.setItem(storageKey, String(video.currentTime)); } catch (e) {}
    };
    try {
      var saved = parseFloat(localStorage.getItem(storageKey));
      if (saved > 0) {
        var restore = function () { if (saved < video.duration - 0.5) video.currentTime = saved; };
        if (video.readyState >= 1) restore();
        else video.addEventListener('loadedmetadata', restore, { once: true });
      }
    } catch (e) {}
    video.addEventListener('timeupdate', save);

    var hide = function () { btn.classList.add('is-hidden'); };
    var show = function () { btn.classList.remove('is-hidden'); };

    btn.addEventListener('click', function () {
      video.muted = false;
      video.volume = 1;
      video.setAttribute('controls', '');
      hide();
      var tryPlay = function () {
        var p = video.play();
        if (p && p.catch) p.catch(function () {
          video.load();
          video.addEventListener('canplay', function () { video.play(); }, { once: true });
        });
      };
      if (video.readyState >= 2) tryPlay();
      else { video.load(); video.addEventListener('canplay', tryPlay, { once: true }); tryPlay(); }
    });
    video.addEventListener('play', hide);
    video.addEventListener('pause', function () {
      if (video.ended || video.currentTime === 0) show();
    });
    video.addEventListener('ended', function () { video.removeAttribute('controls'); show(); });
  }

  function initVideos() {
    Array.prototype.slice.call(document.querySelectorAll('[data-video]')).forEach(function (video) {
      var wrap = video.parentElement;
      var btn = wrap && wrap.querySelector('.gz-play');
      if (btn) wireVideo(video, btn, 'gz-vidpos-' + video.getAttribute('data-video'));
    });
  }

  /* ── abas Dia I / Dia II ───────────────────────────────────────────────── */
  var activeDay = 1;

  function initDayTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.day-tab'));
    if (!tabs.length) return;
    var select = function (day) {
      activeDay = day;
      tabs.forEach(function (t) {
        t.setAttribute('aria-selected', String(Number(t.getAttribute('data-day')) === day));
      });
      Array.prototype.slice.call(document.querySelectorAll('.day-panel')).forEach(function (p) {
        p.hidden = Number(p.getAttribute('data-day')) !== day;
      });
      positionCarousel();
    };
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { select(Number(t.getAttribute('data-day'))); });
    });
    select(activeDay);
  }

  /* ── carrossel de fotos da imersão (3 quadros que rotacionam) ──────────── */
  var LEFTS = ['1.5%', '35%', '68.5%'];

  function positionCarousel() {
    var panel = document.querySelector('.day-panel[data-day="' + activeDay + '"]');
    if (!panel) return;
    var frames = Array.prototype.slice.call(panel.querySelectorAll('.ev-frame'));
    if (!frames.length) return;
    var rot = Math.floor(Date.now() / 3400) % 3;
    frames.forEach(function (f, i) {
      var pos = (i - rot + 3) % 3;
      var center = pos === 1;
      f.style.left = LEFTS[pos];
      f.style.transform = 'translateY(-50%) scale(' + (center ? 1.15 : 0.88) + ')';
      f.style.zIndex = center ? '3' : '1';
      f.style.opacity = center ? '1' : '0.62';
      f.style.boxShadow = center
        ? '0 30px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.2)'
        : 'inset 0 1px 0 rgba(255,255,255,.12),0 14px 30px rgba(0,0,0,.4)';
    });
  }

  /* ── FAQ ───────────────────────────────────────────────────────────────── */
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    items.forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var body = item.querySelector('.faq-a');
      if (!btn || !body) return;
      btn.addEventListener('click', function () {
        var willOpen = btn.getAttribute('aria-expanded') !== 'true';
        items.forEach(function (other) {
          var b = other.querySelector('.faq-q');
          var a = other.querySelector('.faq-a');
          if (b) b.setAttribute('aria-expanded', 'false');
          if (a) a.classList.remove('is-open');
        });
        if (willOpen) {
          btn.setAttribute('aria-expanded', 'true');
          body.classList.add('is-open');
        }
      });
    });
  }

  /* ── lightbox da galeria ───────────────────────────────────────────────── */
  function initLightbox() {
    var box = document.getElementById('gz-lightbox');
    if (!box) return;
    var img = box.querySelector('img');
    var close = function () { box.hidden = true; img.removeAttribute('src'); };

    Array.prototype.slice.call(document.querySelectorAll('.gal-zoom')).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var tile = btn.closest('.gal-tile');
        if (!tile) return;
        // pega a imagem que está visível no momento do clique
        var a = tile.querySelector('.gal-a img');
        var b = tile.querySelector('.gal-b img');
        var layerA = tile.querySelector('.gal-a');
        var visible = a;
        if (layerA && b && parseFloat(getComputedStyle(layerA).opacity) < 0.5) visible = b;
        if (!visible) visible = a || b;
        if (!visible) return;
        img.src = visible.currentSrc || visible.src;
        box.hidden = false;
      });
    });

    box.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }

  onReady(function () {
    initReveal();
    initCounters();
    initScrollFx();
    initLens();
    initHeroVideo();
    initVideos();
    initDayTabs();
    initFaq();
    initLightbox();
    setInterval(positionCarousel, 500);
  });
})();
