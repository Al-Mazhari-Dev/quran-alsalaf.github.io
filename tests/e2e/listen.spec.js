// الاستماع بمحاكاة الصوت (بلا صوت حقيقي): تظليل الآية الجارية، والتقليب التلقائي، والتكرار،
// وتعديل المقدار أثناء التشغيل، وتغيير القارئ
import { test, expect } from '@playwright/test';
import { clickDock, isLaptop, longPress, openApp, pageVerses, pickVerse, savedPage, shownPages, showChrome, stored, word } from './helpers.js';

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
  // ويُنتظر استقرار تقليبه قبل الآية التالية
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await shownPages(page))[0]).toBe(next[0] + (laptop ? 2 : 1));
  await page.waitForTimeout(400);
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

// «بدء التشغيل من هذه الآية» (بعد «تشغيل» في مربع الضغط المطوّل): قراءة عادية من الآية بلا نهاية ولا تكرار، والآية تصير بداية
// مقدار الاستماع (يحل محل المقدار السابق)، ثم تُضاف النهاية من نافذة الاستماع فتُطبَّق عند «تم»
test('تشغيل من بطاقة الآية: من هذه الآية بلا نهاية ولا تكرار، ثم إضافة نهاية', async ({ page }) => {
  await openApp(page, {
    'hq.page': '1',
    'hq.range': [0, 1],
    'hq.listen': { reciter: 'shuraym', verseRepeat: 3, rangeRepeat: 2 },
  });
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.getByRole('button', { name: /بدء التشغيل من هذه الآية/ }).click();
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await expect(word(page, 2)).toHaveClass(/w--playing/);
  expect(await lastSrc(page)).toMatch(/Saood_ash-Shuraym_128kbps\/001003\.mp3$/);
  expect(await stored(page, 'hq.range')).toEqual([2]);
  expect(await stored(page, 'hq.listen')).toMatchObject({ verseRepeat: 1, rangeRepeat: 1 });
  // بلا تكرار: الآية التالية مباشرة
  await end(page);
  await expect(word(page, 3)).toHaveClass(/w--playing/);

  // نافذة الاستماع: البداية محددة بلا نهاية، والتكرار «بدون تكرار»
  await showChrome(page);
  await page.getByRole('button', { name: 'إعدادات الاستماع' }).click();
  await expect(listen(page).locator('.listen__head span')).toContainText('إلى آخر المصحف');
  await expect(listen(page).locator('select').nth(0)).toHaveValue('1');
  await listen(page).getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, 4);
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await expect(word(page, 3)).toHaveClass(/w--playing/);
  await end(page);
  await expect(word(page, 4)).toHaveClass(/w--playing/);
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);
});

test('تشغيل من بطاقة آية أثناء استماع جارٍ يبدأ من الآية الجديدة', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await expect(word(page, 0)).toHaveClass(/w--playing/);
  await longPress(page, 5);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.getByRole('button', { name: /بدء التشغيل من هذه الآية/ }).click();
  await expect(word(page, 5)).toHaveClass(/w--playing/);
  await expect(word(page, 0)).not.toHaveClass(/w--playing/);
  expect(await stored(page, 'hq.range')).toEqual([5]);
});

// «تشغيل الآية وحدها» (٢٠٢٦-١١-١٢): «تشغيل» في مربع الضغط المطوّل يُظهر خيارين بدل المربعات، والأول يُظهر
// تحته عدد المرات، والضغط على أحدها يشغّل الآية وحدها بذلك العدد، ومقدار الاستماع يصير هذه الآية
test('تشغيل الآية وحدها خمس مرات: المقدار هذه الآية، ثم يتوقف', async ({ page }) => {
  await openApp(page, {
    'hq.page': '1',
    'hq.range': [0, 3],
    'hq.listen': { reciter: 'shuraym', verseRepeat: 3, rangeRepeat: 2 },
  });
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  // المربعات تختفي ويظهر الخياران في المربع نفسه، وعدد المرات لا يظهر قبل اختيار «وحدها»
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  const box = page.getByRole('dialog', { name: 'تشغيل الفاتحة: ٣' });
  await expect(box).toBeVisible();
  await expect(box.getByRole('group', { name: 'عدد المرات' })).toHaveCount(0);
  await box.getByRole('button', { name: /تشغيل الآية وحدها/ }).click();
  const times = box.getByRole('group', { name: 'عدد المرات' }).getByRole('button');
  await expect(times).toHaveText(['مرة', '٥', '١٠', '٢٠', '٥٠', 'بلا نهاية ∞']);
  await times.filter({ hasText: '٥' }).first().click();
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await expect(word(page, 2)).toHaveClass(/w--playing/);
  expect(await stored(page, 'hq.range')).toEqual([2, 2]);
  expect(await stored(page, 'hq.listen')).toMatchObject({ verseRepeat: 5, rangeRepeat: 1 });
  // تُقرأ خمس مرات ثم يتوقف
  for (let i = 0; i < 4; i++) {
    await end(page);
    await expect(word(page, 2)).toHaveClass(/w--playing/);
  }
  expect(await page.evaluate(() => window.__audio.srcs.filter((x) => x.endsWith('001003.mp3')).length)).toBe(5);
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);
  // نافذة الاستماع: المقدار آية واحدة، وتكرار الآية خمس
  await clickDock(page, 'الاستماع للآيات');
  await expect(listen(page).locator('.listen__head span')).toContainText('الفاتحة ٣');
  await expect(listen(page).locator('.listen__head span')).not.toContainText('–');
  await expect(listen(page).locator('select').nth(0)).toHaveValue('5');
});

test('تشغيل الآية وحدها: «مرة» تقرؤها مرة، و«بلا نهاية» تكررها بلا توقف', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.getByRole('button', { name: /تشغيل الآية وحدها/ }).click();
  await page.getByRole('button', { name: 'مرة', exact: true }).click();
  await expect(word(page, 4)).toHaveClass(/w--playing/);
  expect(await stored(page, 'hq.listen')).toMatchObject({ verseRepeat: 1, rangeRepeat: 1 });
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);

  await longPress(page, 5);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.getByRole('button', { name: /تشغيل الآية وحدها/ }).click();
  await page.getByRole('button', { name: 'بلا نهاية ∞' }).click();
  expect(await stored(page, 'hq.range')).toEqual([5, 5]);
  expect(await stored(page, 'hq.listen')).toMatchObject({ verseRepeat: 1, rangeRepeat: 0 });
  for (let i = 0; i < 6; i++) {
    await end(page);
    await expect(word(page, 5)).toHaveClass(/w--playing/);
  }
  await expect(word(page, 6)).not.toHaveClass(/w--playing/);
});

test('تشغيل أول آية في سورة وحدها مكررة: البسملة قبلها مرة واحدة', async ({ page }) => {
  await openApp(page, { 'hq.page': '2' });
  await longPress(page, 7);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.getByRole('button', { name: /تشغيل الآية وحدها/ }).click();
  await page.getByRole('button', { name: '٥', exact: true }).click();
  expect(await lastSrc(page)).toMatch(/001001\.mp3$/);
  for (let i = 0; i < 5; i++) {
    await end(page);
    expect(await lastSrc(page)).toMatch(/002001\.mp3$/);
  }
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);
  expect(await page.evaluate(() => window.__audio.srcs.filter((x) => x.endsWith('001001.mp3')).length)).toBe(1);
});

// منتقي الآية: السور مطوية بأسهمها إلا سورة الموضع الحالي، وسورة واحدة مفتوحة في كل مرة
test('منتقي الآية: السور مطوية، والسهم يفتح آيات السورة ويطويها', async ({ page }) => {
  await openApp(page, { 'hq.page': '3' });
  await clickDock(page, 'الاستماع للآيات');
  await listen(page).getByRole('button', { name: /البداية/ }).click();
  const picker = page.getByRole('dialog', { name: 'اختر آية البداية' });
  const toggle = (s) => picker.locator(`.rpick__sura[data-sura="${s}"] .rpick__toggle`);
  const verses = (s) => picker.locator(`.rpick__sura[data-sura="${s}"] .rpick__verse`);
  // سورة الموضع الحالي (البقرة) مفتوحة وحدها
  await expect(picker.locator('.rpick__toggle')).toHaveCount(114);
  await expect(toggle(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(verses(2)).toHaveCount(286);
  await expect(picker.locator('.rpick__verse')).toHaveCount(286);
  await expect(toggle(2)).toBeInViewport();
  // فتح سورة أخرى يطوي التي قبلها
  await toggle(18).scrollIntoViewIfNeeded();
  await toggle(18).click();
  await expect(toggle(18)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(2)).toHaveAttribute('aria-expanded', 'false');
  await expect(picker.locator('.rpick__verse')).toHaveCount(110);
  await expect(toggle(18)).toBeInViewport();
  // الضغط ثانيةً يطويها
  await toggle(18).click();
  await expect(toggle(18)).toHaveAttribute('aria-expanded', 'false');
  await expect(picker.locator('.rpick__verse')).toHaveCount(0);
  // اختيار آية من الفاتحة، ثم منتقي النهاية: سورة آية البداية مفتوحة من آية البداية
  await pickVerse(page, 2);
  await listen(page).getByRole('button', { name: /النهاية/ }).click();
  const endPicker = page.getByRole('dialog', { name: 'اختر آية النهاية' });
  await expect(endPicker.locator('.rpick__sura[data-sura="1"] .rpick__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(endPicker.locator('.rpick__verse').first().locator('.rpick__num')).toHaveText('٣');
  await expect(endPicker.locator('.rpick__verse')).toHaveCount(5);
});
