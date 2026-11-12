// أزرار النسخ: في صفحات المحتوى (المحتوى والآيات) وفي بطاقة الآية (التفسيران والمعاني والعمل والملاحظة).
// الحافظة محاكاة (helpers.js): يُقرأ ما نسخه التطبيق نصًّا كما سيُلصق
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { QURAN, clickDock, copied, isLaptop, longPress, openApp, pageVerses, toArabic } from './helpers.js';

const MUKHTASAR = JSON.parse(readFileSync('public/data/tafsir-mukhtasar.json', 'utf8'));
const MUYASSAR = JSON.parse(readFileSync('public/data/tafsir-muyassar.json', 'utf8'));
const plain = (v) => QURAN.verses[v].t.slice(0, -1).join(' ');
const sura = (v) => QURAN.suras[QURAN.verses[v].s - 1].name;
// ﴿آية (١) آية (٢)﴾ [السورة: ١–٢] لكل سورة، مفصولة بسطر فارغ
function versesText(list) {
  const groups = [];
  for (const v of list) {
    if (groups.at(-1)?.s === QURAN.verses[v].s) groups.at(-1).vs.push(v);
    else groups.push({ s: QURAN.verses[v].s, vs: [v] });
  }
  return groups
    .map(({ vs }) => {
      const a = QURAN.verses[vs[0]].a;
      const b = QURAN.verses[vs.at(-1)].a;
      return `﴿${vs.map((v) => `${plain(v)} (${toArabic(QURAN.verses[v].a)})`).join(' ')}﴾ [${sura(vs[0])}: ${toArabic(a)}${b !== a ? `–${toArabic(b)}` : ''}]`;
    })
    .join('\n\n');
}
const oneVerse = (v) => `﴿${plain(v)}﴾ [${sura(v)}: ${toArabic(QURAN.verses[v].a)}]`;
const toast = (page) => page.locator('.toast');
const study = (page) => page.locator('section.study');

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('صفحات المحتوى: «نسخ الآيات» ينسخ آيات الصفحة الظاهرة بصيغة ﴿…﴾ [السورة: رقم]', async ({ page }, testInfo) => {
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('button', { name: 'نسخ الآيات' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  const shown = isLaptop(testInfo) ? [...pageVerses(1), ...pageVerses(2)] : pageVerses(1);
  expect(await copied(page)).toBe(versesText(shown));
  // علامة الآية الخاصة بخط المصحف لا تُنسخ
  const text = await copied(page);
  for (const v of shown) expect(text).not.toContain(QURAN.verses[v].t.at(-1));
});

test('صفحات المحتوى: نسخ التفسير (المختصر والميسّر) والمعاني والعمل للمقدار المحدد', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.contentRange', '[1,3]'));
  await page.reload();
  await clickDock(page, 'صفحات المحتوى');

  await study(page).getByRole('button', { name: 'نسخ التفسير' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  const mk = [];
  for (const v of [1, 2, 3]) if (mk.at(-1) !== MUKHTASAR.verses[v]) mk.push(MUKHTASAR.verses[v]);
  expect(await copied(page)).toBe(mk.join('\n\n'));

  await study(page).getByRole('radio', { name: 'الميسّر' }).click();
  await study(page).getByRole('button', { name: 'نسخ التفسير' }).click();
  const my = [1, 2, 3].map((v) => MUYASSAR.verses[v].split(MUYASSAR.quote[0]).join('﴿').split(MUYASSAR.quote[1]).join('﴾'));
  expect(await copied(page)).toBe(my.join('\n\n'));

  await study(page).getByRole('tab', { name: 'معاني الكلمات' }).click();
  await study(page).getByRole('button', { name: 'نسخ المعاني' }).click();
  const meanings = await copied(page);
  expect(meanings.split('\n').length).toBeGreaterThan(1);
  for (const line of meanings.split('\n')) expect(line).toMatch(/^.+: .+$/);

  await study(page).getByRole('tab', { name: 'العمل بالآيات' }).click();
  await study(page).getByRole('button', { name: 'نسخ العمل' }).click();
  expect(await copied(page)).toMatch(/^• داوِم على حمد الله/);

  await study(page).getByRole('button', { name: 'نسخ الآيات' }).click();
  expect(await copied(page)).toBe(versesText([1, 2, 3]));
});

test('خارج نطاق المذكرات: زر نسخ المحتوى معطّل ونسخ الآيات يعمل', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.page', '300'));
  await page.reload();
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('tab', { name: 'معاني الكلمات' }).click();
  await expect(study(page).getByRole('button', { name: 'نسخ المعاني' })).toBeDisabled();
  await study(page).getByRole('button', { name: 'نسخ الآيات' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
});

test('بطاقة الآية: نسخ كل تفسير مع الآية، ونسخ المعاني والعمل', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await card.locator('.vcard__copy').first().click();
  await expect(toast(page)).toHaveText('نُسخ المختصر في تفسير القرآن الكريم');
  expect(await copied(page)).toBe(`${oneVerse(1)}\n\nالمختصر في تفسير القرآن الكريم:\n${MUKHTASAR.verses[1]}`);
  await card.locator('.vcard__copy').nth(1).click();
  await expect(toast(page)).toHaveText('نُسخ التفسير الميسّر');
  expect(await copied(page)).toMatch(new RegExp(`^${oneVerse(1).replace(/[[\]()]/g, '\\$&')}\\n\\nالتفسير الميسّر:\\n`));
  await page.keyboard.press('Escape');

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  await page.getByRole('dialog', { name: 'معاني الكلمات' }).getByRole('button', { name: 'نسخ' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  expect(await copied(page)).toMatch(new RegExp(`^﴿${plain(1)}﴾ \\[الفاتحة: ٢\\]\\n\\nمعاني الكلمات:\\n.+: .+`));
  await page.keyboard.press('Escape');

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'عمل' }).click();
  await page.getByRole('dialog', { name: 'العمل بالآيات' }).getByRole('button', { name: 'نسخ' }).click();
  expect(await copied(page)).toMatch(/\n\nالعمل بالآيات:\n• داوِم على حمد الله/);
});

test('بطاقة الملاحظة: نسخ الملاحظة مع آيتها', async ({ page }) => {
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  // لا زر نسخ قبل الكتابة
  await expect(page.getByRole('dialog', { name: 'ملاحظة' }).getByRole('button', { name: 'نسخ' })).toHaveCount(0);
  await page.locator('.vcard__textarea').fill('تأمل هذه الآية');
  await page.getByRole('dialog', { name: 'ملاحظة' }).getByRole('button', { name: 'نسخ' }).click();
  await expect(toast(page)).toHaveText('نُسخت الملاحظة');
  expect(await copied(page)).toBe(`تأمل هذه الآية\n\n${oneVerse(2)}`);
});

test('بلا واجهة الحافظة: يُنسخ بالطريقة البديلة، وإن تعذّر ظهرت «تعذّر النسخ»', async ({ page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    window.__execOk = true;
    document.execCommand = (cmd) => cmd === 'copy' && window.__execOk;
  });
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('button', { name: 'نسخ الآيات' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  await page.evaluate(() => (window.__execOk = false));
  await study(page).getByRole('button', { name: 'نسخ التفسير' }).click();
  await expect(toast(page)).toHaveText('تعذّر النسخ');
});
