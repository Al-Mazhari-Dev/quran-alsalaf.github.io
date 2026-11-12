// صيغ العدد والمعدود (src/lib/count.js): بحسب آخر رقمين من العدد
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AYAT, countNoun, countText, DAYS, KHATMAS, PAGES } from '../../src/lib/count.js';
import { toArabicDigits } from '../../src/data/quran.js';

const NS = [1, 2, 3, 10, 11, 100, 103, 111];
const all = (forms, nominative) => NS.map((x) => countText(x, forms, toArabicDigits, nominative));

describe('صيغ العدد', () => {
  it('الأيام: يوم واحد · يومين · ٣ أيام · ١٠ أيام · ١١ يوما · ١٠٠ يوم · ١٠٣ أيام · ١١١ يوما', () => {
    expect(all(DAYS)).toEqual(['يوم واحد', 'يومين', '٣ أيام', '١٠ أيام', '١١ يوما', '١٠٠ يوم', '١٠٣ أيام', '١١١ يوما']);
  });

  it('الصفحات: ١٠٠ صفحة · ١٠٣ صفحات · ١١١ صفحة', () => {
    expect(all(PAGES)).toEqual(['صفحة واحدة', 'صفحتين', '٣ صفحات', '١٠ صفحات', '١١ صفحة', '١٠٠ صفحة', '١٠٣ صفحات', '١١١ صفحة']);
  });

  it('الختمات والآيات', () => {
    expect(all(KHATMAS)).toEqual(['ختمة واحدة', 'ختمتين', '٣ ختمات', '١٠ ختمات', '١١ ختمة', '١٠٠ ختمة', '١٠٣ ختمات', '١١١ ختمة']);
    expect(all(AYAT)).toEqual(['آية واحدة', 'آيتين', '٣ آيات', '١٠ آيات', '١١ آية', '١٠٠ آية', '١٠٣ آيات', '١١١ آية']);
  });

  it('المثنى مرفوعًا حين يأتي العدد مستقلًا: يومان · صفحتان', () => {
    expect(countText(2, DAYS, toArabicDigits, true)).toBe('يومان');
    expect(countText(2, PAGES, toArabicDigits, true)).toBe('صفحتان');
    expect(countText(5, PAGES, toArabicDigits, true)).toBe('٥ صفحات');
  });

  it('المعدود وحده بعد رقم (لمدى مثل «٤–٥ صفحات» وعدد آيات السورة)', () => {
    expect([5, 21, 87, 604].map((x) => countNoun(x, PAGES))).toEqual(['صفحات', 'صفحة', 'صفحة', 'صفحات']);
    expect(countNoun(200, DAYS)).toBe('يوم');
  });

  it('عدد آيات كل سورة: جمع لما آخره ٣–١٠، ومفرد لغيره', () => {
    const quran = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
    const label = (n) => `${quran.suras[n - 1].name} ${toArabicDigits(quran.suras[n - 1].count)} ${countNoun(quran.suras[n - 1].count, AYAT)}`;
    expect(label(1)).toBe('الفاتحة ٧ آيات');
    expect(label(103)).toBe('العصر ٣ آيات');
    expect(label(2)).toBe('البقرة ٢٨٦ آية');
    expect(label(12)).toBe('يوسف ١١١ آية');
    expect(label(11)).toBe('هود ١٢٣ آية');
    expect(label(98)).toBe('البينة ٨ آيات');
  });
});
