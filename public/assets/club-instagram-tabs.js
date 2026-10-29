/* Instagram: métricas e Turbinar compartilham a navegação de admin e membro. */
(function (C) {
  'use strict';
  var root, options, active = false, selected = 'metricas', revision = 0;
  var dialog, previousOverflow, returnFocus;
  var seen = {}, saving = {};
  var field = 'cb_instagram_turbina_tutorial_seen_at';
  var videoUrl = '/assets/tutorials/turbina-v1.mp4';

  function account() { return C.auth.current(); }
  function key(id) { return 'club:instagram:turbina:tutorial:v1:' + id; }
  function localSeen(id) {
    try { return seen[id] || localStorage.getItem(key(id)); }
    catch (_) { return seen[id]; }
  }
  function remember(id, date) {
    seen[id] = date;
    try { localStorage.setItem(key(id), date); } catch (_) { /* Memória nesta sessão. */ }
  }
  async function save(id, date) {
    if (saving[id] || !account() || account().userId !== id) return;
    saving[id] = true;
    try {
      // Só uma preferência visual da própria conta. Não participa de autorização.
      var data = {}; data[field] = date;
      var result = await C.sb.auth.updateUser({ data: data });
      if (result.error) throw result.error;
    } catch (_) {
      // O registro local evita repetição; a próxima entrada tenta sincronizar.
    } finally { saving[id] = false; }
  }
  function closeTutorial() {
    if (!dialog || !dialog.open) return;
    var video = dialog.querySelector('video');
    video.pause(); video.removeAttribute('src'); video.load();
    dialog.close();
    document.body.style.overflow = previousOverflow;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }
  function showTutorial() {
    if (!active || selected !== 'turbina') return false;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'ig-tutorial';
      dialog.setAttribute('aria-labelledby', 'igTutorialTitle');
      dialog.setAttribute('aria-describedby', 'igTutorialDescription');
      dialog.innerHTML = '<div class="modal-h"><div><h2 id="igTutorialTitle">Como usar o Turbinar</h2>' +
        '<p class="sub" id="igTutorialDescription">Um minuto para começar. Reveja quando quiser pelo botão Tutorial.</p></div>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-tutorial-close aria-label="Fechar tutorial">' + C.icon('x') + '</button></div>' +
        '<video controls playsinline preload="metadata" tabindex="0" aria-label="Tutorial do Turbinar" poster="/assets/tutorials/turbina-v1.jpg"></video>' +
        '<p class="ig-video-error" role="alert" hidden>Não foi possível carregar o vídeo. <a href="' + videoUrl + '" target="_blank" rel="noopener">Abrir o vídeo</a></p>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-tutorial-close]').onclick = closeTutorial;
      dialog.addEventListener('click', function (e) {
        if (e.target !== dialog) return;
        var box = dialog.getBoundingClientRect();
        if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) closeTutorial();
      });
      dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeTutorial(); });
      dialog.querySelector('video').addEventListener('error', function () {
        if (dialog.open) dialog.querySelector('.ig-video-error').hidden = false;
      });
    }
    if (dialog.open) return false;
    returnFocus = root.querySelector('[data-instagram-tutorial]');
    previousOverflow = document.body.style.overflow;
    dialog.querySelector('.ig-video-error').hidden = true;
    var video = dialog.querySelector('video');
    video.src = videoUrl;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    // O navegador pode exigir Play para liberar áudio; controles sempre visíveis.
    var play = video.play();
    if (play) play.catch(function () {});
    return true;
  }
  async function offerTutorial(manual) {
    var session = account(), turn = ++revision;
    if (!session) return;
    // Prévia nunca consome a primeira visita do mentorado nem a do administrador.
    if (options.preview) { if (manual) showTutorial(); return; }
    var id = session.userId;
    if (manual) {
      if (showTutorial()) {
        var date = localSeen(id) || new Date().toISOString();
        remember(id, date); save(id, date);
      }
      return;
    }
    try {
      // Consulta a conta para reconhecer visitas feitas em outro dispositivo.
      var result = await C.sb.auth.getUser();
      if (result.error) throw result.error;
      var user = result.data && result.data.user;
      if (turn !== revision || !active || selected !== 'turbina' || !account() || account().userId !== id || !user || user.id !== id) return;
      var remote = user.user_metadata && user.user_metadata[field];
      if (remote) { remember(id, remote); return; }
      var cached = localSeen(id);
      if (cached) { save(id, cached); return; }
      if (showTutorial()) {
        var shownAt = new Date().toISOString();
        remember(id, shownAt); save(id, shownAt);
      }
    } catch (_) {
      // Sem confirmação da conta, manter o botão manual e tentar na próxima entrada.
    }
  }
  function route(hash) {
    return /^#(?:branding(?:\/.*)?|(?:instagram|igMetricas)\/turbina)$/.test(hash || '') ? 'turbina' : 'metricas';
  }
  function hashFor(base) { return '#' + base + (selected === 'turbina' ? '/turbina' : ''); }
  function select(tab, writeHash) {
    selected = tab === 'turbina' ? 'turbina' : 'metricas';
    ++revision;
    root.querySelectorAll('[data-instagram-tab]').forEach(function (button) {
      var current = button.dataset.instagramTab === selected;
      button.setAttribute('aria-selected', String(current));
      button.tabIndex = current ? 0 : -1;
    });
    root.querySelectorAll('[data-instagram-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.instagramPanel !== selected;
    });
    root.querySelector('[data-instagram-tutorial]').hidden = selected !== 'turbina';
    if (writeHash) history.replaceState(null, '', location.pathname + location.search + hashFor(options.base));
    if (selected === 'turbina' && active) { C.branding.enter(); offerTutorial(false); }
    else closeTutorial();
    if (options.onChange) options.onChange();
  }
  function mount(el, opts) {
    closeTutorial(); ++revision;
    root = el; options = opts; active = false;
    root.querySelectorAll('[data-instagram-tab]').forEach(function (button) {
      button.onclick = function () { select(button.dataset.instagramTab, true); };
      button.onkeydown = function (e) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        var next = e.key === 'Home' ? 'metricas' : e.key === 'End' ? 'turbina' : selected === 'metricas' ? 'turbina' : 'metricas';
        select(next, true);
        root.querySelector('[data-instagram-tab="' + next + '"]').focus();
      };
    });
    root.querySelector('[data-instagram-tutorial]').onclick = function () { offerTutorial(true); };
    select('metricas', false);
  }
  C.instagramTabs = {
    mount: mount, route: route, hashFor: hashFor,
    enter: function (hash) { active = true; select(route(hash), true); },
    leave: function () { active = false; ++revision; closeTutorial(); }
  };
})(window.Club);
