// العمل بلا إنترنت بعامل الخدمة الحقيقي (PWA): بعد أول فتح يعمل التطبيق والصفحات المفتوحة والتفسير
// بلا اتصال، والصفحة التي لم تُفتح قط تُظهر رسالتها
import { test, expect } from '@playwright/test';
import { clickDock, clickTopbar, prepare, savedPage, waitMushaf } from './helpers.js';

test.use({ serviceWorkers: 'allow' });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'mobile', 'مرة واحدة تكفي'));

test('بعد أول فتح: يعمل بلا اتصال على آخر صفحة، مع التفسير', async ({ page, context }) => {
  await prepare(page, { 'hq.page': '10' });
  await page.goto('/');
  await waitMushaf(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // الفتح الثاني يمرّ بعامل الخدمة فيحفظ خطوط الصفحات المفتوحة
  await page.reload();
  await waitMushaf(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await clickDock(page, 'صفحات المحتوى');
  await expect(page.locator('.study .study__item').first()).toBeVisible();
  await page.keyboard.press('Escape');

  await context.setOffline(true);
  await page.reload();
  await waitMushaf(page);
  expect(await savedPage(page)).toBe(10);
  await clickDock(page, 'صفحات المحتوى');
  await expect(page.locator('.study .study__item').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // صفحة بعيدة لم تُفتح قط: رسالتها بدل حروف مبعثرة
  await clickTopbar(page, 'القائمة');
  await page.locator('.sidemenu').getByRole('button', { name: /سورة الناس/ }).click();
  await expect(page.locator('.sheet--current .mushaf-page--pending').first()).toContainText('تحتاج لذلك اتصالًا بالإنترنت');
  await context.setOffline(false);
});
