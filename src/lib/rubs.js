// أرباع الأحزاب (٢٠٢٦-١١-١٣): ٦٠ حزبًا في كل حزب أربعة أرباع، وأول آية في كل ربع في quran.rubs
// (scripts/data/08-rubs.mjs). وفي نص المصحف علامة «۞» قبل أول كلمة في الربع، إلا ما بدأ بأول سورة
// فإطار اسمها هو العلامة.
//
// التنبيه عند الوصول إلى صفحة فيها بداية ربع: رسالة قصيرة بنوعه، ووميض العلامة (أو إطار السورة)
// بلون التطبيق (MushafPage). ولا ترويسة للحزب ولا للربع (بقرار صاحب المشروع).
import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';

// نص التنبيه بحسب موضع الربع في حزبه (بطلب صاحب المشروع: هذه الأربع وحدها، بلا رقم الحزب)
export const RUB_MESSAGES = ['بداية الحزب', 'بداية ربع الحزب', 'بداية نصف الحزب', 'بداية ثلاثة أرباع الحزب'];
export const rubMessage = (i) => RUB_MESSAGES[i % 4];

export const hizbOf = (i) => Math.floor(i / 4) + 1;

// اسم الربع في فهرس الأرباع: «الحزب ٣» لأوله، ثم «ربع الحزب ٣» و«نصف …» و«ثلاثة أرباع …»
const PARTS = ['الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];
export const rubName = (i) => `${PARTS[i % 4]} ${toArabicDigits(hizbOf(i))}`;

const cache = new WeakMap();
// رقم الربع لكل آية يبدأ بها ربع: آية → رقم الربع (من ٠)
export function rubStarts(quran) {
  let m = cache.get(quran);
  if (!m) {
    m = new Map((quran.rubs ?? []).map((v, i) => [v, i]));
    cache.set(quran, m);
  }
  return m;
}

// الأرباع التي تبدأ في الصفحة، بترتيبها
export function rubsOnPage(quran, page) {
  return (quran.rubs ?? []).map((v, i) => (quran.verses[v].p === page ? i : -1)).filter((i) => i >= 0);
}

// أول كلمات الربع كما في فهارس المصاحف (بالرسم الإملائي)
export function rubOpening(quran, i, words = 4) {
  return quran.verses[quran.rubs[i]].e.split(/\s+/).slice(0, words).join(' ');
}

// أول آية في كل جزء من الثلاثين
export function juzStarts(quran) {
  const out = [];
  quran.verses.forEach((v, i) => {
    if (out.length < v.j) out.push(i);
  });
  return out;
}

// مهلة احتياطية لزوال الوميض إن لم يُرسم (كتعذّر خط الصفحة)
const FALLBACK_MS = 12000;

/*
  التنبيه عند الوصول إلى صفحة فيها بداية ربع. pages: الصفحات الظاهرة الآن (صفحة أو صفحتان).
  يُنبَّه بما ظهر حديثًا منها فقط، لا بما كان ظاهرًا قبل (كتبديل العرض بين صفحة وصفحتين).
  ولا تنبيه عند أول ظهور بعد تعطيله (enabled = false، كأول فتح للتطبيق ووضع القراءة)، إلا أن يُطلب
  (initial، كصفحة الورد: فتحها انتقال إلى أول الورد).
  يرجع { verses: [أول آية في كل ربع يومض]، n } أو null.
*/
export function useRubAlert({ quran, pages, enabled = true, initial = false, onToast }) {
  const [flash, setFlash] = useState(null);
  const prev = useRef(null);
  const key = pages.join(',');

  useEffect(() => {
    if (!quran || !enabled) {
      prev.current = null;
      return;
    }
    const before = prev.current ?? (initial ? [] : pages);
    prev.current = pages;
    const fresh = pages.filter((p) => !before.includes(p));
    const found = fresh.flatMap((p) => rubsOnPage(quran, p));
    if (!found.length) return;
    onToast?.(rubMessage(found[0]));
    setFlash({ verses: found.map((i) => quran.rubs[i]), n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quran, key, enabled]);

  // يزول بنهاية تلاشي الوميض (MushafPage.css)، وإلا بعد مهلة احتياطية
  useEffect(() => {
    if (!flash) return undefined;
    const end = () => setFlash((f) => (f === flash ? null : f));
    const onEnd = (e) => e.animationName.startsWith('rub-flash') && end();
    document.addEventListener('animationend', onEnd);
    const timer = setTimeout(end, FALLBACK_MS);
    return () => {
      document.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
    };
  }, [flash]);

  return flash;
}
