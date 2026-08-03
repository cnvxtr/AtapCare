import { AlertCircle } from 'lucide-react'

export default function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null
    return (
        <p className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {msg}
        </p>
    )
}
