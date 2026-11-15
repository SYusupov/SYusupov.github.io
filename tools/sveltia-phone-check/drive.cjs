// Main driver: the event publishing flow and the price change, in one browser session.
//
//   node scripts/drive.cjs phone      390x664, touch, Chrome-on-Android user agent
//   node scripts/drive.cjs desktop    1280x800
//   node scripts/drive.cjs phone-iphone-ua   as phone, but with an iPhone Safari user agent string
//
// Needs the admin served locally first (from the sveltia-check folder):
//   python3 -I -m http.server 8765 --bind 127.0.0.1 --directory .
//
// Every step ends with a viewport screenshot in shots/<profile>/. At the end, everything the
// Test backend stored (its "repository" in the origin private file system) is copied to
// stored/<profile>/ and a machine-readable summary goes to work/results/<profile>.json.
const fs = require('fs');
const path = require('path');
const { ROOT, ADMIN_URL, IMAGES, launch, layoutReport, dumpOpfs, printLog } = require('./lib.cjs');

const profile = process.argv[2] || 'phone';
const phone = profile.startsWith('phone');
const img = name => path.join(IMAGES, name);

const COVER = ['normal-1p6mb.jpg'];
// One pick, eight files: five ordinary photos plus the three special cases.
const GALLERY_PICK_1 = ['gallery-01.jpg', 'gallery-02.jpg', 'gallery-03.jpg', 'gallery-04.jpg', 'gallery-05.jpg',
  'large-upscaled.jpg', 'rotated-exif6.jpg', 'small-1066x1600.jpg'];
// Second pick: the HEIC files, kept apart so a rejection cannot hide behind the JPEGs.
const GALLERY_PICK_2 = ['synthetic-single.heic', 'synthetic-grid.heic'];

(async () => {
  const s = await launch(profile);
  const { page, tap, shot } = s;
  const steps = [];            // { step, status, shot, layout, note }
  const timings = {};
  // On desktop the preview pane repeats every field, so look in the first (edit) pane only.
  const FIELD = key => `.pane:has(#first-pane-header) section[data-key-path="${key}"]`;
  const field = key => page.locator(FIELD(key));
  const openDialog = () => page.locator('dialog[open]').last();
  const alerts = () => page.locator('[role=alert], [role=alertdialog]').allInnerTexts()
    .then(a => a.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean));

  async function step(name, fn, { settle } = {}) {
    try {
      const note = await fn();
      const file = await shot(name, settle ? { settle } : undefined);
      const layout = await layoutReport(page);
      steps.push({ step: name, status: 'ok', shot: file, note: note || '', layout });
      console.log(`ok    ${name}${note ? '  -- ' + note : ''}${layout.pageOverflowsX || layout.controlsOffscreenX.length ? '  [HORIZONTAL OVERFLOW]' : ''}`);
    } catch (err) {
      const file = await shot(`FAILED-${name}`).catch(() => null);
      steps.push({ step: name, status: 'FAILED', shot: file, note: err.message.split('\n')[0] });
      console.log(`FAIL  ${name}: ${err.message.split('\n')[0]}`);
      throw err;
    }
  }

  // Browse -> Select Image dialog -> Upload -> file chooser -> (optimization) -> Insert.
  async function pickImages(key, files, label, shotPrefix) {
    const itemSel = `${FIELD(key)} [role=textbox]`;
    const itemsBefore = await page.locator(itemSel).count();
    await step(`${shotPrefix}-dialog`, async () => {
      await field(key).evaluate(el => el.scrollIntoView({ block: 'center' }));
      await tap(field(key).getByRole('button', { name: 'Browse' }), `${label}: Browse`);
      await openDialog().getByRole('button', { name: 'Upload' }).waitFor();
    });
    let accepted = 0;
    await step(`${shotPrefix}-picked`, async () => {
      const dialog = openDialog();
      const before = await dialog.getByRole('option').count();
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        tap(dialog.getByRole('button', { name: 'Upload' }), `${label}: Upload`),
      ]);
      const multiple = chooser.isMultiple();
      const accept = await chooser.element().getAttribute('accept');
      const t0 = Date.now();
      await chooser.setFiles(files.map(img));
      // Wait until every picked file is listed (or 90 s, e.g. when a file is rejected).
      await page.waitForFunction(
        ([sel, want]) => document.querySelectorAll(sel).length >= want,
        ['dialog[open] [role=option]', before + files.length], { timeout: 90000 }).catch(() => {});
      timings[`${label}: chosen -> listed in dialog`] = Date.now() - t0;
      accepted = (await dialog.getByRole('option').count()) - before;
      // The dialog sorts files by name, so new ones can land below the fold: bring them up.
      const picked = dialog.locator('.content-pane [role=option][aria-selected=true]');
      const selected = await picked.count();
      if (selected) await picked.first().evaluate(el => el.scrollIntoView({ block: 'start' }));
      // Thumbnails load lazily once a tile is in view; a HEIC one needs its decoder first.
      const t1 = Date.now();
      const thumb = await page.waitForFunction(() => {
        const im = document.querySelector('dialog[open] .content-pane [role=option][aria-selected=true] img');
        return im && im.naturalWidth > 0;
      }, null, { timeout: 20000 }).then(() => true, () => false);
      timings[`${label}: first new tile in view -> its thumbnail shown`] = thumb ? Date.now() - t1 : 'no thumbnail within 20 s';
      await page.waitForTimeout(1200);       // fade-in
      const a = await alerts();
      return `file input multiple=${multiple}; accept=${accept}; picked ${files.length}, listed ${accepted}, ` +
        `selected ${selected}${a.length ? '; alerts: ' + JSON.stringify(a) : ''}`;
    });
    await step(`${shotPrefix}-inserted`, async () => {
      await tap(openDialog().getByRole('button', { name: 'Insert' }), `${label}: Insert`);
      const t0 = Date.now();
      // The field lists a file once it has been converted; a rejected file never shows up.
      await page.waitForFunction(([sel, want]) => document.querySelectorAll(sel).length >= want,
        [itemSel, itemsBefore + accepted], { timeout: 120000 }).catch(() => {});
      timings[`${label}: Insert -> shown in field`] = Date.now() - t0;
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      // Show the files this pick added: the field top for a first pick, the new items otherwise.
      if (itemsBefore && accepted) await page.locator(itemSel).nth(itemsBefore).evaluate(el => el.scrollIntoView({ block: 'center' }));
      else await field(key).evaluate(el => el.scrollIntoView({ block: 'start' }));
      const paths = await page.locator(itemSel).allInnerTexts();
      const a = await alerts();
      return `field now lists ${paths.length}: ${paths.map(p => p.split('/').pop()).join(', ')}${a.length ? '; alerts: ' + JSON.stringify(a) : ''}`;
    }, { settle: 1500 });
    return accepted;
  }

  async function switchLocale(name, shotName) {
    if (phone) {
      await tap(page.getByRole('combobox', { name: 'Switch Locale' }), `locale: open switcher (${name})`);
      if (shotName) await step(shotName, async () => 'locale dropdown open');
      await tap(page.getByRole('option', { name }), `locale: ${name}`);
    } else {
      await tap(page.locator('#first-pane-header').getByRole('radio', { name }), `locale: ${name} tab`);
    }
    await page.waitForTimeout(600);
  }

  // ---------------------------------------------------------------- sign in
  await page.goto(ADMIN_URL, { waitUntil: 'load' });
  await step('signin', async () => {
    await page.getByRole('button', { name: 'Start Demo' }).waitFor();
    return 'Test backend sign-in screen ("Start Demo" because seed content is linked)';
  });
  await tap(page.getByRole('button', { name: 'Start Demo' }), 'sign in');
  // Shown only by the seeded Test backend; a real backend has no such dialog.
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));

  // ---------------------------------------------------------------- collection list
  await step('collections', async () => {
    await page.getByRole('treeitem', { name: 'Events' }).waitFor();
    return phone ? 'collection list is the start screen' : 'collection list is the left sidebar; Events already open';
  });
  await step('events-empty', async () => {
    await tap(page.getByRole('treeitem', { name: 'Events' }), 'open Events');
    await page.getByRole('button', { name: 'Create New Entry' }).first().waitFor();
  });

  // ---------------------------------------------------------------- new event
  await step('editor-new', async () => {
    await tap(page.getByRole('button', { name: 'Create New Entry' }).first(), 'Create New Entry');
    await field('date').waitFor();
  });
  await step('date-today', async () => {
    await tap(field('date').getByRole('button', { name: 'Today' }), 'date: Today');
    return `Today button -> ${await field('date').locator('input[type=date]').inputValue()}`;
  });
  await step('date-set', async () => {
    // The native date picker cannot be driven or photographed headlessly; fill() sets the
    // value the way the picker would.
    await field('date').locator('input[type=date]').fill('2026-11-07');
    return `input[type=date] filled programmatically -> ${await field('date').locator('input[type=date]').inputValue()}`;
  });
  await step('type-dropdown', async () => {
    await tap(field('type').locator('[role=combobox]'), 'type: open dropdown');
    await page.getByRole('option', { name: 'Corporate' }).waitFor();
    return `focused element: ${await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.tagName)}`;
  });
  await step('type-picked', async () => {
    await tap(page.getByRole('option', { name: 'Corporate' }), 'type: Corporate');
    const client = field('client').locator('input');
    await tap(client, 'client: focus');
    await client.fill('Acme');
    return `type=${await field('type').locator('[role=combobox]').innerText()}, client=${await client.inputValue()}`;
  });

  // ---------------------------------------------------------------- images
  await pickImages('cover', COVER, 'cover', 'cover');
  await pickImages('gallery', GALLERY_PICK_1, 'gallery pick 1', 'gallery');
  await step('gallery-list-end', async () => {
    await field('gallery').getByRole('button', { name: 'Browse' }).evaluate(el => el.scrollIntoView({ block: 'end' }));
    return 'end of the gallery list with the add-more area';
  });
  const heicAccepted = await pickImages('gallery', GALLERY_PICK_2, 'gallery pick 2 (HEIC)', 'gallery-heic');

  // ---------------------------------------------------------------- description x 3 locales
  await step('desc-ru', async () => {
    const t = field('description').locator('textarea');
    await tap(t, 'description: focus (ru)');
    await t.fill('Тестовое мероприятие: корпоративный вечер для Acme.');
    await t.evaluate(el => el.scrollIntoView({ block: 'center' }));
  });
  if (phone) {
    // Rough stand-in for an open on-screen keyboard: the page's viewport meta asks the
    // browser to resize the layout, so shrink the viewport while the textarea has focus.
    await step('desc-ru-keyboard-approx', async () => {
      await page.setViewportSize({ width: 390, height: 360 });
      await field('description').locator('textarea').evaluate(el => el.scrollIntoView({ block: 'center' }));
      return 'viewport shrunk to 390x360 to approximate an open keyboard';
    });
    await page.setViewportSize({ width: 390, height: 664 });
  }
  await switchLocale('Uzbek', phone ? 'locale-switcher-open' : null);
  await step('desc-uz', async () => {
    const t = field('description').locator('textarea');
    await tap(t, 'description: focus (uz)');
    await t.fill('Sinov tadbiri: Acme uchun korporativ kecha.');
    return `fields visible in this locale: ${(await page.locator('.pane:has(#first-pane-header) section[data-key-path]').evaluateAll(els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => e.dataset.keyPath))).join(', ')}`;
  });
  await switchLocale('English');
  await step('desc-en', async () => {
    const t = field('description').locator('textarea');
    await tap(t, 'description: focus (en)');
    await t.fill('Test event: a corporate evening for Acme.');
  });

  // ---------------------------------------------------------------- save
  const tapsToSave = s.log.taps.length + 1;
  await step('event-saved', async () => {
    await tap(page.getByRole('button', { name: 'Save', exact: true }), 'Save');
    const t0 = Date.now();
    await page.waitForURL(u => u.hash === '#/collections/events', { timeout: 30000 });
    await page.getByRole('row').first().waitFor();
    timings['Save -> back in the event list'] = Date.now() - t0;
    return `editor closed, list shows: ${(await page.getByRole('row').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).join(' | ')}`;
  }, { settle: 1500 });
  await step('event-reopened', async () => {
    await tap(page.getByRole('row').first(), 'reopen saved event');
    await page.locator('#first-pane-header').waitFor();
    await page.waitForTimeout(800);
    let note = '';
    if (!(await field('date').count())) {
      // Desktop remembers the pane's last locale; only the translated field exists there.
      note = 'editor reopened on the last-used locale (English), switched back to Russian; ';
      await switchLocale('Russian');
    }
    await field('date').waitFor();
    return `${note}date=${await field('date').locator('input[type=date]').inputValue()}, type=${await field('type').locator('[role=combobox]').innerText()}, ` +
      `gallery items=${await field('gallery').locator('[role=textbox]').count()}`;
  }, { settle: 1500 });

  // ---------------------------------------------------------------- price table
  await step('settings-list', async () => {
    await tap(page.getByRole('button', { name: 'Cancel Editing' }), 'leave editor');
    if (phone) await tap(page.getByRole('button', { name: 'Back to Collection List' }), 'back to collection list');
    await tap(page.getByRole('treeitem', { name: 'Settings' }), 'open Settings');
    await page.getByRole('row', { name: 'Price table' }).waitFor();
  });
  await step('prices-editor', async () => {
    await tap(page.getByRole('row', { name: 'Price table' }), 'open Price table');
    await field('package_standard').waitFor();
    const input = field('package_standard').locator('input');
    return `Standard package=${await input.inputValue()}, inputmode=${await input.getAttribute('inputmode')}, Save disabled=${await page.getByRole('button', { name: 'Save', exact: true }).isDisabled()}`;
  });
  await step('prices-changed', async () => {
    const input = field('package_standard').locator('input');
    await tap(input, 'price: focus');
    await input.fill('2700000');
    return `Standard package=${await input.inputValue()}, Save disabled=${await page.getByRole('button', { name: 'Save', exact: true }).isDisabled()}`;
  });
  await step('prices-saved', async () => {
    await tap(page.getByRole('button', { name: 'Save', exact: true }), 'Save prices');
    await page.waitForURL(u => u.hash === '#/collections/settings', { timeout: 30000 });
  }, { settle: 1200 });

  // ---------------------------------------------------------------- what was stored
  const storedDir = path.join(ROOT, 'stored', profile);
  const stored = await dumpOpfs(page, storedDir);
  const env = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    viewport: `${innerWidth}x${innerHeight}`,
    viewportMeta: document.querySelector('meta[name=viewport]')?.content ?? null,
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    sveltiaScript: document.querySelector('script[src*="sveltia"]')?.src,
  }));
  const overflow = steps.filter(x => x.layout && (x.layout.pageOverflowsX || x.layout.controlsOffscreenX.length || x.layout.horizontalScrollers.length));
  const small = [...new Set(steps.flatMap(x => x.layout?.controlsUnder24px || []))];
  const summary = {
    profile, env, browser: s.browser.version(), timings, heicAccepted,
    tapsFromOpenAdminToSavedEvent: tapsToSave, taps: s.log.taps, steps, stored,
    externalHosts: Object.fromEntries(Object.entries(s.log.externalHosts).map(([h, set]) => [h, [...set]])),
    problems: [...new Set(s.log.problems)],
  };
  fs.mkdirSync(path.join(ROOT, 'work', 'results'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'work', 'results', `${profile}.json`), JSON.stringify(summary, null, 2));

  console.log(`\ntaps from the open admin page to the saved event: ${tapsToSave}`);
  console.log(s.log.taps.slice(0, tapsToSave).map((t, i) => `  ${i + 1}. ${t}`).join('\n'));
  console.log('\nupload timings (ms):', timings);
  console.log('steps with horizontal overflow:', overflow.length ? overflow.map(x => x.step) : 'none');
  console.log('controls smaller than 24 px seen:', small.length ? small : 'none');
  console.log('\nstored files:');
  for (const f of stored) console.log(`  ${String(f.size).padStart(9)}  ${f.path}`);
  printLog(s.log);
  await s.browser.close();
})().catch(e => { console.error('\nDRIVER STOPPED:', e.message.split('\n')[0]); process.exit(1); });
