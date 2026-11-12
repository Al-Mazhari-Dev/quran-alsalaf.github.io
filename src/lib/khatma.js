// الختمة (٢٠٢٦-١١-١٢): ختمة الورد اليومي — يحدد المستخدم مدتها بالأيام أو قدر وردها بالصفحات،
// فيقسم المصحف (٦٠٤ صفحات) أورادا متتابعة، يقرأ كل منها في صفحة الختمة ثم يسجل.
//
// • الورد يتبع الإنجاز لا التاريخ: «ورد اليوم» هو دائما أول ورد لم يتم، فلا يضيع شيء إن فات يوم،
//   ويعرف التأخر والتقدم بمقارنة ما أتم بأيام الخطة.
// • ختمة ورد واحدة فقط في وقت واحد. والختمة تحفظ بنوعها (type) في قائمة، فيضاف لاحقا نوع آخر
//   («ختمة التدبر» بطلب صاحب المشروع) يجتمع مع ختمة الورد دون تغيير طريقة الحفظ.
// • كل شيء على الجهاز وحده (localStorage)، كبقية بيانات المستخدم.
import { useEffect, useState } from 'react';
import { FIRST_PAGE, LAST_PAGE } from './position.js';

const KEY = 'hq.khatmas';
const DONE_KEY = 'hq.khatmasDone'; // عدد الختمات المتمة: { wird: n }
const EVENT = 'hq-khatma';

export const TOTAL_PAGES = LAST_PAGE - FIRST_PAGE + 1;
// الخيارات الجاهزة عند الإنشاء (ويكتب غيرها باليد)
export const DAY_PRESETS = [7, 10, 15, 30, 60];
export const PAGE_PRESETS = [1, 2, 5, 10, 20];
export const DEFAULT_PLAN = { mode: 'days', value: 30 };

// ---------- التواريخ: يوم محلي بصيغة YYYY-MM-DD ----------
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
// عدد الأيام من a إلى b (بالتقويم لا بالساعات، فلا يتأثر بالتوقيت الصيفي)
export const daysBetween = (a, b) => {
  const [x, y] = [parseDay(a), parseDay(b)];
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5);
};

// التاريخ بالميلادي والهجري معا (الهجري بتقويم أم القرى المدمج في المتصفح، بلا إنترنت)
const gregorian = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' });
export function formatDates(key) {
  const d = parseDay(key);
  return {
    gregorian: `${gregorian.format(d).replace('، ', ' ')}م`,
    hijri: hijri.format(d).replace(/\s*هـ$/, 'هـ'),
  };
}

// ---------- تقسيم الأوراد ----------
// يقسم الصفحات من from إلى to أورادا: [[أول صفحة، آخر صفحة], ...]
//  • بالأيام: عدد الأوراد هو عدد الأيام، والصفحات موزعة بالتساوي (يزيد بعضها صفحة على بعض)،
//    فلا يبقى يوم أخير قصير جدا.
//  • بالصفحات: كل ورد بالقدر المختار تماما، والورد الأخير ما بقي.
export function splitWirds(from, to, mode, value) {
  const total = to - from + 1;
  if (total <= 0) return [];
  const n = Math.max(1, Math.floor(value) || 1);
  const out = [];
  if (mode === 'pages') {
    for (let p = from; p <= to; p += n) out.push([p, Math.min(to, p + n - 1)]);
    return out;
  }
  const days = Math.min(n, total);
  for (let i = 0; i < days; i++) {
    const a = from + Math.floor((i * total) / days);
    const b = from + Math.floor(((i + 1) * total) / days) - 1;
    out.push([a, b]);
  }
  return out;
}

// ملخص الخطة قبل اعتمادها: عدد الأيام، وأقل الورد وأكثره بالصفحات، ويوم الختم المتوقع
export function previewPlan(mode, value, from = FIRST_PAGE, start = dayKey()) {
  const wirds = splitWirds(from, LAST_PAGE, mode, value);
  const sizes = wirds.map(([a, b]) => b - a + 1);
  return { days: wirds.length, min: Math.min(...sizes), max: Math.max(...sizes), end: addDays(start, wirds.length - 1) };
}

// ---------- الحفظ ----------
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين غير متاح (تصفح خاص): يبقى التغيير في هذه الجلسة وحدها
  }
  window.dispatchEvent(new Event(EVENT));
}

export const readKhatmas = () => read(KEY, []);
export const readWird = () => readKhatmas().find((k) => k.type === 'wird') ?? null;
export const readDoneCount = () => read(DONE_KEY, {}).wird ?? 0;

function saveWird(k) {
  const others = readKhatmas().filter((x) => x.type !== 'wird');
  write(KEY, k ? [...others, k] : others);
}

/*
  ختمة الورد المحفوظة:
    type 'wird' · created يوم الإنشاء
    mode 'days' | 'pages' · value عدد الأيام أو صفحات الورد
    from أول صفحة في الخطة الحالية (تتغير عند تعديل الخطة إلى أول صفحة لم تقرأ)
    planStart يوم بداية الخطة الحالية · done الأوراد المتمة في الخطة الحالية
    doneBefore الأوراد المتمة قبل آخر تعديل للخطة · lastDone آخر يوم أتم فيه ورد
    finished يوم الختم (إن ختمت، وتبقى حتى «ابدأ ختمة جديدة» أو الحذف)
*/
export function startWird(mode, value, today = dayKey()) {
  const k = { type: 'wird', created: today, mode, value, from: FIRST_PAGE, planStart: today, done: 0, doneBefore: 0, lastDone: null, finished: null };
  saveWird(k);
  return k;
}

// تعديل الخطة أثناء الختمة: يعاد التقسيم من أول صفحة لم تقرأ، دون أن يضيع ما قرئ. وإن كان ورد
// اليوم قد أتم بدأت الخطة الجديدة من الغد
export function editWird(mode, value, today = dayKey()) {
  const k = readWird();
  if (!k || k.finished) return null;
  const { next } = wirdState(k, today);
  const updated = {
    ...k,
    mode,
    value,
    from: next,
    planStart: k.lastDone === today ? addDays(today, 1) : today,
    doneBefore: k.doneBefore + k.done,
    done: 0,
  };
  saveWird(updated);
  return updated;
}

// إتمام الورد الحالي. والنتيجة: 'next' (بقي ورد) أو 'finished' (ختم المصحف)
export function completeWird(today = dayKey()) {
  const k = readWird();
  if (!k || k.finished) return null;
  const wirds = splitWirds(k.from, LAST_PAGE, k.mode, k.value);
  const done = k.done + 1;
  const finished = done >= wirds.length;
  saveWird({ ...k, done, lastDone: today, finished: finished ? today : null });
  if (finished) write(DONE_KEY, { ...read(DONE_KEY, {}), wird: readDoneCount() + 1 });
  return finished ? 'finished' : 'next';
}

export const removeWird = () => saveWird(null);

// ---------- حال الختمة ----------
// كل ما تعرضه الواجهة عن الختمة في يوم معين
export function wirdState(k, today = dayKey()) {
  const wirds = splitWirds(k.from, LAST_PAGE, k.mode, k.value);
  const current = k.finished ? null : wirds[k.done] ?? null;
  const next = current ? current[0] : LAST_PAGE + 1;
  const read = next - FIRST_PAGE; // الصفحات المقروءة
  const remaining = wirds.length - k.done;
  const doneToday = k.lastDone === today;
  // اليوم من الخطة (٠ = يوم بدايتها): ما قبله من أيامها كان ينبغي أن تتم أوراده
  const day = daysBetween(k.planStart, today);
  const behind = Math.max(0, day - k.done);
  const ahead = Math.max(0, k.done - (day + 1));
  // يوم الختم المتوقع بحسب ما بقي: ورد كل يوم من اليوم (أو من الغد إن أتم ورد اليوم)
  const end = k.finished ?? addDays(today, doneToday ? remaining : remaining - 1);
  return {
    wirds,
    current, // [أول صفحة، آخر صفحة] للورد الحالي
    next,
    read,
    percent: Math.floor((read / TOTAL_PAGES) * 100),
    index: k.doneBefore + k.done + 1, // رقم الورد الحالي من أوراد الختمة كلها
    total: k.doneBefore + wirds.length,
    doneToday,
    behind,
    ahead,
    end,
    finished: !!k.finished,
  };
}

// «يوم واحد» · «يومين» · «٣ أيام» · «١١ يوما» (بأرقام عربية)
export function daysText(n, digits = (x) => x) {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return `${digits(n)} أيام`;
  return `${digits(n)} يوما`;
}

// «صفحة واحدة» · «صفحتين» · «٥ صفحات» · «٢٠ صفحة»
export function pagesText(n, digits = (x) => x) {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتين';
  if (n >= 3 && n <= 10) return `${digits(n)} صفحات`;
  return `${digits(n)} صفحة`;
}

// تتحدث عند أي تغيير في الختمة
const snapshot = () => ({ wird: readWird(), doneCount: readDoneCount() });
export function useKhatma() {
  const [data, setData] = useState(snapshot);
  useEffect(() => {
    const update = () => setData(snapshot());
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return data;
}
