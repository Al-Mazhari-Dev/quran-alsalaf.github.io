// صفحة المعاينة الداخلية /preview: تفتح وفيها التطبيق بإطاري اللابتوب والجوال
import { test, expect } from '@playwright/test';

test('صفحة /preview تفتح وفيها الإطاران والتطبيق داخلهما', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop', 'صفحة واحدة تكفي');
  await page.goto('/preview/');
  await expect(page).toHaveTitle(/معاينة الشاشتين/);
  await expect(page.locator('#laptopFrame')).toBeVisible();
  await expect(page.locator('#phoneFrame')).toBeVisible();
  for (const id of ['#laptopFrame', '#phoneFrame']) {
    await expect(page.frameLocator(id).locator('.sheet--current .mushaf-page:not(.mushaf-page--pending)').first()).toBeVisible({ timeout: 15000 });
  }
  // بلا عامل خدمة ولا manifest
  expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
  // وتعمل بلا شرطة أخيرة كذلك
  const res = await page.goto('/preview');
  expect(res.status()).toBeLessThan(400);
});
