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
//   juzHeaders — { صفحة: جزء } الصفحتان اللتان تذكر ترويستهما في المطبوع جزءًا يبدأ فيهما (٦٢ و٥٠٢)
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

// ما يُكتب في ترويسة الصفحة: السورة التي تبدأ بها الصفحة، وجزؤها كما في المطبوع: جزء أول آية فيها،
// إلا صفحتين تذكر ترويستهما الجزء الذي يبدأ فيهما (juzHeaders، scripts/data/08-rubs.mjs).
export function pageInfo(quran, page) {
  const lines = quran.pages[page - 1];
  const first = lines[0];
  const firstVerse = lines.find((l) => l.g).g[0][0];
  const sura = first.h ?? first.b ?? quran.verses[firstVerse].s;
  return { sura: quran.suras[sura - 1], juz: quran.juzHeaders?.[page] ?? quran.verses[firstVerse].j };
}
