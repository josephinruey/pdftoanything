import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Image, ArrowRight, ArrowUpRight, Search, Plus, Upload, ChevronDown, ChevronRight, LayoutGrid, PanelTop, Heart, Clock3, ShieldCheck, Zap, X, Check, CheckCircle2, FileText, Download, Loader2, Trash2, Menu, Layers, FolderOpen, HelpCircle, LockKeyhole, Sparkles, SlidersHorizontal, ArrowUp, ArrowDown, CircleHelp } from 'lucide-react';
import { categories, tools } from './tools';
import type { Tool } from './tools';
import type { Output } from './processor';
import './style.css';
const storage = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } };
const size = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
const serviceNotes: Record<string, string> = {
  'pdf-word': '保留原始排版的 Word 轉換需要文件轉換服務。', 'pdf-ppt': '可編輯的 PowerPoint 轉換需要文件轉換服務。', 'pdf-excel': '表格辨識與 Excel 匯出需要文件轉換服務。', 'word-pdf': 'Word 排版轉換需要 LibreOffice 等伺服器服務。', 'ppt-pdf': '簡報版面轉換需要 LibreOffice 等伺服器服務。', 'excel-pdf': '試算表的分頁與轉換需要 LibreOffice 等伺服器服務。', 'html-pdf': '完整的網頁渲染需要伺服器瀏覽器服務。', unlock: '安全地驗證與移除 PDF 密碼需要加密處理服務。', protect: 'PDF 密碼加密需要安全的伺服器處理服務。', 'pdf-a': '合規的 PDF/A 轉換與驗證需要封存轉換服務。', repair: '損壞文件的修復需要專用的 PDF 處理引擎。', ocr: '繁體中文與多語言文字辨識需要 OCR 引擎與語言模型。', redact: '永久移除文字與底層內容需要真正的密文處理引擎，單純遮蓋無法保護隱私。', summary: '智慧摘要需要連接 AI 模型服務。', translate: '保留版面的文件翻譯需要連接 AI 與文件排版服務。',
};
function Logo({ small = false }: { small?: boolean }) { return <div className={`logo ${small ? 'small' : ''}`}><span className="logo-mark"><Layers size={22} strokeWidth={2.5} /></span>{!small && <span>PDF<span className="logo-light">olio</span><span className="logo-dot">.</span></span>}</div>; }
function App() {
  const [category, setCategory] = useState('all');
  const [view, setView] = useState('tools');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Tool | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => storage('pdfolio-favorites', []));
  const [recent, setRecent] = useState<string[]>(() => storage('pdfolio-recent', []));
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sort, setSort] = useState('default');
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => { localStorage.setItem('pdfolio-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('pdfolio-recent', JSON.stringify(recent)); }, [recent]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
  useEffect(() => {
    if (!help && !uploadOpen && !selected) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [help, uploadOpen, selected]);
  useEffect(() => {
    if (!help && !uploadOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.task-modal, .help-modal');
    const controls = () => dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]');
    controls()?.[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { setHelp(false); setUploadOpen(false); setStaged([]); }
      if (e.key === 'Tab') {
        const items = controls(); if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [help, uploadOpen]);
  function choose(tool: Tool) { setSelected(tool); setRecent(p => [tool.id, ...p.filter(x => x !== tool.id)].slice(0, 12)); setUploadOpen(false); }
  function navigate(target: string, cat = 'all') { setView(target); setCategory(cat); setQuery(''); setMenu(false); }
  function toggleFavorite(id: string) { setFavorites(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  let visible = tools.filter(t => (category === 'all' || t.category === category) && (view !== 'favorites' || favorites.includes(t.id)) && (view !== 'recent' || recent.includes(t.id)) && `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
  if (view === 'recent') visible.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  if (sort === 'name') visible.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
  if (sort === 'local') visible.sort((a, b) => Number(!!b.local) - Number(!!a.local));
  const title = view === 'favorites' ? '我的收藏' : view === 'recent' ? '最近使用' : category === 'all' ? '探索所有工具' : categories.find(c => c.id === category)?.label;
  function stageFiles(files: File[]) { if (!files.length) return; setStaged(files); setUploadOpen(true); }
  return <div className="app-shell">
    {menu && <div className="nav-shade" onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
      <button className="brand-button" onClick={() => navigate('tools')} aria-label="PDFolio 首頁"><Logo /></button>
      <div className="workspace-label">你的日常文件工作空間</div>
      <button className="new-task" onClick={() => { setStaged([]); setUploadOpen(true); }}><Plus size={17} />建立新任務<span>NEW</span></button>
      <div className="nav-label">工作空間</div>
      <nav className="main-nav">
        <button className={view === 'tools' ? 'active' : ''} onClick={() => navigate('tools')}><LayoutGrid size={18} />所有 PDF 工具<span className="nav-number">33</span></button>
        <button className={view === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')}><Heart size={18} />我的收藏{favorites.length > 0 && <span className="nav-number">{favorites.length}</span>}</button>
        <button className={view === 'recent' ? 'active' : ''} onClick={() => navigate('recent')}><Clock3 size={18} />最近使用</button>
      </nav>
      <div className="nav-label category-label">工具分類<span>⌁</span></div>
      <nav className="category-nav">{categories.slice(1).map(c => <button key={c.id} className={category === c.id && view === 'tools' ? 'selected' : ''} onClick={() => navigate('tools', c.id)}><span className={`category-dot dot-${c.id}`} />{c.label}{c.id === 'ai' && <span className="new-label">NEW</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-note"><span className="privacy-icon"><ShieldCheck size={21} /></span><strong>你的文件，屬於你</strong><p>本機工具直接在瀏覽器處理，<br />讓每一份文件都安心。</p><button onClick={() => setHelp(true)}>了解隱私與安全 <ArrowUpRight size={12} /></button></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17} />幫助與使用指南<ArrowUpRight size={14} /></button><div className="sidebar-foot"><span className="tiny-logo"><Layers size={13} /> MADE FOR YOUR FLOW</span><span>v1.0</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu" onClick={() => setMenu(true)} aria-label="開啟導覽"><Menu size={20} /></button><PanelTop size={16} /><span>工作空間</span><ChevronRight size={13} /><strong>{view === 'favorites' ? '我的收藏' : view === 'recent' ? '最近使用' : '所有 PDF 工具'}</strong></div><div className="top-actions"><span className="local-status"><span />本機安全處理</span><div className="top-divider" /><button className="icon-button" onClick={() => setHelp(true)} aria-label="幫助"><HelpCircle size={19} /></button><div className="avatar" title="你的個人工作空間">Y</div></div></header>
      <div className="content">
        <div className="page-intro"><div><div className="eyebrow"><span /> A LITTLE SIMPLER. A LOT MORE POSSIBLE.</div><h1>讓文件，<span>多一點可能。</span><span className="title-spark">✳</span></h1><p>從第一頁到最後一步，你需要的 PDF 工具，都在這裡。</p></div><div className="intro-note"><span className="handdrawn-arrow">↙</span><span>少一點繁瑣，多一點從容</span></div></div>
        <section className={`hero ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); stageFiles(Array.from(e.dataTransfer.files)); }}>
          <div className="hero-copy"><div className="hero-kicker"><span className="mini-star">✦</span> 小小文件，大大可能</div><h2>把文件交給我們，<br />把時間留給<span>更重要的事。</span></h2><p>合併、轉換、編輯、整理。<br className="mobile-break" />簡單幾步，讓工作順暢起來。</p><div className="hero-upload-row"><button className="upload-button" onClick={() => uploadRef.current?.click()}><Upload size={17} />選擇檔案開始<ArrowRight size={16} /></button><span>或將檔案拖放至這裡</span></div><div className="hero-features"><span><Check size={13} />免安裝</span><span><Check size={13} />無需註冊</span><span><Check size={13} />為日常工作而設計</span></div></div>
          <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><span className="art-star star-one">✳</span><span className="art-star star-two">✧</span><div className="floating-tag tag-top"><span className="tag-dot"/>更簡單，更有條理</div><div className="paper paper-back"><div className="paper-corner"/><div className="back-line"/><div className="back-line"/><div className="back-box"/></div><div className="paper paper-front"><div className="paper-top"><span><FileText size={15} /> PDF</span><span>✧</span></div><div className="paper-heading">Make room<br/>for <em>possibility.</em></div><div className="paper-line long"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-chart"><span/><span/><span/><span/><span/></div><div className="paper-footer">A FRESH PERSPECTIVE <ArrowUpRight size={13}/></div></div><div className="floating-file file-blue"><FileText size={23}/><span>DOC</span></div><div className="floating-file file-coral"><Image size={23}/><span>JPG</span></div><div className="floating-check"><Check size={20} strokeWidth={3}/></div><div className="floating-tag tag-bottom"><Zap size={14} fill="currentColor"/>讓靈感，不被格式限制</div><span className="art-dot dot-one"/><span className="art-dot dot-two"/></div>
          <input ref={uploadRef} type="file" multiple accept="application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm" className="hidden" onChange={e => { stageFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        </section>
        <section className="tools-section" id="tools"><div className="section-heading"><div><h2>{title}<span>{visible.length}</span></h2><p>{view === 'favorites' ? '把常用的工具放在這裡，下次更快找到。' : view === 'recent' ? '接續你的文件工作，從上次的工具開始。' : '每一個文件任務，都有剛剛好的工具。'}</p></div><div className="tool-search"><Search size={16}/><input ref={searchRef} placeholder="搜尋你需要的工具…" aria-label="搜尋工具" value={query} onChange={e => setQuery(e.target.value)}/>{query ? <button onClick={() => setQuery('')} aria-label="清除搜尋"><X size={14}/></button> : <kbd>⌘ K</kbd>}</div></div>
          <div className="filter-row"><div className="filter-tabs">{categories.map(c => <button className={category === c.id ? 'active' : ''} key={c.id} onClick={() => setCategory(c.id)}>{c.id === 'all' && <LayoutGrid size={13}/>} {c.label}{c.id === 'ai' && <Sparkles size={12}/>}</button>)}</div><label className="sort-control"><SlidersHorizontal size={14}/><select aria-label="工具排序" value={sort} onChange={e => setSort(e.target.value)}><option value="default">預設排序</option><option value="name">依名稱排序</option><option value="local">本機工具優先</option></select><ChevronDown size={12}/></label></div>
          <div className="tools-grid">{visible.map(tool => <article key={tool.id} className={`tool-card card-${tool.color}`}><button className="card-main" onClick={() => choose(tool)}><div className="card-top"><span className={`tool-icon icon-${tool.color}`}><tool.icon size={23} strokeWidth={1.8}/></span>{tool.popular && <span className="popular-badge">熱門</span>}{tool.fresh && <span className="fresh-badge">全新功能 <span>✦</span></span>}</div><h3>{tool.title}</h3><p>{tool.description}</p><div className="card-bottom"><span>{tool.local ? <><ShieldCheck size={11}/> 本機處理</> : '尚未啟用'}</span><ArrowUpRight size={16}/></div></button><button className={`favorite-button ${favorites.includes(tool.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(tool.id) ? '取消收藏' : '收藏'}${tool.title}`} onClick={() => toggleFavorite(tool.id)}><Heart size={15} fill={favorites.includes(tool.id) ? 'currentColor' : 'none'}/></button></article>)}</div>
          {visible.length === 0 && <div className="empty-state">{view === 'favorites' ? <Heart size={32}/> : <Search size={32}/>}<h3>{query ? '沒有找到相符的工具' : view === 'favorites' ? '留一個位置，給常用的工具' : '這裡還沒有使用紀錄'}</h3><p>{query ? '試試「合併」、「圖片」或其他關鍵字。' : '探索工具，點選愛心收藏，讓下一次工作更順手。'}</p><button onClick={() => navigate('tools')}>探索所有工具 <ArrowRight size={14}/></button></div>}
        </section>
        <section className="bottom-banner"><div className="banner-icon"><ShieldCheck size={26}/></div><div><h3>安心，是每一次操作的起點。</h3><p>本機工具不會上傳你的檔案。文件的掌控權，始終在你手上。</p></div><button onClick={() => setHelp(true)}>認識我們的隱私設計<ArrowUpRight size={15}/></button></section>
        <footer><span>© {new Date().getFullYear()} PDFolio. 讓每一份文件，都有更多可能。</span><div><span className="footer-dot"/>用心設計，為你的日常。</div></footer>
      </div>
    </main>
    {selected && <ToolModal tool={selected} initialFiles={staged} onClose={() => { setSelected(null); setStaged([]); }} />}
    {uploadOpen && <div className="modal-backdrop" onClick={() => { setUploadOpen(false); setStaged([]); }}><section className="modal task-modal" role="dialog" aria-modal="true" aria-labelledby="task-title" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => { setUploadOpen(false); setStaged([]); }} aria-label="關閉"><X size={20}/></button><span className="modal-symbol"><FolderOpen size={28}/></span><div className="eyebrow">LET’S MAKE IT HAPPEN</div><h2 id="task-title">今天，想為文件做點什麼？</h2><p>{staged.length ? `已選擇 ${staged.length} 個檔案。選擇工具，接著完成操作。` : '選一個工具，開始你的下一份好作品。'}</p><div className="quick-tools">{tools.filter(t => ['merge', 'split', 'compress', 'jpg-pdf', 'rotate', 'watermark'].includes(t.id)).map(t => <button key={t.id} onClick={() => choose(t)}><span className={`tool-icon icon-${t.color}`}><t.icon size={20}/></span>{t.title}<ChevronRight size={15}/></button>)}</div><button className="text-button" onClick={() => { setUploadOpen(false); setStaged([]); navigate('tools'); document.querySelector('#tools')?.scrollIntoView({ behavior: 'smooth' }); }}>查看全部 33 個工具<ArrowRight size={14}/></button></section></div>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setHelp(false)} aria-label="關閉"><X size={20}/></button><span className="modal-symbol"><ShieldCheck size={28}/></span><h2 id="help-title">讓每一份文件，安心自在。</h2><p className="help-lead">你的文件工作空間，從簡單與透明開始。</p><div className="help-item"><ShieldCheck size={20}/><div><h3>檔案留在你的裝置</h3><p>標示「本機處理」的工具在瀏覽器內完成操作，不會將文件上傳到伺服器。關閉視窗後，已選檔案不會保存在網站中。</p></div></div><div className="help-item"><Zap size={20}/><div><h3>三步，完成文件任務</h3><p>選擇工具 → 加入檔案並調整設定 → 處理並下載結果。大型檔案可能需要較多時間與記憶體，建議每份檔案不超過 50 MB。</p></div></div><div className="help-item"><Sparkles size={20}/><div><h3>關於進階與 AI 工具</h3><p>Office 轉換、OCR、加密與 AI 功能已保留完整的工具入口，但目前尚未連接後端服務。這些工具不會假裝處理或上傳你的文件。</p></div></div><div className="help-item"><Heart size={20}/><div><h3>屬於你的快捷工作流</h3><p>點擊工具卡片上的愛心即可收藏。收藏與最近使用的工具名稱只保存在目前瀏覽器，不包含文件內容。</p></div></div><button className="primary-button" onClick={() => setHelp(false)}>了解了，開始探索<ArrowRight size={16}/></button></section></div>}
  </div>;
}
function ToolModal({ tool, initialFiles, onClose }: { tool: Tool; initialFiles: File[]; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Output | null>(null);
  const [pages, setPages] = useState('');
  const [angle, setAngle] = useState('90');
  const [text, setText] = useState(tool.id === 'watermark' ? 'CONFIDENTIAL' : '');
  const [margin, setMargin] = useState('24');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(false);
  const hasDrawn = useRef(false);
  const initialFilesLoaded = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const multi = ['merge', 'jpg-pdf', 'scan', 'compare'].includes(tool.id);
  const hasPages = ['split', 'rotate', 'organize', 'remove', 'extract', 'numbers', 'watermark', 'crop', 'edit', 'sign'].includes(tool.id);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function key(e: KeyboardEvent) { if (e.key === 'Escape' && !busy) onClose(); if (e.key === 'Tab') { const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], canvas'); if (!focusable?.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [busy]);
  useEffect(() => { if (!initialFilesLoaded.current && initialFiles.length && tool.local) { initialFilesLoaded.current = true; addFiles(initialFiles); } }, []);
  function addFiles(incoming: File[]) {
    setError(''); setResult(null);
    const images = ['jpg-pdf', 'scan'].includes(tool.id);
    const accepted = incoming.filter(f => images ? /\.(jpe?g|png)$/i.test(f.name) : /\.pdf$/i.test(f.name));
    if (accepted.length !== incoming.length) setError(images ? '請選擇 JPG 或 PNG 圖片。' : '請選擇 PDF 格式的檔案。');
    if (accepted.some(f => f.size > 50 * 1024 * 1024)) { setError('為確保瀏覽器順暢運作，單一檔案請勿超過 50 MB。'); return; }
    setFiles(prev => multi ? [...prev, ...accepted].slice(0, tool.id === 'compare' ? 2 : 50) : accepted.slice(0, 1));
  }
  async function run() {
    setError('');
    if (!files.length) { setError('請先選擇檔案。'); return; }
    if (['merge', 'compare'].includes(tool.id) && files.length < 2) { setError('這個工具需要至少兩份 PDF 文件。'); return; }
    if (['remove', 'extract', 'organize'].includes(tool.id) && !pages.trim()) { setError('請輸入需要處理的頁碼。'); return; }
    setBusy(true);
    try { await new Promise(r => setTimeout(r, 150)); const { processPDF } = await import('./processor'); const out = await processPDF(tool.id, files, { pages, angle, text, margin, signature: hasDrawn.current ? canvasRef.current?.toDataURL('image/png') : undefined }); setResult(out); }
    catch (err) { const message = err instanceof Error ? err.message : ''; setError(/encrypt|password/i.test(message) ? '這份 PDF 已加密，請先使用原應用程式解鎖後再試。' : /parse|invalid|header|xref/i.test(message) ? '無法讀取這份文件，請確認 PDF 完整且沒有損壞。' : message || '處理時發生問題，請重新選擇檔案後再試。'); }
    finally { setBusy(false); }
  }
  function move(index: number, delta: number) { setFiles(prev => { const next = [...prev]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; }); }
  function draw(e: React.PointerEvent<HTMLCanvasElement>, start = false) { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const box = canvas.getBoundingClientRect(); const x = (e.clientX - box.left) * canvas.width / box.width; const y = (e.clientY - box.top) * canvas.height / box.height; if (start) { drawRef.current = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(x, y); } else if (drawRef.current) { hasDrawn.current = true; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.strokeStyle = '#243f35'; ctx.lineTo(x, y); ctx.stroke(); } }
  return <div className="modal-backdrop" onClick={() => !busy && onClose()}><section ref={dialogRef} tabIndex={-1} className="modal tool-modal" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title" onClick={e => e.stopPropagation()}><button className="modal-close" disabled={busy} onClick={onClose} aria-label="關閉"><X size={20}/></button><div className="tool-modal-heading"><span className={`tool-icon icon-${tool.color}`}><tool.icon size={26}/></span><div><span className="eyebrow">YOUR NEXT POSSIBILITY</span><h2 id="tool-modal-title">{tool.title}</h2></div></div><p className="modal-description">{tool.description}</p>
    {!tool.local ? <div className="service-unavailable"><div className="service-illustration"><Layers size={36}/><span><LockKeyhole size={17}/></span></div><span className="service-label">進階功能 · 尚未啟用</span><h3>為更完整的工作流，預留更多可能。</h3><p>{serviceNotes[tool.id]}<br/>目前尚未連接此服務，因此不會收集或處理你的檔案。</p><div className="service-tip"><CircleHelp size={16}/><span>你仍可使用標示「本機處理」的工具完成日常 PDF 工作。</span></div><button className="primary-button" onClick={onClose}>探索其他工具<ArrowRight size={15}/></button></div> : result ? <div className="success-state"><span className="success-icon"><CheckCircle2 size={38}/></span><span className="eyebrow">ALL SET. WELL DONE.</span><h3>完成了，又一件事搞定。</h3><p>你的文件已準備好，隨時可以下載。</p><div className="result-file"><FileText size={27}/><div><strong>{result.name}</strong><span>{size(typeof result.data === 'string' ? new TextEncoder().encode(result.data).length : result.data.length)}</span></div><CheckCircle2 size={19}/></div>{result.note && <p className="result-note">{result.note}</p>}<button className="primary-button" onClick={async () => { const { download } = await import('./processor'); download(result); }}><Download size={17}/>下載{result.mime.includes('zip') ? ' ZIP 檔案' : '檔案'}<ArrowDown size={16}/></button><button className="text-button" onClick={() => { setResult(null); setFiles([]); }}>繼續處理其他文件<ArrowRight size={14}/></button></div> : <>
      <div className={`dropzone ${dragging ? 'dragging' : ''}`} role="button" tabIndex={0} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) fileRef.current?.click(); }} onClick={() => !busy && fileRef.current?.click()} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) addFiles(Array.from(e.dataTransfer.files)); }}><span className="drop-icon"><Upload size={23}/></span><strong>點擊選擇，或將檔案拖放到這裡</strong><p>{['jpg-pdf', 'scan'].includes(tool.id) ? '支援 JPG、PNG 圖片' : '支援 PDF 文件'} · 單一檔案最大 50 MB</p><span className="drop-hint">{multi ? tool.id === 'compare' ? '選擇兩份文件進行比較' : '可一次選擇多個檔案' : '一次處理一份文件'}</span></div><input className="hidden" ref={fileRef} type="file" accept={tool.accept ?? 'application/pdf'} multiple={multi} disabled={busy} onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}/>
      {files.length > 0 && <div className="file-list">{files.map((f, i) => <div className="file-row" key={`${f.name}-${i}`}><span className="file-order">{String(i + 1).padStart(2, '0')}</span><FileText size={21}/><div><strong>{f.name}</strong><span>{size(f.size)}</span></div>{multi && <><button disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label={`將 ${f.name} 上移`}><ArrowUp size={14}/></button><button disabled={i === files.length - 1 || busy} onClick={() => move(i, 1)} aria-label={`將 ${f.name} 下移`}><ArrowDown size={14}/></button></>}<button disabled={busy} onClick={() => setFiles(p => p.filter((_, index) => index !== i))} aria-label={`移除 ${f.name}`}><Trash2 size={15}/></button></div>)}</div>}
      <div className="settings">
      {hasPages && <label className="field-label">{tool.id === 'remove' ? '要移除的頁碼' : tool.id === 'organize' ? '新的頁面順序' : '要處理的頁碼'}<input disabled={busy} value={pages} onChange={e => setPages(e.target.value)} placeholder={tool.id === 'organize' ? '例如：3, 1, 2, 4-6' : ['remove', 'extract'].includes(tool.id) ? '例如：1, 3-5' : '全部頁面，或輸入 1, 3-5'}/><span>{tool.id === 'split' ? '每個選定頁面將獨立儲存為 PDF，並打包成 ZIP。' : tool.id === 'organize' ? '用逗號指定順序；未列出的頁面不會加入新文件。' : '使用逗號分隔頁碼，使用連字號指定範圍。'}</span></label>}
      {tool.id === 'rotate' && <label className="field-label">順時針旋轉角度<select value={angle} disabled={busy} onChange={e => setAngle(e.target.value)}><option value="90">90° · 向右旋轉</option><option value="180">180° · 上下翻轉</option><option value="270">270° · 向左旋轉</option></select></label>}
      {['watermark', 'edit'].includes(tool.id) && <label className="field-label">{tool.id === 'watermark' ? '浮水印文字' : '新增文字（置於頁面上方）'}<input disabled={busy} maxLength={80} value={text} onChange={e => setText(e.target.value)} placeholder="輸入英文或數字，例如 DRAFT"/><span>目前支援英文與數字。{tool.id === 'edit' ? '此功能會新增文字註記，不會改寫原有內容。' : '文字將以半透明效果置於頁面中央。'}</span></label>}
      {tool.id === 'crop' && <label className="field-label">四周裁剪邊距（pt）<input disabled={busy} type="number" min="0" max="250" value={margin} onChange={e => setMargin(e.target.value)}/><span>只調整可視範圍，不會永久刪除範圍外的內容。</span></label>}
      {tool.id === 'sign' && <div className="signature-field"><div><strong>在下方手寫簽名</strong><button disabled={busy} onClick={() => { canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 140); hasDrawn.current = false; }}>清除</button></div><canvas ref={canvasRef} width={500} height={140} onPointerDown={e => !busy && draw(e, true)} onPointerMove={e => draw(e)} onPointerUp={() => { drawRef.current = false; }} onPointerCancel={() => { drawRef.current = false; }}/><p>簽名會加入所選最後一頁的右下角。這是圖像簽名，不是憑證數位簽章。</p></div>}
      {tool.id === 'forms' && <div className="inline-note"><ClipboardIcon/><span>將在第一頁上方建立一個可填寫的文字欄位。下載後可使用 PDF 閱讀器填寫。</span></div>}
      {tool.id === 'compress' && <div className="inline-note"><CircleHelp size={16}/><span>優化 PDF 內部結構，不會重新壓縮圖片；已最佳化的文件可能不會變小。</span></div>}
      {tool.id === 'compare' && <div className="inline-note"><CircleHelp size={16}/><span>逐頁比較可擷取的文字，匯出文字對照報告；不包含圖像與版面差異。</span></div>}
      {tool.id === 'markdown' && <div className="inline-note"><CircleHelp size={16}/><span>擷取 PDF 文字並以頁面分節，適用於含文字的文件；不保留圖片與表格排版。</span></div>}
      </div>
      {error && <div className="error-message" role="alert"><CircleHelp size={17}/>{error}</div>}
      <button className="primary-button process-button" disabled={busy || files.length === 0} onClick={run}>{busy ? <><Loader2 size={17} className="spin"/>正在處理，請稍候…</> : <><tool.icon size={17}/>{tool.id === 'compare' ? '開始比較' : '開始處理'}<ArrowRight size={16}/></>}</button>
      <div className="modal-security"><ShieldCheck size={13}/>所有處理都在你的瀏覽器中完成，檔案不會上傳。</div>
    </>}
  </section></div>;
}
function ClipboardIcon() { return <FileText size={16}/>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
