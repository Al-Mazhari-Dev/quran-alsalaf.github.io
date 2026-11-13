// أرباع الأحزاب (src/lib/rubs.js وscripts/data/08-rubs.mjs): البيانات، ونص التنبيه، وفهرس الأجزاء والأرباع،
// وبداية الجزأين ٤ و١١ وترويسة الصفحتين ٦٢ و٥٠٢ كما في مصحف المدينة المطبوع
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RUB_MESSAGES, hizbOf, juzStarts, rubMessage, rubName, rubOpening, rubStarts, rubsOnPage } from '../../src/lib/rubs.js';
import { pageInfo } from '../../src/data/quran.js';

const QURAN = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
const QCF = JSON.parse(readFileSync('public/data/qcf4.json', 'utf8'));
const quran = { ...QURAN, qcf: QCF };
const idx = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
const key = (v) => `${QURAN.verses[v].s}:${QURAN.verses[v].a}`;

describe('بيانات الأرباع', () => {
  it('٢٤٠ ربعًا متتابعة، أولها الفاتحة', () => {
    expect(QURAN.rubs).toHaveLength(240);
    expect(QURAN.rubs[0]).toBe(0);
    QURAN.rubs.forEach((v, i) => i && expect(v).toBeGreaterThan(QURAN.rubs[i - 1]));
  });

  it('كل علامة ۞ في النص أول ربع، وكل أول ربع بلا علامة أول سورة (٤١ ربعًا)', () => {
    const set = new Set(QURAN.rubs);
    const marked = QURAN.verses.map((x, v) => (x.t.includes('۞') ? v : -1)).filter((v) => v >= 0);
    expect(marked).toHaveLength(199);
    expect(marked.filter((v) => !set.has(v)).map(key)).toEqual([]);
    const unmarked = QURAN.rubs.filter((v) => !QURAN.verses[v].t.includes('۞'));
    expect(unmarked).toHaveLength(41);
    expect(unmarked.filter((v) => QURAN.verses[v].a !== 1).map(key)).toEqual([]);
    // والعلامة أول كلمة في آيتها
    expect(marked.filter((v) => QURAN.verses[v].t[0] !== '۞').map(key)).toEqual([]);
  });

  it('علامة ۞ رمز مستقل أول رموز الكلمة الأولى في خط صفحتها، وبعده رمز الكلمة', () => {
    const bad = [];
    for (const v of QURAN.rubs.filter((x) => QURAN.verses[x].t[0] === '۞')) {
      const p = QURAN.verses[v].p;
      const code = QCF.pages[p - 1].flatMap((ln) => ln?.k ?? []).find(([x]) => x === v)?.[1] ?? '';
      if (code.replace(/ /g, '').length < 2) bad.push(key(v));
    }
    expect(bad).toEqual([]);
  });

  it('مواضع معروفة: ربع الحزب ١ «إن الله لا يستحيي»، والحزب ٢ «أفتطمعون»، ونصف الحزب ٨ أول النساء', () => {
    expect(QURAN.rubs[1]).toBe(idx(2, 26));
    expect(QURAN.rubs[4]).toBe(idx(2, 75));
    expect(QURAN.rubs[30]).toBe(idx(4, 1));
    expect(QURAN.rubs[238]).toBe(idx(94, 1));
    expect(QURAN.rubs[239]).toBe(idx(100, 9));
  });
});

describe('الأجزاء على المطبوع', () => {
  it('كل جزء يبدأ بأول حزب: الجزء ن عند الربع ٨(ن−١)+١', () => {
    expect(juzStarts(QURAN)).toEqual(Array.from({ length: 30 }, (_, j) => QURAN.rubs[j * 8]));
  });

  it('الجزء ٤ يبدأ عند «۞ كل الطعام» (آل عمران ٩٣)، والجزء ١١ عند «۞ إنما السبيل» (التوبة ٩٣)', () => {
    const starts = juzStarts(QURAN);
    expect(key(starts[3])).toBe('3:93');
    expect(key(starts[10])).toBe('9:93');
    expect(QURAN.verses[idx(3, 92)].j).toBe(3);
    expect(QURAN.verses[idx(9, 93)].j).toBe(11);
    expect(QURAN.verses[idx(9, 92)].j).toBe(10);
  });

  it('ترويسة الصفحة كالمطبوع: ٦٢ الرابع، ١٢١ السادس، ٢٠١ العاشر، ٥٠٢ السادس والعشرون', () => {
    expect(pageInfo(quran, 61).juz).toBe(3);
    expect(pageInfo(quran, 62).juz).toBe(4);
    expect(pageInfo(quran, 121).juz).toBe(6);
    expect(pageInfo(quran, 201).juz).toBe(10);
    expect(pageInfo(quran, 202).juz).toBe(11);
    expect(pageInfo(quran, 501).juz).toBe(25);
    expect(pageInfo(quran, 502).juz).toBe(26);
  });
});

describe('نص التنبيه وأسماء الأرباع', () => {
  it('أربع رسائل فقط بحسب موضع الربع في حزبه', () => {
    expect(RUB_MESSAGES).toEqual(['بداية الحزب', 'بداية ربع الحزب', 'بداية نصف الحزب', 'بداية ثلاثة أرباع الحزب']);
    expect([0, 1, 2, 3, 4, 30, 239].map(rubMessage)).toEqual([
      'بداية الحزب',
      'بداية ربع الحزب',
      'بداية نصف الحزب',
      'بداية ثلاثة أرباع الحزب',
      'بداية الحزب',
      'بداية نصف الحزب',
      'بداية ثلاثة أرباع الحزب',
    ]);
  });

  it('أسماء الأرباع في الفهرس برقم الحزب', () => {
    expect([0, 1, 2, 3, 30, 239].map(rubName)).toEqual([
      'الحزب ١',
      'ربع الحزب ١',
      'نصف الحزب ١',
      'ثلاثة أرباع الحزب ١',
      'نصف الحزب ٨',
      'ثلاثة أرباع الحزب ٦٠',
    ]);
    expect(hizbOf(239)).toBe(60);
  });

  it('أول كلمات الربع بالرسم الإملائي', () => {
    expect(rubOpening(QURAN, 1)).toBe('إن الله لا يستحيي');
    expect(rubOpening(QURAN, 0)).toBe('بسم الله الرحمن الرحيم');
  });
});

describe('الأرباع في الصفحات', () => {
  it('الأرباع التي تبدأ في الصفحة بترتيبها', () => {
    expect(rubsOnPage(QURAN, 5)).toEqual([1]);
    expect(rubsOnPage(QURAN, 6)).toEqual([]);
    expect(rubsOnPage(QURAN, 77)).toEqual([30]);
    expect(rubsOnPage(QURAN, 1)).toEqual([0]);
  });

  it('مجموع الأرباع في كل الصفحات ٢٤٠، وفهرس الآيات يطابقها', () => {
    let n = 0;
    for (let p = 1; p <= 604; p++) n += rubsOnPage(QURAN, p).length;
    expect(n).toBe(240);
    const m = rubStarts(QURAN);
    expect(m.size).toBe(240);
    expect(m.get(idx(4, 1))).toBe(30);
  });
});
