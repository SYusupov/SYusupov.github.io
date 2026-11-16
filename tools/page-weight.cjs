// Page weight as a phone or desktop browser sees it: bytes before any scrolling (the first
// screen), bytes after scrolling through the page, own JavaScript, layout shifts, top images.
// Usage: node tools/page-weight.cjs <url> [mobile]
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2];
  const mobile = process.argv[3] === 'mobile';
  const browser = await chromium.launch();
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const rows = [];
  page.on('response', async (response) => {
    const request = response.request();
    const sizes = await request.sizes().catch(() => null);
    rows.push({
      url: response.url(),
      type: request.resourceType(),
      status: response.status(),
      bytes: sizes ? sizes.responseBodySize : 0,
    });
  });

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1500);
  const firstScreen = rows.reduce((sum, row) => sum + row.bytes, 0);
  const cls = await page.evaluate(() => window.__cls);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
  await page.waitForTimeout(2000);

  const kb = (bytes) => Math.round(bytes / 1024);
  const sameOrigin = (row) => new URL(row.url).origin === new URL(url).origin;
  const byType = {};
  for (const row of rows) {
    byType[row.type] ??= { requests: 0, kb: 0 };
    byType[row.type].requests += 1;
    byType[row.type].kb += kb(row.bytes);
  }
  console.log(
    JSON.stringify(
      {
        url,
        mobile,
        firstScreenKB: kb(firstScreen),
        totalKB: kb(rows.reduce((sum, row) => sum + row.bytes, 0)),
        ownScriptKB: kb(rows.filter((row) => row.type === 'script' && sameOrigin(row)).reduce((s, r) => s + r.bytes, 0)),
        layoutShift: Number(cls.toFixed(3)),
        failed: rows.filter((row) => row.status >= 400).map((row) => `${row.status} ${row.url}`),
        byType,
      },
      null,
      1,
    ),
  );
  console.log('largest images:');
  for (const row of rows.filter((r) => r.type === 'image').sort((a, b) => b.bytes - a.bytes).slice(0, 6)) {
    console.log(`  ${String(kb(row.bytes)).padStart(5)} KB  ${row.url.replace(/^https?:\/\/[^/]+/, '')}`);
  }
  await browser.close();
})();
