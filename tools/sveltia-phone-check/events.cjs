// The event form on a phone, end to end, with the in-browser test repository:
//   1. a full event (all fields, 8 JPEG + 2 HEIC photos, one video), saved and reopened;
//   2. a minimal event on the same date and type (does it get its own address?);
//   3. the full event again: move a photo up, remove the last one, save, reopen;
//   4. limits: a 16th photo and a video over 20 MB.
// Every step leaves a screenshot; at the end the stored repository is copied to OUT/stored.
// Usage (admin built with CMS_BACKEND=test and served): node tools/sveltia-phone-check/events.cjs
const fs = require('fs');
const path = require('path');
const { ADMIN_URL, TEST_FILES, OUT, launch, controls, dumpOpfs } = require('./lib.cjs');

const profile = process.argv[2] || 'phone';
const results = [];

(async () => {
  const { browser, page, shot, tap, log } = await launch(profile);
  const FIELD = (key) => `section[data-key-path="${key}"]`;
  const field = (key) => page.locator(FIELD(key)).first();
  const dialog = () => page.locator('dialog[open]').last();
  const alerts = async () =>
    (await page.locator('[role=alert], [role=alertdialog], .validation, [aria-invalid=true]').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  const items = (key) => page.locator(`${FIELD(key)} [role=textbox]`);

  async function step(name, fn) {
    try {
      const note = await fn();
      const file = await shot(name);
      results.push({ step: name, ok: true, note: note || '', shot: file });
      console.log(`ok    ${name}${note ? `  — ${note}` : ''}`);
    } catch (error) {
      const file = await shot(`FAILED-${name}`).catch(() => null);
      results.push({ step: name, ok: false, note: error.message.split('\n')[0], shot: file });
      console.log(`FAIL  ${name}: ${error.message.split('\n')[0]}`);
      console.log((await controls(page)).slice(0, 40).join('\n'));
      throw error;
    }
  }

  async function pick(key, files, label) {
    const before = await items(key).count();
    await field(key).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await tap(field(key).getByRole('button', { name: 'Browse' }), `${label}: Browse`);
    await dialog().getByRole('button', { name: 'Upload' }).waitFor();
    const optionsBefore = await dialog().getByRole('option').count();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      tap(dialog().getByRole('button', { name: 'Upload' }), `${label}: Upload`),
    ]);
    await chooser.setFiles(files.map((file) => path.join(TEST_FILES, file)));
    await page
      .waitForFunction(
        ([want]) => document.querySelectorAll('dialog[open] [role=option]').length >= want,
        [optionsBefore + files.length],
        { timeout: 90000 },
      )
      .catch(() => {});
    await page.waitForTimeout(1500);
    const listed = (await dialog().getByRole('option').count()) - optionsBefore;
    const dialogAlerts = await alerts();
    const insert = dialog().getByRole('button', { name: 'Insert' });
    if (!(await insert.isEnabled().catch(() => false))) {
      await tap(dialog().getByRole('button', { name: /Cancel|Close/ }).first(), `${label}: close dialog`);
      return { listed, inserted: 0, alerts: dialogAlerts };
    }
    await tap(insert, `${label}: Insert`);
    await page
      .waitForFunction(
        ([sel, want]) => document.querySelectorAll(sel).length >= want,
        [`${FIELD(key)} [role=textbox]`, before + listed],
        { timeout: 120000 },
      )
      .catch(() => {});
    await page.waitForTimeout(1200);
    return { listed, inserted: (await items(key).count()) - before, alerts: await alerts() };
  }

  async function save() {
    await tap(page.getByRole('button', { name: 'Save', exact: true }), 'Save');
    await page.waitForURL((url) => url.hash.startsWith('#/collections/events'), { timeout: 60000 });
    await page.waitForTimeout(1500);
  }

  // ------------------------------------------------------------------ enter
  await page.goto(ADMIN_URL, { waitUntil: 'load' });
  await step('enter', async () => {
    await tap(page.getByRole('button', { name: /test/i }).first(), 'enter test repository');
    await page.getByRole('treeitem', { name: /Мероприятия/ }).waitFor({ timeout: 30000 });
  });

  // ------------------------------------------------------------------ 1. full event
  await step('full-new', async () => {
    await tap(page.getByRole('treeitem', { name: /Мероприятия/ }), 'open events');
    await tap(page.getByRole('button', { name: 'Create New Entry' }).first(), 'create');
    await field('date').waitFor();
  });
  await step('full-fields', async () => {
    await field('date').locator('input[type=date]').fill('2025-12-14');
    await tap(field('type').locator('[role=combobox]'), 'type: open');
    await tap(page.getByRole('option', { name: 'Корпоратив' }), 'type: corporate');
    await field('client').locator('input').fill('Coca-Cola');
    await field('venue').locator('input').fill('Hyatt Regency Tashkent');
    await tap(field('fountain').getByRole('radio', { name: /Большой|large/ }).first(), 'fountain: large');
    return `type=${await field('type').locator('[role=combobox]').innerText()}`;
  });
  await step('full-cover', async () => JSON.stringify(await pick('cover', ['normal-1p6mb.jpg'], 'cover')));
  await step('full-gallery-jpeg', async () =>
    JSON.stringify(
      await pick(
        'gallery',
        ['gallery-01.jpg', 'gallery-02.jpg', 'gallery-03.jpg', 'gallery-04.jpg', 'gallery-05.jpg', 'large-upscaled.jpg', 'rotated-exif6.jpg', 'small-1066x1600.jpg'],
        'gallery',
      ),
    ),
  );
  await step('full-gallery-heic', async () =>
    JSON.stringify(await pick('gallery', ['synthetic-single.heic', 'synthetic-grid.heic'], 'gallery heic')),
  );
  await step('full-gallery-controls', async () => {
    const names = await field('gallery').getByRole('button').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('aria-label') || e.innerText.trim()))]);
    return `gallery buttons: ${names.join(', ')}`;
  });
  await step('full-video', async () => JSON.stringify(await pick('videos', ['clip-6s.mp4'], 'video')));
  await step('full-description', async () => {
    await page.locator('section[data-key-path]').last().evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(800);
    await field('description').waitFor({ timeout: 10000 });
    await tap(field('description').getByRole('checkbox').first(), 'description: add');
    await field('description.ru').locator('textarea').fill('Корпоратив с большим фонтаном и молочным шоколадом.');
    return 'ru description filled';
  });
  await step('full-saved', async () => {
    await save();
    return (await page.getByRole('row').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ');
  });

  // ------------------------------------------------------------------ 2. minimal event, same date and type
  await step('minimal-saved', async () => {
    await tap(page.getByRole('button', { name: 'Create New Entry' }).first(), 'create');
    await field('date').waitFor();
    await field('date').locator('input[type=date]').fill('2025-12-14');
    await tap(field('type').locator('[role=combobox]'), 'type: open');
    await tap(page.getByRole('option', { name: 'Корпоратив' }), 'type: corporate');
    await pick('cover', ['gallery-06.jpg'], 'cover');
    await pick('gallery', ['gallery-07.jpg'], 'gallery');
    await save();
    return (await page.getByRole('row').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ');
  });
  const afterTwo = await dumpOpfs(page, path.join(OUT, 'stored', 'after-two-events'));
  console.log('stored after two events:\n  ' + afterTwo.filter((f) => f.path.endsWith('.json')).map((f) => f.path).join('\n  '));

  // ------------------------------------------------------------------ 3. reorder and remove
  await step('edit-reopen', async () => {
    const row = page.getByRole('row').filter({ hasText: 'Coca-Cola' }).first();
    await tap(row, 'open the full event');
    await field('gallery').waitFor();
    return `gallery items: ${await items('gallery').count()}`;
  });
  await step('edit-move-up', async () => {
    const second = field('gallery').locator('[role=listitem], .item, li').nth(1);
    const moveUp = field('gallery').getByRole('button', { name: /Move Up/ }).nth(1);
    if (await moveUp.count()) await tap(moveUp, 'gallery: move second photo up');
    else await tap(second.getByRole('button', { name: /Up/ }).first(), 'gallery: move second photo up');
    return `order now: ${(await items('gallery').allInnerTexts()).map((t) => t.split('/').pop()).join(', ')}`;
  });
  await step('edit-remove-last', async () => {
    const removes = field('gallery').getByRole('button', { name: /Remove/ });
    await tap(removes.last(), 'gallery: remove last photo');
    return `order now: ${(await items('gallery').allInnerTexts()).map((t) => t.split('/').pop()).join(', ')}`;
  });
  const shownBeforeSave = (await items('gallery').allInnerTexts()).map((t) => t.split('/').pop());
  await step('edit-saved', async () => {
    await save();
    await tap(page.getByRole('row').filter({ hasText: 'Coca-Cola' }).first(), 'reopen');
    await field('gallery').waitFor();
    await page.waitForTimeout(1000);
    const shownAfter = (await items('gallery').allInnerTexts()).map((t) => t.split('/').pop());
    return `before save: ${shownBeforeSave.join(', ')} | after reopen: ${shownAfter.join(', ')} | same: ${JSON.stringify(shownBeforeSave) === JSON.stringify(shownAfter)}`;
  });

  // ------------------------------------------------------------------ 4. limits
  await step('limit-16th-photo', async () => {
    const before = await items('gallery').count();
    const files = ['extra-1.jpg', 'extra-2.jpg', 'extra-3.jpg', 'extra-4.jpg', 'extra-5.jpg', 'extra-6.jpg', 'gallery-06.jpg'].slice(0, 16 - before);
    const result = await pick('gallery', files, 'gallery up to 16');
    return `had ${before}, tried ${files.length}, now ${await items('gallery').count()}; ${JSON.stringify(result)}; save enabled: ${await page.getByRole('button', { name: 'Save', exact: true }).isEnabled()}`;
  });
  await step('limit-16th-save', async () => {
    await tap(page.getByRole('button', { name: 'Save', exact: true }), 'Save with 16 photos');
    await page.waitForTimeout(2500);
    return `still in editor: ${(await field('gallery').count()) > 0}; alerts: ${JSON.stringify(await alerts())}`;
  });
  await step('limit-big-video', async () => {
    await tap(page.getByRole('row').filter({ hasText: 'Coca-Cola' }).first(), 'reopen');
    await field('videos').waitFor();
    const before = await items('videos').count();
    const result = await pick('videos', ['clip-too-big.mp4'], 'video over 20 MB');
    return `videos before ${before}, after ${await items('videos').count()}; ${JSON.stringify(result)}`;
  });

  const stored = await dumpOpfs(page, path.join(OUT, 'stored', 'final'));
  console.log('\nstored files:');
  for (const file of stored) console.log(`  ${String(file.size).padStart(9)}  ${file.path}`);
  console.log(log.problems.length ? `\nproblems:\n  ${[...new Set(log.problems)].join('\n  ')}` : '\nproblems: none');
  fs.writeFileSync(path.join(OUT, `events-${profile}.json`), JSON.stringify(results, null, 2));
  await browser.close();
})().catch(async (error) => {
  console.error('\nSTOPPED:', error.message.split('\n')[0]);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `events-${profile}.json`), JSON.stringify(results, null, 2));
  process.exit(1);
});
