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

// حجم خط عناصر الواجهة: خط واحد ثابت لا يتحكم به المستخدم (بقرار صاحب المشروع ٢٠٢٦-٠٩-٢٥،
// يُلغي ميزة اختيار الحجم). --ui-scale يبقى ثابتًا على ١ في src/styles/tokens.css.

// ---------- وضع القراءة (٢٠٢٦-١٠-١٨) ----------
// سرعة التمرير التلقائي بوحدة «أسطر في الدقيقة» لا بالبكسل، فتبقى وتيرة القراءة واحدة على كل
// الشاشات وأحجام الخط. وآخر سرعة اختارها المستخدم تُحفظ وتُستعمل في المرة القادمة.
// أما الوضع نفسه فلا يُحفظ: يفتح التطبيق دائمًا بالوضع العادي.
// المدى ٢–٦٠ (٢٠٢٦-١١-١٤: كان أقصاه ٣٠، فضوعف بطلب صاحب المشروع، وبقي أبطؤه كما هو).
export const READ_SPEED_MIN = 2;
export const READ_SPEED_MAX = 60;
export const READ_SPEED_DEFAULT = 8;
// شريط السرعة متدرّج لا متساوٍ: نصفه الأبطأ للسرعات ٢–١٥ (فيبقى ضبطها بالإصبع دقيقًا كما كان
// أو أدق)، ونصفه الأسرع للسرعات ١٥–٦٠ وهي أقل استعمالًا. كلٌّ من النصفين خطّي.
export const READ_SPEED_MID = 15;

// السرعة ← موضعها على الشريط (٠ أبطأ طرف، ١ أسرعه)
export function speedToRatio(v) {
  const n = Math.min(READ_SPEED_MAX, Math.max(READ_SPEED_MIN, v));
  if (n <= READ_SPEED_MID) return (0.5 * (n - READ_SPEED_MIN)) / (READ_SPEED_MID - READ_SPEED_MIN);
  return 0.5 + (0.5 * (n - READ_SPEED_MID)) / (READ_SPEED_MAX - READ_SPEED_MID);
}

// موضع على الشريط ← السرعة، مقرَّبةً: بخطوات نصف سطر في النصف الأبطأ، وسطر كامل في الأسرع
export function ratioToSpeed(t) {
  const r = Math.min(1, Math.max(0, t));
  if (r <= 0.5) {
    const v = READ_SPEED_MIN + (r / 0.5) * (READ_SPEED_MID - READ_SPEED_MIN);
    return Math.round(v * 2) / 2;
  }
  return Math.round(READ_SPEED_MID + ((r - 0.5) / 0.5) * (READ_SPEED_MAX - READ_SPEED_MID));
}

// خطوة لوحة المفاتيح: سطر واحد في النصف الأبطأ، وثلاثة في الأسرع. dir = ١ أسرع، -١ أبطأ
export function stepSpeed(v, dir) {
  const fastHalf = dir > 0 ? v >= READ_SPEED_MID : v > READ_SPEED_MID;
  const n = v + dir * (fastHalf ? 3 : 1);
  return Math.min(READ_SPEED_MAX, Math.max(READ_SPEED_MIN, n));
}
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
