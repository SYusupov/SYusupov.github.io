// Shared helpers for the Sveltia CMS phone/desktop check.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require(os.homedir() + '/.claude/skills/headless-browser/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_URL = 'http://127.0.0.1:8765/admin/index.html';
const IMAGES = path.join(ROOT, 'images');

// Chromium only (WebKit is unusable on this machine). The phone profile is Chromium with a
// phone viewport, touch input and the user agent of Chrome on Android, so the engine and the
// user agent agree. deviceScaleFactor 2 only makes the PNGs sharper; layout is in CSS px.
const PROFILES = {
  phone: version => ({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`,
  }),
  // Same Chromium, but announcing itself as Safari on an iPhone: only to see whether the CMS
  // behaves differently by user agent. It says nothing about real Safari.
  'phone-iphone-ua': () => ({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  }),
  desktop: () => ({ viewport: { width: 1280, height: 800 } }),
};

async function launch(profile, { locale = 'en-US', shotsDir } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...PROFILES[profile](browser.version()),
    locale,
    timezoneId: 'Asia/Tashkent',
  });
  const page = await context.newPage();
  const dir = shotsDir || path.join(ROOT, 'shots', profile);
  fs.mkdirSync(dir, { recursive: true });

  const log = { problems: [], externalHosts: {}, shots: [], taps: [] };
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') log.problems.push(`console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => log.problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', req => {
    const reason = req.failure()?.errorText ?? '';
    if (reason !== 'net::ERR_ABORTED') log.problems.push(`requestfailed: ${req.url()} ${reason}`);
  });
  page.on('response', res => { if (res.status() >= 400) log.problems.push(`http ${res.status()}: ${res.url()}`); });
  page.on('request', req => {
    const u = new URL(req.url());
    if (u.protocol.startsWith('http') && u.hostname !== '127.0.0.1') {
      (log.externalHosts[u.hostname] ||= new Set()).add(u.pathname);
    }
  });

  let n = 0;
  // Viewport screenshot (never full-page), numbered in the order taken.
  async function shot(name, { settle = 500 } = {}) {
    await page.waitForTimeout(settle);
    const file = path.join(dir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    log.shots.push(file);
    return file;
  }

  // One user tap (touch on phone, click on desktop), counted for the tap tally.
  async function tap(locator, label) {
    await locator.scrollIntoViewIfNeeded();
    if (profile.startsWith('phone')) await locator.tap(); else await locator.click();
    log.taps.push(label);
    await page.waitForTimeout(350);
  }

  return { browser, context, page, shot, tap, log, dir, profile };
}

// What the layout looks like to a thumb: page-level horizontal overflow, visible controls that
// stick out of the viewport sideways, and visible controls smaller than 24 CSS px.
async function layoutReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const visible = el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (r.bottom <= 0 || r.top >= vh) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
    };
    const name = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') ||
      el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
    const controls = [...document.querySelectorAll(
      'button, a[href], input, textarea, select, [role=button], [role=tab], [role=radio], [role=checkbox], [role=combobox], [role=option], [role=menuitem], [role=switch]')]
      .filter(visible);
    const offscreen = [];
    const small = [];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) offscreen.push(`${name(el)} [x ${Math.round(r.left)}..${Math.round(r.right)}]`);
      if ((r.width < 24 || r.height < 24) && el.type !== 'hidden' && el.type !== 'file') {
        small.push(`${name(el)} [${Math.round(r.width)}x${Math.round(r.height)}]`);
      }
    }
    // Any scroll container that can be scrolled sideways.
    const hscroll = [...document.querySelectorAll('*')].filter(el => {
      if (!visible(el)) return false;
      const s = getComputedStyle(el);
      return el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(s.overflowX);
    }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
    return {
      viewport: `${vw}x${vh}`,
      pageScrollWidth: doc.scrollWidth,
      pageOverflowsX: doc.scrollWidth > vw + 1,
      controlsOffscreenX: offscreen,
      controlsUnder24px: small,
      horizontalScrollers: hscroll,
    };
  });
}

// Visible interactive elements, for finding selectors while exploring.
async function controls(page, scope = 'body') {
  return page.evaluate(scopeSel => {
    const root = document.querySelector(scopeSel) || document.body;
    const vh = window.innerHeight;
    const out = [];
    for (const el of root.querySelectorAll(
      'button, a[href], input, textarea, select, [role=button], [role=tab], [role=radio], [role=checkbox], [role=combobox], [role=option], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=switch], [role=row], [role=gridcell], h1, h2, h3, [role=dialog], [role=alert], [role=alertdialog], [role=status]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      out.push([
        el.tagName.toLowerCase() + (el.getAttribute('role') ? `[${el.getAttribute('role')}]` : '') + (el.type ? `(${el.type})` : ''),
        JSON.stringify((el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60)),
        `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        r.top >= vh || r.bottom <= 0 ? 'OFFSCREEN-Y' : '',
        el.disabled || el.getAttribute('aria-disabled') === 'true' ? 'DISABLED' : '',
        el.getAttribute('aria-checked') ? `checked=${el.getAttribute('aria-checked')}` : '',
        el.getAttribute('aria-selected') ? `selected=${el.getAttribute('aria-selected')}` : '',
        el.getAttribute('aria-expanded') ? `expanded=${el.getAttribute('aria-expanded')}` : '',
      ].filter(Boolean).join(' '));
    }
    return out;
  }, scope);
}

// Everything the Test backend stored: walk the origin private file system and copy it to disk.
async function dumpOpfs(page, outDir) {
  const files = await page.evaluate(async () => {
    const out = [];
    const b64 = buf => {
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
          out.push({ path: p, size: f.size, type: f.type, data: b64(await f.arrayBuffer()) });
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
  return files.map(({ path: p, size, type }) => ({ path: p, size, type }));
}

function printLog(log) {
  const hosts = Object.fromEntries(Object.entries(log.externalHosts).map(([h, s]) => [h, [...s]]));
  console.log('\nexternal requests:', JSON.stringify(hosts, null, 1));
  const unique = [...new Set(log.problems)];
  console.log(unique.length ? `problems (${unique.length}):\n  ${unique.join('\n  ')}` : 'problems: none');
}

module.exports = { ROOT, ADMIN_URL, IMAGES, launch, layoutReport, controls, dumpOpfs, printLog };
