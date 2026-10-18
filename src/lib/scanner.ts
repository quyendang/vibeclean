import { matchRule } from './rules';
import type { ScanItem, ScanResult } from './types';

const MAX_ITEMS = 4000;
const LARGE_FILE = 100 * 1024 * 1024; // 100MB orphan files get listed for review

export interface ScanProgress {
  scannedDirs: number;
  scannedFiles: number;
  bytes: number;
  currentPath: string;
}

export function supportsFSAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function subtreeStats(
  dir: FileSystemDirectoryHandle,
  acc: { size: number; files: number }
): Promise<void> {
  for await (const entry of (dir as any).values()) {
    if (entry.kind === 'file') {
      try {
        const f = await entry.getFile();
        acc.size += f.size;
        acc.files++;
      } catch { /* skip */ }
    } else {
      await subtreeStats(entry, acc);
    }
  }
}

export async function scanDirectory(
  root: FileSystemDirectoryHandle,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanResult> {
  const started = performance.now();
  const items: ScanItem[] = [];
  const topLevel: ScanResult['topLevel'] = [];
  let fileCount = 0, dirCount = 0, totalSize = 0, id = 0;
  let truncated = false;

  const progress: ScanProgress = { scannedDirs: 0, scannedFiles: 0, bytes: 0, currentPath: root.name };
  const tick = () => onProgress?.({ ...progress });

  async function walk(dir: FileSystemDirectoryHandle, path: string, depth: number): Promise<{ size: number; files: number }> {
    if (truncated) return { size: 0, files: 0 };
    let size = 0, files = 0;
    progress.scannedDirs++;
    progress.currentPath = path || dir.name;
    if (progress.scannedDirs % 10 === 0) tick();

    let entries: FileSystemHandle[] = [];
    try {
      entries = [];
      for await (const e of (dir as any).values()) entries.push(e);
    } catch { return { size: 0, files: 0 }; }

    for (const entry of entries) {
      if (truncated) break;
      const entryPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        let fsize = 0, lastModified = 0;
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          fsize = f.size; lastModified = f.lastModified;
        } catch { continue; }
        size += fsize; files++;
        fileCount++; totalSize += fsize;
        progress.scannedFiles++; progress.bytes += fsize;

        const rule = matchRule(entry.name, entryPath, false, fsize);
        if (rule && items.length < MAX_ITEMS) {
          items.push({
            id: `i${id++}`, name: entry.name, path: entryPath, size: fsize, isDir: false,
            level: rule.level, category: rule.category, reason: rule.reason,
            reclaimHint: rule.reclaimHint, fileCount: 1, lastModified,
            parentHandle: dir,
          });
        } else if (!rule && fsize >= LARGE_FILE && depth > 0 && items.length < MAX_ITEMS) {
          items.push({
            id: `i${id++}`, name: entry.name, path: entryPath, size: fsize, isDir: false,
            level: 'review', category: 'media', reason: 'File lẻ rất lớn — nên xem lại.',
            fileCount: 1, lastModified, parentHandle: dir,
          });
        }
      } else {
        dirCount++;
        const dh = entry as FileSystemDirectoryHandle;
        const rule = matchRule(entry.name, entryPath, true, 0);
        if (rule && rule.terminal) {
          const acc = { size: 0, files: 0 };
          try { await subtreeStats(dh, acc); } catch { /* skip */ }
          size += acc.size; files += acc.files;
          fileCount += acc.files; totalSize += acc.size;
          progress.scannedFiles += acc.files; progress.bytes += acc.size;
          if (items.length < MAX_ITEMS) {
            items.push({
              id: `i${id++}`, name: entry.name, path: entryPath, size: acc.size, isDir: true,
              level: rule.level, category: rule.category, reason: rule.reason,
              reclaimHint: rule.reclaimHint, fileCount: acc.files,
              parentHandle: dir,
            });
          }
        } else {
          const sub = await walk(dh, entryPath, depth + 1);
          size += sub.size; files += sub.files;
        }
      }
    }
    if (items.length >= MAX_ITEMS) truncated = true;
    return { size, files };
  }

  // Top-level breakdown for treemap
  try {
    for await (const e of (root as any).values()) {
      if (e.kind === 'file') {
        try {
          const f = await (e as FileSystemFileHandle).getFile();
          topLevel.push({ name: e.name, path: e.name, size: f.size, isDir: false, category: 'other' });
        } catch { /* skip */ }
      } else {
        const rule = matchRule(e.name, e.name, true, 0);
        if (rule?.terminal) {
          const acc = { size: 0, files: 0 };
          try { await subtreeStats(e as FileSystemDirectoryHandle, acc); } catch { /* skip */ }
          topLevel.push({ name: e.name, path: e.name, size: acc.size, isDir: true, category: rule.category });
          fileCount += acc.files; totalSize += acc.size;
          if (items.length < MAX_ITEMS) {
            items.push({
              id: `i${id++}`, name: e.name, path: e.name, size: acc.size, isDir: true,
              level: rule.level, category: rule.category, reason: rule.reason,
              reclaimHint: rule.reclaimHint, fileCount: acc.files, parentHandle: root,
            });
          }
        } else {
          const sub = await walk(e as FileSystemDirectoryHandle, e.name, 1);
          topLevel.push({ name: e.name, path: e.name, size: sub.size, isDir: true, category: 'other' });
        }
      }
    }
  } catch { /* permission */ }

  topLevel.sort((a, b) => b.size - a.size);
  items.sort((a, b) => b.size - a.size);

  return {
    rootName: root.name,
    scannedAt: Date.now(),
    totalSize, fileCount, dirCount,
    items, topLevel,
    durationMs: performance.now() - started,
    truncated,
  };
}

export async function deleteItems(
  items: ScanItem[],
  onProgress?: (done: number, total: number, current: string) => void
): Promise<{ deleted: number; freed: number; errors: string[] }> {
  let deleted = 0, freed = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    onProgress?.(i, items.length, it.path);
    try {
      if (!it.parentHandle) throw new Error('no handle');
      await it.parentHandle.removeEntry(it.name, { recursive: true });
      deleted++; freed += it.size;
    } catch (e: any) {
      errors.push(`${it.path}: ${e?.message || 'lỗi không xác định'}`);
    }
  }
  onProgress?.(items.length, items.length, '');
  return { deleted, freed, errors };
}
