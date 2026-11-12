// صيغ العدد والمعدود بالعربية (٢٠٢٦-١١-١٢)، بحسب آخر رقمين من العدد:
//  • ما آخره ٣–١٠ (٣، ١٠، ١٠٣ …): جمع — «٥ صفحات»، «١٠٣ أيام»
//  • ما آخره ١١–٩٩ (١١، ٣٠، ١٢٠ …): مفرد منصوب — «١١ يوما»، «٢٨٦ آية»
//  • مئة فأكثر وآخره ٠٠–٠٢ (١٠٠، ٢٠٠، ١٠٢ …): مفرد مجرور — «١٠٠ يوم»
// والواحد والاثنان بالكلمة لا بالرقم: «يوم واحد»، و«يومان» أو «يومين» بحسب موقعها في الجملة.

// المعدود وحده بعد رقم: forms = { plural, acc, gen } (gen افتراضيًا هو acc)
export function countNoun(n, { plural, acc, gen = acc }) {
  const tail = n % 100;
  if (tail >= 3 && tail <= 10) return plural;
  if (tail >= 11) return acc;
  return gen;
}

// العدد والمعدود معًا: forms = { one, two: [مرفوع، منصوب], plural, acc, gen }
// nominative: المثنى مرفوعًا («يومان») حين يأتي العدد مستقلًا، وإلا منصوبًا («متأخر يومين»)
export function countText(n, forms, digits = String, nominative = false) {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two[nominative ? 0 : 1];
  return `${digits(n)} ${countNoun(n, forms)}`;
}

export const DAYS = { one: 'يوم واحد', two: ['يومان', 'يومين'], plural: 'أيام', acc: 'يوما', gen: 'يوم' }; // بلا تنوين: نصوص الختمة بلا تشكيل (بطلب صاحب المشروع)
export const PAGES = { one: 'صفحة واحدة', two: ['صفحتان', 'صفحتين'], plural: 'صفحات', acc: 'صفحة' };
export const KHATMAS = { one: 'ختمة واحدة', two: ['ختمتان', 'ختمتين'], plural: 'ختمات', acc: 'ختمة' };
export const AYAT = { one: 'آية واحدة', two: ['آيتان', 'آيتين'], plural: 'آيات', acc: 'آية' };
