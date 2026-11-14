// العلامات المرجعية بلا حدّ (٢٠٢٦-١١-١٤): اسم ولون من ٤٠ لونًا ونوع (متنقّلة أو متعددة)، وتظليل الآية
// بلون آخر علامة وُضعت عليها، ونافذة «علامة» في مربع الآية، وداخل كل علامة في القائمة الجانبية
import { test, expect } from '@playwright/test';
import { QURAN, clickTopbar, longPress, openApp, shownPages, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');
const RED = '#c0392b';
const BLUE = '#2e7bc4';

// لون تظليل الآية في الصفحة الظاهرة (من كل كلماتها)، أو null إن لم تكن معلّمة
const shadeOf = (page, v) =>
  page.locator(`.sheet--current .w[data-v="${v}"]`).evaluateAll((els) => {
    const marks = els.map((el) => (el.classList.contains('w--mark') ? el.style.getPropertyValue('--mark') : null));
    return marks.every((m) => m === marks[0]) ? marks[0] : 'mixed';
  });

async function openBookmarkWindow(page, v) {
  await longPress(page, v);
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  const box = page.locator('.vbox');
  await expect(box.locator('.vbox__title h2')).toHaveText('علامة');
  return box;
}

test('علامة جديدة من مربع الآية: الاسم والنوع واللون والمعاينة، ثم تُظلَّل الآية بلونها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  const box = await openBookmarkWindow(page, 2);
  await box.getByRole('button', { name: 'علامة جديدة' }).click();

  // الافتراضي: «علامة ١»، متنقّلة، وأول لون أساسي (أحمر)
  await expect(box.getByLabel('اسم العلامة')).toHaveValue('علامة ١');
  await expect(box.getByRole('radio', { name: /متنقّلة/ })).toHaveAttribute('aria-checked', 'true');
  const palette = box.locator('.bmform__palette [role="radio"]');
  await expect(palette).toHaveCount(40);
  await expect(box.getByRole('radio', { name: 'أحمر', exact: true })).toHaveAttribute('aria-checked', 'true');

  await box.getByLabel('اسم العلامة').fill('أخطائي');
  await box.getByRole('radio', { name: /متعددة/ }).click();
  await box.getByRole('radio', { name: 'أزرق', exact: true }).click();
  // المعاينة باللون المختار على خلفية القراءة
  const preview = box.getByTestId('bookmark-preview').locator('span');
  await expect(preview).toHaveAttribute('style', new RegExp(BLUE));
  expect(await preview.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');

  await box.getByRole('button', { name: 'إنشاء ووضعها على الآية' }).click();
  await expect(page.locator('.toast')).toHaveText('وُضعت علامة «أخطائي»');
  await expect(page.locator('.vmenu')).toHaveCount(0);
  const [b] = await stored(page, 'hq.bookmarks');
  expect([b.name, b.color, b.multi, b.verses.map((x) => x.v)]).toEqual(['أخطائي', BLUE, true, [2]]);
  // كلمات الآية كلها مظلَّلة بلونها، ولا شريطة
  await expect.poll(() => shadeOf(page, 2)).toBe(BLUE);
  expect(await page.locator('.sheet--current .w[data-v="2"]').first().evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('.w__ribbon')).toHaveCount(0);

  // المتعددة: تُوضع على آية أخرى من «علاماتك» وتبقى الأولى
  const box2 = await openBookmarkWindow(page, 4);
  const pick = box2.locator('.vmark__pick', { hasText: 'أخطائي' });
  await expect(pick).toContainText('متعددة · آية واحدة');
  await pick.click();
  await expect(page.locator('.toast')).toHaveText('وُضعت علامة «أخطائي»');
  expect((await stored(page, 'hq.bookmarks'))[0].verses.map((x) => x.v)).toEqual([2, 4]);
  await expect.poll(() => shadeOf(page, 4)).toBe(BLUE);
  await expect.poll(() => shadeOf(page, 2)).toBe(BLUE);
  await expect.poll(() => shadeOf(page, 3)).toBe(null);
});

test('المتنقّلة: وضعها على آية أخرى ينقلها إليها ويزيلها من الأولى', async ({ page }) => {
  await openApp(page, {
    'hq.page': '1',
    'hq.bookmarks': [{ id: 1, name: 'وصلت هنا', color: RED, multi: false, verses: [{ v: 1, at: 1 }] }],
  });
  await expect.poll(() => shadeOf(page, 1)).toBe(RED);
  const box = await openBookmarkWindow(page, 5);
  await box.locator('.vmark__pick', { hasText: 'وصلت هنا' }).click();
  await expect(page.locator('.toast')).toHaveText('نُقلت علامة «وصلت هنا» إلى هذه الآية');
  expect((await stored(page, 'hq.bookmarks'))[0].verses.map((x) => x.v)).toEqual([5]);
  await expect.poll(() => shadeOf(page, 5)).toBe(RED);
  await expect.poll(() => shadeOf(page, 1)).toBe(null);
});

test('علامتان على آية واحدة: لون الأحدث، وبإزالتها من النافذة يعود لون الأخرى', async ({ page }) => {
  await openApp(page, {
    'hq.page': '1',
    'hq.bookmarks': [
      { id: 1, name: 'أخطائي', color: RED, multi: true, verses: [{ v: 3, at: 1 }] },
      { id: 2, name: 'وصلت هنا', color: BLUE, multi: false, verses: [{ v: 3, at: 2 }] },
    ],
  });
  await expect.poll(() => shadeOf(page, 3)).toBe(BLUE);
  const box = await openBookmarkWindow(page, 3);
  const here = box.getByRole('region', { name: 'على هذه الآية' });
  await expect(here.locator('.vmark__name')).toHaveText(['وصلت هنامتنقّلة', 'أخطائيمتعددة']);
  await here.getByRole('button', { name: 'إزالة «وصلت هنا» عن الآية' }).click();
  await expect(page.locator('.toast')).toHaveText('أُزيلت علامة «وصلت هنا» عن الآية');
  await expect(here.locator('.vmark__name')).toHaveText(['أخطائيمتعددة']);
  // «وصلت هنا» صارت في «علاماتك الأخرى» بلا آيات
  await expect(box.locator('.vmark__pick', { hasText: 'وصلت هنا' })).toContainText('متنقّلة · بلا آيات');
  await expect.poll(() => shadeOf(page, 3)).toBe(RED);
});

test('بلا حدّ: تُنشأ علامة بعد عشرين علامة', async ({ page }) => {
  const twenty = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `ع${i}`, color: RED, multi: false, verses: [{ v: 100 + i, at: i + 1 }] }));
  await openApp(page, { 'hq.page': '1', 'hq.bookmarks': twenty });
  const box = await openBookmarkWindow(page, 1);
  await expect(box.locator('.vmark__pick')).toHaveCount(20);
  await box.getByRole('button', { name: 'علامة جديدة' }).click();
  await expect(box.getByLabel('اسم العلامة')).toHaveValue('علامة ٢١');
  await box.getByRole('button', { name: 'إنشاء ووضعها على الآية' }).click();
  await expect(page.locator('.toast')).toHaveText('وُضعت علامة «علامة ٢١»');
  expect(await stored(page, 'hq.bookmarks')).toHaveLength(21);
});

test('الآية المضغوط عليها: تمييز الضغط فوق تظليل العلامة، ويعود لونها بعد الإغلاق', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.bookmarks': [{ id: 1, name: 'أ', color: RED, multi: false, verses: [{ v: 2, at: 1 }] }] });
  const bg = () => page.locator('.sheet--current .w[data-v="2"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const marked = await bg();
  await longPress(page, 2);
  await expect.poll(bg).not.toBe(marked);
  await page.getByRole('button', { name: 'إغلاق' }).click();
  await expect.poll(bg).toBe(marked);
});

test('داخل العلامة في القائمة الجانبية: آياتها بترتيب المصحف، والانتقال، والإزالة، والإعدادات، والحذف', async ({ page }) => {
  const kahf10 = QURAN.verses.findIndex((x) => x.s === 18 && x.a === 10);
  await openApp(page, {
    'hq.page': '1',
    'hq.bookmarks': [
      { id: 1, name: 'أخطائي', color: RED, multi: true, verses: [{ v: kahf10, at: 1 }, { v: 4, at: 2 }, { v: 2, at: 3 }] },
      { id: 2, name: 'وصلت هنا', color: BLUE, multi: false, verses: [{ v: 6, at: 4 }] },
    ],
  });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  const rows = side(page).locator('.sidemenu__row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('أخطائي');
  await expect(rows.first()).toContainText('متعددة · ٣ آيات');
  await expect(rows.nth(1)).toContainText('متنقّلة · الفاتحة ٧');

  // الدخول في العلامة: آياتها بترتيب المصحف
  await rows.first().locator('.sidemenu__rowMain').click();
  await expect(side(page).locator('.bmdetail__name')).toContainText('أخطائي');
  await expect(rows.locator('.sidemenu__rowLabel')).toHaveText(['الفاتحة ٣', 'الفاتحة ٥', 'الكهف ١٠']);

  // إزالة آية من العلامة
  await rows.nth(1).getByRole('button', { name: 'إزالة الفاتحة ٥ من العلامة' }).click();
  await expect(rows.locator('.sidemenu__rowLabel')).toHaveText(['الفاتحة ٣', 'الكهف ١٠']);
  expect((await stored(page, 'hq.bookmarks'))[0].verses.map((x) => x.v)).toEqual([kahf10, 2]);

  // الإعدادات: الاسم واللون
  await side(page).getByRole('button', { name: 'إعدادات العلامة' }).click();
  const settings = side(page).getByRole('region', { name: 'إعدادات العلامة' });
  await settings.getByLabel('اسم العلامة').fill('مراجعة');
  await settings.getByRole('radio', { name: 'أخضر غامق' }).click();
  await settings.getByRole('button', { name: 'حفظ' }).click();
  await expect(settings).toHaveCount(0);
  let [b] = await stored(page, 'hq.bookmarks');
  expect([b.name, b.color]).toEqual(['مراجعة', '#1e5e1e']);
  await expect(side(page).locator('.bmdetail__name')).toContainText('مراجعة');

  // المتعددة إلى متنقّلة: تأكيد، ثم تبقى آخر آية وُضعت (الفاتحة ٣)
  await side(page).getByRole('button', { name: 'إعدادات العلامة' }).click();
  await settings.getByRole('radio', { name: /متنقّلة/ }).click();
  await settings.getByRole('button', { name: 'حفظ' }).click();
  await expect(settings.getByRole('alert')).toContainText('اضغط «حفظ» مرة أخرى للتأكيد');
  expect((await stored(page, 'hq.bookmarks'))[0].multi).toBe(true);
  await settings.getByRole('button', { name: 'حفظ' }).click();
  [b] = await stored(page, 'hq.bookmarks');
  expect([b.multi, b.verses.map((x) => x.v)]).toEqual([false, [2]]);
  await expect(rows.locator('.sidemenu__rowLabel')).toHaveText(['الفاتحة ٣']);

  // الانتقال: الضغط على الآية ينقل إلى صفحتها ويغلق القائمة
  await side(page).getByRole('button', { name: 'رجوع إلى العلامات' }).click();
  await rows.nth(1).locator('.sidemenu__rowMain').click();
  await expect(rows.locator('.sidemenu__rowLabel')).toHaveText(['الفاتحة ٧']);
  await side(page).getByRole('button', { name: 'رجوع إلى العلامات' }).click();
  await rows.first().locator('.sidemenu__rowMain').click();
  await side(page).getByRole('button', { name: 'إعدادات العلامة' }).click();
  // الحذف بتأكيد
  await settings.getByRole('button', { name: 'حذف العلامة' }).click();
  await expect(settings).toContainText('حذف العلامة وكل آياتها؟');
  await settings.getByRole('button', { name: 'نعم، احذفها' }).click();
  await expect(rows).toHaveCount(1);
  expect((await stored(page, 'hq.bookmarks')).map((x) => x.name)).toEqual(['وصلت هنا']);

  // الانتقال إلى آية من داخل العلامة
  await rows.first().locator('.sidemenu__rowMain').click();
  await rows.first().locator('.sidemenu__rowMain').click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect.poll(() => shownPages(page)).toContain(1);
});

test('الانتقال من داخل العلامة إلى آية في صفحة أخرى', async ({ page }) => {
  const kahf10 = QURAN.verses.findIndex((x) => x.s === 18 && x.a === 10);
  await openApp(page, { 'hq.page': '1', 'hq.bookmarks': [{ id: 1, name: 'مراجعة', color: RED, multi: true, verses: [{ v: kahf10, at: 1 }] }] });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  await side(page).locator('.sidemenu__rowMain').click();
  await side(page).locator('.sidemenu__rowMain', { hasText: 'الكهف ١٠' }).click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect.poll(() => shownPages(page)).toContain(294);
  await expect.poll(() => shadeOf(page, kahf10)).toBe(RED);
});

test('العلامات القديمة تبقى بعد التحديث: متنقّلة باسمها ولونها وآيتها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.bookmarks': [{ id: 7, v: 2, color: 3, name: 'الفاصل الأزرق' }] });
  await expect.poll(() => shadeOf(page, 2)).toBe(BLUE);
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  await expect(side(page).locator('.sidemenu__row')).toContainText('الفاصل الأزرق');
  await expect(side(page).locator('.sidemenu__row')).toContainText('متنقّلة · الفاتحة ٣');
});

test('لا علامات: رسالة القائمة الجانبية، ونافذة «علامة» فيها «علامة جديدة» وحدها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  const box = await openBookmarkWindow(page, 1);
  await expect(box.getByRole('button', { name: 'علامة جديدة' })).toBeVisible();
  await expect(box.locator('.vmark__group')).toHaveCount(0);
  // الرجوع إلى المربعات
  await box.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.vmenu__picker')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق' }).click();
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  await expect(side(page).locator('.sidemenu__empty')).toBeVisible();
});
