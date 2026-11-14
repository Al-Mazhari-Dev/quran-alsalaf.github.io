// أرباع الأحزاب (٢٠٢٦-١١-١٣): التنبيه عند الوصول إلى صفحة فيها بداية ربع (رسالة بنوعه ووميض علامة ۞
// أو إطار السورة)، وفهرس «السور · الأجزاء · الأرباع» في تبويب السور بالقائمة اليمنى
import { expect, test } from '@playwright/test';
import { QURAN, clickTopbar, isLaptop, openApp, shownPages, waitMushaf } from './helpers.js';

const idx = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
const toast = (page) => page.locator('.toast');
const side = (page) => page.locator('.sidemenu');

// يقلّب إلى الأمام حتى تظهر الصفحة p
async function flipTo(page, p) {
  for (let i = 0; i < 4 && !(await shownPages(page)).includes(p); i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(350);
  }
  expect(await shownPages(page)).toContain(p);
}

test('الوصول إلى صفحة فيها ۞: تتلوّن العلامة الأصلية بلون التطبيق وحولها تظليل صغير وتظهر «بداية ربع الحزب» ثم يزول الوميض', async ({ page }) => {
  await openApp(page, { 'hq.page': '3' });
  await expect(toast(page)).toHaveCount(0);
  const v = idx(2, 26); // ۞ إن الله لا يستحيي — الربع الثاني من الحزب الأول، صفحة ٥
  await flipTo(page, 5);
  await expect(toast(page)).toHaveText('بداية ربع الحزب');
  const rub = page.locator(`.sheet--current .w[data-v="${v}"] .w__rub`);
  await expect(rub).toHaveCount(1);
  await expect(rub).toHaveClass(/w__rub--flash/);
  // العلامة الأصلية نفسها تتلوّن بلوحة ألوان التطبيق، بلا نسخة ثانية منها (٢٠٢٦-١١-١٣)
  expect(await rub.evaluate((el) => getComputedStyle(el).fontPalette)).toBe('--qcf5a');
  expect(await rub.evaluate((el) => [el.childNodes.length, el.textContent.length])).toEqual([1, 1]);
  // العلامة وحدها تتلوّن، لا الكلمة بعدها
  expect(await rub.evaluate((el) => getComputedStyle(el.parentElement).fontPalette)).not.toBe('--qcf5a');
  // التظليل دائرة صغيرة حول العلامة، لا بارتفاع السطر: داخل حدود السطر، وأصغر منه بكثير، ومركزها
  // قريب من مركز العلامة نفسها (يُقاس رسمها بخط الصفحة)
  const geo = await rub.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, '::before');
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const top = r.top + parseFloat(cs.top);
    const size = parseFloat(cs.height);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${fs}px QCF4P5`;
    const m = c.measureText(el.textContent);
    const baseline = r.top + m.fontBoundingBoxAscent;
    const inkMid = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    const line = el.closest('.line').getBoundingClientRect();
    return { size, width: parseFloat(cs.width), lineH: line.height, top, bottom: top + size, lineTop: line.top, lineBottom: line.bottom, offset: Math.abs(top + size / 2 - inkMid), fs };
  });
  expect(geo.size).toBe(geo.width);
  expect(geo.size).toBeLessThan(geo.lineH / 2);
  expect(geo.top).toBeGreaterThanOrEqual(geo.lineTop);
  expect(geo.bottom).toBeLessThanOrEqual(geo.lineBottom);
  expect(geo.offset).toBeLessThan(geo.fs * 0.15);
  // يتلاشى بعد نحو ثلاث ثوانٍ، وتعود العلامة إلى لونها
  await expect(rub).not.toHaveClass(/w__rub--flash/, { timeout: 6000 });
  expect(await rub.evaluate((el) => getComputedStyle(el).fontPalette)).toBe('--qcf5');
});

test('الربع الذي يبدأ بأول سورة: يومض إطار اسمها، والرسالة «بداية نصف الحزب»', async ({ page }) => {
  await openApp(page, { 'hq.page': '75' });
  await flipTo(page, 77); // أول النساء: الربع ٣١ (نصف الحزب ٨)
  await expect(toast(page)).toHaveText('بداية نصف الحزب');
  await expect(page.locator('.sheet--current .line--rubflash')).toHaveAttribute('aria-label', 'سورة النساء');
  await expect(page.locator('.line--rubflash')).toHaveCount(0, { timeout: 6000 });
});

test('بداية الحزب: الرسالة «بداية الحزب»، وصفحة بلا بداية ربع لا تنبيه فيها', async ({ page }, testInfo) => {
  // الحزب ٢ يبدأ بـ«۞ أفتطمعون» (البقرة ٧٥) في صفحة ١١؛ والصفحة ١٠ بلا بداية ربع
  await openApp(page, { 'hq.page': isLaptop(testInfo) ? '9' : '10' });
  await expect(toast(page)).toHaveCount(0);
  await flipTo(page, 11);
  await expect(toast(page)).toHaveText('بداية الحزب');
  await expect(page.locator(`.sheet--current .w[data-v="${idx(2, 75)}"] .w__rub--flash`)).toHaveCount(1);
});

test('إلغاء التنبيه ببداية الربع من الإعدادات: لا رسالة ولا وميض، ويُحفظ، وإعادة تفعيله تعيده', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': isLaptop(testInfo) ? '9' : '10' });
  await clickTopbar(page, 'الإعدادات');
  const sw = () => page.locator('.settings').getByRole('switch', { name: 'التنبيه ببداية الربع' });
  await expect(sw()).toHaveAttribute('aria-checked', 'true');
  await sw().click();
  await expect(sw()).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings')).not.toHaveClass(/settings--open/);

  // الحزب ٢ في صفحة ١١: لا تنبيه
  await flipTo(page, 11);
  await page.waitForTimeout(500);
  await expect(toast(page)).toHaveCount(0);
  await expect(page.locator('.w__rub--flash, .line--rubflash')).toHaveCount(0);

  // يبقى ملغى بعد إعادة الفتح
  await page.reload();
  await waitMushaf(page);
  await clickTopbar(page, 'الإعدادات');
  await expect(sw()).toHaveAttribute('aria-checked', 'false');

  // إعادة تفعيله: لا تنبيه بالصفحة الظاهرة، ثم ينبّه بالوصول إلى ربع جديد (البقرة ٧٥ ← ٩٢ ربع الحزب ٢، صفحة ١٤)
  await sw().click();
  await expect(sw()).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await expect(toast(page)).toHaveCount(0);
  await flipTo(page, 14);
  await expect(toast(page)).toHaveText('بداية ربع الحزب');
});

test('لا تنبيه عند فتح التطبيق على صفحة فيها بداية ربع، ولا عند الرجوع إليها بلا تقليب', async ({ page }) => {
  await openApp(page, { 'hq.page': '5' });
  await page.waitForTimeout(500);
  await expect(toast(page)).toHaveCount(0);
  await expect(page.locator('.w__rub--flash')).toHaveCount(0);
  // والعلامة في مكانها بلونها العادي
  await expect(page.locator(`.sheet--current .w[data-v="${idx(2, 26)}"] .w__rub`)).toHaveCount(1);
});

test('تبويب السور: شريط «السور · الأجزاء · الأرباع» يُفتح على السور، والأجزاء ٣٠ تنقل إلى بدايتها', async ({ page }) => {
  await openApp(page, { 'hq.page': '300' });
  await clickTopbar(page, 'القائمة');
  const index = side(page).locator('.sidemenu__index').getByRole('radio');
  await expect(index).toHaveText(['السور', 'الأجزاء', 'الأرباع']);
  await expect(index.first()).toHaveAttribute('aria-checked', 'true');
  await expect(side(page).locator('.sidemenu__suras > li')).toHaveCount(114);

  await index.nth(1).click();
  const juzs = side(page).locator('.sidemenu__juzs > li');
  await expect(juzs).toHaveCount(30);
  await expect(juzs.nth(1)).toContainText('الجزء الثاني');
  await expect(juzs.nth(1)).toContainText('البقرة ١٤٢');
  await expect(juzs.nth(1)).toContainText('صفحة ٢٢');
  await juzs.nth(1).getByRole('button').click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect.poll(() => shownPages(page)).toContain(22);

  // يعود إلى السور كلما فُتحت القائمة
  await clickTopbar(page, 'القائمة');
  await expect(side(page).locator('.sidemenu__index').getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
});

test('الأرباع: ٢٤٠ ربعا تحت عناوين الأجزاء بأول كلماتها، والضغط ينقل إليه وينبّه', async ({ page }) => {
  await openApp(page, { 'hq.page': '300' });
  await clickTopbar(page, 'القائمة');
  await side(page).locator('.sidemenu__index').getByRole('radio', { name: 'الأرباع' }).click();
  await expect(side(page).locator('.sidemenu__rubs > li')).toHaveCount(240);
  await expect(side(page).locator('.sidemenu__rubJuz')).toHaveCount(30);
  const rows = side(page).locator('.sidemenu__rubs > li');
  await expect(rows.nth(0)).toContainText('الحزب ١');
  await expect(rows.nth(1)).toContainText('ربع الحزب ١');
  await expect(rows.nth(1)).toContainText('إن الله لا يستحيي');
  await expect(rows.nth(2)).toContainText('نصف الحزب ١');
  await expect(rows.nth(3)).toContainText('ثلاثة أرباع الحزب ١');
  await expect(rows.nth(239)).toContainText('ثلاثة أرباع الحزب ٦٠');

  const row = rows.nth(30); // نصف الحزب ٨: أول النساء
  await expect(row).toContainText('نصف الحزب ٨');
  await row.scrollIntoViewIfNeeded();
  await row.getByRole('button').click();
  await expect.poll(() => shownPages(page)).toContain(77);
  await expect(toast(page)).toHaveText('بداية نصف الحزب');
});

test('صفحة الورد: فتحها على صفحة فيها بداية ربع ينبّه به', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-12T10:00:00'));
  await openApp(page, {
    'hq.khatmas': [{ type: 'wird', created: '2026-11-12', mode: 'days', value: 30, from: 1, planStart: '2026-11-12', done: 0, doneBefore: 0, lastDone: null, finished: null }],
  });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الختمة' }).click();
  await side(page).getByRole('button', { name: 'اقرأ الورد' }).click();
  await expect(page.locator('.kpage')).toBeVisible();
  await expect(toast(page)).toHaveText('بداية الحزب');
  await expect(page.locator('.kpage .line--rubflash')).toHaveAttribute('aria-label', 'سورة الفاتحة');
});
