// حفظ بيانات المستخدم على جهازه: الملاحظات، والعلامات، والمقداران، وآخر صفحة، وسرعة القراءة،
// وسجل البحث، ومصدر التفسير — والبحث وتطبيعه
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as U from '../../src/lib/userdata.js';
import { readLastPage, saveLastPage } from '../../src/lib/position.js';
import { READ_SPEED_DEFAULT, readReadingSpeed, readWeeksTint, saveReadingSpeed, setWeeksTint } from '../../src/lib/settings.js';
import { addSearchHistory, readSearchHistory, removeSearchHistory } from '../../src/lib/searchHistory.js';
import { normalizeArabic, search } from '../../src/lib/search.js';
import { readTafsirSource, saveTafsirSource } from '../../src/lib/study.js';

beforeEach(() => localStorage.clear());
const raw = (k) => JSON.parse(localStorage.getItem(k));

describe('الملاحظات', () => {
  it('إضافة وتعديل وحذف (والنص الفارغ يحذف)', () => {
    U.setNote(5, 'أولى');
    U.setNote(9, 'ثانية');
    expect(raw('hq.notes')).toEqual({ 5: 'أولى', 9: 'ثانية' });
    U.setNote(5, 'معدّلة');
    expect(U.readNotes()[5]).toBe('معدّلة');
    U.setNote(5, '   ');
    expect(U.readNotes()).toEqual({ 9: 'ثانية' });
  });

  it('كل تغيير يُعلَن بحدث واحد لتتحدّث الواجهة', () => {
    const fn = vi.fn();
    window.addEventListener('hq-userdata', fn);
    U.setNote(1, 'x');
    U.saveRange([1, 2]);
    window.removeEventListener('hq-userdata', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('بيانات تالفة لا تُعطّل التطبيق', () => {
    localStorage.setItem('hq.notes', '{bad');
    expect(U.readNotes()).toEqual({});
  });
});

describe('العلامات المرجعية', () => {
  it('تُضاف بأول لون غير مستعمل واسمه، وتُزال بالضغط الثاني', () => {
    expect(U.toggleBookmark(10)).toBe('added');
    expect(U.toggleBookmark(20)).toBe('added');
    expect(U.readBookmarks().map((b) => [b.v, b.color, b.name])).toEqual([
      [10, 0, 'الفاصل الأحمر'],
      [20, 1, 'الفاصل الأصفر'],
    ]);
    expect(U.toggleBookmark(10)).toBe('removed');
    // اللون الأحمر صار متاحًا فيُعطى للتالية
    U.toggleBookmark(30);
    expect(U.readBookmarks().find((b) => b.v === 30).color).toBe(0);
  });

  it('عشر على الأكثر', () => {
    for (let i = 0; i < U.MAX_BOOKMARKS; i++) expect(U.toggleBookmark(i)).toBe('added');
    expect(U.toggleBookmark(99)).toBe('full');
    expect(U.readBookmarks()).toHaveLength(10);
    expect(new Set(U.readBookmarks().map((b) => b.color)).size).toBe(10);
  });

  it('إعادة تسمية (والاسم الفارغ يبقي القديم) ونقل وحذف', () => {
    U.toggleBookmark(10);
    const { id } = U.readBookmarks()[0];
    U.renameBookmark(id, '  مراجعة  ');
    expect(U.readBookmarks()[0].name).toBe('مراجعة');
    U.renameBookmark(id, '   ');
    expect(U.readBookmarks()[0].name).toBe('مراجعة');
    U.moveBookmark(id, 500);
    expect(U.readBookmarks()[0].v).toBe(500);
    U.removeBookmark(id);
    expect(U.readBookmarks()).toEqual([]);
  });
});

describe('المقداران المستقلان', () => {
  it('مقدار الاستماع ومقدار صفحات المحتوى بمفتاحين مستقلين، ويُلغى كلٌّ وحده', () => {
    U.saveRange([1, 5]);
    U.saveContentRange([10, 20]);
    expect(raw('hq.range')).toEqual([1, 5]);
    expect(raw('hq.contentRange')).toEqual([10, 20]);
    U.saveContentRange(null);
    expect(localStorage.getItem('hq.contentRange')).toBeNull();
    expect(U.readRange()).toEqual([1, 5]);
    expect(U.readContentRange()).toBeNull();
  });
});

describe('آخر صفحة', () => {
  it('تُحفظ وتُستعاد، وما خرج عن ١–٦٠٤ يبدأ من الأولى', () => {
    expect(readLastPage()).toBe(1);
    saveLastPage(300);
    expect(readLastPage()).toBe(300);
    localStorage.setItem('hq.page', '999');
    expect(readLastPage()).toBe(1);
    localStorage.setItem('hq.page', 'abc');
    expect(readLastPage()).toBe(1);
  });
});

describe('إعدادات أخرى', () => {
  it('سرعة وضع القراءة: تُحفظ، وما خرج عن ٢–٣٠ يعود للافتراضي', () => {
    expect(readReadingSpeed()).toBe(READ_SPEED_DEFAULT);
    saveReadingSpeed(12);
    expect(readReadingSpeed()).toBe(12);
    saveReadingSpeed(100);
    expect(readReadingSpeed()).toBe(READ_SPEED_DEFAULT);
  });

  it('تمييز مقررات الأسابيع ملغى افتراضيًّا ويُحفظ', () => {
    expect(readWeeksTint()).toBe(false);
    setWeeksTint(true);
    expect(readWeeksTint()).toBe(true);
    expect(document.documentElement.getAttribute('data-weeks')).toBe('on');
  });

  it('مصدر التفسير: المختصر افتراضيًّا، والميسّر يُحفظ', () => {
    expect(readTafsirSource()).toBe('mukhtasar');
    saveTafsirSource('muyassar');
    expect(readTafsirSource()).toBe('muyassar');
  });
});

describe('سجل البحث', () => {
  it('الأحدث أولًا بلا تكرار، وعشرون على الأكثر، ويُحذف منه', () => {
    addSearchHistory('أ');
    addSearchHistory('ب');
    addSearchHistory(' أ ');
    expect(readSearchHistory()).toEqual(['أ', 'ب']);
    for (let i = 0; i < 25; i++) addSearchHistory(`ب${i}`);
    expect(readSearchHistory()).toHaveLength(20);
    expect(readSearchHistory()[0]).toBe('ب24');
    removeSearchHistory('ب24');
    expect(readSearchHistory()[0]).toBe('ب23');
    addSearchHistory('   ');
    expect(readSearchHistory()[0]).toBe('ب23');
  });
});

describe('البحث', () => {
  it('التطبيع: التشكيل والهمزات والتاء المربوطة والألف المقصورة', () => {
    expect(normalizeArabic('ٱلرَّحْمَٰنِ')).toBe(normalizeArabic('الرحمن'));
    expect(normalizeArabic('أإآٱ')).toBe('اااا');
    expect(normalizeArabic('رحمة')).toBe('رحمه');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('مؤمن سئل')).toBe('مومن سيل');
    expect(normalizeArabic('  كلمة،  أخرى! ')).toBe('كلمه اخري');
  });

  it('كل الكلمات بأي ترتيب، وأسماء السور، وحد النتائج', () => {
    const index = {
      verses: ['قال رب اغفر لي', 'رب العالمين', 'قال موسى'].map((t, i) => ({ i, key: normalizeArabic(t) })),
      suras: [{ n: 2, key: normalizeArabic('البقرة') }],
    };
    expect(search(index, 'رب قال').verses).toEqual([0]);
    expect(search(index, 'رب').verses).toEqual([0, 1]);
    expect(search(index, 'سورة البقره').suras).toEqual([2]);
    expect(search(index, 'ق')).toEqual({ suras: [], verses: [], total: 0 });
    const r = search(index, 'قال', 1);
    expect(r.verses).toEqual([0]);
    expect(r.total).toBe(2);
  });
});
