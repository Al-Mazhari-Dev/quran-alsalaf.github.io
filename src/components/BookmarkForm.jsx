import { useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { AYAT, countText } from '../lib/count.js';
import { verseLabel } from '../lib/study.js';
import { BOOKMARK_HUES, colorName } from '../lib/userdata.js';
import './BookmarkForm.css';

/*
  إعدادات العلامة المرجعية (٢٠٢٦-١١-١٤): الاسم، والنوع (متنقّلة أو متعددة)، واللون من ٤٠ لونًا جاهزًا
  (عشرة ألوان أساسية في أعمدة، لكلٍّ أربع درجات من الفاتح إلى الغامق)، ومعاينة صغيرة لآية مظلَّلة
  باللون المختار على خلفية القراءة الحالية — كما تظهر في المصحف (MushafPage.css: .w--mark).
  تُستعمل لإنشاء علامة من مربع الآية (VerseMenu)، ولتعديلها من القائمة الجانبية (SideMenu).
*/
export const TYPES = [
  { multi: false, name: 'متنقّلة', hint: 'في آية واحدة، وتنتقل إلى حيث تضعها' },
  { multi: true, name: 'متعددة', hint: 'في آيات كثيرة، ولا يزول منها شيء' },
];
export const typeName = (multi) => TYPES[multi ? 1 : 0].name;

// وصف العلامة تحت اسمها: نوعها وموضعها (المتنقّلة) أو عدد آياتها (المتعددة)
export function bookmarkMeta(quran, b) {
  if (!b.verses.length) return `${typeName(b.multi)} · بلا آيات`;
  if (!b.multi) return `${typeName(false)} · ${verseLabel(quran, [b.verses[0].v])}`;
  return `${typeName(true)} · ${countText(b.verses.length, AYAT, toArabicDigits, true)}`;
}

export default function BookmarkForm({ initial, submitLabel, onSubmit, onCancel, children }) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [multi, setMulti] = useState(Boolean(initial.multi));
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color, multi });
  };

  return (
    <form className="bmform" onSubmit={submit}>
      <label className="bmform__field">
        <span className="bmform__label">الاسم</span>
        <input className="bmform__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="اسم العلامة" />
      </label>

      <div className="bmform__field">
        <span className="bmform__label" id="bmform-type">
          النوع
        </span>
        <div className="bmform__types" role="radiogroup" aria-labelledby="bmform-type">
          {TYPES.map((t) => (
            <button key={t.name} type="button" role="radio" aria-checked={multi === t.multi} onClick={() => setMulti(t.multi)}>
              <strong>{t.name}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="bmform__field">
        <span className="bmform__label" id="bmform-color">
          اللون
        </span>
        <div className="bmform__palette" role="radiogroup" aria-labelledby="bmform-color">
          {BOOKMARK_HUES.map((hue, h) =>
            hue.shades.map((c, s) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={colorName(h, s)}
                className="bmform__swatch"
                style={{ background: c, gridColumn: h + 1, gridRow: s + 1 }}
                onClick={() => setColor(c)}
              />
            ))
          )}
        </div>
      </div>

      <div className="bmform__field">
        <span className="bmform__label">معاينة</span>
        <p className="bmform__preview" data-testid="bookmark-preview">
          <span style={{ '--mark': color }}>ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ</span>
        </p>
      </div>

      {children}

      <div className="bmform__actions">
        <button type="submit" className="bmform__submit" disabled={!name.trim()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="bmform__cancel" onClick={onCancel}>
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
