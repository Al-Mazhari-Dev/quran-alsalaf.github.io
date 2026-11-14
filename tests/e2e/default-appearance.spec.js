// المظهر الافتراضي عند أول فتح: «بيج» و«ذهبي عنبري» أيًّا كان وضع الجهاز
import { test, expect } from '@playwright/test';
import { clickTopbar, prepare, waitMushaf } from './helpers.js';

for (const colorScheme of ['light', 'dark']) {
  test.describe(`جهاز على الوضع ${colorScheme === 'dark' ? 'الداكن' : 'الفاتح'}`, () => {
    test.use({ colorScheme });

    test('أول فتح: بيج وذهبي عنبري، ويبقيان بعد إعادة الفتح', async ({ page }) => {
      await prepare(page);
      // أول فتح حقيقي: بلا خلفية ولا لون محفوظين (يُمحيان مرة واحدة بعد تجهيز البيانات)
      await page.addInitScript(() => {
        if (sessionStorage.getItem('__fresh')) return;
        sessionStorage.setItem('__fresh', '1');
        localStorage.removeItem('hq.bg');
        localStorage.removeItem('hq.accent');
      });
      await page.goto('/');
      await waitMushaf(page);

      const root = page.locator('html');
      await expect(root).toHaveAttribute('data-bg', 'beige');
      await expect(root).toHaveAttribute('data-accent', 'amber');
      await expect(root).toHaveAttribute('data-theme', 'light');
      expect(await page.evaluate(() => [localStorage.getItem('hq.bg'), localStorage.getItem('hq.accent')])).toEqual(['beige', 'amber']);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase())).toBe('#8A6110');
      expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#F5EDDC');

      await clickTopbar(page, 'الإعدادات');
      const settings = page.locator('.settings');
      await expect(settings.getByRole('radiogroup', { name: 'خلفية القراءة' }).getByRole('radio', { name: 'بيج', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(settings.getByRole('radiogroup', { name: 'لون التطبيق' }).getByRole('radio', { name: 'ذهبي عنبري', exact: true })).toHaveAttribute('aria-checked', 'true');

      await page.reload();
      await waitMushaf(page);
      await expect(root).toHaveAttribute('data-bg', 'beige');
      await expect(root).toHaveAttribute('data-accent', 'amber');
    });
  });
}
