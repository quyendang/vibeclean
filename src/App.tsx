import { useMemo, useState } from 'react';
import {
  FolderSearch, Sparkles, ShieldAlert, ShieldCheck, Eye, AlertTriangle,
  Trash2, RefreshCw, Download, Search, X, Bot, Package, Hammer, GitBranch,
  Database, Archive, Film, KeyRound, Code2, Folder, CheckSquare, Square,
  HardDrive, Zap, ChevronRight, TerminalSquare, FileWarning
} from 'lucide-react';
import { LEVELS, CATEGORIES, type ScanResult, type SafetyLevel } from './lib/types';
import { formatBytes, formatCompact, timeAgo } from './lib/format';
import { scanDirectory, deleteItems, supportsFSAccess, type ScanProgress } from './lib/scanner';
import { makeDemoResult } from './lib/demo';
import { Treemap } from './components/Treemap';
import './vibe.css';

const CAT_ICONS: Record<string, any> = {
  package: Package, hammer: Hammer, 'git-branch': GitBranch, bot: Bot, database: Database,
  archive: Archive, film: Film, 'key-round': KeyRound, 'code-2': Code2, folder: Folder,
};

type Phase =
  | { kind: 'landing' }
  | { kind: 'scanning'; progress: ScanProgress }
  | { kind: 'done'; result: ScanResult; demo: boolean };

function LevelBadge({ level }: { level: SafetyLevel }) {
  const L = LEVELS[level];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold tracking-wider whitespace-nowrap"
      style={{ color: L.color, background: L.bg, border: `1px solid ${L.ring}` }}>
      {L.short} · {L.label}
    </span>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'landing' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] = useState<SafetyLevel | 'all'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState<{ done: number; total: number; current: string } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; freed: number; errors: string[] } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const result = phase.kind === 'done' ? phase.result : null;
  const isDemo = phase.kind === 'done' && phase.demo;

  async function startRealScan(startIn?: string) {
    setScanError(null);
    try {
      const dir = await (window as any).showDirectoryPicker({ mode: 'readwrite', ...(startIn ? { startIn } : {}) });
      setPhase({ kind: 'scanning', progress: { scannedDirs: 0, scannedFiles: 0, bytes: 0, currentPath: dir.name } });
      const res = await scanDirectory(dir, (p) => setPhase({ kind: 'scanning', progress: p }));
      finish(res, false);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // user cancelled picker
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setScanError('Thư mục này bị trình duyệt chặn vì chứa dữ liệu hệ thống/nhạy cảm của macOS (vd một số nhánh trong ~/Library). Hãy chọn thư mục con cụ thể thay vì thư mục gốc — ví dụ chọn thẳng "DerivedData" thay vì "Library".');
      } else {
        setScanError(`Không quét được: ${e?.message || 'lỗi không xác định'}`);
      }
    }
  }

  function finish(res: ScanResult, demo: boolean) {
    setPhase({ kind: 'done', result: res, demo });
    // pre-select all SAFE items
    setSelected(new Set(res.items.filter(i => i.level === 'safe').map(i => i.id)));
    setLevelFilter('all'); setCatFilter('all'); setQuery('');
    setDeleteResult(null); setConfirming(false);
  }

  const filtered = useMemo(() => {
    if (!result) return [];
    return result.items.filter(it => {
      if (levelFilter !== 'all' && it.level !== levelFilter) return false;
      if (catFilter !== 'all' && it.category !== catFilter) return false;
      if (query && !it.path.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [result, levelFilter, catFilter, query]);

  const stats = useMemo(() => {
    if (!result) return null;
    const by = (l: SafetyLevel) => result.items.filter(i => i.level === l).reduce((s, i) => s + i.size, 0);
    return {
      safe: by('safe'), review: by('review'), caution: by('caution'), protected: by('protected'),
      reclaimable: by('safe') + by('review'),
    };
  }, [result]);

  const selectedItems = useMemo(() => result?.items.filter(i => selected.has(i.id)) ?? [], [result, selected]);
  const selectedSize = selectedItems.reduce((s, i) => s + i.size, 0);

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectLevel(l: SafetyLevel) {
    setSelected(s => {
      const n = new Set(s);
      filtered.filter(i => i.level === l).forEach(i => n.add(i.id));
      return n;
    });
  }

  async function runDelete() {
    if (!result) return;
    setConfirming(false);
    if (isDemo) {
      setDeleting({ done: 0, total: selectedItems.length, current: '' });
      for (let k = 0; k <= selectedItems.length; k++) {
        await new Promise(r => setTimeout(r, 90));
        setDeleting({ done: k, total: selectedItems.length, current: selectedItems[Math.min(k, selectedItems.length - 1)]?.path ?? '' });
      }
      finishDelete({ deleted: selectedItems.length, freed: selectedSize, errors: [] });
      return;
    }
    setDeleting({ done: 0, total: selectedItems.length, current: '' });
    const r = await deleteItems(selectedItems, (done, total, current) => setDeleting({ done, total, current }));
    finishDelete(r);
  }

  function finishDelete(r: { deleted: number; freed: number; errors: string[] }) {
    setDeleting(null);
    setDeleteResult(r);
    if (!result) return;
    const deletedIds = new Set(selectedItems.map(i => i.id));
    const remaining = result.items.filter(i => !deletedIds.has(i.id));
    const newRes = { ...result, items: remaining, totalSize: result.totalSize - r.freed };
    setSelected(new Set());
    setPhase({ kind: 'done', result: newRes, demo: isDemo });
  }

  function exportReport() {
    if (!result) return;
    const lines = [
      `# VIBECLEAN REPORT — ${result.rootName}`,
      `Quét lúc: ${new Date(result.scannedAt).toLocaleString('vi-VN')}`,
      `Tổng quét: ${formatBytes(result.totalSize)} · ${formatCompact(result.fileCount)} files`,
      ``,
      `## Tổng hợp theo mức độ`,
      ...(['protected', 'caution', 'review', 'safe'] as SafetyLevel[]).map(l => {
        const its = result.items.filter(i => i.level === l);
        return `- ${LEVELS[l].label}: ${its.length} mục — ${formatBytes(its.reduce((s, i) => s + i.size, 0))}`;
      }),
      ``,
      `## Chi tiết (sắp xếp theo dung lượng)`,
      ...result.items.slice(0, 200).map(i =>
        `- [${LEVELS[i.level].label}] **${i.path}** — ${formatBytes(i.size)} (${CATEGORIES[i.category]?.label}) — ${i.reason}${i.reclaimHint ? ` → ${i.reclaimHint}` : ''}`),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibeclean-report-${Date.now()}.md`;
    a.click();
  }

  // ── LANDING ──────────────────────────────────────────────
  if (phase.kind === 'landing') {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TerminalSquare className="w-5 h-5 text-[#00d9a3]" />
            <span className="font-display font-semibold tracking-tight">VIBECLEAN</span>
            <span className="label-caps ml-2 hidden sm:inline">Storage manager for vibe coders</span>
          </div>
          <span className="label-caps">v1.0</span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-4xl mx-auto w-full">
          <div className="fade-up w-full">
            <div className="label-caps mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a3] pulse-dot" />
              500GB mà chục project thì đầy là đúng rồi
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
              Ổ cứng đầy vì <span className="text-[#00d9a3]">node_modules</span>,<br />
              không phải vì code của bạn.
            </h1>
            <p className="text-zinc-400 max-w-xl text-[15px] leading-relaxed mb-8">
              VibeClean quét máy bạn, tự nhận diện rác của vibe coder — <code className="text-zinc-300 text-[13px]">DerivedData</code>, <code className="text-zinc-300 text-[13px]">Pods</code>, <code className="text-zinc-300 text-[13px]">.gradle</code>, cache của <code className="text-zinc-300 text-[13px]">.claude</code>/<code className="text-zinc-300 text-[13px]">.codex</code>, build output, simulator cũ — rồi gắn mác từ <span className="text-[#ff5f56]">KHÔNG ĐƯỢC XÓA</span> đến <span className="text-[#00d9a3]">XÓA AN TOÀN</span> để bạn dọn một phát là giải phóng hàng chục GB.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              {supportsFSAccess() ? (
                <button onClick={() => startRealScan()}
                  className="inline-flex items-center gap-2 bg-[#00d9a3] text-black font-semibold px-5 py-2.5 rounded-md hover:brightness-110 transition text-sm">
                  <FolderSearch className="w-4 h-4" /> Quét thư mục thật trên máy
                </button>
              ) : (
                <div className="text-sm text-zinc-500 border border-zinc-800 rounded-md px-4 py-2.5">
                  Trình duyệt này không hỗ trợ quét file thật — hãy mở bằng <b className="text-zinc-300">Chrome/Edge trên macOS</b>. Bạn vẫn có thể xem demo:
                </div>
              )}
              <button onClick={() => finish(makeDemoResult(), true)}
                className="inline-flex items-center gap-2 border border-zinc-700 text-zinc-200 px-5 py-2.5 rounded-md hover:border-[#00d9a3]/60 hover:text-[#00d9a3] transition text-sm">
                <Sparkles className="w-4 h-4" /> Xem demo (MacBook 500GB của vibe coder)
              </button>
            </div>

            {/* Scan error banner */}
            {scanError && (
              <div className="mb-8 border border-[#ffbd2e]/40 bg-[#ffbd2e]/[0.06] rounded-md p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-[#ffbd2e] shrink-0 mt-0.5" />
                <div className="text-[13px] text-zinc-300 leading-relaxed">
                  {scanError}
                  <div className="mt-2 font-mono text-[11px] text-zinc-500">
                    Với DerivedData & Simulator, nhanh nhất vẫn là Terminal:<br />
                    <code className="text-[#00d9a3]">rm -rf ~/Library/Developer/Xcode/DerivedData</code><br />
                    <code className="text-[#00d9a3]">xcrun simctl delete unavailable</code>
                  </div>
                </div>
                <button onClick={() => setScanError(null)} className="ml-auto text-zinc-600 hover:text-zinc-300 shrink-0"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Quick-pick suggested folders */}
            {supportsFSAccess() && (
              <div className="mb-10">
                <div className="label-caps mb-3">Quét nhanh — chỗ hay ngốn GB nhất của vibe coder</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'Projects', path: '~/projects', hint: 'node_modules, .git, build của chục project', startIn: undefined, icon: Code2, hot: true },
                    { label: 'Xcode Data', path: '~/Library/Developer/Xcode', hint: 'DerivedData + Archives — thường 30-60GB', startIn: undefined, icon: Hammer, hot: true },
                    { label: 'iOS Simulators', path: '~/Library/Developer/CoreSimulator', hint: 'Mỗi simulator vài GB, xóa cái không dùng', startIn: undefined, icon: HardDrive, hot: true },
                    { label: 'Downloads', path: '~/Downloads', hint: '.dmg, .zip, APK cài xong quên xóa', startIn: 'downloads', icon: Archive, hot: false },
                    { label: 'Claude Code', path: '~/.claude', hint: 'Sessions, todos, shell snapshots', startIn: undefined, icon: Bot, hot: false },
                    { label: 'Codex CLI', path: '~/.codex', hint: 'Sessions & logs của Codex', startIn: undefined, icon: Bot, hot: false },
                    { label: 'App Caches', path: '~/Library/Caches', hint: 'Cache mọi app — tự tạo lại', startIn: undefined, icon: Database, hot: false },
                    { label: 'Desktop', path: '~/Desktop', hint: 'Nghĩa địa file tạm của mọi dev', startIn: 'desktop', icon: Folder, hot: false },
                    { label: 'Toàn bộ Home', path: '~', hint: 'Quét full — lâu nhưng kỹ nhất', startIn: undefined, icon: FolderSearch, hot: false },
                  ].map(sug => (
                    <button key={sug.label} onClick={() => startRealScan(sug.startIn)}
                      className={`text-left border rounded-md p-3 transition group ${sug.hot ? 'border-[#00d9a3]/30 bg-[#00d9a3]/[0.04] hover:border-[#00d9a3]/60' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <sug.icon className={`w-3.5 h-3.5 ${sug.hot ? 'text-[#00d9a3]' : 'text-zinc-500'}`} />
                        <span className="text-[12px] font-medium text-zinc-200">{sug.label}</span>
                        {sug.hot && <span className="label-caps text-[#00d9a3] ml-auto">hot</span>}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500 truncate mb-0.5">{sug.path}</div>
                      <div className="text-[10px] text-zinc-600 leading-snug">{sug.hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-zinc-700" />
                  Tip: trong hộp chọn thư mục của macOS, bấm
                  <kbd className="px-1.5 py-0.5 border border-zinc-700 rounded text-[10px] text-zinc-400">⌘ ⇧ G</kbd>
                  rồi dán đường dẫn (vd <span className="text-zinc-400">~/Library/Developer/Xcode</span>) để nhảy thẳng tới.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 border border-zinc-800 divide-x divide-zinc-800 rounded-md overflow-hidden">
              {(['protected', 'caution', 'review', 'safe'] as SafetyLevel[]).map((l, i) => {
                const L = LEVELS[l];
                const Icon = [ShieldAlert, AlertTriangle, Eye, ShieldCheck][i];
                return (
                  <div key={l} className="p-4 bg-zinc-900/40">
                    <Icon className="w-4 h-4 mb-2" style={{ color: L.color }} />
                    <div className="font-mono text-[11px] font-semibold tracking-wider mb-1" style={{ color: L.color }}>{L.label}</div>
                    <div className="text-[11px] text-zinc-500 leading-snug">{L.desc}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-[#00d9a3]" />100% local — file không rời khỏi máy</span>
              <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-[#00d9a3]" />Nhận diện 40+ pattern rác dev</span>
              <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-[#00d9a3]" />Xóa trực tiếp + xuất report</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── SCANNING ─────────────────────────────────────────────
  if (phase.kind === 'scanning') {
    const p = phase.progress;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-lg fade-up">
          <div className="label-caps mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a3] pulse-dot" /> Đang quét…
          </div>
          <div className="border border-zinc-800 rounded-md bg-zinc-900/40 p-5 font-mono text-[13px]">
            <div className="truncate text-zinc-300 mb-4">$ vibeclean scan ~/{p.currentPath}</div>
            <div className="space-y-1.5 text-zinc-500 text-[12px]">
              <div>Thư mục: <span className="text-zinc-200">{formatCompact(p.scannedDirs)}</span></div>
              <div>Files: <span className="text-zinc-200">{formatCompact(p.scannedFiles)}</span></div>
              <div>Đã đọc: <span className="text-[#00d9a3]">{formatBytes(p.bytes)}</span></div>
            </div>
            <div className="mt-4 h-0.5 bg-zinc-800 overflow-hidden rounded">
              <div className="h-full w-1/4 bg-[#00d9a3] scanline" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────
  const r = result!;
  const s = stats!;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-20 bg-[#0a0b0d]/90 backdrop-blur border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <TerminalSquare className="w-5 h-5 text-[#00d9a3] shrink-0" />
          <span className="font-display font-semibold tracking-tight shrink-0">VIBECLEAN</span>
          <span className="font-mono text-[12px] text-zinc-500 truncate hidden sm:inline">/ {r.rootName}</span>
          {isDemo && <span className="label-caps text-[#ffbd2e] shrink-0">· DEMO DATA</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-600 rounded px-2.5 py-1.5 transition">
            <Download className="w-3.5 h-3.5" /> Report
          </button>
          <button onClick={() => setPhase({ kind: 'landing' })} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-600 rounded px-2.5 py-1.5 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Quét lại
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 border border-zinc-800 rounded-md overflow-hidden divide-x divide-zinc-800 fade-up">
          <div className="p-4 bg-zinc-900/40 col-span-2 lg:col-span-1">
            <div className="label-caps mb-1.5 flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> Đã quét</div>
            <div className="font-mono text-2xl font-semibold">{formatBytes(r.totalSize)}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{formatCompact(r.fileCount)} files · {(r.durationMs / 1000).toFixed(1)}s</div>
          </div>
          <div className="p-4 bg-zinc-900/40">
            <div className="label-caps mb-1.5 flex items-center gap-1.5"><Zap className="w-3 h-3 text-[#00d9a3]" /> Có thể giải phóng</div>
            <div className="font-mono text-2xl font-semibold text-[#00d9a3]">{formatBytes(s.reclaimable)}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">safe + review</div>
          </div>
          <div className="p-4 bg-zinc-900/40">
            <div className="label-caps mb-1.5">Xóa an toàn ngay</div>
            <div className="font-mono text-2xl font-semibold" style={{ color: LEVELS.safe.color }}>{formatBytes(s.safe)}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{r.items.filter(i => i.level === 'safe').length} mục</div>
          </div>
          <div className="p-4 bg-zinc-900/40">
            <div className="label-caps mb-1.5">Tuyệt đối giữ</div>
            <div className="font-mono text-2xl font-semibold" style={{ color: LEVELS.protected.color }}>{formatBytes(s.protected)}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">secrets, keys, .env</div>
          </div>
        </section>

        {/* Treemap */}
        <section className="fade-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display font-semibold">Bản đồ dung lượng</h2>
            <span className="label-caps">hover để xem · click để lọc</span>
          </div>
          <div className="border border-zinc-800 rounded-md bg-zinc-900/40 p-3">
            <Treemap nodes={r.topLevel} onSelect={(n) => setQuery(n.name === 'khác' ? '' : n.name)} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 px-1">
              {Object.entries(CATEGORIES).filter(([id]) => r.topLevel.some(t => t.category === id)).map(([id, c]) => (
                <span key={id} className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                  <span className="w-2 h-2 rounded-[2px]" style={{ background: { deps: '#00d9a3', build: '#2dd4bf', cache: '#38bdf8', ai: '#c8a2ff', vcs: '#ffbd2e', installer: '#fb923c', media: '#f472b6', secret: '#ff5f56', source: '#e4e4e7', other: '#52525b' }[id] }} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display font-semibold">Các mục phát hiện <span className="font-mono text-sm text-zinc-500 font-normal">({filtered.length})</span></h2>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button onClick={() => setLevelFilter('all')}
              className={`px-3 py-1.5 rounded text-[11px] font-mono tracking-wider border transition ${levelFilter === 'all' ? 'border-zinc-500 text-zinc-100 bg-zinc-800' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
              TẤT CẢ
            </button>
            {(['safe', 'review', 'caution', 'protected'] as SafetyLevel[]).map(l => {
              const L = LEVELS[l];
              const active = levelFilter === l;
              return (
                <button key={l} onClick={() => setLevelFilter(active ? 'all' : l)}
                  className="px-3 py-1.5 rounded text-[11px] font-mono tracking-wider border transition"
                  style={active ? { borderColor: L.color, color: L.color, background: L.bg } : { borderColor: '#27272a', color: '#71717a' }}>
                  {L.label}
                </button>
              );
            })}
            <div className="w-px h-5 bg-zinc-800 mx-1 hidden sm:block" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded text-[12px] text-zinc-300 px-2 py-1.5 outline-none">
              <option value="all">Mọi loại</option>
              {Object.values(CATEGORIES).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Lọc theo đường dẫn…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-7 py-1.5 text-[12px] font-mono text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600" />
              {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          {/* Quick select */}
          <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-mono">
            <span className="text-zinc-600 py-1">Chọn nhanh:</span>
            <button onClick={() => selectLevel('safe')} className="px-2 py-1 rounded border border-zinc-800 text-[#00d9a3] hover:bg-[#00d9a3]/10 transition">+ tất cả XÓA AN TOÀN</button>
            <button onClick={() => selectLevel('review')} className="px-2 py-1 rounded border border-zinc-800 text-[#c8a2ff] hover:bg-[#c8a2ff]/10 transition">+ tất cả NÊN XEM LẠI</button>
            <button onClick={() => setSelected(new Set())} className="px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition">Bỏ chọn hết</button>
          </div>

          <div className="border border-zinc-800 rounded-md overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto divide-y divide-zinc-800/60">
              {filtered.map(it => {
                const isProtected = it.level === 'protected';
                const checked = selected.has(it.id);
                const Icon = CAT_ICONS[CATEGORIES[it.category]?.icon] || Folder;
                return (
                  <div key={it.id}
                    className={`flex items-center gap-3 px-4 py-3 group transition ${isProtected ? 'opacity-70' : 'hover:bg-zinc-900/60 cursor-pointer'} ${checked ? 'bg-[#00d9a3]/[0.04]' : ''}`}
                    onClick={() => !isProtected && toggle(it.id)}>
                    <button className="shrink-0 text-zinc-600" disabled={isProtected}>
                      {isProtected ? <ShieldAlert className="w-4 h-4 text-[#ff5f56]" /> : checked ? <CheckSquare className="w-4 h-4 text-[#00d9a3]" /> : <Square className="w-4 h-4 group-hover:text-zinc-400" />}
                    </button>
                    <Icon className="w-4 h-4 shrink-0 text-zinc-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] text-zinc-200 truncate">{it.path}</span>
                        <LevelBadge level={it.level} />
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                        {it.reason}
                        {it.reclaimHint && <span className="text-zinc-600"> · Cài lại: <code className="text-zinc-500">{it.reclaimHint}</code></span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[13px] font-medium text-zinc-200">{formatBytes(it.size)}</div>
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {it.fileCount > 1 ? `${formatCompact(it.fileCount)} files` : ''}{it.lastModified ? ` · ${timeAgo(it.lastModified)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-10 text-center text-zinc-600 text-sm font-mono">Không có mục nào khớp bộ lọc.</div>
              )}
            </div>
          </div>
          {r.truncated && <p className="text-[11px] text-zinc-600 mt-2 font-mono">⚠ Kết quả bị giới hạn ở 4000 mục lớn nhất.</p>}
          {(r.skipped?.length ?? 0) > 0 && (
            <div className="mt-2 border border-zinc-800 rounded-md bg-zinc-900/40 p-3">
              <button onClick={() => setShowSkipped(s => !s)} className="flex items-center gap-2 text-[11px] font-mono text-[#ffbd2e]">
                <AlertTriangle className="w-3.5 h-3.5" />
                Đã bỏ qua {r.skipped!.length} mục bị macOS/trình duyệt chặn (file hệ thống)
                <ChevronRight className={`w-3 h-3 transition-transform ${showSkipped ? 'rotate-90' : ''}`} />
              </button>
              {showSkipped && (
                <div className="mt-2 max-h-32 overflow-y-auto font-mono text-[10px] text-zinc-600 space-y-0.5">
                  {r.skipped!.slice(0, 100).map((s, idx) => <div key={idx} className="truncate">⤷ {s}</div>)}
                  {r.skipped!.length > 100 && <div>… và {r.skipped!.length - 100} mục khác</div>}
                  <div className="text-zinc-500 pt-1">Các mục này không tính vào tổng dung lượng. Với Library/Xcode, dùng Terminal sẽ đầy đủ hơn.</div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-zinc-800 bg-[#0a0b0d]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="font-mono text-[13px] text-zinc-400">
            <span className="text-zinc-200 font-semibold">{selected.size}</span> mục · giải phóng <span className="text-[#00d9a3] font-semibold">{formatBytes(selectedSize)}</span>
          </div>
          <button onClick={() => setConfirming(true)} disabled={selected.size === 0}
            className="inline-flex items-center gap-2 bg-[#00d9a3] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-semibold px-5 py-2.5 rounded-md hover:brightness-110 transition text-sm">
            <Trash2 className="w-4 h-4" /> Dọn dẹp {selected.size > 0 ? `(${formatBytes(selectedSize)})` : ''}
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setConfirming(false)}>
          <div className="border border-zinc-700 bg-[#0f1113] rounded-md max-w-md w-full p-6 fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <FileWarning className="w-5 h-5 text-[#ffbd2e]" />
              <h3 className="font-display font-semibold">Xác nhận dọn dẹp</h3>
            </div>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              Bạn sắp xóa vĩnh viễn <b className="text-zinc-200">{selected.size} mục</b> ({formatBytes(selectedSize)}).
              Tất cả đều ở mức <LevelBadge level="safe" /> hoặc <LevelBadge level="review" /> — tái tạo được bằng package manager/build.
              Mục <b className="text-[#ff5f56]">KHÔNG ĐƯỢC XÓA</b> không bao giờ được chọn.
            </p>
            <div className="max-h-32 overflow-y-auto border border-zinc-800 rounded p-2 mb-4 font-mono text-[11px] text-zinc-500 space-y-0.5">
              {selectedItems.slice(0, 50).map(i => <div key={i.id} className="truncate">rm -rf {i.path}</div>)}
              {selectedItems.length > 50 && <div>… và {selectedItems.length - 50} mục khác</div>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirming(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-md transition">Hủy</button>
              <button onClick={runDelete} className="px-4 py-2 text-sm bg-[#ff5f56] text-black font-semibold rounded-md hover:brightness-110 transition inline-flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting overlay */}
      {deleting && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="border border-zinc-700 bg-[#0f1113] rounded-md max-w-md w-full p-6">
            <div className="label-caps mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ff5f56] pulse-dot" /> Đang xóa…</div>
            <div className="font-mono text-[12px] text-zinc-400 truncate mb-3">{deleting.current}</div>
            <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
              <div className="h-full bg-[#00d9a3] transition-all" style={{ width: `${(deleting.done / Math.max(deleting.total, 1)) * 100}%` }} />
            </div>
            <div className="font-mono text-[11px] text-zinc-500 mt-2">{deleting.done}/{deleting.total}</div>
          </div>
        </div>
      )}

      {/* Delete result */}
      {deleteResult && !deleting && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setDeleteResult(null)}>
          <div className="border border-[#00d9a3]/40 bg-[#0f1113] rounded-md max-w-md w-full p-6 fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-[#00d9a3]" />
              <h3 className="font-display font-semibold">Dọn dẹp hoàn tất</h3>
            </div>
            <div className="font-mono text-3xl font-semibold text-[#00d9a3] mb-1">+{formatBytes(deleteResult.freed)}</div>
            <p className="text-[13px] text-zinc-400 mb-4">Đã xóa {deleteResult.deleted} mục. Ổ cứng thở được rồi.</p>
            {deleteResult.errors.length > 0 && (
              <div className="border border-[#ff5f56]/30 rounded p-2 mb-4 max-h-28 overflow-y-auto font-mono text-[11px] text-[#ff5f56] space-y-0.5">
                {deleteResult.errors.map((e, idx) => <div key={idx} className="truncate">{e}</div>)}
              </div>
            )}
            <button onClick={() => setDeleteResult(null)} className="w-full px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
