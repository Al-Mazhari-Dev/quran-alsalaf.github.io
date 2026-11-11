// البحث، والعلامات المرجعية والملاحظات من القائمة الجانبية: إضافة وتعديل ونقل وحذف
import { test, expect } from '@playwright/test';
import { QURAN, clickTopbar, longPress, openApp, pickVerse, shownPages, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');

test('البحث بنص الآية مع تطبيع الهمزات والتاء المربوطة، والانتقال إلى النتيجة، وسجل البحث', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  const box = page.getByPlaceholder('ابحث بنص الآية أو اسم السورة…');
  await expect(box).toBeFocused();
  // «اصحاب الكهف» بلا همزة، و«والرقيم»
  await box.fill('اصحاب الكهف والرقيم');
  const verse = page.locator('.searchov__verse').first();
  await expect(verse).toContainText('الكهف ٩');
  await verse.click();
  await expect(page.locator('.searchov')).toHaveCount(0);
  await expect.poll(() => shownPages(page)).toContain(294);

  // السجل: البحث الناجح يظهر في الصفحة الفارغة، ويُعاد بضغطة، ويُحذف
  await clickTopbar(page, 'بحث في المصحف');
  const item = page.locator('.searchov__histItem', { hasText: 'اصحاب الكهف والرقيم' });
  await expect(item).toBeVisible();
  await item.click();
  await expect(box).toHaveValue('اصحاب الكهف والرقيم');
  await page.getByRole('button', { name: 'مسح' }).click();
  await page.getByRole('button', { name: 'حذف «اصحاب الكهف والرقيم» من السجل' }).click();
  await expect(page.locator('.searchov__histItem')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.searchov')).toHaveCount(0);
});

test('البحث باسم السورة والتاء المربوطة هاءً', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  await page.getByPlaceholder('ابحث بنص الآية أو اسم السورة…').fill('سوره البقره');
  await expect(page.locator('.searchov__sura')).toContainText(['سورة البقرة']);
  await page.locator('.searchov__sura').first().click();
  await expect.poll(() => shownPages(page)).toContain(2);
  // حرف واحد لا يبحث
  await clickTopbar(page, 'بحث في المصحف');
  await page.getByPlaceholder('ابحث بنص الآية أو اسم السورة…').fill('ا');
  await expect(page.locator('.searchov__verse, .searchov__sura')).toHaveCount(0);
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.searchov')).toHaveCount(0);
});

test('العلامات المرجعية: إضافة، وإعادة تسمية، ونقل، والانتقال، وحذف', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  expect((await stored(page, 'hq.bookmarks')).map((b) => [b.v, b.color])).toEqual([[2, 0], [4, 1]]);

  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  const rows = side(page).locator('.sidemenu__row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('الفاصل الأحمر');

  // إعادة تسمية
  await rows.first().getByRole('button', { name: 'إعادة تسمية العلامة' }).click();
  await rows.first().locator('.sidemenu__input').fill('مراجعة');
  await rows.first().getByRole('button', { name: 'حفظ' }).click();
  await expect(rows.first()).toContainText('مراجعة');
  expect((await stored(page, 'hq.bookmarks'))[0].name).toBe('مراجعة');

  // نقل إلى آية أخرى (الكهف ١٠)
  await rows.first().getByRole('button', { name: 'نقل العلامة إلى آية أخرى' }).click();
  await page.locator('.rpick__sura[data-sura="18"] h3').scrollIntoViewIfNeeded();
  const kahf10 = QURAN.verses.findIndex((x) => x.s === 18 && x.a === 10);
  await pickVerse(page, kahf10);
  expect((await stored(page, 'hq.bookmarks')).find((b) => b.name === 'مراجعة').v).toBe(kahf10);

  // الانتقال: الضغط على العلامة ينقل إلى صفحتها ويغلق القائمة
  await rows.filter({ hasText: 'مراجعة' }).locator('.sidemenu__rowMain').click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect.poll(() => shownPages(page)).toContain(294);
  await expect(page.locator(`.sheet--current .w[data-v="${kahf10}"] .w__ribbon`)).toHaveCount(1);

  // حذف
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  await rows.first().getByRole('button', { name: 'حذف العلامة' }).click();
  await rows.first().getByRole('button', { name: 'حذف العلامة' }).click();
  await expect(side(page).locator('.sidemenu__empty')).toBeVisible();
  expect(await stored(page, 'hq.bookmarks')).toEqual([]);
});

test('العلامات حدّها عشر', async ({ page }) => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, v: 100 + i, color: i, name: `ع${i}` }));
  await openApp(page, { 'hq.page': '1', 'hq.bookmarks': ten });
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  await expect(page.locator('.toast')).toContainText('بلغت العلامات حدّها');
  expect(await stored(page, 'hq.bookmarks')).toHaveLength(10);
});

test('الملاحظات في القائمة الجانبية: تظهر بترتيب المصحف، وتُعدَّل وتُحذف', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.notes': { 5: 'ثانية', 1: 'أولى' } });
  await expect(page.locator('.sheet--current .w__notebook')).toHaveCount(2);
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الملاحظات' }).click();
  const rows = side(page).locator('.sidemenu__row');
  await expect(rows.locator('.sidemenu__rowText')).toHaveText(['أولى', 'ثانية']);

  await rows.first().getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await side(page).locator('.sidemenu__textarea').fill('أولى معدّلة');
  await side(page).getByRole('button', { name: 'حفظ' }).click();
  await expect(rows.first().locator('.sidemenu__rowText')).toHaveText('أولى معدّلة');
  expect(await stored(page, 'hq.notes')).toEqual({ 1: 'أولى معدّلة', 5: 'ثانية' });

  // إلغاء التعديل لا يغيّر شيئًا
  await rows.first().getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await side(page).locator('.sidemenu__textarea').fill('لن تُحفظ');
  await side(page).getByRole('button', { name: 'إلغاء' }).click();
  expect((await stored(page, 'hq.notes'))[1]).toBe('أولى معدّلة');

  await rows.nth(1).getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(rows).toHaveCount(1);
  expect(await stored(page, 'hq.notes')).toEqual({ 1: 'أولى معدّلة' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet--current .w[data-v="5"] .w__notebook')).toHaveCount(0);
  await expect(page.locator('.sheet--current .w[data-v="1"] .w__notebook')).toHaveCount(1);
});
