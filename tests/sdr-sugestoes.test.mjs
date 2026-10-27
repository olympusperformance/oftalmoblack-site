import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/assets/sdr-sugestoes.js', import.meta.url), 'utf8');
const {sugestoes, usarSugestao, irParaCampo} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('padrão é inserido apenas por escolha e não substitui resposta existente', () => {
  assert.equal(usarSugestao('tom', ''), sugestoes.tom);
  assert.equal(usarSugestao('tom', 'Texto da clínica'), 'Texto da clínica');
  assert.equal(usarSugestao('campo_desconhecido', ''), '');
});

test('navegação interna não substitui o fragmento que mantém o link individual', () => {
  let prevented = false, scrolled = false;
  irParaCampo({preventDefault(){prevented = true}}, {scrollIntoView(){scrolled = true}});
  assert.equal(prevented, true);
  assert.equal(scrolled, true);
});

test('padrões são revisáveis e não atribuem ao médico credenciais ou serviços de outra clínica', () => {
  for (const field of ['tom', 'posse_conversa', 'perguntas_frequentes', 'limites_humano']) {
    assert.ok(sugestoes[field]);
    assert.ok(!sugestoes[field].includes('Dr. Alex'));
  }
  assert.equal(sugestoes.informacoes_aprovadas, undefined);
});

test('acompanhamento e cenários têm padrão sem inventar a operação da clínica', () => {
  assert.match(usarSugestao('followup_regras', ''), /2 horas/i);
  assert.match(usarSugestao('cenarios', ''), /convênio/i);
  assert.equal(usarSugestao('cenarios', 'Cenários próprios'), 'Cenários próprios');
  for (const personalizado of ['followup_atual', 'origens', 'testadores', 'observacoes']) {
    assert.equal(sugestoes[personalizado], undefined);
  }
});
