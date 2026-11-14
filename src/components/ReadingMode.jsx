import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MushafPage from './MushafPage.jsx';
import { pageInfo, toArabicDigits } from '../data/quran.js';
import { SURA_NAMES_VOWELED } from '../data/suraNamesVoweled.js';
import { pageLayout } from '../lib/layout.js';
import { prefetchPageFonts, usePageFont } from '../lib/qcfFonts.js';
import { FIRST_PAGE, LAST_PAGE } from '../lib/position.js';
import {
  READ_SPEED_MAX,
  READ_SPEED_MIN,
  ratioToSpeed,
  readReadingSpeed,
  saveReadingSpeed,
  speedToRatio,
  stepSpeed,
} from '../lib/settings.js';
import './ReadingMode.css';

/*
  وضع القراءة (٢٠٢٦-١٠-١٨): المصحف تدفّقٌ رأسي متصل تنزل فيه الصفحات تلقائيًّا بسرعة يختارها
  المستخدم، فيقرأ دون أن يقلّب بيده. يُدخَل إليه من صفحة «وضع القراءة» في الإعدادات (ReadingInfo.jsx).

  • كل صفحة تحتفظ بتخطيطها الأصلي (١٥ سطرًا وكسر السطر كما في المطبوع)، والخط يُحسب من العرض
    وحده كما في الجوال الأفقي (src/lib/layout.js)، ويعمل الوضع في الاتجاهين.
  • صفحات المصحف كلها بارتفاع واحد، فيُحسب موضع كل صفحة بالضرب، ويُرسم القريب من الشاشة وحده
    (virtualization) مع تنزيل مسبق لخطوط التالية، لتبقى الحركة سلسة على الجوالات الضعيفة.
  • التمرير التلقائي بالزمن لا بعدد الإطارات، ويُراكَم الكسر العشري فلا يُقرَّب كل إطار
    (التقريب يقطّع الحركة البطيئة، خصوصًا في سفاري آيفون).
  • لمسة المستخدم أو تمريره بإصبعه توقف التلقائي، ويستأنف من موضعه الجديد بعد انتهاء القصور.
*/

const SEP_H = 34; // الفاصل الرفيع أعلى كل صفحة: الجزء ورقم الصفحة والسورة
const PAD_X = 3; // هامش جانبي يسير جدًّا كما في القارئ العادي
const BOTTOM_ROOM = 96; // مكان للشريط السفلي تحت آخر المصحف
const LONG_PRESS_MS = 450;
const RESUME_AFTER_MS = 140; // بعد آخر حركة بيد المستخدم (وقصورها) يستأنف التلقائي
const MAX_FRAME_MS = 100; // أطول مدة تُحسب لإطار واحد، فلا يقفز التمرير بعد انقطاع (كإخفاء النافذة)

// الترويسة بلا تشكيل كما في القارئ العادي (بطلب صاحب المشروع)
const stripTashkeel = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
// السور التي تذكرها ترويسة الصفحة (اثنتان أو ثلاث في قصار السور آخر المصحف، كالمطبوع)
const suraLabel = (suras) => suras.map((s) => stripTashkeel(SURA_NAMES_VOWELED[s.n - 1])).join(' · ');
const juzLabel = (j) => `الجزء ${toArabicDigits(j)}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

// startPage: الصفحة التي يبدأ منها · marks: إشارات المستخدم على الآيات · cardOpen: بطاقة آية مفتوحة
// onLongPress(آية، مستطيل كلمتها) · onExit(الصفحة التي تشغل منتصف الشاشة)
// أقصى عرض لعمود وضع القراءة (الشاشات الكبيرة)
const READING_MAX_W = 640;

export default function ReadingMode({ quran, startPage, marks, cardOpen, onLongPress, onExit }) {
  const flowRef = useRef(null);
  const [box, setBox] = useState(null);
  const [win, setWin] = useState({ a: startPage, b: startPage });
  const [speed, setSpeed] = useState(readReadingSpeed);
  const [paused, setPaused] = useState(false);

  // ---------- القياس والتخطيط ----------
  useLayoutEffect(() => {
    const el = flowRef.current;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setBox({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // عمود واحد متمركز بعرض مريح: على الشاشات الكبيرة لا يمتد على كل العرض ولا يتحول صفحتين
  const layout = box ? pageLayout(quran, 1, { w: Math.min(box.w - PAD_X * 2, READING_MAX_W), h: box.h }, true) : null;
  const pageH = layout ? SEP_H + layout.pageHeight : 0; // ارتفاع كل صفحة في التدفق
  const lineH = layout ? layout.pageHeight / 15 : 0;

  // الحالة التي تقرؤها حلقة الحركة بلا إعادة تركيبها
  const live = useRef({ paused: false, blocked: false, speed, lineH: 0, userTs: 0, touching: false });
  live.current.paused = paused;
  live.current.blocked = !!cardOpen;
  live.current.speed = speed;
  live.current.lineH = lineH;

  const pos = useRef(0); // الموضع الحقيقي بكسره العشري
  const lastH = useRef(0);
  // الموضع بوحدة الصفحات (٥٨١٫٣ = ثلث الصفحة ٥٨٢): يُحفظ عند كل تمرير، لأن المتصفح يقصّ scrollTop
  // من تلقاء نفسه حين يقصر التدفق عند تدوير الجهاز، فيضيع الموضع إن قُرئ بعد التقصير
  const progress = useRef(startPage - FIRST_PAGE);

  // الصفحات المرسومة: القريبة من الشاشة (ارتفاعًا فوقها وارتفاعين تحتها)، وتُنزَّل خطوط التالية مسبقًا
  const updateWindow = useCallback(() => {
    const el = flowRef.current;
    if (!el || !lastH.current) return;
    const h = lastH.current;
    const a = clamp(Math.floor((el.scrollTop - el.clientHeight) / h) + 1, FIRST_PAGE, LAST_PAGE);
    const b = clamp(Math.ceil((el.scrollTop + el.clientHeight * 2) / h), FIRST_PAGE, LAST_PAGE);
    setWin((w) => (w.a === a && w.b === b ? w : { a, b }));
  }, []);
  useEffect(() => prefetchPageFonts([win.b + 1, win.b + 2, win.b + 3]), [win.b]);

  // أول موضع: بداية الصفحة التي كان فيها. وإن تغيّر الارتفاع (تدوير الجهاز) بقي الموضع نفسه نسبيًّا
  useLayoutEffect(() => {
    const el = flowRef.current;
    if (!el || !pageH) return;
    el.scrollTop = progress.current * pageH;
    pos.current = el.scrollTop;
    lastH.current = pageH;
    updateWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageH]);

  // ---------- التمرير التلقائي ----------
  useEffect(() => {
    const el = flowRef.current;
    if (!el || !pageH) return undefined;
    let raf = 0;
    let last = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, MAX_FRAME_MS) : 0;
      last = now;
      const s = live.current;
      // بيد المستخدم: يُتابَع موضعه ولا يُزاحَم
      const drift = Math.abs(el.scrollTop - pos.current) > 2;
      if (s.touching || now - s.userTs < RESUME_AFTER_MS || drift) {
        if (drift && !s.touching) s.userTs = now;
        pos.current = el.scrollTop;
        return;
      }
      if (s.paused || s.blocked) return;
      const max = el.scrollHeight - el.clientHeight;
      pos.current = Math.min(max, pos.current + ((s.speed * s.lineH) / 60) * (dt / 1000));
      el.scrollTop = pos.current;
      // آخر المصحف: يتوقف التلقائي
      if (pos.current >= max - 0.5) setPaused(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pageH]);

  // تمرير المستخدم وقصوره: يُرصد بلمسه وعجلته وبأي فرق بين الموضع الفعلي وما حسبناه
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return undefined;
    const touch = (on) => () => {
      live.current.touching = on;
      live.current.userTs = performance.now();
    };
    const wheel = () => {
      live.current.userTs = performance.now();
    };
    const scroll = () => {
      if (lastH.current) progress.current = el.scrollTop / lastH.current;
      updateWindow();
      if (Math.abs(el.scrollTop - pos.current) > 2) live.current.userTs = performance.now();
    };
    const start = touch(true);
    const end = touch(false);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    el.addEventListener('wheel', wheel, { passive: true });
    el.addEventListener('scroll', scroll, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('scroll', scroll);
    };
  }, [updateWindow]);

  // ---------- منع انطفاء الشاشة ما دام التمرير التلقائي جاريًا ----------
  useEffect(() => {
    if (paused || !navigator.wakeLock) return undefined;
    let lock = null;
    let dead = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (dead) lock.release().catch(() => {});
      } catch {
        // لا يُسمح به (توفير الطاقة مثلًا): يبقى التمرير بلا قفل
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [paused]);

  // ---------- الضغط المطوّل على آية ----------
  const press = useRef(null);
  const cancelPress = () => {
    clearTimeout(press.current?.timer);
    press.current = null;
  };
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const word = e.target.closest?.('.w[data-v]');
    if (!word || !onLongPress) return;
    cancelPress();
    const p = { x: e.clientX, y: e.clientY };
    p.timer = setTimeout(() => {
      press.current = null;
      onLongPress(+word.dataset.v, word.getBoundingClientRect());
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const onPointerMove = (e) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress();
  };
  useEffect(() => cancelPress, []);

  // ---------- الخروج: الصفحة التي تشغل منتصف الشاشة ----------
  const exit = () => {
    const el = flowRef.current;
    const mid = pageH ? Math.floor((el.scrollTop + el.clientHeight / 2) / pageH) + FIRST_PAGE : startPage;
    onExit(clamp(mid, FIRST_PAGE, LAST_PAGE));
  };

  const changeSpeed = (n) => {
    setSpeed(n);
    saveReadingSpeed(n);
  };

  const pages = [];
  if (layout) for (let p = win.a; p <= win.b; p++) pages.push(p);

  return (
    <div className="reading">
      <div
        ref={flowRef}
        className="flow"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        {layout && (
          <div className="flow__space" style={{ height: `${(LAST_PAGE - FIRST_PAGE + 1) * pageH + BOTTOM_ROOM}px` }}>
            {pages.map((p) => (
              <FlowPage key={p} quran={quran} page={p} top={(p - FIRST_PAGE) * pageH} layout={layout} marks={marks} />
            ))}
          </div>
        )}
      </div>

      {/* الشريط السفلي يحلّ محل الخانتين طوال بقاء الوضع: ✕ للخروج، وإيقاف/استئناف، ثم شريط السرعة
          (اليمين بطيء واليسار سريع) */}
      <div className="readbar" role="toolbar" aria-label="التحكم في وضع القراءة">
        <button type="button" className="readbar__btn" onClick={exit} aria-label="الخروج من وضع القراءة">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="readbar__btn"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? 'استئناف التمرير' : 'إيقاف التمرير'}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" />
              <rect x="13.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" />
            </svg>
          )}
        </button>
        <SpeedSlider value={speed} min={READ_SPEED_MIN} max={READ_SPEED_MAX} onChange={changeSpeed} />
      </div>
    </div>
  );
}

// صفحة في التدفق: فاصل رفيع (الجزء · رقم الصفحة · السورة) ثم الصفحة بتخطيطها الأصلي
const FlowPage = memo(function FlowPage({ quran, page, top, layout, marks }) {
  const { suras, juz } = pageInfo(quran, page);
  const font = usePageFont(page);
  return (
    <section
      className="flow__page"
      style={{ top: `${top}px`, height: `${SEP_H + layout.pageHeight}px` }}
      aria-label={`الصفحة ${toArabicDigits(page)}`}
    >
      <div className="flow__sep" style={{ height: `${SEP_H}px`, width: `${layout.width}px` }}>
        <span>{juzLabel(juz)}</span>
        <span className="flow__num">{toArabicDigits(page)}</span>
        <span>{suraLabel(suras)}</span>
      </div>
      {font === 'ready' ? (
        <MushafPage
          quran={quran}
          page={page}
          fontSize={layout.fontSize}
          width={layout.width}
          height={layout.pageHeight}
          shortLines={layout.shortLines}
          marks={marks}
        />
      ) : (
        <div
          className="mushaf-page mushaf-page--pending"
          style={{ width: `${layout.width}px`, height: `${layout.pageHeight}px` }}
        >
          {font === 'failed' && 'تُنزَّل هذه الصفحة عند أول فتح لها، وتحتاج لذلك اتصالًا بالإنترنت. وتعمل بعدها بلا اتصال.'}
        </div>
      )}
    </section>
  );
});

// شريط السرعة بأسلوب شريط التقدم في يوتيوب: خط رفيع ومقبض يظهر ويكبر عند اللمس، ومنطقة لمس
// أعرض من الخط المرئي. اتجاهه من اليمين إلى اليسار: اليمين بطيء واليسار سريع، والتعبئة من اليمين.
// متدرّج (src/lib/settings.js): نصفه الأيمن للسرعات البطيئة ٢–١٥، ونصفه الأيسر للسريعة ١٥–٦٠.
function SpeedSlider({ value, min, max, onChange }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  const ratio = speedToRatio(value);

  const setFromX = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const t = clamp((r.right - clientX) / r.width, 0, 1);
    onChange(ratioToSpeed(t));
  };
  const onDown = (e) => {
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch {
      // بعض المتصفحات ترفض الالتقاط لمؤشر انتهى — لا يلزم لضبط السرعة
    }
    setActive(true);
    setFromX(e.clientX);
  };
  const onMove = (e) => {
    if (active) setFromX(e.clientX);
  };
  const onUp = () => setActive(false);
  const onKey = (e) => {
    // السهم الأيمن يُبطئ والأيسر يُسرّع، موافقةً لاتجاه الشريط
    const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onChange(stepSpeed(value, dir));
  };

  return (
    <div
      ref={ref}
      className={`speed${active ? ' speed--active' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="سرعة التمرير بالأسطر في الدقيقة"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <div className="speed__line">
        <div className="speed__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="speed__thumb" style={{ right: `${ratio * 100}%` }} />
    </div>
  );
}
