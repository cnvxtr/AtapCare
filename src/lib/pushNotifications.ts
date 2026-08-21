import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// Daftar SW + minta izin notifikasi + subscribe push. Non-blocking: semua
// kegagalan diabaikan — fitur mewah, bukan blocker. Dipanggil sekali saat login.
export async function registerPush(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return
  if (Notification.permission === 'denied') return
  if (Notification.permission !== 'granted') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') void doSubscribe(userId)
    })
    return
  }
  void doSubscribe(userId)
}

async function doSubscribe(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
    }
    await upsertSubscription(userId, sub)

    // Kunci berubah / endpoint kadaluarsa: resubscribe otomatis.
    navigator.serviceWorker.addEventListener('pushsubscriptionchange', async () => {
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      await upsertSubscription(userId, newSub)
    })
  } catch { /* push tak tersedia (mis. HTTP, browser lama) — abaikan */ }
}

async function upsertSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON()
  if (!endpoint || !keys?.p256dh || !keys?.auth) return
  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, keys_p256dh: keys.p256dh, keys_auth: keys.auth },
    { onConflict: 'endpoint' },
  )
}

// Chime khas saat app TERBUKA & ada notif baru (banner OS tetap dari service
// worker push — tanpa duplikat). Saat app tertutup, suara = nada sistem default.
let audioCtx: AudioContext | null = null
export function playChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = audioCtx || new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const t = audioCtx.currentTime
    const notes = [880, 1174.66] // A5 → D6, urutan naik singkat
    for (let i = 0; i < notes.length; i++) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = notes[i]
      const start = t + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(start)
      osc.stop(start + 0.25)
    }
  } catch { /* audio gagal — abaikan */ }
}
