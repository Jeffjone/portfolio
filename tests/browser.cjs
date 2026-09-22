const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const body = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); response.end(body);
  } catch { response.writeHead(404).end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    const errors = [], missingAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) missingAssets.push(response.url()); });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://open.spotify.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Spotify test player</p>' }));
    const enter = async () => {
      await page.locator('#enter-portfolio').click();
      await page.waitForFunction(() => document.getElementById('encounter').hidden);
    };
    const navigate = async route => { await page.locator(`.game-menu [data-route="${route}"]`).click(); };
    await page.goto(base);
    assert(await page.locator('#portfolio').evaluate(element => element.inert));
    assert.equal(await page.locator('.pokeball-spin').evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'enter-portfolio');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('encounter').hidden);
    assert.equal(await page.locator('.game-panel:visible').count(), 1);
    assert.equal(await page.locator('#portfolio').evaluate(element => element.inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'portfolio-heading');
    await page.locator('.portrait-button').click();
    assert(await page.locator('#game-dialog').evaluate(element => element.open));
    assert.match(await page.locator('.profile-layout img').getAttribute('src'), /jeffrey-portrait.jpg$/);
    await page.locator('.profile-layout img').evaluate(image => image.decode());
    assert(await page.locator('.profile-layout img').evaluate(image => image.naturalWidth > 0));
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.getElementById('game-dialog').contains(document.activeElement)));
    }
    await page.keyboard.press('Escape');
    assert(await page.locator('.portrait-button').evaluate(element => element === document.activeElement));
    await page.locator('#next-dialogue').click();
    assert.match(await page.locator('#welcome-dialogue').textContent(), /Professor Oak/);
    await navigate('projects');
    await page.locator('[data-filter="ml"]').click();
    assert.equal(await page.locator('.project-card:visible').count(), 2);
    await page.locator('[data-filter="all"]').click();
    for (let id = 1; id <= 4; id++) {
      await page.locator(`[data-project-id="${id}"]`).click();
      await page.getByRole('button', { name: '◉ Catch this project' }).click();
      await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#projects [data-catch-count]').textContent(), '4 / 4');
    assert.equal(await page.locator('.project-card.caught').count(), 4);
    await page.reload(); await enter();
    assert(await page.locator('#projects').isVisible());
    assert.equal(await page.locator('#projects [data-catch-count]').textContent(), '4 / 4');
    await navigate('home'); await page.locator('#quiz-open').click();
    await page.locator('.quiz-options button').nth(1).click();
    assert.match(await page.locator('.feedback').textContent(), /Try again/);
    await page.locator('.quiz-options button').first().click();
    assert.match(await page.locator('.feedback').textContent(), /Autonomous Drone/);
    await page.getByRole('button', { name: 'Next mystery' }).click();
    assert.match(await page.locator('#dialog-content').textContent(), /No internet/);
    await page.keyboard.press('Escape');
    await navigate('awards'); await page.locator('.badge-action').first().click();
    assert.match(await page.locator('#dialog-title').textContent(), /BPA C\+\+/);
    await page.keyboard.press('Escape');
    await navigate('skills'); assert.equal(await page.locator('.skill-box:visible').count(), 4);
    await navigate('room'); await page.getByRole('button', { name: 'Astronomy', exact: true }).click();
    assert.match(await page.locator('#dialog-content').textContent(), /Stargazing/);
    await page.keyboard.press('Escape');
    await page.locator('#spotify-url').fill('https://evil.example/playlist/37i9dQZF1DX4WYpdgoIcn6');
    await page.locator('#spotify-form button').click();
    assert.equal(await page.locator('#spotify-player iframe').count(), 0);
    assert.match(await page.locator('#radio-status').textContent(), /Use an https/);
    await page.locator('#spotify-url').fill('https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6?si=test');
    await page.locator('#spotify-form button').click();
    assert.match(await page.locator('#spotify-player iframe').getAttribute('src'), /^https:\/\/open.spotify.com\/embed\/playlist\//);
    await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 78.4, weather_code: 0 } } }));
    await page.locator('#weather-button').click();
    await page.waitForFunction(() => document.getElementById('weather-status').textContent.includes('78°F'));
    await page.unroute('https://api.open-meteo.com/**');
    await page.route('https://api.open-meteo.com/**', route => route.abort());
    await page.locator('#weather-button').click();
    await page.waitForFunction(() => document.getElementById('weather-status').textContent.includes('offline'));
    assert(await page.locator('#weather-button').isEnabled());
    await page.locator('#sound-toggle').click();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
    await page.locator('#sound-toggle').click();
    await navigate('home'); await navigate('experience'); await page.goBack();
    assert(await page.locator('#home').isVisible());
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['home', 'projects', 'experience', 'awards', 'skills', 'room', 'signdex']) {
      await navigate(route);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow on mobile ${route}`);
    }
    await navigate('home'); await page.locator('.map-trainer').click();
    assert(await page.locator('#game-dialog').evaluate(element => element.scrollWidth <= element.clientWidth));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 650 });
    await page.reload();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Entrance overflow at 320px');
    await enter();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home overflow at 320px');
    await page.goto(`${base}/#about`); await page.reload(); await enter();
    assert(await page.locator('#room').isVisible());
    await page.goto(`${base}/#unknown`); assert(await page.locator('#home').isVisible());
    const noJS = await browser.newPage({ javaScriptEnabled: false });
    await noJS.route('https://fonts.googleapis.com/**', route => route.abort());
    await noJS.goto(base);
    assert.equal(await noJS.locator('.game-panel:visible').count(), 7);
    assert.equal(await noJS.locator('#encounter').isVisible(), false);
    const blocked = await browser.newPage({ reducedMotion: 'reduce' });
    await blocked.route('https://fonts.googleapis.com/**', route => route.abort());
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }));
    await blocked.goto(`${base}/#projects`); await blocked.locator('#enter-portfolio').click();
    await blocked.waitForFunction(() => document.getElementById('encounter').hidden);
    assert.match(await blocked.locator('#save-status').textContent(), /current visit|this visit/);
    await blocked.locator('[data-project-id="1"]').click();
    await blocked.getByRole('button', { name: '◉ Catch this project' }).click();
    assert.equal(await blocked.locator('#projects [data-catch-count]').textContent(), '1 / 4');
    const animated = await browser.newPage();
    await animated.route('https://fonts.googleapis.com/**', route => route.abort());
    await animated.goto(base); await animated.locator('#enter-portfolio').click();
    assert(await animated.locator('#encounter').isVisible());
    await animated.waitForFunction(() => document.getElementById('encounter').hidden);
    assert.deepEqual(errors, []); assert.deepEqual(missingAssets, []);
    console.log('PASS: entry, routes/history, portrait/focus, collecting/persistence, filters, quiz, badges, hobbies, Spotify validation, weather success/failure, sound, 390px/320px layouts, reduced motion, blocked storage, no-JS fallback, local assets.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
