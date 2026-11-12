// الضغط المطوّل على آية وبطاقتها وكل خيار فيها
import { test, expect } from '@playwright/test';
import { longPress, openApp, stored, word } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('الضغط المطوّل يفتح مربعًا كبيرًا بمربعاته الستة ويظلّل الآية', async ({ page }) => {
  await longPress(page, 2);
  const box = page.getByRole('dialog', { name: 'الفاتحة: ٣' });
  await expect(box.locator('.vbox__head')).toContainText('الفاتحة: ٣');
  const items = box.locator('.vmenu__picker [role="menuitem"]');
  await expect(items).toHaveText(['تشغيل', 'تفسير', 'معاني', 'عمل', 'ملاحظة', 'علامة']);
  // الستة كلها داخل المربع وداخل الشاشة، ثلاثة في كل صف، وكل مربع كبير (٧٢px فأكثر)
  const card = await box.boundingBox();
  const vp = page.viewportSize();
  const rects = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const b of rects) {
    expect(b.left).toBeGreaterThanOrEqual(card.x - 0.5);
    expect(b.right).toBeLessThanOrEqual(card.x + card.width + 0.5);
    expect(b.bottom).toBeLessThanOrEqual(card.y + card.height + 0.5);
    expect(b.height).toBeGreaterThanOrEqual(72);
    expect(b.width).toBeGreaterThanOrEqual(72);
  }
  expect(new Set(rects.map((b) => Math.round(b.top))).size).toBe(2);
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(vp.height);
  // وسط الشاشة أفقيًا
  expect(Math.abs(card.x + card.width / 2 - vp.width / 2)).toBeLessThan(2);
  await expect(word(page, 2)).toHaveClass(/w--selected/);
  // النقر خارجه يغلقه
  await page.locator('.vmenu__backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.vmenu')).toHaveCount(0);
  // وزرّ ✕ يغلقه
  await longPress(page, 2);
  await page.locator('.vbox').getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('تشغيل: الخياران في المربع نفسه، والرجوع وEsc يعيدان المربعات', async ({ page }) => {
  await longPress(page, 3);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  const box = page.locator('.vbox');
  await expect(box.locator('.vbox__head h2')).toHaveText('تشغيل الآية');
  await expect(box.getByRole('button', { name: /تشغيل الآية وحدها/ })).toBeVisible();
  await expect(box.getByRole('button', { name: /بدء التشغيل من هذه الآية/ })).toBeVisible();
  // «وحدها» يُظهر عدد المرات تحته ويطويه
  const only = box.getByRole('button', { name: /تشغيل الآية وحدها/ });
  await only.click();
  await expect(only).toHaveAttribute('aria-expanded', 'true');
  await expect(box.getByRole('group', { name: 'عدد المرات' })).toBeVisible();
  await only.click();
  await expect(box.getByRole('group', { name: 'عدد المرات' })).toHaveCount(0);
  // الرجوع
  await box.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(6);
  // Esc في خيارات التشغيل يرجع إلى المربعات، ثم يغلق
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await expect(page.locator('.w--playing')).toHaveCount(0);
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
