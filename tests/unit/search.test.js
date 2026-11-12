// البحث بالأرقام: الرقم وحده (عربي أو إنجليزي) ← الصفحة ثم السورة ثم الجزء بهذا الرقم، إن وُجدت
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSearchIndex, parseNumber, search } from '../../src/lib/search.js';

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

  it('أول صفحات الأجزاء كمصحف المدينة (والسابع في ١٢١)', () => {
    expect(index.juzPages).toEqual([
      1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 202, 222, 242, 262, 282,
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
