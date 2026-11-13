// الخطوة ٨: أرباع الأحزاب (٢٠٢٦-١١-١٣) — ٦٠ حزبًا في كل حزب أربعة أرباع، فهي ٢٤٠ ربعًا.
//
// المصدر: قائمة أرباع مصحف المدينة في Quran.com (أول آية في كل ربع). ويُتحقَّق منها بنص المصحف
// نفسه: علامة الربع «۞» في نص المجمع قبل أول كلمة في الربع، فكل آية فيها العلامة يجب أن تكون
// أول ربع في القائمة، وكل أول ربع في القائمة بلا علامة يجب أن يكون أول سورة (لا تُرسم العلامة
// في المطبوع حيث يبدأ الربع بإطار اسم السورة). فإن خالف شيء من ذلك توقف البناء.
//
// المخرج: rubs في public/data/quran.json — رقم أول آية (في المصحف، من ٠) لكل ربع بالترتيب.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const QURAN = 'public/data/quran.json';
const CACHE = '.cache/qurancom/rub_el_hizbs.json';
const URL = 'https://api.quran.com/api/v4/rub_el_hizbs';
const RUB = '۞';

const exists = (p) => access(p).then(() => true, () => false);
if (!(await exists(CACHE))) {
  await mkdir('.cache/qurancom', { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${URL}: HTTP ${res.status}`);
  await writeFile(CACHE, JSON.stringify(await res.json()));
}

const quran = JSON.parse(await readFile(QURAN, 'utf8'));
const list = JSON.parse(await readFile(CACHE, 'utf8')).rub_el_hizbs.sort((a, b) => a.rub_el_hizb_number - b.rub_el_hizb_number);
const rubs = list.map((r) => r.first_verse_id - 1);

const problems = [];
const key = (v) => `${quran.verses[v].s}:${quran.verses[v].a}`;
if (rubs.length !== 240) problems.push(`عدد الأرباع ${rubs.length} لا ٢٤٠`);
rubs.forEach((v, i) => {
  if (i && v <= rubs[i - 1]) problems.push(`الربع ${i + 1} ليس بعد سابقه`);
});
const set = new Set(rubs);
const marked = quran.verses.map((x, v) => (x.t.includes(RUB) ? v : null)).filter((v) => v != null);
for (const v of marked) if (!set.has(v)) problems.push(`علامة ۞ في ${key(v)} وليست أول ربع`);
for (const v of rubs) if (!quran.verses[v].t.includes(RUB) && quran.verses[v].a !== 1) problems.push(`أول ربع ${key(v)} بلا علامة ۞ وليس أول سورة`);
// كل جزء يبدأ بحزب، إلا جزأين يختلف فيهما موضع بداية الجزء في نص المجمع عن علامة ۞ بآية واحدة:
// الجزء ٤ من «لن تنالوا البر» (آل عمران ٩٢) و۞ عند «كل الطعام» (٩٣)، والجزء ١١ من «يعتذرون إليكم»
// (التوبة ٩٤) و۞ عند «إنما السبيل» (٩٣). فالمعتمد للأرباع العلامة، وللأجزاء ما في نص المجمع
const JUZ_SHIFT = { 4: '3:93', 11: '9:93' };
for (let j = 1; j <= 30; j++) {
  const first = quran.verses.findIndex((x) => x.j === j);
  const rub = rubs[(j - 1) * 8];
  if (rub !== first && key(rub) !== JUZ_SHIFT[j]) problems.push(`الجزء ${j} لا يبدأ بأول حزب`);
}

console.log('═══ تقرير الأرباع ═══');
console.log(`الأرباع: ${rubs.length} · بعلامة ۞: ${marked.length} · في أول سورة: ${rubs.length - marked.length}`);
problems.forEach((p) => console.log(`     ✗ ${p}`));
if (problems.length) {
  process.exitCode = 1;
} else {
  quran.rubs = rubs;
  await writeFile(QURAN, JSON.stringify(quran));
  console.log(`أُضيفت rubs إلى ${QURAN}`);
}
