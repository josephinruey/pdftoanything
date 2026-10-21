import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { testScanner } from './scanner.mjs';

const filename = path.resolve(process.argv[2] ?? 'dist-standalone/PDFolio.html');
const html = await fs.readFile(filename, 'utf8');
const temp = await fs.mkdtemp(path.join(tmpdir(), 'pdfolio-html-'));
const executablePath = process.env.CHROMIUM_PATH ?? (await fs.access('/usr/bin/chromium').then(() => '/usr/bin/chromium').catch(() => undefined));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
let usesOpaqueFallback = false;
async function openPage(page) {
  if (usesOpaqueFallback) await page.setContent(html, { waitUntil: 'load' });
  else await page.goto(pathToFileURL(filename).href);
  await page.locator('.tool-card').last().waitFor();
}
try {
  const probe = await browser.newPage({ offline: true });
  try { await probe.goto(pathToFileURL(filename).href); }
  catch (err) {
    // Respect managed-browser file navigation policy. Test the exact HTML in
    // an opaque-origin offline document instead; never disable the policy.
    if (!err.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR')) throw err;
    usesOpaqueFallback = true;
  } finally { await probe.close(); }
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  await openPage(page);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.tool-card').count(), 33);
  assert.equal(await page.locator('script[src], link[href]').count(), 0);
  assert.equal(await page.evaluate(() => document.fonts.check('600 16px "Noto Sans TC"', '掃描文件')), true);
  await page.getByRole('textbox', { name: '搜尋工具' }).fill('合併');
  assert.equal(await page.locator('.tool-card').count(), 1);
  await page.getByRole('button', { name: '清除搜尋' }).click();
  await page.getByRole('button', { name: '收藏合併 PDF', exact: true }).click();
  await page.locator('.main-nav').getByRole('button', { name: '我的收藏' }).click();
  assert.equal(await page.locator('.tool-card').count(), 1);
  await page.locator('.main-nav').getByRole('button', { name: '所有 PDF 工具' }).click();
  console.log('PASS offline interface: 33 tools, embedded fonts, search, favorites, restricted-storage compatibility');
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) doc.addPage([400, 600]).drawText(`Offline page ${i}`, { x: 30, y: 540, font, size: 20 });
  const buffer = Buffer.from(await doc.save());
  const pdf = { name: 'offline.pdf', mimeType: 'application/pdf', buffer };
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 240;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#32684f'; ctx.fillRect(0, 0, 360, 240);
    return Array.from(new Uint8Array(await (await new Promise(r => canvas.toBlob(r, 'image/png'))).arrayBuffer()));
  });
  const image = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png) };
  const cases = [
    { title: '合併 PDF', files: [pdf, pdf], pages: 6 },
    { title: '拆分 PDF', pagesText: '1,3', zip: 2 },
    { title: '壓縮 PDF', pages: 3 },
    { title: '編輯 PDF', text: 'EDITED OFFLINE', pages: 3 },
    { title: 'PDF 轉 JPG', zip: 3 },
    { title: 'JPG 轉 PDF', files: [image], pages: 1 },
    { title: 'PDF 簽名', signature: true, pages: 3 },
    { title: '添加浮水印', pages: 3 },
    { title: '旋轉 PDF', pages: 3, rotation: 90 },
    { title: '整理 PDF', pagesText: '3,1', pages: 2 },
    { title: '添加頁碼', pages: 3 },
    { title: '比較 PDF', files: [pdf, pdf], textOutput: '文字相同' },
    { title: '裁剪 PDF', pages: 3, cropWidth: 352 },
    { title: 'PDF 表單', pages: 3, fields: 1 },
    { title: 'PDF 轉 Markdown', textOutput: 'Offline page 1' },
    { title: '移除頁面', pagesText: '2', pages: 2 },
    { title: '提取頁面', pagesText: '1,3', pages: 2 },
  ];
  for (const test of cases) {
    await page.locator('.tool-card').filter({ has: page.getByRole('heading', { name: test.title, exact: true }) }).locator('.card-main').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(test.files ?? [pdf]);
    if (test.pagesText) await dialog.locator('.settings .field-label input').first().fill(test.pagesText);
    if (test.text) await dialog.getByRole('textbox', { name: '新增文字' }).fill(test.text);
    if (test.signature) {
      const canvas = dialog.locator('canvas'); await canvas.scrollIntoViewIfNeeded();
      const b = await canvas.boundingBox();
      await page.mouse.move(b.x + 40, b.y + 50); await page.mouse.down();
      await page.mouse.move(b.x + 80, b.y + 90, { steps: 4 }); await page.mouse.move(b.x + 130, b.y + 35, { steps: 4 }); await page.mouse.up();
    }
    await dialog.getByRole('button', { name: test.title === '比較 PDF' ? '開始比較' : '開始處理', exact: true }).click();
    await dialog.getByText('完成了，又一件事搞定。').waitFor({ timeout: 30000 });
    const pending = page.waitForEvent('download');
    await dialog.getByRole('button', { name: /^下載/ }).click();
    const download = await pending, bytes = await fs.readFile(await download.path());
    if (test.pages) {
      const output = await PDFDocument.load(bytes); assert.equal(output.getPageCount(), test.pages);
      if (test.rotation) assert.equal(output.getPage(0).getRotation().angle, test.rotation);
      if (test.cropWidth) assert.equal(output.getPage(0).getCropBox().width, test.cropWidth);
      if (test.fields) assert.equal(output.getForm().getFields().length, test.fields);
    }
    if (test.zip) assert.equal(Object.keys((await JSZip.loadAsync(bytes)).files).length, test.zip);
    if (test.textOutput) assert.ok(bytes.toString('utf8').includes(test.textOutput));
    await dialog.getByRole('button', { name: '關閉', exact: true }).click();
    console.log(`PASS offline ${test.title}`);
  }
  await page.locator('.tool-card').filter({ has: page.getByRole('heading', { name: 'AI 摘要產生器', exact: true }) }).locator('.card-main').click();
  await page.getByText('進階功能 · 尚未啟用').waitFor();
  assert.equal(await page.getByRole('dialog').locator('input[type=file]').count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click();
  console.log('PASS offline advanced-service availability matches website');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await testScanner(browser, null, temp, { openPage, offline: true, testModule: false });
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  console.log('PASS no external HTTP requests and no browser errors');
  if (usesOpaqueFallback) console.log('NOTE: file: navigation is blocked by the managed test browser; exact standalone HTML tested as an opaque-origin document in offline mode.');
  else console.log('PASS direct file: navigation');
} finally { await browser.close(); await fs.rm(temp, { recursive: true, force: true }); }
