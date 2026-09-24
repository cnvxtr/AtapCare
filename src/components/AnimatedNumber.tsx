import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

export default function AnimatedNumber({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const prev = useRef(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const controls = animate(from, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => {
      controls.stop();
      prev.current = from;
    };
  }, [value]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
