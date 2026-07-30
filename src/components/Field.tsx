import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default Field
