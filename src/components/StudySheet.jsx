import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  TAFSIR_SOURCES,
  actionsInRange,
  loadTafsir,
  memoIndex,
  readTafsirSource,
  saveTafsirSource,
  sectionLabel,
  sectionsInRange,
  copyVerses,
  muyassarPlain,
  verseLabel,
  verseText,
} from '../lib/study.js';
import { copyText } from '../lib/userdata.js';
import { useLayer } from '../lib/layers.js';
import './StudySheet.css';

/*
  الصفحات السفلية (الفصل ٥): صفحة كاملة تحت صفحة المصحف، تصعد بسحب المصحف إلى أعلى
  وتنزل بسحبها إلى أسفل — انزلاقًا رأسيًّا يتبع الإصبع كتمرير «يوتيوب شورتس»
  (يتحكم في الانزلاق App، وهذه تُبلغه بسحبة الإغلاق عبر onDrag/onDragEnd).
  ثلاثة تبويبات ثابتة من اليمين: تفسير · معاني الكلمات · العمل بالآيات، يُنتقل بينها باللمس
  أو بالسحب يمينًا ويسارًا (كتقليب المصحف: السحب نحو اليمين إلى التبويب الذي على اليسار)،
  (و«فوائد الآيات» تبويبٌ يُضاف لاحقًا إن طُلب — لا يظهر الآن). والنطاق المحدد إن وُجد، وإلا
  آيات الصفحة الحالية؛ و«من فوائد الآيات» لصفحات النطاق. وفي كل تبويب زرّا نسخ: المحتوى
  وحده متتاليًا، والآيات وحدها.
*/
const TABS = [
  { id: 'tafsir', name: 'تفسير' },
  { id: 'meanings', name: 'معاني الكلمات' },
  { id: 'actions', name: 'العمل بالآيات' },
];
const ACTIVE_TABS = TABS.map((t) => t.id);
const TAB_SWIPE_PX = 60;

// خارج نطاق المذكرات، ورسالتا الغياب بنصّهما (بتعديل صاحب المشروع)
export const UNAVAILABLE =
  'هذا المحتوى غير متوفر لهذه الآيات حاليًّا، وقد يُضاف في أي وقت. وهو متوفر الآن من سورة الفاتحة إلى سورة الأنعام، ومن سورة الملك إلى سورة الناس.';
export const NO_MEANINGS = 'لا توجد معاني كلمات ذُكرت في هذه الآية';
export const NO_ACTIONS = 'لا يوجد عمل بالآيات ذُكر في هذه الآية';

// panel: لوحة متمركزة فوق المصحف (الشاشة الكبيرة) بدل صفحة كاملة. onClose: الإغلاق بزرّ ✕ وبمفتاح Esc
const StudySheet = forwardRef(function StudySheet({ open, panel, onClose, onDrag, onDragEnd, onToast, quran, verses, pages }, ref) {
  const [tab, setTab] = useState('tafsir');
  const [slide, setSlide] = useState(0); // اتجاه آخر انتقال بين التبويبات، لحركة المحتوى
  const bodyRef = useRef(null);
  const handlers = useRef({});
  handlers.current = { onDrag, onDragEnd, tab };
  useLayer(onClose, open);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, verses, open]);

  const goTab = (id) => {
    const from = ACTIVE_TABS.indexOf(handlers.current.tab);
    const to = ACTIVE_TABS.indexOf(id);
    if (to < 0 || to === from) return;
    setSlide(to > from ? 1 : -1);
    setTab(id);
  };
  const goTabRef = useRef(goTab);
  goTabRef.current = goTab;

  // السحب داخل الصفحة: رأسيًّا إلى أسفل (والمحتوى في أوله) يُنزلها إلى المصحف،
  // وأفقيًّا ينتقل بين التبويبات. وما سوى ذلك تمرير عادي للمحتوى.
  useEffect(() => {
    const root = ref.current;
    const body = bodyRef.current;
    if (!root) return undefined;
    let s = null;
    const onStart = (e) => {
      if (e.target.closest('input')) return;
      const t = e.touches[0];
      s = { x: t.clientX, y: t.clientY, t0: e.timeStamp, axis: null, atTop: !body.contains(e.target) || body.scrollTop <= 0, dx: 0, dy: 0 };
    };
    const onMove = (e) => {
      if (!s) return;
      const t = e.touches[0];
      s.dx = t.clientX - s.x;
      s.dy = t.clientY - s.y;
      if (!s.axis) {
        if (Math.max(Math.abs(s.dx), Math.abs(s.dy)) < 10) return;
        if (Math.abs(s.dx) > Math.abs(s.dy)) s.axis = 'x';
        else s.axis = s.dy > 0 && s.atTop ? 'y' : 'scroll';
      }
      if (s.axis === 'y') {
        e.preventDefault();
        handlers.current.onDrag?.(Math.max(0, s.dy));
      } else if (s.axis === 'x') e.preventDefault();
    };
    const onEnd = (e) => {
      if (!s) return;
      const { axis, dx, dy, t0 } = s;
      s = null;
      if (axis === 'y') handlers.current.onDragEnd?.(Math.max(0, dy), e.timeStamp - t0);
      else if (axis === 'x' && Math.abs(dx) > TAB_SWIPE_PX) {
        const i = ACTIVE_TABS.indexOf(handlers.current.tab) + (dx > 0 ? 1 : -1);
        if (i >= 0 && i < ACTIVE_TABS.length) goTabRef.current(ACTIVE_TABS[i]);
      }
    };
    // السحب بالفأرة كما يُسحب بالإصبع: إلى أسفل من شريط التبويبات (لا من المحتوى، ففيه
    // تحديد النص)، فتنزل الصفحة مع المؤشر وتُغلق إن جاوز السحب حدّه. والنقر بلا سحب يبقى نقرًا
    let m = null;
    const onPDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || body.contains(e.target)) return;
      m = { id: e.pointerId, y: e.clientY, t0: e.timeStamp, dragging: false };
    };
    const onPMove = (e) => {
      if (!m || m.id !== e.pointerId) return;
      const dy = e.clientY - m.y;
      if (!m.dragging) {
        if (dy < 8) return;
        m.dragging = true;
        try {
          root.setPointerCapture(e.pointerId);
        } catch {
          // لا يلزم للسحب
        }
      }
      handlers.current.onDrag?.(Math.max(0, dy));
    };
    const onPUp = (e) => {
      if (!m || m.id !== e.pointerId) return;
      const { dragging, y, t0 } = m;
      m = null;
      if (!dragging) return;
      handlers.current.onDragEnd?.(e.type === 'pointerup' ? Math.max(0, e.clientY - y) : 0, e.timeStamp - t0);
      // النقرة التي تلي السحب لا تُعدّ ضغطًا على تبويب
      const stop = (ev) => ev.stopPropagation();
      root.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => root.removeEventListener('click', stop, { capture: true }), 0);
    };
    root.addEventListener('pointerdown', onPDown);
    root.addEventListener('pointermove', onPMove);
    root.addEventListener('pointerup', onPUp);
    root.addEventListener('pointercancel', onPUp);
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', onEnd);
    return () => {
      root.removeEventListener('pointerdown', onPDown);
      root.removeEventListener('pointermove', onPMove);
      root.removeEventListener('pointerup', onPUp);
      root.removeEventListener('pointercancel', onPUp);
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);

  return (
    <section
      ref={ref}
      className={`study${panel ? ' study--panel' : ''}`}
      aria-hidden={!open}
      inert={open ? undefined : ''}
      role="dialog"
      aria-label="التفسير والمعاني والعمل"
    >
      <nav className="study__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="study__tab"
            onClick={() => goTab(t.id)}
          >
            {t.name}
          </button>
        ))}
        {/* زرّ الإغلاق: على الأجهزة التي تعمل بالفأرة وفي اللوحة (StudySheet.css)، وعلى الجوال
            باللمس يبقى الإغلاق بالسحب كما كان */}
        <button type="button" className="study__close" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      <div className="study__body" ref={bodyRef}>
        <div key={tab} className={`study__content${slide ? (slide > 0 ? ' study__content--next' : ' study__content--prev') : ''}`}>
          {tab === 'tafsir' && <TafsirTab quran={quran} verses={verses} pages={pages} onToast={onToast} />}
          {tab === 'meanings' && <MeaningsTab quran={quran} verses={verses} onToast={onToast} />}
          {tab === 'actions' && <ActionsTab quran={quran} verses={verses} onToast={onToast} />}
        </div>
      </div>
    </section>
  );
});

export default StudySheet;

// ---------- تفسير ----------
function TafsirTab({ quran, verses, pages, onToast }) {
  const [source, setSource] = useState(readTafsirSource);
  const [data, setData] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (data[source]) return undefined;
    let alive = true;
    setFailed(false);
    loadTafsir(source).then(
      (t) => alive && setData((d) => ({ ...d, [source]: t })),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [source, data]);

  const choose = (id) => {
    saveTafsirSource(id);
    setSource(id);
  };

  const t = data[source];
  const mukhtasar = source === 'mukhtasar';
  const shown = t ? verses : [];
  const fawaid = mukhtasar && t ? pages.flatMap((p) => t.fawaid[p] ?? []) : [];
  // تفسير آيات النطاق متتاليًا (والمختصر يجمع أحيانًا آيتين بتفسير واحد، فلا يُكرَّر)
  const tafsirText = () => {
    const out = [];
    for (const v of verses) {
      const text = mukhtasar ? t.verses[v] : muyassarPlain(t.verses[v], t.quote);
      if (out.at(-1) !== text) out.push(text);
    }
    return out.join('\n\n');
  };

  return (
    <>
      {/* صفّ واحد: نسخ التفسير يمينًا، ومبدّل المصدر في الوسط، ونسخ الآيات يسارًا */}
      <CopyBar quran={quran} verses={verses} label="نسخ التفسير" getText={t ? tafsirText : null} onToast={onToast}>
        <div className="study__source" role="radiogroup" aria-label="مصدر التفسير">
          {TAFSIR_SOURCES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={source === s.id} onClick={() => choose(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </CopyBar>

      {!t && !failed && <p className="study__note">جارٍ تحميل التفسير…</p>}
      {failed && <p className="study__note">تعذّر تحميل التفسير. يُحمَّل مرة واحدة، ويحتاج لذلك اتصالًا بالإنترنت.</p>}

      {t &&
        shown.map((v) => {
          const verse = quran.verses[v];
          return (
            <div key={v} className="study__item">
              {verse.a === 1 && <SuraTitle quran={quran} sura={verse.s} />}
              {mukhtasar && verse.a === 1 && t.maqasid[verse.s] && (
                <div className="study__box study__box--note">
                  <h3>من مقاصد السورة</h3>
                  <p>{t.maqasid[verse.s]}</p>
                </div>
              )}
              <VerseCard quran={quran} v={v} />
              <div className="study__box study__box--explain">
                <p>{mukhtasar ? t.verses[v] : muyassarPlain(t.verses[v], t.quote)}</p>
              </div>
            </div>
          );
        })}

      {fawaid.length > 0 && (
        <div className="study__box study__box--note">
          <h3>من فوائد الآيات</h3>
          <ul>
            {fawaid.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* رابط يوتيوب قسم التفسير في المذكرات — مع المختصر وحده (الميسّر بلا روابط) */}
      {t && mukhtasar && <Links quran={quran} kind="t" verses={verses} />}
      <p className="study__credit">{TAFSIR_SOURCES.find((s) => s.id === source).title}</p>
    </>
  );
}

// ---------- معاني الكلمات: جدول لكل آية — الكلمة بلفظها من المصحف، ومعناها ----------
function MeaningsTab({ quran, verses, onToast }) {
  const idx = memoIndex(quran);
  const covered = verses.filter((v) => idx.sectionOf.m[v] >= 0);
  const copyBar = (getText) => <CopyBar quran={quran} verses={verses} label="نسخ المعاني" getText={getText} onToast={onToast} />;
  if (!covered.length) return (
    <>
      {copyBar(null)}
      <p className="study__note">{UNAVAILABLE}</p>
    </>
  );
  const meaningsText = () =>
    covered.flatMap((v) => (idx.meaningsOf.get(v) ?? []).map((w) => `${w.mushaf ?? w.word}: ${w.meaning}`)).join('\n');
  const hasWords = covered.some((v) => idx.meaningsOf.get(v)?.length);

  const shown = covered;

  return (
    <>
      {copyBar(hasWords ? meaningsText : null)}
      {shown.map((v) => {
        const words = idx.meaningsOf.get(v) ?? [];
        return (
          <div key={v} className="study__item">
            {quran.verses[v].a === 1 && <SuraTitle quran={quran} sura={quran.verses[v].s} />}
            <VerseCard quran={quran} v={v} />
            {words.length ? (
              <table className="study__words">
                <tbody>
                  {words.map((w, i) => (
                    <tr key={i}>
                      <th scope="row">{w.mushaf ?? w.word}</th>
                      <td>{w.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="study__box study__box--explain">
                <p className="study__empty">{NO_MEANINGS}</p>
              </div>
            )}
          </div>
        );
      })}
      <Links quran={quran} kind="m" verses={verses} />
    </>
  );
}

// ---------- العمل بالآيات: بالموضوع لا بالآية ----------
function ActionsTab({ quran, verses, onToast }) {
  const idx = memoIndex(quran);
  const covered = verses.filter((v) => idx.sectionOf.a[v] >= 0);
  const list = useMemo(() => actionsInRange(quran, verses), [quran, verses]);
  const actionsText = () => list.map((i) => `• ${idx.actions[i].t}`).join('\n');
  const copyBar = <CopyBar quran={quran} verses={verses} label="نسخ العمل" getText={list.length ? actionsText : null} onToast={onToast} />;
  if (!covered.length) return (
    <>
      {copyBar}
      <p className="study__note">{UNAVAILABLE}</p>
    </>
  );

  const shown = list;

  return (
    <>
      {copyBar}
      {!list.length && <p className="study__note">{NO_ACTIONS}</p>}
      {shown.map((i) => {
        const a = idx.actions[i];
        return (
          <div key={i} className="study__box study__box--action">
            <p>
              <QuotedText text={a.t} open="﴿" close="﴾" keepMarks />
            </p>
            <span className="study__ref">{verseLabel(quran, a.v)}</span>
          </div>
        );
      })}
      <Links quran={quran} kind="a" verses={verses} />
    </>
  );
}

// ---------- أجزاء مشتركة ----------
function SuraTitle({ quran, sura }) {
  return <h3 className="study__sura">سورة {quran.suras[sura - 1].name}</h3>;
}

export function VerseCard({ quran, v }) {
  return (
    <div className="study__box study__box--verse" lang="ar">
      {verseText(quran, v)}
    </div>
  );
}

// نصّ فيه اقتباسات قرآنية بين علامتين (العمل بالآيات): يُكتب المقتبس بخط المصحف
export function QuotedText({ text, open, close, keepMarks }) {
  const parts = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const a = rest.indexOf(open);
    const b = a >= 0 ? rest.indexOf(close, a + 1) : -1;
    if (a < 0 || b < 0) {
      parts.push(rest);
      break;
    }
    if (a > 0) parts.push(rest.slice(0, a));
    const inner = rest.slice(a + open.length, b);
    parts.push(
      <span key={key++} className="study__quote">
        {keepMarks ? `${open}${inner}${close}` : inner}
      </span>
    );
    rest = rest.slice(b + close.length);
  }
  return parts;
}

// روابط يوتيوب أقسام المذكرات التي تمسّ النطاق — روابط نصية لا صور QR
function Links({ quran, kind, verses }) {
  const { sections } = memoIndex(quran);
  const list = sectionsInRange(quran, kind, verses);
  if (!list.length) return null;
  return (
    <div className="study__links">
      {list.map((i) => (
        <a key={i} href={sections[i].link} target="_blank" rel="noopener noreferrer" className="study__link">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5Z" fill="currentColor" />
          </svg>
          شرح {sectionLabel(quran, sections[i])} على يوتيوب
        </a>
      ))}
    </div>
  );
}

// زرّا النسخ الصغيران أعلى كل تبويب، على الجانبين (بطلب صاحب المشروع): نسخ المحتوى وحده
// متتاليًا يمينًا، ونسخ الآيات وحدها (الصفحة أو النطاق) يسارًا، وما بينهما في الوسط
function CopyBar({ quran, verses, label, getText, onToast, children }) {
  const copy = async (text) => onToast?.((await copyText(text)) ? 'نُسخ النص' : 'تعذّر النسخ');
  return (
    <div className="study__copy">
      <button type="button" disabled={!getText} onClick={() => copy(getText())}>
        <CopyIcon />
        {label}
      </button>
      {children ?? <span />}
      <button type="button" onClick={() => copy(copyVerses(quran, verses))}>
        <CopyIcon />
        نسخ الآيات
      </button>
    </div>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
