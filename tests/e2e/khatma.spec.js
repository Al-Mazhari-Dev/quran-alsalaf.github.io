// الختمة (ورد يومي): تبويبات القائمة أسفلها، وإنشاء الختمة بالأيام وبالصفحات، وصفحة الورد المحدودة،
// وإتمام الورد، والتأخر، وتعديل الخطة وحذفها، والختم
import { expect, test } from '@playwright/test';
import { clickTopbar, isLaptop, longPress, openApp, savedPage, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');
const kpage = (page) => page.locator('.kpage');
const TODAY = new Date('2026-11-12T10:00:00');

// ختمة ورد محفوظة: الافتراضي بالأيام ٣٠ من اليوم، وما يمرر يبدل
const wird = (over = {}) => [
  { type: 'wird', created: '2026-11-12', mode: 'days', value: 30, from: 1, planStart: '2026-11-12', done: 0, doneBefore: 0, lastDone: null, finished: null, ...over },
];

async function open(page, storage = {}) {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, storage);
}

async function openKhatmaTab(page) {
  await clickTopbar(page, 'القائمة');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await side(page).getByRole('tab', { name: 'الختمة' }).click();
}

// الصفحات الظاهرة في صفحة الختمة (والباهتة منها خارج الورد)
const kShown = (page, sel = '.sheet--current') =>
  kpage(page)
    .locator(sel)
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('aria-label').replace(/[^٠-٩]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))));
async function waitKpage(page) {
  await expect(kpage(page).locator('.sheet--current .mushaf-page:not(.mushaf-page--pending)').first()).toBeVisible();
  // وانتهت حركة دخول الصفحة (تنزلق من الجانب)
  await page.waitForFunction(() => !document.querySelector('.kpage')?.getAnimations().length);
}

test('تبويبات القائمة اليمنى في أسفلها بترتيبها، وتفتح على آخر تبويب استعمل', async ({ page }) => {
  await open(page);
  await clickTopbar(page, 'القائمة');
  const tabs = side(page).getByRole('tab');
  await expect(tabs).toHaveText(['الختمة', 'السور', 'العلامات', 'الملاحظات']);
  await expect(side(page).getByRole('tab', { name: 'السور' })).toHaveAttribute('aria-selected', 'true');
  // الشريط أسفل القائمة: تحت محتواها وملاصق لأسفل الشاشة
  const bar = await side(page).locator('.sidemenu__tabs').boundingBox();
  const body = await side(page).locator('.sidemenu__body').boundingBox();
  expect(bar.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  expect(bar.y + bar.height).toBeGreaterThan(page.viewportSize().height - 2);

  await side(page).getByRole('tab', { name: 'الختمة' }).click();
  await page.keyboard.press('Escape');
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await page.reload();
  await clickTopbar(page, 'القائمة');
  await expect(side(page).getByRole('tab', { name: 'الختمة' })).toHaveAttribute('aria-selected', 'true');
  await expect(side(page).getByRole('button', { name: 'ابدأ الختمة' })).toBeVisible();
});

test('إنشاء ختمة بالأيام: ٣٠ يوما افتراضيا، ويظهر الورد اليومي ويوم الختم بالميلادي والهجري', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  await expect(side(page).getByRole('radio', { name: 'بالأيام' })).toHaveAttribute('aria-checked', 'true');
  // بلا جملة شرح في نموذج الإنشاء (بطلب صاحب المشروع)
  await expect(side(page).locator('.khatma__hint')).toHaveCount(0);
  await expect(side(page).getByRole('radio', { name: '٣٠ يوما' })).toHaveAttribute('aria-checked', 'true');
  const summary = side(page).locator('.khatma__summary');
  await expect(summary).toContainText('٣٠ يوما، ٢٠–٢١ صفحة يوميا');
  // نصوص الختمة بلا تشكيل (بطلب صاحب المشروع)
  const noTashkeel = async (loc) => expect(await loc.innerText()).not.toMatch(/[\u064B-\u0652]/);
  await noTashkeel(side(page).locator('.khatma'));
  await expect(summary).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await expect(summary).toContainText('٢ رجب ١٤٤٨هـ');

  await side(page).getByRole('radio', { name: '٧ أيام' }).click();
  await expect(summary).toContainText('٧ أيام، ٨٦–٨٧ صفحة يوميا');
  await expect(summary).toContainText('الأربعاء ١٨ نوفمبر ٢٠٢٦م');

  await side(page).getByRole('radio', { name: '٣٠ يوما' }).click();
  await side(page).getByRole('button', { name: 'ابدأ الختمة' }).click();
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('الورد ١ من ٣٠');
  await expect(card).toContainText('ورد اليوم');
  await expect(card).toContainText('من الصفحة ١ إلى ٢٠');
  await expect(card).toContainText('الفاتحة – البقرة');
  await expect(card).toContainText('على الخطة');
  await expect(card).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await noTashkeel(side(page).locator('.khatma'));
  expect(await stored(page, 'hq.khatmas')).toEqual([expect.objectContaining({ type: 'wird', mode: 'days', value: 30, from: 1, done: 0 })]);

  // يبقى بعد إعادة الفتح
  await page.reload();
  await clickTopbar(page, 'القائمة');
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ١ إلى ٢٠');
});

test('إنشاء ختمة بالصفحات يوميا، وبعدد يكتب باليد', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  await side(page).getByRole('radio', { name: 'بالصفحات يوميا' }).click();
  await side(page).getByRole('radio', { name: '١٠ صفحات' }).click();
  const summary = side(page).locator('.khatma__summary');
  await expect(summary).toContainText('٦١ يوما، ١٠ صفحات يوميا');

  await side(page).getByRole('radio', { name: 'عدد آخر' }).click();
  const input = side(page).locator('.khatma__custom input');
  await input.fill('');
  await expect(side(page).getByRole('button', { name: 'ابدأ الختمة' })).toBeDisabled();
  await input.fill('50');
  await expect(summary).toContainText('١٣ يوما، ٥٠ صفحة يوميا');
  await side(page).getByRole('button', { name: 'ابدأ الختمة' }).click();
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ١ إلى ٥٠');
  await expect(side(page).locator('.khatma__card')).toContainText('الورد ١ من ١٣');
});

test('صفحة الورد: تفتح على أوله ولا تقلب خارجه، وفيها «أتممت الورد» في آخره', async ({ page }, testInfo) => {
  // الورد الحالي من ٢٢ إلى ٢٧ (ست صفحات من الصفحة ٤، أتم منها ثلاثة أوراد في أربعة أيام)
  await open(page, { 'hq.page': '300', 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 6, from: 4, done: 3, lastDone: '2026-11-11', planStart: '2026-11-08' }) });
  await clickTopbar(page, 'القائمة');
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ٢٢ إلى ٢٧');
  await side(page).getByRole('button', { name: 'اقرأ الورد' }).click();
  await expect(kpage(page)).toBeVisible();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await waitKpage(page);
  await expect(kpage(page).locator('.kpage__title h2')).toHaveText('ورد اليوم');

  if (isLaptop(testInfo)) {
    // صفحتان: الزوج ٢١–٢٢ وصفحة ٢١ خارج الورد باهتة
    expect(await kShown(page)).toEqual([21, 22]);
    expect(await kShown(page, '.sheet--current.sheet--outside')).toEqual([21]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ١ من ٦');
  } else {
    expect(await kShown(page)).toEqual([22]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ١ من ٦');
  }
  // لا رجوع قبل أول الورد
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect((await kShown(page)).includes(22)).toBe(true);
  await expect(kpage(page).getByRole('button', { name: /أتممت الورد/ })).toHaveCount(0);

  // إلى آخره، ولا يتجاوز
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(380);
  }
  await waitKpage(page);
  if (isLaptop(testInfo)) {
    expect(await kShown(page)).toEqual([27, 28]);
    expect(await kShown(page, '.sheet--current.sheet--outside')).toEqual([28]);
  } else {
    expect(await kShown(page)).toEqual([27]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ٦ من ٦');
  }
  // القراءة في الورد لا تغير آخر موضع في المصحف
  expect(await savedPage(page)).toBe(300);

  await kpage(page).getByRole('button', { name: /أتممت الورد/ }).click();
  await expect(kpage(page)).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveText('أحسنت، تم تسجيل الورد');
  // يرجع إلى تبويب الختمة: الورد التالي
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('أتممت ورد اليوم');
  await expect(card).toContainText('الورد التالي');
  await expect(card).toContainText('من الصفحة ٢٨ إلى ٣٣');
  expect(await stored(page, 'hq.khatmas')).toEqual([expect.objectContaining({ done: 4, lastDone: '2026-11-12' })]);
  expect(await savedPage(page)).toBe(300);
});

test('صفحة الورد تغلق بزر الرجوع وEsc وزر رجوع المتصفح، فيرجع إلى تبويب الختمة', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird() });
  for (const close of ['button', 'esc', 'history']) {
    await clickTopbar(page, 'القائمة');
    await side(page).getByRole('button', { name: 'اقرأ الورد' }).click();
    await waitKpage(page);
    if (close === 'button') await kpage(page).getByRole('button', { name: 'رجوع' }).click();
    else if (close === 'esc') await page.keyboard.press('Escape');
    else await page.goBack();
    await expect(kpage(page)).toHaveCount(0);
    await expect(side(page)).toHaveClass(/sidemenu--open/);
    await expect(side(page).getByRole('tab', { name: 'الختمة' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  }
});

test('الضغط المطول على آية في صفحة الورد يفتح مربعها بلا «تشغيل»', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 3, from: 50 }) });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('button', { name: 'اقرأ الورد' }).click();
  await waitKpage(page);
  const v = await kpage(page).locator('.sheet--current .w[data-v]').first().getAttribute('data-v');
  const box = await kpage(page).locator(`.sheet--current .w[data-v="${v}"]`).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const menu = page.locator('.vmenu__picker');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['تفسير', 'معاني', 'عمل', 'ملاحظة', 'علامة']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(kpage(page)).toBeVisible();
  // ومربع الآية في المصحف نفسه بقي بتشغيله
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await longPress(page, 0);
  await expect(page.locator('.vmenu__picker').getByRole('menuitem').first()).toHaveText('تشغيل');
});

test('إتمام الورد من البطاقة، والتأخر والتقدم على الخطة', async ({ page }) => {
  // بدأت الخطة قبل ثلاثة أيام ولم يتم شيء: متأخر ٣ أيام، ويوم الختم يتأخر معه
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ planStart: '2026-11-09', created: '2026-11-09' }) });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('متأخر عن الخطة ٣ أيام');
  await expect(card).toContainText('من الصفحة ١ إلى ٢٠');
  await expect(card).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  for (let i = 0; i < 3; i++) await card.getByRole('button', { name: 'أتممت الورد' }).click();
  await expect(card).toContainText('أتممت ورد اليوم');
  await expect(card).toContainText('من الصفحة ٦١ إلى ٨٠');
  await expect(card).toContainText('٩٪، قرأت ٦٠ من ٦٠٤ صفحات');
  await card.getByRole('button', { name: 'أتممت الورد' }).click();
  await card.getByRole('button', { name: 'أتممت الورد' }).click();
  await expect(card).toContainText('متقدم على الخطة يوم واحد');
});

test('تعديل الخطة يعيد التقسيم مما بقي، وحذف الختمة بتأكيد', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ done: 2, lastDone: '2026-11-11' }) });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('من الصفحة ٤١ إلى ٦٠');
  await card.getByRole('button', { name: 'تعديل الخطة' }).click();
  await expect(card).toContainText('تعديل الخطة');
  await expect(card).toContainText('من الصفحة ٤١');
  await card.getByRole('radio', { name: 'بالصفحات يوميا' }).click();
  await card.getByRole('radio', { name: '٢٠ صفحة' }).click();
  await card.getByRole('button', { name: 'حفظ الخطة' }).click();
  await expect(page.locator('.toast')).toHaveText('تم تعديل الخطة');
  await expect(card).toContainText('من الصفحة ٤١ إلى ٦٠');
  await expect(card).toContainText('الورد ٣ من ٣١');
  await expect(card).toContainText('قرأت ٤٠ من ٦٠٤');

  // إلغاء التعديل يبقي الخطة
  await card.getByRole('button', { name: 'تعديل الخطة' }).click();
  await card.getByRole('button', { name: 'إلغاء' }).click();
  await expect(card).toContainText('الورد ٣ من ٣١');

  await card.getByRole('button', { name: 'حذف الختمة' }).click();
  await card.getByRole('button', { name: 'لا' }).click();
  await expect(card).toContainText('الورد ٣ من ٣١');
  await card.getByRole('button', { name: 'حذف الختمة' }).click();
  await card.getByRole('button', { name: 'نعم، احذفها' }).click();
  await expect(side(page).getByRole('button', { name: 'ابدأ الختمة' })).toBeVisible();
  expect(await stored(page, 'hq.khatmas')).toEqual([]);
});

test('إتمام آخر ورد يختم المصحف: تهنئة وعدد الختمات، ثم ختمة جديدة', async ({ page }) => {
  // ثلاث صفحات يوميا من ٥٩٨: أتم وردان، وبقي الأخير (٦٠٤ وحدها)
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 3, from: 598, done: 2, lastDone: '2026-11-11' }), 'hq.khatmasDone': { wird: 2 } });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('الصفحة ٦٠٤');
  await expect(side(page).locator('.khatma__count')).toHaveText('أتممت قبلها ختمتين');
  await side(page).getByRole('button', { name: 'اقرأ الورد' }).click();
  await waitKpage(page);
  // ورد بصفحة واحدة: أوله آخره، فزر الإتمام ظاهر من البداية
  await kpage(page).getByRole('button', { name: /أتممت الورد/ }).click();
  await expect(page.locator('.toast')).toHaveText('أتممت الختمة، تقبل الله منك');
  await expect(card).toContainText('أتممت الختمة');
  await expect(card).toContainText('الخميس ١٢ نوفمبر ٢٠٢٦م');
  await expect(card).toContainText('أتممت ٣ ختمات في هذا التطبيق');
  await card.getByRole('button', { name: 'ابدأ ختمة جديدة' }).click();
  await expect(side(page).getByRole('button', { name: 'ابدأ الختمة' })).toBeVisible();
  expect(await stored(page, 'hq.khatmasDone')).toEqual({ wird: 3 });
});
