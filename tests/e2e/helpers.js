// أدوات مشتركة لاختبارات المتصفح
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// بيانات المصحف نفسها التي يحمّلها التطبيق: لمعرفة آيات كل صفحة وأرقامها
export const QURAN = JSON.parse(readFileSync(new URL('../../public/data/quran.json', import.meta.url), 'utf8'));
export function pageVerses(p) {
  const out = [];
  for (const line of QURAN.pages[p - 1]) {
    if (!line.g) continue;
    for (const [v] of line.g) if (out.at(-1) !== v) out.push(v);
  }
  return out;
}

/*
  محاكاة الصوت: لا يُشغَّل صوت حقيقي ولا يُطلب ملف من الشبكة. كل عنصر صوت يُسجَّل في
  window.__audio، ويُحفظ كل رابط أُسند إليه في srcs، و__audio.end() تُنهي المقطع الجاري
  (كأن القارئ أتمّ الآية) فينتقل المشغّل إلى ما بعده.
*/
function audioMock() {
  const els = [];
  const srcs = [];
  window.__audio = {
    els,
    srcs,
    current: () => els[els.length - 1],
    end: () => els[els.length - 1]?.dispatchEvent(new Event('ended')),
  };
  HTMLMediaElement.prototype.play = function play() {
    this.__mockPlaying = true;
    setTimeout(() => this.dispatchEvent(new Event('playing')), 0);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause() {
    this.__mockPlaying = false;
  };
  HTMLMediaElement.prototype.load = function load() {};
  const Real = window.Audio;
  window.Audio = function Audio() {
    const el = new Real();
    let src = '';
    Object.defineProperty(el, 'src', {
      get: () => src,
      set: (v) => {
        src = v;
        srcs.push(v);
      },
    });
    els.push(el);
    return el;
  };
}

/*
  محاكاة الحافظة: ما ينسخه التطبيق يُحفظ في window.__clip (آخره __clip.at(-1))، بلا حاجة لإذن
  الحافظة في المتصفح الآلي. clipboardFails: تُرفض الكتابة كمتصفح لا يتيح الحافظة.
*/
function clipboardMock(fails) {
  window.__clip = [];
  const clip = {
    writeText: (t) => (fails ? Promise.reject(new Error('denied')) : (window.__clip.push(t), Promise.resolve())),
    readText: () => Promise.resolve(window.__clip.at(-1) ?? ''),
  };
  Object.defineProperty(navigator, 'clipboard', { get: () => clip, configurable: true });
}
export const copied = (page) => page.evaluate(() => window.__clip.at(-1));

// يجهّز الصفحة قبل فتحها: محاكاة الصوت، وبيانات محلية تُكتب مرة واحدة فقط (لا عند إعادة الفتح)
export async function prepare(page, storage = {}) {
  await page.route(/everyayah\.com|tarteel\.ai/, (r) => r.abort());
  await page.addInitScript(audioMock);
  await page.addInitScript(clipboardMock, false);
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, { 'hq.bg': 'beige', 'hq.accent': 'blue', ...storage });
}

// يفتح التطبيق وينتظر ظهور المصحف بخطه (صفحة أو صفحتين)
export async function openApp(page, storage = {}) {
  await prepare(page, storage);
  await page.goto('/');
  await waitMushaf(page);
}

export async function waitMushaf(page) {
  await expect(page.locator('.sheet--current .mushaf-page:not(.mushaf-page--pending)').first()).toBeVisible();
  await expect(page.locator('.splash')).toHaveCount(0);
}

export const isLaptop = (testInfo) => testInfo.project.name === 'laptop';

// رقم الصفحة المحفوظ (آخر موضع)
export const savedPage = (page) => page.evaluate(() => Number(localStorage.getItem('hq.page')));
export const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

// الصفحات الظاهرة الآن بأرقامها (من تسمية كل ورقة ظاهرة)
export async function shownPages(page) {
  return page.locator('.sheet--current').evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('aria-label').replace(/[^٠-٩]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  );
}

// يُظهر الأزرار العائمة بتحريك الفأرة فوق المصحف
export async function showChrome(page) {
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.move(vp.width / 2 + 30, vp.height / 2 + 10);
  await expect(page.locator('.dock.dock--open')).toBeVisible();
}

export async function clickDock(page, name) {
  await showChrome(page);
  await page.locator('.dock').getByRole('button', { name }).click();
}

export async function clickTopbar(page, name) {
  await showChrome(page);
  await page.locator('.topbar').getByRole('button', { name }).click();
}

// كلمة من آية في الصفحة الظاهرة
export const word = (page, v) => page.locator(`.sheet--current .w[data-v="${v}"]`).first();

// ضغط مطوّل على آية (بالفأرة أو الإصبع: الحدث نفسه pointerdown ثم انتظار)
export async function longPress(page, v) {
  const box = await word(page, v).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('.vmenu__picker')).toBeVisible();
}

// سحب أفقي على المصحف: dx موجب = من اليسار نحو اليمين (يأتي بالصفحة التالية)
export async function drag(page, dx) {
  const vp = page.viewportSize();
  const y = vp.height * 0.55;
  const x0 = vp.width / 2 - dx / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x0 + (dx * i) / 12, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

// اختيار آية من منتقي الآيات (بعد فتحه)
export async function pickVerse(page, v) {
  const s = QURAN.verses[v].s;
  // السور مطوية (RangePicker) إلا سورة الموضع الحالي: تُفتح سورة الآية بسهمها إن كانت مطوية
  const toggle = page.locator(`.rpick__sura[data-sura="${s}"] .rpick__toggle`);
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const btn = page.locator(`.rpick__sura[data-sura="${s}"] .rpick__verse`).filter({ has: page.locator('.rpick__num', { hasText: new RegExp(`^${toArabic(QURAN.verses[v].a)}$`) }) });
  await btn.first().click();
  await expect(page.locator('.rpick')).toHaveCount(0);
}

export const toArabic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
