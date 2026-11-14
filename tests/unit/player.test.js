// منطق المشغّل: المقادير، وتكرار الآية والمقدار، والبسملة، والاستماع المتتابع، وتعديل المقدار
// أثناء التشغيل، وتغيير القارئ — src/lib/player.js بعنصر صوت محاكى (بلا صوت حقيقي)
import { existsSync, statSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.paused = true;
    this.attrs = {};
    this._src = '';
    FakeAudio.last = this;
    FakeAudio.srcs = [];
  }
  set src(v) {
    this._src = v;
    this.attrs.src = v;
    FakeAudio.srcs.push(v);
  }
  get src() {
    return this._src;
  }
  getAttribute(n) {
    return this.attrs[n] ?? null;
  }
  removeAttribute(n) {
    delete this.attrs[n];
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
}

// مصحف مصغّر: الفاتحة (٧)، البقرة (٥)، التوبة (٣) — فيه أول سورة بلا بسملة وأخرى ببسملة
function miniQuran() {
  const verses = [];
  const add = (s, n, p) => {
    for (let a = 1; a <= n; a++) verses.push({ s, a, p });
  };
  add(1, 7, 1);
  add(2, 5, 2);
  add(9, 3, 187);
  const suras = Array.from({ length: 114 }, (_, i) => ({ n: i + 1, name: `س${i + 1}` }));
  return { verses, suras };
}
const q = miniQuran();
const idx = (s, a) => q.verses.findIndex((v) => v.s === s && v.a === a);

let P;
const ended = () => FakeAudio.last.dispatchEvent(new Event('ended'));
const file = (url) => url.match(/\/([^/]+)\/(\d{6})\.mp3$/).slice(1).join('/');
const lastFile = () => file(FakeAudio.srcs.at(-1));

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  globalThis.Audio = FakeAudio;
  window.Audio = FakeAudio;
  P = await import('../../src/lib/player.js');
});

// يقرأ تسلسل الآيات التي تُتلى حتى يتوقف المشغّل (حتى limit مقطعًا)
function run(limit = 50) {
  const seq = [];
  for (let i = 0; i < limit; i++) {
    const f = FakeAudio.srcs.at(-1);
    seq.push(file(f));
    const before = FakeAudio.srcs.length;
    ended();
    if (FakeAudio.srcs.length === before) break; // توقف: لا مقطع جديد
  }
  return seq;
}

const shuraym = (s, a) => `Saood_ash-Shuraym_128kbps/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}`;

describe('التشغيل والتكرار', () => {
  it('يقرأ المقدار مرة واحدة ثم يقف', () => {
    expect(P.play(q, [idx(1, 2), idx(1, 3)])).toBe('playing');
    expect(run()).toEqual([shuraym(1, 2), shuraym(1, 3)]);
  });

  it('تكرار الآية مرتين وتكرار المقدار مرتين', () => {
    P.setSettings({ verseRepeat: 2, rangeRepeat: 2 });
    P.play(q, [idx(1, 2), idx(1, 3)]);
    const a = shuraym(1, 2);
    const b = shuraym(1, 3);
    expect(run()).toEqual([a, a, b, b, a, a, b, b]);
  });

  it('تكرار المقدار بلا نهاية لا يقف', () => {
    P.setSettings({ rangeRepeat: P.FOREVER });
    P.play(q, [idx(1, 1)]);
    expect(run(30)).toHaveLength(30);
  });

  it('الاستماع المتتابع بلا مقدار لا يكرّر المقدار ولو اختير تكراره، ويقف في آخره', () => {
    P.setSettings({ rangeRepeat: 3 });
    P.play(q, [idx(1, 6), idx(1, 7)], true);
    expect(run()).toEqual([shuraym(1, 6), shuraym(1, 7)]);
  });

  it('الإعدادات تُحفظ وتُقرأ عند الفتح التالي', async () => {
    P.setSettings({ reciter: 'husary', verseRepeat: 3 });
    expect(JSON.parse(localStorage.getItem('hq.listen'))).toMatchObject({ reciter: 'husary', verseRepeat: 3, rangeRepeat: 1 });
    vi.resetModules();
    const again = await import('../../src/lib/player.js');
    again.play(q, [idx(1, 1)]);
    expect(lastFile()).toBe('Husary_128kbps/001001');
  });

  it('خيارات التكرار: ٢–٥٠ وبلا نهاية', () => {
    expect(P.REPEATS[0]).toBe(2);
    expect(P.REPEATS.at(-1)).toBe(50);
    expect(P.FOREVER).toBe(0);
  });
});

describe('البسملة', () => {
  it('قبل أول البقرة بصوت القارئ من ملف ١:١، ثم الآية نفسها', () => {
    P.play(q, [idx(1, 7), idx(2, 1), idx(2, 2)]);
    expect(run()).toEqual([shuraym(1, 7), shuraym(1, 1), shuraym(2, 1), shuraym(2, 2)]);
  });

  it('لا بسملة قبل الفاتحة (هي آيتها الأولى) ولا قبل التوبة', () => {
    P.play(q, [idx(1, 1), idx(9, 1)]);
    expect(run()).toEqual([shuraym(1, 1), shuraym(9, 1)]);
  });

  it('تكرار الآية الأولى لا يعيد البسملة، وتكرار المقدار يعيدها', () => {
    P.setSettings({ verseRepeat: 2, rangeRepeat: 2 });
    P.play(q, [idx(2, 1)]);
    const b = shuraym(1, 1);
    const v = shuraym(2, 1);
    expect(run()).toEqual([b, v, v, b, v, v]);
  });
});

describe('تعديل المقدار أثناء التشغيل (retarget)', () => {
  it('لا يفعل شيئًا والمشغّل متوقف', () => {
    expect(P.retarget(q, [idx(1, 1)])).toBe('idle');
  });

  it('الآية الجارية داخل المقدار الجديد: يكمل منها وينتهي عند النهاية الجديدة', () => {
    P.play(q, [idx(1, 1), idx(1, 2), idx(1, 3)]);
    ended(); // الجارية الآن ١:٢
    expect(lastFile()).toBe(shuraym(1, 2));
    expect(P.retarget(q, [idx(1, 2), idx(1, 3), idx(1, 4), idx(1, 5)])).toBe('continued');
    expect(lastFile()).toBe(shuraym(1, 2)); // بلا انقطاع
    expect(run()).toEqual([shuraym(1, 2), shuraym(1, 3), shuraym(1, 4), shuraym(1, 5)]);
  });

  it('الآية الجارية خارج المقدار الجديد: يبدأ من أوله بعدّاد تكرار جديد', () => {
    P.setSettings({ rangeRepeat: 2 });
    P.play(q, [idx(1, 1), idx(1, 2)]);
    expect(P.retarget(q, [idx(1, 5), idx(1, 6)])).toBe('playing');
    expect(run()).toEqual([shuraym(1, 5), shuraym(1, 6), shuraym(1, 5), shuraym(1, 6)]);
  });

  it('إلغاء المقدار أثناء التشغيل يحوّله إلى الاستماع المتتابع من حيث هو', () => {
    P.setSettings({ rangeRepeat: P.FOREVER });
    P.play(q, [idx(1, 2), idx(1, 3)]);
    expect(P.retarget(q, [idx(1, 1), idx(1, 2), idx(1, 3), idx(1, 4)], true)).toBe('continued');
    expect(run()).toEqual([shuraym(1, 2), shuraym(1, 3), shuraym(1, 4)]);
  });
});

describe('تغيير القارئ والتحكم', () => {
  it('أثناء الآية: الآية نفسها بصوت الجديد', () => {
    P.play(q, [idx(1, 3), idx(1, 4)]);
    expect(P.setSettings({ reciter: 'muaiqly' })).toBe(true);
    expect(lastFile()).toBe('MaherAlMuaiqly128kbps/001003');
    ended();
    expect(lastFile()).toBe('MaherAlMuaiqly128kbps/001004');
  });

  it('أثناء البسملة: البسملة بصوت الجديد ثم الآية', () => {
    P.play(q, [idx(2, 1)]);
    expect(lastFile()).toBe(shuraym(1, 1));
    P.setSettings({ reciter: 'husary' });
    expect(lastFile()).toBe('Husary_128kbps/001001');
    ended();
    expect(lastFile()).toBe('Husary_128kbps/002001');
  });

  it('الإيقاف المؤقت والاستئناف والإيقاف التام', () => {
    P.play(q, [idx(1, 1), idx(1, 2)]);
    P.pause();
    expect(FakeAudio.last.paused).toBe(true);
    P.resume();
    expect(FakeAudio.last.paused).toBe(false);
    P.stop();
    const n = FakeAudio.srcs.length;
    ended(); // لا يتقدم بعد الإيقاف
    expect(FakeAudio.srcs.length).toBe(n);
  });
});

// معاينة صوت القارئ (٢٠٢٦-١١-١٣): الفاتحة ٢ بعنصر صوت مستقل، لا تغيّر القارئ المختار،
// وتوقف التلاوة مؤقتًا ثم تستأنفها
describe('معاينة صوت القارئ', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('تُسمِع الفاتحة ٢ بصوت القارئ ولا تغيّر القارئ المختار ولا الإعدادات', () => {
    P.previewReciter('muaiqly');
    const el = FakeAudio.last;
    expect(file(el.src)).toBe('MaherAlMuaiqly128kbps/001002');
    expect(P.playerState().preview).toEqual({ id: 'muaiqly', status: 'loading' });
    el.dispatchEvent(new Event('playing'));
    expect(P.playerState().preview.status).toBe('playing');
    expect(P.playerState().settings.reciter).toBe('shuraym');
    expect(localStorage.getItem('hq.listen')).toBeNull();
    el.dispatchEvent(new Event('ended'));
    expect(P.playerState().preview).toBeNull();
    expect(el.paused).toBe(true);
  });

  it('مقطع المعاينة مبني مع التطبيق لكل قارئ (يعمل بلا إنترنت)، لا يُطلب من موقع الصوت', async () => {
    const { RECITERS } = await import('../../src/lib/reciters.js');
    for (const r of RECITERS) {
      const f = `public/audio/preview/${r.folder}/001002.mp3`;
      expect(existsSync(f), r.id).toBe(true);
      expect(statSync(f).size, r.id).toBeGreaterThan(10_000);
    }
    P.previewReciter('nufais');
    expect(FakeAudio.last.src).toBe('/audio/preview/alnufais/001002.mp3');
    P.previewReciter('muaiqly');
    expect(FakeAudio.last.src).not.toMatch(/everyayah|tarteel/);
  });

  it('معاينة واحدة في كل مرة: الثانية تحل محل الأولى بالعنصر نفسه', () => {
    P.previewReciter('muaiqly');
    const el = FakeAudio.last;
    P.previewReciter('husary');
    expect(FakeAudio.last).toBe(el);
    expect(el.src).toMatch(/Husary.*\/001002\.mp3$/);
    expect(P.playerState().preview.id).toBe('husary');
    P.stopPreview();
    expect(P.playerState().preview).toBeNull();
  });

  it('توقف التلاوة الجارية مؤقتًا، وتستأنفها من حيث وقفت عند انتهائها', () => {
    P.play(q, [idx(1, 2), idx(1, 3)]);
    const main = FakeAudio.last;
    const src = main.src;
    P.previewReciter('muaiqly');
    expect(main.paused).toBe(true);
    expect(P.playerState().status).toBe('paused');
    FakeAudio.last.dispatchEvent(new Event('ended'));
    expect(main.paused).toBe(false);
    expect(main.src).toBe(src);
    expect(P.playerState().v).toBe(idx(1, 2));
  });

  it('وتستأنفها كذلك عند إيقاف المعاينة، ولا تستأنف ما أوقفه المستخدم بنفسه', () => {
    P.play(q, [idx(1, 2)]);
    const main = FakeAudio.last;
    P.previewReciter('muaiqly');
    P.previewReciter('husary'); // التبديل بين معاينتين لا يستأنف التلاوة بينهما
    expect(main.paused).toBe(true);
    P.stopPreview();
    expect(main.paused).toBe(false);

    P.pause();
    P.previewReciter('muaiqly');
    P.stopPreview();
    expect(main.paused).toBe(true);
    expect(P.playerState().status).toBe('paused');
  });

  it('إن تعذّر التشغيل: تُبلَّغ الواجهة وتنتهي المعاينة وتُستأنف التلاوة', async () => {
    P.play(q, [idx(1, 2)]);
    const main = FakeAudio.last;
    const onFail = vi.fn();
    P.previewReciter('muaiqly', onFail);
    FakeAudio.last.dispatchEvent(new Event('error'));
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(P.playerState().preview).toBeNull();
    expect(main.paused).toBe(false);

    // ورفض play() نفسه (لا AbortError)
    const fail2 = vi.fn();
    const el = FakeAudio.last;
    el.play = () => Promise.reject(new Error('net'));
    P.previewReciter('husary', fail2);
    await flush();
    expect(fail2).toHaveBeenCalledTimes(1);
    expect(P.playerState().preview).toBeNull();
  });
});
