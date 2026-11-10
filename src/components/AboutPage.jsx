import './AboutPage.css';
import { useLayer } from '../lib/layers.js';

/*
  صفحة «عن التطبيق» (الفصل ١٢): نصّها حرفي كما في المواصفة، بلا أي تعديل ولا أي مصدر آخر
  مذكور (قرار صريح من صاحب المشروع) — لا القرّاء، ولا مصدر التفسير، ولا التصنيف الموضوعي.
  التنسيق وحده تحسَّن (بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٤): شعار أعلاها، وبطاقة للمصدر بلا عنوان
  «المصادر» (بقي نصّ المصدر نفسه)، وزرّ لقناة تليجرام بدل رابط نصّي خام.
*/
export default function AboutPage({ open, onClose }) {
  useLayer(onClose, open);
  return (
    <div className={`about${open ? ' about--open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <section className="about__card" role="dialog" aria-modal="true" aria-label="عن التطبيق">
        <header className="about__head">
          <button className="about__back" type="button" onClick={onClose} aria-label="رجوع">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2>عن التطبيق</h2>
        </header>

        <div className="about__body">
          <img className="about__logo" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <h1 className="about__title">قرآن السلف</h1>

          <p>
            تطبيق قرآن السلف يجمع بين حفظ اللفظ وفهم المعنى والعمل بالآيات، على نهج الصحابة رضي الله عنهم في
            تلقّي القرآن؛ فقد كانوا يتعلمون العشر آيات، فلا يتجاوزونها حتى يتعلموا ما فيها من العلم والعمل.
          </p>
          <p>
            ويقدّم التطبيق المصحف كاملًا للقراءة والاستماع، مع تفسير الآيات ومعاني كلماتها والعمل بها في الأجزاء المقرّرة
            في برنامج حلقات حفظ القرآن بطريقة السلف للأشبال.
          </p>

          <div className="about__source">
            <BookIcon />
            <p>نص المصحف وخط الرسم العثماني (رواية حفص عن عاصم) من مجمع الملك فهد لطباعة المصحف الشريف.</p>
          </div>

          <a className="about__telegram" href="https://t.me/quraangroup" target="_blank" rel="noopener noreferrer">
            <TelegramIcon />
            <span>
              تابعونا على تليجرام
              <small>قناة حفظ القرآن بطريقة السلف</small>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="about__sourceIcon">
      <path d="M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5ZM5 17a2.5 2.5 0 0 1 2.5-2.5H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m3.5 12 15.6-6.4c.8-.3 1.5.4 1.2 1.2l-2.9 13.3c-.2.9-1.3 1.3-2 .7l-4-3.1-2.2 2.1c-.4.4-1 .2-1.1-.4l-.5-3.6-3.6-1.7c-.9-.4-.9-1.7.1-2.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.7 14.5 18 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
