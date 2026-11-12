// الخطوة ٧: تنظيف علامات الترقيم في نصوص التفسيرين و«العمل بالآيات» (٢٠٢٦-١١-١٢)
//
// يعمل على ملفات public/data الناتجة من الخطوات ٣ و٤ و٦، فيبقى أثره ولو أُعيد توليدها.
// والتنظيف في الشكل وحده لا في المضمون، ولا يمسّ نص الآيات المقتبسة. وتشغيله مرة ثانية
// لا يغيّر شيئًا. والقواعد مصدَّرة لتختبرها tests/unit/data.test.js.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const AR = '؀-ۿ';

// التفسير الميسّر (اقتباسات الآيات فيه بين ﵡ…ﵠ)
export function tidyMuyassar(s) {
  return (
    s
      // بقايا رقم الآية أو نقطة في أول النص: «99] …»، «. واضمم …»، «.والذين …»
      .replace(/^\s*[\d٠-٩]+\]\s*/, '')
      .replace(/^[.\s]+/, '')
      // تنوين زائد بين نقطتين: «الحق.ً.»
      .replace(/\.ً\./g, '.')
      // فاصلة ثم نقطة، وفاصلتان، ونقطتان (لا ثلاث)
      .replace(/،\./g, '.')
      .replace(/،،/g, '،')
      .replace(/(?<!\.)\.\.(?!\.)/g, '.')
      // فاصلة لاتينية زائدة: «له ,وحده»
      .replace(/ ,/g, ' ')
      // مسافة بعد النقطة بين جملتين، وبعد النقطتين قبل اقتباس آية
      .replace(new RegExp(`([${AR}])\\.([${AR}])`, 'g'), '$1. $2')
      .replace(/:ﵡ/g, ': ﵡ')
  );
}

// المختصر في التفسير، وفوائده ومقاصد سوره
export function tidyMukhtasar(s) {
  return (
    s
      // لا مسافة قبل علامة الترقيم: «وسلم .» «موسى ، حيث» (ويبقى «...» كما هو)
      .replace(/ ([،؛:]|\.(?!\.))/g, '$1')
      // ومسافة بعد الفاصلة: «والجزاء،ولا»
      .replace(new RegExp(`،([${AR}])`, 'g'), '، $1')
  );
}

// «العمل بالآيات»: أقواس لا تُغلق أو لا تُفتح، كلٌّ بنصّه. والنمط لا يطابق النص بعد تصحيحه،
// فلا يتكرر التصحيح إن أُعيد التشغيل
export const ACTION_FIXES = [
  [/حياتك \(﴿/, 'حياتك ﴿'],
  [/^كُن في الدنيا كأنك غريب أو عابر سبيل\)/, '(كُن في الدنيا كأنك غريب أو عابر سبيل)'],
  [/ \(ذو العرش المجيد ﴿/, ' ﴿'],
  [/لذلك \(﴿/, 'لذلك ﴿'],
];
export function tidyAction(s) {
  for (const [re, to] of ACTION_FIXES) s = s.replace(re, to);
  return (
    s
      // «﴾ ،﴿» ← «﴾، ﴿»، و«﴾ .» ← «﴾.»
      .replace(/﴾ ،\s*﴿/g, '﴾، ﴿')
      .replace(/﴾ \.(?!\.)/g, '﴾.')
  );
}

// ---------- التشغيل ----------
async function run() {
  const counts = {};
  const apply = (name, fn, s) => {
    const t = fn(s);
    if (t !== s) counts[name] = (counts[name] || 0) + 1;
    return t;
  };

  const MY = 'public/data/tafsir-muyassar.json';
  const my = JSON.parse(await readFile(MY, 'utf8'));
  my.verses = my.verses.map((s) => apply('الميسّر', tidyMuyassar, s));
  await writeFile(MY, JSON.stringify(my));

  const MK = 'public/data/tafsir-mukhtasar.json';
  const mk = JSON.parse(await readFile(MK, 'utf8'));
  mk.verses = mk.verses.map((s) => (s ? apply('المختصر', tidyMukhtasar, s) : s));
  for (const key of ['fawaid', 'maqasid']) {
    for (const k of Object.keys(mk[key])) {
      const x = mk[key][k];
      mk[key][k] = Array.isArray(x) ? x.map((s) => apply('المختصر', tidyMukhtasar, s)) : apply('المختصر', tidyMukhtasar, x);
    }
  }
  await writeFile(MK, JSON.stringify(mk));

  const ME = 'public/data/memos.json';
  const me = JSON.parse(await readFile(ME, 'utf8'));
  // كل تصحيح بنصّه يقع في نص واحد (إلا أن يكون قد صُحّح من قبل)
  for (const [re] of ACTION_FIXES) {
    const n = me.actions.filter((a) => re.test(a.t)).length;
    if (n > 1) throw new Error(`النمط ${re} يقع في ${n} من نصوص العمل، والمتوقع واحد`);
  }
  me.actions = me.actions.map((a) => ({ ...a, t: apply('العمل بالآيات', tidyAction, a.t) }));
  await writeFile(ME, JSON.stringify(me));

  console.log('═══ تنظيف علامات الترقيم ═══');
  console.log(Object.keys(counts).length ? Object.entries(counts).map(([k, n]) => `${k}: ${n} نصًّا`).join(' · ') : 'لا شيء يحتاج تنظيفًا');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
