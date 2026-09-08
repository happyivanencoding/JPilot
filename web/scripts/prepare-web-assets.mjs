import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve('pdfjs-dist/package.json'));
const output = path.resolve(import.meta.dirname, '../public/jobpilot-pdf');
fs.mkdirSync(output, { recursive: true });
// Same installed version as the lazy browser module; never fetch a third-party CDN at runtime.
fs.copyFileSync(path.join(source, 'legacy/build/pdf.worker.min.mjs'), path.join(output, 'pdf.worker.min.mjs'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(output, 'LICENSE'));
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) fs.cpSync(path.join(source, directory), path.join(output, directory), { recursive: true });
console.log('JobPilot PDF assets prepared from the pinned local dependency.');
