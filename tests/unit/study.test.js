// صيغ النسخ والتسميات (src/lib/study.js)، والنسخ إلى الحافظة وبديله (src/lib/userdata.js)،
// وتناوب مقررات الأسابيع (src/lib/weeks.js)، والقرّاء (src/lib/reciters.js)
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { copyVerse, copyVerses, muyassarPlain, pageVerses, verseLabel, versePlain, actionsInRange, memoIndex } from '../../src/lib/study.js';
import { copyText } from '../../src/lib/userdata.js';
import { weekMap } from '../../src/lib/weeks.js';
import { RECITERS, ayahUrl, groupReciters, reciterById, reciterTitle, covers } from '../../src/lib/reciters.js';

const quran = {
  ...JSON.parse(readFileSync('public/data/quran.json', 'utf8')),
  memos: JSON.parse(readFileSync('public/data/memos.json', 'utf8')),
};
const v = (s, a) => quran.verses.findIndex((x) => x.s === s && x.a === a);

describe('صيغ النسخ', () => {
  it('الآية بلا علامتها الخاصة بخط المصحف', () => {
    const t = quran.verses[v(1, 2)].t;
    expect(versePlain(quran, v(1, 2))).toBe(t.slice(0, -1).join(' '));
    expect(versePlain(quran, v(1, 2))).not.toContain(t.at(-1));
  });

  it('آية واحدة: ﴿…﴾ [السورة: رقم]', () => {
    expect(copyVerse(quran, v(2, 255))).toBe(`﴿${versePlain(quran, v(2, 255))}﴾ [البقرة: ٢٥٥]`);
  });

  it('مقدار: أرقام الآيات بين قوسين، ومرجع لكل سورة، وسطر فارغ بين السورتين', () => {
    const text = copyVerses(quran, [v(1, 6), v(1, 7), v(2, 1)]);
    const [a, b] = text.split('\n\n');
    expect(a).toMatch(/^﴿.+ \(٦\) .+ \(٧\)﴾ \[الفاتحة: ٦–٧\]$/);
    expect(b).toMatch(/^﴿الٓمٓ \(١\)﴾ \[البقرة: ١\]$/);
  });

  it('تسمية المقدار', () => {
    expect(verseLabel(quran, [v(2, 3)])).toBe('البقرة ٣');
    expect(verseLabel(quran, [v(2, 3), v(2, 5)])).toBe('البقرة ٣–٥');
    expect(verseLabel(quran, [v(1, 7), v(2, 2)])).toBe('الفاتحة ٧ – البقرة ٢');
  });

  it('علامتا الاقتباس في الميسّر تصيران ﴿﴾', () => {
    expect(muyassarPlain('قال Aالحمد للهB هنا', ['A', 'B'])).toBe('قال ﴿الحمد لله﴾ هنا');
  });

  it('آيات الصفحة بترتيبها بلا تكرار', () => {
    expect(pageVerses(quran, 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(pageVerses(quran, 604).at(-1)).toBe(quran.verses.length - 1);
  });

  it('التوجيه العملي يظهر مرة واحدة ولو مسّ أكثر من آية في المقدار', () => {
    const list = actionsInRange(quran, [v(1, 2), v(1, 3), v(1, 4)]);
    expect(new Set(list).size).toBe(list.length);
    expect(memoIndex(quran).actions[list[0]].t).toMatch(/^داوِم على حمد الله/);
  });
});

describe('النسخ إلى الحافظة', () => {
  it('بواجهة الحافظة', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText('نص')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('نص');
  });

  it('وبالبديل إن رُفضت، ويُبلَّغ بالفشل إن تعذّر البديل', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('x')) }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await copyText('نص')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // لا يبقى أثر
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await copyText('نص')).toBe(false);
  });
});

describe('مقررات الأسابيع', () => {
  it('درجتان متناوبتان بترتيب المصحف، وما خارج المقررات بلا تمييز', () => {
    const { shade } = weekMap(quran);
    const weeks = quran.memos.weeks;
    expect(shade(weeks[0][0])).toBe('a');
    expect(shade(weeks[1][0])).toBe('b');
    expect(shade(weeks[2][1])).toBe('a');
    expect(shade(v(18, 10))).toBeNull();
    expect(shade(-1)).toBeNull();
  });
});

describe('القرّاء', () => {
  it('رابط ملف الآية بثلاث خانات للسورة والآية', () => {
    expect(ayahUrl(reciterById('shuraym'), 2, 7)).toBe('https://everyayah.com/data/Saood_ash-Shuraym_128kbps/002007.mp3');
  });
  it('قارئ غير معروف يعود إلى الأول، والمجموعات بترتيبها بلا فارغة', () => {
    expect(reciterById('nobody')).toBe(RECITERS[0]);
    const groups = groupReciters(RECITERS);
    expect(groups.map((g) => g.title)).toEqual(['مجوّد', 'معلّم', 'مرتّل']);
    expect(groups.reduce((n, g) => n + g.reciters.length, 0)).toBe(RECITERS.length);
    expect(groupReciters(RECITERS.filter((r) => r.group === 'murattal')).map((g) => g.id)).toEqual(['murattal']);
  });
  it('الإلحاق بجانب الاسم للمجوّد والمعلّم وحدهما', () => {
    const mj = RECITERS.find((r) => r.group === 'mujawwad');
    const mt = RECITERS.find((r) => r.group === 'murattal');
    expect(reciterTitle(mj)).toBe(`${mj.name} (مجوّد)`);
    expect(reciterTitle(mt)).toBe(mt.name);
  });
  it('كل القرّاء الحاليين كاملون، ومعرّفاتهم فريدة', () => {
    expect(RECITERS.every((r) => covers(r, [1, 2, 114]))).toBe(true);
    expect(covers({ missing: [5] }, [4, 5])).toBe(false);
    expect(new Set(RECITERS.map((r) => r.id)).size).toBe(RECITERS.length);
  });
});
