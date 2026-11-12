import { useCallback, useState } from 'react';
import Reader from './Reader.jsx';
import { toArabicDigits } from '../data/quran.js';
import { spreadStart } from '../lib/layout.js';
import { useLayer } from '../lib/layers.js';
import { wirdSuras } from './KhatmaTab.jsx';
import './Khatma.css';

/*
  صفحة الختمة (٢٠٢٦-١١-١٢): يقرأ فيها ورد اليوم وحده، لا في المصحف. تفتح على أول صفحة في الورد،
  ولا يقلب إلا بين صفحاته (Reader بحدود الورد). وفي عرض الصفحتين تبهت صفحة الزوج الواقعة خارج الورد.
  وفي آخر صفحة من الورد يظهر زر «أتممت الورد». والقراءة هنا لا تغير آخر موضع حفظ في المصحف.
  والضغط المطول على آية يفتح مربعها كما في المصحف (بلا «تشغيل»: الاستماع من المصحف نفسه).
*/
const n = toArabicDigits;

export default function KhatmaPage({ quran, wird, next, onClose, onComplete, onLongPress, marks }) {
  const [a, b] = wird;
  const layer = useLayer(onClose);
  const [page, setPage] = useState(a);
  const [spread, setSpread] = useState(false);
  const onPage = useCallback((p) => setPage(p), []);
  const onSpread = useCallback((s) => setSpread(s), []);

  const count = b - a + 1;
  const shown = (spread ? [spreadStart(page), spreadStart(page) + 1] : [page]).filter((p) => p >= a && p <= b);
  const at = shown.map((p) => p - a + 1);
  const atEnd = shown.includes(b);
  const where =
    at.length > 1 ? `الصفحتان ${n(at[0])}–${n(at[1])} من ${n(count)}` : `الصفحة ${n(at[0] ?? 1)} من ${n(count)}`;

  return (
    <div className="kpage" role="dialog" aria-modal="true" aria-label="ورد الختمة">
      <header className="kpage__head">
        <button type="button" className="kpage__back" onClick={onClose} aria-label="رجوع">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="kpage__title">
          <h2>{next ? 'الورد التالي' : 'ورد اليوم'}</h2>
          <span>
            {where}، {wirdSuras(quran, a, b)}
          </span>
        </div>
      </header>

      <div className="kpage__reader">
        <Reader
          quran={quran}
          bounds={wird}
          startPage={a}
          persist={false}
          layer={layer}
          onPage={onPage}
          onSpread={onSpread}
          onLongPress={onLongPress}
          marks={marks}
          arrows
        />
      </div>

      <footer className="kpage__foot">
        {atEnd ? (
          <button type="button" className="khatma__btn khatma__btn--primary kpage__done" onClick={onComplete}>
            أتممت الورد ✓
          </button>
        ) : (
          <span className="kpage__hint">انتقل إلى الصفحة التالية</span>
        )}
      </footer>
    </div>
  );
}
