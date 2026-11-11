// فتح التطبيق والمصحف، واستعادة آخر صفحة، والتقليب واتجاهه، وعرض الصفحة والصفحتين
import { test, expect } from '@playwright/test';
import { drag, isLaptop, openApp, savedPage, shownPages, waitMushaf } from './helpers.js';

test('يفتح التطبيق ويظهر المصحف بخطه وترويسته', async ({ page }) => {
  await openApp(page);
  await expect(page).toHaveTitle('تطبيق قرآن السلف');
  const sheet = page.locator('.sheet--current').first();
  await expect(sheet.locator('.sheet__meta')).toContainText('الجزء');
  // الفاتحة: سبع آيات كلماتها حاملة أرقامها
  await expect(page.locator('.sheet--current .w[data-v="0"]').first()).toBeVisible();
  expect(await savedPage(page)).toBe(1);
});

test('يستعيد آخر صفحة بعد إعادة الفتح', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '77' });
  expect(await shownPages(page)).toEqual(isLaptop(testInfo) ? [77, 78] : [77]);
  await page.keyboard.press('ArrowLeft');
  const expected = isLaptop(testInfo) ? 79 : 78;
  await expect.poll(() => savedPage(page)).toBe(expected);
  await page.reload();
  await waitMushaf(page);
  expect(await savedPage(page)).toBe(expected);
  expect((await shownPages(page))[0]).toBe(expected);
});

test('عرض الصفحتين في اللابتوب وصفحة واحدة في الجوال', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '10' });
  if (isLaptop(testInfo)) {
    await expect(page.locator('.app--spread')).toHaveCount(1);
    // الفردية يمينًا والزوجية يسارًا
    expect(await shownPages(page)).toEqual([9, 10]);
    const [right, left] = await page.locator('.sheet--current').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    expect(right).toBeGreaterThan(left);
    // أيقونة اليمنى/اليسرى لنسخة الجوال وحدها
    await expect(page.locator('.sheet--current .page-side')).toHaveCount(0);
  } else {
    await expect(page.locator('.app--spread')).toHaveCount(0);
    expect(await shownPages(page)).toEqual([10]);
    await expect(page.locator('.sheet--current .page-side')).toHaveAttribute('aria-label', 'الصفحة اليسرى');
  }
});

test('التحول بين الصفحة والصفحتين عند تغيير المقاس على الموضع نفسه', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '20' });
  const original = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.app--spread')).toHaveCount(1);
  expect(await shownPages(page)).toEqual([19, 20]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app--spread')).toHaveCount(0);
  expect(await shownPages(page)).toEqual([20]);
  // ارتفاع قصير لا يتسع للصفحتين: صفحة واحدة ولو اتسع العرض
  await page.setViewportSize({ width: 1440, height: 520 });
  await expect(page.locator('.app--spread')).toHaveCount(0);
  await page.setViewportSize(original);
  await expect(page.locator('.app--spread')).toHaveCount(isLaptop(testInfo) ? 1 : 0);
  expect(await savedPage(page)).toBe(20);
});

test('التقليب بالمفاتيح: اليسار والمسافة وPageDown للتالية، واليمين وShift+المسافة وPageUp للسابقة', async ({ page }, testInfo) => {
  const step = isLaptop(testInfo) ? 2 : 1;
  await openApp(page, { 'hq.page': '101' });
  const start = (await shownPages(page))[0];
  const keys = [
    ['ArrowLeft', 1],
    ['Space', 1],
    ['PageDown', 1],
    ['ArrowRight', -1],
    ['Shift+Space', -1],
    ['PageUp', -1],
  ];
  let expected = start;
  for (const [key, dir] of keys) {
    await page.keyboard.press(key);
    expected += dir * step;
    await expect.poll(async () => (await shownPages(page))[0], { message: key }).toBe(expected);
  }
});

test('التقليب بالسحب: السحب نحو اليمين يأتي بالتالية (التالية على اليسار)', async ({ page }, testInfo) => {
  const step = isLaptop(testInfo) ? 2 : 1;
  await openApp(page, { 'hq.page': '201' });
  const start = (await shownPages(page))[0];
  await drag(page, 220);
  await expect.poll(async () => (await shownPages(page))[0]).toBe(start + step);
  await drag(page, -220);
  await expect.poll(async () => (await shownPages(page))[0]).toBe(start);
  // سحبة قصيرة بطيئة لا تقلب
  await drag(page, 30);
  await page.waitForTimeout(400);
  expect((await shownPages(page))[0]).toBe(start);
});

test('الصفحة التالية تُرسم على يسار الحالية أثناء السحب', async ({ page }) => {
  await openApp(page, { 'hq.page': '300' });
  const xs = await page.locator('.reader__track > *').evaluateAll((els) =>
    els.map((e) => ({ label: e.getAttribute('aria-label') ?? e.querySelector('.sheet').getAttribute('aria-label'), x: e.getBoundingClientRect().x }))
  );
  // الشريط: التالية ثم الحالية ثم السابقة، والتالية أبعدها يسارًا
  expect(xs[0].x).toBeLessThan(xs[1].x);
  expect(xs[1].x).toBeLessThan(xs[2].x);
});

test('لا تقليب قبل أول المصحف ولا بعد آخره', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect(await savedPage(page)).toBe(1);
  await page.evaluate(() => localStorage.setItem('hq.page', '604'));
  await page.reload();
  await waitMushaf(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  expect(await savedPage(page)).toBe(604);
});

test('سهما التقليب في اللابتوب يظهران بتحريك الفأرة، والأيسر للتالية', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '51' });
  if (!isLaptop(testInfo)) {
    await expect(page.locator('.reader__arrow')).toHaveCount(0);
    return;
  }
  await expect(page.locator('.reader__arrow--shown')).toHaveCount(0);
  await page.mouse.move(700, 450);
  await page.mouse.move(720, 460);
  const next = page.getByRole('button', { name: 'الصفحة التالية' });
  await expect(next).toHaveClass(/reader__arrow--shown/);
  const nextBox = await next.boundingBox();
  const prevBox = await page.getByRole('button', { name: 'الصفحة السابقة' }).boundingBox();
  expect(nextBox.x).toBeLessThan(prevBox.x);
  await next.click();
  await expect.poll(() => shownPages(page)).toEqual([53, 54]);
  await page.getByRole('button', { name: 'الصفحة السابقة' }).click();
  await expect.poll(() => shownPages(page)).toEqual([51, 52]);
});

test('الأزرار العائمة مخفية أصلًا وتظهر بلمسة وتختفي بأخرى', async ({ page }, testInfo) => {
  test.skip(isLaptop(testInfo), 'اللمس للجوال');
  await openApp(page, { 'hq.page': '60' });
  await expect(page.locator('.dock')).not.toHaveClass(/dock--open/);
  await page.tap('.reader', { position: { x: 195, y: 400 } });
  await expect(page.locator('.dock')).toHaveClass(/dock--open/);
  await expect(page.locator('.topbar')).toHaveClass(/topbar--open/);
  await page.waitForTimeout(400);
  await page.tap('.reader', { position: { x: 195, y: 400 } });
  await expect(page.locator('.dock')).not.toHaveClass(/dock--open/);
});
