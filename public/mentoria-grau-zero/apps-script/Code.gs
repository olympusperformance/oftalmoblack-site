/**
 * Aplicações · Mentoria Grau Zero — receptor do formulário da LP
 * https://oftalmoblack.com.br/mentoria-grau-zero/  (FORM_ENDPOINT no index.html)
 *
 * Onde vive: projeto Apps Script STANDALONE "Aplicações · Mentoria Grau Zero" na conta
 * olympusperformanceltda@gmail.com (script.google.com → Meus projetos). Publicado como App da Web:
 * executar como EU (dono), acesso QUALQUER PESSOA. Mudou o código? Implantar → Gerenciar implantações
 * → editar → Nova versão (a URL /exec não muda).
 *
 * Planilha: criada pelo próprio script no primeiro GET /exec?setup=1 (SpreadsheetApp.create no Meu Drive
 * da conta Olympus) e o ID fica gravado em PropertiesService (chave PLANILHA_ID). Pra apontar pra outra
 * planilha, trocar o valor da propriedade ou preencher PLANILHA_ID_FIXO abaixo.
 *
 * A LP manda JSON como text/plain (sem preflight CORS; Apps Script não responde OPTIONS).
 * Payload esperado: nome, whatsapp, email, crm, cidade, momento, observacao, origem, ts,
 * utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, page, referrer.
 */
var NOME_PLANILHA = 'Aplicações · Mentoria Grau Zero';
var PLANILHA_ID_FIXO = ''; // opcional: força um ID (senão usa a propriedade PLANILHA_ID)
var ABA = 'Aplicações';
var CABECALHO = [
  'DATA', 'NOME', 'WHATSAPP', 'E-MAIL', 'CRM/UF', 'CIDADE', 'MOMENTO', 'OBJETIVO',
  'STATUS DO CONTATO', 'OBSERVAÇÕES',
  'ORIGEM', 'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_CONTENT', 'UTM_TERM', 'FBCLID', 'GCLID', 'PÁGINA', 'REFERRER', 'TS_ISO'
];

function planilhaId_() {
  if (PLANILHA_ID_FIXO) return PLANILHA_ID_FIXO;
  return PropertiesService.getScriptProperties().getProperty('PLANILHA_ID') || '';
}

function criarPlanilha_() {
  var ss = SpreadsheetApp.create(NOME_PLANILHA);
  var sh = ss.getSheets()[0];
  sh.setName(ABA);
  sh.appendRow(CABECALHO);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold').setBackground('#111111').setFontColor('#f5f0e6');
  sh.setColumnWidths(1, 8, 170);
  sh.setColumnWidths(9, 2, 160);
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', ss.getId());
  return ss;
}

function abaAplicacoes_() {
  var id = planilhaId_();
  var ss = id ? SpreadsheetApp.openById(id) : criarPlanilha_();
  var sh = ss.getSheetByName(ABA) || ss.getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(CABECALHO);
  return sh;
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(raw);
    var sh = abaAplicacoes_();
    var agora = new Date();
    sh.appendRow([
      Utilities.formatDate(agora, 'America/Manaus', 'dd/MM/yyyy HH:mm'),
      d.nome || '', d.whatsapp || '', d.email || '', d.crm || '', d.cidade || '', d.momento || '', d.observacao || '',
      'novo', '',
      d.origem || 'lp-mentoria-grau-zero',
      d.utm_source || '', d.utm_medium || '', d.utm_campaign || '', d.utm_content || '', d.utm_term || '',
      d.fbclid || '', d.gclid || '', d.page || '', d.referrer || '',
      d.ts || agora.toISOString()
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.setup === '1') {
    var ss = planilhaId_() ? SpreadsheetApp.openById(planilhaId_()) : criarPlanilha_();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, planilha: ss.getUrl(), id: ss.getId() })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('ok · aplicacoes mentoria grau zero').setMimeType(ContentService.MimeType.TEXT);
}
