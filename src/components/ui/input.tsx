"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// Nomor telepon Indonesia: UI selalu menampilkan prefix +62, nilai = digit
// nasional tanpa awalan 0/62. Format tersimpan di DB: "62xxxxxxxxxx".
// eslint-disable-next-line react-refresh/only-export-components
export function normalizePhone(raw: string | null | undefined): string {
  return (raw || "").replace(/\D/g, "").replace(/^62/, "").replace(/^0+/, "")
}

// ponytail: simpan seragam "62xxx"; kalau nanti perlu E.164 penuh (+), tinggal ganti di sini
// eslint-disable-next-line react-refresh/only-export-components
export const toStoredPhone = (raw: string | null | undefined): string =>
  normalizePhone(raw) ? `62${normalizePhone(raw)}` : ""

type PhoneInputProps = Omit<InputProps, "value" | "onChange" | "type"> & {
  value?: string | number | null
  onChange?: (value: string) => void
}

function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  return (
    <div className="flex">
      <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
        +62
      </span>
      <Input
        type="tel"
        inputMode="numeric"
        className={cn("rounded-l-none", className)}
        {...props}
        value={normalizePhone(String(value ?? ""))}
        onChange={(e) => onChange?.(normalizePhone(e.target.value))}
      />
    </div>
  )
}

export { Input, PhoneInput }
