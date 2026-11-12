import React from 'react';
import { createRoot } from 'react-dom/client';

// خط واجهة التطبيق (Rubik، بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٦ بعد مقارنة عدة خطوط) — يُحزَم مع
// التطبيق ليعمل بلا إنترنت (الفصل ١٣). ولا يمسّ هذا خط آيات المصحف نفسها (ثابت لا يتغيّر)
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
// خط ترويسة صفحة المصحف (الجزء، اسم السورة، رقم الصفحة) — بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٣.
// وزن عادي لا غامق (بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٥) لوضوح القراءة
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';

import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';
import { applyWeeksTint } from './lib/settings.js';

// المظهر (الخلفية واللون) طُبِّق قبل الرسم في سكربت index.html — src/lib/appearance.js
applyWeeksTint(); // تمييز مقررات الأسابيع كما اختاره المستخدم في الإعدادات (ملغى افتراضيًّا)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
