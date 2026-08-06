"use client"

import { cn } from "@/lib/utils"
import { getLocalTimeZone, today } from "@internationalized/date"
import type { ComponentProps } from "react"
import {
  Button,
  CalendarCell as CalendarCellRac,
  CalendarGridBody as CalendarGridBodyRac,
  CalendarGridHeader as CalendarGridHeaderRac,
  CalendarGrid as CalendarGridRac,
  CalendarHeaderCell as CalendarHeaderCellRac,
  Calendar as CalendarRac,
  Heading as HeadingRac,
  RangeCalendar as RangeCalendarRac,
  composeRenderProps,
} from "react-aria-components"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface BaseCalendarProps {
  className?: string
  // Tanggal libur (format YYYY-MM-DD) untuk disorot; selain itu sel diredupkan.
  holidayDates?: Set<string>
}

type CalendarProps = ComponentProps<typeof CalendarRac> & BaseCalendarProps
type RangeCalendarProps = ComponentProps<typeof RangeCalendarRac> &
  BaseCalendarProps

const CalendarHeader = () => (
  <header className="flex w-full items-center gap-1 pb-1">
    <Button
      slot="previous"
      className="flex size-9 items-center justify-center rounded-[3px] text-muted-foreground/80 outline-offset-2 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70"
    >
      <ChevronLeft size={16} strokeWidth={2} />
    </Button>
    <HeadingRac className="grow text-center text-sm font-medium" />
    <Button
      slot="next"
      className="flex size-9 items-center justify-center rounded-[3px] text-muted-foreground/80 outline-offset-2 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70"
    >
      <ChevronRight size={16} strokeWidth={2} />
    </Button>
  </header>
)

const CalendarGridComponent = ({ isRange = false, holidayDates }: { isRange?: boolean; holidayDates?: Set<string> }) => {
  const now = today(getLocalTimeZone())

  return (
    <CalendarGridRac>
      <CalendarGridHeaderRac>
        {(day) => (
          <CalendarHeaderCellRac className="size-9 rounded-lg p-0 text-xs font-medium text-muted-foreground/80">
            {day}
          </CalendarHeaderCellRac>
        )}
      </CalendarGridHeaderRac>
      <CalendarGridBodyRac className="[&_td]:px-0">
        {(date) => {
          const isHoliday = holidayDates?.has(date.toString())
          return (
            <CalendarCellRac
              date={date}
              className={cn(
                "relative flex size-9 items-center justify-center whitespace-nowrap rounded-[3px] border border-transparent p-0 text-sm font-normal text-foreground outline-offset-2 duration-150 [transition-property:color,background-color,border-radius,box-shadow] focus:outline-none data-[disabled]:pointer-events-none data-[unavailable]:pointer-events-none data-[focus-visible]:z-10 data-[hovered]:bg-accent data-[selected]:bg-primary data-[hovered]:text-foreground data-[selected]:text-primary-foreground data-[unavailable]:line-through data-[disabled]:opacity-30 data-[unavailable]:opacity-30 data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70",
                // Hari libur: sorot merah (hanya tampilan, bukan pilihan)
                isHoliday &&
                  "bg-red-600 text-white font-semibold data-[hovered]:bg-red-600 data-[hovered]:text-white data-[selected]:bg-red-600 data-[selected]:text-white",
                // Range-specific styles
                isRange &&
                  "data-[selected]:rounded-none data-[selection-end]:rounded-e-[3px] data-[selection-start]:rounded-s-[3px] data-[invalid]:bg-red-100 data-[selected]:bg-accent data-[selected]:text-foreground data-[invalid]:data-[selection-end]:[&:not([data-hover])]:bg-destructive data-[invalid]:data-[selection-start]:[&:not([data-hover])]:bg-destructive data-[selection-end]:[&:not([data-hover])]:bg-primary data-[selection-start]:[&:not([data-hover])]:bg-primary data-[invalid]:data-[selection-end]:[&:not([data-hover])]:text-destructive-foreground data-[invalid]:data-[selection-start]:[&:not([data-hover])]:text-destructive-foreground data-[selection-end]:[&:not([data-hover])]:text-primary-foreground data-[selection-start]:[&:not([data-hover])]:text-primary-foreground",
                // Today indicator styles
                date.compare(now) === 0 &&
                  cn(
                    "after:pointer-events-none after:absolute after:bottom-1 after:start-1/2 after:z-10 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary",
                    isRange
                      ? "data-[selection-end]:[&:not([data-hover])]:after:bg-background data-[selection-start]:[&:not([data-hover])]:after:bg-background"
                      : "data-[selected]:after:bg-background",
                  ),
              )}
            />
          )
        }}
      </CalendarGridBodyRac>
    </CalendarGridRac>
  )
}

const Calendar = ({ className, holidayDates, ...props }: CalendarProps) => {
  return (
    <CalendarRac
      {...props}
      className={composeRenderProps(className, (className) =>
        cn("w-fit", className),
      )}
    >
      <CalendarHeader />
      <CalendarGridComponent holidayDates={holidayDates} />
    </CalendarRac>
  )
}

const RangeCalendar = ({ className, ...props }: RangeCalendarProps) => {
  return (
    <RangeCalendarRac
      {...props}
      className={composeRenderProps(className, (className) =>
        cn("w-fit", className),
      )}
    >
      <CalendarHeader />
      <CalendarGridComponent isRange />
    </RangeCalendarRac>
  )
}

export { Calendar, RangeCalendar }
