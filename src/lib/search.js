// البحث الرئيسي في المصحف (الفصل ٨ من المواصفة): في النص الإملائي للآيات،
// وفي أسماء السور، وبالأرقام (رقم وحده: الصفحة ثم السورة ثم الجزء بهذا الرقم)،
// وبالسورة ورقم الآية («البقرة ٢٥٥» أو «٢:٢٥٥»).
//
// النص الإملائي أسهل على الكاتب من الرسم العثماني. ويُطبَّع الطرفان — نصّ الآيات
// وما يكتبه المستخدم — تطبيعًا واحدًا، فيجد «الرحمن» ولو كتبه بلا همزة، أو كتب
// «الرحمه» بالهاء، أو «على» بالياء.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalizeArabic(s) {
  return (s || '')
    .normalize('NFC')
    .replace(DIACRITICS, '')
    .replace(/[ٱأإآ]/g, 'ا') // ٱ أ إ آ ← ا
    .replace(/ى/g, 'ي') // ى ← ي
    .replace(/ة/g, 'ه') // ة ← ه
    .replace(/ؤ/g, 'و') // ؤ ← و
    .replace(/ئ/g, 'ي') // ئ ← ي
    .replace(/[^ء-ي0-9٠-٩ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// الأرقام العربية والفارسية ← إنجليزية
const latinDigits = (s) =>
  (s || '').replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);

// الرقم وحده (بأرقام عربية أو إنجليزية، والأصفار في أوله لا تؤثر) ← قيمته؛ وغيره ← null
export function parseNumber(query) {
  const q = latinDigits(query).trim();
  return /^\d+$/.test(q) ? Number(q) : null;
}

// السورة ورقم الآية: «البقرة 255» و«سورة البقرة ٢٥٥» و«بقرة 255» ← { name: 'البقره', a: 255 }،
// و«2:255» أو «٢:٢٥٥» ← { n: 2, a: 255 }؛ وغيرهما ← null
export function parseVerseRef(query) {
  const raw = latinDigits(query).trim();
  const byNumber = raw.match(/^(\d+)\s*[:：]\s*(\d+)$/);
  if (byNumber) return { n: Number(byNumber[1]), a: Number(byNumber[2]) };
  const q = normalizeArabic(raw);
  const m = q.match(/^(.*[ء-ي])\s*(\d+)$/);
  if (!m) return null;
  const name = m[1].trim().replace(/^سوره /, '');
  return name ? { name, a: Number(m[2]) } : null;
}

export function buildSearchIndex(quran) {
  // أول صفحة في كل جزء: صفحة أول آية منه
  const juzPages = [];
  for (const v of quran.verses) juzPages[v.j - 1] ??= v.p;
  // موضع أول آية من كل سورة في قائمة الآيات
  const suraStart = [];
  quran.verses.forEach((v, i) => (suraStart[v.s - 1] ??= i));
  return {
    verses: quran.verses.map((v, i) => ({ i, key: normalizeArabic(v.e) })),
    suras: quran.suras.map((s, k) => ({ n: s.n, key: normalizeArabic(s.name), page: s.page, count: s.count, start: suraStart[k] })),
    pageCount: quran.pages.length,
    juzPages,
  };
}

// كل ما يتعلق بالرقم n وهو موجود، بهذا الترتيب: الصفحة، ثم السورة، ثم الجزء.
// ولكلٍّ الصفحة التي يُنتقل إليها (السورة والجزء: أول صفحة فيهما).
export function searchNumber(index, n) {
  const out = [];
  if (n >= 1 && n <= index.pageCount) out.push({ kind: 'page', n, page: n });
  if (n >= 1 && n <= index.suras.length) out.push({ kind: 'sura', n, page: index.suras[n - 1].page });
  if (n >= 1 && n <= index.juzPages.length) out.push({ kind: 'juz', n, page: index.juzPages[n - 1] });
  return out;
}

// السور التي يدل عليها الاسم: المطابقة تمامًا (بـ«ال» أو بدونها) إن وُجدت، وإلا كل سورة
// يحتوي اسمها ما كُتب (حرفان فأكثر)، بترتيب المصحف
function surasByName(index, name) {
  const exact = index.suras.filter((s) => s.key === name || s.key === `ال${name}`);
  if (exact.length) return exact;
  return name.length < 2 ? [] : index.suras.filter((s) => s.key.includes(name));
}

// نتائج السورة ورقم الآية: لكل سورة { s, a, i } — i موضع الآية في قائمة الآيات، أو null
// إن جاوز الرقم عدد آيات السورة. ولا سورة بالاسم أو الرقم ← null (فيبقى بحثًا نصيًّا)
export function searchVerseRef(index, ref) {
  const suras = ref.n != null ? index.suras.filter((s) => s.n === ref.n) : surasByName(index, ref.name);
  if (!suras.length) return null;
  return suras.map((s) => ({ s: s.n, a: ref.a, i: ref.a >= 1 && ref.a <= s.count ? s.start + ref.a - 1 : null }));
}

// الآية تُطابق إن احتوت كل كلمات البحث (بأي ترتيب)، والنتائج بترتيب المصحف
// والرقم وحده يُبحث به في الأرقام لا في النص (ويكفي فيه رقم واحد)، ونتائجه في numbers.
// واسم السورة ثم رقم (أو «سورة:آية») نتائجه في refs: الآية أولًا، ثم سورتها في suras.
export function search(index, query, limit = 50) {
  const n = parseNumber(query);
  if (n !== null) return { suras: [], verses: [], total: 0, numbers: searchNumber(index, n) };

  const ref = parseVerseRef(query);
  const refs = ref && searchVerseRef(index, ref);
  if (refs) return { suras: refs.map((r) => r.s), verses: [], total: 0, refs };

  const q = normalizeArabic(query);
  if (q.length < 2) return { suras: [], verses: [], total: 0 };

  const bare = q.replace(/^سوره /, '');
  const suras = index.suras.filter((s) => s.key.includes(bare)).map((s) => s.n);

  const terms = q.split(' ');
  const hits = [];
  for (const v of index.verses) {
    if (terms.every((t) => v.key.includes(t))) hits.push(v.i);
  }
  return { suras, verses: hits.slice(0, limit), total: hits.length };
}
