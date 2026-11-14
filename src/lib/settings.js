// إعدادات المستخدم التي تُحفظ على جهازه وتبقى بين الفتحات.
// (صفحة الإعدادات نفسها في القائمة الجانبية — المرحلة السابعة؛ هذا أساسها.)

const WEEKS_KEY = 'hq.weeks';

// تمييز مقررات الأسابيع في المصحف بالتناوب: ملغى افتراضيًّا، ويُفعّله المستخدم من الإعدادات
// (بقرار صاحب المشروع). يُطبَّق سمةً على الجذر (data-weeks)، فيظهر اللون أو يختفي فورًا
// بلا إعادة رسم للصفحات.
export function readWeeksTint() {
  try {
    return localStorage.getItem(WEEKS_KEY) === 'on';
  } catch {
    return false;
  }
}

export function applyWeeksTint(on = readWeeksTint()) {
  document.documentElement.setAttribute('data-weeks', on ? 'on' : 'off');
}

export function setWeeksTint(on) {
  try {
    localStorage.setItem(WEEKS_KEY, on ? 'on' : 'off');
  } catch {
    // التخزين غير متاح (تصفح خاص): يسري الاختيار في هذه الجلسة وحدها
  }
  applyWeeksTint(on);
}

// التنبيه ببداية الربع (٢٠٢٦-١١-١٤): مفعَّل افتراضيًّا، ويُلغيه المستخدم من الإعدادات. يُقرأ عند كل
// وصول إلى صفحة (useRubAlert في src/lib/rubs.js)، فيسري تغييره فورًا في المصحف وصفحة الورد.
const RUB_ALERT_KEY = 'hq.rubAlert';
// احتياط لتعذّر التخزين: آخر اختيار في هذه الجلسة
let rubAlertSession = true;

export function readRubAlert() {
  try {
    return localStorage.getItem(RUB_ALERT_KEY) !== 'off';
  } catch {
    return rubAlertSession;
  }
}

export function setRubAlert(on) {
  try {
    localStorage.setItem(RUB_ALERT_KEY, on ? 'on' : 'off');
  } catch {
    // التخزين غير متاح (تصفح خاص): يسري الاختيار في هذه الجلسة وحدها
    rubAlertSession = on;
  }
}

// حجم خط عناصر الواجهة: خط واحد ثابت لا يتحكم به المستخدم (بقرار صاحب المشروع ٢٠٢٦-٠٩-٢٥،
// يُلغي ميزة اختيار الحجم). --ui-scale يبقى ثابتًا على ١ في src/styles/tokens.css.

// ---------- وضع القراءة (٢٠٢٦-١٠-١٨) ----------
// سرعة التمرير التلقائي بوحدة «أسطر في الدقيقة» لا بالبكسل، فتبقى وتيرة القراءة واحدة على كل
// الشاشات وأحجام الخط. وآخر سرعة اختارها المستخدم تُحفظ وتُستعمل في المرة القادمة.
// أما الوضع نفسه فلا يُحفظ: يفتح التطبيق دائمًا بالوضع العادي.
export const READ_SPEED_MIN = 2;
export const READ_SPEED_MAX = 30;
export const READ_SPEED_DEFAULT = 8;
const READ_SPEED_KEY = 'hq.readSpeed';

export function readReadingSpeed() {
  try {
    const n = parseFloat(localStorage.getItem(READ_SPEED_KEY));
    if (n >= READ_SPEED_MIN && n <= READ_SPEED_MAX) return n;
  } catch {
    // يُستعمل الافتراضي
  }
  return READ_SPEED_DEFAULT;
}

export function saveReadingSpeed(n) {
  try {
    localStorage.setItem(READ_SPEED_KEY, String(n));
  } catch {
    // تبقى السرعة سارية في هذه الجلسة ولو تعذّر حفظها
  }
}
