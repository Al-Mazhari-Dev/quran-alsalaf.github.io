import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SplashScreen from './components/SplashScreen.jsx';
import Reader from './components/Reader.jsx';
import ReadingMode from './components/ReadingMode.jsx';
import { loadQuran } from './data/quran.js';
import { loadPageFont } from './lib/qcfFonts.js';
import { readLastPage, saveLastPage } from './lib/position.js';
import SettingsSheet from './components/SettingsSheet.jsx';
import StudySheet from './components/StudySheet.jsx';
import VerseMenu from './components/VerseMenu.jsx';
import RangePicker from './components/RangePicker.jsx';
import ListenSheet from './components/ListenSheet.jsx';
import SideMenu from './components/SideMenu.jsx';
import RangeMenu from './components/RangeMenu.jsx';
import SearchOverlay from './components/SearchOverlay.jsx';
import AboutPage from './components/AboutPage.jsx';
import { pause, play, resume, stop, usePlayer } from './lib/player.js';
import { toArabicDigits } from './data/quran.js';
import { pageVerses, verseLabel } from './lib/study.js';
import { saveRange, useUserData } from './lib/userdata.js';
import { spreadStart } from './lib/layout.js';
import { hasOpenLayer } from './lib/layers.js';
import './App.css';

// أقصر مدّة تبقى فيها شاشة الافتتاح ولو كانت البيانات جاهزة فورًا من ذاكرة
// الجهاز، ليُرى الشعار لحظةً عند كل فتح كما نصّت المواصفة (الفصل ١١) لا وميضًا.
// وتبقى أطول من ذلك إن طال تحميل المصحف أول مرة.
const SPLASH_MIN_MS = 0; // لا شاشة ثانية: تكفي شاشة النظام (أيقونة التطبيق) ثم المصحف مباشرة
const SPLASH_FADE_MS = 420;
// الأزرار العائمة الظاهرة بتحريك الفأرة تختفي بعد توقفها هذه المدة
const MOUSE_IDLE_MS = 2500;

export default function App() {
  const [quran, setQuran] = useState(null);
  const [failed, setFailed] = useState(false);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // الأزرار العائمة (الشريط العلوي والخانتان السفليتان) مخفية أصلًا، فيملأ المصحف الشاشة؛
  // وتظهر معًا بلمسة على الصفحة وتختفي بأخرى (بطلب صاحب المشروع)
  const [chromeOpen, setChromeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // الصفحات السفلية: صفحة كاملة تحت المصحف. نطاقها النطاق المحدد في الخانة اليسرى إن
  // اكتمل، وإلا آيات الصفحة الحالية (الفصل ٥)
  const [studyOpen, setStudyOpen] = useState(false);
  // وضع القراءة (٢٠٢٦-١٠-١٨): تدفّق رأسي بتمرير تلقائي. لا يُحفظ بين الجلسات: يفتح التطبيق بالعادي دائمًا
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState(readLastPage);
  // الصفحتان معًا (الشاشات الكبيرة): يبلّغ به القارئ بحسب المساحة المتاحة
  const [spread, setSpread] = useState(false);
  const shownPages = useMemo(() => (spread ? [spreadStart(page), spreadStart(page) + 1] : [page]), [spread, page]);
  const user = useUserData();
  const selection = user.range?.length === 2 ? user.range : null;
  // بلا مقدار محدد: آيات الصفحة الظاهرة، أو آيات الصفحتين معًا من أول اليمنى إلى آخر اليسرى
  const range = useMemo(() => {
    if (!quran) return [];
    if (!selection) return [...new Set(shownPages.flatMap((p) => pageVerses(quran, p)))];
    return Array.from({ length: selection[1] - selection[0] + 1 }, (_, i) => selection[0] + i);
  }, [quran, shownPages, selection?.[0], selection?.[1]]);
  const rangePages = useMemo(() => (quran ? [...new Set(range.map((v) => quran.verses[v].p))] : []), [quran, range]);

  // الضغط المطوّل على آية، وقائمة اختيار آية النطاق، والتنبيه القصير
  const [pressed, setPressed] = useState(null);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [picking, setPicking] = useState(null); // 'start' | 'end'
  const [gotoPage, setGotoPage] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((text) => setToast({ text, n: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // الاستماع (الفصل ٦): المقدار المسموع هو النطاق المحدد، وإلا الصفحة الحالية كاملة
  const player = usePlayer();
  const [listenOpen, setListenOpen] = useState(false);
  const listenSuras = useMemo(() => (quran ? [...new Set(range.map((v) => quran.verses[v].s))] : []), [quran, range]);
  const listenLabel =
    quran &&
    (selection
      ? verseLabel(quran, selection)
      : spread
        ? `الصفحتان ${toArabicDigits(shownPages[0])}–${toArabicDigits(shownPages[1])}`
        : `الصفحة ${toArabicDigits(page)}`);
  const startListening = async () => {
    const result = await play(quran, range);
    if (result === 'unsupported') showToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
    else if (result === 'ok') setListenOpen(false);
    // 'failed': رسالة الخطأ تظهر من التأثير أعلاه (player.error). 'cancelled': تجاوزه طلب أحدث.
  };
  useEffect(() => {
    if (player.error) showToast(player.error.text);
  }, [player.error, showToast]);
  // تقليب الصفحة تلقائيًا مع أول آية في الصفحة التالية (وفي الزوج: لا يتحرك المصحف حتى يبدأ
  // القارئ أول آية في الزوج التالي، لأن الانتقال إلى صفحة من الزوج الظاهر لا يغيّره)
  useEffect(() => {
    if (quran && player.v != null) {
      const p = quran.verses[player.v].p;
      setGotoPage((g) => (g?.page === p ? g : { page: p, n: Date.now() }));
    }
  }, [quran, player.v]);

  const marks = useMemo(
    () => ({ notes: user.notes, bookmarks: user.bookmarks, range: selection, selected: pressed?.v ?? null, playing: player.v }),
    [user.notes, user.bookmarks, selection?.[0], selection?.[1], pressed?.v, player.v]
  );

  // دخول وضع القراءة من الإعدادات: يُوقَف الصوت بهدوء (الاستماع وتحديد المقدار لا يعملان فيه)،
  // ثم يبدأ التدفق من الصفحة الحالية. والخروج يعيد المصحف العادي على الصفحة التي في منتصف الشاشة
  const startReading = () => {
    setSettingsOpen(false);
    setChromeOpen(false);
    if (player.status !== 'idle') stop();
    setReading(true);
  };
  const exitReading = (p) => {
    saveLastPage(p);
    setPage(p);
    setGotoPage({ page: p, n: Date.now() });
    setReading(false);
  };
  const readingMarks = useMemo(() => ({ ...marks, range: null, playing: null }), [marks]);

  const onLongPress = useCallback((v, rect) => {
    setChromeOpen(false);
    setPressed({ v, rect });
  }, []);

  // اختيار آية من القائمة: البداية ثم النهاية، والعودة إلى المصحف عند آيتها
  const pickVerse = (v) => {
    if (picking === 'start') saveRange([v]);
    else {
      const s = user.range[0];
      saveRange(v < s ? [v, s] : [s, v]);
    }
    setGotoPage({ page: quran.verses[v].p, n: Date.now() });
    setPicking(null);
  };

  // الانتقال بين المصحف والصفحات السفلية انزلاقٌ رأسي يتبع الإصبع كتمرير «يوتيوب شورتس»:
  // المصحف يصعد والصفحة السفلية تصعد تحته معًا. والموضع يُضبط في DOM مباشرة لا عبر حالة
  // React، لتبقى الحركة سلسة. lift: كم صعد المصحف (٠ مغلق، ارتفاع الشاشة مفتوح).
  //
  // وفي الشاشة الكبيرة (الصفحتان معًا) تُفتح الصفحة السفلية لوحةً متمركزة فوق المصحف بعرض مريح
  // للقراءة: يبقى المصحف مكانه، وتصعد اللوحة وحدها ويُعتَّم ما خلفها تدريجًا.
  const appRef = useRef(null);
  const studyRef = useRef(null);
  const backdropRef = useRef(null);
  const panelRef = useRef(false);
  panelRef.current = spread;
  const setLift = useCallback((lift, animate) => {
    const h = window.innerHeight;
    const ease = animate ? 'transform 320ms cubic-bezier(0.2, 0.8, 0.25, 1)' : 'none';
    const app = appRef.current;
    const study = studyRef.current;
    const panel = panelRef.current;
    if (app) {
      app.style.transition = ease;
      app.style.transform = lift && !panel ? `translate3d(0, ${-lift}px, 0)` : '';
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = animate ? 'opacity 320ms ease' : 'none';
      backdrop.style.opacity = panel ? String(Math.max(0, Math.min(1, lift / h))) : '0';
      backdrop.style.pointerEvents = panel && lift > 0 ? 'auto' : 'none';
    }
    // موضع الصفحة السفلية صريح دائمًا: فأصلها في CSS تحت حافة الشاشة
    if (study) {
      study.style.transition = ease;
      study.style.transform = `translate3d(0, ${h - lift}px, 0)`;
    }
  }, []);

  // تكفي سحبة خُمس الشاشة، أو نفضة سريعة، لإتمام الانتقال؛ وإلا عادت الصفحة إلى مكانها
  const settles = (dist, ms) => dist > window.innerHeight * 0.2 || (dist > 40 && dist / ms > 0.5);

  const onVDrag = useCallback((dy) => setLift(Math.min(window.innerHeight, Math.max(0, -dy)), false), [setLift]);
  const onVDragEnd = useCallback(
    (dy, ms) => {
      if (settles(-dy, ms)) {
        setChromeOpen(false);
        setStudyOpen(true);
        setLift(window.innerHeight, true);
      } else setLift(0, true);
    },
    [setLift]
  );
  // فتح الصفحات السفلية وإغلاقها بزرّ (للفأرة ولوحة المفاتيح)، وبمفتاح Esc وبالنقر خارج اللوحة
  const openStudy = useCallback(() => {
    setChromeOpen(false);
    setStudyOpen(true);
    setLift(window.innerHeight, true);
  }, [setLift]);
  const closeStudy = useCallback(() => {
    setStudyOpen(false);
    setLift(0, true);
  }, [setLift]);
  const onStudyDrag = useCallback((dy) => setLift(window.innerHeight - dy, false), [setLift]);
  const onStudyDragEnd = useCallback(
    (dy, ms) => {
      if (settles(dy, ms)) {
        setStudyOpen(false);
        setLift(0, true);
      } else setLift(window.innerHeight, true);
    },
    [setLift]
  );

  // عند تغيّر حجم الشاشة (أو تبدّل الصفحة واللوحة) والصفحة مفتوحة، تبقى مفتوحة في موضعها الصحيح
  useEffect(() => {
    const fit = () => studyOpen && setLift(window.innerHeight, false);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [studyOpen, setLift]);
  const studyOpenRef = useRef(false);
  studyOpenRef.current = studyOpen;
  useLayoutEffect(() => {
    if (studyOpenRef.current) setLift(window.innerHeight, false);
  }, [spread, setLift]);

  // ---------- الفأرة ولوحة المفاتيح ----------
  // تحريك الفأرة يُظهر الأزرار العائمة (وسهمي التقليب)، وتختفي بعد توقفها — إلا والمؤشر فوقها
  // أو التركيز فيها. ولمس الشاشة يبقى كما كان: لمسة تُظهرها وأخرى تخفيها، بلا مؤقّت.
  const [mouseUi, setMouseUi] = useState(false);
  const hideTimer = useRef(0);
  const quiet = useRef(null); // موضع نقرة أخفت الأزرار: لا تعود بحركة يسيرة بعدها
  const overChrome = useRef(false);
  const readingRef = useRef(false);
  readingRef.current = reading;
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (overChrome.current || document.activeElement?.closest?.('.topbar, .dock, .reader__arrow')) return;
      setChromeOpen(false);
    }, MOUSE_IDLE_MS);
  }, []);
  useEffect(() => {
    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || e.buttons || readingRef.current || hasOpenLayer()) return;
      if (quiet.current) {
        if (Math.hypot(e.clientX - quiet.current.x, e.clientY - quiet.current.y) < 24) return;
        quiet.current = null;
      }
      overChrome.current = !!e.target.closest?.('.topbar__icon, .topbar__search, .dock__slot, .dock__study, .reader__arrow');
      setMouseUi(true);
      setChromeOpen(true);
      scheduleHide();
    };
    const onDown = (e) => {
      if (e.pointerType !== 'mouse') setMouseUi(false);
    };
    // لوحة المفاتيح وحدها: أول Tab يُظهر الأزرار العائمة ويركّز أولها
    const onKey = (e) => {
      if (e.key !== 'Tab' || readingRef.current || hasOpenLayer()) return;
      if (document.activeElement?.closest?.('.topbar, .dock')) return;
      e.preventDefault();
      setChromeOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.topbar button:not(:disabled)')?.focus()));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [scheduleHide]);
  // لمسة على الصفحة: تُظهر الأزرار أو تخفيها. وبالفأرة إن أُظهرت اختفت بعد توقفها كالحركة
  const onReaderTap = useCallback(
    (type, x, y) => {
      setChromeOpen((open) => {
        if (type !== 'mouse') return !open;
        if (open) {
          quiet.current = { x, y };
          clearTimeout(hideTimer.current);
          return false;
        }
        scheduleHide();
        return true;
      });
    },
    [scheduleHide]
  );
  // Esc يخفي الأزرار العائمة إن لم تكن فوق المصحف طبقة مفتوحة
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !hasOpenLayer()) setChromeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // عرض عمود أسطر المصحف: يُحاذى به الشريط العلوي، فتقع أيقونتاه عند حافتي الآيات
  const [column, setColumn] = useState(null);

  useEffect(() => {
    let alive = true;
    const minDelay = new Promise((r) => setTimeout(r, SPLASH_MIN_MS));
    // يُنتظر خط الصفحة التي يُفتح عليها المصحف، وخطّا إطار السورة والبسملة، لتظهر الصفحة
    // كاملة من أول إطار. وإن تعذّر خط الصفحة (لا اتصال في أول فتح لها) لا يُعطَّل الافتتاح.
    // ومعه خط الصفحة المقابلة لها، فإن فُتح المصحف صفحتين ظهرتا معًا
    const last = readLastPage();
    const fonts = Promise.all([
      loadPageFont(last),
      loadPageFont(last % 2 ? last + 1 : last - 1),
      document.fonts.load('32px "SurahHeader"'),
      document.fonts.load('32px "QCF4Basmala"'),
    ]).catch(() => {});
    Promise.all([loadQuran(), fonts, minDelay])
      .then(([data]) => {
        if (alive) setQuran(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (!alive) return;
        setSplashLeaving(true);
        setTimeout(() => alive && setSplashDone(true), SPLASH_FADE_MS);
      });
    return () => {
      alive = false;
    };
  }, []);

  // الانتقال إلى صفحة من القائمة الجانبية أو البحث
  const gotoPageNumber = useCallback((p) => setGotoPage({ page: p, n: Date.now() }), []);

  // ما دامت فوق المصحف صفحة أو قائمة أو بطاقة، فهو خارج التركيز ولوحة المفاتيح (inert)
  const covered =
    studyOpen || settingsOpen || sideMenuOpen || searchOpen || aboutOpen || !!pressed || rangeMenuOpen || !!picking || listenOpen;
  const chromeShown = chromeOpen && !covered;

  return (
    <>
      {!splashDone && <SplashScreen leaving={splashLeaving} />}

      <div
        ref={appRef}
        className={`app${spread ? ' app--spread' : ''}`}
        style={column ? { '--col-w': `${column}px` } : undefined}
        inert={covered ? '' : undefined}
      >
        {/* الشريط العلوي عائم فوق أعلى الصفحة كالخانتين السفليتين: القائمة يمينًا، والبحث
            في الوسط، والإعدادات يسارًا — بعرض عمود الآيات */}
        <header
          className={`topbar${chromeShown ? ' topbar--open' : ''}`}
          aria-hidden={!chromeShown}
          inert={chromeShown ? undefined : ''}
        >
          {/* أيقونة القائمة الجانبية أعلى اليمين (الفصل ٧): فهرس السور، الملاحظات، العلامات */}
          <button className="topbar__icon" type="button" onClick={() => setSideMenuOpen(true)} disabled={!quran} aria-label="القائمة">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>

          {/* خانة البحث الثابتة أعلى منتصف الصفحة (الفصل ٨) */}
          <button className="topbar__search" type="button" onClick={() => setSearchOpen(true)} disabled={!quran}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span>بحث في المصحف</span>
          </button>

          {/* الإعدادات، وفيها تبديل الوضع الفاتح والداكن (بطلب صاحب المشروع) */}
          <button className="topbar__icon" type="button" onClick={() => setSettingsOpen(true)} aria-label="الإعدادات">
            <SettingsIcon />
          </button>
        </header>

        <main className="app__main">
          {quran && reading && (
            <ReadingMode
              quran={quran}
              startPage={page}
              marks={readingMarks}
              cardOpen={!!pressed}
              onLongPress={onLongPress}
              onExit={exitReading}
            />
          )}
          {quran && !reading && (
            <Reader
              quran={quran}
              onTap={onReaderTap}
              onColumn={setColumn}
              onPage={setPage}
              onSpread={setSpread}
              arrows={chromeShown && mouseUi}
              onVDrag={onVDrag}
              onVDragEnd={onVDragEnd}
              onLongPress={onLongPress}
              goto={gotoPage}
              marks={marks}
            />
          )}
          {failed && <LoadError />}
        </main>

        {/* الخانتان السفليتان (الفصل ٤ والفصل ٦) — تُفعَّلان في المرحلة الخامسة.
            الترتيب مقصود: في التخطيط من اليمين لليسار يقع أول عنصر يمينًا،
            فالاستماع أولًا ليستقر في الخانة اليمنى، والتحديد ثانيًا ليستقر يسارًا،
            مطابقةً لنصّ المواصفة.
            وهما مخفيتان أصلًا (بطلب صاحب المشروع)، تنزلقان من الأسفل فوق الصفحة عند اللمس،
            فلا يتغير حجم خط المصحف بظهورهما. */}
        {!reading && (
          <footer
            className={`dock${chromeShown ? ' dock--open' : ''}`}
            aria-hidden={!chromeShown}
            inert={chromeShown ? undefined : ''}
          >
            {/* فتح الصفحات السفلية بزرّ — يظهر على الأجهزة التي تعمل بالفأرة وحدها (App.css)،
                إضافةً إلى السحب. وعلى الجوال باللمس لا يظهر: يبقى السحب وحده كما كان */}
            <button className="dock__study" type="button" disabled={!quran} onClick={openStudy}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              التفسير والمعاني والعمل
            </button>
            {/* الاستماع: قبل التشغيل تفتح إعداداته، وأثناءه تصير الخانة أزرار التحكم كلها
                (إيقاف مؤقت/استئناف، والإعدادات، والإيقاف التام) — بلا شريط صوت منفصل */}
            {player.status === 'idle' || !quran ? (
              <button className="dock__slot" type="button" disabled={!quran} onClick={() => setListenOpen(true)}>
                {player.download?.active ? (
                  <span className="dock__label dock__label--row">
                    <span className="dock__spin" />
                    جارٍ تنزيل الصوت{player.download.pct != null ? ` — ${toArabicDigits(player.download.pct)}٪` : ''}
                  </span>
                ) : (
                  <span className="dock__label">الاستماع للمقدار المحدد</span>
                )}
              </button>
            ) : (
              <div className="dock__slot dock__slot--player">
                <button
                  type="button"
                  className="dock__ctl dock__ctl--main"
                  onClick={player.status === 'paused' ? resume : pause}
                  aria-label={player.status === 'paused' ? 'استئناف' : 'إيقاف مؤقت'}
                >
                  {player.status === 'paused' ? <PlayIcon /> : player.status === 'loading' ? <span className="dock__spin" /> : <PauseIcon />}
                </button>
                <button type="button" className="dock__ctl" onClick={() => setListenOpen(true)} aria-label="إعدادات الاستماع">
                  <SettingsIcon />
                </button>
                <button type="button" className="dock__ctl" onClick={stop} aria-label="إيقاف">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
            {/* تحديد مقدار الآيات: فارغة ⇐ «تحديد مقدار الآيات»، وإلا ملخص المقدار مع ✕ لمسحه.
                كلاهما يفتح قائمة البداية والنهاية (RangeMenu) — ملخص المقدار يحتاج بيانات
                المصحف: فلا يُكتب قبل تحميلها (وإلا تعطّل الفتح إن كان محفوظًا من قبل) */}
            {selection && quran ? (
              <div className="dock__slot dock__slot--range">
                <button type="button" className="dock__label dock__rangeLabel" onClick={() => setRangeMenuOpen(true)}>
                  {verseLabel(quran, selection)}
                </button>
                <button type="button" className="dock__clear" onClick={() => saveRange(null)} aria-label="مسح المقدار">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <button className="dock__slot" type="button" disabled={!quran} onClick={() => setRangeMenuOpen(true)}>
                <span className="dock__label">تحديد مقدار الآيات</span>
              </button>
            )}
          </footer>
        )}
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onStartReading={startReading}
        onShowAbout={() => {
          setSettingsOpen(false);
          setAboutOpen(true);
        }}
      />
      {quran && <SideMenu quran={quran} open={sideMenuOpen} onGoto={gotoPageNumber} onClose={() => setSideMenuOpen(false)} />}
      {quran && searchOpen && <SearchOverlay quran={quran} onGoto={gotoPageNumber} onClose={() => setSearchOpen(false)} />}
      <AboutPage open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div ref={backdropRef} className="study-backdrop" onClick={closeStudy} aria-hidden="true" />
      {quran && (
        <StudySheet
          ref={studyRef}
          open={studyOpen}
          panel={spread}
          onClose={closeStudy}
          onDrag={onStudyDrag}
          onDragEnd={onStudyDragEnd}
          onToast={showToast}
          quran={quran}
          verses={range}
          pages={rangePages}
        />
      )}
      {quran && pressed && <VerseMenu quran={quran} pressed={pressed} onClose={() => setPressed(null)} onToast={showToast} />}
      {quran && rangeMenuOpen && (
        <RangeMenu
          quran={quran}
          range={user.range}
          onPickStart={() => setPicking('start')}
          onPickEnd={() => setPicking('end')}
          onClose={() => setRangeMenuOpen(false)}
        />
      )}
      {quran && picking && (
        <RangePicker
          quran={quran}
          mode={picking}
          start={user.range?.[0]}
          near={pageVerses(quran, page)[0]}
          onPick={pickVerse}
          onClose={() => setPicking(null)}
        />
      )}
      {quran && listenOpen && (
        <ListenSheet
          quran={quran}
          verses={range}
          label={listenLabel}
          suras={listenSuras}
          onPlay={startListening}
          onClose={() => setListenOpen(false)}
          onToast={showToast}
        />
      )}
      {toast && (
        <div key={toast.n} className="toast" role="status">
          {toast.text}
        </div>
      )}
    </>
  );
}

// يظهر إن تعذّر تحميل المصحف في أول فتح (قبل أن يُخزَّن على الجهاز)
function LoadError() {
  return (
    <div className="load-error" role="alert">
      <p className="load-error__title">تعذّر تحميل المصحف</p>
      <p className="load-error__hint">
        يُحمَّل المصحف مرة واحدة عند أول فتح، ثم يعمل بلا إنترنت. تحقّق من الاتصال ثم أعد المحاولة.
      </p>
      <button className="load-error__retry" type="button" onClick={() => window.location.reload()}>
        إعادة المحاولة
      </button>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1A7.5 7.5 0 0 0 9.6 19l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
