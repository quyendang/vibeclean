import { useMemo } from 'react';
import { formatBytes } from '../lib/format';

interface Node { name: string; size: number; category: string }
interface Rect { x: number; y: number; w: number; h: number; node: Node }

const CAT_COLORS: Record<string, string> = {
  deps: '#00d9a3', build: '#2dd4bf', cache: '#38bdf8', ai: '#c8a2ff',
  vcs: '#ffbd2e', installer: '#fb923c', media: '#f472b6', secret: '#ff5f56',
  source: '#e4e4e7', other: '#52525b',
};

// Squarified-ish treemap (simple slice-dice with aspect ratio optimization)
function layout(nodes: Node[], x: number, y: number, w: number, h: number, out: Rect[]) {
  if (!nodes.length || w <= 0 || h <= 0) return;
  if (nodes.length === 1) { out.push({ x, y, w, h, node: nodes[0] }); return; }
  const total = nodes.reduce((s, n) => s + n.size, 0);
  let acc = 0, idx = 0;
  // find split point
  for (let i = 0; i < nodes.length - 1; i++) { if (acc + nodes[i].size <= total / 2 || i === 0) acc += nodes[i].size; else break; idx = i; }
  const first = nodes.slice(0, idx + 1), second = nodes.slice(idx + 1);
  const ratio = acc / total;
  if (w >= h) {
    layout(first, x, y, w * ratio, h, out);
    layout(second, x + w * ratio, y, w * (1 - ratio), h, out);
  } else {
    layout(first, x, y, w, h * ratio, out);
    layout(second, x, y + h * ratio, w, h * (1 - ratio), out);
  }
}

export function Treemap({ nodes, onSelect }: { nodes: Node[]; onSelect?: (n: Node) => void }) {
  const rects = useMemo(() => {
    const sorted = [...nodes].filter(n => n.size > 0).sort((a, b) => b.size - a.size).slice(0, 24);
    const out: Rect[] = [];
    layout(sorted, 0, 0, 100, 100, out);
    return out;
  }, [nodes]);
  const total = nodes.reduce((s, n) => s + n.size, 0);

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/7' }}>
      {rects.map((r, i) => {
        const pctW = r.w, pctH = r.h;
        const showLabel = r.w > 9 && r.h > 12;
        const showSize = r.w > 13 && r.h > 20;
        const color = CAT_COLORS[r.node.category] || CAT_COLORS.other;
        return (
          <button
            key={i}
            onClick={() => onSelect?.(r.node)}
            className="absolute overflow-hidden text-left transition-all duration-150 hover:brightness-125 group"
            style={{
              left: `${r.x}%`, top: `${r.y}%`, width: `calc(${pctW}% - 2px)`, height: `calc(${pctH}% - 2px)`,
              backgroundColor: `${color}18`, border: `1px solid ${color}55`,
            }}
            title={`${r.node.name} — ${formatBytes(r.node.size)}`}
          >
            {showLabel && (
              <div className="p-1.5 leading-tight">
                <div className="text-[11px] font-medium truncate" style={{ color }}>{r.node.name}</div>
                {showSize && <div className="text-[10px] text-zinc-500 font-mono">{formatBytes(r.node.size)} · {((r.node.size / total) * 100).toFixed(1)}%</div>}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
