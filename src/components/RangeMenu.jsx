import { verseLabel } from '../lib/study.js';
import './RangeMenu.css';
import { useLayer } from '../lib/layers.js';

/*
  تحديد مقدار الآيات (الفصل ٤، بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٤): بطاقة عائمة أسفل الشاشة،
  صفّان — بداية المقدار ونهايته — الضغط على أحدهما يفتح قائمة اختيار الآية المناسبة له
  (RangePicker). ونهاية المقدار لا تُفتح قبل تحديد بدايته.
*/
export default function RangeMenu({ quran, range, onPickStart, onPickEnd, onClose }) {
  useLayer(onClose);
  const start = range?.[0];
  const end = range?.length === 2 ? range[1] : null;
  return (
    <div className="rmenu">
      <div className="rmenu__backdrop" onClick={onClose} />
      <section className="rmenu__card" role="dialog" aria-label="تحديد مقدار الآيات">
        <header className="rmenu__head">
          <h2>تحديد مقدار الآيات</h2>
          <button type="button" className="rmenu__close" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <button type="button" className="rmenu__row" onClick={onPickStart}>
          <span>تحديد بداية المقدار</span>
          <span className="rmenu__value">{start != null ? verseLabel(quran, [start]) : 'لم تُحدَّد بعد'}</span>
        </button>
        <button type="button" className="rmenu__row" onClick={onPickEnd} disabled={start == null}>
          <span>تحديد نهاية المقدار</span>
          <span className="rmenu__value">{end != null ? verseLabel(quran, [end]) : 'لم تُحدَّد بعد'}</span>
        </button>
      </section>
    </div>
  );
}
