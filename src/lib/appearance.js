// المظهر (٢٠٢٦-١١-١١): «خلفية القراءة» و«لون التطبيق».
//
// القائمتان في src/data/appearance.json وحدها: الخلفية سطر فيه لونها ولون نص المصحف وهل هي داكنة،
// واللون سطر فيه درجتاه (للخلفيات الفاتحة وللداكنة). إضافة خلفية أو لون = سطر واحد هناك، وكل
// الألوان الفرعية (البطاقات والقوائم والحدود والنصوص الثانوية والتظليل) تُشتق تلقائيًّا في
// src/styles/tokens.css.
//
// التطبيق الفعلي في سكربت index.html قبل رسم الصفحة (منعًا للوميض)، وهو الذي يعرّف
// window.hqAppearance.apply؛ وما هنا يستعملها عند التبديل من الإعدادات، فلا تُكتب مرتين.
import DATA from '../data/appearance.json';

export const BACKGROUNDS = DATA.backgrounds;
export const ACCENTS = DATA.accents;

const BG_KEY = 'hq.bg';
const ACCENT_KEY = 'hq.accent';

const root = () => document.documentElement;

export function readAppearance() {
  return {
    bg: root().getAttribute('data-bg') || DATA.defaults.light,
    accent: root().getAttribute('data-accent') || DATA.defaults.accent,
  };
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // التخزين غير متاح (تصفح خاص): يسري الاختيار في هذه الجلسة وحدها
  }
}

function apply(bg, accent) {
  return window.hqAppearance.apply(bg, accent);
}

export function setBackground(id) {
  if (!BACKGROUNDS.some((b) => b.id === id)) return readAppearance();
  save(BG_KEY, id);
  return apply(id, readAppearance().accent);
}

export function setAccent(id) {
  if (!ACCENTS.some((a) => a.id === id)) return readAppearance();
  save(ACCENT_KEY, id);
  return apply(readAppearance().bg, id);
}
