/**
 * Hands-on Grau Zero: receptor preparado, ainda não implantado.
 * Definir PLANILHA_ID nas propriedades do projeto Apps Script da Olympus.
 * Usa uma aba exclusiva e não modifica o esquema do formulário legado.
 */
var HOGZ_SHEET = 'Candidaturas Hands-on Grau Zero';
var HOGZ_FIELDS = [
  'schema_version', 'produto', 'nome', 'whatsapp', 'crm', 'uf',
  'experiencia_catarata', 'cirurgias_mes', 'experiencia_lentes', 'oferta_premium',
  'clinica', 'objetivo', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
  'utm_term', 'aid', 'fbclid', 'gclid', 'page', 'referrer'
];
var HOGZ_HEADER = ['request_id', 'payload_hash', 'received_at_iso'].concat(HOGZ_FIELDS);
var HOGZ_UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function string_(value, maximum, required) {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return '';
    throw new Error('invalid_input');
  }
  if (value.length > maximum) throw new Error('invalid_input');
  var text = value.trim();
  if (required && !text) throw new Error('invalid_input');
  return text;
}
function oneOf_(value, options) {
  if (options.indexOf(value) < 0) throw new Error('invalid_input');
  return value;
}
function url_(value) {
  var text = string_(value, 2048, false);
  if (text && !/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(text)) throw new Error('invalid_input');
  return text;
}
function normalize_(d) {
  if (!d || Array.isArray(d) || typeof d !== 'object' || d.schema_version !== 1 || d.produto !== 'hands_on_grau_zero') throw new Error('invalid_input');
  var n = {schema_version:1, produto:'hands_on_grau_zero'};
  n.request_id = string_(d.request_id, 36, true);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(n.request_id)) throw new Error('invalid_input');
  n.nome = string_(d.nome, 140, true);
  if (n.nome.length < 2) throw new Error('invalid_input');
  var phone = string_(d.whatsapp, 40, true);
  if (!/^\+?[\d\s().-]+$/.test(phone)) throw new Error('invalid_input');
  n.whatsapp = phone.replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(n.whatsapp)) throw new Error('invalid_input');
  n.crm = string_(d.crm, 10, true);
  if (!/^\d{1,10}$/.test(n.crm)) throw new Error('invalid_input');
  n.uf = oneOf_(d.uf, HOGZ_UFS);
  n.experiencia_catarata = oneOf_(d.experiencia_catarata, ['ainda_nao_opero', 'iniciando_supervisao', 'opero_autonomia']);
  if (typeof d.cirurgias_mes !== 'number' && !(typeof d.cirurgias_mes === 'string' && /^\d+$/.test(d.cirurgias_mes))) throw new Error('invalid_input');
  n.cirurgias_mes = Number(d.cirurgias_mes);
  if (!Number.isInteger(n.cirurgias_mes) || n.cirurgias_mes < 0 || n.cirurgias_mes > 10000) throw new Error('invalid_input');
  n.experiencia_lentes = oneOf_(d.experiencia_lentes, ['ainda_nao_implanto', 'poucos_casos', 'regularmente']);
  n.oferta_premium = oneOf_(d.oferta_premium, ['nao', 'alguns_casos', 'rotina']);
  n.clinica = oneOf_(d.clinica, ['proprietario', 'socio', 'nao']);
  n.objetivo = string_(d.objetivo, 2000, false);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid','fbclid','gclid'].forEach(function(key) { n[key] = string_(d[key], 500, false); });
  n.page = url_(d.page);
  n.referrer = url_(d.referrer);
  return n;
}
function literal_(value) {
  if (typeof value !== 'string') return value;
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? "'" + value : value;
}
function payloadHash_(n) {
  var ordered = HOGZ_FIELDS.map(function(key) { return n[key]; });
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(ordered), Utilities.Charset.UTF_8));
}
function doPost(e) {
  var n;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 25000) throw new Error('invalid_input');
    n = normalize_(JSON.parse(raw));
  } catch (invalid) {
    return json_({ok:false, error:'invalid_input'});
  }
  var lock, acquired = false;
  try {
    var sheetId = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
    if (!sheetId) return json_({ok:false, error:'unavailable'});
    lock = LockService.getScriptLock();
    acquired = lock.tryLock(10000);
    if (!acquired) return json_({ok:false, error:'unavailable'});
    var ss = SpreadsheetApp.openById(sheetId);
    var sh = ss.getSheetByName(HOGZ_SHEET);
    if (!sh) sh = ss.insertSheet(HOGZ_SHEET);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HOGZ_HEADER);
      sh.setFrozenRows(1);
    }
    // Falhar com segurança se uma aba de mesmo nome tiver outro esquema.
    var header = sh.getRange(1, 1, 1, HOGZ_HEADER.length).getValues()[0];
    if (JSON.stringify(header) !== JSON.stringify(HOGZ_HEADER)) return json_({ok:false, error:'unavailable'});
    var hash = payloadHash_(n);
    var count = sh.getLastRow() - 1;
    if (count > 0) {
      var receipts = sh.getRange(2, 1, count, 2).getValues();
      for (var i=0; i<receipts.length; i++) {
        if (String(receipts[i][0]) === n.request_id) {
          if (String(receipts[i][1]) !== hash) return json_({ok:false, error:'request_conflict'});
          SpreadsheetApp.flush();
          return json_({ok:true, request_id:n.request_id, duplicate:true});
        }
      }
    }
    var values = HOGZ_FIELDS.map(function(key) { return literal_(n[key]); });
    sh.appendRow([n.request_id, hash, new Date().toISOString()].concat(values));
    SpreadsheetApp.flush();
    return json_({ok:true, request_id:n.request_id});
  } catch (unavailable) {
    return json_({ok:false, error:'unavailable'});
  } finally {
    if (acquired && lock) lock.releaseLock();
  }
}
function doGet() {
  var configured = !!PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  return json_({ok:true, produto:'hands_on_grau_zero', schema_version:1, configured:configured});
}
