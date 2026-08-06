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

// Simpan draft (foto = data URL terkompresi). Jika quota penuh, simpan
// teks saja dan beri tahu pemanggil lewat status hasil.
export function saveDraft(fields: ReportDraftFields, photos: string[]): 'ok' | 'text' | 'failed' {
    const payload: ReportDraft = { ...fields, photos, savedAt: new Date().toISOString() }
    try {
        localStorage.setItem(KEY, JSON.stringify(payload))
        return 'ok'
    } catch {
        try {
            localStorage.setItem(KEY, JSON.stringify({ ...payload, photos: [] }))
            return 'text'
        } catch {
            return 'failed'
        }
    }
}

export function loadDraft(): ReportDraft | null {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const d = JSON.parse(raw) as ReportDraft
        if (!d.savedAt || typeof d.savedAt !== 'string') return null
        if (Date.now() - new Date(d.savedAt).getTime() > EXPIRY_MS) {
            localStorage.removeItem(KEY)
            return null
        }
        return d
    } catch {
        return null
    }
}

export function clearDraft(): void {
    try {
        localStorage.removeItem(KEY)
    } catch {
        // noop
    }
}

// Kompres foto File[] jadi data URL lalu simpan (dipakai autosave & tombol manual).
export async function persistDraft(fields: ReportDraftFields, photos: File[]): Promise<'ok' | 'text' | 'failed'> {
    let dataUrls: string[] = []
    if (photos.length) {
        try {
            dataUrls = await Promise.all(photos.map(compressImage))
        } catch {
            dataUrls = []
        }
    }
    return saveDraft(fields, dataUrls)
}
