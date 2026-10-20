import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, Camera, CheckCircle2, CircleHelp, Download, FileImage, FileText, ImagePlus, Loader2, RotateCw, ScanLine, Share2, ShieldCheck, Trash2, X } from 'lucide-react';
import { exportScan, prepareScan } from './scanner';
import type { ScanFormat, ScanImage, ScanMode } from './scanner';
import type { Output } from './processor';

type Page = ScanImage & { id: string; preview: string; name: string; width: number; height: number };
const MAX_PAGES = 20;
function resultFile(result: Output) {
  return new File([typeof result.data === 'string' ? result.data : new Uint8Array(result.data).buffer], result.name, { type: result.mime });
}
export default function ScannerModal({ initialFiles, onClose }: { initialFiles: File[]; onClose: () => void }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [format, setFormat] = useState<ScanFormat>('pdf');
  const [mode, setMode] = useState<ScanMode>('color');
  const [filename, setFilename] = useState('掃描文件');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Output | null>(null);
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const urls = useRef(new Set<string>());
  const mounted = useRef(false);
  const adding = useRef(false);
  const initialLoaded = useRef(false);
  const busyRef = useRef(false);
  const pageCount = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
      if (e.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      mounted.current = false;
      document.removeEventListener('keydown', key);
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear();
      previous?.focus();
    };
  }, []);
  useEffect(() => { if (!initialLoaded.current && initialFiles.length) { initialLoaded.current = true; void addFiles(initialFiles); } }, []);
  function setWorking(value: boolean) { busyRef.current = value; setBusy(value); }
  async function addFiles(files: File[]) {
    if (!files.length || adding.current || busyRef.current) return;
    const room = MAX_PAGES - pageCount.current;
    if (files.length > room) { setError(`一次最多整理 ${MAX_PAGES} 頁。請減少選取的照片，或先匯出現有頁面。`); return; }
    adding.current = true; setWorking(true); setError(''); setResult(null);
    const added: Page[] = [], failures: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (!mounted.current) break;
        setProgress(`正在加入照片 ${i + 1} / ${files.length}`);
        try {
          const image = await prepareScan(files[i]);
          if (!mounted.current) break;
          const preview = URL.createObjectURL(image.thumbnail); urls.current.add(preview);
          added.push({ id: crypto.randomUUID(), blob: image.blob, preview, width: image.width, height: image.height, name: files[i].name, rotation: 0 });
        } catch (err) { failures.push(`${files[i].name}：${err instanceof Error ? err.message : '無法讀取照片，請重新選擇。'}`); }
      }
      if (mounted.current) {
        pageCount.current += added.length;
        setPages(prev => [...prev, ...added]);
        if (failures.length) setError(failures.join('\n'));
      }
    } finally { adding.current = false; if (mounted.current) { setWorking(false); setProgress(''); } }
  }
  function remove(id: string) {
    const page = pages.find(p => p.id === id);
    if (page) { URL.revokeObjectURL(page.preview); urls.current.delete(page.preview); pageCount.current--; }
    setPages(prev => prev.filter(p => p.id !== id)); setError('');
  }
  function move(index: number, delta: number) {
    setPages(prev => { const next = [...prev]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
  }
  async function run() {
    if (busyRef.current || !pages.length) return;
    setWorking(true); setError('');
    try {
      const output = await exportScan(pages, format, mode, filename, page => setProgress(`正在匯出第 ${page} / ${pages.length} 頁`));
      if (mounted.current) setResult(output);
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : '匯出失敗，請減少頁數後重試。'); }
    finally { if (mounted.current) { setWorking(false); setProgress(''); } }
  }
  function save() {
    if (!result) return;
    const url = URL.createObjectURL(resultFile(result));
    const link = document.createElement('a'); link.href = url; link.download = result.name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function share() {
    if (!result) return;
    try { await navigator.share({ files: [resultFile(result)], title: filename || '掃描文件' }); }
    catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) setError('無法開啟分享選單，請使用下載按鈕儲存檔案。'); }
  }
  const canShare = result && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [resultFile(result)] });
  return <div className="modal-backdrop" onClick={() => !busyRef.current && onClose()}>
    <section className="modal scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" ref={dialogRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
      <button className="modal-close" disabled={busy} onClick={onClose} aria-label="關閉"><X size={20}/></button>
      <div className="tool-modal-heading"><span className="tool-icon icon-coral"><ScanLine size={26}/></span><div><span className="eyebrow">FROM PAPER TO POSSIBILITY</span><h2 id="scanner-title">手機掃描文件</h2></div></div>
      <p className="modal-description">拍下紙本，整理成你需要的樣子。選擇圖片或 PDF，隨時帶著走。</p>
      {result ? <div className="success-state">
        <span className="success-icon"><CheckCircle2 size={38}/></span><span className="eyebrow">YOUR DOCUMENT IS READY</span><h3>掃描完成，準備好帶走。</h3>
        <p>{pages.length} 頁文件已匯出為 {result.mime === 'application/zip' ? `${format.toUpperCase()} 圖片 ZIP` : format.toUpperCase()}。</p>
        <div className="result-file">{format === 'pdf' ? <FileText size={27}/> : <FileImage size={27}/>}<div><strong>{result.name}</strong><span>{(new Uint8Array(result.data as Uint8Array).length / 1024 / 1024).toFixed(2)} MB</span></div><CheckCircle2 size={19}/></div>
        <button className="primary-button" onClick={save}><Download size={17}/>下載{result.mime === 'application/zip' ? '圖片 ZIP' : format === 'pdf' ? ' PDF' : '圖片'}<ArrowDown size={16}/></button>
        {canShare && <button className="scanner-share" onClick={share}><Share2 size={16}/>分享或儲存到手機</button>}
        <p className="scanner-save-hint">{result.mime === 'application/zip' ? '多頁圖片已依順序打包，解壓縮後即可分別使用。' : '手機若開啟檔案預覽，可從分享選單選擇儲存到檔案或照片。'}</p>
        <button className="text-button" onClick={() => { setResult(null); setError(''); }}>返回頁面，改用其他格式匯出<ArrowRight size={14}/></button>
      </div> : <>
        <div className={`scanner-capture ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}>
          <span className="scanner-camera-symbol"><Camera size={27}/></span><h3>{pages.length ? '還有下一頁嗎？接著拍。' : '把紙本文件，變成隨身檔案。'}</h3>
          <p>將文件放平、光線充足，讓整張紙保持在畫面中。</p>
          <div className="scanner-source-buttons"><button className="primary-button" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera size={17}/>{pages.length ? '繼續拍攝' : '拍照掃描'}</button><button className="scanner-album" disabled={busy} onClick={() => albumRef.current?.click()}><ImagePlus size={17}/>從相簿加入</button></div>
          <span>支援多頁文件 · 最多 20 頁 · 單張照片最大 50 MB</span>
        </div>
        <input ref={cameraRef} className="hidden scanner-camera-input" aria-label="拍攝文件" type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}/>
        <input ref={albumRef} className="hidden scanner-album-input" aria-label="選取文件照片" type="file" accept="image/*" multiple disabled={busy} onChange={e => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}/>
        <p className="scanner-browser-note">手機會依瀏覽器支援開啟相機或選擇器；若無法拍照，可先用手機相機拍攝，再從相簿加入。</p>
        {pages.length > 0 && <><div className="scanner-pages-heading"><h3>整理掃描頁面<span>{pages.length} 頁</span></h3><span>依下方順序匯出</span></div><ol className={`scanner-pages mode-${mode}`}>
          {pages.map((page, i) => <li className="scanner-page" key={page.id}>
            <div className="scanner-preview"><img src={page.preview} alt={`第 ${i + 1} 頁：${page.name}`} style={{ transform: `rotate(${page.rotation}deg)` }}/><span>{String(i + 1).padStart(2, '0')}</span></div>
            <div className="scanner-page-name" title={page.name}>{page.name}</div>
            <div className="scanner-page-actions"><button disabled={busy} onClick={() => setPages(prev => prev.map(p => p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))} aria-label={`旋轉第 ${i + 1} 頁`}><RotateCw size={15}/></button><button disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`上移第 ${i + 1} 頁`}><ArrowUp size={15}/></button><button disabled={busy || i === pages.length - 1} onClick={() => move(i, 1)} aria-label={`下移第 ${i + 1} 頁`}><ArrowDown size={15}/></button><button disabled={busy} onClick={() => remove(page.id)} aria-label={`刪除第 ${i + 1} 頁`}><Trash2 size={15}/></button></div>
          </li>)}
        </ol></>}
        <fieldset className="scanner-formats" disabled={busy}><legend>選擇匯出格式</legend><div>{([{ id: 'pdf', title: 'PDF 文件', subtitle: '多頁合併，方便分享', icon: FileText }, { id: 'jpg', title: 'JPG 圖片', subtitle: '體積輕巧，日常好用', icon: FileImage }, { id: 'png', title: 'PNG 圖片', subtitle: '保留輸出的像素細節', icon: FileImage }] as const).map(f => <label key={f.id} className={format === f.id ? 'selected' : ''}><input type="radio" name="scan-format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)}/><f.icon size={20}/><strong>{f.title}</strong><span>{f.subtitle}</span></label>)}</div><p>{format === 'pdf' ? '每張照片各成一頁，合併為一份 A4 PDF。' : '一頁直接下載圖片；多頁依順序編號，打包為 ZIP 下載。'}</p></fieldset>
        <div className="scanner-options"><label className="field-label">文件色彩<select disabled={busy} value={mode} onChange={e => setMode(e.target.value as ScanMode)}><option value="color">原始彩色</option><option value="gray">灰階</option><option value="bw">黑白文件</option></select></label><label className="field-label">檔案名稱<input disabled={busy} maxLength={80} value={filename} onChange={e => setFilename(e.target.value)} placeholder="掃描文件"/></label></div>
        <p className="scanner-quality-note">照片長邊最高保留 2400 像素。此功能不包含自動裁邊、透視校正或 OCR 辨識。</p>
        <button className="primary-button" disabled={busy || !pages.length} onClick={run}>{busy ? <><Loader2 size={17} className="spin"/>{progress || '正在處理…'}</> : <><ScanLine size={17}/>匯出{format === 'pdf' ? ' PDF 文件' : ` ${format.toUpperCase()} 圖片`}<ArrowRight size={16}/></>}</button>
        <div className="scanner-live-status" role="status" aria-live="polite">{busy ? progress : ''}</div>
      </>}
      {error && <div className="error-message scanner-error" role="alert"><CircleHelp size={17}/><span>{error}</span></div>}
      <div className="modal-security"><ShieldCheck size={13}/>照片只在你的裝置處理，不會上傳。</div>
    </section>
  </div>;
}
