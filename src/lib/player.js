// الاستماع (الفصل ٦): مشغّل واحد للتطبيق كله، بعنصر صوت واحد.
//   • «تشغيل» فوري: بثّ مباشر آيةً آية بلا انتظار، كما في المصحف المطبوع — يحتاج اتصالًا
//     مستمرًا، وينقطع الصوت إن انقطع الاتصال (بقرار صاحب المشروع ٢٠٢٦-٠٩-٢٢، بعد أن تبيّن أن
//     تحميل المقدار كاملًا قبل التشغيل يؤخره كثيرًا خصوصًا لقرّاء ملف السورة)
//   • «تنزيل» منفصل واختياري: يُحمَّل صوت المقدار كاملًا (بشريط تقدّم)، وبعده يشغَّل من نسخة
//     محلية بلا حاجة لاتصال، ولو قُفل الجهاز أو قُطع الإنترنت — لأن التشغيل يستعمل تلقائيًا
//     أي ملف محمَّل سلفًا بدل بثّه من الشبكة
//   • كل قارئ ملف مستقل لكل آية (src/lib/reciters.js)
//   • قبل الآية الأولى من كل سورة (عدا الفاتحة والتوبة) تُقرأ البسملة: وهي آية الفاتحة الأولى
//     بصوت القارئ نفسه
//   • التشغيل في الخلفية وأزرار شاشة القفل عبر Media Session
import { useSyncExternalStore } from 'react';
import { ayahUrl, covers, reciterById, reciterTitle } from './reciters.js';

const KEY = 'hq.listen';
// ١ (بدون تكرار) يُعرض بعبارته لا رقمه؛ فالقائمة العددية تبدأ من ٢ (بطلب صاحب المشروع)
export const REPEATS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50];
export const FOREVER = 0; // تكرار النطاق بلا نهاية (∞)

const DEFAULTS = { reciter: 'shuraym', verseRepeat: 1, rangeRepeat: 1 };

function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// ---------- الحالة المعلنة لواجهة التطبيق ----------
// status: 'idle' | 'loading' | 'playing' | 'paused' — v: الآية الجاري تلاوتها
// n: يُزاد عند بدء كل مقطع (آية أو بسملة أو إعادتها)، فيُعرف به بدء الآية التالية ولو كانت هي نفسها
// download: null أو { active, done, fileIndex, fileCount, pct } — تقدّم التنزيل المنفصل
let state = { status: 'idle', v: null, n: 0, settings: readSettings(), error: null, download: null };
const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePlayer = () => useSyncExternalStore(subscribe, () => state);

// ---------- المحرّك ----------
let audio = null;
let quran = null;
let queue = []; // آيات النطاق (أرقامها في المصحف)
let pos = 0; // موضع الآية الجارية في النطاق
let verseRep = 0; // كم مرة قُرئت الآية الجارية
let rangeRep = 0; // كم مرة قُرئ النطاق
let continuous = false; // استماع بلا مقدار: من الصفحة الظاهرة متتابعًا إلى آخر المصحف، بلا تكرار للمقدار
let seg = null; // المقطع الجاري: { v, s, a, basmala }
let gen = 0; // يُزاد عند كل تشغيل أو إيقاف جديد، فيُهمل ما تأخر من طلبات تشغيل سابقة
let dlToken = 0; // يُزاد عند كل تنزيل أو إلغاء، مستقل عن gen، فلا يقطع أحدهما الآخر

// ---------- ذاكرة الملفات المنزَّلة (رابط الشبكة ⇐ رابط محلي) ----------
// تُستعمل تلقائيًا في التشغيل إن وُجدت (فيعمل بلا اتصال)، وتبقى طوال الجلسة وحدها لا أكثر.
const blobUrls = new Map();
const MAX_CACHED_FILES = 24;
function cacheBlob(url, blob) {
  if (blobUrls.size >= MAX_CACHED_FILES) {
    const oldest = blobUrls.keys().next().value;
    URL.revokeObjectURL(blobUrls.get(oldest));
    blobUrls.delete(oldest);
  }
  blobUrls.set(url, URL.createObjectURL(blob));
}
const resolveUrl = (remote) => blobUrls.get(remote) || remote;

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('ended', () => segmentDone());
  audio.addEventListener('playing', () => state.status !== 'idle' && set({ status: 'playing' }));
  audio.addEventListener('waiting', () => state.status === 'playing' && set({ status: 'loading' }));
  audio.addEventListener('error', () => {
    if (state.status === 'idle' || !audio.getAttribute('src')) return;
    stop();
    set({ error: { text: 'تعذّر تشغيل الصوت. الاستماع يحتاج اتصالًا بالإنترنت (إلا ما نُزِّل مسبقًا).', n: Date.now() } });
  });
  setupMediaSession();
  return audio;
}

// ---------- التنزيل المنفصل (اختياري، للاستماع بلا إنترنت) ----------
// روابط ملفات الآيات المطلوبة (ملف مستقل لكل آية، ومثله للبسملة إن لزمت)
function resourcesFor(verses) {
  const r = reciterById(state.settings.reciter);
  const files = new Set(verses.map((v) => ayahUrl(r, quran.verses[v].s, quran.verses[v].a)));
  const needsBasmala = verses.some((v) => {
    const { s, a } = quran.verses[v];
    return a === 1 && s !== 1 && s !== 9;
  });
  if (needsBasmala) files.add(ayahUrl(r, 1, 1));
  return [...files];
}

// يُنزّل ملفًا مع تبليغ نسبة تقدّمه (إن عُرف حجمه من الخادم)
async function fetchBlob(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body?.getReader || !total) {
    const blob = await res.blob();
    onProgress(null);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  }
  return new Blob(chunks, { type: 'audio/mpeg' });
}

// ينزّل صوت verses بالقارئ الحالي، ليُشغَّل لاحقًا بلا إنترنت. النتيجة:
// 'unsupported' (القارئ لا يشمل هذا الموضع) · 'failed' (تعذّر التنزيل) · 'cancelled' · 'ok'
export async function downloadRange(q, verses) {
  quran = q;
  const r = reciterById(state.settings.reciter);
  if (!covers(r, suraList(verses))) return 'unsupported';
  const myToken = ++dlToken;
  const files = resourcesFor(verses);
  set({ download: { active: true, done: false, fileIndex: 0, fileCount: files.length, pct: null } });
  for (let i = 0; i < files.length; i++) {
    if (myToken !== dlToken) return 'cancelled';
    const url = files[i];
    if (blobUrls.has(url)) continue;
    set({ download: { active: true, done: false, fileIndex: i + 1, fileCount: files.length, pct: 0 } });
    try {
      // eslint-disable-next-line no-await-in-loop
      const blob = await fetchBlob(url, (pct) => {
        if (myToken === dlToken) set({ download: { active: true, done: false, fileIndex: i + 1, fileCount: files.length, pct } });
      });
      if (myToken !== dlToken) return 'cancelled';
      cacheBlob(url, blob);
    } catch {
      set({ download: null });
      return 'failed';
    }
  }
  set({ download: { active: false, done: true, fileIndex: files.length, fileCount: files.length, pct: 100 } });
  return 'ok';
}

export function cancelDownload() {
  dlToken++;
  set({ download: null });
}

// هل مقدار verses منزَّل كاملًا بالقارئ الحالي؟ (لعرض «تم التنزيل» بدل زرّه)
export function isDownloaded(q, verses) {
  quran = q;
  const r = reciterById(state.settings.reciter);
  if (!covers(r, suraList(verses))) return false;
  return resourcesFor(verses).every((f) => blobUrls.has(f));
}

// يبدأ الاستماع لآيات verses فورًا: من ملف منزَّل إن وُجد، وإلا بثًّا مباشرًا. النتيجة:
// 'unsupported' (القارئ المختار لا يشمل تسجيلُه موضعها، كما في downloadRange) · 'playing'
// cont: استماع متتابع بلا مقدار (verses من أول الصفحة الظاهرة إلى آخر المصحف): لا يُكرَّر، ويقف في آخره
export function play(q, verses, cont = false) {
  quran = q;
  const r = reciterById(state.settings.reciter);
  if (!covers(r, suraList(verses))) return 'unsupported';
  ++gen;
  queue = verses;
  continuous = cont;
  pos = 0;
  verseRep = 0;
  rangeRep = 0;
  set({ error: null });
  startVerse(true);
  return 'playing';
}

// تعديل المقدار أثناء التشغيل (عند إغلاق نافذة الاستماع بعد تعديله): إن بقيت الآية الجارية داخل
// المقدار الجديد أكمل منها بلا انقطاع وانتهى عند نهايته الجديدة، بعدّاد التكرار نفسه؛ وإلا بدأ من
// أول آية فيه بعدّاد تكرار جديد. النتيجة كـplay()، أو 'continued' إن أكمل من حيث هو
export function retarget(q, verses, cont = false) {
  if (state.status === 'idle') return 'idle';
  const at = verses.indexOf(queue[pos]);
  if (at < 0) return play(q, verses, cont);
  quran = q;
  if (!covers(reciterById(state.settings.reciter), suraList(verses))) {
    stop();
    return 'unsupported';
  }
  queue = verses;
  continuous = cont;
  pos = at;
  return 'continued';
}

const suraList = (verses) => [...new Set(verses.map((v) => quran.verses[v].s))];

// يقرأ الآية الجارية (مسبوقة بالبسملة إن كانت أول سورتها وهذه أول قراءة لها)
function startVerse(withBasmala) {
  const v = queue[pos];
  const { s, a } = quran.verses[v];
  const basmala = withBasmala && verseRep === 0 && a === 1 && s !== 1 && s !== 9;
  playSegment(basmala ? { v, s: 1, a: 1, basmala: true } : { v, s, a });
}

function playSegment(next) {
  const el = ensureAudio();
  const r = reciterById(state.settings.reciter);
  seg = next;
  set({ status: el.paused ? 'loading' : 'playing', v: next.v, n: state.n + 1 });
  updateMetadata();
  // ملف منزَّل مسبقًا فيُشغَّل مباشرة، وإلا فبثّ مباشر من الشبكة
  el.src = resolveUrl(ayahUrl(r, next.s, next.a));
  el.play().catch(onPlayError);
}

function onPlayError(e) {
  // إيقاف مقصود أثناء التحميل ليس خطأ
  if (e?.name === 'AbortError') return;
  if (e?.name === 'NotAllowedError') {
    set({ status: 'paused' });
    return;
  }
  stop();
  set({ error: { text: 'تعذّر تشغيل الصوت. الاستماع يحتاج اتصالًا بالإنترنت (إلا ما نُزِّل مسبقًا).', n: Date.now() } });
}

function segmentDone() {
  if (!seg || state.status === 'idle') return;
  const done = seg;
  seg = null; // لا يُحتسب المقطع منتهيًا مرتين
  // بعد البسملة: الآية نفسها
  if (done.basmala) return startVerse(false);
  const { verseRepeat, rangeRepeat } = state.settings;
  // تكرار الآية: يُقفز إلى أولها من جديد
  if (++verseRep < verseRepeat) return startVerse(false);
  verseRep = 0;
  if (++pos >= queue.length) {
    if (continuous) return stop();
    pos = 0;
    if (rangeRepeat !== FOREVER && ++rangeRep >= rangeRepeat) return stop();
  }
  startVerse(true);
}

export function pause() {
  if (!audio || state.status === 'idle') return;
  audio.pause();
  set({ status: 'paused' });
}

export function resume() {
  if (!audio || state.status !== 'paused') return;
  audio.play().catch(onPlayError);
}

export function stop() {
  gen++;
  seg = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  set({ status: 'idle', v: null });
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
}

// الانتقال إلى الآية السابقة أو التالية في النطاق (من أزرار شاشة القفل)
function skip(d) {
  if (state.status === 'idle') return;
  pos = (pos + d + queue.length) % queue.length;
  verseRep = 0;
  seg = null;
  startVerse(true);
}

// حفظ الإعدادات. وتغيير القارئ أثناء التشغيل يعيد الآية الجارية بصوت القارئ الجديد
export function setSettings(patch) {
  const settings = { ...state.settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // التخزين غير متاح: تسري الإعدادات في هذه الجلسة وحدها
  }
  set({ settings });
  if (patch.reciter && state.status !== 'idle') {
    const r = reciterById(patch.reciter);
    if (!covers(r, suraList(queue))) {
      stop();
      return false;
    }
    // نفس الموضع بصوت القارئ الجديد: البسملة إن كانت هي الجارية، وإلا الآية نفسها
    const inBasmala = !!seg?.basmala;
    seg = null;
    startVerse(inBasmala);
  }
  return true;
}

// ---------- Media Session: التشغيل في الخلفية وأزرار شاشة القفل ----------
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const on = (action, fn) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      // الإجراء غير مدعوم في هذا المتصفح
    }
  };
  on('play', resume);
  on('pause', pause);
  on('stop', stop);
  on('previoustrack', () => skip(-1));
  on('nexttrack', () => skip(1));
}

function updateMetadata() {
  if (!('mediaSession' in navigator) || !quran || !seg) return;
  const verse = quran.verses[seg.v];
  const r = reciterById(state.settings.reciter);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `سورة ${quran.suras[verse.s - 1].name} — الآية ${verse.a}`,
      artist: reciterTitle(r),
      album: 'قرآن السلف',
      artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    // MediaMetadata غير مدعوم
  }
}
