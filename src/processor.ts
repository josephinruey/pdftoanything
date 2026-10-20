import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
export type Options = { pages: string; angle: string; text: string; margin: string; signature?: string };
export type Output = { data: Uint8Array | string; name: string; mime: string; note?: string };
export function pageIndices(value: string, count: number): number[] {
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i);
  const result: number[] = [];
  for (const part of value.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('請輸入有效頁碼，例如 1, 3-5。');
    const start = Number(m[1]), end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end > count || start > end) throw new Error(`頁碼必須介於 1 至 ${count} 之間，且範圍需由小到大。`);
    for (let n = start; n <= end; n++) result.push(n - 1);
  }
  return result;
}
async function textFromPDF(file: File) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim());
    }
    return pages;
  } finally { await doc.destroy(); }
}
export async function processPDF(id: string, files: File[], options: Options): Promise<Output> {
  const base = files[0].name.replace(/\.[^.]+$/, '');
  const resultName = `${base}-${id}.pdf`;
  const pdfResult = (data: Uint8Array, note?: string): Output => ({ data, name: resultName, mime: 'application/pdf', note });
  if (id === 'jpg-pdf' || id === 'scan') {
    const doc = await PDFDocument.create();
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const img = file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = Math.min(1, 595 / img.width, 842 / img.height);
      const page = doc.addPage([img.width * scale, img.height * scale]);
      page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    }
    return pdfResult(await doc.save());
  }
  if (id === 'markdown') {
    const pages = await textFromPDF(files[0]);
    if (!pages.some(Boolean)) throw new Error('這份 PDF 沒有可擷取的文字，掃描文件需先經過 OCR 辨識。');
    return { data: pages.map((p, i) => `## 第 ${i + 1} 頁\n\n${p}`).join('\n\n---\n\n'), name: `${base}.md`, mime: 'text/markdown;charset=utf-8', note: '已擷取文字並以頁面分節；圖片與複雜表格不會保留。' };
  }
  if (id === 'compare') {
    const [a, b] = await Promise.all(files.map(textFromPDF));
    if (!a.some(Boolean) || !b.some(Boolean)) throw new Error('其中一份文件沒有可擷取的文字。請使用含文字的 PDF。');
    const rows = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => `第 ${i + 1} 頁：${a[i] === b[i] ? '文字相同' : '文字不同'}\n\n【原文件】\n${a[i] ?? '無此頁'}\n\n【比較文件】\n${b[i] ?? '無此頁'}`);
    return { data: `${files[0].name} ↔ ${files[1].name}\n\n${rows.join('\n\n────────────\n\n')}`, name: `${base}-comparison.txt`, mime: 'text/plain;charset=utf-8', note: '已完成逐頁文字比較，未比較圖像或排版差異。' };
  }
  if (id === 'pdf-jpg') {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise;
    try {
      const zip = new JSZip();
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i), viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        zip.file(`${base}-page-${i}.jpg`, canvas.toDataURL('image/jpeg', 0.92).split(',')[1], { base64: true });
        canvas.width = 0; canvas.height = 0;
      }
      return { data: await zip.generateAsync({ type: 'uint8array' }), name: `${base}-images.zip`, mime: 'application/zip' };
    } finally { await doc.destroy(); }
  }
  if (id === 'merge') {
    const doc = await PDFDocument.create();
    for (const f of files) { const src = await PDFDocument.load(await f.arrayBuffer()); const pages = await doc.copyPages(src, src.getPageIndices()); pages.forEach(p => doc.addPage(p)); }
    return pdfResult(await doc.save());
  }
  const doc = await PDFDocument.load(await files[0].arrayBuffer());
  const selection = pageIndices(options.pages, doc.getPageCount());
  if (['extract', 'organize', 'remove'].includes(id)) {
    const out = await PDFDocument.create();
    const indices = id === 'remove' ? doc.getPageIndices().filter(i => !selection.includes(i)) : selection;
    if (!indices.length) throw new Error('至少需要保留一頁，請調整移除的頁碼。');
    const pages = await out.copyPages(doc, indices); pages.forEach(p => out.addPage(p));
    return pdfResult(await out.save());
  }
  if (id === 'split') {
    const zip = new JSZip();
    for (const i of selection) { const out = await PDFDocument.create(); const [page] = await out.copyPages(doc, [i]); out.addPage(page); zip.file(`${base}-page-${i + 1}.pdf`, await out.save()); }
    return { data: await zip.generateAsync({ type: 'uint8array' }), name: `${base}-pages.zip`, mime: 'application/zip' };
  }
  if (id === 'rotate') selection.forEach(i => { const p = doc.getPage(i); p.setRotation(degrees((p.getRotation().angle + Number(options.angle)) % 360)); });
  if (['watermark', 'numbers', 'edit'].includes(id)) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    if (id !== 'numbers' && !options.text.trim()) throw new Error('請輸入要加入的文字。');
    if (id !== 'numbers' && /[^\x20-\x7e\n]/.test(options.text)) throw new Error('此版本的內建字型支援英文字母與數字；中文需串接中文字型後使用。');
    selection.forEach(i => {
      const p = doc.getPage(i); const text = id === 'numbers' ? `${i + 1} / ${doc.getPageCount()}` : options.text;
      const size = id === 'watermark' ? Math.min(44, p.getWidth() / Math.max(text.length, 1)) : id === 'numbers' ? 10 : 16;
      const width = font.widthOfTextAtSize(text, size);
      p.drawText(text, { font, size, x: id === 'edit' ? 40 : Math.max(10, (p.getWidth() - width) / 2), y: id === 'watermark' ? p.getHeight() / 2 : id === 'numbers' ? 24 : p.getHeight() - 60, color: rgb(0.16, 0.22, 0.2), opacity: id === 'watermark' ? 0.22 : 1 });
    });
  }
  if (id === 'crop') {
    const margin = Number(options.margin);
    if (!Number.isFinite(margin) || margin < 0) throw new Error('請輸入大於或等於 0 的裁剪邊距。');
    for (const i of selection) { const p = doc.getPage(i); const b = p.getCropBox(); if (margin * 2 >= Math.min(b.width, b.height)) throw new Error('裁剪邊距過大，請輸入較小的數值。'); p.setCropBox(b.x + margin, b.y + margin, b.width - margin * 2, b.height - margin * 2); }
  }
  if (id === 'sign') {
    if (!options.signature) throw new Error('請先在簽名區手寫簽名。');
    const image = await doc.embedPng(options.signature);
    const p = doc.getPage(selection[selection.length - 1]);
    const width = Math.min(160, p.getWidth() - 40); p.drawImage(image, { x: Math.max(20, p.getWidth() - width - 40), y: 48, width, height: width * image.height / image.width });
  }
  if (id === 'forms') {
    const p = doc.getPage(0), form = doc.getForm();
    const name = `field_${Date.now()}`; const field = form.createTextField(name);
    field.setText(''); field.addToPage(p, { x: 40, y: p.getHeight() - 100, width: Math.min(240, p.getWidth() - 80), height: 30, borderWidth: 1, borderColor: rgb(0.3, 0.5, 0.4) });
  }
  let bytes = await doc.save({ useObjectStreams: true });
  let note: string | undefined;
  if (id === 'compress') {
    if (bytes.length >= files[0].size) { bytes = new Uint8Array(await files[0].arrayBuffer()); note = '原文件已經很精簡，已保留原始大小。此工具優化文件結構，不會降低圖片解析度。'; }
    else note = `文件結構已優化，體積減少 ${Math.round((1 - bytes.length / files[0].size) * 100)}%。此工具不會降低圖片解析度。`;
  }
  return pdfResult(bytes, note);
}
export function download(output: Output) {
  const data = typeof output.data === 'string' ? output.data : new Uint8Array(output.data).buffer;
  const url = URL.createObjectURL(new Blob([data], { type: output.mime }));
  const a = document.createElement('a'); a.href = url; a.download = output.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
