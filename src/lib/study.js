// بيانات صفحات المحتوى (تفسير · معاني الكلمات · العمل بالآيات) لنطاق من الآيات.
//
// التفسيران يُحمَّلان عند أول فتح للصفحات السفلية لا عند فتح التطبيق (نحو ٤ ميغابايت)،
// وعامل الخدمة يحفظهما، فيعملان بعدها بلا إنترنت.

const BASE = import.meta.env.BASE_URL;
const TAFSIR_KEY = 'hq.tafsir';
export const TAFSIR_SOURCES = [
  { id: 'mukhtasar', name: 'المختصر', title: 'المختصر في تفسير القرآن الكريم' },
  { id: 'muyassar', name: 'الميسّر', title: 'التفسير الميسّر' },
];

// مصدر التفسير المختار: يُحفظ ويبقى في كل فتح لاحق، والافتراضي المختصر
export function readTafsirSource() {
  try {
    return localStorage.getItem(TAFSIR_KEY) === 'muyassar' ? 'muyassar' : 'mukhtasar';
  } catch {
    return 'mukhtasar';
  }
}

export function saveTafsirSource(id) {
  try {
    localStorage.setItem(TAFSIR_KEY, id);
  } catch {
    // التخزين غير متاح: يسري في هذه الجلسة وحدها
  }
}

const tafsirs = new Map();
export function loadTafsir(id) {
  let p = tafsirs.get(id);
  if (!p) {
    p = fetch(`${BASE}data/tafsir-${id}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        tafsirs.delete(id); // تُتاح إعادة المحاولة
        throw err;
      });
    tafsirs.set(id, p);
  }
  return p;
}

// آيات الصفحة بترتيبها
export function pageVerses(quran, page) {
  const out = [];
  for (const line of quran.pages[page - 1]) {
    if (!line.g) continue;
    for (const [v] of line.g) if (out.at(-1) !== v) out.push(v);
  }
  return out;
}

// فهارس المذكرات لكل آية، تُبنى مرة واحدة
const indexes = new WeakMap();
export function memoIndex(quran) {
  let idx = indexes.get(quran);
  if (idx) return idx;
  const { sections = [], meanings = [], actions = [] } = quran.memos ?? {};
  const n = quran.verses.length;
  const sectionOf = { t: new Int32Array(n).fill(-1), m: new Int32Array(n).fill(-1), a: new Int32Array(n).fill(-1) };
  sections.forEach((s, i) => {
    for (const [a, b] of s.r) for (let v = a; v <= b; v++) sectionOf[s.k][v] = i;
  });
  const meaningsOf = new Map();
  for (const [v, word, meaning, , from, to] of meanings) {
    if (!meaningsOf.has(v)) meaningsOf.set(v, []);
    // الكلمة بلفظها من المصحف إن عُرف موضعها في الآية، وإلا كما كُتبت في المذكرة
    const mushaf = from === undefined ? null : quran.verses[v].t.slice(from, to + 1).join(' ');
    meaningsOf.get(v).push({ word, meaning, mushaf });
  }
  const actionsOf = new Map();
  actions.forEach((a, i) => {
    for (const v of a.v) {
      if (!actionsOf.has(v)) actionsOf.set(v, []);
      actionsOf.get(v).push(i);
    }
  });
  idx = { sections, actions, sectionOf, meaningsOf, actionsOf };
  indexes.set(quran, idx);
  return idx;
}

// أقسام نوعٍ ما (t/m/a) التي تمسّ النطاق، بترتيب أول ظهورها، لعرض روابطها
export function sectionsInRange(quran, kind, verses) {
  const { sectionOf } = memoIndex(quran);
  const seen = [];
  for (const v of verses) {
    const s = sectionOf[kind][v];
    if (s >= 0 && !seen.includes(s)) seen.push(s);
  }
  return seen;
}

// التوجيهات العملية التي تمسّ النطاق: كل توجيه مرة واحدة، كاملًا ولو تجاوزت آياته النطاق
export function actionsInRange(quran, verses) {
  const { actionsOf } = memoIndex(quran);
  const seen = new Set();
  const out = [];
  for (const v of verses) for (const i of actionsOf.get(v) ?? []) if (!seen.has(i)) {
    seen.add(i);
    out.push(i);
  }
  return out;
}

// «البقرة ٣» أو «البقرة ٣–٥»
const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
export function verseLabel(quran, list) {
  const first = quran.verses[list[0]];
  const last = quran.verses[list.at(-1)];
  const name = quran.suras[first.s - 1].name;
  // آية واحدة (ولو حُددت بدايةً ونهاية معًا) تُكتب بلا «–»
  if (list.length === 1 || list[0] === list.at(-1)) return `${name} ${ar(first.a)}`;
  if (first.s === last.s) return `${name} ${ar(first.a)}–${ar(last.a)}`;
  return `${name} ${ar(first.a)} – ${quran.suras[last.s - 1].name} ${ar(last.a)}`;
}

export function sectionLabel(quran, section) {
  const list = section.r.flatMap(([a, b]) => [a, b]);
  return verseLabel(quran, [Math.min(...list), Math.max(...list)]);
}

// نص الآية بالرسم العثماني، وآخره علامتها برقمها (تُرسم بخط المصحف في التطبيق)
export const verseText = (quran, v) => quran.verses[v].t.join(' ');

// ---------- النسخ للمشاركة ----------
// علامة الآية في النص رمزٌ خاص بخط المصحف، يظهر في الخطوط العادية حروفًا غريبة («ئج»)؛
// فيُنسخ النص بلا علامته، ويُكتب رقم الآية بين قوسين أو في المرجع.
export const versePlain = (quran, v) => quran.verses[v].t.slice(0, -1).join(' ');

// ﴿نص الآية﴾ [السورة: رقمها]
export function copyVerse(quran, v) {
  const x = quran.verses[v];
  return `﴿${versePlain(quran, v)}﴾ [${quran.suras[x.s - 1].name}: ${ar(x.a)}]`;
}

// آيات النطاق، مجموعةً بالسور: ﴿آية (١) آية (٢)﴾ [السورة: ١–٢]
export function copyVerses(quran, list) {
  const groups = [];
  for (const v of list) {
    const s = quran.verses[v].s;
    if (groups.at(-1)?.s === s) groups.at(-1).vs.push(v);
    else groups.push({ s, vs: [v] });
  }
  return groups
    .map(({ s, vs }) => {
      const text = vs.map((v) => `${versePlain(quran, v)} (${ar(quran.verses[v].a)})`).join(' ');
      const a = quran.verses[vs[0]].a;
      const b = quran.verses[vs.at(-1)].a;
      return `﴿${text}﴾ [${quran.suras[s - 1].name}: ${ar(a)}${b !== a ? `–${ar(b)}` : ''}]`;
    })
    .join('\n\n');
}

// نص الميسّر: علامتا الاقتباس فيه رمزان خاصان بخط المصحف، فيُكتبان قوسين عاديين
export const muyassarPlain = (text, quote) => text.split(quote[0]).join('﴿').split(quote[1]).join('﴾');
