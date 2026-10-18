import type { SafetyLevel } from './types';

export interface Rule {
  pattern: RegExp;
  match: 'name' | 'path';
  level: SafetyLevel;
  category: string;
  reason: string;
  reclaimHint?: string;
  /** if true, stop descending — treat whole subtree as one item */
  terminal: boolean;
  isDir?: boolean; // undefined = both
  minSize?: number;
}

// Ordered: first match wins. More specific rules first.
export const RULES: Rule[] = [
  // ── P0 KHÔNG ĐƯỢC XÓA ──────────────────────────────
  { pattern: /^\.(env|env\..+|npmrc|netrc|git-credentials)$/, match: 'name', level: 'protected', category: 'secret', terminal: false, isDir: false,
    reason: 'File môi trường / credentials — chứa API key, token.' },
  { pattern: /\.(pem|key|p12|mobileprovision|keystore|jks|ppk|crt)$/, match: 'name', level: 'protected', category: 'secret', terminal: false, isDir: false,
    reason: 'Private key / chứng chỉ ký ứng dụng. Mất là không build/release được.' },
  { pattern: /^(GoogleService-Info\.plist|google-services\.json|firebase\.json|\.firebaserc)$/, match: 'name', level: 'protected', category: 'secret', terminal: false, isDir: false,
    reason: 'Config Firebase — cần thiết để app chạy.' },
  { pattern: /^\.(ssh|gnupg|aws)$/, match: 'name', level: 'protected', category: 'secret', terminal: true, isDir: true,
    reason: 'SSH key / GPG / AWS credentials của cả hệ thống.' },

  // ── P3 Dependencies — tái tạo bằng package manager ──
  { pattern: /^node_modules$/, match: 'name', level: 'safe', category: 'deps', terminal: true, isDir: true,
    reason: 'Thư mục dependency nặng nhất của mọi project JS.', reclaimHint: 'npm install / pnpm install' },
  { pattern: /^Pods$/, match: 'name', level: 'safe', category: 'deps', terminal: true, isDir: true,
    reason: 'CocoaPods dependencies của project iOS.', reclaimHint: 'pod install --repo-update' },
  { pattern: /^\.pub-cache$/, match: 'name', level: 'safe', category: 'deps', terminal: true, isDir: true,
    reason: 'Pub cache của Flutter/Dart.', reclaimHint: 'flutter pub get' },
  { pattern: /^(vendor)$/, match: 'name', level: 'review', category: 'deps', terminal: true, isDir: true,
    reason: 'Vendor dependencies (PHP/Go/Ruby). Thường cài lại được.', reclaimHint: 'composer install / go mod vendor' },
  { pattern: /^(\.venv|venv|env)$/, match: 'name', level: 'safe', category: 'deps', terminal: true, isDir: true,
    reason: 'Python virtualenv — tái tạo dễ dàng.', reclaimHint: 'python -m venv .venv && pip install -r requirements.txt' },
  { pattern: /^\.dart_tool$/, match: 'name', level: 'safe', category: 'deps', terminal: true, isDir: true,
    reason: 'Dart tool cache.', reclaimHint: 'flutter pub get' },

  // ── P3 Build output ────────────────────────────────
  { pattern: /^(dist|build|out|\.next|\.nuxt|\.output|\.svelte-kit|\.vercel|\.turbo|\.parcel-cache|coverage|\.expo|\.expo-shared)$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Build output — tái tạo bằng 1 lệnh build.', reclaimHint: 'npm run build' },
  { pattern: /^DerivedData$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Xcode DerivedData — khắc tinh của ổ cứng iOS dev, thường vài chục GB.', reclaimHint: 'Xcode tự build lại' },
  { pattern: /^(xcuserdata|\.swiftpm)$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Xcode user data / SwiftPM cache.', reclaimHint: 'Tự tạo lại khi mở Xcode' },
  { pattern: /^target$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Rust/CMake build output.', reclaimHint: 'cargo build' },
  { pattern: /^\.gradle$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Gradle cache/build — Android dev hay tốn 5-15GB.', reclaimHint: './gradlew build' },
  { pattern: /^(android\/build|app\/build|ios\/build)$/, match: 'path', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Android/iOS native build output.', reclaimHint: 'Build lại từ IDE' },
  { pattern: /^__pycache__$/, match: 'name', level: 'safe', category: 'build', terminal: true, isDir: true,
    reason: 'Python bytecode cache.', reclaimHint: 'Tự tạo lại khi chạy' },
  { pattern: /\.(apk|aab|ipa)$/, match: 'name', level: 'review', category: 'installer', terminal: false, isDir: false, minSize: 20 * 1024 * 1024,
    reason: 'Build artifact app mobile. Nếu đã upload store thì xóa được.', reclaimHint: 'Build lại từ CI/IDE' },

  // ── P1 Git ─────────────────────────────────────────
  { pattern: /^\.git$/, match: 'name', level: 'caution', category: 'vcs', terminal: true, isDir: true,
    reason: 'Toàn bộ lịch sử git. Nếu repo đã push remote thì xóa vẫn clone lại được.', reclaimHint: 'git clone lại từ remote' },
  { pattern: /^\.(svn|hg)$/, match: 'name', level: 'caution', category: 'vcs', terminal: true, isDir: true,
    reason: 'VCS metadata.' },

  // ── AI Coding Tools (Claude Code, Codex, Cursor…) ──
  { pattern: /^\.claude$/, match: 'name', level: 'review', category: 'ai', terminal: true, isDir: true,
    reason: 'Claude Code: projects history, todos, session data, shell snapshots.', reclaimHint: 'Xóa session cũ, giữ settings' },
  { pattern: /^\.codex$/, match: 'name', level: 'review', category: 'ai', terminal: true, isDir: true,
    reason: 'OpenAI Codex CLI: sessions, logs, history.', reclaimHint: 'Xóa sessions/ cũ' },
  { pattern: /^\.cursor$/, match: 'name', level: 'review', category: 'ai', terminal: true, isDir: true,
    reason: 'Cursor AI data / cache.' },
  { pattern: /^\.continue$/, match: 'name', level: 'safe', category: 'ai', terminal: true, isDir: true,
    reason: 'Continue.dev sessions & index cache.', reclaimHint: 'Tự index lại' },
  { pattern: /^(sessions|todos|history|logs|shell-snapshots)$/i, match: 'name', level: 'safe', category: 'ai', terminal: true, isDir: true,
    reason: 'Session/log của AI coding tool — không ảnh hưởng code.', },
  { pattern: /Copilot/i, match: 'path', level: 'review', category: 'ai', terminal: true, isDir: true,
    reason: 'GitHub Copilot cache/data.' },

  // ── P3 Cache hệ thống ──────────────────────────────
  { pattern: /^Caches$/, match: 'name', level: 'safe', category: 'cache', terminal: true, isDir: true,
    reason: 'macOS app caches. App tự tạo lại.', reclaimHint: 'Khởi động lại app' },
  { pattern: /^\.cache$/, match: 'name', level: 'safe', category: 'cache', terminal: true, isDir: true,
    reason: 'Cache chung (Linux/macOS tools).', reclaimHint: 'Tự tạo lại' },
  { pattern: /^(\.npm|\.pnpm-store|\.yarn|\.bun)$/, match: 'name', level: 'safe', category: 'cache', terminal: true, isDir: true,
    reason: 'Global package manager cache.', reclaimHint: 'npm cache clean / tự tải lại' },
  { pattern: /^(\.cocoapods|\.m2|\.maven)$/, match: 'name', level: 'safe', category: 'cache', terminal: true, isDir: true,
    reason: 'CocoaPods/Maven cache.', reclaimHint: 'pod install / mvn install' },
  { pattern: /^CoreSimulator$/, match: 'name', level: 'review', category: 'cache', terminal: true, isDir: true,
    reason: 'iOS Simulators — mỗi cái vài GB. Xóa simulator cũ không dùng.', reclaimHint: 'xcrun simctl delete unavailable' },
  { pattern: /^Archives$/, match: 'name', level: 'caution', category: 'installer', terminal: true, isDir: true,
    reason: 'Xcode Archives — bản build đã đóng gói. Có thể là build đã release.', reclaimHint: 'Giữ bản mới nhất' },

  // ── P2 Review: file lẻ ─────────────────────────────
  { pattern: /\.(dmg|pkg|iso)$/, match: 'name', level: 'review', category: 'installer', terminal: false, isDir: false, minSize: 50 * 1024 * 1024,
    reason: 'Installer macOS — cài xong thường không cần nữa.' },
  { pattern: /\.(zip|tar|tar\.gz|tgz|rar|7z)$/, match: 'name', level: 'review', category: 'installer', terminal: false, isDir: false, minSize: 50 * 1024 * 1024,
    reason: 'File nén lớn — nếu đã giải nén thì dư thừa.' },
  { pattern: /\.(mp4|mov|mkv|avi)$/, match: 'name', level: 'review', category: 'media', terminal: false, isDir: false, minSize: 100 * 1024 * 1024,
    reason: 'Video lớn (screen recording demo app?).' },
  { pattern: /^\.DS_Store$/, match: 'name', level: 'safe', category: 'cache', terminal: false, isDir: false,
    reason: 'Metadata rác của Finder.' },
  { pattern: /\.log$/, match: 'name', level: 'safe', category: 'cache', terminal: false, isDir: false, minSize: 10 * 1024 * 1024,
    reason: 'Log file lớn.' },
  { pattern: /^Trash$/, match: 'name', level: 'safe', category: 'cache', terminal: true, isDir: true,
    reason: 'Thùng rác — dọn là giải phóng ngay.' },
];

export function matchRule(name: string, path: string, isDir: boolean, size: number): Rule | null {
  for (const r of RULES) {
    if (r.isDir !== undefined && r.isDir !== isDir) continue;
    if (r.minSize !== undefined && size < r.minSize) continue;
    const target = r.match === 'name' ? name : path;
    if (r.pattern.test(target)) return r;
  }
  return null;
}
