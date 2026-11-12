// حساب حجم الخط، وعرض الصفحة أو الصفحتين، وأزواج الصفحات — src/lib/layout.js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LINE_EM, SPREAD_MIN_FONT, isScrollMode, isSpreadMode, pageLayout, spreadArea, spreadStart } from '../../src/lib/layout.js';

const qcf = JSON.parse(readFileSync('public/data/qcf4.json', 'utf8'));
const quran = { qcf };
const META_H = 30;
const PAD_X = 3;
// كما يحسبها القارئ (src/components/Reader.jsx) من مساحته
const single = (box) => ({ w: box.w - PAD_X * 2, h: box.h - META_H });
const spread = (box) => isSpreadMode(quran, box, single(box), META_H);

describe('أزواج الصفحات', () => {
  it('الفردية يمينًا والزوجية يسارًا: ١–٢ … ٦٠٣–٦٠٤', () => {
    expect(spreadStart(1)).toBe(1);
    expect(spreadStart(2)).toBe(1);
    expect(spreadStart(3)).toBe(3);
    expect(spreadStart(4)).toBe(3);
    expect(spreadStart(603)).toBe(603);
    expect(spreadStart(604)).toBe(603);
    for (let p = 1; p <= 604; p++) {
      const s = spreadStart(p);
      expect(s % 2).toBe(1);
      expect(p - s).toBeGreaterThanOrEqual(0);
      expect(p - s).toBeLessThanOrEqual(1);
    }
  });
});

describe('حجم الخط', () => {
  it('واحد لكل الصفحات ويسع أعرض سطر في المصحف', () => {
    const area = { w: 384, h: 814 };
    const a = pageLayout(quran, 3, area);
    const b = pageLayout(quran, 500, area);
    expect(a.fontSize).toBe(b.fontSize);
    expect(a.fontSize * qcf.widest).toBeLessThanOrEqual(area.w);
    expect(a.width).toBeLessThanOrEqual(area.w);
  });

  it('يحكمه العرض في الجوال الطولي والارتفاعُ في الشاشة العريضة', () => {
    const phone = pageLayout(quran, 3, { w: 384, h: 814 });
    expect(phone.fontSize).toBe(Math.floor(((384 * 0.99) / qcf.widest) * 100) / 100);
    expect(phone.width).toBe(384);
    const wide = pageLayout(quran, 3, { w: 1400, h: 600 });
    expect(wide.fontSize).toBe(Math.floor((600 / 15 / LINE_EM) * 100) / 100);
    // العمود يضيق إلى عرضه الطبيعي ويتوسط
    expect(wide.width).toBeLessThan(1400);
    // الأسطر الخمسة عشر تسعها الشاشة
    expect(wide.pageHeight).toBeLessThanOrEqual(600 + 1);
  });

  it('وضع التمرير (الجوال الأفقي): الخط من العرض وحده والصفحة أطول من الشاشة', () => {
    const box = { w: 844, h: 390 };
    expect(isScrollMode(box)).toBe(true);
    expect(isScrollMode({ w: 390, h: 844 })).toBe(false);
    expect(isScrollMode({ w: 1024, h: 768 })).toBe(false); // لوح أفقي
    const l = pageLayout(quran, 3, { w: 838, h: 360 }, true);
    expect(l.fontSize).toBe(Math.floor(((838 * 0.99) / qcf.widest) * 100) / 100);
    expect(l.pageHeight).toBeGreaterThan(360);
  });

  it('الأسطر الناقصة توسَّط، وأسطر الفاتحة وأول البقرة كلها', () => {
    const one = pageLayout(quran, 1, { w: 384, h: 814 });
    const lines = qcf.pages[0].filter(Boolean).length;
    expect(one.shortLines.size).toBe(lines);
    const mid = pageLayout(quran, 50, { w: 384, h: 814 });
    expect(mid.shortLines.size).toBeLessThan(3);
  });
});

describe('عرض الصفحة أو الصفحتين', () => {
  it.each([
    [{ w: 1440, h: 860 }, true, 'لابتوب ١٤٤٠×٩٠٠'],
    [{ w: 1366, h: 650 }, true, 'لابتوب ١٣٦٦×٧٦٨ داخل المتصفح'],
    [{ w: 1920, h: 1000 }, true, 'شاشة ١٩٢٠×١٠٨٠'],
    [{ w: 390, h: 844 }, false, 'جوال طولي'],
    [{ w: 844, h: 390 }, false, 'جوال أفقي (تمرير)'],
    [{ w: 768, h: 1024 }, false, 'لوح طولي'],
    [{ w: 1000, h: 1000 }, false, 'نافذة مربعة'],
    [{ w: 1440, h: 520 }, false, 'ارتفاع قصير'],
  ])('%j ⇐ %s (%s)', (box, expected) => {
    expect(spread(box)).toBe(expected);
  });

  it('خط الصفحتين لا يقل عن الحد الأدنى', () => {
    const box = { w: 1440, h: 860 };
    const l = pageLayout(quran, 3, spreadArea(box, META_H));
    expect(l.fontSize).toBeGreaterThanOrEqual(SPREAD_MIN_FONT);
  });

  it('بلا مساحة أو بيانات: صفحة واحدة', () => {
    expect(isSpreadMode(quran, null, null, META_H)).toBe(false);
    expect(isSpreadMode(null, { w: 1440, h: 900 }, { w: 1, h: 1 }, META_H)).toBe(false);
  });
});
