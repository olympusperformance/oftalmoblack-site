import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const MEMBER_A = '11111111-1111-4111-8111-111111111111';
const MEMBER_B = '22222222-2222-4222-8222-222222222222';
const script = readFileSync(new URL('../public/assets/club-farol.js', import.meta.url), 'utf8');
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function settle() { return new Promise(resolve => setImmediate(resolve)); }

function setup(hash = '', memberMode = false) {
  const clinical = [], graduation = [];
  const listeners = {};
  const location = { hash, pathname:memberMode ? '/membros/' : '/admin/', search:'' };
  const root = {
    html:'', addEventListener(name, callback) { listeners[name] = callback; },
    set innerHTML(value) { this.html = value; }, get innerHTML() { return this.html; },
    insertAdjacentHTML(_where, value) { this.html += value; },
    querySelector() { return { focus() {} }; }, querySelectorAll() { return []; },
  };
  const store = new Map();
  const Club = {
    esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    icon: () => '', DEM_ABERTOS:['open'], NO_AR:{ ativo:true }, diffDays:() => -1,
    rotuloPar:p => p.estado, tipoEtapa:() => 'trava',
    graduacao:{ model(snapshot) { const period = snapshot.periods[0]; return { period, points:period.points, grade:snapshot.grade, missing:50-period.points, percent:period.points*2 }; }, beltName:() => 'Faixa preta' },
    sb:{ functions:{ invoke(_name, params) { const pending = deferred(); clinical.push({ pending, params }); return pending.promise; } },
      from(table) { return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; },
        order() { return Promise.resolve({ data:[] }); },
        maybeSingle() { const pending = deferred(); graduation.push(pending); return pending.promise; },
      }; } },
  };
  const document = { activeElement:{ getAttribute:() => null }, contains:() => false };
  const context = { window:{ Club }, Club, localStorage:{ getItem:key => store.get(key), setItem:(key,value) => store.set(key,value) },
    location, history:{ replaceState(_a,_b,url) { location.hash = String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : ''; } },
    document, Intl, URLSearchParams, Date, Number, Math, Promise };
  vm.runInNewContext(script, context);
  Club.farol.mount(root, {
    memberMode,
    members:() => memberMode ? [{ id:MEMBER_A, nome:'Dra. Alice', ativo:true }] : [{ id:MEMBER_A, nome:'Dra. Alice', ativo:true }, { id:MEMBER_B, nome:'Dr. Bruno', ativo:true }],
    session:() => ({ userId:memberMode ? 'member' : 'admin' }), instagram:() => ({ resumo:[], serie:[] }),
    entregas:() => ({ pcts:[], pct:0, aceitos:0, definir:0, travados:0, equipe:0, noar:0 }),
    artefatos:() => [], demandas:() => [], abrirInstagram:() => {}, abrirProgressao:() => {}, abrirDemandas:() => {},
  });
  return { Club, root, location, listeners, clinical, graduation };
}
function clinicalResponse(memberId, count) {
  const stages = { novos:count, agendadas:0, realizadas:0, indicacoes:0, cirurgias:0, perdidos:0 };
  return { data:{ status:'ready', member_id:memberId, clinic:{ name:'Clínica teste' },
    period:{ date_start:'2026-09-01', date_end:'2026-09-22' },
    funnel:{ status:'ready', data:{ periodo:stages, anterior:stages, trilha_desde:null, dados_desde:null } },
    commercial:{ status:'ready', data:{ total:0, count:0, missing_price_count:0, groups:[] } },
    finance:{ status:'ready', billed:{ current:{ amount:0, record_count:0, groups:[] } }, received:{ current:{ amount:0, record_count:0, groups:[] } } } } };
}
function snapshot(attended) {
  return { data:{ source_date:'2026-09-10', is_demo:true, snapshot:{ currentPeriod:'2026-T3', grade:1,
    periods:[{ id:'2026-T3', label:'Jul–set 2026', points:25, attendance:{ attended, eligible:5 }, scores:{ attendance:10 } }] } } };
}

test('resposta tardia do médico A não pinta B nem perde a seleção', async () => {
  const t = setup(); t.Club.farol.enter('#farol/' + MEMBER_A + '?dias=30');
  assert.equal(t.clinical.length, 1);
  t.listeners.change({ target:{ matches:selector => selector === '[data-farol-member]', value:MEMBER_B } });
  assert.equal(t.clinical.length, 2);
  t.clinical[1].pending.resolve(clinicalResponse(MEMBER_B, 77));
  t.graduation[1].resolve(snapshot(3)); await settle();
  t.clinical[0].pending.resolve(clinicalResponse(MEMBER_A, 99));
  t.graduation[0].resolve(snapshot(1)); await settle();
  assert.match(t.root.html, /Dr\. Bruno/); assert.match(t.root.html, />77</);
  assert.doesNotMatch(t.root.html, />99</);
  assert.equal(t.location.hash, '#farol/' + MEMBER_B + '?dias=30');
});

test('presença ausente continua sem apuração e detalhe reaparece por URL', async () => {
  const url = '#farol/' + MEMBER_A + '?dias=7&detalhe=presence';
  const t = setup(url); t.Club.farol.enter(url);
  t.clinical[0].pending.resolve(clinicalResponse(MEMBER_A, 4));
  t.graduation[0].resolve(snapshot(null)); await settle();
  assert.match(t.root.html, /Sem apuração/);
  assert.match(t.root.html, /role="dialog"/);
  assert.doesNotMatch(t.root.html, /0% de presença/);
  assert.equal(t.location.hash, url);
});

test('mentorado abre apenas seu Farol mesmo com URL de outro membro', () => {
  const t = setup('#farol/' + MEMBER_B + '?dias=7', true);
  t.Club.farol.enter(t.location.hash);
  assert.equal(t.clinical.length, 1);
  assert.equal(t.clinical[0].params.body.member_id, MEMBER_A);
  assert.doesNotMatch(t.root.html, /data-farol-member|data-farol-prev|data-farol-search/);
  assert.match(t.root.html, /Dra\. Alice/);
  assert.equal(t.location.hash, '#farol/' + MEMBER_A + '?dias=7');
});

test('fonte ausente aparece como travessão e troca de período invalida resposta antiga', async () => {
  const t = setup(); t.Club.farol.enter('#farol/' + MEMBER_A + '?dias=30');
  t.listeners.click({ target:{ hasAttribute: key => key === 'data-farol-days', closest:() => ({ dataset:{ farolDays:'7' }, hasAttribute:() => false }) } });
  assert.equal(t.clinical[1].params.body.days, 7);
  t.clinical[1].pending.resolve({ data:{ status:'unlinked', clinic:null, funnel:{ status:'unlinked', data:null }, commercial:{ status:'unlinked', data:null }, finance:{ status:'unlinked' } } });
  t.graduation[1].resolve({ data:null }); await settle();
  t.clinical[0].pending.resolve(clinicalResponse(MEMBER_A, 99)); await settle();
  assert.match(t.root.html, /Clínica sem vínculo/);
  assert.match(t.root.html, /Instagram sem vínculo/);
  assert.doesNotMatch(t.root.html, />99</);
  assert.equal(t.location.hash, '#farol/' + MEMBER_A + '?dias=7');
});

test('Farol mostra os períodos do CRM e envia 90 dias à consulta', () => {
  const t = setup(); t.Club.farol.enter('#farol/' + MEMBER_A + '?dias=30');
  for (const preset of ['today','yesterday','last7days','thisWeek','lastWeek','thisMonth','lastMonth','monthBeforeLast','last30days','last90days','custom','all']) {
    assert.match(t.root.html, new RegExp('option value="' + preset + '"'));
  }
  t.listeners.change({ target:{ matches:selector => selector === '[data-farol-period]', value:'last90days' } });
  assert.equal(t.clinical[1].params.body.preset, 'last90days');
  assert.equal(t.location.hash, '#farol/' + MEMBER_A + '?periodo=last90days');
});

test('período personalizado preserva datas no link e consulta', () => {
  const url = '#farol/' + MEMBER_A + '?periodo=custom&de=2026-09-01&ate=2026-09-12';
  const t = setup(url); t.Club.farol.enter(url);
  assert.equal(t.clinical[0].params.body.preset, 'custom');
  assert.equal(t.clinical[0].params.body.from, '2026-09-01');
  assert.equal(t.clinical[0].params.body.to, '2026-09-12');
  assert.equal(t.location.hash, url);
  assert.match(t.root.html, /data-farol-from/);
});

test('todo período é consultado sem apresentar comparação artificial', async () => {
  const url = '#farol/' + MEMBER_A + '?periodo=all';
  const t = setup(url); t.Club.farol.enter(url);
  assert.equal(t.clinical[0].params.body.preset, 'all');
  t.clinical[0].pending.resolve(clinicalResponse(MEMBER_A, 12));
  t.graduation[0].resolve(snapshot(3)); await settle();
  assert.match(t.root.html, /Todo período/);
  assert.match(t.root.html, /Sem comparativo/);
  assert.doesNotMatch(t.root.html, /Anterior: 0/);
});
