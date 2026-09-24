import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

export default function TrendChart({
  data,
}: {
  data: { name: string; masuk: number; selesai: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const w = 600, h = 200, pad = 20, padB = 32;
  const max = Math.max(1, ...data.flatMap((d) => [d.masuk, d.selesai]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - padB - (v / max) * (h - pad - padB);
  const line = (key: "masuk" | "selesai") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  const handleMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    const wrap = wrapRef.current;
    if (!ctm || !wrap) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((px - pad) / ((w - pad * 2) / (data.length - 1)))));
    const pt = svg.createSVGPoint();
    pt.x = x(idx);
    pt.y = y(Math.max(data[idx].masuk, data[idx].selesai));
    const p = pt.matrixTransform(ctm);
    const wr = wrap.getBoundingClientRect();
    const below = p.y <= wr.top + 0.35 * wr.height;
    setHover(idx);
    setTipPos({ x: p.x, y: p.y, below });
  };

  const isFirst = hover === 0;
  const isLast = hover === data.length - 1;

  return (
    <div className="relative" ref={wrapRef}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" onMouseMove={handleMove} onMouseLeave={() => { setHover(null); setTipPos(null) }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad - padB)} y2={pad + f * (h - pad - padB)}
            stroke="currentColor" strokeOpacity="0.06" />
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad} y2={h - padB} stroke="currentColor" strokeOpacity="0.15" />
        )}
        <motion.path
          d={`${line("masuk")} L${x(data.length - 1)},${h - padB} L${x(0)},${h - padB} Z`}
          fill="currentColor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        />
        <motion.path
          d={line("masuk")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.path
          d={line("selesai")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        />
        {data.map((d, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.05 }}
          >
            <circle cx={x(i)} cy={y(d.masuk)} r={hover === i ? 5 : 4} fill="currentColor" />
            <text x={x(i)} y={h - 6} textAnchor="middle" fontSize="14" fill="currentColor" opacity="0.5">M{i + 1}</text>
          </motion.g>
        ))}
      </svg>
      {hover !== null && tipPos && createPortal((
        <div
          className="fixed pointer-events-none bg-foreground text-background text-xs rounded px-2 py-1.5 shadow-lg z-50"
          style={{
            left: tipPos.x,
            top: tipPos.y,
            transform: `${isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)"} ${tipPos.below ? "translateY(8px)" : "translateY(calc(-100% - 8px))"}`,
          }}
        >
          <p className="font-semibold">M{hover + 1}</p>
          <p>Masuk: <span className="font-bold">{data[hover].masuk}</span></p>
          <p>Selesai: <span className="font-bold">{data[hover].selesai}</span></p>
        </div>
      ), document.body)}
    </div>
  );
}
