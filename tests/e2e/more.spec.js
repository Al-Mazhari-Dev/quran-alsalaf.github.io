// بنود كانت خارج الاختبارات: الوضع الأفقي للجوال، وشريط سرعة وضع القراءة، ورسائل تعذّر التحميل،
// والتنزيل للاستماع بلا إنترنت، وسحب لوحة اللمس، ولوحة المفاتيح، وإخفاء الأزرار بعد توقف الفأرة،
// وتمييز مقررات الأسابيع
import { test, expect } from '@playwright/test';
import { clickDock, clickTopbar, drag, isLaptop, openApp, prepare, savedPage, shownPages, waitMushaf } from './helpers.js';

// ---------- الوضع الأفقي للجوال ----------
test.describe('الجوال أفقيًّا', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('الصفحة بعرض الشاشة وتُمرَّر رأسيًّا، والتمرير لا يقلب، والسحب الأفقي يقلب', async ({ page }) => {
    await openApp(page, { 'hq.page': '50' });
    await expect(page.locator('.reader--scroll')).toHaveCount(1);
    await expect(page.locator('.app--spread')).toHaveCount(0);
    const sheet = page.locator('.sheet--current');
    await expect(sheet).toHaveClass(/sheet--scroll/);
    const lines = await sheet.locator('.mushaf-page').boundingBox();
    expect(lines.width).toBeGreaterThan(844 - 20);
    // الصفحة أطول من الشاشة: تُمرَّر داخل نفسها
    const [sh, ch] = await sheet.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(sh).toBeGreaterThan(ch * 1.5);
    await page.mouse.move(420, 200);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    expect(await savedPage(page)).toBe(50);
    // الأسطر الخمسة عشر كاملة
    await expect(sheet.locator('.line')).toHaveCount(15);
    await drag(page, 300);
    await expect.poll(() => savedPage(page)).toBe(51);
  });

  test('تدوير الجوال بين الطولي والأفقي يبقي الصفحة نفسها', async ({ page }) => {
    await openApp(page, { 'hq.page': '120' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.reader--scroll')).toHaveCount(0);
    expect(await shownPages(page)).toEqual([120]);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.reader--scroll')).toHaveCount(1);
    expect(await shownPages(page)).toEqual([120]);
  });
});

// ---------- شريط سرعة وضع القراءة ----------
test('شريط السرعة: النقر يمينه أبطأ ويساره أسرع، والأسهم، والحفظ، وأثرها في التمرير', async ({ page }) => {
  await openApp(page, { 'hq.page': '5' });
  await clickTopbar(page, 'الإعدادات');
  await page.locator('.settings').getByRole('button', { name: 'وضع القراءة' }).click();
  const slider = page.getByRole('slider', { name: 'سرعة التمرير بالأسطر في الدقيقة' });
  await expect(slider).toHaveAttribute('aria-valuenow', '8');
  const box = await slider.boundingBox();
  const y = box.y + box.height / 2;

  // أقصى اليسار: أسرع (٣٠)، وأقصى اليمين: أبطأ (٢)، والمنتصف نحو ١٦
  await page.mouse.click(box.x + 1, y);
  await expect(slider).toHaveAttribute('aria-valuenow', '30');
  await page.mouse.click(box.x + box.width - 1, y);
  await expect(slider).toHaveAttribute('aria-valuenow', '2');
  await page.mouse.click(box.x + box.width / 2, y);
  expect(Number(await slider.getAttribute('aria-valuenow'))).toBeCloseTo(16, 0);
  // سحب المقبض
  await page.mouse.move(box.x + box.width - 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, y, { steps: 5 });
  await page.mouse.up();
  expect(Number(await slider.getAttribute('aria-valuenow'))).toBeCloseTo(9, 0);

  // لوحة المفاتيح: الأيسر يسرّع والأيمن يبطئ، في حدود ٢–٣٠
  await slider.focus();
  const before = Number(await slider.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', String(before + 1));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', String(before - 1));
  expect(await page.evaluate(() => Number(localStorage.getItem('hq.readSpeed')))).toBe(before - 1);

  // أثرها: سرعة ٣٠ أسرع بوضوح من ٢
  const flow = page.locator('.flow');
  const rate = async (speedX) => {
    await page.mouse.click(speedX, y);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    const a = await flow.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(1500);
    return (await flow.evaluate((el) => el.scrollTop)) - a;
  };
  const fast = await rate(box.x + 1);
  const slow = await rate(box.x + box.width - 1);
  expect(fast).toBeGreaterThan(slow * 5);
  expect(fast).toBeGreaterThan(5);

  // تبقى للمرة القادمة
  await page.getByRole('button', { name: 'الخروج من وضع القراءة' }).click();
  await clickTopbar(page, 'الإعدادات');
  await page.locator('.settings').getByRole('button', { name: 'وضع القراءة' }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', '2');
});

// ---------- رسائل تعذّر التحميل ----------
test('تعذّر تحميل المصحف: رسالة وزر «إعادة المحاولة» يعيده', async ({ page }) => {
  await prepare(page, { 'hq.page': '3' });
  await page.route('**/data/quran.json', (r) => r.abort());
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('تعذّر تحميل المصحف');
  await expect(alert).toContainText('تحقّق من الاتصال');
  await expect(page.locator('.reader')).toHaveCount(0);
  await page.unroute('**/data/quran.json');
  await alert.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await waitMushaf(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await shownPages(page))[0]).toBe(3);
});

test('صفحة لم تُنزَّل بلا اتصال: رسالتها، ثم تظهر وحدها عند عودة الاتصال', async ({ page }) => {
  await prepare(page, { 'hq.page': '300' });
  await page.route(/\/fonts\/qcf4\/p(299|300)\.woff2$/, (r) => r.abort());
  await page.goto('/');
  const pending = page.locator('.sheet--current .mushaf-page--pending').first();
  await expect(pending).toContainText('تُنزَّل هذه الصفحة عند أول فتح لها، وتحتاج لذلك اتصالًا بالإنترنت');
  await page.unroute(/\/fonts\/qcf4\/p(299|300)\.woff2$/);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitMushaf(page);
  await expect(page.locator('.sheet--current .mushaf-page--pending')).toHaveCount(0);
});

test('تعذّر تحميل التفسير: رسالته في صفحات المحتوى', async ({ page }) => {
  await prepare(page, { 'hq.page': '1' });
  await page.route('**/data/tafsir-*.json', (r) => r.abort());
  await page.goto('/');
  await waitMushaf(page);
  await clickDock(page, 'صفحات المحتوى');
  await expect(page.locator('.study .study__note')).toContainText('تعذّر تحميل التفسير');
});

// ---------- التنزيل للاستماع بلا إنترنت ----------
test('تنزيل الصوت للاستماع بلا إنترنت: التقدّم ثم «تم تنزيله»، والتشغيل من النسخة المنزَّلة', async ({ page }) => {
  await prepare(page, { 'hq.page': '1', 'hq.range': [0, 2] });
  const mp3 = Buffer.alloc(40_000, 1);
  await page.route(/everyayah\.com/, async (r) => {
    await new Promise((res) => setTimeout(res, 150));
    await r.fulfill({ status: 200, body: mp3, headers: { 'content-type': 'audio/mpeg', 'content-length': String(mp3.length) } });
  });
  await page.goto('/');
  await waitMushaf(page);
  await clickDock(page, 'الاستماع للآيات');
  const sheet = page.getByRole('dialog', { name: 'الاستماع للآيات' });
  await sheet.getByRole('button', { name: 'تنزيل للاستماع بلا إنترنت' }).click();
  await expect(sheet.locator('.listen__download--active')).toContainText('جارٍ تنزيل الملف');
  await expect(sheet.locator('.listen__downloaded')).toContainText('تم تنزيله');
  // الآن بلا اتصال: التشغيل من الملفات المنزَّلة
  await page.route(/everyayah\.com/, (r) => r.abort());
  await sheet.getByRole('button', { name: 'تشغيل' }).click();
  await expect(page.locator('.sheet--current .w--playing')).not.toHaveCount(0);
  expect(await page.evaluate(() => window.__audio.srcs.at(-1))).toMatch(/^blob:/);
  // تغيير القارئ: لم يُنزَّل له شيء
  await page.keyboard.press('Escape');
});

test('تعذّر تنزيل الصوت: رسالة، ويبقى زر التنزيل', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.range': [0, 1] });
  await clickDock(page, 'الاستماع للآيات');
  const sheet = page.getByRole('dialog', { name: 'الاستماع للآيات' });
  await sheet.getByRole('button', { name: 'تنزيل للاستماع بلا إنترنت' }).click();
  await expect(page.locator('.toast')).toHaveText('تعذّر تنزيل الصوت. تحقّق من اتصالك بالإنترنت.');
  await expect(sheet.getByRole('button', { name: 'تنزيل للاستماع بلا إنترنت' })).toBeVisible();
});

test('تعذّر تشغيل الصوت (لا اتصال): رسالة ويتوقف الاستماع', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error('net'), { name: 'NotSupportedError' }));
  });
  await clickDock(page, 'الاستماع للآيات');
  await page.getByRole('dialog', { name: 'الاستماع للآيات' }).getByRole('button', { name: 'تشغيل' }).click();
  await expect(page.locator('.toast')).toContainText('تعذّر تشغيل الصوت');
  await expect(page.locator('.w--playing')).toHaveCount(0);
});

// ---------- لوحة اللمس ولوحة المفاتيح والفأرة (اللابتوب) ----------
// أحداث العجلة تُرسل من داخل الصفحة بإيقاع لوحة لمس حقيقية (نحو ٦٠ في الثانية)؛ فإرسالها من خارجها
// يباعد بينها على جهاز مشغول، فيعدّ التطبيق كل حدث سحبة مستقلة (وهو صحيح لحركات متباعدة)
const swipePad = (page, dx, count) =>
  page.evaluate(
    ([dx, count]) =>
      new Promise((done) => {
        const el = document.querySelector('.reader');
        let i = 0;
        const tick = () => {
          if (i++ >= count) return done();
          el.dispatchEvent(new WheelEvent('wheel', { deltaX: dx, deltaY: 0, bubbles: true, cancelable: true }));
          setTimeout(tick, 16);
        };
        tick();
      }),
    [dx, count]
  );

test('سحب إصبعين على لوحة اللمس يقلب الزوج، والسحب اليسير لا يقلب', async ({ page }, testInfo) => {
  test.skip(!isLaptop(testInfo), 'لوحة لمس الحاسوب');
  await openApp(page, { 'hq.page': '41' });
  // حركة الإصبعين نحو اليمين (deltaX سالب) للتالية، وما بقي من قصورها بعد القلب لا يقلب ثانية
  await swipePad(page, -40, 20);
  await expect.poll(() => shownPages(page)).toEqual([43, 44]);
  await page.waitForTimeout(500);
  expect(await shownPages(page)).toEqual([43, 44]);
  await swipePad(page, 40, 20);
  await expect.poll(() => shownPages(page)).toEqual([41, 42]);
  await page.waitForTimeout(500);
  // سحب يسير (أقل من ٤٨ بكسل) يعود مكانه
  await swipePad(page, -10, 3);
  await page.waitForTimeout(500);
  expect(await shownPages(page)).toEqual([41, 42]);
  // التمرير الرأسي لا يقلب
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  expect(await shownPages(page)).toEqual([41, 42]);
});

test('أول Tab يُظهر الأزرار ويركّز أولها، وEsc يخفيها', async ({ page }) => {
  await openApp(page, { 'hq.page': '7' });
  await page.keyboard.press('Tab');
  await expect(page.locator('.topbar')).toHaveClass(/topbar--open/);
  await expect(page.getByRole('button', { name: 'القائمة' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.topbar__search')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.searchov')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.reader').focus().catch(() => {});
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  await expect(page.locator('.topbar')).not.toHaveClass(/topbar--open/);
});

test('الأزرار الظاهرة بالفأرة تختفي بعد توقفها، وتبقى والمؤشر فوقها', async ({ page }, testInfo) => {
  test.skip(!isLaptop(testInfo), 'الفأرة');
  await openApp(page, { 'hq.page': '7' });
  await page.mouse.move(700, 450);
  await page.mouse.move(720, 460);
  await expect(page.locator('.dock')).toHaveClass(/dock--open/);
  await page.waitForTimeout(3000);
  await expect(page.locator('.dock')).not.toHaveClass(/dock--open/);
  // فوق زر: تبقى
  await page.mouse.move(700, 450);
  await page.mouse.move(720, 460);
  const btn = page.locator('.dock').getByRole('button', { name: 'صفحات المحتوى' });
  await expect(page.locator('.dock')).toHaveClass(/dock--open/);
  await page.waitForTimeout(500); // يكتمل انزلاقها
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2 + 4, b.y + b.height / 2);
  await page.waitForTimeout(3000);
  await expect(page.locator('.dock')).toHaveClass(/dock--open/);
});

// ---------- تمييز مقررات الأسابيع ----------
test('تمييز مقررات الأسابيع يلوّن كلمات المقررات بدرجتين متناوبتين ولا يلوّن ما خارجها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  const a = page.locator('.sheet--current .w--week-a').first();
  const off = await a.evaluate((el) => getComputedStyle(el).backgroundColor);
  await clickTopbar(page, 'الإعدادات');
  await page.locator('.settings').getByRole('switch', { name: 'تمييز مقررات الأسابيع' }).click();
  await page.keyboard.press('Escape');
  const on = await a.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(on).not.toBe(off);
  // صفحة خارج المذكرات: لا تمييز
  await page.evaluate(() => localStorage.setItem('hq.page', '300'));
  await page.reload();
  await waitMushaf(page);
  await expect(page.locator('.sheet--current .w--week')).toHaveCount(0);
});
