import { covers, RECITERS, styleLabel } from '../lib/reciters.js';
import './ReciterPicker.css';
import { useLayer } from '../lib/layers.js';

/*
  قائمة اختيار القارئ (الفصل ٦): صفحة كاملة تنزلق من الأسفل، بقائمة قرّاء ودائرة اختيار
  أمام كلٍّ (على نسق تطبيق «آية»)، بدل قائمة منسدلة صغيرة. وتحت الاسم بخط صغير نوع التلاوة
  (مجوّد، المعلّم) لمن له ذلك وحده. ويُخفى منها القارئ الذي لا يشمل تسجيله المقدار الحالي.
*/
export default function ReciterPicker({ chosen, suras, onPick, onClose }) {
  useLayer(onClose);
  const shown = RECITERS.filter((r) => covers(r, suras));
  return (
    <div className="rcpick" role="dialog" aria-label="اختر القارئ">
      <header className="rcpick__head">
        <h2>القارئ</h2>
        <button type="button" className="rcpick__close" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="rcpick__list" role="radiogroup" aria-label="القارئ">
        {shown.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={r.id === chosen}
            className="rcpick__row"
            onClick={() => {
              onPick(r.id);
              onClose();
            }}
          >
            <span className="rcpick__text">
              <span className="rcpick__name">{r.name}</span>
              {styleLabel(r) && <span className="rcpick__style">{styleLabel(r)}</span>}
            </span>
            <span className="rcpick__radio" />
          </button>
        ))}
      </div>
    </div>
  );
}
