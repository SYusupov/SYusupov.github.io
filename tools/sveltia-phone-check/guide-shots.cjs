// Screenshots for the admin guide: the Russian admin interface on a phone, with the in-browser test
// repository. Usage (admin built with CMS_BACKEND=test and served):
//   UI_LOCALE=ru-RU GUIDE_OUT=<folder> node tools/sveltia-phone-check/guide-shots.cjs
const fs = require('fs');
const path = require('path');
const { ADMIN_URL, TEST_FILES, launch, controls } = require('./lib.cjs');

const out = process.env.GUIDE_OUT || path.join(process.cwd(), 'admin-guide-shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { browser, page, tap } = await launch('phone');
  const field = (key) => page.locator(`section[data-key-path="${key}"]`).first();
  const dialog = () => page.locator('dialog[open]').last();
  const items = (key) => page.locator(`section[data-key-path="${key}"] [role=textbox]`);
  let n = 0;
  const shot = async (name, settle = 700) => {
    await page.waitForTimeout(settle);
    const file = path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  };
  const pick = async (key, files) => {
    const before = await items(key).count();
    await field(key).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await tap(field(key).getByRole('button', { name: /^(Browse|Обзор)$/ }), `${key}: browse`);
    await dialog().waitFor();
    const upload = dialog().getByRole('button', { name: /Upload|Загрузить/ }).first();
    await upload.waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap(upload, `${key}: upload`)]);
    await chooser.setFiles(files.map((file) => path.join(TEST_FILES, file)));
    await page.waitForTimeout(2500);
    const insert = dialog().getByRole('button', { name: /^(Insert|Вставить|Выбрать)$/ }).first();
    if (!(await insert.count())) console.log((await controls(page, 'dialog[open]')).join('\n'));
    await tap(insert, `${key}: insert`);
    await page
      .waitForFunction(([sel, want]) => document.querySelectorAll(sel).length >= want, [`section[data-key-path="${key}"] [role=textbox]`, before + files.length], { timeout: 120000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
  };

  await page.goto(ADMIN_URL, { waitUntil: 'load' });
  await tap(page.getByRole('button', { name: /test|тестов/i }).first(), 'enter');
  await page.getByRole('treeitem', { name: /Мероприятия/ }).waitFor({ timeout: 30000 });
  await shot('sections');

  await tap(page.getByRole('treeitem', { name: /Мероприятия/ }), 'events');
  await shot('events-empty');
  await tap(page.getByRole('button', { name: /Create New Entry|Создать/ }).first(), 'create');
  await field('date').waitFor();
  await field('date').locator('input[type=date]').fill('2025-12-14');
  await tap(field('type').locator('[role=combobox]'), 'type');
  await shot('event-type-list');
  await tap(page.getByRole('option', { name: 'Корпоратив' }), 'corporate');
  await field('client').locator('input').fill('Coca-Cola');
  await shot('event-top');
  await pick('cover', ['normal-1p6mb.jpg']);
  await shot('event-cover');
  await pick('gallery', ['gallery-01.jpg', 'gallery-02.jpg', 'gallery-03.jpg']);
  await shot('event-photos');
  await pick('videos', ['clip-6s.mp4']);
  await shot('event-video');
  await tap(page.getByRole('button', { name: /^(Save|Сохранить)$/ }), 'save');
  await page.waitForURL((url) => url.hash.startsWith('#/collections/events'), { timeout: 60000 });
  await shot('event-saved', 1500);

  await tap(page.getByRole('button', { name: /Back|Назад|Вернуться/ }).first(), 'back').catch(() => {});
  await page.goto(`${ADMIN_URL}#/collections/promotions/new`);
  await field('title').waitFor({ timeout: 30000 });
  await field('title.ru').locator('input').fill('Новогодняя акция');
  await field('text.ru').locator('textarea').fill('Клубника в подарок к тарифу Maxima.');
  await field('start').locator('input[type=date]').fill('2025-12-01');
  await field('end').locator('input[type=date]').fill('2025-12-31');
  await shot('promotion');
  await field('end').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('promotion-dates');

  // The test repository starts empty: fill in the real values so the pictures match what the admin sees.
  const content = path.join(__dirname, '..', '..', 'src', 'content', 'settings');
  const prices = JSON.parse(fs.readFileSync(path.join(content, 'prices.json'), 'utf8'));
  const site = JSON.parse(fs.readFileSync(path.join(content, 'site.json'), 'utf8'));
  // A fresh visit, so the unsaved promotion cannot hold the page with a «leave?» question.
  const openSingleton = async (label) => {
    await page.goto('about:blank');
    await page.goto(ADMIN_URL, { waitUntil: 'load' });
    const enter = page.getByRole('button', { name: /test|тестов/i }).first();
    if (await enter.isVisible().catch(() => false)) await tap(enter, 'enter');
    await tap(page.getByRole('treeitem', { name: label }), label);
  };
  await openSingleton('Цены');
  await field('small.light').waitFor({ timeout: 30000 });
  for (const [size, tariffs] of Object.entries(prices)) {
    for (const [tariff, value] of Object.entries(tariffs)) {
      const input = field(`${size}.${tariff}`).locator('input').first();
      await input.scrollIntoViewIfNeeded();
      await input.fill(String(value), { timeout: 10000 }).catch((error) => {
        throw new Error(`${size}.${tariff}: ${error.message.split('\n').slice(0, 6).join(' | ')}`);
      });
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('prices', 1000);
  await openSingleton('Контакты и цифры');
  await field('telegram').waitFor({ timeout: 30000 });
  await field('telegram').locator('input').fill(site.telegram);
  await field('phone').locator('input').fill(site.phone);
  await field('contactName.ru').locator('input').fill(site.contactName.ru);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('contacts', 1000);
  await browser.close();
})().catch((error) => {
  console.error('STOPPED:', error.message.split('\n')[0]);
  process.exit(1);
});
