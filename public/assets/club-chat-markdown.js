/* Subconjunto de Markdown para respostas do chat. HTML externo sempre vira
   texto; somente tags e atributos produzidos aqui entram na página. */
(function (C) {
  'use strict';
  function esc(value) {
    return String(value).replace(/[&<>"']/g,function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function link(url,label) {
    try {
      if (/[\s\x00-\x1f\x7f\\]/.test(url) || !(/^\/(?!\/)/.test(url) ||
          /^https?:\/\//i.test(url) && ['https:','http:'].indexOf(new URL(url).protocol) !== -1)) return null;
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    } catch (_) { return null; }
  }
  function bareUrl(tail) {
    var match = tail.match(/^https?:\/\/[^\s<>"'`\\\x00-\x1f\x7f]+/i);
    if (!match) return '';
    var url = match[0], pairs = {')':'(',']':'[','}':'{'};
    while (url) {
      var last = url.slice(-1), open = pairs[last];
      if (/[.,;:!?]/.test(last) || open && url.split(last).length > url.split(open).length) url = url.slice(0,-1);
      else break;
    }
    return url;
  }
  function inline(text,depth) {
    if (depth > 4) return esc(text);
    var out = '', i = 0;
    while (i < text.length) {
      var tail = text.slice(i), m;
      if ((m = tail.match(/^`([^`]+)`/))) {
        out += '<code>' + esc(m[1]) + '</code>'; i += m[0].length; continue;
      }
      // Destinos podem conter parênteses balanceados, comuns em links de fontes.
      var label = tail.match(/^\[([^\]\n]+)\]\(/);
      if (label) {
        var end = i + label[0].length, start = end, balance = 1;
        for (; end < text.length && balance; end++) {
          if (text[end] === '(') balance++;
          if (text[end] === ')') balance--;
        }
        if (!balance) {
          var url = text.slice(start,end-1);
          out += link(url,label[1]) || esc(text.slice(i,end));
          i = end; continue;
        }
      }
      if ((m = tail.match(/^\*\*([^\n]+?)\*\*/))) {
        out += '<strong>' + inline(m[1],depth+1) + '</strong>'; i += m[0].length; continue;
      }
      if ((m = tail.match(/^\*([^*\n]+?)\*/))) {
        out += '<em>' + inline(m[1],depth+1) + '</em>'; i += m[0].length; continue;
      }
      if (i === 0 || !/[a-z0-9_@/]/i.test(text[i-1])) {
        var bare = bareUrl(tail), anchor = bare && link(bare,bare);
        if (anchor) { out += anchor; i += bare.length; continue; }
      }
      out += esc(text[i++]);
    }
    return out;
  }
  function cells(line) {
    var s = line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,''), row = [], cell = '', code = false;
    for (var i=0;i<s.length;i++) {
      if (s[i] === '\\' && s[i+1] === '|') { cell += '|'; i++; continue; }
      if (s[i] === '`') code = !code;
      if (s[i] === '|' && !code) { row.push(cell.trim()); cell = ''; } else cell += s[i];
    }
    row.push(cell.trim()); return row;
  }
  C.chatMarkdown = function (text) {
    var lines = String(text || '').replace(/\r\n?/g,'\n').split('\n'), out = '', list = '';
    function closeList() { if (list) { out += '</' + list + '>'; list = ''; } }
    for (var i=0;i<lines.length;i++) {
      var line = lines[i].trim(), next = lines[i+1], header, divider, item, title;
      if (/^```/.test(line)) {
        closeList(); var code = [];
        while (++i<lines.length && !/^```\s*$/.test(lines[i].trim())) code.push(lines[i]);
        out += '<pre><code>' + esc(code.join('\n')) + '</code></pre>'; continue;
      }
      if (line.includes('|') && next && (header=cells(line)).length > 1 &&
          (divider=cells(next)).length === header.length && divider.every(function (s) { return /^:?-{3,}:?$/.test(s); })) {
        closeList();
        out += '<div class="chat-table" role="region" aria-label="Tabela da resposta" tabindex="0"><table><thead><tr>' + header.map(function (s) { return '<th scope="col">' + inline(s,0) + '</th>'; }).join('') + '</tr></thead><tbody>';
        i++;
        while (i+1<lines.length && lines[i+1].includes('|')) {
          var row = cells(lines[i+1]); if (row.length !== header.length) break;
          out += '<tr>' + row.map(function (s) { return '<td>' + inline(s,0) + '</td>'; }).join('') + '</tr>'; i++;
        }
        out += '</tbody></table></div>'; continue;
      }
      item = line.match(/^([-–•]|\d+[.)])\s+(.*)$/);
      if (item) {
        var kind = /^\d/.test(item[1]) ? 'ol' : 'ul';
        if (list !== kind) { closeList(); list = kind; out += '<' + list + '>'; }
        out += '<li>' + inline(item[2],0) + '</li>'; continue;
      }
      closeList();
      title = line.match(/^#{1,6}\s+(.*)$/);
      if (title) out += '<h4>' + inline(title[1],0) + '</h4>';
      else if (line) out += '<p>' + inline(line,0) + '</p>';
    }
    closeList(); return out;
  };
})(window.Club = window.Club || {});
