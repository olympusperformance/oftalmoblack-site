/* Páginas reais com conta e dados simulados; não altera usuários de produção. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const stub = require('./helpers/black-fixtures.cjs');
const root = path.resolve(__dirname, '../public');
const out = process.env.BLACK_QA_DIR || '/tmp/instagram-turbina-qa';
fs.mkdirSync(out, {recursive: true});
const field = 'cb_instagram_turbina_tutorial_seen_at';
const accounts = new Map();
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    const type = {'.js':'text/javascript', '.html':'text/html', '.css':'text/css', '.mp4':'video/mp4', '.jpg':'image/jpeg'}[path.extname(file)];
    res.writeHead(200, {'Content-Type':type || 'application/octet-stream'}).end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, ...(process.env.BLACK_BROWSER_EXECUTABLE ? {executablePath:process.env.BLACK_BROWSER_EXECUTABLE} : {})});
  const errors = [];
  async function setup({id='member-1', admin=false, preview=false, width=1440, hash, failSave=false, failRead=false, delay=0}={}) {
    const context = await browser.newContext({viewport:{width,height:900}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const writes = [], reads = [];
    const state = {failSave, failRead, delay};
    await page.route('https://**', r => r.abort());
    await page.route('**/__tutorial-account', async route => {
      if (route.request().method() === 'PUT') {
        const data = route.request().postDataJSON(); writes.push(data);
        if (state.failSave) return route.fulfill({json:{error:{message:'offline'}}});
        accounts.set(id, {...accounts.get(id), ...data});
      } else {
        reads.push(id);
        if (state.delay) await new Promise(r => setTimeout(r, state.delay));
        if (state.failRead) return route.fulfill({json:{error:{message:'offline'}}});
      }
      await route.fulfill({json:{data:{user:{id,user_metadata:accounts.get(id)||{name:'Pessoa QA'}}}}});
    });
    await page.route('**/assets/club-supabase.js', route => route.fulfill({contentType:'text/javascript', body:stub(admin) + `
      const session = Club.sb.auth.getSession;
      Club.sb.auth.getSession = async () => { const r=await session();r.data.session.user.id=${JSON.stringify(id)};return r; };
      Club.sb.auth.getUser = async () => (await fetch('/__tutorial-account')).json();
      Club.sb.auth.updateUser = async ({data}) => (await fetch('/__tutorial-account', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json();
    `}));
    const area = admin && !preview ? 'admin' : 'membros';
    await page.goto(base + '/' + area + '/' + (preview ? '?membro=10000000-0000-4000-8000-000000000001' : '') + (hash || (area === 'admin' ? '#igMetricas' : '#instagram')));
    await page.locator('[data-instagram-tab=metricas]').waitFor();
    return {context,page,writes,reads,state};
  }
  const close = async page => { await page.keyboard.press('Escape'); await page.locator('.ig-tutorial').waitFor({state:'hidden'}); };
  const settled = async page => { await page.waitForFunction(() => !document.querySelector('#brandingPanel .tbl-empty[role=status]')); };
  try {
    const first = await setup(); const p = first.page;
    assert.equal(await p.locator('#igPanelMetricas').isVisible(), true);
    assert.equal(await p.locator('#igPanelTurbina').isVisible(), false);
    assert.equal(first.writes.length, 0); assert.equal(first.reads.length, 0);
    await p.screenshot({path:path.join(out,'metricas-desktop.png')});
    await p.getByRole('tab', {name:'Turbinar',exact:true}).click();
    await p.locator('.ig-tutorial[open]').waitFor();
    await p.waitForFunction(() => document.querySelector('.ig-tutorial video').readyState >= 2);
    assert.equal(first.writes.length,1);
    assert.deepEqual(Object.keys(first.writes[0]), [field]);
    assert.equal(await p.locator('#igPanelMetricas').isVisible(),false);
    await p.screenshot({path:path.join(out,'tutorial-desktop.png')});
    await close(p);
    assert.equal(await p.locator('.ig-tutorial video').evaluate(v=>v.paused && !v.hasAttribute('src')),true);
    assert.equal(await p.locator('[data-instagram-tutorial]').evaluate(b=>b===document.activeElement),true);
    await p.getByRole('tab',{name:'Métricas',exact:true}).click();
    await p.getByRole('tab',{name:'Turbinar',exact:true}).click();
    await settled(p);
    assert.equal(await p.locator('.ig-tutorial[open]').count(),0);
    await p.screenshot({path:path.join(out,'turbina-desktop.png')});
    await p.reload(); await p.locator('#brandingPanel .tbl').waitFor();
    assert.equal(await p.locator('.ig-tutorial[open]').count(),0);
    await p.getByRole('button',{name:'Tutorial',exact:true}).click();
    await p.locator('.ig-tutorial[open]').waitFor(); await close(p);
    await p.getByRole('tab',{name:'Turbinar',exact:true}).focus(); await p.keyboard.press('ArrowLeft');
    assert.equal(await p.locator('#igPanelMetricas').isVisible(),true);
    await first.context.close();

    // Outro dispositivo, sem localStorage: reconhece a preferência da conta.
    const second = await setup({hash:'#instagram/turbina'});
    await second.page.locator('#brandingPanel .tbl').waitFor();
    await second.page.waitForFunction(() => localStorage.length > 0);
    assert.equal(await second.page.locator('.ig-tutorial[open]').count(),0);
    assert.equal(second.writes.length,0);
    await second.context.close();

    // Primeira visita de outro usuário no celular; layout e reprodução reais.
    const mobile = await setup({id:'member-2',width:390});
    await mobile.page.getByRole('tab',{name:'Turbinar',exact:true}).click();
    await mobile.page.locator('.ig-tutorial[open]').waitFor();
    await mobile.page.waitForFunction(() => document.querySelector('.ig-tutorial video').readyState >= 2);
    const bounds = await mobile.page.locator('.ig-tutorial').boundingBox();
    assert(bounds.x>=0 && bounds.x+bounds.width<=390 && bounds.y>=0 && bounds.y+bounds.height<=900);
    await mobile.page.screenshot({path:path.join(out,'tutorial-mobile.png')});
    await close(mobile.page);
    assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await mobile.page.screenshot({path:path.join(out,'turbina-mobile.png')});
    await mobile.context.close();

    // Prévia não marca visitas de ninguém; ida e volta conservam a subaba.
    const preview = await setup({id:'admin-preview',admin:true,preview:true,hash:'#instagram/turbina'});
    await preview.page.locator('#brandingPanel .tbl').waitFor();
    assert.equal(preview.writes.length,0); assert.equal(preview.reads.length,0);
    assert.equal(await preview.page.locator('.ig-tutorial[open]').count(),0);
    assert.match(await preview.page.locator('#voltarPainel').getAttribute('href'), /#igMetricas\/turbina$/);
    await preview.page.getByRole('button',{name:'Tutorial',exact:true}).click();
    await preview.page.locator('.ig-tutorial[open]').waitFor(); await close(preview.page);
    assert.equal(preview.writes.length,0); await preview.context.close();

    const admin = await setup({id:'admin-1',admin:true,hash:'#branding'});
    await admin.page.locator('.ig-tutorial[open]').waitFor(); await close(admin.page);
    assert.match(admin.page.url(), /#igMetricas\/turbina$/);
    await admin.page.screenshot({path:path.join(out,'turbina-admin.png')});
    await admin.context.close();

    // Falha na gravação: não repete localmente e sincroniza na próxima entrada.
    const failed = await setup({id:'member-offline',failSave:true,hash:'#instagram/turbina'});
    await failed.page.locator('.ig-tutorial[open]').waitFor(); await close(failed.page);
    failed.state.failSave=false;
    await failed.page.getByRole('tab',{name:'Métricas',exact:true}).click();
    await failed.page.getByRole('tab',{name:'Turbinar',exact:true}).click();
    await failed.page.waitForResponse(r=>r.url().endsWith('/__tutorial-account') && r.request().method()==='PUT');
    assert.equal(await failed.page.locator('.ig-tutorial[open]').count(),0);
    assert(accounts.get('member-offline')[field]); await failed.context.close();

    // Leitura lenta não abre popup depois de sair de Turbinar.
    const slow = await setup({id:'member-slow',delay:600});
    await slow.page.getByRole('tab',{name:'Turbinar',exact:true}).click();
    await slow.page.getByRole('tab',{name:'Métricas',exact:true}).click();
    await slow.page.waitForResponse(r=>r.url().endsWith('/__tutorial-account'));
    assert.equal(await slow.page.locator('.ig-tutorial[open]').count(),0); assert.equal(slow.writes.length,0);
    slow.state.failRead=true;
    await slow.page.getByRole('tab',{name:'Turbinar',exact:true}).click();
    await slow.page.waitForResponse(r=>r.url().endsWith('/__tutorial-account'));
    await slow.page.getByRole('button',{name:'Tutorial',exact:true}).click();
    await slow.page.locator('.ig-tutorial[open]').waitFor(); await close(slow.page);
    await slow.context.close();
    assert.deepEqual(errors,[]);
    console.log('OK: áreas, primeira visita, outra conta/dispositivo, replay, vídeo, celular, admin, prévia e falhas. Capturas:',out);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
