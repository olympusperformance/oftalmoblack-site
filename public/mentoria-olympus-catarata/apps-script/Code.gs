/**
 * Aplicações · Mentoria Olympus Catarata — receptor do formulário da LP
 * https://oftalmoblack.com.br/mentoria-olympus-catarata/  (FORM_ENDPOINT no index.html)
 *
 * Onde vive: projeto Apps Script STANDALONE "Aplicações · Mentoria Olympus Catarata" na conta
 * olympusperformanceltda@gmail.com (script.google.com → Meus projetos). Escreve na planilha pelo ID
 * (SpreadsheetApp.openById), aba "Aplicações". Publicado como App da Web: executar como EU (dono),
 * acesso QUALQUER PESSOA. Mudou o código? Implantar → Gerenciar implantações → editar → Nova versão.
 * A LP manda JSON como text/plain (sem preflight CORS; Apps Script não responde OPTIONS).
 */
var PLANILHA_ID = '1_hrlrBdhIy9uCcgw-tgByysfKoalWiLC6bkSqF_gPm8';
var ABA = 'Aplicações';
var CABECALHO = ['DATA', 'NOME', 'WHATSAPP', 'E-MAIL', 'CRM/UF', 'CIDADE', 'MOMENTO NA CIRURGIA', 'OBJETIVO', 'STATUS DO CONTATO', 'TURMA', 'OBSERVAÇÕES', 'ORIGEM', 'TS_ISO'];

function abaAplicacoes_() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(ABA) || ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(CABECALHO);
  } else if (!sh.getRange(1, 12).getValue()) {
    sh.getRange(1, 12, 1, 2).setValues([['ORIGEM', 'TS_ISO']]);
  }
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
      'novo', '', '', d.origem || 'lp-mentoria-olympus-catarata', d.ts || agora.toISOString()
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('ok · aplicacoes mentoria olympus catarata').setMimeType(ContentService.MimeType.TEXT);
}
