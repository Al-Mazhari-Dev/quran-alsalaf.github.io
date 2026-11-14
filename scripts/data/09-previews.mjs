// مقاطع معاينة صوت القرّاء (٢٠٢٦-١١-١٤): الفاتحة ٢ «الحمد لله رب العالمين» لكل قارئ في
// src/data/reciters.json، تُنزَّل مرة واحدة إلى public/audio/preview/<folder>/001002.mp3 وتُبنى مع التطبيق
// ويخزّنها عامل الخدمة مسبقًا، فتعمل المعاينة بلا إنترنت. تُشغَّل عند إضافة قارئ: npm run previews
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('src/data/reciters.json', 'utf8'));
for (const r of data.reciters) {
  const out = `public/audio/preview/${r.folder}/001002.mp3`;
  if (existsSync(out)) continue;
  const url = data.sources[r.source].replace('{folder}', r.folder).replace('{sura}', '001').replace('{ayah}', '002');
  // eslint-disable-next-line no-await-in-loop
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${r.id}: ${res.status} ${url}`);
  mkdirSync(`public/audio/preview/${r.folder}`, { recursive: true });
  // eslint-disable-next-line no-await-in-loop
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(r.id, out);
}
