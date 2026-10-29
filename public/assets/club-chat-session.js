/* Conversa local limitada. Nenhuma credencial ou bloco interno é armazenado.
   A chave separa conta autenticada e mentorado; autorização continua no servidor. */
(function () {
  'use strict';
  var C = window.Club = window.Club || {};
  var KEY = 'club:cerebro:sessions:v1', IDLE = 86400000, AGE = 7 * IDLE;
  var MAX_CHARS = 32000, MAX_CACHE = 120000, memory = [], persisted = true;
  var storage;
  try { storage = window.localStorage; } catch (_) { persisted = false; }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function history(messages) {
    if (!Array.isArray(messages) || messages.length % 2 || messages.length > 100) return null;
    if (!messages.every(function (m, i) {
      return m && m.role === (i % 2 ? 'assistant' : 'user') &&
        typeof m.content === 'string' && m.content.trim() && m.content.length <= 16000;
    })) return null;
    var result = messages.slice(-12).map(function (m) { return {role:m.role, content:m.content}; });
    while (result.reduce(function (n,m) { return n + m.content.length; }, 0) > MAX_CHARS) result.splice(0,2);
    return result;
  }
  function expired(e, now) { return now - e.updatedAt >= IDLE || now - e.createdAt >= AGE; }
  function valid(e, now) {
    return e && typeof e.key === 'string' && e.key.length < 250 &&
      typeof e.id === 'string' && e.id.length < 100 && Number.isSafeInteger(e.rev) && e.rev >= 0 &&
      Number.isFinite(e.createdAt) && Number.isFinite(e.updatedAt) &&
      e.createdAt <= e.updatedAt && e.updatedAt <= now + 60000 &&
      (e.pending === null || (typeof e.pending === 'string' && e.pending.trim() && e.pending.length <= 600)) &&
      history(e.historico) !== null;
  }
  function readAll() {
    if (!persisted || !storage) return copy(memory);
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return [];
      if (raw.length > MAX_CACHE) { storage.removeItem(KEY); return []; }
      var data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 3) {
        storage.removeItem(KEY); return [];
      }
      return data.entries;
    } catch (_) {
      // JSON inválido é descartado; storage indisponível usa somente memória.
      try { storage.removeItem(KEY); memory = []; } catch (_) { persisted = false; }
      return copy(memory);
    }
  }
  function write(entry) {
    var now = Date.now();
    var entries = readAll().filter(function (e) {
      return valid(e,now) && !expired(e,now) && e.key !== entry.key;
    }).sort(function (a,b) { return b.updatedAt - a.updatedAt; }).slice(0,2);
    entries.unshift(copy(entry));
    var raw = JSON.stringify({version:1,entries:entries});
    while (raw.length > MAX_CACHE && entries.length > 1) {
      entries.pop(); raw = JSON.stringify({version:1,entries:entries});
    }
    memory = entries;
    if (persisted && storage) {
      try {
        if (raw.length > MAX_CACHE) throw new Error('cache limit');
        storage.setItem(KEY,raw);
      } catch (_) {
        persisted = false;
        // Se a quota acabou, não deixar um snapshot antigo reaparecer depois.
        try { storage.removeItem(KEY); } catch (_) {}
      }
    }
  }
  C.chatSessions = {
    key: KEY,
    open: function (userId, memberId) {
      if (![userId,memberId].every(function (id) { return typeof id === 'string' && id.length > 0 && id.length <= 100; })) {
        throw new Error('Identidade da conversa indisponível.');
      }
      var key = JSON.stringify([userId,memberId]), current, reason = '';
      function fresh() {
        var now = Date.now();
        return {key:key,id:window.crypto.randomUUID(),rev:0,createdAt:now,updatedAt:now,historico:[],pending:null};
      }
      function latest() { return readAll().find(function (e) { return e.key === key; }); }
      function same(ticket) {
        var e = latest(), now = Date.now();
        return e && valid(e,now) && !expired(e,now) && e.id === ticket.id && e.rev === ticket.rev;
      }
      function state() {
        return {historico:copy(current.historico),pending:current.pending,reason:reason,persisted:persisted,
          createdAt:current.createdAt,updatedAt:current.updatedAt};
      }
      function restore() {
        var entries = readAll(), e = entries.find(function (item) { return item.key === key; }), now = Date.now();
        var reusable = e && valid(e,now) && !expired(e,now);
        reason = e && valid(e,now) && expired(e,now) ? 'expired' : e && !valid(e,now) ? 'invalid' : '';
        current = reusable ? copy(e) : fresh();
        current.historico = history(current.historico);
        // Leitura normal não emite storage events nem renova o prazo.
        if (!reusable || entries.some(function (item) { return !valid(item,now) || expired(item,now); })) write(current);
        return state();
      }
      restore();
      return {
        state:state, restore:restore,
        isCurrent:function () { return !!same(current); },
        begin:function (question) {
          if (typeof question !== 'string' || !question.trim() || question.length > 600 || !same(current)) return null;
          current.pending = question; current.updatedAt = Date.now(); current.rev++;
          reason = ''; write(current);
          return {id:current.id,rev:current.rev};
        },
        complete:function (ticket,messages) {
          var clean = history(messages);
          if (!ticket || !clean || !clean.length || !same(ticket)) return false;
          current.historico = clean; current.pending = null; current.rev++; current.updatedAt = Date.now();
          write(current); return true;
        },
        accepts:function (ticket) { return !!ticket && same(ticket); },
        reset:function () { current = fresh(); reason = 'reset'; write(current); return state(); }
      };
    }
  };
})();
