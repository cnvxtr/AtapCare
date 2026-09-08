import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

// Jendela jadwal: 24 jam penuh (BR 3.2.2). Lembur di luar jam operasional
// 08.00-17.00 tetap ditandai isScheduleOvertime di layar konfirmasi.
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 00..23
const MINUTES = Array.from({ length: 60 }, (_, i) => i)   // 00..59 (bebas 1 menit)

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

// Kolom gulir ala set alarm: pilih lewat klik. (Auto-pilih & penanda tengah
// dihapus atas permintaan user — scroll polos, seleksi manual via klik.)
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

  // Saat nilai berubah (termasuk prefill ganti teknisi), gulir agar item aktif terlihat.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = values.findIndex((v) => format(v) === selected)
    if (idx >= 0) {
      const item = el.children[idx] as HTMLElement
      el.scrollTop = item.offsetTop - el.clientHeight / 2 + item.clientHeight / 2
    }
  }, [selected, values, format])

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center mb-1">{label}</p>
      <div
        ref={ref}
        className="h-44 overflow-y-auto rounded-lg border border-border bg-card scroll-smooth"
      >
        {values.map((v) => {
          const active = format(v) === selected
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "w-full text-center py-1.5 text-sm font-mono transition-colors",
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
  const [selHour, selMin] = (time ? time.split(":") : []).map((x) => Number(x))
  const complete = !!date && !!time

  const handleHour = (h: number) => {
    if (!time) { onTime(`${pad(h)}:00`); return }
    const [curH, curM] = time.split(":")
    if (Number(curH) === h) { onTime(""); return } // ulang klik jam terpilih → lepas
    onTime(`${pad(h)}:${curM}`)
  }
  const handleMin = (m: number) => {
    if (!time) { onTime(`00:${pad(m)}`); return }
    const [curH, curM] = time.split(":")
    if (Number(curM) === m) { onTime(""); return } // ulang klik menit terpilih → lepas
    onTime(`${curH}:${pad(m)}`)
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row max-h-[70vh] overflow-y-auto">
      <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3">
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
          className="w-full"
        />
      </div>
      <div className="md:w-56 rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground text-center">
          {time || "Pilih jam"}
        </p>
        <div className="flex gap-2">
          <WheelColumn label="Jam" values={HOURS} format={(h) => pad(h)} selected={time ? pad(selHour) : ""} onSelect={handleHour} />
          <WheelColumn label="Menit" values={MINUTES} format={(m) => pad(m)} selected={time ? pad(selMin) : ""} onSelect={handleMin} />
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!complete}
          className={cn(
            "w-full py-2 rounded font-bold transition-opacity",
            complete ? "bg-foreground text-primary-foreground" : "bg-foreground text-primary-foreground opacity-50 cursor-not-allowed"
          )}
        >
          OK
        </button>
      </div>
    </div>
  )
}
