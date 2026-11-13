import { useEffect } from 'react';
import { covers, groupReciters, reciterTitle, RECITERS } from '../lib/reciters.js';
import { previewReciter, stopPreview, usePlayer } from '../lib/player.js';
import './ReciterPicker.css';
import { useLayer } from '../lib/layers.js';

/*
  قائمة اختيار القارئ (الفصل ٦): صفحة كاملة تنزلق من الأسفل، بقائمة قرّاء ودائرة اختيار
  أمام كلٍّ (على نسق تطبيق «آية»)، بدل قائمة منسدلة صغيرة. مقسَّمة إلى مجموعات بعناوين (مجوّد، معلّم،
  مرتّل) بحسب حقل group في src/data/reciters.json، فلا يُكتب تحت الاسم شيء. ويُخفى منها القارئ الذي لا
  يشمل تسجيله المقدار الحالي.
  وفي كل صف زرّ معاينة (٢٠٢٦-١١-١٣) بين الاسم ودائرة الاختيار: يُسمِع «الحمد لله رب العالمين» بصوت
  القارئ (previewReciter في src/lib/player.js) ولا يختاره ولا يغلق القائمة؛ وإغلاق القائمة أو اختيار قارئ
  يوقف المعاينة. أزرار الصف (المعاينة، وزرّ التحميل لاحقًا) في .rcpick__tools فوق زرّ الاختيار.
*/
export default function ReciterPicker({ chosen, suras, onPick, onClose, onToast }) {
  useLayer(onClose);
  const { preview } = usePlayer();
  useEffect(() => stopPreview, []);
  const shown = RECITERS.filter((r) => covers(r, suras));

  const togglePreview = (r) => {
    if (preview?.id === r.id) stopPreview();
    else previewReciter(r.id, () => onToast?.('تعذّر تشغيل المعاينة'));
  };

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
      <div className="rcpick__list">
        {groupReciters(shown).map((g) => (
          <section key={g.id} className="rcpick__group" role="radiogroup" aria-labelledby={`rcpick-${g.id}`}>
            <h3 id={`rcpick-${g.id}`} className="rcpick__group-title">
              {g.title}
            </h3>
            {g.reciters.map((r) => {
              const on = preview?.id === r.id;
              return (
                <div key={r.id} className="rcpick__item">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={r.id === chosen}
                    className="rcpick__row"
                    onClick={() => {
                      stopPreview();
                      onPick(r.id);
                      onClose();
                    }}
                  >
                    <span className="rcpick__name">{r.name}</span>
                    <span className="rcpick__radio" />
                  </button>
                  <div className="rcpick__tools">
                    <button
                      type="button"
                      className={`rcpick__preview${on ? ' rcpick__preview--on' : ''}`}
                      aria-label={on ? 'إيقاف المعاينة' : `معاينة صوت ${reciterTitle(r)}`}
                      title={on ? 'إيقاف المعاينة' : 'معاينة الصوت'}
                      onClick={() => togglePreview(r)}
                    >
                      {on && preview.status === 'loading' ? (
                        <span className="rcpick__spin" aria-hidden="true" />
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          {on ? <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /> : <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />}
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
