/* ============================================================================
   Club OftalmoBlack — utilidades de tela compartilhadas por /admin/ e /membros/

   Vocabulário do produto (categorias, cadências, status) vive aqui em um lugar
   só, para as duas telas nunca divergirem. As cores de categoria e de status de
   artefato são as mesmas que o protótipo já usava.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};

  /* ── vocabulário ──────────────────────────────────────────────────────── */

  C.CATEGORIAS = ['Conteúdo', 'Tráfego', 'Vendas', 'Estrutura'];

  /* Categorias do acervo. Lista fixa de propósito: com texto livre o mesmo
     assunto vira "Análise", "Analises" e "análise de tráfego" em três meses. */
  C.MAT_CATEGORIAS = ['Análises', 'Tutoriais', 'Roteiros', 'Relatórios',
                      'Modelos', 'Aulas', 'Outros'];
  C.MAT_ICONE = {
    'Análises':   'grid',
    'Tutoriais':  'award',
    'Roteiros':   'file-text',
    'Relatórios': 'file-text',
    'Modelos':    'copy',
    'Aulas':      'play-circle',
    'Outros':     'box'
  };
  C.CADENCIAS  = ['Semanal', 'Quinzenal', 'Mensal', 'Entrega única'];
  C.FORMATOS   = ['Ao vivo', 'Gravada'];
  C.ART_STATUS = ['Disponível', 'Em produção', 'Bloqueado'];
  C.ART_ICONES = ['grid', 'play-circle', 'layout', 'zap', 'file-text', 'video',
                  'box', 'award', 'settings', 'link'];

  C.TINT = {
    'Conteúdo':'#7B5CFF', 'Tráfego':'#4A9EF0', 'Vendas':'#E8C07A', 'Estrutura':'#5BD68A'
  };
  C.ART_ST = {
    'Disponível':  { color:'#5BD68A', icon:'unlock' },
    'Em produção': { color:'#F0B34A', icon:'loader' },
    'Bloqueado':   { color:'#6B6577', icon:'lock' }
  };

  /* ── texto ────────────────────────────────────────────────────────────── */

  C.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
    });
  };

  /* "Dra. Luciana da Hora" → "LH". Fora o prefixo Dr./Dra., as partículas
     também não entram na sigla. */
  var PARTICULA = /^(d[aeo]s?|e)$/i;
  C.initials = function (nome) {
    var p = String(nome || '').replace(/^(Dr|Dra)\.?\s+/i, '').trim().split(/\s+/)
      .filter(function (w) { return w && !PARTICULA.test(w); });
    if (!p.length) return '--';
    var a = p[0][0];
    var b = p.length > 1 ? p[p.length - 1][0] : '';
    return (a + b).toUpperCase();
  };

  /* ── datas ────────────────────────────────────────────────────────────── */

  var MES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  var DIA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  /* Datas chegam como 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM'. Passar direto pro
     Date() faria o navegador ler a primeira forma como UTC e trocar o dia. */
  function parse(iso) {
    if (!iso) return null;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }
  C.parseDate = parse;

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  C.diffDays = function (iso) {
    var d = parse(iso);
    if (!d) return null;
    return Math.round((midnight(d) - midnight(new Date())) / 86400000);
  };

  C.dateParts = function (iso) {
    var d = parse(iso);
    if (!d) return { day:'--', month:'', weekday:'', time:'' };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: MES[d.getMonth()],
      weekday: DIA[d.getDay()],
      time: String(d.getHours()).padStart(2, '0') + 'h' +
            String(d.getMinutes()).padStart(2, '0')
    };
  };

  var MES_EXT = ['janeiro','fevereiro','março','abril','maio','junho','julho',
                 'agosto','setembro','outubro','novembro','dezembro'];

  /* "março de 2026" — usado onde o dia exato não interessa. */
  C.fmtMesAno = function (iso) {
    var d = parse(iso);
    return d ? MES_EXT[d.getMonth()] + ' de ' + d.getFullYear() : '—';
  };

  C.fmtDate = function (iso) {
    var p = C.dateParts(iso);
    return p.month ? p.day + ' ' + p.month : '—';
  };

  /* Vencimento em linguagem de gente: "Vence hoje", "Venceu há 2 dias". */
  C.fmtDue = function (iso) {
    var n = C.diffDays(iso);
    if (n === null) return 'Sem prazo';
    if (n === 0) return 'Vence hoje';
    if (n === 1) return 'Vence amanhã';
    if (n === -1) return 'Venceu ontem';
    if (n < -1) return 'Venceu há ' + Math.abs(n) + ' dias';
    if (n <= 6) return 'Vence ' + DIA[parse(iso).getDay()].toLowerCase();
    return 'Vence em ' + C.fmtDate(iso).toLowerCase();
  };

  C.isLate = function (t) {
    return t.status !== 'done' && C.diffDays(t.vence_em) !== null && C.diffDays(t.vence_em) < 0;
  };

  /* "2,4 MB" — o mentorado decide se baixa agora ou espera o wi-fi. */
  C.fmtBytes = function (n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  };

  /* Extensão em maiúscula, para o cartão dizer o que a pessoa vai receber. */
  C.fmtExt = function (nome) {
    var m = String(nome || '').match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toUpperCase() : 'ARQUIVO';
  };

  C.fmtDataCurta = function (iso) {
    var d = parse(iso);
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  };

  C.greeting = function () {
    var h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  };

  /* ── toast ────────────────────────────────────────────────────────────── */

  var toastEl = null, toastTimer = null;

  C.toast = function (msg, icon) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = C.icon(icon || 'check-circle') + '<span>' + C.esc(msg) + '</span>';
    /* reinicia a transição quando um toast substitui outro */
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  };

  /* ── modal ────────────────────────────────────────────────────────────── */

  var modalEl = null, onSubmit = null, lastFocus = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.hidden = true;
    modalEl.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) C.modal.close();
      if (e.target.closest('[data-close]')) C.modal.close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modalEl.hidden) C.modal.close();
    });
    return modalEl;
  }

  C.modal = {
    /* opts: { title, sub, body, submitLabel, onSubmit(dados) } — o body é um
       <form>, então os campos vêm por name e Enter já envia. */
    open: function (opts) {
      var el = ensureModal();
      lastFocus = document.activeElement;
      onSubmit = opts.onSubmit;

      el.querySelector('.modal-box').innerHTML =
        '<div class="modal-h">' +
          '<div style="flex:1">' +
            '<h2>' + C.esc(opts.title) + '</h2>' +
            (opts.sub ? '<p class="sub">' + C.esc(opts.sub) + '</p>' : '') +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" data-close aria-label="Fechar">' +
            C.icon('x') + '</button>' +
        '</div>' +
        '<form id="modalForm" novalidate>' + opts.body + '</form>' +
        '<div class="modal-f">' +
          '<button class="btn" type="button" data-close>Cancelar</button>' +
          '<button class="btn btn-primary" type="submit" form="modalForm">' +
            C.esc(opts.submitLabel || 'Salvar') + '</button>' +
        '</div>';

      el.hidden = false;
      document.body.style.overflow = 'hidden';

      var form = el.querySelector('#modalForm');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {};
        Array.prototype.forEach.call(form.elements, function (f) {
          if (!f.name) return;
          if (f.type === 'checkbox') { data[f.name] = f.checked; }
          else if (f.multiple) {
            data[f.name] = Array.prototype.filter.call(f.options, function (o) { return o.selected; })
              .map(function (o) { return o.value; });
          } else { data[f.name] = f.value.trim(); }
        });
        if (onSubmit) onSubmit(data);
      });

      var first = form.querySelector('input,select,textarea');
      if (first) first.focus();
    },

    close: function () {
      if (!modalEl) return;
      modalEl.hidden = true;
      document.body.style.overflow = '';
      onSubmit = null;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },

    /* Confirmação de exclusão — texto sempre nomeando o que sai. */
    confirm: function (titulo, aviso, onYes) {
      C.modal.open({
        title: titulo,
        body: '<p style="color:var(--muted);font-size:14px;line-height:1.6;margin:0">' +
              C.esc(aviso) + '</p>',
        submitLabel: 'Remover',
        onSubmit: function () { C.modal.close(); onYes(); }
      });
      var b = modalEl.querySelector('.modal-f .btn-primary');
      b.classList.remove('btn-primary');
      b.classList.add('btn-danger');
    }
  };

  /* ── formulário: helpers de campo ─────────────────────────────────────── */

  C.field = function (label, name, opts) {
    opts = opts || {};
    var attrs = 'name="' + name + '" class="inp"' +
      (opts.type ? ' type="' + opts.type + '"' : ' type="text"') +
      (opts.required ? ' required' : '') +
      (opts.placeholder ? ' placeholder="' + C.esc(opts.placeholder) + '"' : '') +
      (opts.min !== undefined ? ' min="' + opts.min + '"' : '');
    var input = opts.textarea
      ? '<textarea name="' + name + '" class="inp"' + (opts.required ? ' required' : '') +
        (opts.placeholder ? ' placeholder="' + C.esc(opts.placeholder) + '"' : '') + '>' +
        C.esc(opts.value) + '</textarea>'
      : '<input ' + attrs + ' value="' + C.esc(opts.value) + '">';
    return '<div class="fld"><label for="' + name + '">' + C.esc(label) + '</label>' + input +
      (opts.hint ? '<span class="hint">' + C.esc(opts.hint) + '</span>' : '') + '</div>';
  };

  C.select = function (label, name, options, value, opts) {
    opts = opts || {};
    var body = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.value;
      var t = typeof o === 'string' ? o : o.label;
      return '<option value="' + C.esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') +
        '>' + C.esc(t) + '</option>';
    }).join('');
    return '<div class="fld"><label for="' + name + '">' + C.esc(label) + '</label>' +
      '<select name="' + name + '" class="inp"' + (opts.multiple ? ' multiple size="6"' : '') + '>' +
      body + '</select>' +
      (opts.hint ? '<span class="hint">' + C.esc(opts.hint) + '</span>' : '') + '</div>';
  };

  C.checkbox = function (label, name, checked) {
    return '<label class="check-line"><input type="checkbox" name="' + name + '"' +
      (checked ? ' checked' : '') + '><span>' + C.esc(label) + '</span></label>';
  };

  C.empty = function (icon, texto) {
    return '<div class="empty">' + C.icon(icon) + '<p>' + C.esc(texto) + '</p></div>';
  };
})();
