// Normalisasi nomor HP → format internasional utk wa.me (0/62/+62 → 62).
export function normalizeWaNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits.slice(1)
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return "62" + digits.slice(1)
  return digits
}

export function waMeLink(phone: string, text?: string): string {
  const url = `https://wa.me/${normalizeWaNumber(phone)}`
  return text ? `${url}?text=${encodeURIComponent(text)}` : url
}
