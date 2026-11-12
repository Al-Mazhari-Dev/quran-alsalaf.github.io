import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { AYAT, countNoun } from '../lib/count.js';
import './RangePicker.css';
import { useLayer } from '../lib/layers.js';

/*
  قائمة اختيار آية (الفصل ٤): لتحديد مقدار الاستماع ومقدار صفحات المحتوى ونقل العلامة.
  السور مطوية بأسمائها، وبجانب كل سورة سهم يفتح آياتها (مرقّمة مع معاينة قصيرة لأولها) ويطويها
  (٢٠٢٦-١١-١٢، بطلب صاحب المشروع، بدل القائمة الممتدة بكل الآيات). وسورة واحدة مفتوحة في كل
  مرة: فتح سورة يطوي التي قبلها. وعند الفتح تكون سورة الموضع الحالي مفتوحة وظاهرة (وفي اختيار
  النهاية سورة آية البداية)، ولا يُعرض في اختيار النهاية ما قبل آية البداية.

  وأكبر ما يُبنى من الأزرار سورة واحدة (٢٨٦ آية في البقرة)، فلا حاجة لبنائها تباعًا عند التمرير.
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

  // السورة المفتوحة (أو null إن طُويت كلها)
  const [open, setOpen] = useState(targetSura);
  const toggle = (s) => setOpen((o) => (o === s ? null : s));

  // السورة المفتوحة يُمرَّر إلى عنوانها: عند الفتح، وعند فتح غيرها (فطيّ ما فوقها لا يُبعده عن الشاشة)
  useLayoutEffect(() => {
    if (open == null) return;
    listRef.current?.querySelector(`[data-sura="${open}"]`)?.scrollIntoView({ block: 'start' });
  }, [open]);

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
          const expanded = open === s;
          return (
            <section key={s} className={`rpick__sura${expanded ? ' rpick__sura--open' : ''}`} data-sura={s}>
              <h3>
                <button type="button" className="rpick__toggle" aria-expanded={expanded} onClick={() => toggle(s)}>
                  <span className="rpick__name">سورة {quran.suras[s - 1].name}</span>
                  <span className="rpick__count">{toArabicDigits(quran.suras[s - 1].count)} {countNoun(quran.suras[s - 1].count, AYAT)}</span>
                  <svg className="rpick__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </h3>
              {expanded &&
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
