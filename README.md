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
- JPG / PNG 轉 PDF、照片掃描為 PDF、PDF 逐頁轉 JPG ZIP。
- 手寫圖像簽名、建立一個可填寫的表單文字欄位。
- 逐頁文字比較報告、依頁面分節的 Markdown 文字匯出。

### 功能界線

- 結構壓縮不會重新壓縮圖片，已最佳化的 PDF 可能不會變小。
- 文字註記與浮水印使用內建 Helvetica，目前限英文與數字，不會編輯原有文字。
- 圖片掃描是照片整合，不含透視校正、相機存取與 OCR。
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
