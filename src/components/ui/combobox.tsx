"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Pilih…",
  disabled = false,
  emptyText = "Tidak ada hasil",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (filtered.length ? Math.min(h + 1, filtered.length - 1) : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && filtered[highlight]) pick(filtered[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-[3px] border border-input bg-card px-3 pr-8 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <ChevronDown
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition",
            open && "rotate-180",
          )}
        />
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(o)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex items-center justify-between transition rounded-[3px]",
                  i === highlight ? "bg-foreground text-background" : "text-foreground",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
