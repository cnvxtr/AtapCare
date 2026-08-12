import { compressImage } from './image'

const KEY = 'atapcare-draft-report'
const EXPIRY_MS = 24 * 60 * 60 * 1000

export interface ReportDraftFields {
    reporterName: string
    position: string
    phone: string
    company: string
    site: string
    unit: string
    desc: string
}

interface ReportDraft extends ReportDraftFields {
    photos: string[]
    savedAt: string
}

// Draft tanpa isi (semua field kosong, tanpa foto) dianggap tidak ada —
// mencegah autosave form kosong memicu toast "Draft tersimpan dipulihkan".
function isEmptyDraft(d: ReportDraftFields): boolean {
    return !d.reporterName && !d.position && !d.phone && !d.company && !d.site && !d.unit && !d.desc
}

// Simpan draft per-sesi (sessionStorage): hilang saat tab/browser ditutup.
// Foto = data URL terkompresi. Jika quota penuh, simpan teks saja.
export function saveDraft(fields: ReportDraftFields, photos: string[]): 'ok' | 'text' | 'failed' {
    if (isEmptyDraft(fields) && photos.length === 0) return 'ok'
    const payload: ReportDraft = { ...fields, photos, savedAt: new Date().toISOString() }
    try {
        sessionStorage.setItem(KEY, JSON.stringify(payload))
        return 'ok'
    } catch {
        try {
            sessionStorage.setItem(KEY, JSON.stringify({ ...payload, photos: [] }))
            return 'text'
        } catch {
            return 'failed'
        }
    }
}

export function loadDraft(): ReportDraft | null {
    // Bersihkan draft versi lama di localStorage (sebelum migrasi ke sessionStorage) —
    // mencegah draft parsial lama ikut terpulihkan.
    try {
        localStorage.removeItem(KEY)
    } catch {
        // noop
    }
    try {
        const raw = sessionStorage.getItem(KEY)
        if (!raw) return null
        const d = JSON.parse(raw) as ReportDraft
        if (!d.savedAt || typeof d.savedAt !== 'string') return null
        if (Date.now() - new Date(d.savedAt).getTime() > EXPIRY_MS) {
            sessionStorage.removeItem(KEY)
            return null
        }
        if (isEmptyDraft(d) && d.photos.length === 0) {
            sessionStorage.removeItem(KEY)
            return null
        }
        return d
    } catch {
        return null
    }
}

export function clearDraft(): void {
    try {
        sessionStorage.removeItem(KEY)
    } catch {
        // noop
    }
}

// Kompres foto File[] jadi data URL lalu simpan. Mengembalikan data URL yang
// tersimpan agar pemanggil bisa memakainya untuk flush saat navigasi keluar.
export async function persistDraft(fields: ReportDraftFields, photos: File[]): Promise<{ status: 'ok' | 'text' | 'failed'; dataUrls: string[] }> {
    let dataUrls: string[] = []
    if (photos.length) {
        try {
            dataUrls = await Promise.all(photos.map(compressImage))
        } catch {
            dataUrls = []
        }
    }
    return { status: saveDraft(fields, dataUrls), dataUrls }
}
