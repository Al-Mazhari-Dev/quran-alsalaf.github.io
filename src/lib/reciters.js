// القرّاء (الفصل ٦): بياناتهم في src/data/reciters.json لا في الكود — فيُضاف قارئ جديد بسطر واحد
// هناك، بشرط توفّر ملف مستقل لكل آية له (٦٢٣٦ ملفًّا كاملة، رواية حفص)، لا ملف سورة كامل.
// ولكل قارئ مصدر (source) له قالب رابط في "sources" بالملف نفسه: {folder} و{sura} و{ayah}
// (السورة والآية بثلاث خانات). وتُقرأ البسملة قبل أول كل سورة من ملف الفاتحة ١:١ بصوت القارئ نفسه
// (src/lib/player.js)، فيلزم أن يكون ملف الآية الأولى من كل سورة بلا بسملة كسائر القرّاء.
//
// سجلّ البحث: أُلغي النفيس والبعيجان وابن طالب ٢٠٢٦-٠٩-٢٢، واللحيدان قبلهم، لعدم توفّر ملفات آية بآية
// لهم. وأُعيد البحث ٢٠٢٦-١١-١٠ (everyayah وquran.com وalquran.cloud وQUL وغيرها) فأُضيف خليفة
// الطنيجي (everyayah: ٦٢٣٦/٦٢٣٦)، ولم يتوفر ملف آية بآية برواية حفص لياسين الجزائري (everyayah
// عنده رواية ورش)، ولا لخالد الغامدي ولا لابن طالب ولا للبعيجان ولا للحيدان.
import data from '../data/reciters.json';

export const RECITERS = data.reciters;

export const reciterById = (id) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

const pad = (n) => String(n).padStart(3, '0');
export const ayahUrl = (r, s, a) =>
  data.sources[r.source].replace('{folder}', r.folder).replace('{sura}', pad(s)).replace('{ayah}', pad(a));

// هل يشمل تسجيل القارئ كل هذه السور؟ (كل القرّاء الآن كاملون، فتبقى الدالة للتوسّع لاحقًا)
export const covers = (r, suras) => !r.missing || suras.every((s) => !r.missing.includes(s));
