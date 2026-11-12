// اختبارات المتصفح الآلية: تفتح التطبيق المبني (dist عبر vite preview) وتتصرف كمستخدم،
// بمقاسَي الجوال واللابتوب. التشغيل: npm run build ثم npm run test:e2e
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    // اللقطات المرجعية: سماح يسير لفروق التنعيم بين الأجهزة، ويكشف أي تغيير شكلي حقيقي
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  // اللقطات المرجعية تُلتقط وتُقارَن في GitHub وحده (CI): رسم الخطوط يختلف يسيرًا من جهاز إلى جهاز،
  // فلو قورنت على جهاز آخر لفشلت بلا تغيير حقيقي. وتُحدَّث بسير العمل snapshots.yml (انظر CLAUDE.md).
  // PW_SNAPSHOTS=1 يفرض المقارنة محليًّا
  ignoreSnapshots: !process.env.CI && !process.env.PW_SNAPSHOTS,
  // لقطة واحدة لكل شاشة ومقاس
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar',
    // عامل الخدمة لا يُختبر هنا: يخزّن الأصول فيخلط بين تشغيلين
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true },
    },
    {
      name: 'laptop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
