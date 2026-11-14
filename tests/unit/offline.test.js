// تحميل صوت قارئ لكامل القرآن (src/lib/offline.js): الحفظ الدائم، والتقدّم، والإيقاف والاستئناف،
// وانقطاع الاتصال وامتلاء المساحة، والحذف، وقراءة المشغّل من الملفات المحفوظة — بذاكرة وشبكة محاكاتين
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const QURAN = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));

// ذاكرة Cache Storage محاكاة: quota عدد الملفات الذي تمتلئ بعده
function fakeCaches() {
  const store = new Map();
  const api = {
    store,
    quota: Infinity,
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      return {
        async put(url, res) {
          if (m.size >= api.quota) throw new DOMException('full', 'QuotaExceededError');
          m.set(String(url), await res.blob());
        },
        async keys() {
          return [...m.keys()].map((url) => ({ url }));
        },
      };
    },
    async has(name) {
      return store.has(name);
    },
    async delete(name) {
      return store.delete(name);
    },
    async match(url, { cacheName }) {
      const blob = store.get(cacheName)?.get(url);
      return blob ? new Response(blob) : undefined;
    },
  };
  return api;
}

let O;
let C;
let fetched;
let fetchImpl;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  C = fakeCaches();
  globalThis.caches = C;
  fetched = [];
  fetchImpl = async () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' }));
  globalThis.fetch = vi.fn((url, opts) => {
    fetched.push(url);
    return fetchImpl(url, opts);
  });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  O = await import('../../src/lib/offline.js');
});

const shuraym = 'https://everyayah.com/data/Saood_ash-Shuraym_128kbps/';

describe('ملفات القارئ', () => {
  it('عدد آيات كل سورة يطابق بيانات المصحف، ومجموعها ٦٢٣٦', () => {
    const counts = Array(114).fill(0);
    for (const v of QURAN.verses) counts[v.s - 1] = Math.max(counts[v.s - 1], v.a);
    expect(O.AYAH_COUNTS).toEqual(counts);
    expect(O.AYAH_COUNTS.reduce((a, b) => a + b)).toBe(6236);
  });

  it('رابط لكل آية بترتيب المصحف، ومنها الفاتحة ١ (البسملة)', async () => {
    const { reciterById } = await import('../../src/lib/reciters.js');
    const urls = O.reciterUrls(reciterById('shuraym'));
    expect(urls).toHaveLength(6236);
    expect(new Set(urls).size).toBe(6236);
    expect(urls[0]).toBe(`${shuraym}001001.mp3`);
    expect(urls.at(-1)).toBe(`${shuraym}114006.mp3`);
  });

  it('لكل قارئ حجم تقريبي معروف يُعرض قبل التحميل', async () => {
    const { RECITERS } = await import('../../src/lib/reciters.js');
    for (const r of RECITERS) expect(r.mb, r.id).toBeGreaterThan(100);
  });
});

describe('التحميل', () => {
  it('يحمّل الملفات كلها ويحفظها، ويسجّل القارئ محمَّلًا ويبلّغ باكتماله', async () => {
    const notes = [];
    O.onOfflineNotice((t) => notes.push(t));
    const result = await O.startDownload('shuraym');
    expect(result).toBe('done');
    expect(fetched).toHaveLength(6236);
    expect(C.store.get('reciter-audio-shuraym').size).toBe(6236);
    expect(O.offlineState().items.shuraym).toEqual({ status: 'done', count: 6236, total: 6236 });
    expect(O.offlineState().active).toBe(null);
    expect(O.isOfflineComplete('shuraym')).toBe(true);
    expect(JSON.parse(localStorage.getItem('hq.offline')).shuraym.status).toBe('done');
    expect(notes[0]).toMatch(/اكتمل تحميل تلاوة سعود الشريم/);
  });

  it('الاستئناف يحمّل الناقص وحده', async () => {
    const cache = await C.open('reciter-audio-shuraym');
    const { reciterById } = await import('../../src/lib/reciters.js');
    const urls = O.reciterUrls(reciterById('shuraym'));
    for (const u of urls.slice(0, 6000)) await cache.put(u, new Response('x'));
    expect(await O.startDownload('shuraym')).toBe('done');
    expect(fetched).toHaveLength(236);
    expect(fetched[0]).toBe(urls[6000]);
  });

  it('الإيقاف المؤقت يُبقي ما حُمِّل، ويُستأنف من حيث وقف', async () => {
    let n = 0;
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    fetchImpl = async (url, { signal }) => {
      if (++n > 50) {
        await Promise.race([gate, new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))))]);
      }
      return new Response('x');
    };
    const running = O.startDownload('shuraym');
    await vi.waitFor(() => expect(O.offlineState().items.shuraym.count).toBe(50));
    expect(O.offlineState().items.shuraym.status).toBe('downloading');
    expect(O.offlineState().active).toBe('shuraym');
    O.pauseDownload();
    expect(await running).toBe('paused');
    release();
    expect(O.offlineState().items.shuraym).toMatchObject({ status: 'paused', count: 50 });
    expect(O.offlineState().active).toBe(null);
    expect(JSON.parse(localStorage.getItem('hq.offline')).shuraym).toMatchObject({ status: 'paused', count: 50 });

    fetched = [];
    fetchImpl = async () => new Response('x');
    expect(await O.startDownload('shuraym')).toBe('done');
    expect(fetched).toHaveLength(6236 - 50);
  });

  it('تحميل كان جاريًا حين أُغلق التطبيق يظهر متوقفًا عند الفتح', async () => {
    localStorage.setItem('hq.offline', JSON.stringify({ afasy: { status: 'downloading', count: 900, total: 6236 } }));
    vi.resetModules();
    O = await import('../../src/lib/offline.js');
    expect(O.offlineState().items.afasy).toEqual({ status: 'paused', count: 900, total: 6236 });
    expect(O.hasOfflineFiles('afasy')).toBe(true);
    expect(O.isOfflineComplete('afasy')).toBe(false);
  });

  it('قارئ واحد في كل مرة: تحميل غيره أثناءه مرفوض', async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    fetchImpl = async () => {
      await gate;
      return new Response('x');
    };
    const running = O.startDownload('shuraym');
    expect(await O.startDownload('afasy')).toBe('busy');
    expect(O.offlineState().items.afasy).toBeUndefined();
    release();
    expect(await running).toBe('done');
  });

  it('انقطاع الاتصال يوقفه ويبلّغ، ويُستأنف وحده إذا رجع', async () => {
    const notes = [];
    O.onOfflineNotice((t) => notes.push(t));
    let n = 0;
    fetchImpl = async () => {
      if (++n > 100) {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        throw new TypeError('Failed to fetch');
      }
      return new Response('x');
    };
    expect(await O.startDownload('shuraym')).toBe('offline');
    expect(O.offlineState().items.shuraym).toMatchObject({ status: 'paused', count: 100 });
    expect(notes.at(-1)).toMatch(/لانقطاع الاتصال/);

    fetchImpl = async () => new Response('x');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(O.isOfflineComplete('shuraym')).toBe(true), { timeout: 5000 });
  }, 15000);

  it('امتلاء المساحة يوقفه برسالة', async () => {
    const notes = [];
    O.onOfflineNotice((t) => notes.push(t));
    C.quota = 30;
    expect(await O.startDownload('shuraym')).toBe('nospace');
    expect(O.offlineState().items.shuraym).toMatchObject({ status: 'paused', count: 30 });
    expect(notes.at(-1)).toMatch(/لا تكفي المساحة/);
  });

  it('الحذف يمسح الملفات والحالة', async () => {
    await O.startDownload('shuraym');
    await O.deleteDownload('shuraym');
    expect(C.store.has('reciter-audio-shuraym')).toBe(false);
    expect(O.offlineState().items.shuraym).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('hq.offline'))).toEqual({});
  });

  it('قارئ سُجِّل محمَّلًا ثم مسح المتصفح ملفاته يرجع «لم يُحمَّل»', async () => {
    localStorage.setItem('hq.offline', JSON.stringify({ afasy: { status: 'done', count: 6236, total: 6236 } }));
    vi.resetModules();
    O = await import('../../src/lib/offline.js');
    await O.verifyDownloads();
    expect(O.offlineState().items.afasy).toBeUndefined();
  });
});

describe('التشغيل من الملفات المحفوظة', () => {
  class FakeAudio extends EventTarget {
    constructor() {
      super();
      this.paused = true;
      this.attrs = {};
      FakeAudio.last = this;
      FakeAudio.srcs = [];
    }
    set src(v) {
      this.attrs.src = v;
      FakeAudio.srcs.push(v);
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

  const verses = [];
  for (const [s, n] of [[1, 7], [2, 5]]) for (let a = 1; a <= n; a++) verses.push({ s, a, p: s });
  const q = { verses, suras: Array.from({ length: 114 }, (_, i) => ({ n: i + 1, name: `س${i + 1}` })) };

  it('تُقرأ الآية من ملفها المحفوظ، وما لم يُحفظ يُبثّ من الشبكة', async () => {
    globalThis.Audio = FakeAudio;
    window.Audio = FakeAudio;
    let k = 0;
    URL.createObjectURL = () => `blob:local/${++k}`;
    URL.revokeObjectURL = () => {};
    // حُفظت الآيتان الأولى والثانية من الفاتحة وحدهما
    const cache = await C.open('reciter-audio-shuraym');
    await cache.put(`${shuraym}001001.mp3`, new Response('a'));
    await cache.put(`${shuraym}001002.mp3`, new Response('b'));
    localStorage.setItem('hq.offline', JSON.stringify({ shuraym: { status: 'paused', count: 2, total: 6236 } }));
    vi.resetModules();
    // المشغّل والتحميل من نسخة واحدة بعد إعادة التحميل
    const O2 = await import('../../src/lib/offline.js');
    const P2 = await import('../../src/lib/player.js');
    expect(O2.hasOfflineFiles('shuraym')).toBe(true);

    P2.play(q, [0, 1, 2]);
    await vi.waitFor(() => expect(FakeAudio.srcs.at(-1)).toMatch(/^blob:local\//));
    FakeAudio.last.dispatchEvent(new Event('ended'));
    await vi.waitFor(() => expect(FakeAudio.srcs).toHaveLength(2));
    expect(FakeAudio.srcs[1]).toMatch(/^blob:local\//);
    FakeAudio.last.dispatchEvent(new Event('ended'));
    await vi.waitFor(() => expect(FakeAudio.srcs).toHaveLength(3));
    expect(FakeAudio.srcs[2]).toBe(`${shuraym}001003.mp3`);
    P2.stop();
  });

  it('القارئ المحمَّل كاملًا: كل مقدار يُعدّ منزَّلًا بلا تنزيل جديد', async () => {
    globalThis.Audio = FakeAudio;
    window.Audio = FakeAudio;
    localStorage.setItem('hq.offline', JSON.stringify({ shuraym: { status: 'done', count: 6236, total: 6236 } }));
    vi.resetModules();
    const P2 = await import('../../src/lib/player.js');
    expect(P2.isDownloaded(q, [0, 1, 2, 7])).toBe(true);
    P2.setSettings({ reciter: 'afasy' });
    expect(P2.isDownloaded(q, [0, 1, 2, 7])).toBe(false);
  });
});
