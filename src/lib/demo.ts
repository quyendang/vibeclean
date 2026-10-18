import type { ScanItem, ScanResult } from './types';

// Deterministic pseudo-random for stable demo data
let seed = 42;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const GB = 1024 ** 3, MB = 1024 ** 2;
const ago = (days: number) => Date.now() - days * 86400_000;

function item(partial: Omit<ScanItem, 'id'>, i: number): ScanItem {
  return { id: `d${i}`, ...partial };
}

export function makeDemoResult(): ScanResult {
  seed = 42;
  const items: ScanItem[] = [];
  let i = 0;
  const projects = [
    { n: 'ecommerce-app', nm: 1.84 * GB, git: 412 * MB, next: 2.1 * GB, age: 3 },
    { n: 'food-delivery-rn', nm: 2.3 * GB, git: 890 * MB, pods: 1.6 * GB, gradle: 1.2 * GB, age: 12 },
    { n: 'crypto-tracker', nm: 1.1 * GB, git: 145 * MB, dist: 340 * MB, age: 45 },
    { n: 'admin-dashboard', nm: 1.6 * GB, git: 220 * MB, dist: 512 * MB, age: 7 },
    { n: 'chat-app-flutter', nm: 980 * MB, git: 310 * MB, dart: 760 * MB, age: 60 },
    { n: 'landing-client-a', nm: 640 * MB, git: 88 * MB, dist: 120 * MB, age: 5 },
    { n: 'old-portfolio-2023', nm: 890 * MB, git: 1.4 * GB, dist: 260 * MB, age: 400 },
    { n: 'ai-agent-experiment', nm: 1.2 * GB, git: 95 * MB, venv: 2.8 * GB, age: 20 },
    { n: 'todo-swiftui', nm: 0, git: 60 * MB, pods: 540 * MB, age: 90 },
    { n: 'backend-api-laravel', nm: 0, git: 180 * MB, vendor: 420 * MB, age: 15 },
  ];

  for (const p of projects) {
    const base = `projects/${p.n}`;
    if (p.nm) items.push(item({ name: 'node_modules', path: `${base}/node_modules`, size: p.nm, isDir: true, level: 'safe', category: 'deps', reason: 'Thư mục dependency nặng nhất của mọi project JS.', reclaimHint: 'npm install', fileCount: Math.floor(30000 + rnd() * 60000), lastModified: ago(p.age) }, i++));
    if (p.git) items.push(item({ name: '.git', path: `${base}/.git`, size: p.git, isDir: true, level: 'caution', category: 'vcs', reason: 'Toàn bộ lịch sử git. Nếu repo đã push remote thì xóa vẫn clone lại được.', reclaimHint: 'git clone lại từ remote', fileCount: Math.floor(500 + rnd() * 4000), lastModified: ago(p.age) }, i++));
    if ((p as any).next) items.push(item({ name: '.next', path: `${base}/.next`, size: (p as any).next, isDir: true, level: 'safe', category: 'build', reason: 'Build output — tái tạo bằng 1 lệnh build.', reclaimHint: 'npm run build', fileCount: 8200, lastModified: ago(p.age) }, i++));
    if ((p as any).dist) items.push(item({ name: 'dist', path: `${base}/dist`, size: (p as any).dist, isDir: true, level: 'safe', category: 'build', reason: 'Build output — tái tạo bằng 1 lệnh build.', reclaimHint: 'npm run build', fileCount: 340, lastModified: ago(p.age) }, i++));
    if ((p as any).pods) items.push(item({ name: 'Pods', path: `${base}/ios/Pods`, size: (p as any).pods, isDir: true, level: 'safe', category: 'deps', reason: 'CocoaPods dependencies của project iOS.', reclaimHint: 'pod install --repo-update', fileCount: 12400, lastModified: ago(p.age) }, i++));
    if ((p as any).gradle) items.push(item({ name: '.gradle', path: `${base}/android/.gradle`, size: (p as any).gradle, isDir: true, level: 'safe', category: 'build', reason: 'Gradle cache/build — Android dev hay tốn 5-15GB.', reclaimHint: './gradlew build', fileCount: 9800, lastModified: ago(p.age) }, i++));
    if ((p as any).dart) items.push(item({ name: '.dart_tool', path: `${base}/.dart_tool`, size: (p as any).dart, isDir: true, level: 'safe', category: 'deps', reason: 'Dart tool cache.', reclaimHint: 'flutter pub get', fileCount: 5600, lastModified: ago(p.age) }, i++));
    if ((p as any).venv) items.push(item({ name: '.venv', path: `${base}/.venv`, size: (p as any).venv, isDir: true, level: 'safe', category: 'deps', reason: 'Python virtualenv — tái tạo dễ dàng.', reclaimHint: 'pip install -r requirements.txt', fileCount: 15400, lastModified: ago(p.age) }, i++));
    if ((p as any).vendor) items.push(item({ name: 'vendor', path: `${base}/vendor`, size: (p as any).vendor, isDir: true, level: 'review', category: 'deps', reason: 'Vendor dependencies (PHP/Go/Ruby). Thường cài lại được.', reclaimHint: 'composer install', fileCount: 7200, lastModified: ago(p.age) }, i++));
    items.push(item({ name: '.env', path: `${base}/.env`, size: 2.1 * 1024, isDir: false, level: 'protected', category: 'secret', reason: 'File môi trường / credentials — chứa API key, token.', fileCount: 1, lastModified: ago(p.age) }, i++));
  }

  // Xcode
  items.push(item({ name: 'DerivedData', path: 'Library/Developer/Xcode/DerivedData', size: 28.4 * GB, isDir: true, level: 'safe', category: 'build', reason: 'Xcode DerivedData — khắc tinh của ổ cứng iOS dev, thường vài chục GB.', reclaimHint: 'Xcode tự build lại', fileCount: 412000, lastModified: ago(1) }, i++));
  items.push(item({ name: 'CoreSimulator', path: 'Library/Developer/CoreSimulator', size: 34.7 * GB, isDir: true, level: 'review', category: 'cache', reason: 'iOS Simulators — mỗi cái vài GB. Xóa simulator cũ không dùng.', reclaimHint: 'xcrun simctl delete unavailable', fileCount: 88000, lastModified: ago(30) }, i++));
  items.push(item({ name: 'Archives', path: 'Library/Developer/Xcode/Archives', size: 9.2 * GB, isDir: true, level: 'caution', category: 'installer', reason: 'Xcode Archives — bản build đã đóng gói. Có thể là build đã release.', reclaimHint: 'Giữ bản mới nhất', fileCount: 47, lastModified: ago(60) }, i++));

  // AI tools
  items.push(item({ name: '.claude', path: '.claude', size: 3.8 * GB, isDir: true, level: 'review', category: 'ai', reason: 'Claude Code: projects history, todos, session data, shell snapshots.', reclaimHint: 'Xóa session cũ, giữ settings', fileCount: 24500, lastModified: ago(0.2) }, i++));
  items.push(item({ name: '.codex', path: '.codex', size: 1.9 * GB, isDir: true, level: 'review', category: 'ai', reason: 'OpenAI Codex CLI: sessions, logs, history.', reclaimHint: 'Xóa sessions/ cũ', fileCount: 8200, lastModified: ago(1) }, i++));
  items.push(item({ name: '.cursor', path: '.cursor', size: 860 * MB, isDir: true, level: 'review', category: 'ai', reason: 'Cursor AI data / cache.', fileCount: 3100, lastModified: ago(4) }, i++));

  // Caches
  items.push(item({ name: 'Caches', path: 'Library/Caches', size: 11.6 * GB, isDir: true, level: 'safe', category: 'cache', reason: 'macOS app caches. App tự tạo lại.', reclaimHint: 'Khởi động lại app', fileCount: 96000, lastModified: ago(0.5) }, i++));
  items.push(item({ name: '.npm', path: '.npm', size: 4.2 * GB, isDir: true, level: 'safe', category: 'cache', reason: 'Global package manager cache.', reclaimHint: 'npm cache clean --force', fileCount: 31000, lastModified: ago(2) }, i++));
  items.push(item({ name: '.pnpm-store', path: '.pnpm-store', size: 6.8 * GB, isDir: true, level: 'safe', category: 'cache', reason: 'Global package manager cache.', reclaimHint: 'pnpm store prune', fileCount: 118000, lastModified: ago(1) }, i++));
  items.push(item({ name: '.cocoapods', path: '.cocoapods', size: 5.4 * GB, isDir: true, level: 'safe', category: 'cache', reason: 'CocoaPods/Maven cache.', reclaimHint: 'pod cache clean --all', fileCount: 22000, lastModified: ago(15) }, i++));

  // Downloads
  items.push(item({ name: 'Xcode-15.4.dmg', path: 'Downloads/Xcode-15.4.dmg', size: 3.4 * GB, isDir: false, level: 'review', category: 'installer', reason: 'Installer macOS — cài xong thường không cần nữa.', fileCount: 1, lastModified: ago(120) }, i++));
  items.push(item({ name: 'Android-Studio.dmg', path: 'Downloads/Android-Studio.dmg', size: 1.1 * GB, isDir: false, level: 'review', category: 'installer', reason: 'Installer macOS — cài xong thường không cần nữa.', fileCount: 1, lastModified: ago(200) }, i++));
  items.push(item({ name: 'client-assets-final-v2.zip', path: 'Downloads/client-assets-final-v2.zip', size: 780 * MB, isDir: false, level: 'review', category: 'installer', reason: 'File nén lớn — nếu đã giải nén thì dư thừa.', fileCount: 1, lastModified: ago(88) }, i++));
  items.push(item({ name: 'demo-video-iphone.mp4', path: 'Downloads/demo-video-iphone.mp4', size: 640 * MB, isDir: false, level: 'review', category: 'media', reason: 'Video lớn (screen recording demo app?).', fileCount: 1, lastModified: ago(40) }, i++));
  items.push(item({ name: 'release-v1.2.0.apk', path: 'projects/food-delivery-rn/release-v1.2.0.apk', size: 184 * MB, isDir: false, level: 'review', category: 'installer', reason: 'Build artifact app mobile. Nếu đã upload store thì xóa được.', reclaimHint: 'Build lại từ CI/IDE', fileCount: 1, lastModified: ago(75) }, i++));
  items.push(item({ name: 'id_rsa_backup.pem', path: 'Documents/id_rsa_backup.pem', size: 3.2 * 1024, isDir: false, level: 'protected', category: 'secret', reason: 'Private key / chứng chỉ ký ứng dụng. Mất là không build/release được.', fileCount: 1, lastModified: ago(500) }, i++));

  items.sort((a, b) => b.size - a.size);

  const topLevel = [
    { name: 'projects', path: 'projects', size: 28.6 * GB, isDir: true, category: 'other' },
    { name: 'Library', path: 'Library', size: 96.3 * GB, isDir: true, category: 'cache' },
    { name: 'Applications', path: 'Applications', size: 42.1 * GB, isDir: true, category: 'other' },
    { name: 'Downloads', path: 'Downloads', size: 18.4 * GB, isDir: true, category: 'installer' },
    { name: 'Documents', path: 'Documents', size: 12.7 * GB, isDir: true, category: 'other' },
    { name: '.claude', path: '.claude', size: 3.8 * GB, isDir: true, category: 'ai' },
    { name: '.codex', path: '.codex', size: 1.9 * GB, isDir: true, category: 'ai' },
    { name: '.npm', path: '.npm', size: 4.2 * GB, isDir: true, category: 'cache' },
    { name: '.pnpm-store', path: '.pnpm-store', size: 6.8 * GB, isDir: true, category: 'cache' },
    { name: '.cocoapods', path: '.cocoapods', size: 5.4 * GB, isDir: true, category: 'cache' },
    { name: 'Movies', path: 'Movies', size: 31.2 * GB, isDir: true, category: 'media' },
    { name: 'Pictures', path: 'Pictures', size: 22.8 * GB, isDir: true, category: 'media' },
    { name: 'Music', path: 'Music', size: 8.6 * GB, isDir: true, category: 'media' },
    { name: 'khác', path: 'khác', size: 124 * GB, isDir: true, category: 'other' },
  ];

  const totalSize = topLevel.reduce((s, t) => s + t.size, 0);
  return {
    rootName: 'Macintosh HD (demo)',
    scannedAt: Date.now(),
    totalSize,
    fileCount: 1_284_533,
    dirCount: 96_214,
    items,
    topLevel,
    durationMs: 4820,
    truncated: false,
  };
}
