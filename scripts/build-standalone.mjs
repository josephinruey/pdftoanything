import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.argv[2] ?? 'dist-standalone/PDFolio.html');
const read = filename => fs.readFile(path.join(root, filename), 'utf8');
const jsString = value => JSON.stringify(value).replaceAll('<', '\\u003c');

async function inlineFont(packageName, family) {
  const directory = path.join(root, 'node_modules', packageName);
  let css = await fs.readFile(path.join(directory, 'index.css'), 'utf8');
  css = css.replaceAll(`${family} Variable`, family);
  const matches = [...css.matchAll(/url\(([^)]+)\)/g)];
  for (const match of matches) {
    const bytes = await fs.readFile(path.resolve(directory, match[1]));
    css = css.replace(match[0], `url(data:font/woff2;base64,${bytes.toString('base64')})`);
  }
  return css;
}
const fonts = (await Promise.all([
  inlineFont('@fontsource-variable/noto-sans-tc', 'Noto Sans TC'),
  inlineFont('@fontsource-variable/dm-sans', 'DM Sans'),
])).join('\n');
const binaryAssets = {};
for (const [directory, kind] of [['cmaps', 'cMapUrl'], ['standard_fonts', 'standardFontDataUrl'], ['wasm', 'wasmUrl']]) {
  for (const name of await fs.readdir(path.join(root, 'node_modules/pdfjs-dist', directory))) {
    if (name.startsWith('LICENSE')) continue;
    binaryAssets[`${kind}/${name}`] = (await fs.readFile(path.join(root, 'node_modules/pdfjs-dist', directory, name))).toString('base64');
  }
}
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.tsx'],
  outfile: 'app.js',
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  minify: true,
  legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.url': 'location.href' },
  plugins: [{
    name: 'standalone-assets',
    setup(bundler) {
      bundler.onResolve({ filter: /^standalone:pdf-assets$/ }, () => ({ path: 'pdf-assets', namespace: 'standalone' }));
      bundler.onLoad({ filter: /.*/, namespace: 'standalone' }, () => ({
        contents: `const assets = ${jsString(binaryAssets)};
          export class OfflineBinaryDataFactory {
            async fetch({kind, filename}) {
              const encoded = assets[kind + '/' + filename];
              if (!encoded) throw new Error('Missing embedded PDF resource: ' + filename);
              return Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
            }
          }`, loader: 'js',
      }));
      bundler.onResolve({ filter: /pdf\.worker\.min\.mjs\?url$/ }, () => ({ path: 'pdf-worker', namespace: 'embedded-worker' }));
      bundler.onLoad({ filter: /.*/, namespace: 'embedded-worker' }, async () => ({
        contents: `export default URL.createObjectURL(new Blob([${jsString(await read('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'))}], {type:'text/javascript'}));`, loader: 'js',
      }));
      bundler.onLoad({ filter: /src\/processor\.ts$/ }, async args => ({
        contents: `import { OfflineBinaryDataFactory } from 'standalone:pdf-assets';\n` + (await fs.readFile(args.path, 'utf8')).replaceAll('pdfjs.getDocument({ data:', 'pdfjs.getDocument({ BinaryDataFactory: OfflineBinaryDataFactory, useWorkerFetch: false, data:'),
        loader: 'ts', resolveDir: path.dirname(args.path),
      }));
      bundler.onLoad({ filter: /src\/style\.css$/ }, async args => ({
        contents: fonts + '\n' + (await fs.readFile(args.path, 'utf8')).replace(/@import\s+url\([\s\S]*?\);/, ''),
        loader: 'css', resolveDir: path.dirname(args.path),
      }));
      // Browsers may restrict localStorage on file: pages. The interface still works,
      // while persistence is used whenever the browser allows it.
      bundler.onLoad({ filter: /src\/ScannerModal\.tsx$/ }, async args => ({
        contents: (await fs.readFile(args.path, 'utf8')).replace('crypto.randomUUID()', '(crypto.randomUUID?.() ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`)'),
        loader: 'tsx', resolveDir: path.dirname(args.path),
      }));
      bundler.onLoad({ filter: /src\/main\.tsx$/ }, async args => {
        let source = await fs.readFile(args.path, 'utf8');
        for (const expression of ["localStorage.setItem('pdfolio-favorites', JSON.stringify(favorites));", "localStorage.setItem('pdfolio-recent', JSON.stringify(recent));"]) {
          source = source.replace(expression, `try { ${expression} } catch {}`);
        }
        return { contents: source, loader: 'tsx', resolveDir: path.dirname(args.path) };
      });
    },
  }],
});
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text;
let template = await read('index.html');
template = template.replace('<script type="module" src="/src/main.tsx"></script>', '');
template = template.replace('</head>', () => `<style>${css}</style></head>`);
template = template.replace('</body>', () => `<script>${js}</script></body>`);
const notices = [];
for (const filename of [
  'node_modules/react/LICENSE',
  'node_modules/react-dom/LICENSE',
  'node_modules/lucide-react/LICENSE',
  'node_modules/pdf-lib/LICENSE.md',
  'node_modules/jszip/LICENSE.markdown',
  'node_modules/@fontsource-variable/dm-sans/LICENSE',
  'node_modules/@fontsource-variable/noto-sans-tc/LICENSE',
  'node_modules/pdfjs-dist/LICENSE',
  'node_modules/pdfjs-dist/cmaps/LICENSE',
  'node_modules/pdfjs-dist/standard_fonts/LICENSE_FOXIT',
  'node_modules/pdfjs-dist/standard_fonts/LICENSE_LIBERATION',
  'node_modules/pdfjs-dist/wasm/LICENSE_JBIG2',
  'node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG',
  'node_modules/pdfjs-dist/wasm/LICENSE_QCMS',
  'node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_JBIG2',
  'node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_OPENJPEG',
  'node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_QCMS',
]) notices.push({ file: filename, license: await read(filename) });
template = template.replace('</body>', () => `<script type="application/json" id="third-party-notices">${jsString(notices)}</script></body>`);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, template);
console.log(`Saved ${output} (${(Buffer.byteLength(template) / 1024 / 1024).toFixed(2)} MB)`);
