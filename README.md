# PDFolio · pdftoanything

繁體中文 PDF 工具工作空間，使用 React、TypeScript 與 Vite。包含 33 項工具入口、六類工具分類、搜尋、排序、收藏、最近使用與響應式介面。

## 開發

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev -- --port 3000
```

```sh
npm run build
npm run preview
npm test
```

測試會自動啟動並關閉獨立的 Vite 伺服器（4174），產生測試文件，在真實 Chromium 中驗證 PDF 輸出、下載、錯誤處理與手機版。優先使用 `CHROMIUM_PATH` 或 `/usr/bin/chromium`；若機器沒有 Chromium，先執行 `npx playwright install chromium`。

## 已可使用：18 項本機工具

所有檔案運算都在瀏覽器完成，不上傳文件。

- 合併、逐頁拆分、提取、移除、重新排序頁面。
- 結構壓縮、旋轉、頁碼、文字浮水印、文字註記、裁剪。
- JPG / PNG 轉 PDF、手機文件掃描（PDF / JPG / PNG 匯出）、PDF 逐頁轉 JPG ZIP。
- 手寫圖像簽名、建立一個可填寫的表單文字欄位。
- 逐頁文字比較報告、依頁面分節的 Markdown 文字匯出。

### 功能界線

- 結構壓縮不會重新壓縮圖片，已最佳化的 PDF 可能不會變小。
- 文字註記與浮水印使用內建 Helvetica，目前限英文與數字，不會編輯原有文字。
- 手機文件掃描透過瀏覽器的原生拍攝選擇器使用後鏡頭，也可從相簿加入。是否直接開啟相機依裝置與瀏覽器支援而定；不含自動裁邊、透視校正與 OCR。
- 裁剪只調整可視範圍，不會永久刪除隱藏內容。
- 圖像簽名不是憑證數位簽章；表單工具只新增一個空白文字欄位。
- 比較功能只比較逐頁文字，不比較圖像或排版。
- Markdown 是文字擷取，不會重建表格、圖片與語意標題；掃描 PDF 需先經過 OCR。
- 單一檔案上限 50 MB，建議使用現代桌面瀏覽器處理大型文件。

## 尚未串接的進階功能：15 項

PDF 與 Word / PowerPoint / Excel 雙向轉換、HTML 轉 PDF、解鎖、加密、PDF/A、修復、OCR、永久密文、AI 摘要與翻譯。

這些工具顯示尚未啟用與服務需求，不會上傳檔案或回傳模擬的處理結果。後續需分別加入文件處理引擎（如 LibreOffice、qpdf、Ghostscript）、OCR 與 AI API，並建立檔案刪除與存取控制。

收藏與最近使用僅在 localStorage 記錄工具 ID，不儲存文件。Google Fonts 用於載入字型；沒有設定任何分析追蹤。

## GitHub Pages 部署

已提供 `.github/workflows/deploy-pages.yml`。在 GitHub 儲存庫的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。推送到 `main` 後會自動建置與部署；也可在 Actions 中手動執行工作流程。

此儲存庫的預期網址為 `https://josephinruey.github.io/pdftoanything/`，實際是否上線以 GitHub Pages 的成功部署結果為準。工作流程會設定 Vite 的 `/pdftoanything/` 子路徑，確保 JavaScript、樣式與 PDF worker 正確載入。GitHub Pages 只提供靜態網站，未串接的後端功能不會因此自動啟用。

若需要本機檢查部署版本：

```sh
npm run build -- --base=/pdftoanything/
npm run preview -- --port 4175 --base=/pdftoanything/
```

私有儲存庫能否使用 Pages 依 GitHub 方案而定；無須也不應為此自動變更儲存庫可見性。

## 手機文件掃描

開啟「手機掃描文件」→「拍照掃描」或「從相簿加入」，可連續拍攝並新增最多 20 頁。每頁提供預覽、旋轉、上移／下移與刪除，匯出依整理後的順序排列。

- **PDF**：每張照片各成一頁，依照片方向置中排入 A4，合併成一份文件。
- **JPG / PNG**：一頁直接下載圖片；多頁依順序編號並打包成 ZIP。
- 可選原始彩色、灰階或黑白文件，並自訂檔名。匯出後可返回改用其他格式，不必重新拍攝。
- 支援 Web Share 的手機可使用「分享或儲存到手機」，其他裝置使用下載按鈕；能否直接存入相簿依瀏覽器而定。
- 所有照片留在裝置上處理，不上傳；不需後端，可在 GitHub Pages 使用。
- 每張原始照片上限 50 MB；為限制手機記憶體用量，加入時先正規化為 JPEG，長邊最多 2400 像素，手機照片方向由瀏覽器解碼套用。PNG 匯出也使用此正規化後的來源。
- 接受瀏覽器可解碼的圖片；HEIC 若無法讀取會提示改用 JPG，不會默默略過。

`npm test` 包含模擬手機拍攝與相簿選取、頁面整理、單張 JPG / PNG、多頁 ZIP、PDF 頁面順序、旋轉與色彩的瀏覽器測試。原生相機操作仍需在實體 iPhone / Android 裝置上確認。

## 單一 HTML 離線版

**直接下載：** [離線版 ZIP](https://raw.githubusercontent.com/josephinruey/pdftoanything/main/downloads/PDFolio-offline.zip)。解壓縮後只有一個 `PDFolio.html`，以 Chrome 或 Edge 開啟即可。若下載沒有自動開始，可到 [GitHub 下載目錄](https://github.com/josephinruey/pdftoanything/tree/main/downloads) 選擇 ZIP，再使用「Download raw file」。HTML 內嵌字型與引擎，因此檔案較大；GitHub 的程式碼預覽不等於可執行的網頁預覽。


```sh
npm ci
npm run build:html
npm run test:html
```

產生 `dist-standalone/PDFolio.html`（約 12.5 MB）。將這一個檔案複製到電腦，以最新版 Chrome 或 Edge 直接開啟，不需 Node.js、網路、相鄰資源目錄或本機伺服器。介面與 33 個入口保留原樣，現有 18 項本機工具可離線處理；原本未啟用的 15 項服務不會因打包而變成可用。

程式碼、CSS、DM Sans / Noto Sans TC 字型、PDF.js worker、PDF 字型／CMap／WASM 資源及第三方授權聲明均包含在 HTML 裡。只在離線打包時對儲存與頁面 ID 加入本機來源的相容性處理，網站版本不變。瀏覽器若不允許本機檔案使用 localStorage，收藏與使用紀錄仍能在目前開啟期間操作，但不會跨次保留。手機拍攝與分享能力依裝置瀏覽器支援而定。

離線測試實際操作 17 項一般工具與掃描匯出、下載、字型、搜尋、收藏及手機版，並確認沒有外部 HTTP 請求。若測試機的受管理 Chromium 禁止 `file:` 導航，測試會明確回報，改在斷網的 opaque-origin 文件中載入同一份 HTML 驗證；不會關閉瀏覽器的管理政策。因此這種環境下的測試不等同直接雙擊檔案的實機驗證。

重新製作可下載的 HTML 與 ZIP：

```sh
npm run package:html
```

產物位於 `downloads/`；ZIP 只包含單一 HTML，打包時會驗證解壓內容與原檔完全相同。
