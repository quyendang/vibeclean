export type SafetyLevel = 'protected' | 'caution' | 'review' | 'safe';

export interface CategoryInfo {
  id: string;
  label: string;
  icon: string;
}

export interface ScanItem {
  id: string;
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  level: SafetyLevel;
  category: string;
  reason: string;
  reclaimHint?: string;
  fileCount: number;
  lastModified?: number;
  // runtime handles for real deletion
  parentHandle?: FileSystemDirectoryHandle;
}

export interface ScanResult {
  rootName: string;
  scannedAt: number;
  totalSize: number;
  fileCount: number;
  dirCount: number;
  items: ScanItem[];
  topLevel: { name: string; path: string; size: number; isDir: boolean; category: string }[];
  durationMs: number;
  truncated: boolean;
  skipped?: string[];
}

export const LEVELS: Record<SafetyLevel, { order: number; label: string; short: string; color: string; bg: string; ring: string; desc: string }> = {
  protected: {
    order: 0, label: 'KHÔNG ĐƯỢC XÓA', short: 'P0', color: '#ff5f56', bg: 'rgba(255,95,86,0.10)', ring: 'rgba(255,95,86,0.35)',
    desc: 'Source code, secrets, chứng chỉ. Xóa là mất vĩnh viễn.',
  },
  caution: {
    order: 1, label: 'CẨN THẬN', short: 'P1', color: '#ffbd2e', bg: 'rgba(255,189,46,0.10)', ring: 'rgba(255,189,46,0.35)',
    desc: 'Có thể chứa dữ liệu duy nhất (.git history, archive). Kiểm tra trước khi xóa.',
  },
  review: {
    order: 2, label: 'NÊN XEM LẠI', short: 'P2', color: '#c8a2ff', bg: 'rgba(200,162,255,0.10)', ring: 'rgba(200,162,255,0.35)',
    desc: 'Installer, file nén, media lớn. Thường xóa được nhưng nên liếc qua.',
  },
  safe: {
    order: 3, label: 'XÓA AN TOÀN', short: 'P3', color: '#00d9a3', bg: 'rgba(0,217,163,0.10)', ring: 'rgba(0,217,163,0.35)',
    desc: 'Tái tạo được 100%: node_modules, build output, cache, log. Xóa không suy nghĩ.',
  },
};

export const CATEGORIES: Record<string, CategoryInfo> = {
  deps:      { id: 'deps',      label: 'Dependencies',        icon: 'package' },
  build:     { id: 'build',     label: 'Build output',        icon: 'hammer' },
  vcs:       { id: 'vcs',       label: 'Git / VCS',           icon: 'git-branch' },
  ai:        { id: 'ai',        label: 'AI Coding Tools',     icon: 'bot' },
  cache:     { id: 'cache',     label: 'Cache hệ thống',      icon: 'database' },
  installer: { id: 'installer', label: 'Installer / Archive', icon: 'archive' },
  media:     { id: 'media',     label: 'Media lớn',           icon: 'film' },
  secret:    { id: 'secret',    label: 'Secrets / Config',    icon: 'key-round' },
  source:    { id: 'source',    label: 'Source code',         icon: 'code-2' },
  other:     { id: 'other',     label: 'Khác',                icon: 'folder' },
};
