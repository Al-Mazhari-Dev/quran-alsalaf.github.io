// بيانات المستخدم على جهازه وحده (الفصل ٧): الملاحظات، والعلامات المرجعية، والنطاق المحدد.
// بلا حسابات ولا خادم. وكل تغيير يُعلَن بحدث واحد، فيتحدّث كل ما يعرضها (useUserData).
import { useEffect, useState } from 'react';

const NOTES_KEY = 'hq.notes';
const BOOKMARKS_KEY = 'hq.bookmarks';
const RANGE_KEY = 'hq.range';
const CONTENT_RANGE_KEY = 'hq.contentRange';
const EVENT = 'hq-userdata';

export const MAX_BOOKMARKS = 10;
// عشرة ألوان مميزة للعلامات (على نسق «آية»)
export const BOOKMARK_COLORS = ['#c0392b', '#d4a017', '#3f8f3f', '#2e7bc4', '#8e44ad', '#e67e22', '#16a085', '#d35486', '#6d4c41', '#607d8b'];
export const BOOKMARK_COLOR_NAMES = ['الأحمر', 'الأصفر', 'الأخضر', 'الأزرق', 'البنفسجي', 'البرتقالي', 'الفيروزي', 'الوردي', 'البني', 'الرمادي'];

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

// ---------- العلامات المرجعية: عشر على الأكثر، لكل منها اسم ولون ----------
export const readBookmarks = () => read(BOOKMARKS_KEY, []);

// «علامة» من الضغط المطوّل: تُحوِّل الآية علامةً فورًا، أو تُزيلها إن كانت علامة.
// النتيجة: 'added' | 'removed' | 'full'
export function toggleBookmark(v) {
  const list = readBookmarks();
  const at = list.findIndex((b) => b.v === v);
  if (at >= 0) {
    list.splice(at, 1);
    write(BOOKMARKS_KEY, list);
    return 'removed';
  }
  if (list.length >= MAX_BOOKMARKS) return 'full';
  const used = new Set(list.map((b) => b.color));
  const color = BOOKMARK_COLORS.findIndex((_, i) => !used.has(i));
  list.push({ id: Date.now(), v, color, name: `الفاصل ${BOOKMARK_COLOR_NAMES[color]}` });
  write(BOOKMARKS_KEY, list);
  return 'added';
}

// إدارة العلامة من القائمة الجانبية (الفصل ٧): إعادة تسمية، أو نقلها لآية أخرى، أو حذفها
export function renameBookmark(id, name) {
  const list = readBookmarks();
  const b = list.find((x) => x.id === id);
  if (b) b.name = name.trim() || b.name;
  write(BOOKMARKS_KEY, list);
}

export function moveBookmark(id, v) {
  const list = readBookmarks();
  const b = list.find((x) => x.id === id);
  if (b) b.v = v;
  write(BOOKMARKS_KEY, list);
}

export function removeBookmark(id) {
  write(BOOKMARKS_KEY, readBookmarks().filter((x) => x.id !== id));
}

// ---------- المقداران المحددان: [أول آية، آخر آية] أو بدايته وحدها ----------
// مقداران مستقلان تمامًا (٢٠٢٦-١١-١٠): مقدار الاستماع، ومقدار صفحات المحتوى (التفسير ومعاني
// الكلمات والعمل بالآيات، ويتبعه منذ ٢٠٢٦-١١-١١ إخفات ما خارجه في المصحف إلا أثناء الاستماع).
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
