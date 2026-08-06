import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Jendela jadwal: 08:00–18:00 dengan langkah 15 menit (BR 3.2.2).
// Di luar 17:00 tetap bisa dipilih agar penjadwalan lembur berfungsi
// (isScheduleOvertime akan menandainya di layar konfirmasi).
const SLOTS: string[] = (() => {
  const list: string[] = []
  for (let t = 8 * 60; t <= 18 * 60; t += 15) {
    list.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`)
  }
  return list
})()

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

interface SchedulePickerProps {
  date: string
  time: string
  onDate: (iso: string) => void
  onTime: (t: string) => void
}

export default function SchedulePicker({ date, time, onDate, onTime }: SchedulePickerProps) {
  const selected = date ? new Date(`${date}T00:00:00`) : undefined

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1 min-w-0 rounded-lg border-2 border-border bg-card p-3">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}
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
      <div className="flex-1 min-w-0 max-h-56 md:max-h-72 overflow-y-auto rounded-lg border-2 border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onTime(s)}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-mono transition-colors",
                time === s
                  ? "bg-foreground text-primary-foreground font-bold"
                  : "bg-muted text-foreground hover:bg-foreground hover:text-primary-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
