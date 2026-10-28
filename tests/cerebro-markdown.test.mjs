import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/assets/membros.js',import.meta.url),'utf8');
const context={Club:{},URL};
context.esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
context.window=context;
const renderer=new URL('../public/assets/club-chat-markdown.js',import.meta.url);
if(existsSync(renderer))vm.runInNewContext(readFileSync(renderer,'utf8'),context);
vm.runInNewContext(source.slice(source.indexOf('  function formatar('),source.indexOf('  function bolha(')),context);
const render=text=>context.formatar(text);

test('URLs soltas viram links sem absorver pontuação ao redor',()=>{
  const html=render('Confira (https://example.com/material_(v2)?a=1&b=2). Depois: https://example.com/fim, e https://example.com/outro!');
  assert.match(html, /\(<a href="https:\/\/example.com\/material_\(v2\)\?a=1&amp;b=2"[^>]*>[^<]+<\/a>\)\./);
  assert.match(html, /href="https:\/\/example.com\/fim"/);
  assert.match(html, /href="https:\/\/example.com\/outro"/);
  assert.equal((html.match(/<a\b/g)||[]).length,3);
});

test('autolinks preservam código e links existentes e escapam conteúdo externo',()=>{
  const html=render('[https://example.com/a](https://example.com/b) `https://example.com/code`\n```\nhttps://example.com/block\n```\n<https://example.com/fonte> https://example.com/\"onclick=alert(1) javascript:alert(1)');
  assert.equal((html.match(/<a\b/g)||[]).length,3);
  assert.match(html, /<code>https:\/\/example.com\/code<\/code>/);
  assert.match(html, /&lt;<a href="https:\/\/example.com\/fonte"/);
  assert.doesNotMatch(html, /href="javascript:|href="[^"]*"onclick=|<a[^>]*<a/);
});
test('fontes em Markdown são links reais com atributos seguros',()=>{
  const html=render('[Fonte](https://example.com/call?q=1&x=2)');
  assert.match(html,/<a\b[^>]*href="https:\/\/example.com\/call\?q=1&amp;x=2"/);
  assert.match(html,/rel="noopener noreferrer"/);
});
test('tabelas de indicadores viram cabeçalho e células navegáveis',()=>{
  const html=render('| Etapa | Total |\n|---|---:|\n| Leads | **100** |\n| Agendadas | 20 |');
  assert.match(html,/<table>/);assert.match(html,/<th[^>]*>Etapa<\/th>/);
  assert.match(html,/<td[^>]*><strong>100<\/strong><\/td>/);
});
test('texto externo não injeta HTML ou URLs executáveis',()=>{
  const html=render('<img src=x onerror=alert(1)>\n[x](javascript:alert(1))\n[x](data:text/html,test)\n[x](https://example.com/" onmouseover="evil)');
  assert.doesNotMatch(html,/<img\b|href="(?:javascript|data):|" onmouseover=/);
  assert.match(html,/&lt;img/);
});
test('código literal não vira link nem negrito',()=>{
  const html=render('`[fonte](https://example.com)` e `**literal**`');
  assert.doesNotMatch(html,/<a\b|<strong>/);assert.match(html,/<code>\*\*literal\*\*<\/code>/);
});

test('links com parênteses e tabelas com pipes literais continuam íntegros',()=>{
  const html=render('[Fonte](https://example.com/call_(1))\n\n| Campo | Valor |\n|---|---|\n| a\\|b | `x|y` |');
  assert.match(html,/href="https:\/\/example.com\/call_\(1\)"/);
  assert.match(html,/<td>a\|b<\/td><td><code>x\|y<\/code><\/td>/);
});

test('link interno funciona, sem aceitar host implícito ou barras invertidas',()=>{
  assert.match(render('[Painel](/membros/#farol)'),/href="\/membros\/#farol"/);
  assert.doesNotMatch(render('[x](//example.com) [y](/\\example.com)'),/<a\b/);
});
