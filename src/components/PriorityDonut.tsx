import { useState } from "react";

export const DONUT_COLORS = ["#ef4444", "#f59e0b", "#3b82f6"];
const DONUT_LABELS = ["P1", "P2", "P3"];

export function PriorityDonut({ p1, p2, p3 }: { p1: number; p2: number; p3: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = p1 + p2 + p3;
  if (total === 0) {
    return (
      <div className="h-36 w-36 rounded-full bg-muted grid place-items-center">
        <span className="text-[10px] text-muted-foreground">Tidak ada data</span>
      </div>
    );
  }
  const segs = [p1, p2, p3];
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const parts = segs.map((v, i) => {
    const len = (v / total) * C;
    const part = { len, offset, color: DONUT_COLORS[i] };
    offset += len;
    return part;
  });
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
        {parts.map((p, i) => (
          <circle
            key={i}
            cx="72"
            cy="72"
            r={R}
            fill="none"
            stroke={p.color}
            strokeWidth="22"
            strokeDasharray={`${p.len} ${C - p.len}`}
            strokeDashoffset={-p.offset}
            className="cursor-pointer transition-opacity"
            opacity={hovered === null || hovered === i ? 1 : 0.35}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div className="absolute inset-[22%] rounded-full bg-card grid place-items-center pointer-events-none">
        <span className="text-sm font-bold text-foreground">{total}</span>
      </div>
      {hovered !== null && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-foreground text-primary-foreground text-[11px] font-mono whitespace-nowrap z-10 shadow-lg pointer-events-none">
          {DONUT_LABELS[hovered]}: {segs[hovered]} tiket
        </div>
      )}
    </div>
  );
}

export function PriorityLegend() {
  return (
    <div className="flex items-center gap-3">
      {DONUT_LABELS.map((label, i) => (
        <span
          key={label}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }} />
          {label}
        </span>
      ))}
    </div>
  );
}
