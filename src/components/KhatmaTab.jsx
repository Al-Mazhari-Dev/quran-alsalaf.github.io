import { useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { pageVerses } from '../lib/study.js';
import {
  DAY_PRESETS,
  DEFAULT_PLAN,
  PAGE_PRESETS,
  completeWird,
  dayKey,
  addDays,
  daysText,
  editWird,
  formatDates,
  pagesText,
  previewPlan,
  removeWird,
  startWird,
  useKhatma,
  wirdState,
} from '../lib/khatma.js';
import { FIRST_PAGE, LAST_PAGE } from '../lib/position.js';
import './Khatma.css';

/*
  تبويب «الختمة» في القائمة اليمنى (٢٠٢٦-١١-١٢): ختمة الورد اليومي (src/lib/khatma.js).
  • بلا ختمة: نموذج الإنشاء — بالأيام أو بالصفحات يوميا، ويظهر المقابل ويوم الختم قبل التأكيد.
  • أثناء الختمة: التقدم، وورد اليوم بزري «اقرأ الورد» (يفتح صفحة الختمة) و«أتممت الورد»،
    ويوم الختم المتوقع بالميلادي والهجري، وتعديل الخطة وحذف الختمة.
  • بعد الختم: تهنئة وزر «ابدأ ختمة جديدة».
*/
const n = toArabicDigits;

export default function KhatmaTab({ quran, onRead, onToast }) {
  const { wird, doneCount } = useKhatma();
  const [editing, setEditing] = useState(false);
  const today = dayKey();

  if (!wird || editing) {
    const state = wird && wirdState(wird, today);
    return (
      <PlanForm
        editing={!!wird}
        initial={wird ? { mode: wird.mode, value: wird.value } : DEFAULT_PLAN}
        from={state ? state.next : FIRST_PAGE}
        start={wird?.lastDone === today ? addDays(today, 1) : today}
        doneCount={doneCount}
        onSubmit={(mode, value) => {
          if (wird) {
            editWird(mode, value, today);
            onToast('عدلت الخطة');
          } else startWird(mode, value, today);
          setEditing(false);
        }}
        onCancel={wird ? () => setEditing(false) : null}
      />
    );
  }

  if (wird.finished) return <Finished date={wird.finished} doneCount={doneCount} />;
  return <Active quran={quran} wird={wird} today={today} doneCount={doneCount} onRead={onRead} onEdit={() => setEditing(true)} onToast={onToast} />;
}

// ---------- نموذج الإنشاء وتعديل الخطة ----------
function PlanForm({ editing, initial, from, start, doneCount, onSubmit, onCancel }) {
  const [mode, setMode] = useState(initial.mode);
  const presets = mode === 'days' ? DAY_PRESETS : PAGE_PRESETS;
  const [value, setValue] = useState(initial.value);
  const [custom, setCustom] = useState(!presets.includes(initial.value));
  const [draft, setDraft] = useState(custom ? String(initial.value) : '');
  const remaining = LAST_PAGE - from + 1;

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setValue(m === 'days' ? DEFAULT_PLAN.value : 5);
    setCustom(false);
    setDraft('');
  };
  // العدد المكتوب باليد: من ١ إلى عدد الصفحات الباقية (فلا يقل ورد اليوم عن صفحة)
  const typed = parseInt(draft.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
  const chosen = custom ? (typed >= 1 ? Math.min(typed, remaining) : null) : value;
  const plan = chosen ? previewPlan(mode, chosen, from, start) : null;
  const dates = plan && formatDates(plan.end);

  return (
    <div className="khatma">
      <section className="khatma__card">
        <h3 className="khatma__title">{editing ? 'تعديل الخطة' : 'ختمة جديدة'}</h3>
        {/* في الإنشاء بلا جملة شرح (بطلب صاحب المشروع)؛ وفي التعديل يبين ما يعاد تقسيمه */}
        {editing && (
          <p className="khatma__hint">{`يعاد تقسيم ما بقي (${pagesText(remaining, n)}، من الصفحة ${n(from)}) دون أن يضيع ما قرأته.`}</p>
        )}

        <div className="khatma__segment" role="radiogroup" aria-label="طريقة التحديد">
          <button type="button" role="radio" aria-checked={mode === 'days'} onClick={() => switchMode('days')}>
            بالأيام
          </button>
          <button type="button" role="radio" aria-checked={mode === 'pages'} onClick={() => switchMode('pages')}>
            بالصفحات يوميا
          </button>
        </div>

        <div className="khatma__chips" role="radiogroup" aria-label={mode === 'days' ? 'عدد الأيام' : 'عدد الصفحات يوميا'}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={!custom && value === p}
              onClick={() => {
                setCustom(false);
                setValue(p);
              }}
            >
              {mode === 'days' ? daysText(p, n) : pagesText(p, n)}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)}>
            عدد آخر
          </button>
        </div>

        {custom && (
          <label className="khatma__custom">
            <span>{mode === 'days' ? 'عدد الأيام' : 'عدد الصفحات يوميا'}</span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9٠-٩]/g, '').slice(0, 3))}
              placeholder={`١–${n(remaining)}`}
            />
          </label>
        )}

        {plan ? (
          <div className="khatma__summary" aria-live="polite">
            <p className="khatma__summaryMain">
              {daysText(plan.days, n)}، {mode === 'days' ? (plan.min === plan.max ? pagesText(plan.max, n) : `${n(plan.min)}–${n(plan.max)} صفحة`) : pagesText(chosen, n)} يوميا
            </p>
            <p className="khatma__date">
              <span>تختم يوم</span>
              <strong>{dates.gregorian}</strong>
              <strong>{dates.hijri}</strong>
            </p>
          </div>
        ) : (
          <p className="khatma__summary khatma__summary--empty">اكتب عددا من ١ إلى {n(remaining)}</p>
        )}

        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" disabled={!plan} onClick={() => onSubmit(mode, chosen)}>
            {editing ? 'حفظ الخطة' : 'ابدأ الختمة'}
          </button>
          {onCancel && (
            <button type="button" className="khatma__btn" onClick={onCancel}>
              إلغاء
            </button>
          )}
        </div>
      </section>
      {!editing && doneCount > 0 && <p className="khatma__count">أتممت {khatmasText(doneCount)} في هذا التطبيق</p>}
    </div>
  );
}

// ---------- أثناء الختمة ----------
function Active({ quran, wird, today, doneCount, onRead, onEdit, onToast }) {
  const s = wirdState(wird, today);
  const [confirm, setConfirm] = useState(false);
  const [a, b] = s.current;
  const dates = formatDates(s.end);
  const status = s.behind
    ? { text: `متأخر ${daysText(s.behind, n)} عن الخطة`, kind: 'behind' }
    : s.ahead
      ? { text: `متقدم على الخطة ${daysText(s.ahead, n)}`, kind: 'ahead' }
      : s.doneToday
        ? { text: 'أتممت ورد اليوم ✓', kind: 'done' }
        : { text: 'على الخطة', kind: 'on' };

  const complete = () => {
    if (completeWird(today) === 'next') onToast('أحسنت، سجل الورد');
  };

  return (
    <div className="khatma">
      <section className="khatma__card">
        <header className="khatma__head">
          <h3 className="khatma__title">ختمة الورد</h3>
          <span className="khatma__index">
            الورد {n(s.index)} من {n(s.total)}
          </span>
        </header>
        <div className="khatma__bar" role="progressbar" aria-label="تقدم الختمة" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent}>
          <span style={{ width: `${s.percent}%` }} />
        </div>
        <p className="khatma__progress">
          <strong>{n(s.percent)}٪</strong>، قرأت {n(s.read)} من {n(LAST_PAGE)} صفحة
        </p>
        <p className={`khatma__status khatma__status--${status.kind}`}>{status.text}</p>

        <div className="khatma__today">
          <span className="khatma__label">{s.doneToday ? 'الورد التالي' : 'ورد اليوم'}</span>
          <strong className="khatma__pages">{a === b ? `الصفحة ${n(a)}` : `من الصفحة ${n(a)} إلى ${n(b)}`}</strong>
          <span className="khatma__suras">
            {wirdSuras(quran, a, b)}، {pagesText(b - a + 1, n)}
          </span>
          <div className="khatma__actions">
            <button type="button" className="khatma__btn khatma__btn--primary" onClick={onRead}>
              اقرأ الورد
            </button>
            <button type="button" className="khatma__btn" onClick={complete}>
              أتممت الورد
            </button>
          </div>
        </div>

        <p className="khatma__date">
          <span>الختم المتوقع</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>

        <div className="khatma__footer">
          {confirm ? (
            <>
              <span>حذف الختمة وكل تقدمها؟</span>
              <button type="button" className="khatma__link khatma__link--danger" onClick={removeWird}>
                نعم، احذفها
              </button>
              <button type="button" className="khatma__link" onClick={() => setConfirm(false)}>
                لا
              </button>
            </>
          ) : (
            <>
              <button type="button" className="khatma__link" onClick={onEdit}>
                تعديل الخطة
              </button>
              <button type="button" className="khatma__link khatma__link--danger" onClick={() => setConfirm(true)}>
                حذف الختمة
              </button>
            </>
          )}
        </div>
      </section>
      {doneCount > 0 && <p className="khatma__count">أتممت قبلها {khatmasText(doneCount)}</p>}
    </div>
  );
}

// ---------- بعد الختم ----------
function Finished({ date, doneCount }) {
  const dates = formatDates(date);
  return (
    <div className="khatma">
      <section className="khatma__card khatma__card--done">
        <h3 className="khatma__title">أتممت الختمة</h3>
        <p className="khatma__hint">تقبل الله منك، وجعل القرآن ربيع قلبك.</p>
        <p className="khatma__date">
          <span>ختمت يوم</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>
        <p className="khatma__progress">أتممت {khatmasText(doneCount)} في هذا التطبيق</p>
        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" onClick={removeWird}>
            ابدأ ختمة جديدة
          </button>
        </div>
      </section>
    </div>
  );
}

// «ختمة واحدة» · «ختمتين» · «٣ ختمات» · «١١ ختمة»
function khatmasText(c) {
  if (c === 1) return 'ختمة واحدة';
  if (c === 2) return 'ختمتين';
  if (c >= 3 && c <= 10) return `${n(c)} ختمات`;
  return `${n(c)} ختمة`;
}

// سور الورد: من سورة أول آية فيه إلى سورة آخر آية
export function wirdSuras(quran, a, b) {
  const first = quran.verses[pageVerses(quran, a)[0]].s;
  const last = quran.verses[pageVerses(quran, b).at(-1)].s;
  const name = (s) => quran.suras[s - 1].name;
  return first === last ? name(first) : `${name(first)} – ${name(last)}`;
}
