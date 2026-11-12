import { useMemo, useState } from 'react';
import { juzName, toArabicDigits } from '../data/quran.js';
import { buildSearchIndex, search } from '../lib/search.js';
import { addSearchHistory, readSearchHistory, removeSearchHistory } from '../lib/searchHistory.js';
import './SearchOverlay.css';
import { useLayer } from '../lib/layers.js';

/*
  البحث الرئيسي (الفصل ٨): خانة ثابتة أعلى منتصف صفحة المصحف تفتح هذه الصفحة الكاملة.
  يبحث في النص الإملائي للآيات وأسماء السور، وبالرقم وحده في الصفحات والسور والأجزاء
  (src/lib/search.js)، والضغط على نتيجة ينقل
  إلى موضعها ويُغلق البحث. والصفحة الفارغة (بلا كتابة) بلا أي نصّ إرشادي — بل سجل آخر
  عمليات البحث الناجحة (بطلب صاحب المشروع)، فيُعاد أيٌّ منها بضغطة واحدة.
*/
export default function SearchOverlay({ quran, onGoto, onClose }) {
  useLayer(onClose);
  const [q, setQ] = useState('');
  const [history, setHistory] = useState(readSearchHistory);
  const index = useMemo(() => buildSearchIndex(quran), [quran]);
  const result = useMemo(() => search(index, q), [index, q]);

  const goto = (page) => {
    addSearchHistory(q);
    onGoto(page);
    onClose();
  };

  const removeHistory = (text) => {
    removeSearchHistory(text);
    setHistory(readSearchHistory());
  };

  return (
    <div className="searchov" role="dialog" aria-label="بحث في المصحف">
      <header className="searchov__head">
        <button type="button" className="searchov__back" onClick={onClose} aria-label="رجوع">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="searchov__box">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالكلمات أو الأرقام…"
            inputMode="search"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" className="searchov__clear" onClick={() => setQ('')} aria-label="مسح">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="searchov__body">
        {!q.trim() ? (
          history.length > 0 && (
            <ul className="searchov__history">
              {history.map((text) => (
                <li key={text}>
                  <button type="button" className="searchov__histItem" onClick={() => setQ(text)}>
                    <HistoryIcon />
                    <span>{text}</span>
                  </button>
                  <button type="button" className="searchov__histRemove" onClick={() => removeHistory(text)} aria-label={`حذف «${text}» من السجل`}>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : result.numbers ? (
          result.numbers.length > 0 && (
            <section className="searchov__group">
              {result.numbers.map((r) => (
                <button key={r.kind} type="button" className="searchov__sura searchov__numHit" data-kind={r.kind} onClick={() => goto(r.page)}>
                  <span className="searchov__num">{toArabicDigits(r.n)}</span>
                  {r.kind === 'page' ? 'الصفحة' : r.kind === 'sura' ? `سورة ${quran.suras[r.n - 1].name}` : juzName(r.n)}
                </button>
              ))}
            </section>
          )
        ) : result.suras.length + result.verses.length === 0 ? null : (
          <>
            {result.suras.length > 0 && (
              <section className="searchov__group">
                <h3>السور</h3>
                {result.suras.map((n) => (
                  <button key={n} type="button" className="searchov__sura" onClick={() => goto(quran.suras[n - 1].page)}>
                    <span className="searchov__num">{toArabicDigits(n)}</span>
                    سورة {quran.suras[n - 1].name}
                  </button>
                ))}
              </section>
            )}
            {result.verses.length > 0 && (
              <section className="searchov__group">
                <h3>
                  الآيات
                  {result.total > result.verses.length && <span> (أول {toArabicDigits(result.verses.length)} من {toArabicDigits(result.total)})</span>}
                </h3>
                {result.verses.map((i) => {
                  const v = quran.verses[i];
                  return (
                    <button key={i} type="button" className="searchov__verse" onClick={() => goto(v.p)}>
                      <span className="searchov__verseRef">
                        {quran.suras[v.s - 1].name} {toArabicDigits(v.a)}
                      </span>
                      <span className="searchov__verseText">{v.e}</span>
                    </button>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
