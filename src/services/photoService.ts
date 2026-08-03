import { supabase } from '@/lib/supabase'

const BUCKET = 'ticket-photos'

// Kompresi client-side ke Blob JPEG (BR 3.3.2 Langkah 4: target <500KB per foto).
// Duplikasi logika compressImage (image.ts) karena itu mengembalikan data URL.
export function compressImageToBlob(file: File, maxDim = 800, quality = 0.6): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('canvas')); return }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
        }
        img.onerror = reject
        img.src = url
    })
}

// Simpan foto terkompresi ke Storage, kembalikan path (bukan URL) agar tidak kedaluwarsa.
// Folder = kode tiket (dikenal sebelum tiket dibuat / saat menindak tiket).
export async function uploadTicketPhoto(file: File, folder: string): Promise<string> {
    const blob = await compressImageToBlob(file)
    // ponytail: crypto.randomUUID belum tentu ada di WebView Android 8 (API 26) → fallback sederhana.
    const uid = crypto.randomUUID ? crypto.randomUUID() : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    const path = `${folder}/${uid}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
    })
    if (error) throw new Error(error.message)
    return path
}

// Resolve nilai foto (data URL → sama; path storage → signed URL) jadi peta nilai→URL.
export async function resolvePhotos(values: string[]): Promise<Record<string, string>> {
    const map: Record<string, string> = {}
    const paths: string[] = []
    for (const v of values) {
        if (!v) continue
        if (v.startsWith('data:image')) map[v] = v
        else paths.push(v)
    }
    if (paths.length) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
        if (!error && data) {
            for (const u of data) {
                if (u.signedUrl && u.path) map[u.path] = u.signedUrl
            }
        }
    }
    return map
}
