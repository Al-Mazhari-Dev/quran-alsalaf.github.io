// الطبقات المفتوحة فوق المصحف (صفحة سفلية، قائمة، بطاقة) — للإغلاق بمفتاح Esc ولمعرفة
// هل المصحف ظاهر يستقبل مفاتيح التقليب. كل طبقة مفتوحة تُسجَّل في كومة، وEsc يغلق آخرها
// فتحًا وحده (كقائمة القارئ فوق بطاقة الاستماع).
import { useEffect, useRef } from 'react';

const stack = [];
let listening = false;

function onKey(e) {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].current?.();
}

export const hasOpenLayer = () => stack.length > 0;

// onClose: ما يُغلق الطبقة. open: أهي مفتوحة الآن (الافتراضي نعم: المكوّن لا يُرسم إلا مفتوحًا)
export function useLayer(onClose, open = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    if (!listening) {
      window.addEventListener('keydown', onKey);
      listening = true;
    }
    const entry = ref;
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

// الأجهزة التي تعمل بالفأرة (لها مؤشر دقيق يحوم) — تظهر فيها أزرار الفأرة الإضافية
export const hasMouse = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
