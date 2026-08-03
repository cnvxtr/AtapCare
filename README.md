# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

# Supabase Ops (Free Tier)

Catatan operasional untuk Supabase **Free Plan** (500 MB database, 1 GB file storage, 5 GB bandwidth/bln). Volume tiket kecil (<5/minggu ≈ 260/tahun), jadi kapasitas bukan masalah — yang diurus hanya 3 hal: anti-pause, backup, dan kebijakan foto.

## 1. Keep-Alive (cegah auto-pause 7 hari)

Free tier **mem-pause proyek setelah 7 hari tanpa traffic API**. Untuk trial/demo yang dipakai sporadis, ini risiko #1 — app mati tepat saat presentasi.

Solusi: cron gratis di [cron-job.org](https://cron-job.org) memanggil Supabase tiap **2 hari** (satu ping < 7 hari = proyek tidak pernah dianggap sepi).

Langkah setup (sekali, 5 menit):
1. Daftar di cron-job.org.
2. **Create Cronjob** → URL:
   `https://<project-ref>.supabase.co/rest/v1/tickets?select=id&limit=1`
3. **Interval**: every 2 days.
4. **Headers** → tambah: `apikey: <anon-key>` (dan opsional `Authorization: Bearer <anon-key>`).
5. Save → **Test run** → harus `200 OK`. Aktifkan notifikasi email cron-job.org.

Peringatan:
- **Gunakan `anon-key` saja. JANGAN pernah service role key** di cron-job.org — anon key memang public, service role adalah kunci admin rahasia.
- Query read-only (`select=id&limit=1`) — tidak bisa mengubah data. Jika RLS aktif dan anon tanpa akses baca, balas `[]` — tetap dihitung traffic, tetap bekerja.
- Kalau ping gagal (merah): proyek sempat pause → buka dashboard Supabase → **Restore** sekali → keep-alive menjaganya lagi.

## 2. Backup Rutin (free tier TIDAK ada backup harian)

Risiko nyata kedua: data hilang tanpa backup otomatis.

- **Baseline sekali sekarang**: export seluruh data dari dashboard Supabase (SQL Editor / Database section), simpan filenya.
- **Ritme**: 1×/bulan, atau minimal **sebelum tiap demo/presentasi** (data kecil, 1 menit).
- Tidak ada otomatisasi di MVP; volume tidak butuh.

## 3. Kebijakan Retensi

- **Data tiket (teks): simpan selamanya.** Volume ±1 MB/tahun, jauh dari 500 MB. Ini bahan KPI & laporan SLA.
- **Activity Log: permanen, tidak pernah dihapus** (UU PDP).
- **Tidak ada cron/hapus data.** Hard-delete tiket hanya merusak audit trail dan KPI.
- Data pribadi: masking setelah 6 bulan, anonymize setelah 5 tahun (UU PDP) — implementasi menyusul.

## 4. Kebijakan Foto

- Maks **5 foto/tiket**.
- File mentah diterima hingga **10 MB/file**; **dikompres client-side target <500 KB/foto** (foto 1 MB dikompres jadi ±400 KB — **jangan ditolak**, kamera HP biasanya 3-8 MB).
- Estimasi: 5 foto × ~500 KB ≈ 2,5 MB/tiket → 260 tiket/tahun ≈ 650 MB/tahun → Storage 1 GB bertahan **±1,5 tahun**.
- Setelah itu: purge foto tua (>5 tahun, sinkron anonymize UU PDP) — baris data tetap, file dihapus; atau pindah ke storage murah (Cloudflare R2 10 GB gratis), DB hanya simpan URL.
- Implementasi kompresi + upload menyusul bersama fitur upload foto (belum dikerjakan — foto saat ini belum di-upload).

## 5. Jalur Upgrade (kalau jadi produksi)

Upgrade ke **Pro $25/bln** → 8 GB database, 100 GB storage, daily backup, tanpa auto-pause. **Tanpa perubahan kode** — proyek yang sama, cuma plan-nya ganti. Upgrade hanya saat dibutuhkan (produksi sungguhan); selama trial, gratis cukup.
