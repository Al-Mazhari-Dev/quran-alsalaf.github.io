import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { FOREVER } from '../lib/player.js';
import { copyVerse, loadTafsir, memoIndex, muyassarPlain, verseLabel } from '../lib/study.js';
import {
  bookmarksAt,
  copyText,
  createBookmark,
  defaultBookmarkColor,
  defaultBookmarkName,
  placeBookmark,
  readNotes,
  setNote,
  unplaceBookmark,
  useUserData,
} from '../lib/userdata.js';
import BookmarkForm, { bookmarkMeta, typeName } from './BookmarkForm.jsx';
import { CopyIcon, NO_ACTIONS, NO_MEANINGS, QuotedText, UNAVAILABLE, VerseCard } from './StudySheet.jsx';
import './VerseMenu.css';
import { useLayer } from '../lib/layers.js';

/*
  الضغط المطوّل على آية (الفصل ٤): مربع عائم كبير وسط الشاشة (٢٠٢٦-١١-١٢، بدل البطاقة الصغيرة فوق
  الآية)، في أعلاه اسم الآية ثم مربعات كبيرة بترتيب ثابت: تشغيل · تفسير · معاني · عمل · ملاحظة · علامة.
  والمربعات من ACTIONS وحدها، فيُضاف مربع جديد بسطر فيها (وبحالته في choose).
  • تشغيل ⇐ تختفي المربعات ويظهر في المربع نفسه (بزرّ رجوع) خياران:
      – «تشغيل الآية وحدها» ⇐ يظهر تحته عدد المرات (مرة · ٥ · ١٠ · ٢٠ · ٥٠ · بلا نهاية)، والضغط على
        أحدها يشغّل فورًا ويغلق المربع (playVerseAlone في App.jsx).
      – «بدء التشغيل من هذه الآية» ⇐ يبدأ فورًا متتابعًا بلا نهاية ولا تكرار (playFromVerse في App.jsx).
  • تفسير/معاني/عمل ⇐ بطاقة عائمة أعلى الشاشة بمحتوى هذه الآية وحدها، فيها زرّا نسخ وإغلاق.
    والتفسير يعرض التفسيرين معًا: المختصر ثم الميسّر، ولكلٍّ زرّ نسخ بجانب عنوانه.
  • ملاحظة ⇐ كتابة ملاحظة الآية أو تعديلها (واحدة لكل آية).
  • علامة ⇐ (٢٠٢٦-١١-١٤) تختفي المربعات ويظهر في المربع نفسه (بزرّ رجوع): «علامة جديدة» (اسم ولون
    ونوع، فتُنشأ وتوضع على الآية)، ثم العلامات التي على الآية ولكلٍّ زرّ إزالة، ثم بقية العلامات:
    الضغط على إحداها يضعها على الآية (والمتنقّلة تنتقل إليها) ويغلق المربع.
*/
const ACTIONS = [
  { id: 'play', name: 'تشغيل', icon: 'M8 5.5v13l10.5-6.5L8 5.5Z' },
  { id: 'tafsir', name: 'تفسير', icon: 'M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5ZM5 17a2.5 2.5 0 0 1 2.5-2.5H17M8.5 8h5M8.5 11h5' },
  { id: 'meanings', name: 'معاني', icon: 'M4 6.5h16M4 12h10M4 17.5h13' },
  { id: 'actions', name: 'عمل', icon: 'M5 12.5l4 4 10-10' },
  { id: 'note', name: 'ملاحظة', icon: 'M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16v3ZM13.5 8l3 3' },
  { id: 'bookmark', name: 'علامة', icon: 'M7 4.5h10v15l-5-3.6-5 3.6v-15Z' },
];

// عدد مرات قراءة «الآية وحدها» (بطلب صاحب المشروع)
export const ALONE_REPEATS = [1, 5, 10, 20, 50, FOREVER];
const repeatName = (n) => (n === 1 ? 'مرة' : n === FOREVER ? 'بلا نهاية ∞' : toArabicDigits(n));

// noPlay: بلا مربع «تشغيل» (في صفحة ورد الختمة: الاستماع من المصحف نفسه)
export default function VerseMenu({ quran, pressed, onClose, onToast, onPlay, onPlayAlone, noPlay }) {
  const [view, setView] = useState('menu');
  const { v } = pressed;
  // Esc يغلق المربع؛ وفي خيارات التشغيل يرجع إلى المربعات؛ وفي الملاحظة يحفظها أولًا كزرّ ✕ فيها
  const saveNote = useRef(null);
  useLayer(() =>
    view === 'note' && saveNote.current ? saveNote.current() : view === 'play' || view === 'bookmark' ? setView('menu') : onClose()
  );

  const boxed = view === 'menu' || view === 'play' || view === 'bookmark';
  const sub = view === 'play' ? 'تشغيل الآية' : view === 'bookmark' ? 'علامة' : null;

  return (
    <div className="vmenu">
      <div className="vmenu__backdrop" onClick={onClose} />
      {boxed && (
        <VerseBox quran={quran} v={v} sub={sub} onBack={() => setView('menu')} onClose={onClose}>
          {view === 'menu' ? (
            <Tiles onChoose={setView} noPlay={noPlay} />
          ) : view === 'bookmark' ? (
            <BookmarkChoices quran={quran} v={v} onToast={onToast} onDone={onClose} />
          ) : (
            <PlayChoices
              onAlone={(n) => {
                onClose();
                onPlayAlone(v, n);
              }}
              onFrom={() => {
                onClose();
                onPlay(v);
              }}
            />
          )}
        </VerseBox>
      )}
      {(view === 'tafsir' || view === 'meanings' || view === 'actions') && (
        <DetailCard quran={quran} v={v} kind={view} onClose={onClose} onToast={onToast} />
      )}
      {view === 'note' && <NoteCard quran={quran} v={v} onClose={onClose} onToast={onToast} saveRef={saveNote} />}
    </div>
  );
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// المربع العائم الكبير وسط الشاشة: اسم الآية وزرّ إغلاق، وفي خيارات التشغيل والعلامة (sub) عنوانها
// وزرّ رجوع إلى المربعات
function VerseBox({ quran, v, sub, onBack, onClose, children }) {
  const verse = quran.verses[v];
  const name = `${quran.suras[verse.s - 1].name}: ${toArabicDigits(verse.a)}`;
  return (
    <section className="vbox" role="dialog" aria-label={sub ? `${sub.split(' ')[0]} ${name}` : name}>
      <header className="vbox__head">
        {sub && (
          <button type="button" className="vcard__btn" onClick={onBack} aria-label="رجوع">
            <Icon d="M9 6l6 6-6 6" />
          </button>
        )}
        <div className="vbox__title">
          <h2>{sub ?? name}</h2>
          {sub && <span>{name}</span>}
        </div>
        <button type="button" className="vcard__btn" onClick={onClose} aria-label="إغلاق">
          <Icon d="M6 6l12 12M18 6 6 18" />
        </button>
      </header>
      {children}
    </section>
  );
}

// المربعات الكبيرة: لكلٍّ أيقونة وتسمية تحتها
function Tiles({ onChoose, noPlay }) {
  return (
    <div className="vmenu__picker" role="menu">
      {ACTIONS.filter((a) => !(noPlay && a.id === 'play')).map((a) => (
        <button key={a.id} type="button" role="menuitem" onClick={() => onChoose(a.id)} className="vmenu__action">
          <Icon d={a.icon} />
          <span className="vmenu__label">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

// اختيار العلامة للآية (٢٠٢٦-١١-١٤): علامة جديدة، ثم ما على الآية (بزرّ إزالة)، ثم بقية العلامات
function BookmarkChoices({ quran, v, onToast, onDone }) {
  const { bookmarks = [] } = useUserData();
  const [creating, setCreating] = useState(false);
  const here = bookmarksAt(bookmarks, v);
  const others = bookmarks.filter((b) => !here.includes(b));

  const place = (b) => {
    const result = placeBookmark(b.id, v);
    onToast(result === 'moved' ? `نُقلت علامة «${b.name}» إلى هذه الآية` : `وُضعت علامة «${b.name}»`);
    onDone();
  };

  if (creating) {
    return (
      <div className="vmark">
        <BookmarkForm
          initial={{ name: defaultBookmarkName(bookmarks), color: defaultBookmarkColor(bookmarks), multi: false }}
          submitLabel="إنشاء ووضعها على الآية"
          onCancel={() => setCreating(false)}
          onSubmit={(values) => {
            createBookmark(values, v);
            onToast(`وُضعت علامة «${values.name}»`);
            onDone();
          }}
        />
      </div>
    );
  }

  return (
    <div className="vmark">
      <button type="button" className="vmark__new" onClick={() => setCreating(true)}>
        <Icon d="M12 5v14M5 12h14" />
        علامة جديدة
      </button>

      {here.length > 0 && (
        <section className="vmark__group" aria-label="على هذه الآية">
          <h3>على هذه الآية</h3>
          <ul>
            {here.map((b) => (
              <li key={b.id} className="vmark__row">
                <span className="vmark__dot" style={{ background: b.color }} />
                <span className="vmark__name">
                  {b.name}
                  <small>{typeName(b.multi)}</small>
                </span>
                <button
                  type="button"
                  className="vmark__remove"
                  aria-label={`إزالة «${b.name}» عن الآية`}
                  onClick={() => {
                    unplaceBookmark(b.id, v);
                    onToast(`أُزيلت علامة «${b.name}» عن الآية`);
                  }}
                >
                  <Icon d="M6 6l12 12M18 6 6 18" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="vmark__group" aria-label="علاماتك">
          <h3>{here.length ? 'علاماتك الأخرى' : 'علاماتك'}</h3>
          <ul>
            {others.map((b) => (
              <li key={b.id}>
                <button type="button" className="vmark__row vmark__pick" onClick={() => place(b)}>
                  <span className="vmark__dot" style={{ background: b.color }} />
                  <span className="vmark__name">
                    {b.name}
                    <small>{bookmarkMeta(quran, b)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// خيارا التشغيل: الآية وحدها (ويظهر تحته عدد المرات، والضغط على أحدها يشغّل)، أو من هذه الآية متتابعًا
function PlayChoices({ onAlone, onFrom }) {
  const [alone, setAlone] = useState(false);
  return (
    <div className="vplay">
      <button type="button" className="vplay__opt" aria-expanded={alone} onClick={() => setAlone((x) => !x)}>
        <Icon d="M8 5.5v13l10.5-6.5L8 5.5Z" />
        <span>
          تشغيل الآية وحدها
          <small>اختر عدد المرات</small>
        </span>
      </button>
      {alone && (
        <div className="vplay__repeats" role="group" aria-label="عدد المرات">
          {ALONE_REPEATS.map((n) => (
            <button key={n} type="button" className="vplay__repeat" onClick={() => onAlone(n)}>
              {repeatName(n)}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="vplay__opt" onClick={onFrom}>
        <Icon d="M5 5.5v13M9.5 5.5v13l9.5-6.5-9.5-6.5Z" />
        <span>
          بدء التشغيل من هذه الآية
          <small>متتابعًا إلى آخر المصحف</small>
        </span>
      </button>
    </div>
  );
}

function CardHead({ quran, v, title, children, onClose }) {
  const verse = quran.verses[v];
  return (
    <header className="vcard__head">
      <div>
        <h2>{title}</h2>
        <span>
          {quran.suras[verse.s - 1].name}: {toArabicDigits(verse.a)}
        </span>
      </div>
      <div className="vcard__buttons">
        {children}
        <button type="button" className="vcard__btn" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function CopyButton({ onCopy }) {
  return (
    <button type="button" className="vcard__btn" onClick={onCopy} aria-label="نسخ">
      <CopyIcon />
    </button>
  );
}

// بطاقة التفسير/المعاني/العمل للآية وحدها، أعلى الشاشة
function DetailCard({ quran, v, kind, onClose, onToast }) {
  const idx = memoIndex(quran);
  const [tafsir, setTafsir] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (kind !== 'tafsir') return undefined;
    let alive = true;
    Promise.all([loadTafsir('mukhtasar'), loadTafsir('muyassar')]).then(
      ([mk, my]) => alive && setTafsir({ mk, my }),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [kind]);

  let title;
  let body;
  let plain = '';

  if (kind === 'tafsir') {
    title = 'التفسير';
    if (failed) body = <p className="study__note">تعذّر تحميل التفسير. يُحمَّل مرة واحدة، ويحتاج لذلك اتصالًا بالإنترنت.</p>;
    else if (!tafsir) body = <p className="study__note">جارٍ تحميل التفسير…</p>;
    else {
      // نص عادي بلا تمييز (بطلب صاحب المشروع)، ولكل مصدر زرّ نسخ بجانب عنوانه
      const mk = tafsir.mk.verses[v];
      const my = muyassarPlain(tafsir.my.verses[v], tafsir.my.quote);
      const copyOne = async (name, text) =>
        onToast((await copyText(`${copyVerse(quran, v)}\n\n${name}:\n${text}`)) ? `نُسخ ${name}` : 'تعذّر النسخ');
      body = (
        <>
          <h3 className="vcard__source">
            المختصر في تفسير القرآن الكريم
            <button type="button" className="vcard__copy" onClick={() => copyOne('المختصر في تفسير القرآن الكريم', mk)}>
              <CopyIcon />
              نسخ
            </button>
          </h3>
          <p>{mk}</p>
          <h3 className="vcard__source">
            التفسير الميسّر
            <button type="button" className="vcard__copy" onClick={() => copyOne('التفسير الميسّر', my)}>
              <CopyIcon />
              نسخ
            </button>
          </h3>
          <p>{my}</p>
        </>
      );
    }
  } else if (kind === 'meanings') {
    title = 'معاني الكلمات';
    const words = idx.meaningsOf.get(v) ?? [];
    if (idx.sectionOf.m[v] < 0) body = <p className="vcard__empty">{UNAVAILABLE}</p>;
    else if (!words.length) body = <p className="vcard__empty">{NO_MEANINGS}</p>;
    else {
      body = (
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
      );
      plain = words.map((w) => `${w.mushaf ?? w.word}: ${w.meaning}`).join('\n');
    }
  } else {
    title = 'العمل بالآيات';
    const list = idx.actionsOf.get(v) ?? [];
    if (idx.sectionOf.a[v] < 0) body = <p className="vcard__empty">{UNAVAILABLE}</p>;
    else if (!list.length) body = <p className="vcard__empty">{NO_ACTIONS}</p>;
    else {
      body = list.map((i) => (
        <div key={i} className="vcard__action">
          <p>
            <QuotedText text={idx.actions[i].t} open="﴿" close="﴾" keepMarks />
          </p>
          <span className="study__ref">{verseLabel(quran, idx.actions[i].v)}</span>
        </div>
      ));
      plain = list.map((i) => `• ${idx.actions[i].t}`).join('\n');
    }
  }

  const copy = async () => {
    // الآية بلا علامتها الخاصة بخط المصحف (كانت تظهر «ئج» في غير التطبيق)، ثم المحتوى
    const text = `${copyVerse(quran, v)}\n\n${title}:\n${plain || body?.props?.children || ''}`;
    onToast((await copyText(text)) ? 'نُسخ النص' : 'تعذّر النسخ');
  };

  return (
    <section className="vcard" role="dialog" aria-label={title}>
      <CardHead quran={quran} v={v} title={title} onClose={onClose}>
        {kind !== 'tafsir' && <CopyButton onCopy={copy} />}
      </CardHead>
      <div className="vcard__body">
        <VerseCard quran={quran} v={v} />
        <div className="vcard__content">{body}</div>
      </div>
    </section>
  );
}

// ملاحظة الآية: تُكتب وتُعدَّل، وتُحفظ عند الحفظ أو الإغلاق؛ وتُحذف بزرّها أو بتفريغها
function NoteCard({ quran, v, onClose, onToast, saveRef }) {
  const [text, setText] = useState(() => readNotes()[v] ?? '');
  const existed = useRef(Boolean(readNotes()[v]));
  const save = () => {
    const before = readNotes()[v] ?? '';
    if (text !== before) setNote(v, text);
    onClose();
  };
  if (saveRef) saveRef.current = save;
  const remove = () => {
    setNote(v, '');
    onToast('حُذفت الملاحظة');
    onClose();
  };
  const copy = async () => {
    onToast((await copyText(`${text}\n\n${copyVerse(quran, v)}`)) ? 'نُسخت الملاحظة' : 'تعذّر النسخ');
  };
  return (
    <section className="vcard vcard--note" role="dialog" aria-label="ملاحظة">
      <CardHead quran={quran} v={v} title="ملاحظة" onClose={save}>
        {text.trim() && <CopyButton onCopy={copy} />}
        {existed.current && (
          <button type="button" className="vcard__btn" onClick={remove} aria-label="حذف الملاحظة">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </CardHead>
      <textarea
        className="vcard__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب ملاحظتك على هذه الآية…"
        autoFocus
      />
      <button type="button" className="vcard__save" onClick={save}>
        حفظ
      </button>
    </section>
  );
}
