// البحث الرئيسي في المصحف (الفصل ٨ من المواصفة): في النص الإملائي للآيات،
// وفي أسماء السور، وبالأرقام (رقم وحده: الصفحة ثم السورة ثم الجزء بهذا الرقم).
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

// الرقم وحده (بأرقام عربية أو إنجليزية، والأصفار في أوله لا تؤثر) ← قيمته؛ وغيره ← null
export function parseNumber(query) {
  const q = (query || '')
    .trim()
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);
  return /^\d+$/.test(q) ? Number(q) : null;
}

export function buildSearchIndex(quran) {
  // أول صفحة في كل جزء: صفحة أول آية منه
  const juzPages = [];
  for (const v of quran.verses) juzPages[v.j - 1] ??= v.p;
  return {
    verses: quran.verses.map((v, i) => ({ i, key: normalizeArabic(v.e) })),
    suras: quran.suras.map((s) => ({ n: s.n, key: normalizeArabic(s.name), page: s.page })),
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

// الآية تُطابق إن احتوت كل كلمات البحث (بأي ترتيب)، والنتائج بترتيب المصحف
// والرقم وحده يُبحث به في الأرقام لا في النص (ويكفي فيه رقم واحد)، ونتائجه في numbers.
export function search(index, query, limit = 50) {
  const n = parseNumber(query);
  if (n !== null) return { suras: [], verses: [], total: 0, numbers: searchNumber(index, n) };

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
