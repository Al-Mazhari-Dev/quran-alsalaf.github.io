// اختبارات الوحدات للمنطق الحساس (src/lib): npm run test:unit
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'jsdom',
  },
});
