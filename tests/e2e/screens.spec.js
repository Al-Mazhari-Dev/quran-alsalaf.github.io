// لقطات مرجعية للشاشات الرئيسية، على خلفية فاتحة (بيج) وداكنة (رصاصي)، بمقاسَي الجوال واللابتوب.
// أي تغيير شكلي غير مقصود يُفشل المقارنة في GitHub. وتحديثها عن قصد: التزام فيه [update-snapshots] (snapshots.yml)
// (وبحسب CLAUDE.md: تُعرض الصورة القديمة والجديدة على صاحب المشروع قبل اعتماد التحديث)
import { test, expect } from '@playwright/test';
import { clickDock, clickTopbar, openApp, showChrome } from './helpers.js';

const THEMES = [
  ['light', 'beige'],
  ['dark', 'gray'],
];

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // الفأرة بعيدًا، والأزرار العائمة مخفية
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
}

for (const [theme, bg] of THEMES) {
  test.describe(`المظهر ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'blue' });
    });

    test('المصحف', async ({ page }) => {
      await settle(page);
      await expect(page).toHaveScreenshot(`mushaf-${theme}.png`);
    });

    test('صفحات المحتوى', async ({ page }) => {
      await clickDock(page, 'صفحات المحتوى');
      await expect(page.locator('.study .study__item').first()).toBeVisible();
      await page.locator('.dock').evaluate((el) => el.classList.remove('dock--open'));
      await settle(page);
      await expect(page).toHaveScreenshot(`study-${theme}.png`);
    });

    test('الإعدادات', async ({ page }) => {
      await clickTopbar(page, 'الإعدادات');
      await expect.poll(async () => Math.round((await page.locator('.settings__card').boundingBox()).x)).toBe(0);
      await settle(page);
      await expect(page).toHaveScreenshot(`settings-${theme}.png`);
    });
  });

  // «بلا لون» (٢٠٢٦-١١-١٢) ومعه مقدار صفحات المحتوى: الإخفات، وزرّا الشريط السفلي ظاهران و✕ الإلغاء في زر صفحات المحتوى
  test(`بلا لون ${theme}`, async ({ page }) => {
    await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'none', 'hq.contentRange': [12, 16] });
    await page.evaluate(() => document.fonts.ready);
    await showChrome(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`none-${theme}.png`);
  });
}
