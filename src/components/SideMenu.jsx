import { useEffect, useMemo, useRef, useState } from 'react';
import { juzName, toArabicDigits } from '../data/quran.js';
import { AYAT, countNoun } from '../lib/count.js';
import { verseLabel } from '../lib/study.js';
import { BOOKMARK_COLORS, moveBookmark, removeBookmark, renameBookmark, setNote, useUserData } from '../lib/userdata.js';
import RangePicker from './RangePicker.jsx';
import KhatmaTab from './KhatmaTab.jsx';
import './SideMenu.css';
import { useLayer } from '../lib/layers.js';
import { juzStarts, rubName, rubOpening } from '../lib/rubs.js';

/*
  القائمة الجانبية (الفصل ٧): صفحة كاملة تنزلق من اليمين (أيقونتها في الشريط العلوي هناك)،
  بأربعة تبويبات في شريط أسفلها (٢٠٢٦-١١-١٢، كان أعلاها): الختمة، السور (فهرس)، العلامات المرجعية،
  الملاحظات (بترتيب ورودها في المصحف). وتُفتح على آخر تبويب استعمله المستخدم.
  الضغط على سورة أو علامة ينقل مباشرة إلى موضعها ويُغلق القائمة.
  وفي أعلى تبويب السور (٢٠٢٦-١١-١٣) شريط «السور · الأجزاء · الأرباع»، يُفتح دائمًا على السور.
*/
const INDEXES = [
  { id: 'suras', name: 'السور' },
  { id: 'juz', name: 'الأجزاء' },
  { id: 'rubs', name: 'الأرباع' },
];
// رمز الربع في دائرته: رقم الحزب لأوله، ثم ¼ ½ ¾
const RUB_SIGNS = ['', '¼', '½', '¾'];
const TAB_KEY = 'hq.sideTab';
const TABS = [
  { id: 'khatma', name: 'الختمة', icon: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5M12 6.5c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5M12 6.5v13' },
  { id: 'suras', name: 'السور', icon: 'M5 6.5h14M5 12h14M5 17.5h14' },
  { id: 'bookmarks', name: 'العلامات', icon: 'M7 4.5h10v15l-5-3.6-5 3.6v-15Z' },
  { id: 'notes', name: 'الملاحظات', icon: 'M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16v3ZM13.5 8l3 3' },
];
const readTab = () => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some((x) => x.id === t) ? t : 'suras';
  } catch {
    return 'suras';
  }
};

export default function SideMenu({ quran, open, onGoto, onClose, onReadWird, onToast }) {
  const [tab, setTabState] = useState(readTab);
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // بلا تخزين: يبقى في هذه الجلسة
    }
  };
  useLayer(onClose, open);
  // فهرس تبويب السور: السور أو الأجزاء أو الأرباع، ويرجع إلى السور كلما فُتحت القائمة
  const [index, setIndex] = useState('suras');
  const bodyRef = useRef(null);
  useEffect(() => {
    if (open) setIndex('suras');
  }, [open]);
  const pickIndex = (id) => {
    setIndex(id);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
  const juzs = useMemo(() => (quran ? juzStarts(quran) : []), [quran]);
  const user = useUserData();
  // الملاحظات مرتبة بترتيب الآيات في المصحف لا بوقت إضافتها
  const noteEntries = useMemo(
    () => Object.entries(user.notes ?? {}).map(([v, text]) => ({ v: Number(v), text })).sort((a, b) => a.v - b.v),
    [user.notes]
  );
  const bookmarks = useMemo(() => [...(user.bookmarks ?? [])].sort((a, b) => a.v - b.v), [user.bookmarks]);

  const goto = (v) => {
    onGoto(quran.verses[v].p);
    onClose();
  };

  return (
    <div className={`sidemenu${open ? ' sidemenu--open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="sidemenu__backdrop" onClick={onClose} />
      <section className="sidemenu__card" role="dialog" aria-modal="true" aria-label="القائمة">
        <header className="sidemenu__head">
          <h2>القائمة</h2>
          <button className="sidemenu__close" type="button" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="sidemenu__body" ref={bodyRef}>
          {tab === 'khatma' && <KhatmaTab quran={quran} onRead={onReadWird} onToast={onToast} />}

          {tab === 'suras' && (
            <>
              <div className="sidemenu__index" role="radiogroup" aria-label="الفهرس">
                {INDEXES.map((x) => (
                  <button key={x.id} type="button" role="radio" aria-checked={index === x.id} onClick={() => pickIndex(x.id)}>
                    {x.name}
                  </button>
                ))}
              </div>

              {index === 'suras' && (
                <ul className="sidemenu__suras">
                  {quran.suras.map((s) => (
                    <li key={s.n}>
                      <button type="button" onClick={() => goto(quran.verses.findIndex((v) => v.s === s.n))}>
                        <span className="sidemenu__suraNum">{toArabicDigits(s.n)}</span>
                        <span className="sidemenu__suraName">سورة {s.name}</span>
                        <span className="sidemenu__suraMeta">{toArabicDigits(s.count)} {countNoun(s.count, AYAT)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {index === 'juz' && (
                <ul className="sidemenu__suras sidemenu__juzs">
                  {juzs.map((v, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => goto(v)}>
                        <span className="sidemenu__suraNum">{toArabicDigits(i + 1)}</span>
                        <span className="sidemenu__suraName">
                          {juzName(i + 1)}
                          <small>{verseLabel(quran, [v])}</small>
                        </span>
                        <span className="sidemenu__suraMeta">صفحة {toArabicDigits(quran.verses[v].p)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {index === 'rubs' &&
                juzs.map((_, j) => (
                  <section key={j} className="sidemenu__rubGroup" aria-label={juzName(j + 1)}>
                    <h3 className="sidemenu__rubJuz">{juzName(j + 1)}</h3>
                    <ul className="sidemenu__suras sidemenu__rubs">
                      {quran.rubs.slice(j * 8, j * 8 + 8).map((v, k) => {
                        const i = j * 8 + k;
                        return (
                          <li key={i}>
                            <button type="button" onClick={() => goto(v)}>
                              <span className={`sidemenu__suraNum${i % 4 ? ' sidemenu__rubSign' : ''}`}>
                                {i % 4 ? RUB_SIGNS[i % 4] : toArabicDigits(i / 4 + 1)}
                              </span>
                              <span className="sidemenu__suraName">
                                {rubName(i)}
                                <small>{rubOpening(quran, i)}</small>
                              </span>
                              <span className="sidemenu__suraMeta">صفحة {toArabicDigits(quran.verses[v].p)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
            </>
          )}

          {tab === 'notes' &&
            (noteEntries.length ? (
              <ul className="sidemenu__list">
                {noteEntries.map(({ v, text }) => (
                  <NoteRow key={v} quran={quran} v={v} text={text} onGoto={() => goto(v)} />
                ))}
              </ul>
            ) : (
              <p className="sidemenu__empty">لا توجد ملاحظات بعد. اضغط ضغطًا مطوّلًا على أي آية لإضافة واحدة.</p>
            ))}

          {tab === 'bookmarks' &&
            (bookmarks.length ? (
              <ul className="sidemenu__list">
                {bookmarks.map((b) => (
                  <BookmarkRow key={b.id} quran={quran} b={b} onGoto={() => goto(b.v)} />
                ))}
              </ul>
            ) : (
              <p className="sidemenu__empty">لا توجد علامات مرجعية بعد. اضغط ضغطًا مطوّلًا على آية ثم «علامة».</p>
            ))}
        </div>

        {/* شريط التبويبات أسفل القائمة (بطلب صاحب المشروع)، فيُبدَّل بينها بالإبهام */}
        <nav className="sidemenu__tabs" role="tablist" aria-label="أقسام القائمة">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={t.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{t.name}</span>
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}

// صفّ ملاحظة: يُنقل بالضغط على نصّها، وتُعدَّل بزرّ القلم وتُحذف بزرّ السلة
function NoteRow({ quran, v, text, onGoto }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  if (editing) {
    return (
      <li className="sidemenu__row sidemenu__row--edit">
        <span className="sidemenu__rowLabel">{verseLabel(quran, [v])}</span>
        <textarea className="sidemenu__textarea" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        <div className="sidemenu__rowActions">
          <button type="button" onClick={() => setEditing(false)}>
            إلغاء
          </button>
          <button
            type="button"
            className="sidemenu__save"
            onClick={() => {
              setNote(v, draft);
              setEditing(false);
            }}
          >
            حفظ
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="sidemenu__row">
      <button type="button" className="sidemenu__rowMain" onClick={onGoto}>
        <span className="sidemenu__rowLabel">{verseLabel(quran, [v])}</span>
        <span className="sidemenu__rowText">{text}</span>
      </button>
      <div className="sidemenu__rowActions">
        <button type="button" aria-label="تعديل الملاحظة" onClick={() => setEditing(true)}>
          <PencilIcon />
        </button>
        <button type="button" aria-label="حذف الملاحظة" onClick={() => setNote(v, '')}>
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

// صفّ علامة مرجعية: نقطة بلونها، اسم قابل لإعادة التسمية، ونقل إلى آية أخرى، وحذف
function BookmarkRow({ quran, b, onGoto }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(b.name);
  const [moving, setMoving] = useState(false);

  return (
    <li className="sidemenu__row">
      <button type="button" className="sidemenu__rowMain" onClick={onGoto}>
        <span className="sidemenu__dot" style={{ background: BOOKMARK_COLORS[b.color] }} />
        {editing ? (
          <input
            className="sidemenu__input"
            value={draft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (renameBookmark(b.id, draft), setEditing(false))}
          />
        ) : (
          <span className="sidemenu__rowLabel">{b.name}</span>
        )}
        <span className="sidemenu__rowText">{verseLabel(quran, [b.v])}</span>
      </button>
      <div className="sidemenu__rowActions">
        {editing ? (
          <button
            type="button"
            className="sidemenu__save"
            onClick={() => {
              renameBookmark(b.id, draft);
              setEditing(false);
            }}
          >
            حفظ
          </button>
        ) : (
          <button type="button" aria-label="إعادة تسمية العلامة" onClick={() => setEditing(true)}>
            <PencilIcon />
          </button>
        )}
        <button type="button" aria-label="نقل العلامة إلى آية أخرى" onClick={() => setMoving(true)}>
          <MoveIcon />
        </button>
        <button type="button" aria-label="حذف العلامة" onClick={() => removeBookmark(b.id)}>
          <TrashIcon />
        </button>
      </div>
      {moving && (
        <RangePicker
          quran={quran}
          mode="start"
          near={b.v}
          title="انقلها إلى آية أخرى"
          onPick={(v) => (moveBookmark(b.id, v), setMoving(false))}
          onClose={() => setMoving(false)}
        />
      )}
    </li>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16v3ZM13.5 8l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7l4-4 4 4M12 3v12M8 17l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
