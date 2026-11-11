// الضغط المطوّل على آية وبطاقتها وكل خيار فيها
import { test, expect } from '@playwright/test';
import { longPress, openApp, stored, word } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('الضغط المطوّل يفتح البطاقة بخياراتها الخمسة ويظلّل الآية', async ({ page }) => {
  await longPress(page, 2);
  const items = page.locator('.vmenu__picker [role="menuitem"]');
  await expect(items).toHaveText(['تفسير', 'معاني', 'عمل', 'ملاحظة', 'علامة']);
  await expect(word(page, 2)).toHaveClass(/w--selected/);
  // النقر خارجها يغلقها
  await page.locator('.vmenu__backdrop').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('الزر الأيمن على آية يفتح بطاقتها، وEsc يغلقها', async ({ page }) => {
  await word(page, 3).click({ button: 'right' });
  await expect(page.locator('.vmenu__picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('تفسير: المختصر ثم الميسّر للآية وحدها', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await expect(card).toContainText('المختصر في تفسير القرآن الكريم');
  await expect(card).toContainText('التفسير الميسّر');
  await expect(card.locator('.vcard__head')).toContainText('الفاتحة: ٢');
  await card.getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('معاني الكلمات والعمل بالآيات (متوفران للفاتحة)', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  const meanings = page.getByRole('dialog', { name: 'معاني الكلمات' });
  await expect(meanings.locator('.study__words tr, .vcard__empty').first()).toBeVisible();
  await meanings.getByRole('button', { name: 'إغلاق' }).click();

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'عمل' }).click();
  const actions = page.getByRole('dialog', { name: 'العمل بالآيات' });
  await expect(actions.locator('.vcard__action, .vcard__empty').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('خارج نطاق المذكرات تظهر رسالة عدم التوفر', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.page', '300'));
  await page.reload();
  const v = await page.locator('.sheet--current .w[data-v]').first().getAttribute('data-v');
  await longPress(page, Number(v));
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  await expect(page.locator('.vcard__empty')).toContainText('غير متوفر');
});

test('ملاحظة: إضافة وتعديل وحذف من البطاقة', async ({ page }) => {
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await page.locator('.vcard__textarea').fill('ملاحظة أولى');
  await page.getByRole('button', { name: 'حفظ' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ 4: 'ملاحظة أولى' });
  await expect(page.locator('.sheet--current .w[data-v="4"] .w__notebook')).toHaveCount(1);

  // تعديل: Esc يحفظ كزر الإغلاق
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await expect(page.locator('.vcard__textarea')).toHaveValue('ملاحظة أولى');
  await page.locator('.vcard__textarea').fill('ملاحظة معدّلة');
  await page.keyboard.press('Escape');
  expect(await stored(page, 'hq.notes')).toEqual({ 4: 'ملاحظة معدّلة' });

  // حذف
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await page.getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(page.locator('.toast')).toHaveText('حُذفت الملاحظة');
  expect(await stored(page, 'hq.notes')).toEqual({});
  await expect(page.locator('.sheet--current .w__notebook')).toHaveCount(0);
});

test('علامة: تُضاف فورًا ثم تُزال من البطاقة نفسها', async ({ page }) => {
  await longPress(page, 5);
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  await expect(page.locator('.toast')).toContainText('أُضيفت علامة: الفاصل الأحمر');
  await expect(page.locator('.sheet--current .w[data-v="5"] .w__ribbon')).toHaveCount(1);
  expect((await stored(page, 'hq.bookmarks')).map((b) => b.v)).toEqual([5]);

  await longPress(page, 5);
  await page.getByRole('menuitem', { name: 'إزالة' }).click();
  await expect(page.locator('.toast')).toHaveText('أُزيلت العلامة عن الآية');
  expect(await stored(page, 'hq.bookmarks')).toEqual([]);
});
