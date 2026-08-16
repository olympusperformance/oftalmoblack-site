/**
 * Aplicações · Mentoria Olympus Catarata — receptor do formulário da LP
 * https://oftalmoblack.com.br/mentoria-olympus-catarata/  (FORM_ENDPOINT no index.html)
 *
 * Como publicar (1x, na planilha "Aplicações · Mentoria Olympus Catarata", Drive da conta Olympus):
 *   Extensões → Apps Script → colar este arquivo → Implantar → Nova implantação → tipo "App da Web"
 *   → Executar como: EU (dono da planilha) · Quem pode acessar: QUALQUER PESSOA → Implantar → copiar a URL /exec
 *   → colar em FORM_ENDPOINT no index.html da LP → commit + deploy no EasyPanel.
 * A aba precisa se chamar "Aplicações" (ou ajustar ABA abaixo). Cabeçalho na linha 1 (criado sozinho se a aba estiver vazia).
 * A LP manda JSON como text/plain (sem preflight CORS; Apps Script não responde OPTIONS).
 */
var ABA = 'Aplicações';
var CABECALHO = ['DATA', 'NOME', 'WHATSAPP', 'E-MAIL', 'CRM/UF', 'CIDADE', 'MOMENTO NA CIRURGIA', 'OBJETIVO', 'STATUS DO CONTATO', 'TURMA', 'OBSERVAÇÕES', 'ORIGEM', 'TS_ISO'];

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
    if (sh.getLastRow() === 0) sh.appendRow(CABECALHO);
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
