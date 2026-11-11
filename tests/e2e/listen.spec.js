// الاستماع بمحاكاة الصوت (بلا صوت حقيقي): تظليل الآية الجارية، والتقليب التلقائي، والتكرار،
// وتعديل المقدار أثناء التشغيل، وتغيير القارئ
import { test, expect } from '@playwright/test';
import { clickDock, isLaptop, openApp, pageVerses, pickVerse, savedPage, shownPages, showChrome, word } from './helpers.js';

const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });
const playing = (page) => page.locator('.sheet--current .w--playing').first().getAttribute('data-v').then(Number);
const lastSrc = (page) => page.evaluate(() => window.__audio.srcs.at(-1));
const end = (page) => page.evaluate(() => window.__audio.end());

async function setListenRange(page, a, b) {
  await listen(page).getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, a);
  await listen(page).getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, b);
}

test('بلا مقدار: يبدأ من أول الصفحة الظاهرة ويظلّل الآية الجارية ويتقدم آيةً آية', async ({ page }) => {
  await openApp(page, { 'hq.page': '3' });
  await clickDock(page, 'الاستماع للآيات');
  await expect(listen(page).locator('.listen__head span')).toContainText('متتابعًا');
  // تكرار المقدار معطّل بلا مقدار
  await expect(listen(page).locator('select').nth(1)).toBeDisabled();
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  const first = pageVerses(3)[0];
  await expect(word(page, first)).toHaveClass(/w--playing/);
  expect(await lastSrc(page)).toMatch(/Saood_ash-Shuraym_128kbps\/002006\.mp3$/);
  await end(page);
  await expect(word(page, first + 1)).toHaveClass(/w--playing/);
  await expect(word(page, first)).not.toHaveClass(/w--playing/);
  // أثناء التشغيل يصير زر الاستماع أزرار تحكم
  await page.keyboard.press('Escape');
  await showChrome(page);
  await page.getByRole('button', { name: 'إيقاف مؤقت' }).click();
  await expect(page.getByRole('button', { name: 'استئناف' })).toBeVisible();
  await page.getByRole('button', { name: 'استئناف' }).click();
  await page.locator('.dock').getByRole('button', { name: 'إيقاف', exact: true }).click();
  await expect(page.locator('.w--playing')).toHaveCount(0);
});

test('التقليب التلقائي عند حد الصفحة (والرجوع إلى صفحة القارئ إن قلّب المستخدم بيده)', async ({ page }, testInfo) => {
  const laptop = isLaptop(testInfo);
  await openApp(page, { 'hq.page': '3' });
  const startPages = laptop ? [3, 4] : [3];
  const count = startPages.flatMap(pageVerses).length;
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  expect(await shownPages(page)).toEqual(startPages);
  for (let i = 0; i < count - 1; i++) await end(page);
  expect(await shownPages(page)).toEqual(startPages);
  await end(page); // يبدأ أول آية في الصفحة التالية
  const next = laptop ? [5, 6] : [4];
  await expect.poll(() => shownPages(page)).toEqual(next);
  await expect(word(page, pageVerses(next[0])[0])).toHaveClass(/w--playing/);

  // قلّب المستخدم بيده بعيدًا: عند بدء الآية التالية يعود المصحف إلى صفحة القارئ
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await shownPages(page))[0]).not.toBe(next[0]);
  await end(page);
  await expect.poll(() => shownPages(page)).toEqual(next);
});

test('مقدار محدد بتكرار الآية وتكرار المقدار، ثم يقف', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickDock(page, 'الاستماع للآيات');
  await setListenRange(page, 1, 2);
  await listen(page).locator('select').nth(0).selectOption('2');
  await listen(page).locator('select').nth(1).selectOption('2');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  // ١ ١ ٢ ٢ ثم المقدار مرة ثانية ١ ١ ٢ ٢
  const seq = [];
  for (let i = 0; i < 8; i++) {
    seq.push(await playing(page));
    await end(page);
  }
  expect(seq).toEqual([1, 1, 2, 2, 1, 1, 2, 2]);
  await expect(page.locator('.w--playing')).toHaveCount(0);
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('hq.listen')));
  expect(settings).toMatchObject({ verseRepeat: 2, rangeRepeat: 2 });
});

test('البسملة بصوت القارئ قبل أول السورة', async ({ page }) => {
  await openApp(page, { 'hq.page': '2' });
  await clickDock(page, 'الاستماع للآيات');
  await setListenRange(page, 7, 8);
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  expect(await lastSrc(page)).toMatch(/001001\.mp3$/);
  await end(page);
  expect(await lastSrc(page)).toMatch(/002001\.mp3$/);
});

test('تعديل المقدار أثناء التشغيل يُطبَّق عند «تم»', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickDock(page, 'الاستماع للآيات');
  await setListenRange(page, 0, 2);
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await end(page);
  await expect(word(page, 1)).toHaveClass(/w--playing/);

  // الآية الجارية داخل المقدار الجديد: يكمل منها
  await setListenRange(page, 1, 4);
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await expect(word(page, 1)).toHaveClass(/w--playing/);
  await end(page);
  await expect(word(page, 2)).toHaveClass(/w--playing/);

  // الآية الجارية خارج المقدار الجديد: يبدأ من أوله
  await showChrome(page);
  await page.getByRole('button', { name: 'إعدادات الاستماع' }).click();
  await setListenRange(page, 5, 6);
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await expect(word(page, 5)).toHaveClass(/w--playing/);
  await end(page);
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);
});

test('تغيير القارئ أثناء التشغيل يعيد الآية نفسها بصوته', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await end(page);
  await end(page);
  expect(await lastSrc(page)).toMatch(/Shuraym.*001003\.mp3$/);
  await listen(page).getByRole('button', { name: /القارئ/ }).click();
  const picker = page.getByRole('dialog', { name: 'اختر القارئ' });
  await expect(picker.locator('.rcpick__group-title')).toHaveText(['مجوّد', 'معلّم', 'مرتّل']);
  await picker.getByRole('radio', { name: 'ماهر المعيقلي' }).click();
  await expect(picker).toHaveCount(0);
  await expect(listen(page).locator('.listen__value')).toContainText('ماهر المعيقلي');
  expect(await lastSrc(page)).toMatch(/MaherAlMuaiqly128kbps\/001003\.mp3$/);
  await expect(word(page, 2)).toHaveClass(/w--playing/);
  // ويبقى اختياره بعد إعادة الفتح
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hq.listen')).reciter)).toBe('muaiqly');
});

test('مقدار صفحات المحتوى يبقى مُخفتًا أثناء الاستماع والتظليل ظاهر خلف الآية الخافتة', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.contentRange': [3, 4] });
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await expect(word(page, 0)).toHaveClass(/w--playing/);
  await expect(word(page, 0)).toHaveClass(/w--out/);
  await expect(word(page, 3)).not.toHaveClass(/w--out/);
});
