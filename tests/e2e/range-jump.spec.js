// الانتقال التلقائي إلى بداية المقدار (#13):
// • صفحات المحتوى: عند اكتمال المقدار (اختيار النهاية) ينتقل المصحف خلفها إلى صفحة أول آية فيه
//   (وزوجها في اللابتوب)، فإذا أُغلقت وُجد المقدار أمامه وما خارجه مُخفَت. واختيار البداية وحده لا يحرّكه.
// • الاستماع: تحديد المقدار لا يحرّك المصحف؛ وعند «تشغيل» ينتقل فورًا، قبل الصوت، إلى أول آية فيه.
// • وإن كانت أول آية ظاهرة أصلًا فلا انتقال، وبلا مقدار يبدأ الاستماع من الظاهر.
import { test, expect } from '@playwright/test';
import { QURAN, clickDock, isLaptop, openApp, pickVerse, savedPage, shownPages, stored, word } from './helpers.js';

const at = (s, a) => QURAN.verses.findIndex((x) => x.s === s && x.a === a);
const pageOf = (v) => QURAN.verses[v].p;
// الصفحات الظاهرة المتوقعة لصفحة p: هي وحدها في الجوال، وزوجها (الفردية أولًا) في اللابتوب
const expectedShown = (p, laptop) => (laptop ? [p % 2 ? p : p - 1, p % 2 ? p + 1 : p] : [p]);
// آية تقع في صفحة زوجية (يسرى)، ليُختبر أن اللابتوب ينتقل إلى زوجها كاملًا
const KAHF_EVEN = (() => {
  for (let a = 1; a <= 110; a++) if (pageOf(at(18, a)) % 2 === 0) return at(18, a);
  throw new Error('no even page');
})();

const study = (page) => page.locator('section.study');
const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });

async function setRange(container, page, a, b) {
  await container.getByRole('button', { name: /البداية/ }).click();
  await pickVerse(page, a);
  await container.getByRole('button', { name: /النهاية/ }).click();
  await pickVerse(page, b);
}

test.describe('صفحات المحتوى', () => {
  test('اكتمال المقدار ينقل المصحف خلفها إلى أول آية فيه، واختيار البداية وحده لا يحرّكه', async ({ page }, testInfo) => {
    const laptop = isLaptop(testInfo);
    await openApp(page, { 'hq.page': '1' });
    await clickDock(page, 'صفحات المحتوى');
    const start = KAHF_EVEN;
    const end = start + 3;

    await study(page).getByRole('button', { name: /البداية/ }).click();
    await pickVerse(page, start);
    expect(await shownPages(page)).toEqual(expectedShown(1, laptop));
    expect(await savedPage(page)).toBe(1);

    await study(page).getByRole('button', { name: /النهاية/ }).click();
    await pickVerse(page, end);
    // صفحات المحتوى باقية مفتوحة، ومحتواها من أول آية في المقدار
    await expect(study(page)).toHaveClass(/study--open/);
    await expect(study(page).locator('.study__item')).toHaveCount(4);
    await expect(study(page).locator('.study__body')).toHaveJSProperty('scrollTop', 0);
    await expect.poll(() => shownPages(page)).toEqual(expectedShown(pageOf(start), laptop));

    await page.keyboard.press('Escape');
    await expect(word(page, start)).not.toHaveClass(/w--out/);
    await expect(word(page, end)).not.toHaveClass(/w--out/);
    await expect(word(page, end + 1)).toHaveClass(/w--out/);
  });

  test('تعديل البداية بعد اكتمال المقدار: ينتقل عند اختيار النهاية الجديدة', async ({ page }, testInfo) => {
    const laptop = isLaptop(testInfo);
    await openApp(page, { 'hq.page': '1', 'hq.contentRange': [0, 2] });
    await clickDock(page, 'صفحات المحتوى');
    const later = at(18, 30);
    await study(page).getByRole('button', { name: /البداية/ }).click();
    await pickVerse(page, later);
    // البداية وحدها: المقدار ناقص والمصحف مكانه
    expect(await stored(page, 'hq.contentRange')).toEqual([later]);
    expect(await shownPages(page)).toEqual(expectedShown(1, laptop));
    await study(page).getByRole('button', { name: /النهاية/ }).click();
    await pickVerse(page, later + 2);
    expect(await stored(page, 'hq.contentRange')).toEqual([later, later + 2]);
    await expect.poll(() => shownPages(page)).toEqual(expectedShown(pageOf(later), laptop));
  });

  test('المقدار داخل الصفحة الظاهرة: لا انتقال', async ({ page }, testInfo) => {
    await openApp(page, { 'hq.page': '3' });
    const verses = QURAN.verses.map((x, i) => i).filter((i) => pageOf(i) === 3);
    await clickDock(page, 'صفحات المحتوى');
    await setRange(study(page), page, verses[2], verses[4]);
    await page.waitForTimeout(400);
    expect(await shownPages(page)).toEqual(expectedShown(3, isLaptop(testInfo)));
  });

  test('في اللابتوب: بداية في الصفحة اليسرى من الزوج الظاهر لا تقلبه', async ({ page }, testInfo) => {
    test.skip(!isLaptop(testInfo), 'الزوج للابتوب');
    await openApp(page, { 'hq.page': '3' });
    const left = QURAN.verses.map((x, i) => i).filter((i) => pageOf(i) === 4);
    await clickDock(page, 'صفحات المحتوى');
    await setRange(study(page), page, left[0], left[2]);
    await page.waitForTimeout(400);
    expect(await shownPages(page)).toEqual([3, 4]);
  });
});

test.describe('الاستماع', () => {
  test('تحديد المقدار لا يحرّك المصحف، و«تشغيل» ينقله فورًا إلى أول آية فيه ثم يبدأ منها', async ({ page }, testInfo) => {
    const laptop = isLaptop(testInfo);
    await openApp(page, { 'hq.page': '1' });
    await clickDock(page, 'الاستماع للآيات');
    const start = KAHF_EVEN;
    await setRange(listen(page), page, start, start + 2);
    await page.waitForTimeout(300);
    expect(await shownPages(page)).toEqual(expectedShown(1, laptop));

    // يُوقَف الصوت المحاكى قبل بدء التشغيل: الانتقال يحدث ولو لم يبدأ أي مقطع بعد
    await page.evaluate(() => {
      HTMLMediaElement.prototype.play = function () {
        return new Promise(() => {}); // لا يبدأ أبدًا
      };
    });
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await expect.poll(() => shownPages(page)).toEqual(expectedShown(pageOf(start), laptop));
    expect(await savedPage(page)).toBe(pageOf(start)); // الموضع يُحفظ برقم الصفحة نفسها، والزوج يُعرض حولها
    // نافذة الاستماع باقية مفتوحة، والآية الأولى هي الجارية
    await expect(listen(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(word(page, start)).toHaveClass(/w--playing/);
  });

  test('المقدار يبدأ في الصفحة الظاهرة: لا انتقال', async ({ page }, testInfo) => {
    await openApp(page, { 'hq.page': '1' });
    await clickDock(page, 'الاستماع للآيات');
    await setRange(listen(page), page, 3, 5);
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await page.keyboard.press('Escape');
    await expect(word(page, 3)).toHaveClass(/w--playing/);
    expect(await shownPages(page)).toEqual(expectedShown(1, isLaptop(testInfo)));
  });

  test('بلا مقدار: يبدأ من الصفحة الظاهرة بلا انتقال', async ({ page }, testInfo) => {
    await openApp(page, { 'hq.page': '250' });
    const shown = await shownPages(page);
    await clickDock(page, 'الاستماع للآيات');
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await page.keyboard.press('Escape');
    const first = QURAN.verses.findIndex((x) => x.p === shown[0]);
    await expect(word(page, first)).toHaveClass(/w--playing/);
    expect(await shownPages(page)).toEqual(shown);
    void testInfo;
  });

  test('مقدار صفحات المحتوى لا يتأثر بانتقال الاستماع، والإخفات يبقى له وحده', async ({ page }) => {
    await openApp(page, { 'hq.page': '1', 'hq.contentRange': [0, 2], 'hq.range': [KAHF_EVEN, KAHF_EVEN + 1] });
    await clickDock(page, 'الاستماع للآيات');
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    await page.keyboard.press('Escape');
    await expect(word(page, KAHF_EVEN)).toHaveClass(/w--playing/);
    // الكهف خارج مقدار صفحات المحتوى (الفاتحة ١–٣): مُخفَتة والتظليل خلفها
    await expect(word(page, KAHF_EVEN)).toHaveClass(/w--out/);
    expect(await stored(page, 'hq.contentRange')).toEqual([0, 2]);
  });
});
