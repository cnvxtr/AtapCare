// Self-check Web Push: validasi format kunci VAPID + serialisasi payload.
// Tanpa dependency web-push (hanya dipakai di Edge Function). Jalankan:
//   node scripts/push.selfcheck.mjs
import { readFileSync, existsSync } from 'node:fs'

function loadEnv() {
  const out = {}
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
  return out
}

const failures = []
const key = loadEnv().VITE_VAPID_PUBLIC_KEY
if (!key) failures.push('VITE_VAPID_PUBLIC_KEY belum di-set di .env')
else {
  const b64 = key.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) failures.push('VITE_VAPID_PUBLIC_KEY bukan base64url')
  else {
    const buf = Buffer.from(b64, 'base64')
    if (!(buf.length === 65 && buf[0] === 4))
      failures.push('kunci publik salah: harus EC P-256 (65 byte, diawali 0x04)')
  }
}

const payload = JSON.stringify({ title: 'Selftest Atap Care', body: 'ok', url: '/' })
if (!payload.includes('Selftest Atap Care')) failures.push('payload gagal diserialisasi')

if (failures.length) {
  console.error('FAIL\n' + failures.join('\n'))
  process.exit(1)
}
console.log('OK — VAPID public key valid, payload siap dikirim ke send-push.')
