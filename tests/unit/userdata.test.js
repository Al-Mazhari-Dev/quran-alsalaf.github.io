// حفظ بيانات المستخدم على جهازه: الملاحظات، والعلامات، والمقداران، وآخر صفحة، وسرعة القراءة،
// وسجل البحث، ومصدر التفسير — والبحث وتطبيعه
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as U from '../../src/lib/userdata.js';
import { readLastPage, saveLastPage } from '../../src/lib/position.js';
import { READ_SPEED_DEFAULT, readReadingSpeed, readRubAlert, readWeeksTint, saveReadingSpeed, setRubAlert, setWeeksTint } from '../../src/lib/settings.js';
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

describe('العلامات المرجعية (بلا حدّ، ٢٠٢٦-١١-١٤)', () => {
  const at = (id) => U.readBookmarks().find((b) => b.id === id);
  const verses = (id) => at(id).verses.map((x) => x.v);

  it('٤٠ لونًا: عشرة أساسية لكلٍّ أربع درجات، كلها مختلفة', () => {
    const all = U.BOOKMARK_HUES.flatMap((h) => h.shades);
    expect(all).toHaveLength(40);
    expect(new Set(all).size).toBe(40);
    expect(U.colorName(0, 0)).toBe('أحمر فاتح');
    expect(U.colorName(0, U.BASE_SHADE)).toBe('أحمر');
  });

  it('بلا حدّ لعددها: عشرون علامة وأكثر', () => {
    for (let i = 0; i < 25; i++) U.createBookmark({ name: `ع${i}` }, i);
    expect(U.readBookmarks()).toHaveLength(25);
    expect(new Set(U.readBookmarks().map((b) => b.id)).size).toBe(25);
  });

  it('الاسم واللون الافتراضيان: «علامة ١» وأول لون أساسي لم يُستعمل', () => {
    expect(U.defaultBookmarkName([])).toBe('علامة ١');
    const id = U.createBookmark({}, 3);
    expect(at(id).name).toBe('علامة ١');
    expect(at(id).color).toBe(U.BOOKMARK_HUES[0].shades[U.BASE_SHADE]);
    expect(at(id).multi).toBe(false);
    expect(U.defaultBookmarkName()).toBe('علامة ٢');
    expect(U.defaultBookmarkColor()).toBe(U.BOOKMARK_HUES[1].shades[U.BASE_SHADE]);
  });

  it('المتنقّلة: في آية واحدة، ووضعها على أخرى ينقلها', () => {
    const id = U.createBookmark({ name: 'وصلت هنا', multi: false }, 10);
    expect(U.placeBookmark(id, 10)).toBe('placed');
    expect(U.placeBookmark(id, 20)).toBe('moved');
    expect(verses(id)).toEqual([20]);
  });

  it('المتعددة: تقبل أكثر من مئة آية ولا يزول منها شيء', () => {
    const id = U.createBookmark({ name: 'أخطائي', multi: true }, 0);
    for (let v = 1; v < 150; v++) expect(U.placeBookmark(id, v)).toBe('placed');
    expect(verses(id)).toHaveLength(150);
    U.placeBookmark(id, 5); // الآية نفسها مرة ثانية لا تتكرر
    expect(verses(id)).toHaveLength(150);
    U.unplaceBookmark(id, 5);
    expect(verses(id)).toHaveLength(149);
    expect(verses(id)).not.toContain(5);
  });

  it('علامتان على آية واحدة: يُظلَّل لون الأحدث، وبإزالتها يعود لون الأخرى', () => {
    const red = '#c0392b';
    const blue = '#2e7bc4';
    const errors = U.createBookmark({ name: 'أخطائي', color: red, multi: true }, 7);
    U.placeBookmark(errors, 8);
    const here = U.createBookmark({ name: 'وصلت هنا', color: blue }, 7);
    let list = U.readBookmarks();
    expect(U.bookmarkShades(list).get(7)).toBe(blue);
    expect(U.bookmarkShades(list).get(8)).toBe(red);
    expect(U.bookmarksAt(list, 7).map((b) => b.name)).toEqual(['وصلت هنا', 'أخطائي']);
    // نقل «وصلت هنا» يعيد لون «أخطائي» على الآية
    U.placeBookmark(here, 30);
    list = U.readBookmarks();
    expect(U.bookmarkShades(list).get(7)).toBe(red);
    expect(U.bookmarkShades(list).get(30)).toBe(blue);
    // إعادة وضع «أخطائي» على آية هي عليها تجعلها الأحدث
    U.placeBookmark(here, 8);
    expect(U.bookmarkShades(U.readBookmarks()).get(8)).toBe(blue);
    U.placeBookmark(errors, 8);
    expect(U.bookmarkShades(U.readBookmarks()).get(8)).toBe(red);
  });

  it('تعديل الاسم واللون والنوع (والاسم الفارغ يبقي القديم)، والمتعددة إلى متنقّلة تبقي آخر آية', () => {
    const id = U.createBookmark({ name: 'مراجعة', multi: true }, 50);
    U.placeBookmark(id, 10);
    U.placeBookmark(id, 90);
    U.updateBookmark(id, { name: '  حفظ  ', color: '#1e5e1e' });
    expect(at(id).name).toBe('حفظ');
    expect(at(id).color).toBe('#1e5e1e');
    U.updateBookmark(id, { name: '   ' });
    expect(at(id).name).toBe('حفظ');
    U.updateBookmark(id, { multi: false });
    expect(at(id).multi).toBe(false);
    expect(verses(id)).toEqual([90]);
    U.removeBookmark(id);
    expect(U.readBookmarks()).toEqual([]);
  });

  it('العلامات القديمة (عشر بأرقام ألوان) تبقى متنقّلة باسمها ولونها وآيتها', () => {
    localStorage.setItem(
      'hq.bookmarks',
      JSON.stringify([
        { id: 1, v: 10, color: 0, name: 'الفاصل الأحمر' },
        { id: 2, v: 20, color: 3, name: 'مراجعة' },
      ])
    );
    expect(U.readBookmarks()).toEqual([
      { id: 1, name: 'الفاصل الأحمر', color: '#c0392b', multi: false, verses: [{ v: 10, at: 1 }] },
      { id: 2, name: 'مراجعة', color: '#2e7bc4', multi: false, verses: [{ v: 20, at: 2 }] },
    ]);
    // وتعمل كغيرها بعد التحويل، وتُحفظ بالشكل الجديد
    U.placeBookmark(1, 99);
    expect(raw('hq.bookmarks')[0].verses.map((x) => x.v)).toEqual([99]);
    expect(raw('hq.bookmarks')[1].verses.map((x) => x.v)).toEqual([20]);
  });

  it('بيانات تالفة لا تُعطّل العلامات', () => {
    localStorage.setItem('hq.bookmarks', '{bad');
    expect(U.readBookmarks()).toEqual([]);
    localStorage.setItem('hq.bookmarks', '{"a":1}');
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

  it('التنبيه ببداية الربع مفعَّل افتراضيًّا، وإلغاؤه يُحفظ', () => {
    expect(readRubAlert()).toBe(true);
    setRubAlert(false);
    expect(readRubAlert()).toBe(false);
    expect(localStorage.getItem('hq.rubAlert')).toBe('off');
    setRubAlert(true);
    expect(readRubAlert()).toBe(true);
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
