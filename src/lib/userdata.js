// بيانات المستخدم على جهازه وحده (الفصل ٧): الملاحظات، والعلامات المرجعية، والنطاق المحدد.
// بلا حسابات ولا خادم. وكل تغيير يُعلَن بحدث واحد، فيتحدّث كل ما يعرضها (useUserData).
import { useEffect, useState } from 'react';

const NOTES_KEY = 'hq.notes';
const BOOKMARKS_KEY = 'hq.bookmarks';
const RANGE_KEY = 'hq.range';
const CONTENT_RANGE_KEY = 'hq.contentRange';
const EVENT = 'hq-userdata';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين غير متاح (تصفح خاص): يبقى التغيير في هذه الجلسة وحدها
  }
  window.dispatchEvent(new Event(EVENT));
}

// ---------- الملاحظات: واحدة لكل آية، بلا حدّ لعددها ----------
export const readNotes = () => read(NOTES_KEY, {});
export function setNote(v, text) {
  const notes = readNotes();
  if (text.trim()) notes[v] = text;
  else delete notes[v];
  write(NOTES_KEY, notes);
}

// ---------- العلامات المرجعية: بلا حدّ لعددها (٢٠٢٦-١١-١٤) ----------
// لكل علامة اسم يختاره المستخدم، ولون من ٤٠ لونًا جاهزًا، ونوع من اثنين:
//   • متنقّلة (multi: false): في آية واحدة من المصحف كله؛ وضعها على آية أخرى ينقلها إليها.
//   • متعددة (multi: true): في أي عدد من الآيات، ولا يزول منها شيء تلقائيًّا.
// وتجتمع العلامات على الآية الواحدة، وتُظلَّل الآية بلون آخر علامة وُضعت عليها (at: ترتيب الوضع).
// الشكل المحفوظ: [{ id, name, color: '#rrggbb', multi, verses: [{ v, at }] }]

// عشرة ألوان أساسية، لكلٍّ أربع درجات من الفاتح إلى الغامق؛ والثالثة هي ألوان العلامات القديمة نفسها
export const BOOKMARK_HUES = [
  { name: 'أحمر', shades: ['#f1948a', '#e74c3c', '#c0392b', '#922b21'] },
  { name: 'برتقالي', shades: ['#f8c471', '#eb984e', '#e67e22', '#ba4a00'] },
  { name: 'أصفر', shades: ['#f7dc6f', '#f1c40f', '#d4a017', '#9a7d0a'] },
  { name: 'أخضر', shades: ['#82e0aa', '#58b558', '#3f8f3f', '#1e5e1e'] },
  { name: 'فيروزي', shades: ['#76d7c4', '#1abc9c', '#16a085', '#0e6655'] },
  { name: 'أزرق', shades: ['#85c1e9', '#5dade2', '#2e7bc4', '#1a4f80'] },
  { name: 'بنفسجي', shades: ['#c39bd3', '#a569bd', '#8e44ad', '#5b2c6f'] },
  { name: 'وردي', shades: ['#f5a9c8', '#e57aa6', '#d35486', '#a12e5c'] },
  { name: 'بني', shades: ['#bcaaa4', '#a1887f', '#6d4c41', '#3e2723'] },
  { name: 'رمادي', shades: ['#cfd8dc', '#90a4ae', '#607d8b', '#37474f'] },
];
const SHADE_NAMES = ['فاتح', 'متوسط', '', 'غامق'];
export const BASE_SHADE = 2;
// اسم اللون للقارئ الصوتي: «أحمر فاتح»، «أحمر»، «أحمر غامق»
export const colorName = (hue, shade) => `${BOOKMARK_HUES[hue].name}${SHADE_NAMES[shade] ? ` ${SHADE_NAMES[shade]}` : ''}`;

// ألوان العلامات القديمة (حتى ٢٠٢٦-١١-١٤) برقمها، لتحويلها إلى الشكل الجديد
const OLD_COLORS = ['#c0392b', '#d4a017', '#3f8f3f', '#2e7bc4', '#8e44ad', '#e67e22', '#16a085', '#d35486', '#6d4c41', '#607d8b'];

// العلامة القديمة { id, v, color: رقم, name } تصير متنقّلة باسمها ولونها وآيتها
function upgrade(b, i) {
  if (Array.isArray(b?.verses)) return b;
  return {
    id: b.id,
    name: b.name,
    color: OLD_COLORS[b.color] ?? OLD_COLORS[0],
    multi: false,
    verses: Number.isInteger(b.v) ? [{ v: b.v, at: i + 1 }] : [],
  };
}

export const readBookmarks = () => {
  const list = read(BOOKMARKS_KEY, []);
  return Array.isArray(list) ? list.filter(Boolean).map(upgrade) : [];
};

const nextAt = (list) => Math.max(0, ...list.flatMap((b) => b.verses.map((x) => x.at))) + 1;
const nextId = (list) => Math.max(Date.now(), ...list.map((b) => b.id + 1));

const toArabic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// الاسم الافتراضي للعلامة الجديدة: «علامة ٣» (رقم لم يُستعمل)
export function defaultBookmarkName(list = readBookmarks()) {
  const names = new Set(list.map((b) => b.name));
  let n = list.length + 1;
  while (names.has(`علامة ${toArabic(n)}`)) n++;
  return `علامة ${toArabic(n)}`;
}

// اللون الافتراضي: أول لون أساسي لم تأخذه علامة، ثم تُعاد الألوان الأساسية بالترتيب
export function defaultBookmarkColor(list = readBookmarks()) {
  const used = new Set(list.map((b) => b.color));
  const base = BOOKMARK_HUES.map((h) => h.shades[BASE_SHADE]);
  return base.find((c) => !used.has(c)) ?? base[list.length % base.length];
}

// علامة جديدة (وتوضع على الآية v إن أُعطيت). النتيجة: رقم العلامة
export function createBookmark({ name, color, multi }, v) {
  const list = readBookmarks();
  const b = {
    id: nextId(list),
    name: name?.trim() || defaultBookmarkName(list),
    color: color || defaultBookmarkColor(list),
    multi: Boolean(multi),
    verses: Number.isInteger(v) ? [{ v, at: nextAt(list) }] : [],
  };
  list.push(b);
  write(BOOKMARKS_KEY, list);
  return b.id;
}

// وضع علامة على آية: المتنقّلة تنتقل إليها، والمتعددة تُضاف إليها الآية.
// وإن كانت عليها أصلًا صارت آخر علامة وُضعت عليها (فيظهر لونها). النتيجة: 'placed' | 'moved'
export function placeBookmark(id, v) {
  const list = readBookmarks();
  const b = list.find((x) => x.id === id);
  if (!b) return null;
  const at = nextAt(list);
  const moved = !b.multi && b.verses.some((x) => x.v !== v);
  if (b.multi) b.verses = [...b.verses.filter((x) => x.v !== v), { v, at }];
  else b.verses = [{ v, at }];
  write(BOOKMARKS_KEY, list);
  return moved ? 'moved' : 'placed';
}

// إزالة علامة عن آية واحدة (وتبقى العلامة نفسها بلا آيات إن كانت آخرها)
export function unplaceBookmark(id, v) {
  const list = readBookmarks();
  const b = list.find((x) => x.id === id);
  if (b) b.verses = b.verses.filter((x) => x.v !== v);
  write(BOOKMARKS_KEY, list);
}

// تعديل اسم العلامة أو لونها أو نوعها. والاسم الفارغ يُبقي القديم.
// وتحويل المتعددة إلى متنقّلة يُبقي آخر آية وُضعت فقط
export function updateBookmark(id, { name, color, multi }) {
  const list = readBookmarks();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  if (name !== undefined) b.name = name.trim() || b.name;
  if (color) b.color = color;
  if (multi !== undefined) {
    b.multi = Boolean(multi);
    if (!b.multi && b.verses.length > 1) b.verses = [b.verses.reduce((a, x) => (x.at > a.at ? x : a))];
  }
  write(BOOKMARKS_KEY, list);
}

export function removeBookmark(id) {
  write(BOOKMARKS_KEY, readBookmarks().filter((x) => x.id !== id));
}

// العلامات التي على الآية v، الأحدث وضعًا أولًا
export function bookmarksAt(list, v) {
  return list
    .map((b) => ({ b, at: b.verses.find((x) => x.v === v)?.at }))
    .filter((x) => x.at !== undefined)
    .sort((a, c) => c.at - a.at)
    .map((x) => x.b);
}

// لون تظليل كل آية معلّمة: لون آخر علامة وُضعت عليها. Map { آية ⇐ لون }، تُحسب مرة لكل قائمة
const shadesCache = new WeakMap();
export function bookmarkShades(list) {
  if (!list) return new Map();
  let map = shadesCache.get(list);
  if (map) return map;
  const latest = new Map();
  for (const b of list) {
    for (const { v, at } of b.verses ?? []) {
      const cur = latest.get(v);
      if (!cur || at > cur.at) latest.set(v, { at, color: b.color });
    }
  }
  map = new Map([...latest].map(([v, x]) => [v, x.color]));
  shadesCache.set(list, map);
  return map;
}

// ---------- المقداران المحددان: [أول آية، آخر آية] أو بدايته وحدها ----------
// مقداران مستقلان تمامًا (٢٠٢٦-١١-١٠): مقدار الاستماع، ومقدار صفحات المحتوى (التفسير ومعاني
// الكلمات والعمل بالآيات، ويتبعه منذ ٢٠٢٦-١١-١١ إخفات ما خارجه في المصحف ولو أثناء الاستماع).
// ويبقى كلٌّ حتى يُلغى بـ✕.
// ومفتاح مقدار الاستماع هو مفتاح المقدار القديم، فيبقى ما حدّده المستخدم من قبل.
export const readRange = () => read(RANGE_KEY, null);
export const saveRange = (range) => write(RANGE_KEY, range);
export const readContentRange = () => read(CONTENT_RANGE_KEY, null);
export const saveContentRange = (range) => write(CONTENT_RANGE_KEY, range);

const snapshot = () => ({ notes: readNotes(), bookmarks: readBookmarks(), range: readRange(), contentRange: readContentRange() });

// تتحدّث عند أي تغيير في بيانات المستخدم
export function useUserData() {
  const [data, setData] = useState(snapshot);
  useEffect(() => {
    const update = () => setData(snapshot());
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return data;
}

// نسخ نصّ للمشاركة، مع بديل للمتصفحات التي لا تتيح واجهة الحافظة
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
