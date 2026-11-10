import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import './RangePicker.css';
import { useLayer } from '../lib/layers.js';

/*
  قائمة اختيار آية لتحديد النطاق (الفصل ٤): تمرير مستمر — السور بعناوينها، وتحت كل سورة
  آياتها مرقّمة مع معاينة قصيرة لأولها. وتُفتح عند سورة الموضع الحالي. وعند اختيار آية
  النهاية لا يُعرض ما قبل آية البداية.

  القائمة الكاملة ٦٢٣٦ آية، فبناء أزرارها كلها دفعة واحدة عند الفتح يُجمّد الصفحة لثوانٍ
  (تجربة فعلية على الجوال). فتُبنى أزرار سورة واحدة فقط أول الأمر (سورة الموضع الحالي)،
  وبقية السور تُبنى تباعًا متى اقتربت من الشاشة أثناء التمرير (IntersectionObserver)، مع
  حفظ ارتفاعها التقريبي (containIntrinsicSize) قبل ذلك حتى لا يقفز شريط التمرير.

  والمُلاحَظ («React.StrictMode» بوضع التطوير فقط): مراقبة كل سورة من مرجعها (ref) مباشرة،
  مع فصل تفكيكها (disconnect) في useEffect منفصل، يجعل «الوضع الصارم» يُفكِّك المراقبة فور
  التركيب (يُشغِّل كل تفكيك مرة تجريبية) بلا من يعيدها — فتُشلّ القائمة كليًّا بعد أول رسم
  (لوحظ فعلياً: لا سطر يُبنى بعد الأول أبداً). فالمراقبة والتفكيك كلاهما في نفس الأثر (useEffect
  بلا اعتماديات)، ليعيد «الوضع الصارم» بناءهما معاً سواءً.
*/
const PREVIEW_WORDS = 7;

export default function RangePicker({ quran, mode, start, near, onPick, onClose, title }) {
  useLayer(onClose);
  const listRef = useRef(null);
  const firstSura = mode === 'end' ? quran.verses[start].s : 1;
  const heading = title ?? (mode === 'end' ? 'اختر آية النهاية' : 'اختر آية البداية');
  const targetSura = quran.verses[mode === 'end' ? start : near].s;

  // الآيات مجموعة بالسور (مرة واحدة)
  const suras = useMemo(() => {
    const out = [];
    quran.verses.forEach((v, i) => {
      if (v.a === 1) out.push({ s: v.s, from: i });
    });
    return out.map((x, k) => ({ ...x, to: (out[k + 1]?.from ?? quran.verses.length) - 1 })).filter((x) => x.s >= firstSura);
  }, [quran, firstSura]);

  // السورة المستهدفة تُبنى فورًا (لتصحّ scrollIntoView)، وبقيتها عند الحاجة
  const [built, setBuilt] = useState(() => new Set([targetSura]));

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector(`[data-sura="${targetSura}"]`);
    el?.scrollIntoView({ block: 'start' });
  }, [targetSura]);

  // مراقبة كل السور دفعة واحدة بعد الرسم الأول (لا مرجعًا لكل سورة)، فيبقى الإعداد والتفكيك
  // في أثر واحد يُعاد كلاهما معًا سليمين لو أعاد «الوضع الصارم» تشغيلهما تجريبيًا
  useEffect(() => {
    const sections = listRef.current?.querySelectorAll('.rpick__sura') ?? [];
    const obs = new IntersectionObserver(
      (entries) => {
        const found = entries.filter((e) => e.isIntersecting).map((e) => Number(e.target.dataset.sura));
        if (!found.length) return;
        setBuilt((prev) => {
          const next = new Set(prev);
          found.forEach((s) => next.add(s));
          return next;
        });
      },
      { rootMargin: '400px 0px' }
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [suras]);

  return (
    <div className="rpick" role="dialog" aria-label={heading}>
      <header className="rpick__head">
        <h2>{heading}</h2>
        <button type="button" className="rpick__close" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="rpick__list" ref={listRef}>
        {suras.map(({ s, from, to }) => {
          const begin = mode === 'end' && s === firstSura ? start : from;
          const count = to - begin + 1;
          return (
            <section key={s} className="rpick__sura" data-sura={s} style={{ containIntrinsicSize: `auto ${count * 52 + 48}px` }}>
              <h3>
                سورة {quran.suras[s - 1].name}
                <span>{toArabicDigits(quran.suras[s - 1].count)} آية</span>
              </h3>
              {built.has(s) &&
                Array.from({ length: count }, (_, i) => begin + i).map((v) => (
                  <button key={v} type="button" className="rpick__verse" onClick={() => onPick(v)}>
                    <span className="rpick__num">{toArabicDigits(quran.verses[v].a)}</span>
                    <span className="rpick__text">{quran.verses[v].e.split(' ').slice(0, PREVIEW_WORDS).join(' ')}…</span>
                  </button>
                ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
