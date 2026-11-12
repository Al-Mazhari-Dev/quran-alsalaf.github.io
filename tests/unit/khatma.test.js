// ختمة الورد: تقسيم الأوراد، والحفظ، والتقدم والتأخر، وتعديل الخطة، والختم، والتاريخان
import { beforeEach, describe, expect, it } from 'vitest';
import * as K from '../../src/lib/khatma.js';

beforeEach(() => localStorage.clear());
const raw = (k) => JSON.parse(localStorage.getItem(k));
const covers = (wirds, from = 1, to = 604) => {
  // الأوراد متتابعة بلا فجوة ولا تداخل، من from إلى to
  expect(wirds[0][0]).toBe(from);
  expect(wirds.at(-1)[1]).toBe(to);
  for (let i = 1; i < wirds.length; i++) expect(wirds[i][0]).toBe(wirds[i - 1][1] + 1);
};

describe('تقسيم الأوراد', () => {
  it('بالأيام: عدد الأوراد عدد الأيام، والصفحات موزعة بالتساوي (لا يزيد ورد على آخر بأكثر من صفحة)', () => {
    for (const days of [1, 7, 10, 15, 29, 30, 60, 365, 604]) {
      const w = K.splitWirds(1, 604, 'days', days);
      expect(w).toHaveLength(days);
      covers(w);
      const sizes = w.map(([a, b]) => b - a + 1);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('بالأيام: ٣٠ يوما ⇐ ٢٠ أو ٢١ صفحة، أولها ١–٢٠', () => {
    const w = K.splitWirds(1, 604, 'days', 30);
    expect(w[0]).toEqual([1, 20]);
    expect(new Set(w.map(([a, b]) => b - a + 1))).toEqual(new Set([20, 21]));
  });

  it('بالأيام: أيام أكثر من الصفحات ⇐ صفحة لكل يوم', () => {
    expect(K.splitWirds(600, 604, 'days', 30)).toEqual([[600, 600], [601, 601], [602, 602], [603, 603], [604, 604]]);
  });

  it('بالصفحات: كل ورد بالقدر المختار تماما، والأخير ما بقي', () => {
    const w = K.splitWirds(1, 604, 'pages', 20);
    expect(w).toHaveLength(31);
    covers(w);
    expect(w.slice(0, 30).every(([a, b]) => b - a + 1 === 20)).toBe(true);
    expect(w.at(-1)).toEqual([601, 604]);
    expect(K.splitWirds(1, 604, 'pages', 5)).toHaveLength(121);
    expect(K.splitWirds(1, 604, 'pages', 1)).toHaveLength(604);
  });

  it('ملخص الخطة قبل اعتمادها: الأيام، وأقل الورد وأكثره، ويوم الختم', () => {
    expect(K.previewPlan('days', 30, 1, '2026-11-12')).toEqual({ days: 30, min: 20, max: 21, end: '2026-12-11' });
    expect(K.previewPlan('pages', 20, 1, '2026-11-12')).toEqual({ days: 31, min: 4, max: 20, end: '2026-12-12' });
    expect(K.previewPlan('days', 7, 1, '2026-11-12').end).toBe('2026-11-18');
  });
});

describe('التواريخ', () => {
  it('الأيام بالتقويم، عبر الشهور والسنين', () => {
    expect(K.addDays('2026-11-12', 30)).toBe('2026-12-12');
    expect(K.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(K.daysBetween('2026-11-12', '2026-12-12')).toBe(30);
    expect(K.daysBetween('2026-11-12', '2026-11-10')).toBe(-2);
    expect(K.dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('يوم الختم بالميلادي والهجري (أم القرى) بأرقام عربية', () => {
    const d = K.formatDates('2026-12-12');
    expect(d.gregorian).toBe('السبت ١٢ ديسمبر ٢٠٢٦م');
    expect(d.hijri).toBe('٣ رجب ١٤٤٨هـ');
  });

  it('صيغ العدد: يوم واحد · يومين · ٣ أيام · ١١ يوما، وكذلك الصفحات', () => {
    const ar = (x) => String(x);
    expect([1, 2, 3, 10, 11, 30].map((x) => K.daysText(x, ar))).toEqual(['يوم واحد', 'يومين', '3 أيام', '10 أيام', '11 يوما', '30 يوما']);
    expect([1, 2, 5, 20].map((x) => K.pagesText(x, ar))).toEqual(['صفحة واحدة', 'صفحتين', '5 صفحات', '20 صفحة']);
  });
});

describe('حفظ الختمة وتقدمها', () => {
  it('الإنشاء يحفظ ختمة ورد واحدة بنوعها، والورد الأول من الفاتحة', () => {
    K.startWird('days', 30, '2026-11-12');
    expect(raw('hq.khatmas')).toHaveLength(1);
    const k = K.readWird();
    expect(k).toMatchObject({ type: 'wird', mode: 'days', value: 30, from: 1, done: 0 });
    const s = K.wirdState(k, '2026-11-12');
    expect(s.current).toEqual([1, 20]);
    expect(s).toMatchObject({ index: 1, total: 30, read: 0, percent: 0, behind: 0, ahead: 0, doneToday: false, end: '2026-12-11' });
  });

  it('ختمة ورد واحدة فقط: إنشاء أخرى يستبدلها، ويبقى غيرها من الأنواع', () => {
    localStorage.setItem('hq.khatmas', JSON.stringify([{ type: 'tadabbur', id: 1 }]));
    K.startWird('days', 30, '2026-11-12');
    K.startWird('pages', 5, '2026-11-12');
    const list = raw('hq.khatmas');
    expect(list.filter((k) => k.type === 'wird')).toHaveLength(1);
    expect(list.find((k) => k.type === 'tadabbur')).toBeTruthy();
    expect(K.readWird().mode).toBe('pages');
  });

  it('إتمام الورد ينقل إلى التالي، والتقدم بالصفحات المقروءة', () => {
    K.startWird('days', 30, '2026-11-12');
    expect(K.completeWird('2026-11-12')).toBe('next');
    const s = K.wirdState(K.readWird(), '2026-11-12');
    expect(s.current).toEqual([21, 40]);
    expect(s).toMatchObject({ index: 2, read: 20, percent: 3, doneToday: true });
    // ورد اليوم أتم: ما بقي (٢٩) يبدأ من الغد
    expect(s.end).toBe('2026-12-11');
  });

  it('الورد يتبع الإنجاز لا التاريخ: فوات أيام يظهر التأخر ولا يضيع ورد', () => {
    K.startWird('days', 30, '2026-11-12');
    const s = K.wirdState(K.readWird(), '2026-11-15');
    expect(s.current).toEqual([1, 20]);
    expect(s.behind).toBe(3);
    // يوم الختم يتأخر بقدر التأخر
    expect(s.end).toBe('2026-12-14');
  });

  it('إتمام أكثر من ورد في يوم يظهر التقدم على الخطة', () => {
    K.startWird('days', 30, '2026-11-12');
    K.completeWird('2026-11-12');
    K.completeWird('2026-11-12');
    K.completeWird('2026-11-12');
    const s = K.wirdState(K.readWird(), '2026-11-12');
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(0);
    expect(s.current).toEqual([61, 80]);
  });

  it('تعديل الخطة يعيد التقسيم من أول صفحة لم تقرأ دون أن يضيع ما قرئ', () => {
    K.startWird('days', 30, '2026-11-12');
    K.completeWird('2026-11-12');
    K.completeWird('2026-11-13');
    K.editWird('pages', 10, '2026-11-14');
    const k = K.readWird();
    expect(k).toMatchObject({ from: 41, done: 0, doneBefore: 2, planStart: '2026-11-14', mode: 'pages', value: 10 });
    const s = K.wirdState(k, '2026-11-14');
    expect(s.current).toEqual([41, 50]);
    expect(s.read).toBe(40);
    expect(s.index).toBe(3);
    expect(s.total).toBe(2 + 57); // ٥٦٤ صفحة باقية بعشر صفحات: ٥٧ وردا
  });

  it('تعديل الخطة بعد إتمام ورد اليوم يبدأها من الغد', () => {
    K.startWird('days', 30, '2026-11-12');
    K.completeWird('2026-11-12');
    K.editWird('days', 10, '2026-11-12');
    const k = K.readWird();
    expect(k.planStart).toBe('2026-11-13');
    const s = K.wirdState(k, '2026-11-12');
    expect(s.behind).toBe(0);
    expect(s.end).toBe('2026-11-22');
  });

  it('إتمام آخر ورد يختم المصحف ويزيد عدد الختمات', () => {
    K.startWird('days', 2, '2026-11-12');
    expect(K.completeWird('2026-11-12')).toBe('next');
    expect(K.completeWird('2026-11-13')).toBe('finished');
    const k = K.readWird();
    expect(k.finished).toBe('2026-11-13');
    const s = K.wirdState(k, '2026-11-14');
    expect(s).toMatchObject({ finished: true, current: null, read: 604, percent: 100 });
    expect(K.readDoneCount()).toBe(1);
    // لا يتم ورد بعد الختم
    expect(K.completeWird('2026-11-14')).toBe(null);
    // ختمة جديدة: يبقى العدد
    K.removeWird();
    K.startWird('days', 1, '2026-11-14');
    K.completeWird('2026-11-14');
    expect(K.readDoneCount()).toBe(2);
  });

  it('الحذف يزيل ختمة الورد وحدها', () => {
    K.startWird('days', 30, '2026-11-12');
    K.removeWird();
    expect(K.readWird()).toBe(null);
    expect(raw('hq.khatmas')).toEqual([]);
  });
});
