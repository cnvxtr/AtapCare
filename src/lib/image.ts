// Kompresi client-side (BR 3.3.2 Langkah 4: target <500KB per foto) → data URL JPEG.
export function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            const MAX = 800
            const scale = Math.min(1, MAX / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('canvas')); return }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.6))
        }
        img.onerror = reject
        img.src = url
    })
}
