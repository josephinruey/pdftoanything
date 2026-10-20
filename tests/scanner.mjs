import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export async function testScanner(browser, baseURL, temp) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(baseURL);
    await page.getByRole('heading', { name: '手機掃描文件', exact: true }).waitFor();
    const photos = await page.evaluate(async () => {
      async function photo(color, width, height) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
        return Array.from(new Uint8Array(await (await new Promise(r => canvas.toBlob(r, 'image/png'))).arrayBuffer()));
      }
      return { red: await photo('#d52c32', 400, 200), blue: await photo('#2256d3', 180, 300) };
    });
    const redPath = `${temp}/red.png`, bluePath = `${temp}/blue.png`;
    await fs.writeFile(redPath, Buffer.from(photos.red)); await fs.writeFile(bluePath, Buffer.from(photos.blue));
    await page.locator('.tool-card').filter({ has: page.getByRole('heading', { name: '手機掃描文件', exact: true }) }).locator('.card-main').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: '手機掃描文件', exact: true }).waitFor();
    assert.equal(await page.locator('.scanner-camera-input').getAttribute('capture'), 'environment');
    assert.equal(await page.locator('.scanner-camera-input').getAttribute('multiple'), null);
    assert.equal(await page.locator('.scanner-album-input').getAttribute('multiple'), '');
    assert.equal(await dialog.getByRole('button', { name: '匯出 PDF 文件' }).isDisabled(), true);
    let chooser = page.waitForEvent('filechooser');
    await dialog.getByRole('button', { name: '拍照掃描', exact: true }).click();
    await (await chooser).setFiles(redPath);
    await page.locator('.scanner-page').first().waitFor();
    await dialog.getByRole('button', { name: '匯出 PDF 文件' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.scanner-camera-input').disabled);
    console.log('PASS scanner mobile capture input and preview');
    chooser = page.waitForEvent('filechooser');
    await dialog.getByRole('button', { name: '從相簿加入', exact: true }).click();
    await (await chooser).setFiles(bluePath);
    await page.waitForFunction(() => document.querySelectorAll('.scanner-page').length === 2 && !document.querySelector('.scanner-camera-input').disabled);
    await dialog.getByRole('button', { name: '上移第 2 頁' }).click();
    assert.match(await page.locator('.scanner-page').first().innerText(), /blue.png/);
    await dialog.getByRole('button', { name: '旋轉第 1 頁' }).click();
    assert.match(await page.locator('.scanner-preview img').first().getAttribute('style'), /rotate\(90deg\)/);
    await dialog.getByRole('textbox', { name: '檔案名稱' }).fill('手機文件');
    const downloads = [];
    async function output(format, button) {
      await dialog.getByRole('radio', { name: format }).check();
      await dialog.getByRole('button', { name: button, exact: true }).click();
      await dialog.getByRole('heading', { name: '掃描完成，準備好帶走。' }).waitFor();
      const promise = page.waitForEvent('download'); await dialog.getByRole('button', { name: /^下載/ }).click();
      const download = await promise; const bytes = await fs.readFile(await download.path());
      downloads.push({ name: download.suggestedFilename(), bytes });
      await dialog.getByRole('button', { name: '返回頁面，改用其他格式匯出' }).click();
      return downloads[downloads.length - 1];
    }
    const pdf = await output('PDF 文件', '匯出 PDF 文件');
    assert.equal(pdf.name, '手機文件.pdf');
    const doc = await PDFDocument.load(pdf.bytes); assert.equal(doc.getPageCount(), 2);
    // Blue portrait rotated into landscape first; red landscape second.
    for (const p of doc.getPages()) assert.ok(p.getWidth() > p.getHeight());
    console.log('PASS scanner PDF export with multiple rotated pages');
    const pngs = await output('PNG 圖片', '匯出 PNG 圖片');
    const zip = await JSZip.loadAsync(pngs.bytes);
    assert.deepEqual(Object.keys(zip.files), ['手機文件-01.png', '手機文件-02.png']);
    const firstPNG = await zip.file('手機文件-01.png').async('nodebuffer');
    const secondPNG = await zip.file('手機文件-02.png').async('nodebuffer');
    async function pixels(bytes) {
      return page.evaluate(async input => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(input)]));
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
        const pixel = Array.from(ctx.getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1).data);
        const result = { width: bitmap.width, height: bitmap.height, pixel }; bitmap.close(); return result;
      }, Array.from(bytes));
    }
    const first = await pixels(firstPNG), second = await pixels(secondPNG);
    assert.equal(first.width, 300); assert.equal(first.height, 180);
    assert.ok(first.pixel[2] > first.pixel[0] + 100); assert.ok(second.pixel[0] > second.pixel[2] + 100);
    console.log('PASS scanner multiple PNG ZIP, order and rotation verified by image pixels');
    const jpgs = await output('JPG 圖片', '匯出 JPG 圖片');
    assert.equal(jpgs.name, '手機文件-jpg.zip');
    const jpgZip = await JSZip.loadAsync(jpgs.bytes); assert.equal(Object.keys(jpgZip.files).length, 2);
    assert.ok((await pixels(await jpgZip.file('手機文件-01.jpg').async('nodebuffer'))).pixel[2] > 150);
    console.log('PASS scanner multiple JPG ZIP');
    await dialog.getByRole('button', { name: '刪除第 2 頁' }).click();
    await dialog.getByRole('combobox', { name: '文件色彩' }).selectOption('gray');
    const gray = await output('PNG 圖片', '匯出 PNG 圖片'); assert.equal(gray.name, '手機文件.png');
    const grayPixel = (await pixels(gray.bytes)).pixel; assert.equal(grayPixel[0], grayPixel[1]); assert.equal(grayPixel[1], grayPixel[2]);
    console.log('PASS scanner single PNG download, delete and grayscale');
    await dialog.getByRole('combobox', { name: '文件色彩' }).selectOption('bw');
    const bw = await output('JPG 圖片', '匯出 JPG 圖片'); assert.equal(bw.name, '手機文件.jpg');
    const bwPixel = (await pixels(bw.bytes)).pixel; assert.ok(bwPixel.slice(0, 3).every(p => p < 5));
    console.log('PASS scanner single JPG and black-white mode');
    await page.locator('.scanner-album-input').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a photo') });
    await dialog.getByRole('alert').waitFor(); assert.match(await dialog.getByRole('alert').innerText(), /無法讀取/);
    assert.equal(await page.locator('.scanner-page').count(), 1);
    console.log('PASS scanner invalid-photo error preserves existing pages');
    await page.locator('.scanner-album-input').setInputFiles(Array.from({ length: 20 }, () => redPath));
    await dialog.getByRole('alert').waitFor(); assert.match(await dialog.getByRole('alert').innerText(), /最多整理 20 頁/);
    assert.equal(await page.locator('.scanner-page').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => { const d = document.querySelector('.scanner-modal'); return d.scrollWidth > d.clientWidth; }), false);
    console.log('PASS scanner page limit and mobile layout');
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    // Exercise large-photo normalization and filename fallback with the same production module.
    const normalization = await page.evaluate(async () => {
      const { prepareScan, exportScan } = await import('/src/scanner.ts');
      const c = document.createElement('canvas'); c.width = 3000; c.height = 1500;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const prepared = await prepareScan(new File([blob], 'large.png', { type: 'image/png' }));
      const out = await exportScan([{ blob: prepared.blob, rotation: 0 }], 'png', 'color', '   ');
      let rejected = false; try { await exportScan([], 'pdf', 'color', 'empty'); } catch { rejected = true; }
      return { width: prepared.width, height: prepared.height, name: out.name, rejected };
    });
    assert.deepEqual(normalization, { width: 2400, height: 1200, name: '掃描文件.png', rejected: true });
    console.log('PASS scanner large-photo normalization, filename fallback and empty-document rejection');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
