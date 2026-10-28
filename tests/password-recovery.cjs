/* Fluxo de Auth em navegador, com servidor e Supabase simulados. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../public');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(root, url.pathname, url.pathname.endsWith('/') ? 'index.html' : '');
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
function stub(session, error = null) {
  return `window.Club = {sb: {auth: {
    getSession: async () => ({data: {session: ${JSON.stringify(session)}}}),
    resetPasswordForEmail: async (email, options) => {
      window.sent = {email, options}; return {error: ${JSON.stringify(error)}};
    },
    updateUser: async (body) => {window.updated = body; return {error: null};},
    signOut: async (options) => {window.signedOut = options; return {error: null};}
  }}};`;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless: true,
    ...(process.env.BLACK_BROWSER_EXECUTABLE ? {executablePath: process.env.BLACK_BROWSER_EXECUTABLE} : {})});
  const errors = [];
  try {
    async function pageWith(session, error) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}});
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/assets/club-supabase.js', route => route.fulfill({contentType: 'text/javascript', body: stub(session, error)}));
      return page;
    }
    const email = await pageWith(null);
    await email.goto(origin + '/recuperar-senha/');
    await email.locator('#emailForm').waitFor({state: 'visible'});
    assert.equal(await email.locator('#senhaForm').isVisible(), false);
    await email.locator('#email').fill('test@example.com');
    await email.locator('#enviar').click();
    await email.locator('#mensagem').waitFor({state: 'visible'});
    assert.deepEqual(await email.evaluate(() => window.sent), {email: 'test@example.com', options: {redirectTo: origin + '/recuperar-senha/'}});
    assert.equal(await email.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const recovery = await pageWith({user: {id: 'fixture'}});
    await recovery.goto(origin + '/recuperar-senha/#type=recovery&access_token=fixture');
    await recovery.locator('#senhaForm').waitFor({state: 'visible'});
    assert.equal(new URL(recovery.url()).hash, '');
    await recovery.locator('#senha').fill('new-password-fixture');
    await recovery.locator('#confirmacao').fill('wrong-password');
    await recovery.locator('#salvar').click();
    assert.equal(await recovery.locator('#erro').textContent(), 'As senhas não são iguais.');
    assert.equal(await recovery.evaluate(() => window.updated), undefined);
    await recovery.locator('#confirmacao').fill('new-password-fixture');
    await recovery.locator('#salvar').click();
    await recovery.locator('#mensagem').waitFor({state: 'visible'});
    assert.deepEqual(await recovery.evaluate(() => window.updated), {password: 'new-password-fixture'});
    assert.deepEqual(await recovery.evaluate(() => window.signedOut), {scope: 'local'});

    const loggedIn = await pageWith({user: {id: 'fixture'}});
    await loggedIn.goto(origin + '/recuperar-senha/');
    await loggedIn.locator('#senhaForm').waitFor({state: 'visible'});
    await loggedIn.locator('#senha').fill('new-password-fixture');
    await loggedIn.locator('#confirmacao').fill('new-password-fixture');
    await loggedIn.locator('#salvar').click();
    await loggedIn.locator('#mensagem').waitFor({state: 'visible'});
    assert.deepEqual(await loggedIn.evaluate(() => window.updated), {password: 'new-password-fixture'});
    assert.deepEqual(await loggedIn.evaluate(() => window.signedOut), {scope: 'local'});

    const invalid = await pageWith({user: {id: 'existing-session'}});
    await invalid.goto(origin + '/recuperar-senha/#error=access_denied&error_code=otp_expired');
    await invalid.locator('#emailForm').waitFor({state: 'visible'});
    assert.equal(await invalid.locator('#senhaForm').isVisible(), false);
    assert.equal(new URL(invalid.url()).hash, '');

    const missing = await pageWith(null);
    await missing.goto(origin + '/recuperar-senha/#type=recovery&access_token=invalid');
    await missing.locator('#erro').waitFor({state: 'visible'});
    assert.equal(await missing.locator('#senhaForm').isVisible(), false);

    const rate = await pageWith(null, {status: 429, message: 'For security purposes, you can only request this after 26 seconds.'});
    await rate.goto(origin + '/recuperar-senha/');
    await rate.locator('#email').fill('test@example.com');
    await rate.locator('#enviar').click();
    await rate.locator('#erro').waitFor({state: 'visible'});
    assert.equal(await rate.locator('#erro').textContent(), 'Espere um minuto antes de pedir outro link.');

    const redirect = await pageWith({user: {id: 'fixture'}});
    await redirect.goto(origin + '/entrar/#type=recovery&access_token=fixture');
    await redirect.locator('#senhaForm').waitFor({state: 'visible'});
    assert.equal(new URL(redirect.url()).pathname, '/recuperar-senha/');
    assert.deepEqual(errors, []);
    console.log('7 cenários de recuperação e alteração passaram em Chromium.');
  } finally { await browser.close(); server.close(); }
})().catch(e => {console.error(e); server.close(); process.exitCode = 1;});
