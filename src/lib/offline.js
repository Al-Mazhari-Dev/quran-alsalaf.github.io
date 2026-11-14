// تحميل صوت قارئ لكامل القرآن (٢٠٢٦-١١-١٤): يُحفظ على الجهاز حفظًا دائمًا (Cache Storage)، فيعمل
// الاستماع بصوته بلا إنترنت ولو أُغلق التطبيق وفُتح من جديد — بخلاف «تنزيل للاستماع بلا إنترنت» في
// نافذة الاستماع (src/lib/player.js) الذي يبقى في الذاكرة طوال الجلسة وحدها.
//   • لكل قارئ ذاكرة مستقلة باسم reciter-audio-<id>، فيها ملف كل آية (٦٢٣٦ ملفًّا) بمفتاح رابطه في الشبكة.
//     وملف الفاتحة ١:١ منها هو البسملة نفسها قبل أول كل سورة.
//   • قارئ واحد يُحمَّل في كل مرة. والتحميل يجري في الخلفية ولو أُغلقت صفحة اختيار القارئ.
//   • الإيقاف المؤقت يُبقي ما حُمِّل، والاستئناف يكمل الناقص وحده. وإغلاق التطبيق أثناء التحميل يتركه
//     متوقفًا يُستأنف بزرّه. وانقطاع الاتصال يوقفه، ويُستأنف وحده إذا رجع الاتصال والتطبيق مفتوح.
//   • التشغيل (player.js) يقرأ من هنا كل آية موجودة لقارئها — ولو كان تحميله ناقصًا — ويبثّ الباقي.
//   • يُطلب من المتصفح تخزين دائم (navigator.storage.persist) فلا يمسح الملفات من نفسه عند ضيق المساحة.
// الحالة المحفوظة (localStorage «hq.offline»): { [id]: { status: 'paused' | 'done', count, total } }
import { useSyncExternalStore } from 'react';
import { ayahUrl, reciterById, reciterTitle } from './reciters.js';

const META_KEY = 'hq.offline';
const CACHE_PREFIX = 'reciter-audio-';
const CONCURRENCY = 6; // ملفات تُحمَّل معًا
const RETRIES = 2; // إعادة محاولة الملف الواحد قبل إيقاف التحميل
const RETRY_DELAY = 800;
const TICK_MS = 250; // أقصى تواتر لتحديث شريط التقدّم

// عدد آيات كل سورة (المجموع ٦٢٣٦) — يطابق public/data/quran.json (tests/unit/offline.test.js)
export const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69,
  60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
  11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19,
  5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export const cacheName = (id) => CACHE_PREFIX + id;
export const supported = () => typeof caches !== 'undefined' && typeof fetch !== 'undefined';

// روابط ملفات القارئ كلها بترتيب المصحف (بلا السور التي لا يشملها تسجيله إن وُجدت)
export function reciterUrls(r) {
  const urls = [];
  AYAH_COUNTS.forEach((n, i) => {
    if (r.missing?.includes(i + 1)) return;
    for (let a = 1; a <= n; a++) urls.push(ayahUrl(r, i + 1, a));
  });
  return urls;
}

// ---------- الحالة ----------
// items: { [id]: { status: 'downloading' | 'paused' | 'done', count, total } } · active: القارئ الجاري تحميله
function readMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    // تحميل كان جاريًا حين أُغلق التطبيق: صار متوقفًا يُستأنف بزرّه
    for (const id of Object.keys(m)) if (m[id].status !== 'done') m[id] = { ...m[id], status: 'paused' };
    return m;
  } catch {
    return {};
  }
}

let state = { items: readMeta(), active: null };
const listeners = new Set();
function emit() {
  listeners.forEach((l) => l());
}
function setItem(id, item) {
  const items = { ...state.items };
  if (item) items[id] = item;
  else delete items[id];
  state = { ...state, items };
  emit();
}
function saveMeta() {
  const out = {};
  for (const [id, it] of Object.entries(state.items)) out[id] = { status: it.status === 'done' ? 'done' : 'paused', count: it.count, total: it.total };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(out));
  } catch {
    // التخزين غير متاح
  }
}

export const offlineState = () => state;
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useOffline = () => useSyncExternalStore(subscribe, () => state);

// رسائل للمستخدم (اكتمال التحميل أو توقّفه) — يعرضها التطبيق رسالةً عابرة أينما كان
const notices = new Set();
export function onOfflineNotice(fn) {
  notices.add(fn);
  return () => notices.delete(fn);
}
const notify = (text) => notices.forEach((fn) => fn(text));

// هل للقارئ ملفات محفوظة (كاملة أو بعضها)؟ — فيبحث المشغّل عن الآية فيها قبل بثّها
export const hasOfflineFiles = (id) => !!state.items[id]?.count;
// هل حُمِّل القارئ كاملًا؟
export const isOfflineComplete = (id) => state.items[id]?.status === 'done';

// ---------- التحميل ----------
let token = 0; // يُزاد عند كل بدء أو إيقاف، فتتوقف عمّال التحميل السابقة
let controller = null;
let resumeOnline = null; // قارئ توقف تحميله لانقطاع الاتصال: يُستأنف وحده إذا رجع
let live = null; // العدد الفعلي للتحميل الجاري { id, count } (شريط التقدّم يُحدَّث على فترات)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isQuota = (e) => e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '');

async function fetchStore(cache, url, signal) {
  for (let t = 0; ; t++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // eslint-disable-next-line no-await-in-loop
      await cache.put(url, res);
      return;
    } catch (e) {
      if (signal.aborted || isQuota(e) || t >= RETRIES) throw e;
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_DELAY * (t + 1));
    }
  }
}

// المساحة المتاحة للتطبيق في المتصفح بالميغابايت (null إن لم يُعرف)
export async function freeSpaceMB() {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return null;
    return Math.max(0, Math.floor((quota - (usage || 0)) / 1e6));
  } catch {
    return null;
  }
}

// يبدأ تحميل القارئ id أو يستأنفه. النتيجة: 'done' · 'paused' (أوقفه المستخدم) · 'offline' (انقطع
// الاتصال) · 'failed' · 'nospace' · 'busy' (قارئ آخر يُحمَّل الآن) · 'unsupported' (المتصفح لا يتيح الحفظ)
export async function startDownload(id) {
  if (!supported()) return 'unsupported';
  if (state.active && state.active !== id) return 'busy';
  if (state.active === id) return 'busy';
  const r = reciterById(id);
  const urls = reciterUrls(r);
  const total = urls.length;
  const my = ++token;
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;
  resumeOnline = null;
  const prev = state.items[id];
  state = { ...state, active: id };
  setItem(id, { status: 'downloading', count: prev?.count ?? 0, total });
  // تخزين دائم: لا يمسح المتصفح الملفات من نفسه عند ضيق المساحة (يُطلب ولا يُنتظر قبوله)
  navigator.storage?.persist?.().catch(() => {});

  let cache;
  let todo;
  try {
    cache = await caches.open(cacheName(id));
    const have = new Set((await cache.keys()).map((req) => req.url));
    todo = urls.filter((u) => !have.has(u));
  } catch {
    return finish(my, id, 'failed');
  }
  live = { id, count: total - todo.length };
  let next = 0;
  let error = null;
  let last = 0;
  let pending = null;
  // تحديث شريط التقدّم مرة كل TICK_MS على الأكثر، وآخر تحديث لا يضيع
  const tick = (force) => {
    if (my !== token) return;
    const now = Date.now();
    if (force || now - last >= TICK_MS) {
      clearTimeout(pending);
      pending = null;
      last = now;
      setItem(id, { status: 'downloading', count: live.count, total });
      saveMeta();
    } else if (!pending) {
      pending = setTimeout(() => {
        pending = null;
        tick(true);
      }, TICK_MS - (now - last));
    }
  };
  tick(true);

  const worker = async () => {
    while (next < todo.length && !error && my === token) {
      const url = todo[next++];
      try {
        // eslint-disable-next-line no-await-in-loop
        await fetchStore(cache, url, signal);
        if (my === token) live.count++;
        tick(false);
      } catch (e) {
        if (!error) error = e;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  clearTimeout(pending);

  if (my !== token) return 'paused'; // أوقفه المستخدم أو حُذف (pauseDownload/deleteDownload تكفّلا بالحالة)
  const got = live.count;
  live = null;
  if (!error) {
    setItem(id, { status: 'done', count: total, total });
    state = { ...state, active: null };
    saveMeta();
    emit();
    notify(`اكتمل تحميل تلاوة ${reciterTitle(r)} — تعمل الآن بلا إنترنت`);
    return 'done';
  }
  setItem(id, { status: 'downloading', count: got, total });
  if (isQuota(error)) return finish(my, id, 'nospace');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return finish(my, id, offline ? 'offline' : 'failed');
}

function finish(my, id, result) {
  if (my !== token) return 'paused';
  token++;
  controller?.abort();
  const it = state.items[id];
  state = { ...state, active: null };
  if (it?.count) setItem(id, { ...it, status: 'paused' });
  else setItem(id, null);
  saveMeta();
  const name = reciterTitle(reciterById(id));
  if (result === 'nospace') notify(`توقّف تحميل ${name}: لا تكفي المساحة المتاحة على الجهاز`);
  else if (result === 'offline') {
    resumeOnline = id;
    notify(`توقّف تحميل ${name} لانقطاع الاتصال، ويُستأنف وحده إذا رجع`);
  } else if (result === 'failed') notify(`توقّف تحميل ${name}: تعذّر الوصول إلى ملفات الصوت`);
  return result;
}

// إيقاف مؤقت: يبقى ما حُمِّل، ويُستأنف لاحقًا من حيث وقف
export function pauseDownload() {
  const id = state.active;
  resumeOnline = null;
  if (!id) return;
  token++;
  controller?.abort();
  const it = { ...state.items[id], ...(live?.id === id ? { count: live.count } : {}) };
  live = null;
  state = { ...state, active: null };
  if (it.count) setItem(id, { ...it, status: 'paused' });
  else setItem(id, null);
  saveMeta();
}

// حذف ما حُمِّل للقارئ (ويوقف تحميله إن كان جاريًا)
export async function deleteDownload(id) {
  if (state.active === id) pauseDownload();
  if (resumeOnline === id) resumeOnline = null;
  setItem(id, null);
  saveMeta();
  dropUrls(id);
  try {
    await caches.delete(cacheName(id));
  } catch {
    // لا ذاكرة أصلًا
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const id = resumeOnline;
    resumeOnline = null;
    if (id && !state.active && state.items[id]?.status === 'paused') startDownload(id);
  });
}

// المتصفح قد يمسح الملفات (عند ضيق المساحة بلا تخزين دائم): قارئ سُجِّل محمَّلًا وذاكرته غير موجودة
// يُعاد إلى «لم يُحمَّل»
export async function verifyDownloads() {
  if (!supported()) return;
  for (const id of Object.keys(state.items)) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await caches.has(cacheName(id)).catch(() => true);
    if (!ok && state.active !== id) setItem(id, null);
  }
  saveMeta();
}

// ---------- القراءة للتشغيل ----------
// رابط محلي لملف الآية من ذاكرة القارئ إن وُجد فيها، وإلا null (فيُبثّ من الشبكة).
// تُبقى آخر بضعة روابط محلية وحدها، ويُحرَّر ما قبلها
const localUrls = new Map(); // رابط الشبكة ⇐ { id, url }
const MAX_LOCAL = 6;
function dropUrls(id) {
  for (const [k, v] of localUrls) {
    if (v.id === id) {
      URL.revokeObjectURL(v.url);
      localUrls.delete(k);
    }
  }
}

export async function localAudioUrl(id, remote) {
  if (!hasOfflineFiles(id) || !supported()) return null;
  const hit = localUrls.get(remote);
  if (hit) return hit.url;
  try {
    const res = await caches.match(remote, { cacheName: cacheName(id) });
    if (!res) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }));
    if (localUrls.size >= MAX_LOCAL) {
      const [k, v] = localUrls.entries().next().value;
      URL.revokeObjectURL(v.url);
      localUrls.delete(k);
    }
    localUrls.set(remote, { id, url });
    return url;
  } catch {
    return null;
  }
}
