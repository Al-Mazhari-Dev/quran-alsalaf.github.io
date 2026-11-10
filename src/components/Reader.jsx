import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import MushafPage from './MushafPage.jsx';
import { pageInfo, toArabicDigits } from '../data/quran.js';
import { SURA_NAMES_VOWELED } from '../data/suraNamesVoweled.js';
import { SPREAD_GUTTER, isScrollMode, isSpreadMode, pageLayout, spreadArea, spreadStart } from '../lib/layout.js';
import { hasOpenLayer } from '../lib/layers.js';
import { prefetchPageFonts, usePageFont } from '../lib/qcfFonts.js';
import { FIRST_PAGE, LAST_PAGE, readLastPage, saveLastPage } from '../lib/position.js';
import './Reader.css';

/*
  قارئ المصحف: صفحة واحدة تملأ الشاشة، والتنقل بالسحب وحده (الفصل ٢).

  الاتجاه كالمصحف الورقي (بقرار صاحب المشروع): الصفحة التالية تقع على يسار
  الحالية، فللتقدّم يُحرَّك الإصبع من اليسار نحو اليمين فتدخل التالية من اليسار.
  وبالعكس للسابقة.

  وفي الشاشات الكبيرة (٢٠٢٦-١١-١٠) تُعرض صفحتان متقابلتان كالمصحف المفتوح: الفردية يمينًا
  والزوجية يسارًا (١–٢، ٣–٤، … ٦٠٣–٦٠٤)، ويُقلَّب زوجًا كاملًا. ومتى يُعرض الزوج يحدده
  حجم المساحة (src/lib/layout.js). وحالة الصفحة رقمُ صفحة واحدة دائمًا (آخر موضع)، فإذا
  ضاقت النافذة عاد عرض الصفحة الواحدة على الصفحة نفسها.

  تُرسم ثلاث صفحات (أو ثلاثة أزواج) متجاورة (السابقة والحالية والتالية) على شريط واحد يتحرك مع
  الإصبع، فتظهر الصفحة المجاورة أثناء السحب لا بعده. والشريط يُحرَّك مباشرة
  في DOM لا عبر حالة React، لتبقى الحركة سلسة ٦٠ إطارًا في الثانية.
*/

const TURN_RATIO = 0.22; // نسبة عرض الشاشة التي يكفي السحب إليها لقلب الصفحة
const FLICK_SPEED = 0.45; // بكسل/مللي ثانية: سحبة سريعة قصيرة تكفي لقلب الصفحة
const FLICK_MIN_PX = 48; // ولا تُعدّ نفضةً ما قصرت عن هذا، مهما كانت سرعتها
const VELOCITY_WINDOW_MS = 100; // تُحسب السرعة على آخر هذه المدّة من السحب
const TURN_MS = 280;
const EDGE_RESISTANCE = 0.25; // عند أول المصحف وآخره تتحرك الصفحة ربع حركة الإصبع

// أجزاء ورقة الصفحة: الترويسة (وفيها رقم الصفحة)، ثم الأسطر. والهامش الجانبي يسير جدًّا
// ليملأ المصحف الشاشة (بطلب صاحب المشروع)
const META_H = 30;
// اسم الجزء في الترويسة برقمه لا بلفظه (بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٤)
const juzLabel = (j) => `الجزء ${toArabicDigits(j)}`;
// الترويسة بلا تشكيل (بطلب صاحب المشروع)
const stripTashkeel = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
const PAD_X = 3;

// لمسة خفيفة (بلا سحب) تُظهر الخانتين السفليتين أو تخفيهما: أقصر من هذه المدّة
const TAP_MS = 350;

// الضغط المطوّل على آية (الفصل ٤): إبقاء الإصبع عليها بلا حركة هذه المدة
const LONG_PRESS_MS = 450;

// onColumn: يُبلَّغ به عرض عمود الأسطر، ليُحاذى به الشريط العلوي فوقه
// onPage: يُبلَّغ بالصفحة الحالية (نطاق صفحات المحتوى والاستماع)
// (صفحات المحتوى لا تُفتح بالسحب منذ ٢٠٢٦-١١-١٠: بزرّها في الشريط السفلي وحده)
// onLongPress(آية، مستطيل كلمتها): ضغط مطوّل على آية
// goto { page, n }: انتقال إلى صفحة بطلب من خارج القارئ (كاختيار آية من قائمة النطاق)
// marks: إشارات بيانات المستخدم على الآيات (MushafPage)
// onSpread(bool): يُبلَّغ به هل تُعرض الصفحتان معًا
// arrows: إظهار سهمي التقليب على جانبي الزوج (عند تحريك الفأرة) — في عرض الصفحتين وحده
export default function Reader({ quran, onTap, onColumn, onPage, onSpread, onLongPress, goto, marks, arrows }) {
  const [page, setPage] = useState(readLastPage);
  const [box, setBox] = useState(null);
  // الجوال الأفقي (٢٠٢٦-١٠-١٧): تملأ الصفحةُ العرضَ وتُمرَّر رأسيًّا داخل نفسها (src/lib/layout.js)
  const scroll = isScrollMode(box);
  const area = box && { w: box.w - PAD_X * 2, h: box.h - META_H };
  const spread = isSpreadMode(quran, box, area, META_H);
  // وحدة التقليب: صفحة، أو زوج يبدأ بالصفحة الفردية
  const step = spread ? 2 : 1;
  const base = spread ? spreadStart(page) : page;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (goto?.page) setPage(goto.page);
  }, [goto]);

  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const drag = useRef(null);
  const offset = useRef(0);
  const pendingDir = useRef(0);
  const animating = useRef(false);
  // إن لم يصل حدث انتهاء الحركة (كأن تُخفى النافذة أثناءها) أُتمّت بعد مدّتها،
  // لئلا تبقى الصفحة معلّقة في منتصف القلب
  const fallback = useRef(0);

  useLayoutEffect(() => {
    const el = viewRef.current;
    // القياس الأول فوري من التخطيط نفسه، فتُرسم الصفحة في أول إطار بعد شاشة الافتتاح.
    // ولا يُكتفى بمراقب الحجم، لأنه لا يُبلّغ إلا مع رسم الإطارات. ثم يتابع المراقب أي تغيّر
    // (كتدوير الجهاز أو ظهور شريط المتصفح)، ولا يعيد الرسم إن لم يتغيّر الحجم فعلًا.
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setBox({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    saveLastPage(page);
    onPage?.(page);
  }, [page, onPage]);
  // الصفحتان المجاورتان تُرسمان على الشريط فيُنزَّل خطّاهما معهما، ويُنزَّل ما بعدهما مسبقًا
  // وفي الزوج: الزوجان المجاوران يُرسمان، ويُنزَّل خطّا ما بعدهما مسبقًا
  useEffect(
    () => prefetchPageFonts(spread ? [base + 4, base + 5, base - 4, base - 3] : [page + 2, page - 2]),
    [page, base, spread]
  );
  useEffect(() => {
    onSpread?.(spread);
  }, [spread, onSpread]);
  useEffect(() => () => clearTimeout(fallback.current), []);

  const moveTrack = useCallback((x, animate) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${TURN_MS}ms cubic-bezier(0.2, 0.8, 0.25, 1)` : 'none';
    el.style.transform = `translate3d(${x}px, 0, 0)`;
    offset.current = x;
  }, []);

  // بعد تبدّل الصفحة يعود الشريط إلى موضعه قبل أن يُرسم الإطار التالي،
  // فتحلّ الصفحة الجديدة محلّ المجاورة بلا وميض
  useLayoutEffect(() => moveTrack(0, false), [base, box, spread, moveTrack]);

  const canTurn = (dir) => (dir > 0 ? base + step <= LAST_PAGE : base - step >= FIRST_PAGE);
  // في الزوج يُنتقل من صفحته اليمنى إلى يمنى الزوج المجاور
  const turned = (p, d) => {
    const s = stepRef.current;
    return Math.min(LAST_PAGE, Math.max(FIRST_PAGE, (s === 2 ? spreadStart(p) : p) + d * s));
  };

  // dir: ‎+1 التالية (الشريط يتحرك يمينًا)، ‎-1 السابقة، ‎0 العودة إلى الموضع
  const settle = useCallback(
    (dir) => {
      if (!box) return;
      const d = dir && canTurn(dir) ? dir : 0;
      pendingDir.current = d;
      const target = d * box.w;
      if (Math.abs(target - offset.current) < 0.5) {
        finish();
        return;
      }
      animating.current = true;
      moveTrack(target, true);
      clearTimeout(fallback.current);
      fallback.current = setTimeout(finish, TURN_MS + 120);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box, page, step, moveTrack]
  );

  // تُستدعى مرة عند انتهاء الحركة، وقد تُستدعى ثانية من المؤقت الاحتياطي فلا تفعل شيئًا
  function finish() {
    clearTimeout(fallback.current);
    animating.current = false;
    const d = pendingDir.current;
    pendingDir.current = 0;
    if (d) setPage((p) => turned(p, d));
  }

  const onTransitionEnd = (e) => {
    if (e.target === trackRef.current && e.propertyName === 'transform') finish();
  };

  // لمسة أثناء حركة القلب: تُتمّ القلبة الجارية فورًا بدل أن تُتجاهل اللمسة.
  // فحركة القلب سريعة أولها بطيء آخرها، فتبدو الصفحة قد وصلت وهي تُكمل ذيلها، فكان
  // السحب الثاني يضيع فيه. والآن تُرسم الصفحة الجديدة في مكانها قبل أن يتحرك الإصبع
  // (flushSync)، فيبدأ السحب الجديد منها مباشرة، ويُقلَّب المصحف متتابعًا بلا انتظار.
  function completeNow() {
    clearTimeout(fallback.current);
    animating.current = false;
    const d = pendingDir.current;
    pendingDir.current = 0;
    if (d) flushSync(() => setPage((p) => turned(p, d)));
    else moveTrack(0, false); // كانت عودةً إلى الموضع (سحبة لم تكتمل): تتوقف
  }

  // ---------- السحب ----------
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (animating.current) completeNow();
    const d = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: e.timeStamp, axis: null, samples: [{ x: e.clientX, t: e.timeStamp }] };
    drag.current = d;
    // ضغط مطوّل على كلمة من آية: يُبدأ عدّه، ويُلغى إن تحرك الإصبع أو رُفع قبله
    const word = e.target.closest?.('.w[data-v]');
    if (word && onLongPress) {
      d.press = setTimeout(() => {
        if (drag.current !== d || d.axis) return;
        d.longPressed = true;
        onLongPress(+word.dataset.v, word.getBoundingClientRect());
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (d.longPressed) return;
      clearTimeout(d.press);
      // في التمرير الرأسي تُشترط غلبة الأفقي بوضوح، فلا تنقلب الصفحة بالخطأ أثناء النزول بالإصبع
      d.axis = Math.abs(mx) > Math.abs(my) * (scroll ? 1.5 : 1) ? 'x' : 'y';
      if (d.axis) {
        try {
          viewRef.current.setPointerCapture(e.pointerId);
        } catch {
          // بعض المتصفحات ترفض الالتقاط لمؤشر انتهى — لا يلزم للسحب
        }
      }
    }
    // السحب الرأسي لا يفعل شيئًا (وفي وضع التمرير يتولّاه المتصفح تمريرًا)
    if (d.axis !== 'x') return;

    // السرعة تُحسب على آخر ١٠٠ مللي ثانية لا بين حدثين متتاليين: فالأحداث المتلاصقة
    // (١٢٠ حدثًا في الثانية على بعض الشاشات) تجعل السرعة اللحظية تقفز، فتبدو حركة
    // بطيئة قصيرة نفضةً وتُقلب بها الصفحة خطأً
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > VELOCITY_WINDOW_MS) d.samples.shift();

    const blocked = !canTurn(mx > 0 ? 1 : -1);
    moveTrack(blocked ? mx * EDGE_RESISTANCE : mx, false);
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    clearTimeout(d.press);
    if (d.longPressed) return;
    // لم يتحرك الإصبع (أقل من ٨ بكسل) ورُفع سريعًا: لمسة لا سحبة
    if (!d.axis && e.type === 'pointerup' && e.timeStamp - d.t0 < TAP_MS) {
      onTap?.(e.pointerType, e.clientX, e.clientY);
      return;
    }
    if (d.axis !== 'x') return;
    const mx = e.clientX - d.x;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const span = last.t - first.t;
    const v = span >= 16 ? (last.x - first.x) / span : 0;
    const flick = Math.abs(mx) >= FLICK_MIN_PX && Math.abs(v) > FLICK_SPEED && Math.sign(v) === Math.sign(mx);
    let dir = 0;
    if (mx > box.w * TURN_RATIO || (flick && mx > 0)) dir = 1;
    else if (mx < -box.w * TURN_RATIO || (flick && mx < 0)) dir = -1;
    settle(dir);
  };

  // ---------- لوحة المفاتيح (للحاسوب) ----------
  // السهم الأيسر للتالية كموضعها، والأيمن للسابقة؛ والمسافة وPageDown للتالية، وShift+المسافة
  // وPageUp للسابقة. ولا تعمل والمصحف مغطّى بقائمة أو صفحة، ولا أثناء الكتابة في خانة.
  // ومع الضغط المستمر تُتمّ القلبة الجارية فورًا فيُقلَّب متتابعًا.
  const api = useRef(null);
  api.current = { settle, canTurn, moveTrack, completeNow, w: box?.w ?? 0 };
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || hasOpenLayer()) return;
      const t = e.target;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      let dir = 0;
      if (e.key === 'ArrowLeft' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
      else if (e.key === 'ArrowRight' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
      if (!dir) return;
      // المسافة على زرّ مركَّز تضغطه، فتُترك له
      if (e.key === ' ' && t?.closest?.('button, a, [role="button"]')) return;
      e.preventDefault();
      if (drag.current) return;
      if (animating.current) api.current.completeNow();
      api.current.settle(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- السحب بلوحة اللمس (عجلة أفقية) ----------
  // سحب إصبعين أفقيًّا على لوحة لمس الحاسوب يصل أحداثَ عجلة لا أحداث مؤشر: تتبعه الصفحة
  // كالسحب بالإصبع، وتُقلب إن تجاوز السحب حدّه أو توقف بعد مسافة كافية، وإلا عادت.
  // واتجاهه كالإصبع: حركة الإصبعين نحو اليمين للتالية. وما بقي من قصور الحركة بعد القلب يُهمَل.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    let acc = 0;
    let idle = 0;
    let locked = false;
    const onWheel = (e) => {
      if (!acc && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (hasOpenLayer() || drag.current) return;
      e.preventDefault(); // لا رجوع في سجل المتصفح بسحب الإصبعين
      clearTimeout(idle);
      if (locked) {
        idle = setTimeout(() => (locked = false), 220);
        return;
      }
      const A = api.current;
      if (animating.current) A.completeNow();
      acc -= e.deltaX * (e.deltaMode === 1 ? 16 : 1);
      const dir = acc > 0 ? 1 : -1;
      const x = Math.max(-A.w, Math.min(A.w, acc));
      A.moveTrack(A.canTurn(dir) ? x : x * EDGE_RESISTANCE, false);
      if (Math.abs(acc) > A.w * TURN_RATIO) {
        acc = 0;
        locked = true;
        A.settle(dir);
        idle = setTimeout(() => (locked = false), 220);
        return;
      }
      idle = setTimeout(() => {
        const a = acc;
        acc = 0;
        api.current.settle(Math.abs(a) > FLICK_MIN_PX ? Math.sign(a) : 0);
      }, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(idle);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ---------- الزرّ الأيمن على آية: يفتح بطاقتها كالضغط المطوّل ----------
  const onContextMenu = (e) => {
    e.preventDefault();
    const word = e.target.closest?.('.w[data-v]');
    if (!word || !onLongPress) return;
    if (drag.current) clearTimeout(drag.current.press);
    drag.current = null;
    onLongPress(+word.dataset.v, word.getBoundingClientRect());
  };

  const half = spread ? spreadArea(box, META_H) : null;
  // عرض العمود واحد لكل الصفحات (حجم الخط واحد)، فيكفي أخذه من الصفحة الحالية.
  // وفي الزوج: عرض الصفحتين وما بينهما
  const single = area ? pageLayout(quran, page, spread ? half : area, scroll).width : 0;
  const column = spread ? single * 2 + SPREAD_GUTTER : single;
  useEffect(() => {
    if (column) onColumn?.(column);
  }, [column, onColumn]);
  const slots = [base + step, base, base - step].filter((p) => p >= FIRST_PAGE && p <= LAST_PAGE);
  // سهما التقليب بجانب الزوج من الخارج، وعند ضيق الجانبين على حافة الشاشة
  const arrowAt = box ? Math.max(6, (box.w - column) / 2 - 56) : 0;

  return (
    <div
      ref={viewRef}
      className={`reader${scroll ? ' reader--scroll' : ''}`}
      style={{ '--meta-h': `${META_H}px`, '--pad-x': `${PAD_X}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
    >
      {area && (
        <div ref={trackRef} className="reader__track" onTransitionEnd={onTransitionEnd}>
          {slots.map((p) =>
            spread ? (
              <Spread key={`s${p}`} quran={quran} start={p} area={half} shift={(base - p) / 2} current={p === base} marks={marks} />
            ) : (
              <Sheet
                key={p}
                quran={quran}
                page={p}
                layout={pageLayout(quran, p, area, scroll)}
                scroll={scroll}
                shift={page - p}
                current={p === page}
                marks={marks}
              />
            )
          )}
        </div>
      )}
      {area && spread && (
        <>
          <ArrowButton side="right" at={arrowAt} shown={arrows} disabled={!canTurn(-1)} onClick={() => settle(-1)} />
          <ArrowButton side="left" at={arrowAt} shown={arrows} disabled={!canTurn(1)} onClick={() => settle(1)} />
        </>
      )}
    </div>
  );
}

// سهم تقليب على جانب المصحف (للفأرة): الأيسر للتالية والأيمن للسابقة، كاتجاه المصحف.
// يظهر مع الأزرار العائمة عند تحريك الفأرة، ولا يبدأ سحبًا ولا لمسة على الصفحة
function ArrowButton({ side, at, shown, disabled, onClick }) {
  const next = side === 'left';
  return (
    <button
      type="button"
      className={`reader__arrow reader__arrow--${side}${shown && !disabled ? ' reader__arrow--shown' : ''}`}
      style={{ [side]: `${at}px` }}
      aria-label={next ? 'الصفحة التالية' : 'الصفحة السابقة'}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={next ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// زوج متقابل كالمصحف المفتوح: الفردية يمينًا والزوجية يسارًا، وبينهما كعب خفيف.
// يُنتظر خطّا الصفحتين معًا قبل رسم أيٍّ منهما، فلا تظهر صفحة قبل أختها.
function Spread({ quran, start, area, shift, current, marks }) {
  const right = usePageFont(start);
  const left = usePageFont(start + 1);
  const font = right === 'ready' && left === 'ready' ? 'ready' : right === 'failed' || left === 'failed' ? 'failed' : 'loading';
  return (
    <div className="spread" style={{ transform: `translate3d(${shift * 100}%, 0, 0)` }} aria-hidden={!current}>
      <Sheet quran={quran} page={start} layout={pageLayout(quran, start, area)} half font={font} current={current} marks={marks} />
      <div className="spread__spine" aria-hidden="true" />
      <Sheet quran={quran} page={start + 1} layout={pageLayout(quran, start + 1, area)} half font={font} current={current} marks={marks} />
    </div>
  );
}

// ورقة الصفحة: الترويسة فوق الأسطر — الجزء يمينًا، ورقم الصفحة في الوسط، والسورة يسارًا.
// والترويسة جزء من الورقة، فتتحرك معها عند السحب.
// half: صفحة من زوج (موضعها في الزوج لا في الشريط)، وfont حال خطّي الزوج معًا
function Sheet({ quran, page, layout, scroll, shift, current, marks, half, font: pairFont }) {
  const { sura, juz } = pageInfo(quran, page);
  const own = usePageFont(page);
  const font = pairFont ?? own;
  return (
    <section
      className={`sheet${scroll ? ' sheet--scroll' : ''}${half ? ' sheet--half' : ''}${current ? ' sheet--current' : ''}`}
      style={half ? { width: `${layout.width}px` } : { transform: `translate3d(${shift * 100}%, 0, 0)` }}
      aria-hidden={half ? undefined : !current}
      aria-label={`الصفحة ${toArabicDigits(page)}`}
    >
      {/* بعرض عمود الأسطر نفسه: الجزء عند حافة الآيات اليمنى، والسورة عند حافتها اليسرى */}
      <header className="sheet__meta" style={{ width: `${layout.width}px` }}>
        <span className="sheet__juz">{juzLabel(juz)}</span>
        <span className="sheet__num">
          <span>{toArabicDigits(page)}</span>
          <PageSideIcon right={page % 2 === 1} />
        </span>
        <span className="sheet__sura">{stripTashkeel(SURA_NAMES_VOWELED[sura.n - 1])}</span>
      </header>
      {/* لا تُرسم الصفحة قبل وصول خطها، وإلا ظهرت رموز كلماتها حروفًا مبعثرة بخط آخر */}
      {font === 'ready' ? (
        <MushafPage
          quran={quran}
          page={page}
          fontSize={layout.fontSize}
          width={layout.width}
          height={scroll ? layout.pageHeight : undefined}
          shortLines={layout.shortLines}
          marks={marks}
        />
      ) : (
        <div className="mushaf-page mushaf-page--pending" style={{ width: `${layout.width}px` }}>
          {font === 'failed' && 'تُنزَّل هذه الصفحة عند أول فتح لها، وتحتاج لذلك اتصالًا بالإنترنت. وتعمل بعدها بلا اتصال.'}
        </div>
      )}
    </section>
  );
}

// مصحف مفتوح صغير يُظهر موضع الصفحة منه: في مصحف المدينة الفردية يمنى
// (الفاتحة يمنى) والزوجية يسرى. فالجهة الحالية مشرّبة بلون التمييز وأسطرها بلونه،
// والأخرى خافتة — تمييز هادئ لا لون صارخ.
const PAGE_LEFT = 'M16 5.2C12.6 2.9 7.6 2.4 3 3.4v11.8c4.6-1 9.6-.5 13 1.8Z';
const PAGE_RIGHT = 'M16 5.2c3.4-2.3 8.4-2.8 13-1.8v11.8c-4.6-1-9.6-.5-13 1.8Z';
const LINES_LEFT = 'M5.6 6.7c2.6-.5 5.3-.3 7.9.8M5.6 9.3c2.6-.5 5.3-.3 7.9.8M5.6 11.9c2.6-.5 5.3-.3 7.9.8';
const LINES_RIGHT = 'M26.4 6.7c-2.6-.5-5.3-.3-7.9.8M26.4 9.3c-2.6-.5-5.3-.3-7.9.8M26.4 11.9c-2.6-.5-5.3-.3-7.9.8';

function PageSideIcon({ right }) {
  const side = (isCurrent) => (isCurrent ? 'page-side__page page-side__page--on' : 'page-side__page');
  return (
    <svg
      className="page-side"
      viewBox="0 1.6 32 16.2"
      role="img"
      aria-label={right ? 'الصفحة اليمنى' : 'الصفحة اليسرى'}
    >
      <g className={side(!right)}>
        <path className="page-side__sheet" d={PAGE_LEFT} />
        <path className="page-side__lines" d={LINES_LEFT} />
      </g>
      <g className={side(right)}>
        <path className="page-side__sheet" d={PAGE_RIGHT} />
        <path className="page-side__lines" d={LINES_RIGHT} />
      </g>
      {/* كعب المصحف */}
      <path className="page-side__spine" d="M16 5.2v11.8" />
    </svg>
  );
}
