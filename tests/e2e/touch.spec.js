// اللمس: أحداث لمس حقيقية من المتصفح (Input.dispatchTouchEvent)، لا فأرة — فيُختبر بها ما يعتمد
// على اللمس: التقليب بالإصبع، والنفضة، والسحب الرأسي، والضغط المطوّل، وسحب تبويبات صفحات المحتوى،
// وسحب الإعدادات لإغلاقها. (إحساس اللمس نفسه على الجهاز الحقيقي يبقى في CHECKLIST.md)
import { test, expect } from '@playwright/test';
import { clickDock, clickTopbar, openApp, savedPage, shownPages, word } from './helpers.js';

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'mobile', 'اللمس للجوال'));

async function finger(page) {
  const cdp = await page.context().newCDPSession(page);
  // timestamp: توقيت كل حدث صريحًا (بالثواني)، فتُحسب سرعة السحب كما أرادها الاختبار ولو تأخر
  // تسليم الأحداث على جهاز مشغول
  const send = (type, pts, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts, ...(timestamp ? { timestamp } : {}) });
  return {
    // سحبة من (x1,y1) إلى (x2,y2) في ms مللي ثانية
    async swipe(x1, y1, x2, y2, ms = 300, steps = 12) {
      const t0 = Date.now() / 1000;
      await send('touchStart', [{ x: x1, y: y1 }], t0);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }], t0 + (ms * i) / steps / 1000);
        await page.waitForTimeout(ms / steps);
      }
      await send('touchEnd', [], t0 + ms / 1000);
    },
    // يضع الإصبع ويبقيه (lift() ترفعه)
    async press(x, y) {
      await send('touchStart', [{ x, y }]);
    },
    async lift() {
      await send('touchEnd', []);
    },
    async tap(x, y) {
      const t0 = Date.now() / 1000;
      await send('touchStart', [{ x, y }], t0);
      await send('touchEnd', [], t0 + 0.06);
    },
  };
}

test('السحب بالإصبع نحو اليمين للتالية ونحو اليسار للسابقة، والسحبة القصيرة البطيئة تعود', async ({ page }) => {
  await openApp(page, { 'hq.page': '150' });
  const f = await finger(page);
  await f.swipe(80, 500, 320, 505);
  await expect.poll(() => savedPage(page)).toBe(151);
  await f.swipe(320, 500, 80, 505);
  await expect.poll(() => savedPage(page)).toBe(150);
  await f.swipe(150, 500, 200, 500, 900);
  await page.waitForTimeout(500);
  expect(await savedPage(page)).toBe(150);
});

test('النفضة السريعة القصيرة تقلب', async ({ page }) => {
  await openApp(page, { 'hq.page': '150' });
  const f = await finger(page);
  await f.swipe(150, 500, 230, 500, 60, 4);
  await expect.poll(() => savedPage(page)).toBe(151);
});

test('السحب الرأسي لا يقلب الصفحة', async ({ page }) => {
  await openApp(page, { 'hq.page': '150' });
  const f = await finger(page);
  await f.swipe(200, 300, 230, 650);
  await page.waitForTimeout(500);
  expect(await savedPage(page)).toBe(150);
});

test('لمسة تُظهر الأزرار وأخرى تخفيها', async ({ page }) => {
  await openApp(page, { 'hq.page': '150' });
  const f = await finger(page);
  await f.tap(195, 420);
  await expect(page.locator('.dock')).toHaveClass(/dock--open/);
  await page.waitForTimeout(400);
  await f.tap(195, 420);
  await expect(page.locator('.dock')).not.toHaveClass(/dock--open/);
});

// يُفحص والإصبع ما زال على الشاشة: أداة اللمس هنا لا تحاكي إيماءة الضغط المطوّل في أندرويد، فرفع
// الإصبع فيها يُحسب نقرة تغلق البطاقة. بقاء البطاقة بعد رفع الإصبع على جهاز حقيقي في CHECKLIST.md
test('الضغط المطوّل بالإصبع يفتح بطاقة الآية، وتحريك الإصبع يلغيه', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  const f = await finger(page);
  const b = await word(page, 3).boundingBox();
  // تحريك أثناء الضغط: سحبة لا ضغط مطوّل
  await f.swipe(b.x + b.width / 2, b.y + b.height / 2, b.x + b.width / 2 + 60, b.y + b.height / 2, 700, 6);
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await page.waitForTimeout(400);
  await f.press(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(300);
  await expect(page.locator('.vmenu')).toHaveCount(0); // ليس قبل مدة الضغط المطوّل
  await expect(page.locator('.vmenu__picker')).toBeVisible();
  await expect(word(page, 3)).toHaveClass(/w--selected/);
  expect(await savedPage(page)).toBe(1);
});

test('السحب يمينًا ويسارًا في صفحات المحتوى ينتقل بين التبويبات', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickDock(page, 'صفحات المحتوى');
  const tabs = page.locator('.study').getByRole('tab');
  await expect(page.locator('.study .study__item').first()).toBeVisible();
  // بعد اكتمال انزلاقها: لو بدأ السحب أثناءه لوقع الإصبع خارجها
  await expect.poll(async () => Math.round((await page.locator('section.study').boundingBox()).x)).toBe(0);
  await page.waitForTimeout(300);
  const f = await finger(page);
  // نحو اليمين: إلى التبويب الذي على اليسار (التالي)
  await f.swipe(80, 600, 300, 605);
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await f.swipe(80, 600, 300, 605);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await f.swipe(80, 600, 300, 605); // لا تبويب بعد الأخير
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await f.swipe(300, 600, 80, 605);
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  // السحب الرأسي تمرير لا انتقال
  await f.swipe(200, 700, 210, 300);
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  // والمصحف خلفها لم يُقلَّب
  expect(await shownPages(page)).toEqual([1]);
});

test('سحب الإعدادات بالإصبع نحو اليسار يغلقها، والسحب القصير يعيدها', async ({ page }) => {
  await openApp(page, { 'hq.page': '150' });
  const f = await finger(page);
  // الفتح نفسه ليس موضوع هذا الاختبار (إظهار الأزرار باللمس له اختباره أعلاه)
  await clickTopbar(page, 'الإعدادات');
  const settings = page.locator('.settings');
  await expect(settings).toHaveClass(/settings--open/);
  await expect.poll(async () => Math.round((await page.locator('.settings__card').boundingBox()).x)).toBe(0);
  await f.swipe(250, 650, 215, 650, 600, 6); // قصيرة بطيئة
  await page.waitForTimeout(400);
  await expect(settings).toHaveClass(/settings--open/);
  await expect.poll(async () => Math.round((await page.locator('.settings__card').boundingBox()).x)).toBe(0);
  await f.swipe(280, 650, 40, 650, 300);
  await expect(settings).not.toHaveClass(/settings--open/);
  expect(await savedPage(page)).toBe(150);
});
