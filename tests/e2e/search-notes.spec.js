// البحث، والملاحظات من القائمة الجانبية: إضافة وتعديل وحذف (والعلامات المرجعية في bookmarks.spec.js)
import { test, expect } from '@playwright/test';
import { QURAN, clickTopbar, longPress, openApp, shownPages, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');

// نص خانة البحث نفسه في الصفحة الرئيسية وداخل البحث، ويتسع كاملًا ولو في جوال ضيق (عرض ٣٦٠)
test('خانة البحث: «ابحث في المصحف بالكلمات والأرقام» في الصفحة الرئيسية وداخل البحث', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('laptop')) await page.setViewportSize({ width: 360, height: 780 });
  await openApp(page, { 'hq.page': '1' });
  const label = page.locator('.topbar__search span');
  await expect(label).toHaveText('ابحث في المصحف بالكلمات والأرقام');
  // لا يُقص النص: عرضه كاملًا داخل الخانة
  const fits = await label.evaluate((el) => {
    const box = el.parentElement;
    const pad = parseFloat(getComputedStyle(box).paddingLeft);
    return el.getBoundingClientRect().left >= box.getBoundingClientRect().left + pad - 0.5 && box.scrollWidth <= box.clientWidth;
  });
  expect(fits).toBe(true);
  await clickTopbar(page, 'ابحث في المصحف بالكلمات والأرقام');
  await expect(page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام')).toBeFocused();
});

test('البحث بنص الآية مع تطبيع الهمزات والتاء المربوطة، والانتقال إلى النتيجة، وسجل البحث', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  const box = page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام');
  await expect(box).toBeFocused();
  // «اصحاب الكهف» بلا همزة، و«والرقيم»
  await box.fill('اصحاب الكهف والرقيم');
  const verse = page.locator('.searchov__verse').first();
  await expect(verse).toContainText('الكهف ٩');
  await verse.click();
  await expect(page.locator('.searchov')).toHaveCount(0);
  await expect.poll(() => shownPages(page)).toContain(294);

  // السجل: البحث الناجح يظهر في الصفحة الفارغة، ويُعاد بضغطة، ويُحذف
  await clickTopbar(page, 'بحث في المصحف');
  const item = page.locator('.searchov__histItem', { hasText: 'اصحاب الكهف والرقيم' });
  await expect(item).toBeVisible();
  await item.click();
  await expect(box).toHaveValue('اصحاب الكهف والرقيم');
  await page.getByRole('button', { name: 'مسح' }).click();
  await page.getByRole('button', { name: 'حذف «اصحاب الكهف والرقيم» من السجل' }).click();
  await expect(page.locator('.searchov__histItem')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.searchov')).toHaveCount(0);
});

test('البحث باسم السورة والتاء المربوطة هاءً', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  await page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام').fill('سوره البقره');
  await expect(page.locator('.searchov__sura')).toContainText(['سورة البقرة']);
  await page.locator('.searchov__sura').first().click();
  await expect.poll(() => shownPages(page)).toContain(2);
  // حرف واحد لا يبحث
  await clickTopbar(page, 'بحث في المصحف');
  await page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام').fill('ا');
  await expect(page.locator('.searchov__verse, .searchov__sura')).toHaveCount(0);
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.searchov')).toHaveCount(0);
});

test('البحث بالأرقام: الصفحة ثم السورة ثم الجزء، بأرقام عربية أو إنجليزية، والانتقال إليها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  const box = page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام');
  const hits = page.locator('.searchov__numHit');

  // ٣ (رقم واحد يكفي): ثلاث نتائج بالترتيب
  await box.fill('٣');
  await expect(hits).toHaveText(['٣الصفحة', '٣سورة آل عمران', '٣الجزء الثالث']);
  await box.fill('3');
  await expect(hits).toHaveText(['٣الصفحة', '٣سورة آل عمران', '٣الجزء الثالث']);
  await expect(page.locator('.searchov__verse, .searchov__sura:not(.searchov__numHit)')).toHaveCount(0);

  // الجزء الثالث ينقل إلى أول صفحة فيه (٤٢)
  await hits.filter({ hasText: 'الجزء الثالث' }).click();
  await expect(page.locator('.searchov')).toHaveCount(0);
  await expect.poll(() => shownPages(page)).toContain(42);

  // السورة الثالثة: أول صفحة فيها (٥٠)
  await clickTopbar(page, 'بحث في المصحف');
  await box.fill('3');
  await hits.filter({ hasText: 'سورة آل عمران' }).click();
  await expect.poll(() => shownPages(page)).toContain(50);

  // ٥٢٣: الصفحة وحدها، وتُفتح بالضغط عليها
  await clickTopbar(page, 'بحث في المصحف');
  await box.fill('523');
  await expect(hits).toHaveText(['٥٢٣الصفحة']);
  await hits.click();
  await expect.poll(() => shownPages(page)).toContain(523);

  // يُحفظ في السجل، وما لا وجود له لا نتيجة له
  await clickTopbar(page, 'بحث في المصحف');
  await expect(page.locator('.searchov__histItem', { hasText: '523' })).toBeVisible();
  await box.fill('٦٠٥');
  await expect(hits).toHaveCount(0);
  await box.fill('0');
  await expect(hits).toHaveCount(0);
});

// البحث بالسورة ورقم الآية (٢٠٢٦-١١-١٢): الآية أولًا ثم سورتها، والضغط ينقل إلى صفحتها ويميّزها مؤقتًا
const at = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
const flashed = (page) => page.locator('.sheet--current .w--flash');

test('البحث بالسورة ورقم الآية: «البقرة ٢٥٥» أولًا، والانتقال إلى صفحتها، وتمييزها مؤقتًا ثم زواله', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  const box = page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام');
  const results = page.locator('.searchov__verse, .searchov__sura');

  // بأرقام عربية وإنجليزية، و«سورة»، وبلا «ال»، و«٢:٢٥٥»: آية الكرسي نتيجة أولى، ثم سورة البقرة
  for (const q of ['البقرة 255', 'سورة البقرة 255', 'بقرة 255', '٢:٢٥٥', 'البقرة ٢٥٥']) {
    await box.fill(q);
    await expect(results.first(), q).toHaveClass(/searchov__refHit/);
    await expect(results.first(), q).toContainText('البقرة ٢٥٥');
    await expect(results.first(), q).toContainText('الله لا إله إلا هو الحي القيوم');
    await expect(results.nth(1), q).toContainText('سورة البقرة');
    await expect(results, q).toHaveCount(2);
  }

  await results.first().click();
  await expect(page.locator('.searchov')).toHaveCount(0);
  await expect.poll(() => shownPages(page)).toContain(42);
  // الآية وحدها مظلَّلة، ثم يزول تظليلها وحده بعد ثوانٍ
  const kursi = at(2, 255);
  await expect(flashed(page).first()).toBeVisible();
  expect(await flashed(page).evaluateAll((els) => [...new Set(els.map((el) => Number(el.dataset.v)))])).toEqual([kursi]);
  await page.waitForTimeout(1500);
  await expect(flashed(page).first()).toBeVisible();
  await expect(flashed(page)).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator(`.sheet--current .w[data-v="${kursi}"]`).first()).toBeVisible();

  // يُحفظ في السجل كما كُتب
  await clickTopbar(page, 'بحث في المصحف');
  await expect(page.locator('.searchov__histItem', { hasText: 'البقرة ٢٥٥' })).toBeVisible();
});

test('البحث بالسورة ورقم أكبر من آياتها: السورة وحدها ومعها عدد آياتها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  const box = page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام');
  await box.fill('البقرة 300');
  await expect(page.locator('.searchov__sura')).toHaveText(['٢سورة البقرة']);
  await expect(page.locator('.searchov__suraNote')).toHaveText('سورة البقرة ٢٨٦ آية');
  await expect(page.locator('.searchov__verse')).toHaveCount(0);
  await box.fill('العصر ٤');
  await expect(page.locator('.searchov__suraNote')).toHaveText('سورة العصر ٣ آيات');
  // والرقم الصحيح لا ملاحظة معه
  await box.fill('العصر ٣');
  await expect(page.locator('.searchov__refHit')).toContainText('العصر ٣');
  await expect(page.locator('.searchov__suraNote')).toHaveCount(0);
  // ونتيجة السورة تنقل إلى أولها بلا تمييز
  await box.fill('البقرة 300');
  await page.locator('.searchov__sura').click();
  await expect.poll(() => shownPages(page)).toContain(2);
  await expect(page.locator('.w--flash')).toHaveCount(0);
});

test('نتيجة آية في البحث بالكلمات تُميَّز كذلك في صفحتها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await clickTopbar(page, 'بحث في المصحف');
  await page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام').fill('اصحاب الكهف والرقيم');
  await page.locator('.searchov__verse').first().click();
  await expect.poll(() => shownPages(page)).toContain(294);
  await expect(flashed(page).first()).toBeVisible();
  expect(await flashed(page).evaluateAll((els) => [...new Set(els.map((el) => Number(el.dataset.v)))])).toEqual([at(18, 9)]);
});

test.describe('الجوال الأفقي', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('الآية المميَّزة أسفل الصفحة تُحضر إلى منظر العين', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'مقاس واحد يكفي');
    await openApp(page, { 'hq.page': '1' });
    await clickTopbar(page, 'بحث في المصحف');
    // البقرة ٢٥٦ آخر آية في الصفحة ٤٢
    await page.getByPlaceholder('ابحث في المصحف بالكلمات والأرقام').fill('البقرة 256');
    await page.locator('.searchov__refHit').click();
    await expect.poll(() => shownPages(page)).toContain(42);
    await expect(flashed(page).first()).toBeInViewport();
  });
});

test('الملاحظات في القائمة الجانبية: تظهر بترتيب المصحف، وتُعدَّل وتُحذف', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.notes': { 5: 'ثانية', 1: 'أولى' } });
  await expect(page.locator('.sheet--current .w__notebook')).toHaveCount(2);
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الملاحظات' }).click();
  const rows = side(page).locator('.sidemenu__row');
  await expect(rows.locator('.sidemenu__rowText')).toHaveText(['أولى', 'ثانية']);

  await rows.first().getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await side(page).locator('.sidemenu__textarea').fill('أولى معدّلة');
  await side(page).getByRole('button', { name: 'حفظ' }).click();
  await expect(rows.first().locator('.sidemenu__rowText')).toHaveText('أولى معدّلة');
  expect(await stored(page, 'hq.notes')).toEqual({ 1: 'أولى معدّلة', 5: 'ثانية' });

  // إلغاء التعديل لا يغيّر شيئًا
  await rows.first().getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await side(page).locator('.sidemenu__textarea').fill('لن تُحفظ');
  await side(page).getByRole('button', { name: 'إلغاء' }).click();
  expect((await stored(page, 'hq.notes'))[1]).toBe('أولى معدّلة');

  await rows.nth(1).getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(rows).toHaveCount(1);
  expect(await stored(page, 'hq.notes')).toEqual({ 1: 'أولى معدّلة' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet--current .w[data-v="5"] .w__notebook')).toHaveCount(0);
  await expect(page.locator('.sheet--current .w[data-v="1"] .w__notebook')).toHaveCount(1);
});
