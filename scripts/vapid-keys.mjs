// Generate kunci VAPID (EC P-256) untuk Web Push — tanpa dependency web-push.
// Jalankan: node scripts/vapid-keys.mjs
// Output siap-tempel: VITE_VAPID_PUBLIC_KEY (untuk .env) + VAPID_PRIVATE_KEY
// (untuk Dashboard → Edge Functions → send-push → Secrets).
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

// Kunci publik VAPID = base64url(0x04 || X || Y), bukan gabungan string x+y.
const xBuf = Buffer.from(pub.x, 'base64url')
const yBuf = Buffer.from(pub.y, 'base64url')
const raw = Buffer.concat([Buffer.from([4]), xBuf, yBuf])
const publicB64 = raw.toString('base64url')
const privateB64 = priv.d

// ── Self-check: decode ulang & verifikasi konsistensi ──
const pubBuf = Buffer.from(publicB64, 'base64url')
const privBuf = Buffer.from(privateB64, 'base64url')
if (pubBuf.length !== 65 || pubBuf[0] !== 4) throw new Error('public key invalid')
if (privBuf.length !== 32) throw new Error('private key invalid')
if (!pubBuf.subarray(1, 33).equals(xBuf) || !pubBuf.subarray(33, 65).equals(yBuf))
  throw new Error('public key mismatch')

console.log('VITE_VAPID_PUBLIC_KEY=' + publicB64)
console.log('VAPID_PRIVATE_KEY=' + privateB64)
console.log('VAPID_SUBJECT=mailto:ops@atapcare.id')
