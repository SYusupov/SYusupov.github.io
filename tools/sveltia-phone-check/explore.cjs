// Opens the admin on a phone, enters the test repository, opens a new event and lists what is on
// screen. Usage: node tools/sveltia-phone-check/explore.cjs [phone|desktop]
const { ADMIN_URL, launch, controls } = require('./lib.cjs');

(async () => {
  const profile = process.argv[2] || 'phone';
  const { browser, page, shot, tap, log } = await launch(profile);
  await page.goto(ADMIN_URL, { waitUntil: 'load' });
  const enter = page.getByRole('button', { name: /test/i }).first();
  await enter.waitFor({ timeout: 30000 });
  console.log('shot', await shot('signin'));
  await tap(enter, 'enter test repository');
  await page.waitForTimeout(1500);
  const dialog = page.locator('dialog[open]');
  if (await dialog.count()) {
    console.log('dialog:', (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 200));
    const ok = dialog.getByRole('button').last();
    await ok.click();
  }
  console.log('shot', await shot('collections', 1000));
  console.log((await controls(page)).join('\n'));
  await tap(page.getByRole('treeitem', { name: /Мероприятия/ }), 'open events');
  await page.waitForTimeout(800);
  await tap(page.getByRole('button', { name: /Create New Entry|Создать/ }).first(), 'create');
  await page.waitForTimeout(1500);
  console.log('shot', await shot('editor', 1000));
  console.log('\n--- editor controls ---');
  console.log((await controls(page)).join('\n'));
  console.log('\nfields:', await page.locator('section[data-key-path]').evaluateAll((els) => els.map((e) => e.dataset.keyPath)));
  console.log(log.problems.length ? `problems:\n  ${[...new Set(log.problems)].join('\n  ')}` : 'problems: none');
  await browser.close();
})().catch((e) => {
  console.error('STOPPED:', e.message.split('\n')[0]);
  process.exit(1);
});
