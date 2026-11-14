// القائمة الجانبية اليمنى ولوحة الإعدادات اليسرى، والمظهر (الخلفيات والألوان)، ووضع القراءة
import { test, expect } from '@playwright/test';
import { clickTopbar, isLaptop, openApp, savedPage, shownPages, waitMushaf } from './helpers.js';

const side = (page) => page.locator('.sidemenu');
const settings = (page) => page.locator('.settings');
// الدخول إلى وضع القراءة: سطره في الإعدادات يفتح صفحة شرحه، وزرّها يبدأ الوضع
const startReading = async (page) => {
  await settings(page).getByRole('button', { name: 'وضع القراءة', exact: true }).click();
  await settings(page).getByRole('button', { name: 'ابدأ وضع القراءة' }).click();
};
const bothClosed = async (page) => {
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect(settings(page)).not.toHaveClass(/settings--open/);
};

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '5' });
});

test('القائمة الجانبية من اليمين بتبويباتها، والانتقال إلى سورة', async ({ page }) => {
  await clickTopbar(page, 'القائمة');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  const card = await side(page).locator('.sidemenu__card').boundingBox();
  const vw = page.viewportSize().width;
  expect(card.x + card.width).toBeGreaterThan(vw - 2); // ملتصقة بالحافة اليمنى
  await expect(side(page).getByRole('tab')).toHaveText(['الختمة', 'السور', 'العلامات', 'الملاحظات']);
  await side(page).getByRole('button', { name: /سورة الكهف/ }).click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect.poll(() => shownPages(page)).toContain(293);
});

test('القائمة الجانبية تُغلق بـ✕ وEsc والنقر خارجها', async ({ page }) => {
  for (const how of ['x', 'esc', 'outside']) {
    await clickTopbar(page, 'القائمة');
    await expect(side(page)).toHaveClass(/sidemenu--open/);
    if (how === 'x') await side(page).getByRole('button', { name: 'إغلاق' }).click();
    if (how === 'esc') await page.keyboard.press('Escape');
    if (how === 'outside') await page.mouse.click(10, 400);
    await bothClosed(page);
  }
});

test('لوحة الإعدادات من اليسار، تُغلق بـ✕ وEsc والنقر خارجها والسحب وزر الرجوع', async ({ page }) => {
  for (const how of ['x', 'esc', 'outside', 'drag', 'back']) {
    await clickTopbar(page, 'الإعدادات');
    await expect(settings(page)).toHaveClass(/settings--open/);
    // بعد اكتمال انزلاقها: ملتصقة بالحافة اليسرى
    await expect.poll(async () => Math.round((await settings(page).locator('.settings__card').boundingBox()).x)).toBe(0);
    const card = await settings(page).locator('.settings__card').boundingBox();
    expect(card.width).toBeLessThanOrEqual(380.5);
    if (how === 'x') await settings(page).locator('.settings__page').first().getByRole('button', { name: 'إغلاق' }).click();
    if (how === 'esc') await page.keyboard.press('Escape');
    if (how === 'outside') await page.mouse.click(page.viewportSize().width - 10, 400);
    if (how === 'back') await page.goBack();
    if (how === 'drag') {
      const y = card.y + 300;
      await page.mouse.move(card.width - 20, y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(card.width - 20 - i * 25, y);
      await page.mouse.up();
    }
    await expect(settings(page), how).not.toHaveClass(/settings--open/);
    await expect(page.locator('.reader')).toBeVisible();
  }
});

test('«عن التطبيق» صفحة فرعية: الرجوع وEsc يعودان إلى الإعدادات', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  await settings(page).getByRole('button', { name: 'عن التطبيق' }).click();
  await expect(settings(page).locator('.settings__page--in')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings(page).locator('.settings__page--in')).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
  await settings(page).getByRole('button', { name: 'عن التطبيق' }).click();
  await page.goBack();
  await expect(settings(page).locator('.settings__page--in')).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
  await page.goBack();
  await bothClosed(page);
});

test('«وضع القراءة» في الإعدادات يفتح صفحة شرحه داخل اللوحة، لا الوضع نفسه', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  await settings(page).getByRole('button', { name: 'وضع القراءة', exact: true }).click();
  // صفحة فرعية داخل اللوحة نفسها (لا صفحة كاملة ولا نافذة عائمة)، والوضع لم يبدأ
  const sub = settings(page).locator('.settings__page--in');
  await expect(sub).toBeVisible();
  await expect(sub.getByRole('heading', { name: 'وضع القراءة' })).toBeVisible();
  await expect(sub).toContainText('تنزل صفحات المصحف وحدها');
  await expect(page.locator('.reading')).toHaveCount(0);
  // تستقر بعد انزلاقها فوق اللوحة نفسها، بموضعها وعرضها
  const offset = async () => {
    const card = await settings(page).locator('.settings__card').boundingBox();
    const subBox = await sub.boundingBox();
    return Math.max(Math.abs(subBox.x - card.x), Math.abs(subBox.width - card.width));
  };
  await expect.poll(offset).toBeLessThan(2);

  // سهم الرجوع وEsc وزرّ الرجوع في المتصفح تعود إلى الإعدادات
  await sub.getByRole('button', { name: 'رجوع' }).click();
  await expect(settings(page).locator('.settings__page--in')).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
  await settings(page).getByRole('button', { name: 'وضع القراءة', exact: true }).click();
  await expect(settings(page).locator('.settings__page--in')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings(page).locator('.settings__page--in')).toHaveCount(0);
  await settings(page).getByRole('button', { name: 'وضع القراءة', exact: true }).click();
  await expect(settings(page).locator('.settings__page--in')).toBeVisible();
  await page.goBack();
  await expect(settings(page).locator('.settings__page--in')).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);

  // ✕ يغلق اللوحة كلها
  await settings(page).getByRole('button', { name: 'وضع القراءة', exact: true }).click();
  await settings(page).locator('.settings__page--in').getByRole('button', { name: 'إغلاق' }).click();
  await bothClosed(page);
  await expect(page.locator('.reading')).toHaveCount(0);
});

test('«ابدأ وضع القراءة» يغلق الإعدادات ويبدأ الوضع من الصفحة الحالية، ولا يبقى في السجل', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  await startReading(page);
  await expect(page.locator('.reading')).toBeVisible();
  await bothClosed(page);
  await expect(page.locator('.flow__page[aria-label="الصفحة ٥"]')).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.history.state?.hqSettings ?? null)).toBeNull();
  await page.waitForTimeout(300);
  await expect(settings(page)).not.toHaveClass(/settings--open/);
  await expect(page.locator('.reading')).toBeVisible();
});

test('القائمة والإعدادات لا تُفتحان معًا', async ({ page }) => {
  const openCount = () => page.locator('.sidemenu--open, .settings--open').count();
  await clickTopbar(page, 'الإعدادات');
  expect(await openCount()).toBe(1);
  // النقر حيث زر القائمة (أعلى اليمين) والإعدادات مفتوحة يغلقها ولا يفتح القائمة فوقها
  const vw = page.viewportSize().width;
  await page.mouse.click(vw - 20, 24);
  expect(await openCount()).toBeLessThanOrEqual(1);
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await bothClosed(page);

  await clickTopbar(page, 'القائمة');
  expect(await openCount()).toBe(1);
  await page.mouse.click(20, 24);
  await expect(settings(page)).not.toHaveClass(/settings--open/);
  await page.keyboard.press('Escape');
  await bothClosed(page);

  // تتابع سريع: فتح إحداهما بعد الأخرى يترك واحدة فقط
  await clickTopbar(page, 'الإعدادات');
  await page.keyboard.press('Escape');
  await clickTopbar(page, 'القائمة');
  expect(await openCount()).toBe(1);
  await expect(side(page)).toHaveClass(/sidemenu--open/);
});

const BACKGROUNDS = [
  ['أبيض', 'white', '#FFFFFF', 'light'],
  ['بيج', 'beige', '#F5EDDC', 'light'],
  ['رصاصي', 'gray', '#2B2B2E', 'dark'],
  ['أسود', 'black', '#000000', 'dark'],
];
const ACCENTS = [
  ['أزرق', 'blue'],
  ['أخضر زمردي', 'emerald'],
  ['ذهبي عنبري', 'amber'],
  ['عنّابي', 'maroon'],
  ['بلا لون', 'none'],
];

test('خلفيات القراءة الأربع وألوان التطبيق الأربعة و«بلا لون»، وبقاء الاختيار بعد إعادة الفتح', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  const bgGroup = settings(page).getByRole('radiogroup', { name: 'خلفية القراءة' });
  const accentGroup = settings(page).getByRole('radiogroup', { name: 'لون التطبيق' });
  await expect(bgGroup.getByRole('radio')).toHaveCount(4);
  await expect(accentGroup.getByRole('radio')).toHaveCount(5);
  const root = page.locator('html');

  for (const [name, id, hex, theme] of BACKGROUNDS) {
    await bgGroup.getByRole('radio', { name, exact: true }).click();
    await expect(bgGroup.getByRole('radio', { name, exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(root).toHaveAttribute('data-bg', id);
    await expect(root).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase())).toBe(hex);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe(hex);
  }
  for (const [name, id] of ACCENTS) {
    await accentGroup.getByRole('radio', { name, exact: true }).click();
    await expect(root).toHaveAttribute('data-accent', id);
  }
  // ألوان خط المصحف تتبع الاختيار
  const palette = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent).join('').match(/override-colors: 0 (#[0-9a-fA-F]+)/)?.[1]);
  expect(palette?.toUpperCase()).toBe('#D6D3CC');

  await page.reload();
  await waitMushaf(page);
  await expect(root).toHaveAttribute('data-bg', 'black');
  await expect(root).toHaveAttribute('data-accent', 'none');
  await clickTopbar(page, 'الإعدادات');
  await expect(bgGroup.getByRole('radio', { name: 'أسود' })).toHaveAttribute('aria-checked', 'true');
  await expect(accentGroup.getByRole('radio', { name: 'بلا لون' })).toHaveAttribute('aria-checked', 'true');
});

test('تمييز مقررات الأسابيع يُفعَّل ويُحفظ', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  const sw = settings(page).getByRole('switch', { name: 'تمييز مقررات الأسابيع' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(page.locator('html')).toHaveAttribute('data-weeks', 'on');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-weeks', 'on');
});

test('وضع القراءة: الدخول والإيقاف والخروج على الصفحة الصحيحة', async ({ page }, testInfo) => {
  await clickTopbar(page, 'الإعدادات');
  await startReading(page);
  await expect(page.locator('.reading')).toBeVisible();
  await expect(settings(page)).not.toHaveClass(/settings--open/);
  const bar = page.getByRole('toolbar', { name: 'التحكم في وضع القراءة' });
  await bar.getByRole('button', { name: 'إيقاف التمرير' }).click();
  await expect(bar.getByRole('button', { name: 'استئناف التمرير' })).toBeVisible();
  // الصفحة الأولى في التدفق هي الصفحة التي دخل منها
  await expect(page.locator('.flow__page[aria-label="الصفحة ٥"]')).toBeInViewport();

  // تمرير يدوي إلى الصفحة ١٢ ثم الخروج: يعود المصحف عليها
  await page.evaluate(() => {
    const flow = document.querySelector('.flow');
    const target = document.querySelector('.flow__page[aria-label="الصفحة ٥"]').offsetHeight;
    flow.scrollTop = (12 - 1) * target + target * 0.3;
  });
  await page.waitForTimeout(300);
  await bar.getByRole('button', { name: 'الخروج من وضع القراءة' }).click();
  await expect(page.locator('.reading')).toHaveCount(0);
  await waitMushaf(page);
  expect(await savedPage(page)).toBe(12);
  expect(await shownPages(page)).toContain(12);
  if (isLaptop(testInfo)) expect(await shownPages(page)).toEqual([11, 12]);
});

test('وضع القراءة يتقدم تلقائيًّا ويتوقف بالإيقاف', async ({ page }) => {
  await clickTopbar(page, 'الإعدادات');
  await startReading(page);
  const flow = page.locator('.flow');
  const top = () => flow.evaluate((el) => el.scrollTop);
  const t0 = await top();
  await expect.poll(top, { timeout: 6000 }).toBeGreaterThan(t0 + 1);
  await page.getByRole('button', { name: 'إيقاف التمرير' }).click();
  const t1 = await top();
  await page.waitForTimeout(1200);
  expect(Math.abs((await top()) - t1)).toBeLessThan(1.5);
});

test('قائمة السور: عدد الآيات بصيغته (٧ آيات · ٢٨٦ آية)، وأسماء السور بهمزاتها الصحيحة', async ({ page }) => {
  await clickTopbar(page, 'القائمة');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await side(page).getByRole('tab', { name: 'السور' }).click();
  const meta = side(page).locator('.sidemenu__suraMeta');
  await expect(meta.nth(0)).toHaveText('٧ آيات');
  await expect(meta.nth(1)).toHaveText('٢٨٦ آية');
  await expect(meta.nth(102)).toHaveText('٣ آيات');
  const names = side(page).locator('.sidemenu__suraName');
  await expect(names.nth(13)).toHaveText('سورة إبراهيم');
  await expect(names.nth(75)).toHaveText('سورة الإنسان');
  await expect(names.nth(81)).toHaveText('سورة الانفطار');
  await expect(names.nth(83)).toHaveText('سورة الانشقاق');
});
