// يُحمَّل داخل عامل الخدمة (importScripts في vite.config.js).
// من فتح التطبيق وقت بناء المسار الفرعي قد تبقى عنده صفحة معطّلة (ستارة الإقلاع فقط) لا يعمل فيها
// كود التطبيق، فلا يقدر أن يحدّث نفسه. فعند أول تفعيل لعامل الخدمة الجديد يُعاد تحميل كل نافذة
// مفتوحة للتطبيق مرة واحدة، فتُفتح بالملفات الجديدة. ولا يتكرر بعدها (علامة في ذاكرة التخزين).
// ومن يفتح التطبيق لأول مرة (لا عامل خدمة سابق عنده) لا يحتاجه، فلا تُعاد صفحته.
const RECOVER_MARK = 'qs-recovered-root-v1';
let replacingOld = false;

self.addEventListener('install', () => {
  replacingOld = !!self.registration.active;
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (await caches.has(RECOVER_MARK)) return;
      await caches.open(RECOVER_MARK);
      if (!replacingOld) return;
      await self.clients.claim();
      const wins = await self.clients.matchAll({ type: 'window' });
      // لا يُنتظر التحميل هنا: الصفحة المعادة تنتظر انتهاء التفعيل نفسه، فانتظارها يعلّق الاثنين
      for (const c of wins) if (c.navigate) c.navigate(c.url).catch(() => {});
    })()
  );
});
