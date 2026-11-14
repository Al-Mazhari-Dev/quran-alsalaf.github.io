import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// كل مسارات البناء نسبية («./») لا مطلقة: فلا يُكتب في البناء عنوان الموقع ولا مساره، ويعمل
// التطبيق كما هو من الجذر (GitHub Pages ونسخ معاينة Netlify) ومن أي مجلد فرعي لو تغيّر العنوان.
// وكان سابقًا يُحسب مسار فرعي وقت البناء من اسم الحساب، فلما تغيّر الاسم ثم رجع بقي آخر بناء
// يطلب ملفاته من مسار لم يعد موجودًا، فعلق التطبيق على ستارة الإقلاع.
const base = './';

// صفحة المعاينة أداة لا جزء من التطبيق: لا يُحقن فيها رابط الـ manifest ولا تسجيل عامل الخدمة
// (المسار النسبي فيها يشير إلى preview/ لا إلى مجلد التطبيق)
const previewWithoutPwa = {
  name: 'preview-without-pwa',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!/\/preview\/index\.html$/.test(ctx.path)) return html;
      return html
        .replace(/<link rel="manifest"[^>]*>/, '')
        .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');
    },
  },
};

// قائمتا «خلفية القراءة» و«لون التطبيق» في ملف واحد (src/data/appearance.json): تُحقن في سكربت
// index.html الذي يطبّق المظهر قبل الرسم، ويستوردها التطبيق نفسه للإعدادات — فلا تُكتب مرتين
const appearanceData = {
  name: 'appearance-data',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const data = JSON.parse(readFileSync(new URL('./src/data/appearance.json', import.meta.url), 'utf8'));
      return html.replace('var DATA = __APPEARANCE_DATA__;', `var DATA = ${JSON.stringify(data)};`);
    },
  },
};

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // صفحة المعاينة الداخلية (preview/index.html) تُبنى مستقلة بجانب التطبيق، بلا رابط إليها منه
      input: {
        main: 'index.html',
        preview: 'preview/index.html',
      },
    },
  },
  plugins: [
    appearanceData,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon-64.png',
        'fonts/uthmanic_hafs_v20.ttf',
      ],
      manifest: {
        name: 'قرآن السلف',
        short_name: 'قرآن السلف',
        description:
          'إنشاء: سامي أبصار الإسلام',
        lang: 'ar',
        dir: 'rtl',
        // نسبيان إلى ملف الـ manifest نفسه، وهو في مجلد التطبيق
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        // خلفية الشاشة التي يعرضها النظام لحظة الإقلاع — كحلية لتتصل
        // بأيقونة التطبيق وبشاشة الافتتاح بلا وميض أبيض بينها
        background_color: '#1A0165',
        // قبل أن يُطبَّق اختيار المستخدم: بيج، خلفية أول فتح على الوضع الفاتح (src/data/appearance.json)
        theme_color: '#F5EDDC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // المواصفة تنصّ على تحميل كامل عند أول فتح ثم عمل تام بلا إنترنت،
        // فتُخزَّن كل أصول التطبيق مسبقًا. حدُّ الحجم مرفوع لأجل ملفات
        // بيانات المصحف والتفسير التي تُضاف في المرحلة الثانية.
        globPatterns: ['**/*.{js,css,html,woff2,ttf,png,svg,json}'],
        // خطوط الصفحات الـ٦٠٤ (نحو ٤٨ ميغابايت) لا تُنزَّل كلها عند التثبيت:
        // تُنزَّل كل صفحة عند أول فتح لها وتُحفظ (أدناه)، فتعمل بعدها بلا إنترنت
        // وصفحة المعاينة الداخلية لا تُخزَّن مسبقًا: أداة لصاحب المشروع لا جزء من التطبيق
        globIgnores: ['fonts/qcf4/**', 'preview/**'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // نسبي إلى موضع عامل الخدمة (مجلد التطبيق)
        navigateFallback: 'index.html',
        // إصلاح لمرة واحدة لمن علِق عنده بناء المسار الفرعي القديم: يعيد تحميل الصفحات المفتوحة
        // فور تفعيل عامل الخدمة الجديد (public/sw-recover.js)
        importScripts: ['sw-recover.js'],
        // لا يُعاد التطبيق بدل صفحة المعاينة إذا كُتب مسارها مباشرة (بشرطة أخيرة أو بدونها)
        navigateFallbackDenylist: [/\/preview(\/|\/index\.html)?$/],
        runtimeCaching: [
          {
            urlPattern: /\/fonts\/qcf4\/p\d+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'qcf4-pages',
              expiration: { maxEntries: 650 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // الصوت لا يمرّ بعامل الخدمة أصلًا: يُبثّ من الشبكة مباشرة (الفصل ٦ من المواصفة)، فيتولّى
          // المتصفح طلبات القفز داخل الملف بنفسه. وتحميل القارئ لكامل القرآن تحفظه الصفحة نفسها في
          // ذاكرة مستقلة لكل قارئ (src/lib/offline.js)، لا عامل الخدمة
        ],
      },
    }),
    previewWithoutPwa,
  ],
});
