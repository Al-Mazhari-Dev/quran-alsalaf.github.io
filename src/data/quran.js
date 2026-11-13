// بيانات المصحف: تُحمَّل مرة واحدة، وتُشارَك بين كل أجزاء التطبيق.
//
// بنية الملف (يبنيه scripts/data/02-build-mushaf.mjs):
//   suras  — [{ n, name, place, count, page }]
//   verses — [{ s, a, p, j, t: [كلمات الرسم العثماني وآخرها علامة الآية], e: النص الإملائي }]
//   pages  — لكل صفحة أسطرها بالترتيب، وكل سطر واحد من:
//              { h: رقم السورة }  عنوان سورة
//              { b: رقم السورة }  بسملة
//              { g: [[رقم الآية في المصحف، أول كلمة، آخر كلمة], ...] }  أسطر الآيات
//   rubs   — أول آية في كل ربع من أرباع الأحزاب الـ٢٤٠ بالترتيب (يضيفه scripts/data/08-rubs.mjs)
//
// ويُضاف إليه qcf (يبنيه scripts/data/05-qcf4.mjs) — رسم الصفحات بخطوط صفحات المجمع:
//   widest   — أعرض سطر في المصحف بوحدة em (عليه يُضبط حجم الخط الواحد)
//   headerEm — عرض إطار اسم السورة بوحدة em، header — رمز إطار كل سورة
//   basmala  — رموز كلمات البسملة الأربع
//   pages    — لكل صفحة أسطرها بترتيب pages أعلاه: null لعنوان السورة والبسملة،
//              و{ w: عرض السطر em، k: [[رقم الآية، رمز الكلمة في خط الصفحة], ...] } لأسطر الآيات
//
// ويُضاف إليه memos (يبنيه scripts/data/06-memos.mjs) — محتوى المذكرات للأجزاء العشرة:
//   sections — أقسام التفسير/المعاني/العمل بمقاطع آياتها ورابط يوتيوب كل قسم
//   meanings — [رقم الآية، الكلمة، المعنى، رقم القسم، (من، إلى: موضعها في كلمات الآية)] · actions — { t نص التوجيه، v آياته، s قسمه }
//   weeks    — مقررات الأسابيع مقاطعَ بترتيب المصحف (للتمييز بالتناوب، src/lib/weeks.js)

let pending = null;

const getJson = (name) =>
  fetch(`${import.meta.env.BASE_URL}data/${name}`).then((res) => {
    if (!res.ok) throw new Error(`تعذّر تحميل المصحف (HTTP ${res.status})`);
    return res.json();
  });

export function loadQuran() {
  pending ??= Promise.all([getJson('quran.json'), getJson('qcf4.json'), getJson('memos.json')])
    .then(([quran, qcf, memos]) => ({ ...quran, qcf, memos }))
    .catch((err) => {
      pending = null; // تُتاح إعادة المحاولة
      throw err;
    });
  return pending;
}

export const linesPerPage = (page) => (page <= 2 ? 8 : 15);

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);

const JUZ = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر',
  'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون',
  'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون',
];
export const juzName = (j) => `الجزء ${JUZ[j - 1]}`;

// ما يُكتب في ترويسة الصفحة كمصحف المدينة المطبوع (قورنت ترويسات صفحاته الـ٦٠٤ كلها بصور مصحف
// جامعة الملك سعود): تُذكر السورة أو الجزء في ترويسة الصفحة التي يبدأ فيها إن كان أوله (عنوان
// السورة، أو أول سطر من الجزء) في نصفها الأعلى — الأسطر ١–٧ من ١٥ — أو كان نصفه فأكثر فيها
// (وذلك في قصار السور آخر المصحف، فتُذكر فيها السورتان أو الثلاث). فإن لم يُذكر ما بدأ فيها،
// فالترويسة لما في أول الصفحة. مثاله: ٥٠٢ «الأحقاف» و«الجزء السادس والعشرون» (عنوانها في السطر ٧)،
// و٢٣٥ «هود» لا «يوسف» (عنوانها في السطر ٩)، و٥٩١ «الطارق» و«الأعلى».
// المخرج: { sura: أول سورة تُذكر، suras: السور المذكورة بالترتيب، juz }
const UPPER_HALF = 7;
const headersCache = new WeakMap();

function computeHeaders(quran) {
  // وحدات كل سطر: سورته، وأجزاؤه (سطر العنوان والبسملة من جزء أول آية بعده)
  const lines = [];
  quran.pages.forEach((page, p) => {
    page.forEach((l, k) => {
      if (l.g) {
        const vs = l.g.map(([v]) => quran.verses[v]);
        lines.push({ p, k, s: [vs[0].s], j: [...new Set(vs.map((x) => x.j))] });
      } else {
        lines.push({ p, k, s: [l.h ?? l.b], j: null });
      }
    });
  });
  let nextJuz = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].j) nextJuz = lines[i].j[0];
    else lines[i].j = [nextJuz];
  }
  const units = (kind) => {
    const first = new Map(); // الوحدة ← أول سطر لها في المصحف { p, k }
    const total = new Map(); // الوحدة ← عدد أسطرها في المصحف
    const perPage = quran.pages.map(() => new Map()); // الوحدة ← عدد أسطرها في الصفحة
    for (const line of lines) {
      for (const u of line[kind]) {
        if (!first.has(u)) first.set(u, line);
        total.set(u, (total.get(u) ?? 0) + 1);
        perPage[line.p].set(u, (perPage[line.p].get(u) ?? 0) + 1);
      }
    }
    return perPage.map((onPage, p) => {
      const named = [...onPage.keys()].filter((u) => {
        const start = first.get(u);
        return start.p === p && (start.k < UPPER_HALF || 2 * onPage.get(u) >= total.get(u));
      });
      return named.length ? named : [onPage.keys().next().value];
    });
  };
  const suras = units('s');
  const juzs = units('j');
  return quran.pages.map((_, p) => ({ suras: suras[p].map((s) => quran.suras[s - 1]), juz: juzs[p][0] }));
}

export function pageInfo(quran, page) {
  let headers = headersCache.get(quran.pages);
  if (!headers) headersCache.set(quran.pages, (headers = computeHeaders(quran)));
  const { suras, juz } = headers[page - 1];
  return { sura: suras[0], suras, juz };
}
