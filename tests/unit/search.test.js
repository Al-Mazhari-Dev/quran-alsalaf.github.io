// البحث بالأرقام: الرقم وحده (عربي أو إنجليزي) ← الصفحة ثم السورة ثم الجزء بهذا الرقم، إن وُجدت
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSearchIndex, parseNumber, parseVerseRef, search } from '../../src/lib/search.js';

const QURAN = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
const index = buildSearchIndex(QURAN);

describe('البحث بالأرقام', () => {
  it('قراءة الرقم: عربي وإنجليزي وأصفار في أوله، وغير الرقم وحده ليس رقمًا', () => {
    expect(parseNumber('3')).toBe(3);
    expect(parseNumber('٣')).toBe(3);
    expect(parseNumber(' ٥٢٣ ')).toBe(523);
    expect(parseNumber('003')).toBe(3);
    expect(parseNumber('٠٠٣')).toBe(3);
    expect(parseNumber('3 4')).toBeNull();
    expect(parseNumber('البقرة 255')).toBeNull();
    expect(parseNumber('2:255')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });

  it('٣: الصفحة ثم السورة (آل عمران) ثم الجزء، كلٌّ بصفحته', () => {
    const r = search(index, '٣');
    expect(r.numbers).toEqual([
      { kind: 'page', n: 3, page: 3 },
      { kind: 'sura', n: 3, page: 50 },
      { kind: 'juz', n: 3, page: 42 },
    ]);
    expect(r.verses).toEqual([]);
    expect(r.suras).toEqual([]);
    expect(search(index, '3')).toEqual(r);
  });

  // الحادي عشر في ٢٠١ (٢٠٢٦-١١-١٣، كان ٢٠٢): يبدأ في المطبوع عند «۞ إنما السبيل» في سطرها الثالث عشر
  it('أول صفحات الأجزاء كمصحف المدينة (والسابع في ١٢١، والحادي عشر في ٢٠١)', () => {
    expect(index.juzPages).toEqual([
      1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
      302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
    ]);
  });

  it('ما ليس له إلا صفحة أو صفحة وسورة، وما لا شيء له', () => {
    expect(search(index, '523').numbers.map((x) => x.kind)).toEqual(['page']);
    expect(search(index, '114').numbers).toEqual([
      { kind: 'page', n: 114, page: 114 },
      { kind: 'sura', n: 114, page: 604 },
    ]);
    expect(search(index, '30').numbers.map((x) => x.kind)).toEqual(['page', 'sura', 'juz']);
    expect(search(index, '31').numbers.map((x) => x.kind)).toEqual(['page', 'sura']);
    expect(search(index, '604').numbers).toEqual([{ kind: 'page', n: 604, page: 604 }]);
    expect(search(index, '605').numbers).toEqual([]);
    expect(search(index, '0').numbers).toEqual([]);
  });

  it('الرقم مع كلمات يبقى بحثًا نصيًّا', () => {
    expect(search(index, 'البقرة 255').numbers).toBeUndefined();
    expect(search(index, 'البقرة').suras).toEqual([2]);
  });
});

// البحث بالسورة ورقم الآية: «البقرة ٢٥٥» ← آية الكرسي أولًا ثم سورتها
describe('البحث بالسورة ورقم الآية', () => {
  const KURSI = QURAN.verses.findIndex((v) => v.s === 2 && v.a === 255);

  it('قراءة الصيغ: الاسم ثم الرقم، و«سورة»، وبلا «ال»، والأرقام بنقطتين', () => {
    expect(parseVerseRef('البقرة 255')).toEqual({ name: 'البقره', a: 255 });
    expect(parseVerseRef('البقرة ٢٥٥')).toEqual({ name: 'البقره', a: 255 });
    expect(parseVerseRef('سورة البقرة 255')).toEqual({ name: 'البقره', a: 255 });
    expect(parseVerseRef('البقرة: 255')).toEqual({ name: 'البقره', a: 255 });
    expect(parseVerseRef('2:255')).toEqual({ n: 2, a: 255 });
    expect(parseVerseRef('٢:٢٥٥')).toEqual({ n: 2, a: 255 });
    expect(parseVerseRef('٢ : ٢٥٥')).toEqual({ n: 2, a: 255 });
    expect(parseVerseRef('255')).toBeNull();
    expect(parseVerseRef('البقرة')).toBeNull();
    expect(parseVerseRef('3 4')).toBeNull();
  });

  it('«البقرة 255» بكل صيغها: آية الكرسي، ثم سورة البقرة', () => {
    for (const q of ['البقرة 255', 'البقرة ٢٥٥', 'سورة البقرة 255', 'سوره البقره ٢٥٥', 'بقرة 255', 'البقرة255', '2:255', '٢:٢٥٥']) {
      const r = search(index, q);
      expect(r.refs, q).toEqual([{ s: 2, a: 255, i: KURSI }]);
      expect(r.suras, q).toEqual([2]);
      expect(r.numbers, q).toBeUndefined();
    }
    expect(QURAN.verses[KURSI].e).toContain('الله لا إله إلا هو الحي القيوم');
  });

  it('التسامح في الهمزات والتاء والألف المقصورة، والسور ذات الحرف الواحد', () => {
    const at = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
    expect(search(index, 'الانعام 5').refs).toEqual([{ s: 6, a: 5, i: at(6, 5) }]);
    expect(search(index, 'النبأ ١').refs).toEqual([{ s: 78, a: 1, i: at(78, 1) }]);
    expect(search(index, 'ص 38').refs).toEqual([{ s: 38, a: 38, i: at(38, 38) }]);
    expect(search(index, 'ق ١').refs).toEqual([{ s: 50, a: 1, i: at(50, 1) }]);
    expect(search(index, 'عمران 5').refs).toEqual([{ s: 3, a: 5, i: at(3, 5) }]);
  });

  it('الاسم المطابق تمامًا يُقدَّم وحده، والناقص يُظهر كل سورة تطابقه', () => {
    expect(search(index, 'الحج 5').refs.map((r) => r.s)).toEqual([22]);
    expect(search(index, 'حج 5').refs.map((r) => r.s)).toEqual([22]);
    expect(search(index, 'الحجر 5').refs.map((r) => r.s)).toEqual([15]);
    expect(search(index, 'نفال 5').refs.map((r) => r.s)).toEqual([8]);
    expect(search(index, 'المعارج 5').refs.map((r) => r.s)).toEqual([70]);
    const many = search(index, 'الن 5').refs.map((r) => r.s);
    expect(many).toEqual(expect.arrayContaining([4, 16, 24, 27]));
  });

  it('رقم أكبر من آيات السورة أو صفر: السورة وحدها بلا آية', () => {
    expect(search(index, 'البقرة 300').refs).toEqual([{ s: 2, a: 300, i: null }]);
    expect(search(index, 'البقرة 300').suras).toEqual([2]);
    expect(search(index, 'البقرة 286').refs[0].i).not.toBeNull();
    expect(search(index, 'البقرة 287').refs[0].i).toBeNull();
    expect(search(index, 'البقرة 0').refs[0].i).toBeNull();
    expect(search(index, '114:6').refs[0].i).toBe(QURAN.verses.length - 1);
  });

  it('ما لا سورة له يبقى كما كان: بحثًا نصيًّا', () => {
    expect(search(index, 'قل هو الله 1').refs).toBeUndefined();
    expect(search(index, '115:1').refs).toBeUndefined();
    expect(search(index, 'الحمد لله').refs).toBeUndefined();
    expect(search(index, 'الحمد لله').total).toBeGreaterThan(0);
  });
});

describe('أسماء السور المصحَّحة الهمزات', () => {
  it('إبراهيم والإنسان والانفطار والانشقاق، ويجدها البحث بالكتابتين', () => {
    expect([14, 76, 82, 84].map((n) => QURAN.suras[n - 1].name)).toEqual(['إبراهيم', 'الإنسان', 'الانفطار', 'الانشقاق']);
    expect(search(index, 'ابراهيم').suras).toEqual([14]);
    expect(search(index, 'إبراهيم').suras).toEqual([14]);
    expect(search(index, 'سورة الإنفطار').suras).toEqual([82]);
    expect(search(index, 'الانشقاق').suras).toEqual([84]);
    expect(search(index, 'الانسان').suras).toEqual([76]);
  });
});
