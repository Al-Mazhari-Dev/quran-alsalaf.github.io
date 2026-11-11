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
const cssVar = (name) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
});

describe('أول فتح والانتقال من المفتاح القديم', () => {
  it('بيج وأزرق على الجهاز الفاتح', () => {
    boot();
    expect(localStorage.getItem('hq.bg')).toBe('beige');
    expect(localStorage.getItem('hq.accent')).toBe('blue');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('رصاصي على الجهاز الداكن', () => {
    boot({ dark: true });
    expect(localStorage.getItem('hq.bg')).toBe('gray');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
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
    expect(localStorage.getItem('hq.accent')).toBe('blue');
  });
});

describe('التركيبات العشرون: الألوان المشتقة وتباينها', () => {
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
    const accentHex = bg.dark ? accent.dark : accent.light;
    expect(cssVar('--accent')).toBe(accentHex);
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(bg.bg);

    // نص المصحف على خلفيته: ٤٫٥ فأكثر
    expect(contrast(rgb(bg.ink), rgb(bg.bg))).toBeGreaterThanOrEqual(4.5);

    // لون التطبيق للنص: ٤٫٥ فأكثر على كل سطح قد يقع عليه
    const k = DATA.mix[bg.dark ? 'dark' : 'light'];
    const B = rgb(bg.bg);
    const layer = bg.dark ? [255, 255, 255] : [0, 0, 0];
    const s2 = mix(B, layer, k['surface-2']);
    const surfaces = [B, mix(B, layer, k.surface), s2, mix(B, layer, k['surface-3']), mix(s2, rgb(accentHex), k.soft)];
    const text = rgb(cssVar('--accent-text'));
    for (const s of surfaces) expect(contrast(text, s)).toBeGreaterThanOrEqual(4.5);

    // مقادير الاشتقاق مكتوبة متغيراتٍ لـtokens.css
    for (const [name, v] of Object.entries(k)) expect(cssVar(`--k-${name}`)).toBe(`${v}%`);

    // ألوان خط المصحف: النص بلون نص المصحف، والزخرفة بلون التطبيق
    expect(state.colors.ink).toBe(bg.ink);
    expect(state.colors.ornament).toBe(accentHex);
    expect(state.colors.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(state.colors.dot).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('درجة اللون على الداكنة أفتح منها على الفاتحة', () => {
    for (const a of DATA.accents) expect(lum(rgb(a.dark))).toBeGreaterThan(lum(rgb(a.light)));
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
