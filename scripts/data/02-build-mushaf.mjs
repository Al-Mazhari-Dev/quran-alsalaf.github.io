// الخطوة ٢: بناء المصحف — ٦٠٤ صفحة، كل صفحة بأسطرها، وكل سطر بكلماته.
//
// المصدران:
//   • نص المصحف من مجمع الملك فهد (hafsData_v2-0) — هو الذي يُعرض
//   • رقم السطر لكل كلمة من تخطيط طبعة المجمع الرقمية (qdc، mushaf=19) — لقطع الأسطر فقط
//
// المحاذاة بين المصدرين تقوم على «هيكل الحروف» (الحروف بلا تشكيل ولا علامات)
// لا على عدد الكلمات. لأن المصدرين يختلفان أحيانًا في حدود الكلمة: «بَعۡدَ مَا»
// كلمتان عند المجمع وكلمة واحدة عند الآخر، و«مَالِيَ» بالعكس. فالمقارنة بالهيكل
// تجمع ما تفرّق وتفرّق ما اجتمع حتى يتطابق الهيكلان، ثم تنقل رقم السطر.
//
// والناتج يُتحقَّق منه بمقارنة مستقلة: ملف المجمع نفسه يذكر سطر بداية كل آية
// وسطر نهايتها، فتُقارن بهما الأسطر المشتقّة كلمةً كلمة.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const KF = '.cache/kfgqpc/hafsData_v2-0.json';
const PAGES = '.cache/qdc19/pages';
const CHAPTERS = '.cache/qurancom/chapters.json';
const OUT = 'public/data/quran.json';
const REPORT = '.cache/report-mushaf.json';

const RUB = '۞'; // ۞ علامة ربع الحزب
const exists = (p) => access(p).then(() => true, () => false);

// هيكل الحروف: يُسقط التشكيل وعلامات الضبط والوقف والهمزات، ويوحّد صور الألف
// والياء والواو. فالمصدران يختلفان في رسم الهمزة («تِلۡقَآيِٕ» عند المجمع و«تِلْقَآئِ»
// عند الآخر، و«فَٱدَّٰرَٰءۡتُمۡ» بهمزة مستقلة عند الأول ومركّبة عند الثاني)، والكلمة هي هي.
// والمحارف مكتوبة برموزها الصريحة لأن علامات التشكيل لا تُرى في المحرّر.
const skeleton = (s) =>
  s
    .normalize('NFC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g, '')
    .replace(/[\u0671\u0623\u0625\u0622]/g, '\u0627')
    .replace(/[\u0649\u06CC\u0626]/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0621/g, '')
    .replace(/[^\u0621-\u064A]/g, '');

// مفتاح أرخى للحكم على الفرق بعد المحاذاة: يُسقط حروف المدّ. فما بقي فرقًا بعده
// فهو فرق حقيقي يُراجَع، وما زال به فهو اختلاف رسم لا يمسّ موضع الكلمة
// (مثل «ٱفۡتَرَىٰهُ» عند المجمع و«افْتَرَاهُ» عند الآخر).
const loose = (sk) => sk.replace(/[\u0627\u064A\u0648]/g, '');

const isEndMark = (tok) => !/[ء-ي]/.test(tok) && tok.codePointAt(0) >= 0xfb50;

// ---------- القراءة ----------
const kf = JSON.parse(await readFile(KF, 'utf8'));
kf.sort((a, b) => a.id - b.id);

// إزاحة ترقيم الأسطر في الصفحتين الأوليين: أدنى سطر في الخريطة ناقص أدنى سطر عند المجمع
const pageShift = (p, j) =>
  Math.min(...j.verses.flatMap((x) => x.words.map((w) => w.line))) -
  Math.min(...kf.filter((r) => +r.page === p).map((r) => +r.line_start));

const apiWords = new Map();
const otherTypes = new Map();
for (let p = 1; p <= 604; p++) {
  const j = JSON.parse(await readFile(`${PAGES}/${String(p).padStart(3, '0')}.json`, 'utf8'));
  for (const v of j.verses) {
    // الصفحتان الأوليان (الفاتحة وأول البقرة) ثمانية أسطر، والخريطة ترقّمها على شبكة
    // ١٥ سطرًا لأنها موسّطة في الصفحة المطبوعة، وملف المجمع يرقّمها من ١ إلى ٨.
    // فالفرق يُحسب من البيانات نفسها ويُطرح، ولا يُفترض رقمًا ثابتًا.
    const shift = p <= 2 ? pageShift(p, j) : 0;
    const ws = [...v.words].sort((a, b) => a.pos - b.pos).map((w) => ({ ...w, line: w.line - shift }));
    for (const w of ws) if (w.type !== 'word' && w.type !== 'end') otherTypes.set(w.type, (otherTypes.get(w.type) || 0) + 1);
    apiWords.set(v.key, ws);
  }
}

if (!(await exists(CHAPTERS))) {
  const res = await fetch('https://api.quran.com/api/v4/chapters?language=ar');
  await writeFile(CHAPTERS, JSON.stringify(await res.json()));
}
const chapters = JSON.parse(await readFile(CHAPTERS, 'utf8')).chapters;

// ---------- المحاذاة ----------
const report = {
  verses: kf.length,
  exact: 0, // تطابق كل كلمة بكلمة
  regrouped: [], // اختلف حدّ الكلمة فجُمع أو فُرّق
  variants: 0, // اختلاف رسم حميد (همزة أو حرف مدّ)
  fuzzy: [], // تطابق الطول ولم يتطابق الهيكل — للمراجعة
  splitAcrossLines: [], // كلمة عند المجمع قابلتها كلمتان على سطرين
  markOnly: 0, // رموز بلا حروف في وسط الآية
  endFromKf: [], // آيات غابت علامتها من الخريطة فأُخذ سطرها من ملف المجمع
  markPulledBack: 0, // علامات آيات رُدّت إلى سطر آخر كلمة في آيتها
  lineCheck: { ok: 0, bad: [] }, // مقارنة بسطرَي البداية والنهاية في ملف المجمع
  pageCheck: { ok: 0, bad: [] },
  otherApiTypes: Object.fromEntries(otherTypes),
};

const verses = [];
for (const r of kf) {
  const key = `${r.sura_no}:${r.aya_no}`;
  const ws = apiWords.get(key);
  if (!ws) throw new Error(`آية غائبة من خريطة الأسطر: ${key}`);

  const toks = r.aya_text.trim().split(/\s+/);
  const lines = new Array(toks.length).fill(null);

  const endIdx = toks.length - 1;
  if (!isEndMark(toks[endIdx])) throw new Error(`لا علامة آية في آخر ${key}`);
  // علامة الآية: سطرها من الخريطة. وقد تَسِم الخريطة رقمَ الآية كلمةً عادية (كما في ٢:١٨١)
  // فيُعامل علامةً. فإن غابت العلامة كليًّا أُخذ سطرها من ملف المجمع نفسه.
  const endWord =
    ws.find((w) => w.type === 'end') ??
    (/^[٠-٩]+$/.test(ws.at(-1)?.text ?? '') ? ws.at(-1) : undefined);
  if (endWord) lines[endIdx] = endWord.line;
  else {
    lines[endIdx] = +r.line_end;
    report.endFromKf.push(key);
  }

  // الكلمات ذات الحروف فقط تدخل المحاذاة؛ ۞ والرموز تُلحق بجارتها بعدُ
  const content = [];
  for (let i = 0; i < endIdx; i++) {
    if (toks[i] === RUB) continue;
    if (!skeleton(toks[i])) {
      report.markOnly++;
      continue;
    }
    content.push(i);
  }
  const words = ws.filter((w) => w.type === 'word' && w !== endWord);

  let i = 0;
  let j = 0;
  let regrouped = false;
  while (i < content.length && j < words.length) {
    let a = skeleton(toks[content[i]]);
    let b = skeleton(words[j].text);
    const gi = [content[i]];
    const gj = [words[j]];
    let ii = i + 1;
    let jj = j + 1;
    while (a.length !== b.length) {
      if (a.length < b.length && ii < content.length) {
        a += skeleton(toks[content[ii]]);
        gi.push(content[ii++]);
      } else if (b.length < a.length && jj < words.length) {
        b += skeleton(words[jj].text);
        gj.push(words[jj++]);
      } else break;
    }
    if (a !== b && loose(a) === loose(b)) report.variants++;
    else if (a !== b) report.fuzzy.push(`${key} «${gi.map((x) => toks[x]).join(' ')}» ≠ «${gj.map((w) => w.text).join(' ')}»`);
    if (gi.length > 1 || gj.length > 1) regrouped = true;

    const line = gj[0].line;
    if (gj.some((w) => w.line !== line)) report.splitAcrossLines.push(key);
    for (const x of gi) lines[x] = line;
    i = ii;
    j = jj;
  }
  if (i < content.length || j < words.length) report.fuzzy.push(`${key} بقايا غير محاذاة (المجمع ${content.length - i}، الأخرى ${words.length - j})`);

  if (regrouped) report.regrouped.push(key);
  else report.exact++;

  // ۞ والرموز التي بلا حروف: تأخذ سطر الكلمة التالية، أو السابقة إن كانت الأخيرة
  for (let k = 0; k < toks.length; k++) {
    if (lines[k] != null) continue;
    let n = k + 1;
    while (n < toks.length && lines[n] == null) n++;
    lines[k] = n < toks.length ? lines[n] : lines[k - 1];
  }

  // علامة الآية في المصحف المطبوع تلي آخر كلمة في آيتها على سطرها، ولا تبدأ سطرًا أبدًا.
  // فإن جاءت في الخريطة على سطر بعده، رُدّت إلى سطر آخر كلمة.
  if (lines[endIdx] > lines[endIdx - 1]) {
    lines[endIdx] = lines[endIdx - 1];
    report.markPulledBack++;
  }

  // التحقق المستقل بسطرَي البداية والنهاية كما في ملف المجمع
  const first = lines.find((l) => l != null);
  const last = lines[endIdx];
  if (first === +r.line_start && last === +r.line_end) report.lineCheck.ok++;
  else report.lineCheck.bad.push(`${key} مشتق ${first}→${last} / المجمع ${r.line_start}→${r.line_end}`);

  const apiPage = ws[0].page;
  if (apiPage === +r.page) report.pageCheck.ok++;
  else report.pageCheck.bad.push(`${key} المجمع ${r.page} / الأخرى ${apiPage}`);

  verses.push({ s: +r.sura_no, a: +r.aya_no, p: +r.page, j: +r.jozz, t: toks, lines, e: r.aya_text_emlaey.trim() });
}

// ---------- الصفحات ----------
const linesPerPage = (p) => (p <= 2 ? 8 : 15);
const pages = Array.from({ length: 605 }, (_, p) =>
  p === 0 ? null : Array.from({ length: linesPerPage(p) + 1 }, () => [])
);

verses.forEach((v, vi) => {
  v.lines.forEach((line, ti) => {
    if (line < 1 || line > linesPerPage(v.p)) throw new Error(`سطر خارج الحدّ: ${v.s}:${v.a} سطر ${line}`);
    pages[v.p][line].push([vi, ti]);
  });
});

// الأسطر الخالية بترتيب القراءة عبر المصحف كله: هي عناوين السور والبسملة
const slots = [];
for (let p = 1; p <= 604; p++) for (let l = 1; l <= linesPerPage(p); l++) slots.push({ p, l, empty: pages[p][l].length === 0 });

const role = new Map(); // "p:l" → { k:'h'|'b', s }
const firstSlotOfVerse = new Map();
verses.forEach((v, vi) => {
  if (v.a === 1) firstSlotOfVerse.set(vi, slots.findIndex((sl) => sl.p === v.p && sl.l === v.lines.find((l) => l != null)));
});
const headerReport = { headers: 0, basmalas: 0, anomalies: [] };
for (const [vi, idx] of firstSlotOfVerse) {
  const s = verses[vi].s;
  const need = s === 1 || s === 9 ? 1 : 2; // الفاتحة بسملتها آيتها الأولى، والتوبة بلا بسملة
  const run = [];
  for (let k = idx - 1; k >= 0 && slots[k].empty && !role.has(`${slots[k].p}:${slots[k].l}`); k--) run.unshift(slots[k]);
  if (run.length < need) {
    headerReport.anomalies.push(`سورة ${s}: وُجد ${run.length} سطر خالٍ قبلها والمطلوب ${need}`);
    continue;
  }
  const use = run.slice(run.length - need);
  role.set(`${use[0].p}:${use[0].l}`, { k: 'h', s });
  headerReport.headers++;
  if (need === 2) {
    role.set(`${use[1].p}:${use[1].l}`, { k: 'b', s });
    headerReport.basmalas++;
  }
}
const unassigned = slots.filter((sl) => sl.empty && !role.has(`${sl.p}:${sl.l}`));
if (unassigned.length) headerReport.anomalies.push(`أسطر خالية بلا دور: ${unassigned.map((u) => `${u.p}:${u.l}`).join(' ')}`);

// صورة الصفحة النهائية: كل سطر إما عنوان سورة، أو بسملة، أو مقاطع من آيات
const pageOut = [];
const pageCheck = { complete: 0, bad: [] };
for (let p = 1; p <= 604; p++) {
  const out = [];
  for (let l = 1; l <= linesPerPage(p); l++) {
    const cell = pages[p][l];
    if (cell.length === 0) {
      const r = role.get(`${p}:${l}`);
      out.push(r ? (r.k === 'h' ? { h: r.s } : { b: r.s }) : { x: 1 });
      continue;
    }
    // مقاطع متصلة: [رقم الآية في المصحف، أول كلمة، آخر كلمة]
    const segs = [];
    for (const [vi, ti] of cell) {
      const last = segs[segs.length - 1];
      if (last && last[0] === vi && last[2] === ti - 1) last[2] = ti;
      else segs.push([vi, ti, ti]);
    }
    out.push({ g: segs });
  }
  if (out.length === linesPerPage(p) && out.every((ln) => !ln.x)) pageCheck.complete++;
  else pageCheck.bad.push(p);
  pageOut.push(out);
}

// ترتيب الكلمات: لا يجوز أن يرجع سطر كلمة عمّا قبلها
let orderViolations = 0;
let prev = { p: 0, l: 0 };
for (const v of verses) {
  for (const l of v.lines) {
    if (v.p < prev.p || (v.p === prev.p && l < prev.l)) orderViolations++;
    prev = { p: v.p, l };
  }
}

// ---------- الإخراج ----------
// تصحيح همزات أسماء سور في بيانات المصدر (٢٠٢٦-١١-١٢): همزة قطع في «إبراهيم» و«الإنسان»،
// وهمزة وصل في «الانفطار» و«الانشقاق»
const NAME_FIXES = { ابراهيم: 'إبراهيم', الانسان: 'الإنسان', الإنفطار: 'الانفطار', الإنشقاق: 'الانشقاق' };
const suras = chapters.map((c) => ({
  n: c.id,
  name: NAME_FIXES[c.name_arabic] ?? c.name_arabic,
  place: c.revelation_place === 'makkah' ? 'مكية' : 'مدنية',
  count: c.verses_count,
  page: c.pages[0],
}));

const data = {
  v: 1,
  source: 'مجمع الملك فهد لطباعة المصحف الشريف — hafsData_v2-0',
  suras,
  verses: verses.map(({ s, a, p, j, t, e }) => ({ s, a, p, j, t, e })),
  pages: pageOut,
};

await mkdir('public/data', { recursive: true });
const json = JSON.stringify(data);
await writeFile(OUT, json);

const summary = {
  ...report,
  regroupedCount: report.regrouped.length,
  fuzzyCount: report.fuzzy.length,
  headerReport,
  pageCheck,
  orderViolations,
  outputBytes: Buffer.byteLength(json),
};
await writeFile(REPORT, JSON.stringify(summary, null, 2));

// ---------- التقرير ----------
const kb = (n) => `${(n / 1024).toFixed(0)} ك.ب`;
console.log('═══ تقرير بناء المصحف ═══');
console.log(`الآيات: ${report.verses}`);
console.log(`  محاذاة كلمةً بكلمة: ${report.exact}`);
console.log(`  اختلف فيها حدّ الكلمة فعولجت بالهيكل: ${report.regrouped.length}  ${report.regrouped.join(' ')}`);
console.log(`  اختلاف رسم حميد (همزة أو حرف مدّ) والموضع صحيح: ${report.variants}`);
console.log(`  تطابق الطول دون الهيكل (للمراجعة): ${report.fuzzy.length}`);
report.fuzzy.slice(0, 15).forEach((f) => console.log(`     ! ${f}`));
console.log(`  كلمة قابلتها كلمتان على سطرين: ${report.splitAcrossLines.length}  ${report.splitAcrossLines.join(' ')}`);
console.log(`  علامات آيات رُدّت إلى سطر آخر كلمة في آيتها: ${report.markPulledBack}`);
console.log(`  رموز بلا حروف وسط الآيات: ${report.markOnly}`);
console.log(`  أنواع أخرى في الخريطة: ${JSON.stringify(report.otherApiTypes)}`);
console.log(`التحقق المستقل بسطرَي البداية والنهاية في ملف المجمع: ${report.lineCheck.ok} مطابق، ${report.lineCheck.bad.length} مخالف`);
report.lineCheck.bad.slice(0, 10).forEach((b) => console.log(`     ✗ ${b}`));
console.log(`تطابق رقم الصفحة بين المصدرين: ${report.pageCheck.ok} مطابق، ${report.pageCheck.bad.length} مخالف`);
console.log(`عناوين السور: ${headerReport.headers}/114 · البسملات المستقلة: ${headerReport.basmalas}/112`);
headerReport.anomalies.forEach((a) => console.log(`     ! ${a}`));
console.log(`الصفحات المكتملة الأسطر: ${pageCheck.complete}/604  ${pageCheck.bad.length ? 'ناقصة: ' + pageCheck.bad.join(',') : ''}`);
console.log(`مخالفات ترتيب الأسطر: ${orderViolations}`);
console.log(`حجم الملف الناتج: ${kb(Buffer.byteLength(json))} → ${OUT}`);
