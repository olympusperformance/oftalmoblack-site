// Gera a prévia da graduação a partir da planilha "SISTEMA DE GRADUAÇÃO BLACK".
//
//   npm --prefix scripts/graduacao install
//   node scripts/graduacao/gerar.mjs "caminho/da/planilha.xlsx" AAAA-MM-DD
//
// A data é a da última apuração da planilha. O script reescreve a fixture dos
// testes, o SQL de carga e o texto "Dados da planilha de …" da área de membros.
// Não toca no banco: aplique o SQL depois de conferir o resumo.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const [arquivo, DATA] = process.argv.slice(2);
if (!arquivo || !/^\d{4}-\d{2}-\d{2}$/.test(DATA || '')) {
  console.error('uso: node scripts/graduacao/gerar.mjs <planilha.xlsx> <AAAA-MM-DD>');
  process.exit(1);
}
const raiz = fileURLToPath(new URL('../../', import.meta.url));
const wb = XLSX.read(readFileSync(arquivo));
const S = {};
for (const aba of wb.SheetNames) S[aba] = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null, raw: true });

const NOME_NO_BANCO = {
  'Cintia de Oliveira Santini': 'Cintia Santini',
  'Luciana Maria Tavares da Hora': 'Luciana da Hora',
  'Nauara Naissa Duarte Silva': 'Nauara Naissa',
  'Gustavo Ramos Ribeiro': 'Gustavo Ribeiro',
};
const PERIODOS = [
  { id: '2026-T2', label: 'Abr–jun 2026', state: 'closed' },
  { id: '2026-T3', label: 'Jul–set 2026', state: 'current' },
  { id: '2026-T4', label: 'Out–dez 2026', state: 'future' },
  { id: '2027-T1', label: 'Jan–mar 2027', state: 'future' },
];
const num = v => (v === null || v === undefined || String(v).trim() === '' || v === '—' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const txt = v => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
// Indexa uma aba pelo nome do mentorado na primeira coluna.
const porNome = aba => {
  const mapa = new Map();
  for (const linha of S[aba]) {
    const nome = txt(linha && linha[0]);
    if (nome && NOMES.has(nome) && !mapa.has(nome)) mapa.set(nome, linha);
  }
  return mapa;
};

// A ordem oficial é a do Painel; ela define quem entra e em que sequência.
const painelLinhas = S['Painel'].filter(l => txt(l && l[0]) && num(l[14]) !== null);
const NOMES = new Set(painelLinhas.map(l => txt(l[0])));
const painel = porNome('Painel'), part = porNome('Participacao'), pres = porNome('Presenca');
const seg = porNome('Seguidores'), vid = porNome('Videos'), ind = porNome('Indicacao');
const bon = porNome('Bonus'), vit = porNome('Vitrine'), hist = porNome('Historico Graus');

const registros = painelLinhas.map(linhaPainel => {
  const nome = txt(linhaPainel[0]);
  const p = part.get(nome) || [], pr = pres.get(nome) || [], sg = seg.get(nome) || [];
  const vd = vid.get(nome) || [], ic = ind.get(nome) || [], bn = bon.get(nome) || [];
  const vt = vit.get(nome) || [], hs = hist.get(nome) || [];
  const periodos = PERIODOS.map((meta, i) => {
    const base = { id: meta.id, label: meta.label, state: meta.state };
    const pontos = num(linhaPainel[6 + i]);
    const bonus = num(bn[1 + i]) || 0;
    const comum = {
      points: meta.state === 'future' ? null : (pontos === null ? 0 : pontos),
      scores: meta.state === 'future'
        ? { attendance: null, followers: null, videos: null }
        : { attendance: num(p[2 + i * 4]), followers: num(p[3 + i * 4]), videos: num(p[4 + i * 4]) },
      referrals: meta.state === 'future' ? null : num(ic[1 + i * 2]),
      bonus, bonusReason: bonus ? txt(bn[6]) : null,
    };
    if (meta.state === 'future') return { ...base, ...comum };
    const colPres = i === 0 ? 21 : 24, colSeg = i === 0 ? 10 : 14, colVid = i === 0 ? 26 : 30;
    return {
      ...base, ...comum,
      attendance: { attended: num(pr[colPres]), eligible: num(pr[colPres + 1]) },
      followers: { growth: num(sg[colSeg]) },
      videos: { count: num(vd[colVid]), weeks: num(vd[colVid + 1]), credits: num(vd[colVid + 2]) },
    };
  });
  return {
    memberName: NOME_NO_BANCO[nome] || nome,
    snapshot: {
      sourceName: nome,
      sourceDate: DATA,
      currentPeriod: '2026-T3',
      entry: txt(vd[2]) || txt(sg[2]),
      grade: num(linhaPainel[11]) || 0,
      initialGrade: num(linhaPainel[2]) || 0,
      recordedDegrees: num(hs[11]) || 0,
      annualPoints: num(linhaPainel[5]) || 0,
      renewalDiscount: num(linhaPainel[13]) || 0,
      renewalPrice: num(linhaPainel[14]) || 0,
      vouchers: num(vt[4]) || 0,
      periods: periodos,
    },
  };
});

// A pontuação de cada trimestre tem que fechar com participação, indicação e bônus.
const divergencias = [];
for (const { memberName, snapshot } of registros) for (const p of snapshot.periods) {
  if (p.state === 'future') continue;
  const soma = Object.values(p.scores).reduce((s, v) => s + (v || 0), 0) + (p.referrals || 0) * 50 + (p.bonus || 0);
  if (Math.abs(p.points - soma) >= 0.11) divergencias.push(`${memberName} ${p.id}: painel ${p.points}, soma ${soma.toFixed(1)}`);
}
if (divergencias.length) { console.error('Pontuação não reconcilia:\n  ' + divergencias.join('\n  ')); process.exit(1); }

const [dia, mes, ano] = [DATA.slice(8), DATA.slice(5, 7), DATA.slice(0, 4)];
const aspas = s => s.replace(/'/g, "''");
writeFileSync(raiz + 'tests/fixtures/graduacao-planilha.json', JSON.stringify(registros, null, 2) + '\n');
writeFileSync(raiz + 'supabase/graduacao-preview-dados.sql',
`-- Prévia solicitada: valores congelados da planilha de ${dia}/${mes}/${ano}. Não consulta a Meta.
begin;
create temporary table graduation_import (nome text primary key, snapshot jsonb) on commit drop;
insert into graduation_import values
${registros.map(r => `  ('${aspas(r.memberName)}', '${aspas(JSON.stringify(r.snapshot))}'::jsonb)`).join(',\n')};
do $$ begin
 if exists(select 1 from graduation_import i where not exists(select 1 from public.members m where m.nome=i.nome)) then
  raise exception 'Há mentorado da planilha sem correspondência no cadastro';
 end if;
end $$;
insert into public.member_graduations(member_id,source_date,is_demo,snapshot)
select m.id,'${DATA}'::date,true,i.snapshot from graduation_import i join public.members m on m.nome=i.nome
on conflict(member_id) do update set snapshot=excluded.snapshot,source_date=excluded.source_date,updated_at=now()
where member_graduations.is_demo;
commit;
`);
const js = raiz + 'public/assets/club-graduacao.js';
writeFileSync(js, readFileSync(js, 'utf8').replace(/Dados da planilha de \d{2}\/\d{2}\/\d{4}/, `Dados da planilha de ${dia}/${mes}/${ano}`));

const atual = registros.map(r => ({ nome: r.memberName, pontos: r.snapshot.periods[1].points }));
console.log(`${registros.length} mentorados · pontuação reconcilia em todos os trimestres`);
console.log('graduam no T3:', atual.filter(r => r.pontos >= 50).map(r => r.nome).join(', ') || 'ninguém');
console.log('reta final (35–49,9):', atual.filter(r => r.pontos >= 35 && r.pontos < 50).length);
console.log('Confira com a aba Graduação e aplique: supabase db query --linked -f supabase/graduacao-preview-dados.sql');
