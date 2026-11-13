// ترويسة الصفحة كمصحف المدينة المطبوع (٢٠٢٦-١١-١٣): السورة التي يبدأ عنوانها في النصف الأعلى،
// والسور القصار آخر المصحف تُذكر كلها — والأسماء الثلاثة تتسع في الترويسة دون تداخل مع رقم الصفحة
import { expect, test } from '@playwright/test';
import { openApp } from './helpers.js';

const sheet = (page, n) => page.locator(`.sheet--current[aria-label="الصفحة ${n}"]`);

for (const width of [360, 390]) {
  test(`ترويسة ٦٠٤ «الإخلاص · الفلق · الناس» تتسع بلا تداخل والرقم في الوسط (عرض ${width})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'laptop' && width === 360, 'عرض الجوال وحده');
    if (testInfo.project.name !== 'laptop') await page.setViewportSize({ width, height: 800 });
    await openApp(page, { 'hq.page': '604' });
    const meta = sheet(page, '٦٠٤').locator('.sheet__meta');
    await expect(meta.locator('.sheet__sura')).toHaveText('الإخلاص · الفلق · الناس');
    await expect(meta.locator('.sheet__juz')).toHaveText('الجزء ٣٠');
    const box = (sel) => meta.locator(sel).boundingBox();
    const [all, sura, num] = [await meta.boundingBox(), await box('.sheet__sura'), await box('.sheet__num')];
    // في الواجهة العربية: السورة يسار الرقم، وكلاهما داخل عرض الترويسة
    expect(sura.x + sura.width).toBeLessThanOrEqual(num.x);
    expect(sura.x).toBeGreaterThanOrEqual(all.x - 1);
    // ورقم الصفحة يبقى في وسط الترويسة
    expect(Math.abs(num.x + num.width / 2 - (all.x + all.width / 2))).toBeLessThanOrEqual(1);
  });
}

for (const [p, sura, juz] of [
  ['٥٠٢', 'الأحقاف', 'الجزء ٢٦'], // عنوان الأحقاف وأول الجزء في السطر ٧
  ['٢٣٥', 'هود', 'الجزء ١٢'], // عنوان يوسف في السطر ٩، فالترويسة لهود
]) {
  test(`ترويسة ${p}: «${sura}» و«${juz}» كالمطبوع`, async ({ page }) => {
    const n = p.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    await openApp(page, { 'hq.page': n });
    const meta = page.locator(`.sheet[aria-label="الصفحة ${p}"] .sheet__meta`);
    await expect(meta.locator('.sheet__sura')).toHaveText(sura);
    await expect(meta.locator('.sheet__juz')).toHaveText(juz);
  });
}
