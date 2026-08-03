// Kalkulasi SLA berbasis jam operasional 08.15–17.00 WIB (Senin–Jumat), libur nasional
// dilewati. BR-28D (status NEW/OPEN/dll. tidak dihitung) tidak dipetakan karena butuh
// timestamp transisi status yang belum tersedia — deadline dihitung dari created_at.
// ponytail: tanpa riwayat status, BR-28D tidak akurat; upgrade saat backend SLA (Node.js) dibangun.
export const WORK_START_MIN = 8 * 60 + 15; // 08:15 WIB
export const WORK_END_MIN = 17 * 60; // 17:00 WIB
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Indonesia tanpa DST → offset tetap.

function toWib(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

function isWorkingDay(date: Date, holidaySet: Set<string>): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !holidaySet.has(date.toISOString().slice(0, 10));
}

// Batas waktu = start + targetHours jam kerja, maju melewati malam, akhir pekan, dan libur.
export function computeSlaDeadline(start: Date, targetHours: number, holidays: string[]): Date {
  const holidaySet = new Set(holidays);
  let remaining = targetHours;
  const cursor = toWib(start);
  while (remaining > 0) {
    const minutes = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();
    if (!isWorkingDay(cursor, holidaySet) || minutes >= WORK_END_MIN) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(8, 15, 0, 0);
      continue;
    }
    if (minutes < WORK_START_MIN) {
      cursor.setUTCHours(8, 15, 0, 0);
      continue;
    }
    const step = Math.min(WORK_END_MIN - minutes, remaining * 60);
    cursor.setTime(cursor.getTime() + step * 60_000);
    remaining -= step / 60;
  }
  return new Date(cursor.getTime() - WIB_OFFSET_MS);
}

export function isSlaOverdue(
  createdAt: string,
  targetHours: number,
  holidays: string[],
  now: Date = new Date(),
): boolean {
  return now.getTime() > computeSlaDeadline(new Date(createdAt), targetHours, holidays).getTime();
}
