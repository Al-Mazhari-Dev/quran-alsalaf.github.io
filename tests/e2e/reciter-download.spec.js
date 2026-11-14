// تحميل صوت قارئ لكامل القرآن (٢٠٢٦-١١-١٤): زرّ أمام كل قارئ في صفحة الاختيار، بتأكيد يذكر الحجم،
// ودائرة تقدّم، وإيقاف واستئناف، وحفظ دائم يبقى بعد إعادة الفتح، وحذف؛ والتشغيل من الملفات المحفوظة.
// لا يُطلب شيء من الإنترنت: ملفات الصوت تُحاكى، وأغلب ملفات القارئ تُحفظ مسبقًا في ذاكرته (كتحميل
// سابق ناقص) فيكمل الاختبار الباقي وحده بسرعة.
import { test, expect } from '@playwright/test';
import { clickDock, prepare, waitMushaf } from './helpers.js';

const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69,
  60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
  11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19,
  5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });
const picker = (page) => page.getByRole('dialog', { name: 'اختر القارئ' });
const toast = (page) => page.locator('.toast');
const row = (page, name) => picker(page).locator('.rcpick__item').filter({ has: page.getByRole('radio', { name, exact: true }) });

// ملفات الصوت المحاكاة: كل طلب يُجاب بملف صغير (بعد مهلة delay إن أُعطيت)
async function fakeAudio(page, delay = 0) {
  await page.route(/everyayah\.com/, async (r) => {
    if (delay) await new Promise((res) => setTimeout(res, delay));
    await r.fulfill({ status: 200, body: Buffer.alloc(2000, 1), headers: { 'content-type': 'audio/mpeg' } }).catch(() => {});
  });
}

// يحفظ في ذاكرة القارئ أول n ملفًا من ملفاته (بترتيب المصحف)، كتحميل سابق
async function seedCache(page, folder, id, n) {
  await page.evaluate(
    async ({ counts, folder, id, n }) => {
      const cache = await caches.open(`reciter-audio-${id}`);
      const pad = (x) => String(x).padStart(3, '0');
      const urls = [];
      counts.forEach((c, i) => {
        for (let a = 1; a <= c; a++) urls.push(`https://everyayah.com/data/${folder}/${pad(i + 1)}${pad(a)}.mp3`);
      });
      await Promise.all(urls.slice(0, n).map((u) => cache.put(u, new Response(new Uint8Array(10), { headers: { 'content-type': 'audio/mpeg' } }))));
    },
    { counts: AYAH_COUNTS, folder, id, n }
  );
}

async function openPicker(page) {
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: /القارئ/ }).click();
  await expect(picker(page)).toBeVisible();
}

test('تحميل قارئ لكامل القرآن: تأكيد بالحجم، ثم ✓ «محمَّل على الجهاز» يبقى بعد إعادة الفتح، ثم الحذف', async ({ page }) => {
  await prepare(page, { 'hq.page': '3' });
  await page.goto('/');
  await waitMushaf(page);
  await seedCache(page, 'MaherAlMuaiqly128kbps', 'muaiqly', 6200);
  await fakeAudio(page);
  await openPicker(page);

  // زرّ تحميل أمام كل قارئ
  const count = await picker(page).getByRole('radio').count();
  await expect(picker(page).getByRole('button', { name: /^تحميل .* لكامل القرآن$/ })).toHaveCount(count);

  // التأكيد يذكر الحجم، و«إلغاء» لا يحمّل شيئًا
  await picker(page).getByRole('button', { name: 'تحميل ماهر المعيقلي لكامل القرآن' }).click();
  const ask = page.getByRole('alertdialog', { name: 'تحميل ماهر المعيقلي' });
  await expect(ask).toContainText('١٫٢ غيغابايت');
  await ask.getByRole('button', { name: 'إلغاء' }).click();
  await expect(ask).toHaveCount(0);
  await expect(picker(page)).toBeVisible();
  await expect(row(page, 'ماهر المعيقلي').locator('.rcpick__status')).toHaveCount(0);

  await picker(page).getByRole('button', { name: 'تحميل ماهر المعيقلي لكامل القرآن' }).click();
  await ask.getByRole('button', { name: 'تحميل' }).click();
  await expect(picker(page).getByRole('button', { name: 'حذف تحميل ماهر المعيقلي' })).toBeVisible();
  await expect(row(page, 'ماهر المعيقلي').locator('.rcpick__status')).toHaveText('محمَّل على الجهاز');
  await expect(toast(page)).toContainText('اكتمل تحميل تلاوة ماهر المعيقلي');
  // التحميل لا يختار القارئ ولا يغلق الصفحة
  await expect(picker(page).getByRole('radio', { name: 'ماهر المعيقلي', exact: true })).toHaveAttribute('aria-checked', 'false');
  const keys = await page.evaluate(async () => (await (await caches.open('reciter-audio-muaiqly')).keys()).length);
  expect(keys).toBe(6236);

  // يبقى محمَّلًا بعد إعادة فتح التطبيق
  await page.reload();
  await waitMushaf(page);
  await openPicker(page);
  await expect(row(page, 'ماهر المعيقلي').locator('.rcpick__status')).toHaveText('محمَّل على الجهاز');

  // الحذف بعد تأكيد
  await picker(page).getByRole('button', { name: 'حذف تحميل ماهر المعيقلي' }).click();
  const del = page.getByRole('alertdialog', { name: 'حذف تحميل ماهر المعيقلي' });
  await expect(del).toContainText('١٫٢ غيغابايت');
  await del.getByRole('button', { name: 'حذف' }).click();
  await expect(picker(page).getByRole('button', { name: 'تحميل ماهر المعيقلي لكامل القرآن' })).toBeVisible();
  await expect(row(page, 'ماهر المعيقلي').locator('.rcpick__status')).toHaveCount(0);
  expect(await page.evaluate(() => caches.has('reciter-audio-muaiqly'))).toBe(false);
});

test('الإيقاف المؤقت والاستئناف، وقارئ واحد يُحمَّل في كل مرة، ويستمر التحميل بعد إغلاق الصفحة', async ({ page }) => {
  await prepare(page, { 'hq.page': '3' });
  await page.goto('/');
  await waitMushaf(page);
  await seedCache(page, 'MaherAlMuaiqly128kbps', 'muaiqly', 6000);
  await fakeAudio(page, 400);
  await openPicker(page);

  await picker(page).getByRole('button', { name: 'تحميل ماهر المعيقلي لكامل القرآن' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'تحميل' }).click();
  const status = row(page, 'ماهر المعيقلي').locator('.rcpick__status');
  await expect(status).toContainText('يُحمَّل…');

  // قارئ آخر أثناءه: رسالة ولا يبدأ
  await picker(page).getByRole('button', { name: 'تحميل محمود خليل الحصري لكامل القرآن' }).click();
  await expect(toast(page)).toContainText('يُحمَّل الآن ماهر المعيقلي');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // إيقاف مؤقت: يبقى ما حُمِّل
  await picker(page).getByRole('button', { name: 'إيقاف تحميل ماهر المعيقلي مؤقتًا' }).click();
  await expect(status).toContainText('متوقف عند ٩٦٪');
  await expect(picker(page).getByRole('button', { name: 'استئناف تحميل ماهر المعيقلي' })).toBeVisible();

  // الاستئناف بلا تأكيد، ثم إغلاق الصفحة: يستمر التحميل ويكتمل
  await page.unroute(/everyayah\.com/);
  await fakeAudio(page);
  await picker(page).getByRole('button', { name: 'استئناف تحميل ماهر المعيقلي' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(toast(page)).toContainText('اكتمل تحميل تلاوة ماهر المعيقلي', { timeout: 20_000 });
  await listen(page).getByRole('button', { name: /القارئ/ }).click();
  await expect(row(page, 'ماهر المعيقلي').locator('.rcpick__status')).toHaveText('محمَّل على الجهاز');
});

test('القارئ المحمَّل: التلاوة من الملفات المحفوظة بلا إنترنت، وبلا زرّ «تنزيل» للمقدار', async ({ page }) => {
  await prepare(page, { 'hq.page': '1', 'hq.offline': { shuraym: { status: 'done', count: 6236, total: 6236 } } });
  // تُحفظ الملفات قبل فتح التطبيق (من صفحة أخرى في الموقع نفسه)، فالتحقق عند الفتح يجد ذاكرة القارئ
  await page.goto('/icons/favicon-64.png');
  await seedCache(page, 'Saood_ash-Shuraym_128kbps', 'shuraym', 7);
  await page.goto('/');
  await waitMushaf(page);
  await clickDock(page, 'الاستماع للآيات');
  await expect(listen(page).locator('.listen__downloaded')).toContainText('تم تنزيله');
  await expect(listen(page).getByRole('button', { name: 'تنزيل للاستماع بلا إنترنت' })).toHaveCount(0);
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await expect(page.locator('.sheet--current .w--playing')).not.toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__audio.srcs.at(-1))).toMatch(/^blob:/);
  await page.evaluate(() => window.__audio.end());
  await expect.poll(() => page.evaluate(() => window.__audio.srcs.length)).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__audio.srcs.at(-1))).toMatch(/^blob:/);
});

// القرّاء الثلاثة المضافون (٢٠٢٦-١١-١٤): في مجموعة «مرتّل»، ولكلٍّ زرّ تحميل بحجمه، ويكتمل تحميل ملفاته الـ٦٢٣٦
test('أكرم العلاقمي وسهل ياسين وعزيز عليلي: في «مرتّل»، وتحميل كل واحد لكامل القرآن بحجمه', async ({ page }) => {
  await prepare(page, { 'hq.page': '3' });
  await page.goto('/');
  await waitMushaf(page);
  const added = [
    ['أكرم العلاقمي', 'Akram_AlAlaqimy_128kbps', 'alaqmi', '١٫٦ غيغابايت'],
    ['سهل ياسين', 'Sahl_Yassin_128kbps', 'yassin', '١٫٤ غيغابايت'],
    ['عزيز عليلي', 'aziz_alili_128kbps', 'alili', '١٫٥ غيغابايت'],
  ];
  for (const [, folder, id] of added) await seedCache(page, folder, id, 6200);
  await fakeAudio(page);
  await openPicker(page);

  const murattal = picker(page).locator('section[aria-labelledby="rcpick-murattal"]');
  for (const [name, folder, id, size] of added) {
    await expect(murattal.getByRole('radio', { name, exact: true })).toHaveCount(1);
    await picker(page).getByRole('button', { name: `تحميل ${name} لكامل القرآن` }).click();
    const ask = page.getByRole('alertdialog', { name: `تحميل ${name}` });
    await expect(ask).toContainText(size);
    await ask.getByRole('button', { name: 'تحميل' }).click();
    await expect(row(page, name).locator('.rcpick__status')).toHaveText('محمَّل على الجهاز');
    const urls = await page.evaluate(async (id) => (await (await caches.open(`reciter-audio-${id}`)).keys()).map((r) => r.url), id);
    expect(urls).toHaveLength(6236);
    expect(urls.every((u) => u.startsWith(`https://everyayah.com/data/${folder}/`))).toBe(true);
  }
});
