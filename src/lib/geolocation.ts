import { isNativePlatform } from './platform'

interface GeolocPos {
  latitude: number
  longitude: number
}

export interface GeolocError extends Error {
  code?: number
}

// Posisi pertama via watchPosition. Chrome desktop kadang memicu callback error
// (bahkan code 1 "User denied") SEBELUM posisi jaringan menyusul pada panggilan
// yang sama — karena itu jangan menyerah di error pertama: simpan error terakhir
// dan tetap tunggu sampai ada posisi nyata atau timeout keras.
function watchFirstPosition(opts: {
  enableHighAccuracy: boolean
  timeout: number
  maximumAge: number
}): Promise<GeolocPos> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err: GeolocError = new Error('GPS tidak didukung browser ini.')
      reject(err)
      return
    }

    const state: {
      done: boolean
      watchId?: number
      timer?: number
      lastCode?: number
      lastMessage: string
    } = { done: false, lastMessage: 'Gagal mengambil lokasi.' }

    const cleanup = () => {
      if (state.timer !== undefined) clearTimeout(state.timer)
      if (state.watchId !== undefined) navigator.geolocation.clearWatch(state.watchId)
    }

    state.watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (state.done) return
        state.done = true
        cleanup()
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude })
      },
      (e) => {
        state.lastCode = e.code
        state.lastMessage = e.message || state.lastMessage
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      },
    )

    state.timer = window.setTimeout(() => {
      if (state.done) return
      state.done = true
      cleanup()
      const err: GeolocError = new Error(state.lastMessage)
      err.code = state.lastCode
      reject(err)
    }, opts.timeout + 3000)
  })
}

export async function getCurrentPosition(opts?: {
  enableHighAccuracy?: boolean
  timeout?: number
}): Promise<GeolocPos> {
  if (isNativePlatform()) {
    // Dynamic import — plugin hanya tersedia di Capacitor build.
    const { Geolocation } = await import('@capacitor/geolocation')
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: opts?.enableHighAccuracy ?? true,
      timeout: opts?.timeout ?? 10000,
    })
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
  }

  const timeout = opts?.timeout ?? 10000
  try {
    return await watchFirstPosition({
      enableHighAccuracy: opts?.enableHighAccuracy ?? true,
      timeout,
      maximumAge: 0,
    })
  } catch (first) {
    const e = first as GeolocError
    console.error('Geolocation gagal (percobaan 1), mencoba ulang:', e.code, e.message)
    // Fallback: lokasi jaringan tanpa high accuracy — biasanya tersedia di
    // desktop walau fix GPS presisi tidak pernah datang.
    return watchFirstPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })
  }
}
