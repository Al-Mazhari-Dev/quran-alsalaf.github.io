// القرّاء (الفصل ٦): بياناتهم في src/data/reciters.json لا في الكود — فيُضاف قارئ جديد بسطر واحد
// هناك، بشرط توفّر ملف مستقل لكل آية له (٦٢٣٦ ملفًّا كاملة، رواية حفص)، لا ملف سورة كامل.
// ولكل قارئ مصدر (source) له قالب رابط في "sources" بالملف نفسه: {folder} و{sura} و{ayah}
// (السورة والآية بثلاث خانات). وتُقرأ البسملة قبل أول كل سورة من ملف الفاتحة ١:١ بصوت القارئ نفسه
// (src/lib/player.js)، فيلزم أن يكون ملف الآية الأولى من كل سورة بلا بسملة كسائر القرّاء.
// والأصل أن التلاوة مرتّلة فلا يُكتب تحت اسم القارئ شيء؛ ولا يُضاف "style" إلا لتسجيل مجوّد أو
// معلّم لقارئ معروف بهما (انظر STYLE_LABELS)، فيظهر بخط صغير تحت اسمه في صفحة الاختيار.
//
// سجلّ البحث ٢٠٢٦-١١-١٠ (everyayah بمطابقة قائمة ملفات كل مجلد بالآيات الـ٦٢٣٦، وQUL/Tarteel،
// وquran.com، وalquran.cloud): أُضيف ١٧ قارئًا اختارهم صاحب المشروع، كلهم ٦٢٣٦/٦٢٣٦، وملف الآية
// الأولى من كل سورة عندهم بلا بسملة. ولم يتوفر ملف آية بآية برواية حفص لياسين الجزائري (everyayah
// عنده رواية ورش)، ولا لخالد الغامدي ولا لابن طالب ولا للبعيجان ولا للحيدان ولا لوديع اليمني ولا لرعد
// الكردي ولا لمحمد خليل القارئ (سور كاملة فقط). وفي everyayah تسجيلات كاملة تضع البسملة داخل ملف
// الآية الأولى (محمود علي البنا، محمد عبد الكريم، پرهيزگار، ونسخة ketaballah للعجمي) فلا تصلح كما هي.
import data from '../data/reciters.json';

export const RECITERS = data.reciters;

// ما يُكتب بخط صغير تحت اسم القارئ؛ ومن لا "style" له (الأصل: مرتّل) لا يُكتب تحته شيء
const STYLE_LABELS = { mujawwad: 'مجوّد', muallim: 'المعلّم' };
export const styleLabel = (r) => STYLE_LABELS[r.style] ?? '';
// الاسم مع نوع التلاوة إن وُجد، لتمييز تسجيلات القارئ الواحد خارج صفحة الاختيار
export const reciterTitle = (r) => (styleLabel(r) ? `${r.name} (${styleLabel(r)})` : r.name);

export const reciterById = (id) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

const pad = (n) => String(n).padStart(3, '0');
export const ayahUrl = (r, s, a) =>
  data.sources[r.source].replace('{folder}', r.folder).replace('{sura}', pad(s)).replace('{ayah}', pad(a));

// هل يشمل تسجيل القارئ كل هذه السور؟ (كل القرّاء الآن كاملون، فتبقى الدالة للتوسّع لاحقًا)
export const covers = (r, suras) => !r.missing || suras.every((s) => !r.missing.includes(s));
