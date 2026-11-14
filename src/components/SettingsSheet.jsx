import { useEffect, useRef, useState } from 'react';
import { ACCENTS, BACKGROUNDS, readAppearance, setAccent, setBackground } from '../lib/appearance.js';
import { readRubAlert, readWeeksTint, setRubAlert, setWeeksTint } from '../lib/settings.js';
import AboutContent from './AboutPage.jsx';
import './SettingsSheet.css';
import { useLayer } from '../lib/layers.js';

/*
  الإعدادات (٢٠٢٦-١١-١١): لوحة جانبية تنزلق من الحافة اليسرى فوق المصحف، مقابل القائمة الجانبية
  في اليمين وعلى نسقها (الحركة والألوان والخلفية المعتمة). اليمين لإدارة الأشياء (السور والملاحظات
  والعلامات)، واليسار للإعدادات والميزات.
  تُغلق بزرّ ✕، وبالنقر خارجها، وبسحبها نحو اليسار (إصبعًا أو فأرة)، وبـEsc، وبزرّ الرجوع في أندرويد
  (فتحها يضيف خطوة إلى سجل المتصفح — App.jsx).
  «عن التطبيق» صفحة فرعية داخل اللوحة نفسها بسهم رجوع.

  إضافة إعداد أو ميزة جديدة: سطر في قسمه بأحد الأسطر الجاهزة أدناه
  (SegmentRow للاختيار من خيارات، SwatchRow للاختيار من ألوان، SwitchRow للتشغيل والإيقاف،
  LinkRow لما يفتح شيئًا)،
  أو قسم جديد بـ<Section title="…">. (حجم خط التطبيق أُلغي ٢٠٢٦-٠٩-٢٥ بطلب صاحب المشروع)
*/

// السحب نحو اليسار: يبدأ بعد هذه المسافة أفقيًا، ويُغلق إن تجاوز هذا الجزء من عرض اللوحة أو كان سريعًا
const DRAG_START = 8;
const CLOSE_RATIO = 0.3;
const FLING_SPEED = 0.5; // px/ms

export default function SettingsSheet({ open, panel, page = 'main', onPage, onClose, onStartReading }) {
  const [look, setLook] = useState(readAppearance);
  const [weeks, setWeeks] = useState(readWeeksTint);
  const [rubAlert, setRubAlertOn] = useState(readRubAlert);
  const sub = page !== 'main';

  // Esc في الصفحة الفرعية يرجع إلى الإعدادات، وفي الإعدادات يغلق اللوحة
  useLayer(() => (sub ? onPage('main') : onClose()), open);

  // المظهر يُطبَّق فورًا ويُحفظ محليًّا (src/lib/appearance.js)
  const chooseBackground = (id) => setLook(setBackground(id));
  const chooseAccent = (id) => setLook(setAccent(id));
  // دوائر «لون التطبيق» بالدرجة التي ستظهر فعلًا على الخلفية المختارة
  const darkBg = BACKGROUNDS.find((b) => b.id === look.bg)?.dark;

  const toggleWeeks = () => {
    setWeeksTint(!weeks);
    setWeeks(!weeks);
  };

  const toggleRubAlert = () => {
    setRubAlert(!rubAlert);
    setRubAlertOn(!rubAlert);
  };

  const card = useDragToClose(onClose, open);

  return (
    <div
      className={`settings${open ? ' settings--open' : ''}${panel ? ' settings--panel' : ''}`}
      aria-hidden={!open}
      inert={open ? undefined : ''}
    >
      <div className="settings__backdrop" onClick={onClose} />
      <section ref={card} className="settings__card" role="dialog" aria-modal="true" aria-label="الإعدادات">
        <div className={`settings__page${sub ? ' settings__page--behind' : ''}`} inert={sub ? '' : undefined}>
          <header className="settings__head">
            <h2>الإعدادات</h2>
            <CloseButton onClick={onClose} />
          </header>

          <div className="settings__body">
            <Section title="المظهر">
              <SwatchRow
                label="خلفية القراءة"
                value={look.bg}
                options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.name, color: b.bg, mark: b.ink }))}
                onChange={chooseBackground}
              />
              <SwatchRow
                label="لون التطبيق"
                value={look.accent}
                options={ACCENTS.map((a) =>
                  // «بلا لون»: دائرة نصفها فاتح ونصفها غامق تميّزه عن الألوان، والصح فوقها بلون يعاكس ما تحته
                  a.ink
                    ? { value: a.id, label: a.name, color: 'linear-gradient(135deg, #fff 50%, #2b2b2e 50%)', split: true }
                    : { value: a.id, label: a.name, color: darkBg ? a.dark : a.light }
                )}
                onChange={chooseAccent}
              />
            </Section>

            <Section title="القراءة">
              <LinkRow label="وضع القراءة" onClick={onStartReading} />
              <SwitchRow label="تمييز مقررات الأسابيع" checked={weeks} onChange={toggleWeeks} />
              <SwitchRow label="التنبيه ببداية الربع" checked={rubAlert} onChange={toggleRubAlert} />
            </Section>

            <Section>
              <LinkRow label="عن التطبيق" onClick={() => onPage('about')} />
            </Section>
          </div>
        </div>

        {/* الصفحة الفرعية تدخل من اليسار فوق الإعدادات، وسهم الرجوع في أولها (يمينًا) */}
        <div className={`settings__page settings__page--sub${page === 'about' ? ' settings__page--in' : ''}`} inert={page === 'about' ? undefined : ''}>
          <header className="settings__head">
            <button className="settings__back" type="button" onClick={() => onPage('main')} aria-label="رجوع">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2>عن التطبيق</h2>
            <CloseButton onClick={onClose} />
          </header>
          <div className="settings__body">
            <AboutContent />
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- لبنات الأقسام والأسطر ----------

function Section({ title, children }) {
  return (
    <section className="settings__section">
      {title && <h3 className="settings__sectionTitle">{title}</h3>}
      <div className="settings__group">{children}</div>
    </section>
  );
}

function SegmentRow({ label, value, options, onChange }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <div className="settings__segment" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// صفّ دوائر ملوّنة بلا أسماء مكتوبة (بطلب صاحب المشروع)؛ واسم كل لون لقارئ الشاشة وتلميح الفأرة. والمختارة بحلقة بلون التطبيق وعلامة صح؛ و`mark` لون علامة الصح
// إن لم تكن بلون نص الزر الملوّن (في دوائر الخلفيات: بلون نص المصحف عليها)
function SwatchRow({ label, value, options, onChange }) {
  return (
    <div className="settings__row settings__row--stack">
      <span className="settings__label">{label}</span>
      <div
        className="swatches"
        role="radiogroup"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`swatch${o.split ? ' swatch--split' : ''}`}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
          >
            <span className="swatch__dot" style={{ background: o.color, color: o.mark }}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <button className="settings__switch" type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
        <span />
      </button>
    </div>
  );
}

function LinkRow({ label, onClick }) {
  return (
    <button type="button" className="settings__row settings__link" onClick={onClick}>
      <span className="settings__label">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__chevron">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function CloseButton({ onClick }) {
  return (
    <button className="settings__close" type="button" onClick={onClick} aria-label="إغلاق">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// سحب اللوحة نحو اليسار بالإصبع أو الفأرة: تتبع اليد، فإن جاوزت حدًّا أو نُفضت أُغلقت، وإلا عادت.
// السحب الرأسي يبقى تمريرًا عاديًا (touch-action: pan-y)، والنقرة بعد سحب لا تُحسب ضغطًا على زر
function useDragToClose(onClose, open) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return undefined;
    let start = null; // { x, y, t, id }
    let dragging = false;
    let dx = 0;
    let suppressClick = false;

    const reset = () => {
      el.style.transform = '';
      el.classList.remove('settings__card--drag');
      start = null;
      dragging = false;
      dx = 0;
    };
    const onDown = (e) => {
      if (e.button !== 0 || start) return;
      if (e.target.closest?.('input, textarea, select')) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      suppressClick = false;
    };
    const onMove = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const mx = e.clientX - start.x;
      const my = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(mx) < DRAG_START && Math.abs(my) < DRAG_START) return;
        // رأسي أو نحو اليمين: ليس سحب إغلاق
        if (Math.abs(my) > Math.abs(mx) || mx > 0) {
          start = null;
          return;
        }
        dragging = true;
        el.classList.add('settings__card--drag');
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // بلا التقاط: يكفي تتبع الحركة فوق اللوحة
        }
      }
      dx = Math.min(0, mx);
      el.style.transform = `translateX(${dx}px)`;
      e.preventDefault();
    };
    const onUp = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!dragging) {
        start = null;
        return;
      }
      const speed = -dx / Math.max(1, performance.now() - start.t);
      const close = -dx > el.offsetWidth * CLOSE_RATIO || speed > FLING_SPEED;
      suppressClick = true;
      el.classList.remove('settings__card--drag');
      if (close) {
        // تكمل الانزلاق من موضعها إلى الخارج بانتقال اللوحة المعتاد
        el.style.transform = '';
        closeRef.current();
      } else {
        el.style.transform = '';
      }
      start = null;
      dragging = false;
      dx = 0;
    };
    const onClick = (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('click', onClick, true);
    return () => {
      reset();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', reset);
      el.removeEventListener('click', onClick, true);
    };
  }, [open]);

  return ref;
}
