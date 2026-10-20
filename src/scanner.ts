import type { Output } from './processor';

export type ScanFormat = 'pdf' | 'jpg' | 'png';
export type ScanMode = 'color' | 'gray' | 'bw';
export type ScanImage = { blob: Blob; rotation: number };
const MAX_EDGE = 2400;

async function withImage<T>(blob: Blob, use: (image: HTMLImageElement) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error('無法讀取這張照片。請改用 JPG、PNG 或此瀏覽器支援的圖片格式；HEIC 可先轉為 JPG。'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('圖片內容為空，請重新拍攝。');
    return await use(image);
  } finally { URL.revokeObjectURL(url); }
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片產生失敗，請減少頁數後重試。')), type, quality));
}
function contextFor(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('此瀏覽器不支援圖片處理，請使用最新版 Safari 或 Chrome。');
  return context;
}
export async function prepareScan(file: File) {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)) throw new Error('請選擇照片或圖片檔案。');
  if (file.size > 50 * 1024 * 1024) throw new Error('單張照片不可超過 50 MB。');
  return withImage(file, async image => {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    try {
      const ctx = contextFor(canvas);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // The browser decoder applies phone-photo EXIF orientation before drawing.
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const width = canvas.width, height = canvas.height;
      const blob = await canvasBlob(canvas, 'image/jpeg');
      const thumbRatio = Math.min(1, 480 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * thumbRatio));
      canvas.height = Math.max(1, Math.round(height * thumbRatio));
      const thumbContext = contextFor(canvas);
      thumbContext.fillStyle = '#fff'; thumbContext.fillRect(0, 0, canvas.width, canvas.height);
      thumbContext.drawImage(image, 0, 0, canvas.width, canvas.height);
      const thumbnail = await canvasBlob(canvas, 'image/jpeg', 0.8);
      return { blob, thumbnail, width, height };
    } finally { canvas.width = 0; canvas.height = 0; }
  });
}
async function renderScan(page: ScanImage, mode: ScanMode, mime: string) {
  return withImage(page.blob, async image => {
    const canvas = document.createElement('canvas');
    const rotation = ((page.rotation % 360) + 360) % 360;
    const swapped = rotation === 90 || rotation === 270;
    canvas.width = swapped ? image.naturalHeight : image.naturalWidth;
    canvas.height = swapped ? image.naturalWidth : image.naturalHeight;
    try {
      const ctx = contextFor(canvas);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      if (mode !== 'color') {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const gray = Math.round(0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2]);
          const value = mode === 'bw' ? (gray >= 155 ? 255 : 0) : gray;
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      const blob = await canvasBlob(canvas, mime);
      return { blob, width: canvas.width, height: canvas.height };
    } finally { canvas.width = 0; canvas.height = 0; }
  });
}
export async function exportScan(pages: ScanImage[], format: ScanFormat, mode: ScanMode, filename: string, progress?: (page: number) => void): Promise<Output> {
  if (!pages.length) throw new Error('請先拍攝或加入至少一頁文件。');
  const name = filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim().slice(0, 80) || '掃描文件';
  if (format === 'pdf') {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      progress?.(i + 1);
      const rendered = await renderScan(pages[i], mode, 'image/jpeg');
      const image = await doc.embedJpg(await rendered.blob.arrayBuffer());
      const landscape = rendered.width > rendered.height;
      const page = doc.addPage(landscape ? [841.89, 595.28] : [595.28, 841.89]);
      const scale = Math.min((page.getWidth() - 36) / rendered.width, (page.getHeight() - 36) / rendered.height);
      const width = rendered.width * scale, height = rendered.height * scale;
      page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
    }
    return { data: await doc.save(), name: `${name}.pdf`, mime: 'application/pdf' };
  }
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  if (pages.length === 1) {
    progress?.(1);
    const { blob } = await renderScan(pages[0], mode, mime);
    return { data: new Uint8Array(await blob.arrayBuffer()), name: `${name}.${format}`, mime };
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    progress?.(i + 1);
    const { blob } = await renderScan(pages[i], mode, mime);
    zip.file(`${name}-${String(i + 1).padStart(2, '0')}.${format}`, await blob.arrayBuffer());
  }
  return { data: await zip.generateAsync({ type: 'uint8array' }), name: `${name}-${format}.zip`, mime: 'application/zip' };
}
