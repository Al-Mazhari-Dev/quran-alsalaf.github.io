// صفحات المحتوى: الفتح والإغلاق بكل الطرق، والتبويبات، ومقدارها وإخفاته، واستقلاله عن مقدار الاستماع
import { test, expect } from '@playwright/test';
import { clickDock, isLaptop, openApp, pickVerse, stored, word } from './helpers.js';

const study = (page) => page.locator('section.study');
const open = async (page) => {
  await clickDock(page, 'صفحات المحتوى');
  await expect(study(page)).toHaveClass(/study--open/);
};
const closed = (page) => expect(study(page)).not.toHaveClass(/study--open/);

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('لوحة متمركزة في اللابتوب وصفحة كاملة في الجوال', async ({ page }, testInfo) => {
  await open(page);
  // بعد اكتمال انزلاقها
  await expect.poll(async () => Math.round((await study(page).boundingBox()).x)).toBe(isLaptop(testInfo) ? 340 : 0);
  const box = await study(page).boundingBox();
  if (isLaptop(testInfo)) {
    await expect(study(page)).toHaveClass(/study--panel/);
    expect(box.width).toBeLessThanOrEqual(760);
    await expect(page.getByRole('button', { name: 'إغلاق' }).and(page.locator('.study__close'))).toBeVisible();
  } else {
    expect(box.width).toBe(390);
    await expect(page.locator('.study__back')).toBeVisible();
  }
});

test('الإغلاق بالزر (رجوع أو ✕)', async ({ page }, testInfo) => {
  await open(page);
  await page.locator(isLaptop(testInfo) ? '.study__close' : '.study__back').click();
  await closed(page);
});

test('الإغلاق بزر الرجوع في المتصفح (زر الرجوع في أندرويد)', async ({ page }) => {
  await open(page);
  await page.goBack();
  await closed(page);
  // والرجوع لا يخرج من التطبيق
  await expect(page.locator('.reader')).toBeVisible();
});

test('الإغلاق بـEsc', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await closed(page);
});

test('الإغلاق بالنقر خارجها (اللابتوب)', async ({ page }, testInfo) => {
  test.skip(!isLaptop(testInfo), 'في الجوال صفحة كاملة لا خارج لها');
  await open(page);
  await page.mouse.click(40, 450);
  await closed(page);
});

test('التبديل بين التبويبات الثلاثة ومصدري التفسير', async ({ page }) => {
  await open(page);
  const tabs = study(page).getByRole('tab');
  await expect(tabs).toHaveText(['تفسير', 'معاني الكلمات', 'العمل بالآيات']);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(study(page).locator('.study__item').first()).toBeVisible();
  await expect(study(page).getByText('من مقاصد السورة').first()).toBeVisible();

  await study(page).getByRole('radio', { name: 'الميسّر' }).click();
  await expect(study(page).getByRole('radio', { name: 'الميسّر' })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('hq.tafsir'))).toBe('muyassar');

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
});

test('بلا مقدار: المحتوى لآيات الصفحة أو الصفحتين الظاهرتين', async ({ page }, testInfo) => {
  await open(page);
  // الصفحة ١ سبع آيات (الفاتحة)، والصفحتان ١–٢ اثنتا عشرة
  await expect(study(page).locator('.study__item')).toHaveCount(isLaptop(testInfo) ? 12 : 7);
});

test('تحديد مقدار صفحات المحتوى يُخفت ما خارجه، وإلغاؤه يزيل الإخفات', async ({ page }) => {
  await open(page);
  const bar = study(page).locator('.rbar');
  await bar.getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, 1);
  await bar.getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, 3);
  expect(await stored(page, 'hq.contentRange')).toEqual([1, 3]);
  await expect(study(page).locator('.study__item')).toHaveCount(3);

  await page.keyboard.press('Escape');
  await expect(word(page, 0)).toHaveClass(/w--out/);
  await expect(word(page, 4)).toHaveClass(/w--out/);
  await expect(word(page, 2)).not.toHaveClass(/w--out/);
  const dim = await word(page, 0).evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(dim)).toBeLessThan(1);

  // يبقى بعد إعادة الفتح
  await page.reload();
  await expect(word(page, 0)).toHaveClass(/w--out/);

  await open(page);
  await study(page).getByRole('button', { name: 'إلغاء المقدار' }).click();
  expect(await stored(page, 'hq.contentRange')).toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet--current .w--out')).toHaveCount(0);
});

test('مقدار الاستماع مستقل عن مقدار صفحات المحتوى ولا يُخفت شيئًا', async ({ page }) => {
  // مقدار الاستماع
  await clickDock(page, 'الاستماع للآيات');
  const listen = page.getByRole('dialog', { name: 'الاستماع للآيات' });
  await listen.getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, 2);
  await listen.getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, 5);
  expect(await stored(page, 'hq.range')).toEqual([2, 5]);
  await expect(listen.locator('.listen__head span')).toContainText('الفاتحة');
  await listen.getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.locator('.sheet--current .w--out')).toHaveCount(0);

  // مقدار صفحات المحتوى لا يتأثر به، ولا العكس
  await open(page);
  await expect(study(page).locator('.rbar')).toContainText('اختر الآية');
  await study(page).locator('.rbar').getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, 0);
  await study(page).locator('.rbar').getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, 1);
  expect(await stored(page, 'hq.contentRange')).toEqual([0, 1]);
  expect(await stored(page, 'hq.range')).toEqual([2, 5]);
  await study(page).getByRole('button', { name: 'إلغاء المقدار' }).click();
  expect(await stored(page, 'hq.range')).toEqual([2, 5]);
});

test('نهاية المقدار قبل بدايته تُقلب، ولا تُفتح النهاية قبل البداية', async ({ page }) => {
  await open(page);
  const bar = study(page).locator('.rbar');
  await expect(bar.getByRole('button', { name: /النهاية/ })).toBeDisabled();
  await bar.getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, 4);
  await bar.getByRole('button', { name: /النهاية/ }).click();
  // منتقي النهاية لا يعرض ما قبل البداية
  await expect(page.locator('.rpick__verse').first().locator('.rpick__num')).toHaveText('٥');
  await page.getByRole('dialog', { name: 'اختر آية النهاية' }).getByRole('button', { name: 'إغلاق' }).click();
  expect(await stored(page, 'hq.contentRange')).toEqual([4]);
});
