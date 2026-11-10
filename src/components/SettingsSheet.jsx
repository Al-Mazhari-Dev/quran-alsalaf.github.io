import { useState } from 'react';
import { readTheme, toggleTheme } from '../lib/theme.js';
import { readWeeksTint, setWeeksTint } from '../lib/settings.js';
import './SettingsSheet.css';
import { useLayer } from '../lib/layers.js';

/*
  الإعدادات: صفحة كاملة مستقلة تغطي المصحف، يُرجع منها بسهم الرجوع (بطلب صاحب المشروع).
  الوضع، تمييز مقررات الأسابيع، وضع القراءة، وعن التطبيق.
  (حجم خط التطبيق أُلغي ٢٠٢٦-٠٩-٢٥ بطلب صاحب المشروع: خط واحد ثابت لا خيار فيه)
*/
export default function SettingsSheet({ open, onClose, onThemeChange, onStartReading, onShowAbout }) {
  const [theme, setThemeState] = useState(readTheme);
  const [weeks, setWeeks] = useState(readWeeksTint);

  useLayer(onClose, open);

  const chooseTheme = (t) => {
    if (t === readTheme()) return;
    const next = toggleTheme();
    setThemeState(next);
    onThemeChange?.(next);
  };

  const toggleWeeks = () => {
    setWeeksTint(!weeks);
    setWeeks(!weeks);
  };

  return (
    <div className={`settings${open ? ' settings--open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <section className="settings__card" role="dialog" aria-modal="true" aria-label="الإعدادات">
        {/* صفحة كاملة تغطي المصحف، وسهم الرجوع في أولها (يمينًا) يشير إلى جهة الرجوع */}
        <header className="settings__head">
          <button className="settings__back" type="button" onClick={onClose} aria-label="رجوع">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2>الإعدادات</h2>
        </header>

        <div className="settings__row">
          <span className="settings__label">الوضع</span>
          <div className="settings__segment" role="radiogroup" aria-label="الوضع">
            <button type="button" role="radio" aria-checked={theme === 'light'} onClick={() => chooseTheme('light')}>
              فاتح
            </button>
            <button type="button" role="radio" aria-checked={theme === 'dark'} onClick={() => chooseTheme('dark')}>
              داكن
            </button>
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__label">تمييز مقررات الأسابيع</span>
          <button
            className="settings__switch"
            type="button"
            role="switch"
            aria-checked={weeks}
            aria-label="تمييز مقررات الأسابيع"
            onClick={toggleWeeks}
          >
            <span />
          </button>
        </div>

        <button type="button" className="settings__link" onClick={onStartReading}>
          <span className="settings__label">وضع القراءة</span>
          <ChevronIcon />
        </button>

        <button type="button" className="settings__link" onClick={onShowAbout}>
          <span className="settings__label">عن التطبيق</span>
          <ChevronIcon />
        </button>
      </section>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__chevron">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
