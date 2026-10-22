import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

const pad = (n: number) => String(n).padStart(2, "0")

interface SchedulePickerProps {
  date: string
  time: string
  onDate: (iso: string) => void
  onTime: (t: string) => void
  onConfirm: () => void
}

const ITEM_H = 32
const COPIES = 3

function WheelColumn({
  label,
  values,
  format,
  selected,
  onSelect,
}: {
  label: string
  values: number[]
  format: (v: number) => string
  selected: string
  onSelect: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const n = values.length
  const copy = ITEM_H * n

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.scrollTop === 0) el.scrollTop = copy
  }, [copy])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = values.findIndex((v) => format(v) === selected)
    if (idx < 0) return
    const band = copy / 2
    const max = el.scrollHeight - el.clientHeight - band
    if (el.scrollTop < band) el.scrollTop = band
    else if (el.scrollTop > max) el.scrollTop = max
    el.scrollTo({ top: copy + idx * ITEM_H - el.clientHeight / 2 + ITEM_H / 2, behavior: "smooth" })
  }, [selected, values, format, copy])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const band = copy / 2
    if (el.scrollTop < band) el.scrollTop += copy
    else if (el.scrollTop > el.scrollHeight - el.clientHeight - band) el.scrollTop -= copy
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center mb-1">{label}</p>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="relative h-44 overflow-y-auto rounded-lg border border-border bg-card"
      >
        {Array.from({ length: n * COPIES }, (_, i) => {
          const v = values[i % n]
          const active = format(v) === selected
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "w-full h-8 flex items-center justify-center text-sm font-mono transition-colors",
                active
                  ? "bg-foreground text-primary-foreground font-bold"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {format(v)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SchedulePicker({ date, time, onDate, onTime, onConfirm }: SchedulePickerProps) {
  const selected = date ? new Date(`${date}T00:00:00`) : undefined
  const [pHour, pMin] = time ? time.split(":") : ["", ""]
  const hourDone = !!pHour
  const minDone = !!pMin
  const complete = !!date && hourDone && minDone

  const handleHour = (h: number) => {
    if (pHour === pad(h)) { onTime(minDone ? `:${pMin}` : ""); return }
    onTime(`${pad(h)}:${minDone ? pMin : ""}`)
  }
  const handleMin = (m: number) => {
    if (pMin === pad(m)) { onTime(hourDone ? `${pHour}:` : ""); return }
    onTime(`${hourDone ? pHour : ""}:${pad(m)}`)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      <div className="rounded-lg border border-border bg-muted p-4 flex justify-center sm:block">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onDate(d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "")}
          defaultMonth={selected}
          disabled={(d) => d.getTime() < todayStart.getTime()}
          showOutsideDays={false}
          formatters={{
            formatWeekdayName: (d) => WEEKDAYS[d.getDay()],
            formatCaption: (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
          }}
          className="w-fit"
        />
      </div>
      <div className="rounded-lg border border-border bg-muted p-4 flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground text-center">
          {(hourDone || minDone) ? `${hourDone ? pHour : "--"}:${minDone ? pMin : "--"}` : "Pilih jam & menit"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <WheelColumn label="Jam" values={HOURS} format={pad} selected={hourDone ? pHour : ""} onSelect={handleHour} />
          <WheelColumn label="Menit" values={MINUTES} format={pad} selected={minDone ? pMin : ""} onSelect={handleMin} />
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!complete}
          className={cn(
            "sticky bottom-0 w-full py-2 rounded font-bold transition-opacity",
            complete ? "bg-foreground text-primary-foreground" : "bg-foreground text-primary-foreground opacity-50 cursor-not-allowed"
          )}
        >
          OK
        </button>
      </div>
    </div>
  )
}
