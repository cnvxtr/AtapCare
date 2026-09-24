import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { CalendarDate } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import type { DateRange } from "react-aria-components";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RangeCalendar } from "@/components/ui/calendar-rac";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00`),
  );

const toCalendarDate = (iso?: string) => {
  if (!iso) return undefined;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new CalendarDate(y, m, d);
};

export default function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const value = useMemo<DateRange | null>(
    () => {
      const start = toCalendarDate(from);
      const end = toCalendarDate(to);
      return start && end ? { start, end } : null;
    },
    [from, to],
  );

  const label = from && to ? `${fmt(from)} – ${fmt(to)}` : "Semua Tanggal";

  const apply = (range: DateRange | null) => {
    if (range) {
      onChange(range.start.toString(), range.end.toString());
    } else {
      onChange(undefined, undefined);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-card px-2 text-[13px] text-foreground hover:bg-muted transition-colors"
        >
          <CalendarIcon className="h-3.5 w-3.5 opacity-50 shrink-0" />
          <span className="truncate max-w-[150px]">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[130] w-auto bg-transparent border-transparent p-0">
        <I18nProvider locale="id-ID">
          <div className="rounded-xl border border-border bg-card p-3 select-none shadow-xl">
            <div className="flex items-center gap-2 text-[11px] px-1 mb-2">
              <span className="font-mono text-muted-foreground">
                Dari <span className="text-foreground">{from ? fmt(from) : "—"}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-muted-foreground">
                Sampai <span className="text-foreground">{to ? fmt(to) : "—"}</span>
              </span>
            </div>

            <RangeCalendar
              className="p-2"
              value={value}
              onChange={apply}
            />

            {(from || to) && (
              <div className="flex justify-end mt-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => apply(null)}
                  className="rounded border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-foreground hover:text-primary-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </I18nProvider>
      </PopoverContent>
    </Popover>
  );
}
