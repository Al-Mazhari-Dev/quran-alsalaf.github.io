// اشتقاق الألوان والتباين: سكربت المظهر في index.html (يُشغَّل هنا كما في المتصفح) — والتبديل
// من الإعدادات (src/lib/appearance.js)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import DATA from '../../src/data/appearance.json';

const html = readFileSync('index.html', 'utf8');
const script = html
  .match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('var DATA = __APPEARANCE_DATA__;', `var DATA = ${JSON.stringify(DATA)};`);

function boot({ dark = false } = {}) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark });
  delete window.hqAppearance;
  document.head.innerHTML = '<meta name="theme-color" content="#F5EDDC">';
  // eslint-disable-next-line no-new-func
  new Function(script)();
}

// ---- حساب مستقل للتباين (WCAG) ----
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => v + ((b[i] - v) * p) / 100);
const lum = (c) => {
  const l = c.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// مقادير الاشتقاق لخلفية ولون: مقادير نوع الخلفية، وما يعدّله اللون منها لنفسه («بلا لون»)
const mixFor = (bg, accent) => ({ ...DATA.mix[bg.dark ? 'dark' : 'light'], ...accent.mix?.[bg.dark ? 'dark' : 'light'] });
// اللون الثانوي الفعلي: لون نص المصحف في «بلا لون»، وإلا درجة اللون لنوع الخلفية
const accentOf = (bg, accent) => (accent.ink ? bg.ink : bg.dark ? accent.dark : accent.light);
const cssVar = (name) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
});

describe('أول فتح والانتقال من المفتاح القديم', () => {
  it('بيج وذهبي عنبري على الجهاز الفاتح', () => {
    boot();
    expect(localStorage.getItem('hq.bg')).toBe('beige');
    expect(localStorage.getItem('hq.accent')).toBe('amber');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('بيج وذهبي عنبري على الجهاز الداكن أيضًا (لا يُقرأ وضع الجهاز)', () => {
    boot({ dark: true });
    expect(localStorage.getItem('hq.bg')).toBe('beige');
    expect(localStorage.getItem('hq.accent')).toBe('amber');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(cssVar('--accent')).toBe(DATA.accents.find((a) => a.id === 'amber').light);
  });
  it('من اختار الداكن سابقًا ينتقل إلى رصاصي ويُحذف المفتاح القديم', () => {
    localStorage.setItem('hq.theme', 'dark');
    boot();
    expect(localStorage.getItem('hq.bg')).toBe('gray');
    expect(localStorage.getItem('hq.theme')).toBeNull();
  });
  it('اختيار المستخدم يبقى ولو تغيّر إعداد النظام، وقيمة غير معروفة تعود للافتراضي', () => {
    localStorage.setItem('hq.bg', 'black');
    localStorage.setItem('hq.accent', 'nonexistent');
    boot({ dark: false });
    expect(document.documentElement.getAttribute('data-bg')).toBe('black');
    expect(localStorage.getItem('hq.accent')).toBe('amber');
  });
});

describe('التركيبات العشرون: الألوان المشتقة وتباينها', () => {
  it('أربعة ألوان و«بلا لون» آخرها، ولا «موف»', () => {
    expect(DATA.accents.map((a) => a.id)).toEqual(['blue', 'emerald', 'amber', 'maroon', 'none']);
    expect(DATA.accents.at(-1).name).toBe('بلا لون');
  });

  const combos = DATA.backgrounds.flatMap((b) => DATA.accents.map((a) => [b, a]));
  it.each(combos.map(([b, a]) => [b.id, a.id, b, a]))('%s + %s', (_b, _a, bg, accent) => {
    boot();
    const state = window.hqAppearance.apply(bg.id, accent.id);
    const root = document.documentElement;
    expect(root.getAttribute('data-bg')).toBe(bg.id);
    expect(root.getAttribute('data-accent')).toBe(accent.id);
    expect(root.getAttribute('data-theme')).toBe(bg.dark ? 'dark' : 'light');
    expect(cssVar('--bg')).toBe(bg.bg);
    expect(cssVar('--ink')).toBe(bg.ink);
    const accentHex = accentOf(bg, accent);
    expect(cssVar('--accent')).toBe(accentHex);
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(bg.bg);

    // نص المصحف على خلفيته: ٤٫٥ فأكثر
    expect(contrast(rgb(bg.ink), rgb(bg.bg))).toBeGreaterThanOrEqual(4.5);

    // لون التطبيق للنص: ٤٫٥ فأكثر على كل سطح قد يقع عليه
    const k = mixFor(bg, accent);
    const B = rgb(bg.bg);
    const layer = bg.dark ? [255, 255, 255] : [0, 0, 0];
    const s2 = mix(B, layer, k['surface-2']);
    const surfaces = [B, mix(B, layer, k.surface), s2, mix(B, layer, k['surface-3']), mix(s2, rgb(accentHex), k.soft)];
    const text = rgb(cssVar('--accent-text'));
    for (const s of surfaces) expect(contrast(text, s)).toBeGreaterThanOrEqual(4.5);

    // الآية الجارية في الاستماع: نصها مقروء فوق تظليلها (٤٫٨ فأكثر، مقرَّبًا كما يُرسم)، وتظليلها
    // أوضح بوضوح من تظليل المقررات، وتظليل المقررات ظاهر على الخلفية خفيف
    const A = rgb(accentHex);
    const over = (p) => mix(B, A, p).map(Math.round);
    expect(contrast(rgb(bg.ink), over(k.playing))).toBeGreaterThanOrEqual(4.8);
    expect(contrast(over(k.playing), B)).toBeGreaterThan(contrast(over(k.week), B) * 1.25);
    expect(k.week).toBeGreaterThan(0);
    expect(k.week).toBeLessThanOrEqual(10);
    expect(k).not.toHaveProperty('week-b');

    // مقادير الاشتقاق مكتوبة متغيراتٍ لـtokens.css
    for (const [name, v] of Object.entries(k)) expect(cssVar(`--k-${name}`)).toBe(`${v}%`);

    // ألوان خط المصحف: النص بلون نص المصحف، والزخرفة بلون التطبيق
    expect(state.colors.ink).toBe(bg.ink);
    expect(state.colors.ornament).toBe(accentHex);
    expect(state.colors.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(state.colors.dot).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('درجة اللون على الداكنة أفتح منها على الفاتحة', () => {
    for (const a of DATA.accents.filter((x) => !x.ink)) expect(lum(rgb(a.dark))).toBeGreaterThan(lum(rgb(a.light)));
  });

  it('«بلا لون»: كل ما يتبع اللون بدرجات لون نص المصحف — غامق على الفاتحتين وفاتح على الداكنتين', () => {
    boot();
    for (const bg of DATA.backgrounds) {
      const state = window.hqAppearance.apply(bg.id, 'none');
      expect(cssVar('--accent')).toBe(bg.ink);
      expect(cssVar('--accent-text')).toBe(bg.ink.toLowerCase());
      expect(state.colors.ornament).toBe(bg.ink);
      const ink = lum(rgb(bg.ink));
      const back = lum(rgb(bg.bg));
      if (bg.dark) expect(ink).toBeGreaterThan(back);
      else expect(ink).toBeLessThan(back);
      // التظليل والزخرفة رمادية: مزيج الخلفية ولون النص وحدهما، بلا لون ثالث
      const k = mixFor(bg, DATA.accents.find((a) => a.id === 'none'));
      expect(cssVar('--k-playing')).toBe(`${k.playing}%`);
      expect(state.colors.fill).toBe(
        '#' + mix(rgb(bg.bg), rgb(bg.ink), k['decor-fill']).map((v) => ('0' + Math.round(v).toString(16)).slice(-2)).join('')
      );
    }
  });
});

describe('انتقال من كان على «موف» (أُزيل)', () => {
  it('ينتقل إلى «بلا لون» ويُحفظ', () => {
    localStorage.setItem('hq.bg', 'gray');
    localStorage.setItem('hq.accent', 'mauve');
    boot();
    expect(localStorage.getItem('hq.accent')).toBe('none');
    expect(document.documentElement.getAttribute('data-accent')).toBe('none');
    expect(cssVar('--accent')).toBe('#E8E6E1');
  });
});

describe('التبديل من الإعدادات (src/lib/appearance.js)', () => {
  it('يطبّق ويحفظ، ويرفض القيم غير المعروفة', async () => {
    boot();
    const events = [];
    window.addEventListener('hq:appearance', (e) => events.push(e.detail));
    const { setBackground, setAccent, readAppearance, BACKGROUNDS, ACCENTS } = await import('../../src/lib/appearance.js');
    expect(BACKGROUNDS).toHaveLength(4);
    expect(ACCENTS).toHaveLength(5);
    setBackground('black');
    setAccent('maroon');
    expect(readAppearance()).toEqual({ bg: 'black', accent: 'maroon' });
    expect(localStorage.getItem('hq.bg')).toBe('black');
    expect(localStorage.getItem('hq.accent')).toBe('maroon');
    expect(events.at(-1).bg).toBe('black');
    expect(setBackground('pink')).toEqual({ bg: 'black', accent: 'maroon' });
    expect(localStorage.getItem('hq.bg')).toBe('black');
  });
});
