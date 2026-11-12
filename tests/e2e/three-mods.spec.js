// تعديلات ٢٠٢٦-١١-١٢:
// ١. مقدار استماع ببداية بلا نهاية: يبدأ من آيته (وينتقل المصحف إليها) ويكمل متتابعًا عبر الصفحات إلى آخر
//    المصحف، و«تكرار المقدار» معطّل وتكرار الآية يعمل، والنافذة تبيّن «من … إلى آخر المصحف».
// ٢. «بلا لون» بدل «موف»: اللون الثانوي لون نص المصحف لكل خلفية، ودائرته نصفان، ومن كان على «موف» ينتقل إليه.
// ٣. ✕ داخل زر «صفحات المحتوى» يلغي مقدارها دون فتحها، وباقي الزر يفتحها.
import { test, expect } from '@playwright/test';
import { QURAN, clickDock, clickTopbar, isLaptop, openApp, pageVerses, pickVerse, shownPages, showChrome, stored, word } from './helpers.js';

const at = (s, a) => QURAN.verses.findIndex((x) => x.s === s && x.a === a);
const pageOf = (v) => QURAN.verses[v].p;
const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });
const study = (page) => page.locator('section.study');
const end = (page) => page.evaluate(() => window.__audio.end());
const expectedShown = (p, laptop) => (laptop ? [p % 2 ? p : p - 1, p % 2 ? p + 1 : p] : [p]);

test.describe('مقدار استماع ببداية فقط', () => {
  test('يبدأ من آية البداية، وينتقل المصحف إليها، ويكمل عبر الصفحات بلا توقف', async ({ page }, testInfo) => {
    const laptop = isLaptop(testInfo);
    await openApp(page, { 'hq.page': '1' });
    // البقرة ٥٠ ليست أول صفحتها: يُتحقق أنه يبدأ منها لا من أول الصفحة
    const start = at(2, 50);
    const p = pageOf(start);
    expect(pageVerses(p)[0]).not.toBe(start);

    await clickDock(page, 'الاستماع للآيات');
    await listen(page).getByRole('button', { name: /البداية/ }).click();
    await pickVerse(page, start);
    expect(await stored(page, 'hq.range')).toEqual([start]);
    await expect(listen(page).locator('.listen__head span')).toHaveText('من البقرة ٥٠ إلى آخر المصحف');
    // تكرار المقدار معطّل (لا نهاية)، وتكرار الآية يعمل
    await expect(listen(page).locator('select').nth(1)).toBeDisabled();
    await expect(listen(page).locator('select').nth(0)).toBeEnabled();
    // تحديد البداية وحده لا يحرّك المصحف
    expect(await shownPages(page)).toEqual(expectedShown(1, laptop));

    await listen(page).locator('select').nth(0).selectOption('2');
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await expect.poll(() => shownPages(page)).toEqual(expectedShown(p, laptop));
    await page.keyboard.press('Escape');
    await expect(word(page, start)).toHaveClass(/w--playing/);
    // تكرار الآية: الآية نفسها مرة ثانية ثم التالية
    await end(page);
    await expect(word(page, start)).toHaveClass(/w--playing/);
    await end(page);
    await expect(word(page, start + 1)).toHaveClass(/w--playing/);

    // إلى آخر الصفحة (أو الزوج) الظاهرة ثم يقلب إلى ما بعدها ويستمر
    const shown = await shownPages(page);
    const last = pageVerses(shown.at(-1)).at(-1);
    for (let v = start + 1; v <= last; v++) {
      await end(page);
      await end(page);
    }
    const next = expectedShown(shown.at(-1) + 1, laptop);
    await expect.poll(() => shownPages(page)).toEqual(next);
    await expect(word(page, last + 1)).toHaveClass(/w--playing/);
    await end(page);
    await end(page);
    await expect(word(page, last + 2)).toHaveClass(/w--playing/);
  });

  test('آخر المصحف: يقف بعد آخر آية، و✕ يلغي البداية', async ({ page }) => {
    await openApp(page, { 'hq.page': '604', 'hq.range': [QURAN.verses.length - 2] });
    await clickDock(page, 'الاستماع للآيات');
    await expect(listen(page).locator('.listen__head span')).toHaveText('من الناس ٥ إلى آخر المصحف');
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await page.keyboard.press('Escape');
    await expect(word(page, QURAN.verses.length - 2)).toHaveClass(/w--playing/);
    await end(page);
    await expect(word(page, QURAN.verses.length - 1)).toHaveClass(/w--playing/);
    await end(page);
    await expect(page.locator('.w--playing')).toHaveCount(0);

    await clickDock(page, 'الاستماع للآيات');
    await listen(page).getByRole('button', { name: 'إلغاء المقدار' }).click();
    expect(await stored(page, 'hq.range')).toBeNull();
    await expect(listen(page).locator('.listen__head span')).toContainText('متتابعًا');
  });

  test('إكمال النهاية بعد البداية يعيد تكرار المقدار', async ({ page }) => {
    await openApp(page, { 'hq.page': '1', 'hq.range': [1] });
    await clickDock(page, 'الاستماع للآيات');
    await expect(listen(page).locator('select').nth(1)).toBeDisabled();
    await listen(page).getByRole('button', { name: /النهاية/ }).click();
    await pickVerse(page, 3);
    await expect(listen(page).locator('select').nth(1)).toBeEnabled();
    await expect(listen(page).locator('.listen__head span')).toHaveText('الفاتحة ٢–٤');
  });
});

test.describe('«بلا لون»', () => {
  const BGS = [
    ['white', '#323235'],
    ['beige', '#2E2A24'],
    ['gray', '#E8E6E1'],
    ['black', '#D6D3CC'],
  ];
  for (const [bg, ink] of BGS) {
    test(`على ${bg}: لون التطبيق لون نص المصحف، والتظليل رمادي`, async ({ page }) => {
      await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'none', 'hq.range': [pageVerses(3)[1], pageVerses(3)[3]] });
      const v = (name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(), name);
      expect(await v('--accent')).toBe(ink);
      expect(await v('--accent-text')).toBe(ink);
      // الآية الجارية: تظليلها بلا لون مميز (القنوات الثلاث متقاربة كلون نص المصحف نفسه)
      await clickDock(page, 'الاستماع للآيات');
      await listen(page).getByRole('button', { name: 'تشغيل' }).click();
      await page.keyboard.press('Escape');
      const bgColor = await word(page, pageVerses(3)[1]).evaluate((el) => getComputedStyle(el).backgroundColor);
      const [r, g, b] = bgColor.match(/[\d.]+/g).map(Number);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(0.05 * (r > 1 ? 255 : 1) + 0.0001);
      // زر التحكم الرئيس بلون نص المصحف
      await showChrome(page);
      const btn = await page.locator('.dock__ctl--main').evaluate((el) => getComputedStyle(el).backgroundColor);
      const hex = '#' + btn.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
      expect(hex).toBe(ink);
    });
  }

  test('دائرته في الإعدادات نصفان، بلا اسم مكتوب، واسمه لقارئ الشاشة، وآخر الصف', async ({ page }) => {
    await openApp(page);
    await clickTopbar(page, 'الإعدادات');
    const group = page.locator('.settings').getByRole('radiogroup', { name: 'لون التطبيق' });
    await expect(group.getByRole('radio')).toHaveCount(5);
    await expect(group.getByRole('radio', { name: 'موف' })).toHaveCount(0);
    const none = group.getByRole('radio').last();
    await expect(none).toHaveAttribute('aria-label', 'بلا لون');
    await expect(none).toHaveText('');
    const bgImage = await none.locator('.swatch__dot').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('linear-gradient');
    await none.click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'none');
    await expect(none).toHaveAttribute('aria-checked', 'true');
  });

  test('من كان على «موف» ينتقل إلى «بلا لون»', async ({ page }) => {
    await openApp(page, { 'hq.accent': 'mauve' });
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'none');
    expect(await page.evaluate(() => localStorage.getItem('hq.accent'))).toBe('none');
  });
});

test.describe('✕ إلغاء مقدار صفحات المحتوى من الزر السفلي', () => {
  const clearBtn = (page) => page.locator('.dock').getByRole('button', { name: 'إلغاء مقدار المحتوى' });

  test('بلا مقدار: لا ✕', async ({ page }) => {
    await openApp(page, { 'hq.page': '1' });
    await showChrome(page);
    await expect(page.locator('.dock').getByRole('button', { name: 'صفحات المحتوى' })).toBeVisible();
    await expect(clearBtn(page)).toHaveCount(0);
  });

  test('✕ يلغي المقدار ويزيل الإخفات دون فتح صفحات المحتوى', async ({ page }) => {
    await openApp(page, { 'hq.page': '1', 'hq.contentRange': [1, 3] });
    await expect(word(page, 0)).toHaveClass(/w--out/);
    await showChrome(page);
    await clearBtn(page).click();
    expect(await stored(page, 'hq.contentRange')).toBeNull();
    await expect(page.locator('.sheet--current .w--out')).toHaveCount(0);
    await expect(study(page)).not.toHaveClass(/study--open/);
    await expect(clearBtn(page)).toHaveCount(0);
  });

  test('باقي الزر يفتح صفحات المحتوى، و✕ شريط المقدار داخلها يعمل', async ({ page }) => {
    await openApp(page, { 'hq.page': '1', 'hq.contentRange': [1, 3] });
    await showChrome(page);
    const slot = page.locator('.dock').getByRole('button', { name: 'صفحات المحتوى' });
    await slot.click(); // وسط الزر
    await expect(study(page)).toHaveClass(/study--open/);
    expect(await stored(page, 'hq.contentRange')).toEqual([1, 3]);
    await study(page).getByRole('button', { name: 'إلغاء المقدار' }).click();
    expect(await stored(page, 'hq.contentRange')).toBeNull();
  });

  test('مساحة لمس ✕ كافية ولا تتداخل مع اسم الزر', async ({ page }) => {
    await openApp(page, { 'hq.page': '1', 'hq.contentRange': [1, 3] });
    await showChrome(page);
    await page.waitForTimeout(300); // يكتمل انزلاق الأزرار
    const x = await clearBtn(page).boundingBox();
    const slot = await page.locator('.dock').getByRole('button', { name: 'صفحات المحتوى' }).boundingBox();
    const label = await page.locator('.dock__study .dock__label').boundingBox();
    expect(x.width).toBeGreaterThanOrEqual(44);
    expect(Math.round(x.height)).toBe(Math.round(slot.height));
    // داخل الخانة، في طرفها
    expect(x.x).toBeGreaterThanOrEqual(slot.x - 1);
    expect(x.x + x.width).toBeLessThanOrEqual(slot.x + slot.width + 1);
    // الاسم خارج مساحة ✕
    expect(label.x + label.width <= x.x || label.x >= x.x + x.width).toBe(true);
    // النقر في أقرب نقطة من الزر إلى ✕ (خارج مساحته) يفتح الصفحات
    const nearX = x.x > slot.x + slot.width / 2 ? x.x - 3 : x.x + x.width + 3;
    await page.mouse.click(nearX, slot.y + slot.height / 2);
    await expect(study(page)).toHaveClass(/study--open/);
    expect(await stored(page, 'hq.contentRange')).toEqual([1, 3]);
  });
});
