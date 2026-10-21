import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist-standalone/PDFolio.html');
const output = path.join(root, 'downloads');
const html = await fs.readFile(source);
const zip = new JSZip();
zip.file('PDFolio.html', html, { date: (await fs.stat(source)).mtime, unixPermissions: 0o100644 });
const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' });
const restored = await JSZip.loadAsync(archive, { checkCRC32: true });
assert.deepEqual(Object.keys(restored.files), ['PDFolio.html']);
assert.ok((await restored.file('PDFolio.html').async('nodebuffer')).equals(html));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'PDFolio.html'), html);
await fs.writeFile(path.join(output, 'PDFolio-offline.zip'), archive);
for (const [name, bytes] of [['PDFolio.html', html], ['PDFolio-offline.zip', archive]]) {
  console.log(`${name}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB; SHA-256 ${createHash('sha256').update(bytes).digest('hex')}`);
}
console.log('Verified ZIP contains exactly one HTML file, identical to the tested standalone build.');
