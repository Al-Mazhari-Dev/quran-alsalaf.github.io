import { memo, useEffect, useRef } from 'react';
import { pageFontClass } from '../lib/qcfFonts.js';
import { weekMap } from '../lib/weeks.js';
import { BOOKMARK_COLORS } from '../lib/userdata.js';
import { rubStarts } from '../lib/rubs.js';
import './MushafPage.css';

// الفاتحة وأول البقرة (بلا زخرفة، بقرار صاحب المشروع): الأسطر السبعة (البسملة منها في
// أول البقرة) متتابعة في وسط الصفحة، واسم السورة في السطر الذي قبلها مباشرة كبقية السور
const OPENING_TEXT_ROW = 6;
const OPENING_HEADER_ROW = OPENING_TEXT_ROW - 1;

/*
  صفحة مصحف واحدة، بأسطرها كما في المطبوع تمامًا: كل سطر يحمل كلماته هو لا غير،
  ولا تنتقل كلمة من سطر إلى آخر مهما تغيّر عرض الشاشة (الفصل ٢). وحجم الخط واحد
  لكل الصفحات، ويُحسب خارج هذا المكوّن (src/lib/layout.js).

  الكلمات رموز من خط الصفحة نفسها (src/lib/qcfFonts.js)، مرسومة بيد الخطّاط بمدّاتها.
  وكل كلمة عنصر مستقل يحمل رقم آيته (data-v)، لتُبنى عليه لاحقًا: تظليل الآية
  الجارية تلاوتها، وإخفات ما خارج النطاق المحدد، والضغط المطوّل على الآية.
*/
// marks: ما يُرسم فوق الآيات من بيانات المستخدم —
//   notes { آية: نص }، bookmarks [{ v, color }]، range [أول، آخر] (يُخفت ما خارجه)،
//   selected الآية المضغوط عليها ضغطًا مطوّلًا، playing الآية الجاري تلاوتها،
//   flash الآية المنتقَل إليها من البحث (تمييز مؤقت يتلاشى)،
//   rubFlash { verses: [أول آية في كل ربع], n } الأرباع التي يومض موضع بدايتها (src/lib/rubs.js)
function MushafPage({ quran, page, fontSize, width, height, shortLines, marks }) {
  const lines = quran.pages[page - 1];
  const glyphs = quran.qcf.pages[page - 1];
  const opening = page <= 2;
  let row = OPENING_TEXT_ROW;
  const bookmarkOf = new Map((marks?.bookmarks ?? []).map((b) => [b.v, b.color]));

  // الجوال الأفقي: الصفحة تُمرَّر رأسيًّا داخل ورقتها، فتُحضر الآية المميَّزة إلى منظر العين
  const ref = useRef(null);
  const flash = marks?.flash;
  useEffect(() => {
    if (flash == null) return;
    const word = ref.current?.querySelector('.w--flash');
    const sheet = word?.closest('.sheet--scroll');
    if (!sheet) return;
    const top = word.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
    if (top < 0 || top > sheet.clientHeight * 0.7) sheet.scrollTop += top - sheet.clientHeight / 3;
  }, [flash]);

  return (
    <div
      ref={ref}
      className={`mushaf-page no-select${opening ? ' mushaf-page--opening' : ''}`}
      style={{ '--fs': `${fontSize}px`, width: `${width}px`, ...(height ? { height: `${height}px` } : {}) }}
      lang="ar"
    >
      {lines.map((line, i) => (
        <Line
          key={i}
          quran={quran}
          page={page}
          line={line}
          glyphs={glyphs[i]}
          width={width}
          opening={opening}
          centered={shortLines.has(i)}
          gridRow={opening ? (line.h ? OPENING_HEADER_ROW : row++) : undefined}
          marks={marks}
          bookmarkOf={bookmarkOf}
        />
      ))}
    </div>
  );
}

function Line({ quran, page, line, glyphs, width, opening, centered, gridRow, marks, bookmarkOf }) {
  const range = marks?.range;
  const outside = (v) => range && (v < range[0] || v > range[1]);
  // عنوان السورة وبسملتها يُخفتان إن كانت السورة كلها خارج النطاق المحدد
  const suraOutside = (s) => {
    if (!range) return false;
    const first = quran.verses.findIndex((x) => x.s === s);
    const last = first + quran.suras[s - 1].count - 1;
    return last < range[0] || first > range[1];
  };
  const place = { ...(gridRow ? { gridRow } : {}), ...((line.h || line.b) && suraOutside(line.h ?? line.b) ? { opacity: 0.3 } : {}) };
  // تمييز مقررات الأسابيع على كلمات الآيات وحدها — لا عنوان السورة ولا البسملة (بقرار صاحب المشروع)
  const weeks = weekMap(quran);

  // اسم السورة في إطاره المعروف: رمز واحد من خط عناوين السور للمجمع، بعرض العمود
  if (line.h) {
    const size = (width * (opening ? 0.78 : 0.98)) / quran.qcf.headerEm;
    // ربع يبدأ بأول السورة: لا ۞ قبله في المطبوع، فيومض إطار اسمها بدلها
    const rubFlash = marks?.rubFlash?.verses.some((v) => quran.verses[v].s === line.h && quran.verses[v].a === 1);
    return (
      <div
        key={rubFlash ? `f${marks.rubFlash.n}` : 'h'}
        className={`line line--sura${rubFlash ? ' line--rubflash' : ''}`}
        style={{ ...place, fontSize: `${size}px` }}
        role="heading"
        aria-level={2}
        aria-label={`سورة ${quran.suras[line.h - 1].name}`}
      >
        {String.fromCodePoint(quran.qcf.header[line.h])}
      </div>
    );
  }

  // البسملة بخط المجمع: سين «بسم» ونون «الرحمن» ممدودتان
  if (line.b) {
    return (
      <div className="line line--basmala" style={place} aria-label="بسم الله الرحمن الرحيم">
        {String.fromCodePoint(...quran.qcf.basmala)}
      </div>
    );
  }

  // رموز الخط لا تُقرأ بقارئ الشاشة، فيُعطى السطر نصّه بالرسم العثماني
  const text = line.g.flatMap(([v, from, to]) => quran.verses[v].t.slice(from, to + 1)).join(' ');
  // الآيات التي تنتهي في هذا السطر: آخر رمز لها فيه علامتها، وعندها تُرسم إشارتا الملاحظة والعلامة
  const endsHere = new Set(line.g.filter(([v, , to]) => to === quran.verses[v].t.length - 1).map(([v]) => v));
  const lastIndexOf = new Map();
  const firstIndexOf = new Map();
  glyphs.k.forEach(([v], i) => {
    lastIndexOf.set(v, i);
    if (!firstIndexOf.has(v)) firstIndexOf.set(v, i);
  });
  const rubs = rubStarts(quran);
  // الآيات التي تبدأ في هذا السطر (أول كلمة فيها عليه): عند أولها تُرسم علامة الربع
  const startsHere = new Set(line.g.filter(([, from]) => from === 0).map(([v]) => v));
  return (
    <div
      className={`line ${pageFontClass(page)}${centered ? ' line--centered' : ''}`}
      style={place}
      aria-label={text}
    >
      {glyphs.k.map(([v, code], i) => {
        const isEnd = endsHere.has(v) && lastIndexOf.get(v) === i;
        const note = isEnd && marks?.notes?.[v];
        const bookmark = isEnd ? bookmarkOf.get(v) : undefined;
        let cls = 'w';
        const week = weeks.shade(v);
        if (week) cls += ` w--week w--week-${week}`;
        if (outside(v)) cls += ' w--out';
        if (marks?.selected === v) cls += ' w--selected';
        else if (marks?.flash === v) cls += ' w--flash';
        else if (marks?.playing === v) cls += ' w--playing';
        // الآية ذات العلامة أو الملاحظة (بطلب صاحب المشروع): علامة الآية ورقمها كما هما؛
        // الملاحظة دفتر ملاحظات صغير أعلى الدائرة يمينًا، والعلامة رمز شريطتها بلونها أعلاها يسارًا
        const marked = bookmark !== undefined || note;
        // أول كلمة في الربع: علامة ۞ رمز مستقل أول رموزها في خط الصفحة (٢٠٢٦-١١-١٣)، فتُفصل عنها
        // لتومض وحدها بلون التطبيق عند الوصول إلى الصفحة
        const rub = rubs.has(v) && startsHere.has(v) && firstIndexOf.get(v) === i && quran.verses[v].t[0] === '۞';
        if (rub) {
          const flashing = marks?.rubFlash?.verses.includes(v);
          const mark = code.slice(0, 1);
          return (
            <span key={i} className={cls} data-v={v} aria-hidden="true">
              <span>
                <span key={flashing ? `f${marks.rubFlash.n}` : 'r'} className={`w__rub${flashing ? ' w__rub--flash' : ''}`}>
                  {mark}
                  {flashing && <span className="w__rubFlash">{mark}</span>}
                </span>
                {code.slice(1)}
              </span>
            </span>
          );
        }
        return (
          <span key={i} className={cls} data-v={v} aria-hidden="true">
            {marked ? (
              <span className="w__end">
                {code}
                {bookmark !== undefined && (
                  <svg viewBox="0 0 12 16" className="w__ribbon" style={{ color: BOOKMARK_COLORS[bookmark] }}>
                    <path d="M1.5 1h9v14L6 11.4 1.5 15Z" fill="currentColor" />
                  </svg>
                )}
                {note && (
                  <svg viewBox="0 0 12 14" className="w__notebook">
                    <rect x="1" y="0.5" width="10" height="13" rx="1.6" fill="currentColor" />
                    <path d="M3.4 0.5v13" stroke="var(--bg)" strokeWidth="0.9" />
                    <path d="M5.2 4.4h4M5.2 7h4M5.2 9.6h4" stroke="var(--bg)" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            ) : (
              code
            )}
          </span>
        );
      })}
    </div>
  );
}

export default memo(MushafPage);
