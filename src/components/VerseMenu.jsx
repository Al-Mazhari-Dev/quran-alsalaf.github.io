import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { copyVerse, loadTafsir, memoIndex, muyassarPlain, verseLabel } from '../lib/study.js';
import { copyText, readNotes, setNote, toggleBookmark, BOOKMARK_COLOR_NAMES, MAX_BOOKMARKS, readBookmarks } from '../lib/userdata.js';
import { CopyIcon, NO_ACTIONS, NO_MEANINGS, QuotedText, UNAVAILABLE, VerseCard } from './StudySheet.jsx';
import './VerseMenu.css';
import { useLayer } from '../lib/layers.js';

/*
  الضغط المطوّل على آية (الفصل ٤): بطاقة عائمة صغيرة فوق الآية، أيقوناتها بترتيب ثابت
  تعلو كلًّا تسميتُها: تشغيل · تفسير · معاني · عمل · ملاحظة · علامة («فوائد» تُضاف لاحقًا إن طُلبت).
  • تشغيل ⇐ تُغلق البطاقة وتبدأ القراءة من هذه الآية بلا نهاية ولا تكرار (playFromVerse في App.jsx).
  • تفسير/معاني/عمل ⇐ بطاقة عائمة أعلى الشاشة بمحتوى هذه الآية وحدها، فيها زرّا نسخ وإغلاق.
    والتفسير يعرض التفسيرين معًا: المختصر ثم الميسّر، ولكلٍّ زرّ نسخ بجانب عنوانه.
  • ملاحظة ⇐ كتابة ملاحظة الآية أو تعديلها (واحدة لكل آية).
  • علامة ⇐ تُحوَّل الآية علامةً مرجعية فورًا بلا بطاقة وسيطة (أو تُزال إن كانت علامة).
*/
const ACTIONS = [
  { id: 'play', name: 'تشغيل', icon: 'M8 5.5v13l10.5-6.5L8 5.5Z' },
  { id: 'tafsir', name: 'تفسير', icon: 'M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5ZM5 17a2.5 2.5 0 0 1 2.5-2.5H17M8.5 8h5M8.5 11h5' },
  { id: 'meanings', name: 'معاني', icon: 'M4 6.5h16M4 12h10M4 17.5h13' },
  { id: 'actions', name: 'عمل', icon: 'M5 12.5l4 4 10-10' },
  { id: 'note', name: 'ملاحظة', icon: 'M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16v3ZM13.5 8l3 3' },
  { id: 'bookmark', name: 'علامة', icon: 'M7 4.5h10v15l-5-3.6-5 3.6v-15Z' },
];

export default function VerseMenu({ quran, pressed, onClose, onToast, onPlay }) {
  const [view, setView] = useState('menu');
  const { v, rect } = pressed;
  // Esc يغلق البطاقة؛ وفي الملاحظة يحفظها أولًا كزرّ ✕ فيها
  const saveNote = useRef(null);
  useLayer(() => (view === 'note' && saveNote.current ? saveNote.current() : onClose()));

  const choose = (id) => {
    if (id === 'play') {
      onClose();
      onPlay(v);
      return;
    }
    if (id === 'bookmark') {
      const result = toggleBookmark(v);
      if (result === 'full') onToast(`بلغت العلامات حدّها (${toArabicDigits(MAX_BOOKMARKS)})؛ احذف إحداها من القائمة الجانبية لتضيف غيرها.`);
      else if (result === 'removed') onToast('أُزيلت العلامة عن الآية');
      else {
        const b = readBookmarks().find((x) => x.v === v);
        onToast(`أُضيفت علامة: ${b?.name ?? BOOKMARK_COLOR_NAMES[0]}`);
      }
      onClose();
      return;
    }
    setView(id);
  };

  return (
    <div className="vmenu">
      <div className="vmenu__backdrop" onClick={onClose} />
      {view === 'menu' && <Picker rect={rect} onChoose={choose} onClose={onClose} hasBookmark={readBookmarks().some((b) => b.v === v)} />}
      {(view === 'tafsir' || view === 'meanings' || view === 'actions') && (
        <DetailCard quran={quran} v={v} kind={view} onClose={onClose} onToast={onToast} />
      )}
      {view === 'note' && <NoteCard quran={quran} v={v} onClose={onClose} onToast={onToast} saveRef={saveNote} />}
    </div>
  );
}

// البطاقة الصغيرة فوق الآية (أو تحتها إن ضاق ما فوقها)
function Picker({ rect, onChoose, onClose, hasBookmark }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const h = ref.current.offsetHeight;
    const above = rect.top - h - 10;
    setPos(above > 60 ? { top: above } : { top: rect.bottom + 10 });
  }, [rect]);
  return (
    <div ref={ref} className="vmenu__picker" style={pos ?? { visibility: 'hidden' }} role="menu">
      {ACTIONS.map((a) => (
        <button key={a.id} type="button" role="menuitem" onClick={() => onChoose(a.id)} className="vmenu__action">
          <span className="vmenu__label">{a.id === 'bookmark' && hasBookmark ? 'إزالة' : a.name}</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={a.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      {/* إغلاق ظاهر على أجهزة الفأرة (VerseMenu.css)؛ وباللمس يُغلق بالنقر خارجها كما كان */}
      <button type="button" className="vmenu__x" onClick={onClose} aria-label="إغلاق">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
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
