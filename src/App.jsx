import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import SearchOverlay from './components/SearchOverlay.jsx';
import KhatmaPage from './components/KhatmaPage.jsx';
import { completeWird, useKhatma, wirdState } from './lib/khatma.js';
import { FOREVER, pause, play, resume, retarget, setSettings as setListenSettings, stop, usePlayer } from './lib/player.js';
import { toArabicDigits } from './data/quran.js';
import { pageVerses, verseLabel } from './lib/study.js';
import { saveContentRange, saveRange, useUserData } from './lib/userdata.js';
import { spreadStart } from './lib/layout.js';
import { hasOpenLayer } from './lib/layers.js';
import { useRubAlert } from './lib/rubs.js';
import { onOfflineNotice, verifyDownloads } from './lib/offline.js';
import './App.css';

// أقصر مدّة تبقى فيها شاشة الافتتاح ولو كانت البيانات جاهزة فورًا من ذاكرة
// الجهاز، ليُرى الشعار لحظةً عند كل فتح كما نصّت المواصفة (الفصل ١١) لا وميضًا.
// وتبقى أطول من ذلك إن طال تحميل المصحف أول مرة.
const SPLASH_MIN_MS = 0; // لا شاشة ثانية: تكفي شاشة النظام (أيقونة التطبيق) ثم المصحف مباشرة
const SPLASH_FADE_MS = 420;
// الأزرار العائمة الظاهرة بتحريك الفأرة تختفي بعد توقفها هذه المدة
const MOUSE_IDLE_MS = 2500;
// مهلة احتياطية لزوال التمييز المؤقت إن لم تُرسم الآية (كتعذّر خط صفحتها)
const FLASH_FALLBACK_MS = 12000;

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
  // صفحة ورد الختمة (٢٠٢٦-١١-١٢): تُفتح من تبويب الختمة في القائمة اليمنى، ويُرجَع منها إليه
  const [khatmaOpen, setKhatmaOpen] = useState(false);
  const khatma = useKhatma();
  const wird = khatma.wird && !khatma.wird.finished ? wirdState(khatma.wird) : null;
  // الآية المميَّزة تمييزًا مؤقتًا بعد الانتقال إليها من البحث: { v: موضعها، n }
  const [flash, setFlash] = useState(null);
  // صفحة لوحة الإعدادات الظاهرة: الإعدادات نفسها، أو صفحة فرعية فيها («عن التطبيق»)
  const [settingsPage, setSettingsPage] = useState('main');
  // صفحات المحتوى (تفسير · معاني الكلمات · العمل بالآيات): تُفتح بزرّها في الشريط السفلي —
  // صفحة كاملة في عرض الصفحة الواحدة، ولوحة متمركزة في عرض الصفحتين (الفصل ٥)
  const [studyOpen, setStudyOpen] = useState(false);
  // وضع القراءة (٢٠٢٦-١٠-١٨): تدفّق رأسي بتمرير تلقائي. لا يُحفظ بين الجلسات: يفتح التطبيق بالعادي دائمًا
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState(readLastPage);
  // الصفحتان معًا (الشاشات الكبيرة): يبلّغ به القارئ بحسب المساحة المتاحة
  const [spread, setSpread] = useState(false);
  const shownPages = useMemo(() => (spread ? [spreadStart(page), spreadStart(page) + 1] : [page]), [spread, page]);
  const user = useUserData();
  // المقداران المستقلان (٢٠٢٦-١١-١٠): مقدار الاستماع، ومقدار صفحات المحتوى (ويتبعه
  // إخفات ما خارجه في المصحف). وكلاهما إن لم يكتمل فالمعتمد آيات الصفحة الظاهرة، أو الصفحتين
  // الظاهرتين معًا من أول اليمنى إلى آخر اليسرى
  const selection = user.range?.length === 2 ? user.range : null;
  // مقدار استماع ببداية بلا نهاية (٢٠٢٦-١١-١٢): يبدأ من آيته متتابعًا إلى آخر المصحف
  const listenStart = user.range?.length === 1 ? user.range[0] : null;
  const contentSel = user.contentRange?.length === 2 ? user.contentRange : null;
  const shownVerses = useMemo(
    () => (quran ? [...new Set(shownPages.flatMap((p) => pageVerses(quran, p)))] : []),
    [quran, shownPages]
  );
  const span = (sel) => Array.from({ length: sel[1] - sel[0] + 1 }, (_, i) => sel[0] + i);
  const range = useMemo(() => (selection ? span(selection) : shownVerses), [shownVerses, selection?.[0], selection?.[1]]);
  const contentVerses = useMemo(
    () => (contentSel ? span(contentSel) : shownVerses),
    [shownVerses, contentSel?.[0], contentSel?.[1]]
  );
  const contentPages = useMemo(
    () => (quran ? [...new Set(contentVerses.map((v) => quran.verses[v].p))] : []),
    [quran, contentVerses]
  );

  // الضغط المطوّل على آية، وقائمة اختيار آية النطاق، والتنبيه القصير
  const [pressed, setPressed] = useState(null);
  // منتقي الآيات: { target: 'listen' | 'content', mode: 'start' | 'end' }
  const [picking, setPicking] = useState(null);
  const [gotoPage, setGotoPage] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((text) => setToast({ text, n: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  // تحميل القرّاء على الجهاز (src/lib/offline.js): رسالة عند اكتماله أو توقّفه أينما كان المستخدم،
  // والتحقق عند الفتح أن ما سُجِّل محمَّلًا ما زال محفوظًا
  useEffect(() => onOfflineNotice(showToast), [showToast]);
  useEffect(() => {
    verifyDownloads();
  }, []);

  // الاستماع (الفصل ٦): المقدار المسموع مقدار الاستماع المحدد. وبلا مقدار (٢٠٢٦-١١-١١): من أول الصفحة
  // الظاهرة (أو أول اليمنى من الصفحتين) متتابعًا إلى آخر المصحف، يقلّب الصفحات معه بلا توقف ولا تكرار
  // للمقدار. والتنزيل بلا مقدار يبقى للصفحة أو الصفحتين الظاهرتين (range)
  const player = usePlayer();
  const [listenOpen, setListenOpen] = useState(false);
  // ما يُنزَّل للاستماع بلا إنترنت: المقدار المحدد، أو من آية البداية إلى آخر صفحتها إن حُددت البداية
  // وحدها، وإلا الصفحة أو الصفحتان الظاهرتان
  const listenVerses = useMemo(
    () => (quran && !selection && listenStart != null ? pageVerses(quran, quran.verses[listenStart].p).filter((v) => v >= listenStart) : range),
    [quran, selection, listenStart, range]
  );
  const listenSuras = useMemo(() => (quran ? [...new Set(listenVerses.map((v) => quran.verses[v].s))] : []), [quran, listenVerses]);
  const listenLabel =
    quran &&
    (selection
      ? verseLabel(quran, selection)
      : listenStart != null
        ? `من ${verseLabel(quran, [listenStart])} إلى آخر المصحف`
        : spread
        ? `من الصفحتين ${toArabicDigits(shownPages[0])}–${toArabicDigits(shownPages[1])} متتابعًا`
        : `من الصفحة ${toArabicDigits(page)} متتابعًا`);
  // ما يُشغَّل: المقدار المحدد؛ وإلا من آية البداية إن حُددت وحدها، أو من أول الآيات الظاهرة، إلى آخر المصحف
  const playFrom = listenStart ?? shownVerses[0];
  const playVerses = () =>
    selection ? range : Array.from({ length: quran.verses.length - playFrom }, (_, i) => playFrom + i);
  // مقدار الاستماع الذي بدأ به التشغيل الجاري (كما حُفظ: بداية ونهاية، أو بداية وحدها): إن عُدِّل أثناءه
  // طُبِّق عند إغلاق نافذة الاستماع («تم»)
  const playedSel = useRef(null);
  const sameSel = (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1];
  // نقل المصحف إلى صفحة آية إن لم تكن ظاهرة: صفحتها في عرض الصفحة الواحدة، وزوجها في عرض الصفحتين
  // (Reader يحوّل الصفحة إلى أول زوجها)
  const showVerse = (v) => {
    const p = quran.verses[v].p;
    if (!shownPages.includes(p)) setGotoPage({ page: p, n: Date.now() });
  };
  const startListening = () => {
    playedSel.current = user.range;
    // الانتقال إلى بداية المقدار (٢٠٢٦-١١-١١): من أول ضغطة تشغيل، قبل أن يبدأ الصوت، ينتقل المصحف إلى
    // صفحة أول آية في مقدار الاستماع إن كان بعيدًا عن الظاهر — ومثله البداية وحدها. وبلا مقدار يبدأ من
    // الظاهر فلا انتقال
    if (user.range?.length) showVerse(user.range[0]);
    // play() ترجع 'unsupported' أو 'playing' (src/lib/player.js)، ونافذة الاستماع تبقى مفتوحة كما كانت
    if (play(quran, playVerses(), !selection) === 'unsupported') showToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
    // أخطاء التشغيل نفسه تظهر من التأثير أدناه (player.error)
  };
  // زرّ «تشغيل» في بطاقة الضغط المطوّل (٢٠٢٦-١١-١٢): قراءة عادية من هذه الآية بالقارئ المحدد، بلا
  // نهاية ولا تكرار، متتابعةً إلى آخر المصحف. فيصير مقدار الاستماع «البداية = هذه الآية» بلا نهاية،
  // ويُرجَع تكرار الآية وتكرار المقدار كلاهما إلى «بدون تكرار» (فلا يعود تكرار سابق للمقدار إن أُضيفت
  // نهاية بعدها)؛ ثم يعدّل المستخدم من نافذة الاستماع ما شاء (النهاية والقارئ والتكرار) فيُطبَّق عند
  // إغلاقها كالمعتاد. وإن كان استماع جارٍ بدأ من هذه الآية بدله
  const playFromVerse = (v) => {
    saveRange([v]);
    setListenSettings({ verseRepeat: 1, rangeRepeat: 1 });
    playedSel.current = [v];
    showVerse(v);
    const verses = Array.from({ length: quran.verses.length - v }, (_, i) => v + i);
    if (play(quran, verses, true) === 'unsupported') showToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
  };
  // «تشغيل الآية وحدها» من مربع الضغط المطوّل (٢٠٢٦-١١-١٢): مقدار الاستماع يصير هذه الآية بدايةً ونهاية،
  // وتُقرأ times مرة: بتكرار الآية (فالبسملة قبلها مرة واحدة إن كانت أول سورتها)، و«بلا نهاية» بتكرار
  // المقدار (فتكرار الآية لا يعرف «بلا نهاية»). ثم يُعدَّل التكرار من نافذة الاستماع كالمعتاد
  const playVerseAlone = (v, times) => {
    saveRange([v, v]);
    setListenSettings(times === FOREVER ? { verseRepeat: 1, rangeRepeat: FOREVER } : { verseRepeat: times, rangeRepeat: 1 });
    playedSel.current = [v, v];
    showVerse(v);
    if (play(quran, [v]) === 'unsupported') showToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
  };
  // إغلاق نافذة الاستماع أثناء التشغيل بعد تعديل المقدار: الآية الجارية خارج المقدار الجديد ⇐ يبدأ من
  // أوله بعدّاد تكرار جديد؛ وداخله ⇐ يكمل من حيث هو وينتهي عند النهاية الجديدة (retarget)
  const closeListen = () => {
    setListenOpen(false);
    if (player.status === 'idle' || sameSel(user.range, playedSel.current)) return;
    playedSel.current = user.range;
    if (retarget(quran, playVerses(), !selection) === 'unsupported') showToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
  };
  useEffect(() => {
    if (player.error) showToast(player.error.text);
  }, [player.error, showToast]);
  // التقليب التلقائي: عند بدء كل آية (ومنها إعادة المقدار وتكرار الآية) إن لم تكن صفحتها ظاهرة انتقل
  // المصحف إليها — صفحةً في عرض الصفحة الواحدة، وزوجًا في عرض الصفحتين (فالانتقال إلى صفحة من الزوج
  // الظاهر لا يغيّره). ويُقارَن بالصفحات الظاهرة فعلًا لا بآخر صفحة طُلبت، فإن قلّب المستخدم بيده أعاده
  // إلى صفحة القارئ عند بدء الآية التالية. (كان يُقارَن بآخر صفحة طلبها التقليب نفسه، فإذا قلّب المستخدم
  // بيده لم يعُد المصحف إلى القارئ ما دامت الآيات في تلك الصفحة.)
  const shownRef = useRef(shownPages);
  shownRef.current = shownPages;
  useEffect(() => {
    if (!quran || player.v == null) return;
    const p = quran.verses[player.v].p;
    if (!shownRef.current.includes(p)) setGotoPage({ page: p, n: Date.now() });
  }, [quran, player.v, player.n]);

  // الإخفات (٢٠٢٦-١١-١١): يتبع مقدار صفحات المحتوى وحده، فيُخفت في المصحف ما خارجه ويزول بإلغائه،
  // ولو أثناء الاستماع. ومقدار الاستماع لا يُخفت شيئًا؛ والآية الجارية مظلَّلة، وإن كانت خارج مقدار
  // صفحات المحتوى بقي نصّها شفافًا وتظليلها خلفه (MushafPage.css)
  // التنبيه عند الوصول إلى صفحة فيها بداية ربع (٢٠٢٦-١١-١٣): رسالة بنوعه ووميض علامته. ولا تنبيه عند
  // أول فتح للتطبيق، ولا في وضع القراءة، ولا والمصحف خلف صفحات المحتوى أو صفحة الورد (src/lib/rubs.js)
  const rubFlash = useRubAlert({
    quran,
    pages: shownPages,
    enabled: !!quran && splashDone && !reading && !studyOpen && !khatmaOpen,
    onToast: showToast,
  });
  const marks = useMemo(
    () => ({ notes: user.notes, bookmarks: user.bookmarks, range: contentSel, selected: pressed?.v ?? null, playing: player.v, flash: flash?.v ?? null, rubFlash }),
    [user.notes, user.bookmarks, contentSel?.[0], contentSel?.[1], pressed?.v, player.v, flash?.v, rubFlash]
  );

  // دخول وضع القراءة من الإعدادات: يُوقَف الصوت بهدوء (الاستماع وتحديد المقدار لا يعملان فيه)،
  // ثم يبدأ التدفق من الصفحة الحالية. والخروج يعيد المصحف العادي على الصفحة التي في منتصف الشاشة
  const startReading = () => {
    closeSettings();
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
  const readingMarks = useMemo(() => ({ ...marks, range: null, playing: null, rubFlash: null }), [marks]);
  // صفحة الورد تنبّه ببداية الربع وحدها (KhatmaPage)
  const khatmaMarks = useMemo(() => ({ ...marks, range: null, playing: null, flash: null, rubFlash: null }), [marks]);

  const onLongPress = useCallback((v, rect) => {
    setChromeOpen(false);
    setPressed({ v, rect });
  }, []);

  // اختيار آية من المنتقي: البداية ثم النهاية، كلٌّ في مقداره. واختيار البداية وحده لا يحرّك المصحف.
  // ومقدار الاستماع لا يحرّكه عند التحديد أصلًا (ينتقل عند التشغيل، startListening). أما مقدار صفحات
  // المحتوى (٢٠٢٦-١١-١١، بدل إبقاء المصحف مكانه): عند اكتماله ينتقل المصحف خلف صفحات المحتوى إلى صفحة
  // أول آية فيه (وزوجها في عرض الصفحتين)، فإذا أغلقها وجد المقدار أمامه وما خارجه مُخفَت
  const pickVerse = (v) => {
    const content = picking.target === 'content';
    const save = content ? saveContentRange : saveRange;
    if (picking.mode === 'start') save([v]);
    else {
      const s = (content ? user.contentRange : user.range)[0];
      save(v < s ? [v, s] : [s, v]);
      if (content) showVerse(Math.min(v, s));
    }
    setPicking(null);
  };

  // فتح صفحات المحتوى بزرّها وحده، وإغلاقها بزرّ الرجوع (أو ✕) وEsc والنقر خارج اللوحة، وبزرّ
  // الرجوع في أندرويد: فتحها يضيف خطوة إلى سجل المتصفح، والرجوع فيه يغلقها
  const studyRef = useRef(null);
  const openStudy = useCallback(() => {
    setChromeOpen(false);
    setStudyOpen(true);
    try {
      window.history.pushState({ hqStudy: true }, '');
    } catch {
      // بلا سجل (نادر): تُغلق بأزرارها وحدها
    }
  }, []);
  const closeStudy = useCallback(() => {
    if (window.history.state?.hqStudy) window.history.back();
    else setStudyOpen(false);
  }, []);
  useEffect(() => {
    // خطوة متبقية من جلسة سابقة (إعادة تحميل والصفحة مفتوحة) لا تُعدّ مفتوحة
    if (window.history.state?.hqStudy) window.history.replaceState(null, '');
    const onPop = () => {
      if (window.history.state?.hqStudy) return;
      setStudyOpen(false);
      setPicking((p) => (p?.target === 'content' ? null : p));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // لوحة الإعدادات (يسارًا) والقائمة الجانبية (يمينًا) لا تُفتحان معًا: فتح إحداهما يغلق الأخرى.
  // فتح الإعدادات يضيف خطوة إلى سجل المتصفح (وصفحتها الفرعية خطوة ثانية)، فزرّ الرجوع في أندرويد
  // يرجع من «عن التطبيق» إلى الإعدادات ثم يغلقها. وكل إغلاق آخر (✕، النقر خارجها، السحب، Esc)
  // يرجع في السجل بقدر خطواتها
  const openSettings = useCallback(() => {
    setSideMenuOpen(false);
    setChromeOpen(false);
    setSettingsPage('main');
    setSettingsOpen(true);
    try {
      if (!window.history.state?.hqSettings) window.history.pushState({ hqSettings: 1 }, '');
    } catch {
      // بلا سجل (نادر): تُغلق بأزرارها وحدها
    }
  }, []);
  const closeSettings = useCallback(() => {
    const depth = window.history.state?.hqSettings;
    if (depth) window.history.go(-depth);
    else {
      setSettingsOpen(false);
      setSettingsPage('main');
    }
  }, []);
  const showSettingsPage = useCallback((next) => {
    const depth = window.history.state?.hqSettings;
    if (next === 'main') {
      if (depth === 2) window.history.back();
      else setSettingsPage('main');
      return;
    }
    setSettingsPage(next);
    try {
      if (depth === 1) window.history.pushState({ hqSettings: 2 }, '');
    } catch {
      // بلا سجل: سهم الرجوع وحده
    }
  }, []);
  // صفحة الختمة: فتحها يغلق القائمة ويضيف خطوة إلى سجل المتصفح (فزرّ الرجوع في أندرويد يغلقها)،
  // وإغلاقها بأي طريق يعيد القائمة على تبويب الختمة، فيُرى الورد التالي أو التهنئة
  const openKhatma = useCallback(() => {
    setSideMenuOpen(false);
    setChromeOpen(false);
    setKhatmaOpen(true);
    try {
      window.history.pushState({ hqKhatma: true }, '');
    } catch {
      // بلا سجل: تُغلق بزرّ الرجوع فيها
    }
  }, []);
  const khatmaOpenRef = useRef(false);
  khatmaOpenRef.current = khatmaOpen;
  const afterKhatma = useCallback(() => {
    setKhatmaOpen(false);
    setSideMenuOpen(true);
  }, []);
  const closeKhatma = useCallback(() => {
    if (window.history.state?.hqKhatma) window.history.back();
    else afterKhatma();
  }, [afterKhatma]);
  useEffect(() => {
    if (window.history.state?.hqKhatma) window.history.replaceState(null, '');
    const onPop = () => {
      if (!window.history.state?.hqKhatma && khatmaOpenRef.current) afterKhatma();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [afterKhatma]);
  const finishWird = () => {
    const result = completeWird();
    if (result === 'next') showToast('أحسنت، تم تسجيل الورد');
    else if (result === 'finished') showToast('أتممت الختمة، تقبل الله منك');
    closeKhatma();
  };

  const openSideMenu = useCallback(() => {
    if (window.history.state?.hqSettings) window.history.go(-window.history.state.hqSettings);
    setSettingsOpen(false);
    setSettingsPage('main');
    setSideMenuOpen(true);
  }, []);
  useEffect(() => {
    if (window.history.state?.hqSettings) window.history.replaceState(null, '');
    const onPop = () => {
      const depth = window.history.state?.hqSettings;
      if (depth === 1) setSettingsPage('main');
      else if (!depth) {
        setSettingsOpen(false);
        setSettingsPage('main');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      overChrome.current = !!e.target.closest?.('.topbar__icon, .topbar__search, .dock__slot, .dock__clear, .reader__arrow');
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

  // الانتقال إلى صفحة من القائمة الجانبية أو البحث؛ ومن نتيجة آية في البحث تُميَّز الآية تمييزًا مؤقتًا
  const gotoPageNumber = useCallback((p, verse) => {
    setGotoPage({ page: p, n: Date.now() });
    setFlash(verse == null ? null : { v: verse, n: Date.now() });
  }, []);

  // التمييز المؤقت (٢٠٢٦-١١-١٢): يبدأ حين تُرسم الآية في صفحتها (ولو تأخر خط الصفحة)، ويتلاشى
  // بعد نحو ٣ ثوانٍ (MushafPage.css)، فيزول بنهاية تلاشيه، وإلا بعد مهلة احتياطية إن لم تُرسم
  useEffect(() => {
    if (!flash) return;
    const end = () => setFlash((f) => (f === flash ? null : f));
    const onEnd = (e) => e.animationName === 'verse-flash' && end();
    document.addEventListener('animationend', onEnd);
    const timer = setTimeout(end, FLASH_FALLBACK_MS);
    return () => {
      document.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
    };
  }, [flash]);

  // ما دامت فوق المصحف صفحة أو قائمة أو بطاقة، فهو خارج التركيز ولوحة المفاتيح (inert)
  const covered =
    studyOpen || settingsOpen || sideMenuOpen || searchOpen || !!pressed || !!picking || listenOpen || khatmaOpen;
  const chromeShown = chromeOpen && !covered;

  return (
    <>
      {!splashDone && <SplashScreen leaving={splashLeaving} />}

      <div
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
          <button className="topbar__icon" type="button" onClick={openSideMenu} disabled={!quran} aria-label="القائمة">
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
            <span>ابحث في المصحف بالكلمات والأرقام</span>
          </button>

          {/* الإعدادات أعلى اليسار مقابل القائمة: لوحة جانبية من اليسار، وفيها تبديل الوضع الفاتح والداكن */}
          <button className="topbar__icon" type="button" onClick={openSettings} aria-label="الإعدادات">
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
              onLongPress={onLongPress}
              goto={gotoPage}
              marks={marks}
            />
          )}
          {failed && <LoadError />}
        </main>

        {/* الزرّان السفليان (٢٠٢٦-١١-١٠): «الاستماع للآيات» يمينًا و«صفحات المحتوى» يسارًا —
            في التخطيط من اليمين لليسار يقع أول عنصر يمينًا. ولا زرّ لتحديد المقدار هنا: لكلٍّ
            من الاستماع وصفحات المحتوى تحديده داخله.
            وهما مخفيتان أصلًا (بطلب صاحب المشروع)، تنزلقان من الأسفل فوق الصفحة عند اللمس أو
            تحريك الفأرة، فلا يتغير حجم خط المصحف بظهورهما. وفي عرض الصفحتين يقع كل زرّ تحت
            صفحته بعرض سطرها كاملًا (App.css) */}
        {!reading && (
          <footer
            className={`dock${chromeShown ? ' dock--open' : ''}`}
            aria-hidden={!chromeShown}
            inert={chromeShown ? undefined : ''}
          >
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
                  <span className="dock__label">الاستماع للآيات</span>
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
            {/* صفحات المحتوى، وفيها ✕ صغير ما دام لها مقدار (٢٠٢٦-١١-١٢): يلغيه فورًا ويزيل الإخفات دون أن
                يفتحها. وهو زرّ مستقل فوق طرف الخانة (لا داخل زرّها)، بمساحة لمس كاملة الارتفاع لا تتداخل مع
                مساحة فتحها، ويُفسح له الزرّ مكانه فيبقى اسمه في وسط ما بقي */}
            <div className={`dock__study${user.contentRange?.length ? ' dock__study--range' : ''}`}>
              <button className="dock__slot" type="button" disabled={!quran} onClick={openStudy}>
                <span className="dock__label">صفحات المحتوى</span>
              </button>
              {quran && user.contentRange?.length > 0 && (
                <button type="button" className="dock__clear" onClick={() => saveContentRange(null)} aria-label="إلغاء مقدار المحتوى" title="إلغاء المقدار">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </footer>
        )}
      </div>

      <SettingsSheet
        open={settingsOpen}
        panel={spread}
        page={settingsPage}
        onPage={showSettingsPage}
        onClose={closeSettings}
        onStartReading={startReading}
      />
      {quran && (
        <SideMenu
          quran={quran}
          open={sideMenuOpen}
          onGoto={gotoPageNumber}
          onClose={() => setSideMenuOpen(false)}
          onReadWird={openKhatma}
          onToast={showToast}
        />
      )}
      {quran && khatmaOpen && wird?.current && (
        <KhatmaPage
          key={wird.current[0]}
          quran={quran}
          wird={wird.current}
          next={wird.doneToday}
          onClose={closeKhatma}
          onComplete={finishWird}
          onLongPress={onLongPress}
          onToast={showToast}
          marks={khatmaMarks}
        />
      )}
      {quran && searchOpen && <SearchOverlay quran={quran} onGoto={gotoPageNumber} onClose={() => setSearchOpen(false)} />}
      <div
        className={`study-backdrop${studyOpen && spread ? ' study-backdrop--open' : ''}`}
        onClick={closeStudy}
        aria-hidden="true"
      />
      {quran && (
        <StudySheet
          ref={studyRef}
          open={studyOpen}
          panel={spread}
          onClose={closeStudy}
          onToast={showToast}
          quran={quran}
          verses={contentVerses}
          pages={contentPages}
          range={user.contentRange}
          onPickStart={() => setPicking({ target: 'content', mode: 'start' })}
          onPickEnd={() => setPicking({ target: 'content', mode: 'end' })}
          onClearRange={() => saveContentRange(null)}
        />
      )}
      {quran && pressed && <VerseMenu quran={quran} pressed={pressed} onClose={() => setPressed(null)} onToast={showToast} onPlay={playFromVerse} onPlayAlone={playVerseAlone} noPlay={khatmaOpen} />}
      {quran && listenOpen && (
        <ListenSheet
          quran={quran}
          verses={listenVerses}
          continuous={!selection}
          label={listenLabel}
          suras={listenSuras}
          range={user.range}
          onPickStart={() => setPicking({ target: 'listen', mode: 'start' })}
          onPickEnd={() => setPicking({ target: 'listen', mode: 'end' })}
          onClearRange={() => saveRange(null)}
          onPlay={startListening}
          onClose={closeListen}
          onToast={showToast}
        />
      )}
      {/* منتقي الآيات فوق صاحبه (صفحات المحتوى أو نافذة الاستماع)، يُرجع إليه بعد الاختيار */}
      {quran && picking && (
        <RangePicker
          quran={quran}
          mode={picking.mode}
          start={(picking.target === 'content' ? user.contentRange : user.range)?.[0]}
          near={shownVerses[0]}
          onPick={pickVerse}
          onClose={() => setPicking(null)}
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
