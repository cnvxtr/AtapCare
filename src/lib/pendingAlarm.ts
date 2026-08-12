// Alarm tiket PENDING yang menggantung: tidak ada aktivitas setelah X jam.
// ponytail: threshold statis 8 jam kerja (1 hari kerja). Upgrade ke
// perhitungan jam operasional (08.00-17.00, libur) bila alarm jadi KPI.

const PENDING_ALARM_MS = 8 * 60 * 60 * 1000;

export function getPendingHours(updatedAt?: string): number | null {
  if (!updatedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / (60 * 60 * 1000)));
}

export function getPendingAlarm(updatedAt?: string): string | null {
  if (!updatedAt) return null;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  if (elapsed < PENDING_ALARM_MS) return null;
  const h = Math.floor(elapsed / (60 * 60 * 1000));
  const m = Math.floor((elapsed % (60 * 60 * 1000)) / (60 * 1000));
  return h >= 24 ? `${Math.floor(h / 24)} hari ${h % 24}j` : `${h}j ${m}m`;
}
