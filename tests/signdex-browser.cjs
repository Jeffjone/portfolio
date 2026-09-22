const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const {startLocalServer} = await import('../server/signdex/local.mjs');
  const service = await startLocalServer({port:0});
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  try {
    const errors = [];
    async function visitor() {
      const page = await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
      page.on('pageerror',error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**',route => route.abort());
      await page.goto(service.origin + '/#signdex');
      await page.locator('#enter-portfolio').click();
      await page.waitForFunction(() => document.getElementById('encounter').hidden);
      return page;
    }
    const page = await visitor();
    await page.waitForFunction(() => document.getElementById('signature-book-status').textContent.includes('first page'));
    await page.locator('#signature-submit').click();
    assert.equal(await page.locator('[aria-invalid=true]').count(),5);
    assert.equal(await page.evaluate(() => document.activeElement.id),'signature-name');
    await page.locator('#signature-name').fill('Taylor');
    await page.locator('#signature-pokemon').fill('Pikachu');
    await page.locator('#signature-game').selectOption('emerald');
    await page.locator('#signature-series').selectOption('xy');
    await page.locator('#signature-consent').check();
    assert.match(await page.locator('#signature-preview').textContent(),/Hoenn|HOENN/);
    assert.match(await page.locator('#signature-preview').textContent(),/Kalos challenger/);
    const color = await page.locator('#signature-preview .signature-card').evaluate(el => el.style.getPropertyValue('--signature-paper'));
    await page.locator('#signature-pokemon').fill('Charizard');
    assert.notEqual(await page.locator('#signature-preview .signature-card').evaluate(el => el.style.getPropertyValue('--signature-paper')),color);
    await page.locator('#signature-message').fill('f.u.c.k');
    await page.locator('#signature-submit').click();
    assert.match(await page.locator('#error-message').textContent(),/offensive language/);
    assert.equal((await service.DB.prepare('SELECT COUNT(*) AS count FROM signatures').first()).count,0);
    await page.locator('#signature-message').fill('Great work — best of luck with the next quest!');
    await page.locator('#signature-work').fill('Student · UT Dallas');
    await page.locator('#signature-city').fill('Plano');
    const receipt = await page.locator('#signature-preview .signature-card').getAttribute('data-edition');
    await page.locator('#signature-submit').click();
    await page.waitForFunction(() => document.getElementById('signature-result').textContent.includes('Signature received'));
    assert.equal(await page.locator('#signature-entries .signature-card').count(),0);
    assert.match(await page.locator('#signature-preview').textContent(),/PENDING REVIEW/);
    assert(await page.locator('#signature-submit').isDisabled());
    const other = await visitor();
    assert.equal(await other.locator('#signature-entries .signature-card').count(),0);
    const response = await fetch(`${service.origin}/signdex-api/admin/signatures/${receipt}`,{method:'PATCH',headers:{Authorization:`Bearer ${service.env.ADMIN_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({status:'approved'})});
    assert.equal(response.status,200);
    await other.locator('#signature-refresh').click();
    await other.waitForFunction(() => document.querySelectorAll('#signature-entries .signature-card').length === 1);
    assert.match(await other.locator('#signature-entries').textContent(),/Taylor/);
    assert.match(await other.locator('#signature-entries').textContent(),/Charizard/);
    await other.reload();await other.locator('#enter-portfolio').click();
    await other.waitForFunction(() => document.getElementById('encounter').hidden);
    await other.waitForFunction(() => document.querySelectorAll('#signature-entries .signature-card').length === 1);
    await other.context().setOffline(true);
    await other.locator('#signature-refresh').click();
    await other.waitForFunction(() => document.getElementById('signature-book-status').textContent.includes('could not be reached'));
    assert.equal(await other.locator('#signature-entries .signature-card').count(),1);
    await other.context().setOffline(false);
    for (const width of [390,320]) {
      await other.setViewportSize({width,height:844});
      assert(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`SignDex overflow at ${width}px`);
    }
    await other.locator('#signature-name').fill('Scunthorpe visitor');
    await other.locator('#signature-pokemon').fill('Mewtwo');
    await other.locator('#signature-game').selectOption('new');
    await other.locator('#signature-series').selectOption('new');
    await other.locator('#signature-consent').check();
    let lost = false;
    await other.route('**/signdex-api/signatures',async route => {
      if (route.request().method() === 'POST' && !lost) { lost=true;await route.fetch();await route.abort(); }
      else await route.continue();
    });
    await other.locator('#signature-submit').click();
    await other.waitForFunction(() => document.getElementById('signature-result').textContent.includes('could not be reached'));
    assert.equal(await other.locator('#signature-name').inputValue(),'Scunthorpe visitor');
    const countBefore = (await service.DB.prepare('SELECT COUNT(*) AS count FROM signatures').first()).count;
    await other.locator('#signature-submit').click();
    await other.waitForFunction(() => document.getElementById('signature-result').textContent.includes('Signature received'));
    assert.equal((await service.DB.prepare('SELECT COUNT(*) AS count FROM signatures').first()).count,countBefore);
    const preview = await browser.newPage({reducedMotion:'reduce'});
    await preview.route('https://fonts.googleapis.com/**',route=>route.abort());
    await preview.route('**/assets/js/signdex-config.js',route=>route.fulfill({contentType:'text/javascript',body:"globalThis.SignDexConfig={apiBase:''};"}));
    await preview.goto(service.origin + '/#signdex');await preview.locator('#enter-portfolio').click();
    await preview.waitForFunction(() => document.getElementById('encounter').hidden);
    assert.match(await preview.locator('#signdex-connection').textContent(),/Preview mode/);
    assert.equal(await preview.locator('#signature-submit').textContent(),'Check my signature');
    assert(await preview.locator('#signature-refresh').isDisabled());
    assert.deepEqual(errors,[]);
    assert.equal((await fetch(service.origin + '/.signdex-data/local.sqlite')).status,404);
    console.log('PASS: SignDex form, required/optional fields, profanity checks, type-based preview, private pending receipt, approved cross-visitor book, refresh/reload, network failures, idempotent retry, 390px/320px layouts, and honest disconnected mode.');
  } finally { await browser.close();await service.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
