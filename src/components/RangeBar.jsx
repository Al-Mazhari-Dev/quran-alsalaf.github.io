import { verseLabel } from '../lib/study.js';
import './RangeBar.css';

/*
  شريط «تحديد مقدار الآيات» (٢٠٢٦-١١-١٠): آية البداية وآية النهاية، يفتح كلٌّ منهما منتقي
  الآيات (RangePicker)، وزرّ ✕ يلغي المقدار. يُستعمل في موضعين مستقلين: صفحات المحتوى،
  ونافذة الاستماع — ولكلٍّ مقداره الخاص (src/lib/userdata.js). ونهاية المقدار لا تُفتح قبل بدايته.
*/
export default function RangeBar({ quran, range, onPickStart, onPickEnd, onClear }) {
  const start = range?.[0];
  const end = range?.length === 2 ? range[1] : null;
  return (
    <div className="rbar" role="group" aria-label="تحديد مقدار الآيات">
      <span className="rbar__title">تحديد مقدار الآيات</span>
      <div className="rbar__row">
        <button type="button" className="rbar__pick" onClick={onPickStart}>
          <small>البداية</small>
          <span>{start != null ? verseLabel(quran, [start]) : 'اختر الآية'}</span>
        </button>
        <button type="button" className="rbar__pick" onClick={onPickEnd} disabled={start == null}>
          <small>النهاية</small>
          <span>{end != null ? verseLabel(quran, [end]) : 'اختر الآية'}</span>
        </button>
        {start != null && (
          <button type="button" className="rbar__clear" onClick={onClear} aria-label="إلغاء المقدار">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
