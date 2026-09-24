import { supabase } from '@/lib/supabase'

const BUCKET = 'ticket-photos'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fraksi 0..1 untuk progres upload (dipakai ProgressBar).
export type UploadProgress = (fraction: number) => void

// Upload via XMLHttpRequest karena supabase-js (fetch) tidak memberi event progres.
// Endpoint & header identik dengan supabase.storage.upload → kebijakan Storage sama.
async function xhrUpload(bucket: string, path: string, body: Blob | File, contentType: string, upsert: boolean, onProgress?: UploadProgress): Promise<void> {
    const { data } = await supabase.auth.getSession()
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`)
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
        if (data.session?.access_token) xhr.setRequestHeader('authorization', `Bearer ${data.session.access_token}`)
        if (upsert) xhr.setRequestHeader('x-upsert', 'true')
        xhr.setRequestHeader('content-type', contentType)
        // Throttle emit progres (~8x/detik) agar re-render halaman tidak jadi badai.
        let lastEmit = 0
        xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable || e.total <= 0) return
            const fraction = Math.min(1, e.loaded / e.total)
            const now = performance.now()
            if (fraction >= 1 || now - lastEmit > 120) { lastEmit = now; onProgress?.(fraction) }
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) { resolve(); return }
            let msg = `Upload gagal (${xhr.status})`
            try { msg = JSON.parse(xhr.responseText).message || msg } catch { /* biarkan pesan default */ }
            reject(new Error(msg))
        }
        xhr.onerror = () => reject(new Error('Koneksi gagal saat mengunggah.'))
        xhr.send(body)
    })
}

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
export async function uploadTicketPhoto(file: File, folder: string, onProgress?: UploadProgress): Promise<string> {
    const blob = await compressImageToBlob(file)
    // ponytail: crypto.randomUUID belum tentu ada di WebView Android 8 (API 26) → fallback sederhana.
    const uid = crypto.randomUUID ? crypto.randomUUID() : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    const path = `${folder}/${uid}.jpg`
    await xhrUpload(BUCKET, path, blob, 'image/jpeg', false, onProgress)
    return path
}

// Upload file non-image (PDF, DOC, XLSX, dll) tanpa kompresi, preserve extension.
export async function uploadTicketFile(file: File, folder: string, onProgress?: UploadProgress): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin'
    const uid = crypto.randomUUID ? crypto.randomUUID() : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    const path = `${folder}/${uid}.${ext}`
    await xhrUpload(BUCKET, path, file, file.type || 'application/octet-stream', false, onProgress)
    return path
}

// Auto-route: image → compress, non-image → upload as-is.
export async function uploadAttachment(file: File, folder: string, onProgress?: UploadProgress): Promise<string> {
    if (file.type.startsWith('image/')) return uploadTicketPhoto(file, folder, onProgress)
    return uploadTicketFile(file, folder, onProgress)
}

// Avatar ke bucket avatars (upsert agar menimpa foto lama user).
export async function uploadAvatar(path: string, blob: Blob, onProgress?: UploadProgress): Promise<void> {
    return xhrUpload('avatars', path, blob, blob.type || 'image/jpeg', true, onProgress)
}

// Resolve avatar path (avatars bucket) → signed URL.
export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null
    const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600 * 24 * 365)
    return data?.signedUrl || null
}

// Resolve nilai foto/file (data URL → sama; path storage → signed URL) jadi peta nilai→URL.
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
