// Shared helpers for driving the admin panel (Sveltia CMS) in headless Chromium.
// The admin must be built with CMS_BACKEND=test and served locally, e.g.:
//   CMS_BACKEND=test npm run build && npm run serve
// Env: ADMIN_URL (default http://localhost:4321/admin/), TEST_FILES (folder with test photos and
// videos, default /home/sayyor/chocoparty-materials/tools/admin-test-images), OUT (results folder).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:4321/admin/';
const TEST_FILES = process.env.TEST_FILES || '/home/sayyor/chocoparty-materials/tools/admin-test-images';
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'sveltia-phone-check');

// Chromium only (WebKit does not run on this machine): a phone viewport with touch input.
const PROFILES = {
  phone: (version) => ({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`,
  }),
  desktop: () => ({ viewport: { width: 1280, height: 800 } }),
};

async function launch(profile, { locale = 'en-US' } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...PROFILES[profile](browser.version()), locale, timezoneId: 'Asia/Tashkent' });
  const page = await context.newPage();
  const dir = path.join(OUT, 'shots', profile);
  fs.mkdirSync(dir, { recursive: true });
  const log = { problems: [], taps: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => log.problems.push(`pageerror: ${err.message}`));
  let n = 0;
  async function shot(name, settle = 500) {
    await page.waitForTimeout(settle);
    const file = path.join(dir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    return file;
  }
  async function tap(locator, label) {
    await locator.scrollIntoViewIfNeeded();
    if (profile === 'phone') await locator.tap();
    else await locator.click();
    log.taps.push(label);
    await page.waitForTimeout(350);
  }
  return { browser, page, shot, tap, log, dir };
}

/** Visible interactive elements, for finding selectors while exploring. */
async function controls(page, scope = 'body') {
  return page.evaluate((scopeSel) => {
    const root = document.querySelector(scopeSel) || document.body;
    const out = [];
    for (const el of root.querySelectorAll(
      'button, a[href], input, textarea, [role=button], [role=radio], [role=combobox], [role=option], [role=treeitem], [role=row], [role=alert], [role=dialog], h1, h2, h3',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const label = (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 70);
      out.push(`${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}${el.type ? `(${el.type})` : ''} "${label}" @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}${el.disabled ? ' DISABLED' : ''}`);
    }
    return out;
  }, scope);
}

/** Copies everything the test backend stored (its «repository» in the browser) to disk. */
async function dumpOpfs(page, outDir) {
  const files = await page.evaluate(async () => {
    const out = [];
    const b64 = (buf) => {
      let s = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
    async function walk(dir, prefix) {
      for await (const [name, handle] of dir.entries()) {
        const p = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === 'directory') await walk(handle, p);
        else {
          const f = await handle.getFile();
          out.push({ path: p, size: f.size, data: b64(await f.arrayBuffer()) });
        }
      }
    }
    await walk(await navigator.storage.getDirectory(), '');
    return out;
  });
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const f of files) {
    const dest = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(f.data, 'base64'));
  }
  return files.map(({ path: p, size }) => ({ path: p, size }));
}

module.exports = { ADMIN_URL, TEST_FILES, OUT, launch, controls, dumpOpfs };
