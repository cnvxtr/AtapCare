# Atap Care — Dokumen Design System

**Proyek:** Sistem Ticketing Komplain & Integrasi Inventaris (Atap Care)
**Perusahaan:** PT Atap Teknologi Indonesia
**Tema:** Monochrome Industrial — hitam, putih, abu + aksen semantik minimal
**Versi:** 1.0 · Juli 2026

> Dokumen ini adalah spesifikasi lengkap agar desain dapat direplikasi di proyek lain
> (Figma, React lain, atau framework apa pun) tanpa membaca kode aslinya.

---

## 1. Filosofi Desain

| Prinsip | Penjelasan |
|---|---|
| Monokrom dulu | Warna hanya untuk *status*, bukan dekorasi. Hitam = aksi utama. |
| Kontras sebagai hirarki | Tidak pakai warna untuk menonjolkan; pakai `foreground` pekat vs `muted-foreground`. |
| Border tipis, radius besar | 1px border netral + radius 12–20px = kesan presisi/industrial. |
| Data-dense tapi lapang | Padding tabel kecil (12–16px), tapi jarak antar-blok besar (24px). |
| Efek halus | Glassmorphism, blur, pulse — tidak pernah gradien warna-warni. |

Yang **dilarang**: gradien ungu/indigo, warna brand jenuh sebagai latar besar, font default (Poppins), ikon multi-warna, shadow tebal berwarna.

---

## 2. Sistem Warna

Semua warna didefinisikan dalam **OKLCH** sebagai CSS custom property. Hex hanya referensi visual.

### 2.1 Light mode (default)

| Token | OKLCH | Hex ≈ | Dipakai untuk |
|---|---|---|---|
| `--background` | `oklch(0.985 0 0)` | `#FAFAFA` | Latar halaman |
| `--foreground` | `oklch(0.145 0 0)` | `#0A0A0A` | Teks utama, tombol primary bg |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Panel, kartu, sidebar, tabel |
| `--card-foreground` | `oklch(0.145 0 0)` | `#0A0A0A` | Teks di atas kartu |
| `--primary` | `oklch(0.145 0 0)` | `#0A0A0A` | Aksi utama (tombol hitam) |
| `--primary-foreground` | `oklch(0.985 0 0)` | `#FAFAFA` | Teks di atas primary |
| `--secondary` / `--muted` | `oklch(0.955 0 0)` | `#F0F0F0` | Chip, header tabel, badge netral |
| `--muted-foreground` | `oklch(0.48 0 0)` | `#5D5D5D` | Teks sekunder, label, placeholder |
| `--accent` | `oklch(0.93 0 0)` | `#E8E8E8` | Hover row / hover nav |
| `--border` | `oklch(0.9 0 0)` | `#DEDEDE` | **Semua garis pemisah & outline kartu** |
| `--input` | `oklch(0.92 0 0)` | `#E4E4E4` | Border field input |
| `--ring` | `oklch(0.145 0 0)` | `#0A0A0A` | Focus ring |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `#E7000B` | SLA breach, P1, hapus |
| `--success` | `oklch(0.68 0.15 155)` | `#32B36E` | Resolved/Closed, stok aman |
| `--warning` | `oklch(0.78 0.16 75)` | `#F2A618` | SLA mendekati, stok menipis |

### 2.2 Dark mode (`.dark`)

| Token | OKLCH | Hex ≈ |
|---|---|---|
| `--background` | `oklch(0.13 0 0)` | `#070707` |
| `--foreground` | `oklch(0.985 0 0)` | `#FAFAFA` |
| `--card` / `--popover` | `oklch(0.17 0 0)` | `#0F0F0F` |
| `--primary` | `oklch(0.985 0 0)` | `#FAFAFA` (inversi) |
| `--primary-foreground` | `oklch(0.145 0 0)` | `#0A0A0A` |
| `--secondary` / `--muted` | `oklch(0.22 0 0)` | `#1B1B1B` |
| `--muted-foreground` | `oklch(0.68 0 0)` | `#989898` |
| `--accent` | `oklch(0.27 0 0)` | `#262626` |
| `--border` | `oklch(1 0 0 / 12%)` | putih 12% alpha |
| `--input` | `oklch(1 0 0 / 15%)` | putih 15% alpha |
| `--destructive` | `oklch(0.704 0.191 22.216)` | `#FF6467` |
| `--success` | `oklch(0.72 0.17 155)` | `#22C373` |
| `--warning` | `oklch(0.82 0.17 75)` | `#FFB113` |

> **Aturan border:** di light mode border adalah abu solid `#DEDEDE`; di dark mode border **tidak pernah** abu solid, selalu putih transparan 12% agar menyatu dengan kaca.

### 2.3 Pemetaan warna status tiket

| Status / kondisi | Latar | Teks | Border |
|---|---|---|---|
| NEW / OPEN | `muted` | `foreground` | `border` |
| UNASSIGNED | transparan | `destructive` | `destructive` 40% |
| SCHEDULED / EN_ROUTE / WORKING | `muted` | `foreground` | `border` |
| PENDING | `warning` 15% | `warning` | `warning` 40% |
| RESOLVED / CLOSED | `success` 15% | `success` | `success` 40% |
| VOID / DUPLICATE | transparan | `muted-foreground` | `border` (dashed) |
| Prioritas P1 | `destructive` | `destructive-foreground` | — |
| Prioritas P2 | `warning` 20% | `warning` | `warning` 40% |
| Prioritas P3 | `muted` | `muted-foreground` | `border` |

Formula transparansi memakai `color-mix(in oklab, var(--token) 15%, transparent)`.

---

## 3. Tipografi

| Peran | Font | Fallback | Sumber |
|---|---|---|---|
| Display / heading (`--font-display`) | **Space Grotesk** 500/600/700 | ui-sans-serif, system-ui | Google Fonts |
| Body / UI (`--font-sans`) | **Inter** 400/500/600/700 | ui-sans-serif, system-ui | Google Fonts |
| Angka, kode, SN, ID tiket (`--font-mono`) | **JetBrains Mono** 400/500 | ui-monospace | Google Fonts |

Heading `h1–h4` memakai Space Grotesk dengan `letter-spacing: -0.02em`.

### Skala teks

| Nama | Ukuran | Weight | Tracking | Contoh |
|---|---|---|---|---|
| Page title | 30px (`text-3xl`) | 700 display | -0.02em | "Master Data" |
| Section title | 18–20px | 600 display | -0.01em | Judul kartu |
| Body | 14px (`text-sm`) | 400–500 | normal | Isi tabel |
| Small | 12px (`text-xs`) | 400–500 | normal | Sel tabel, tombol kecil |
| Micro / label | 10–11px | 500 | `0.1em` uppercase | "WORKSPACE", header tabel |
| Mono chip | 10–12px | 500 mono | normal | `TKT-00124`, `SN-88213` |

Label micro **selalu** `uppercase tracking-widest text-muted-foreground`.

---

## 4. Spasi, Radius, Elevasi

- **Grid spasi:** kelipatan 4px. Nilai umum: 4, 6, 8, 12, 16, 20, 24, 32.
- **Padding halaman:** 24px (`p-6`); header halaman `pt-8 pb-6`.
- **Radius:** basis `--radius: 0.75rem` (12px).
  - `sm` 8px (badge, kbd) · `md` 10px · `lg` 12px (tombol, input, nav item) · `xl` 16px (panel kecil) · `2xl` 20px (kartu utama, tabel).
- **Border:** selalu `1px solid var(--border)`. Tidak ada border 2px kecuali focus ring.
- **Shadow:** sangat minim — `shadow-sm` untuk item nav aktif; kedalaman diciptakan oleh border + blur, bukan shadow.

---

## 5. Layout

| Elemen | Spesifikasi |
|---|---|
| Sidebar | lebar 256px, `bg-card`, border kanan 1px, sticky full-height, disembunyikan < lg |
| Header atas | tinggi 64px, sticky `top-0`, `bg-background/80` + `backdrop-blur-xl`, border bawah |
| Tier-1 filter bar | sticky `top-16` (tepat di bawah header) |
| Page header | gradien vertikal `from-card to-background`, border bawah |
| Konten | `p-6`, lebar penuh sisa |
| Drawer detail (Tier 3) | offcanvas kanan, lebar 480–560px, `bg-card`, overlay hitam 40% + blur |

Breakpoint: `md` 768px (search bar muncul), `lg` 1024px (sidebar muncul), `xl` 1280px (chip role aktif muncul).

---

## 6. Komponen

### Tombol
| Varian | Style |
|---|---|
| Primary | `h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90` |
| Secondary | `h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent` |
| Icon | `h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent` |
| Destructive | `border border-destructive/40 text-destructive hover:bg-destructive/10` |

Transisi: `transition-all` durasi default 150ms.

### Kartu
`rounded-2xl border border-border bg-card overflow-hidden`. Tanpa shadow.

### Tabel
- Head: `bg-muted/60`, teks `text-[10px] uppercase tracking-widest text-muted-foreground`, `px-4 py-3`.
- Row: `border-t border-border`, hover `bg-accent/40`, sel `px-4 py-3 text-xs`.
- Baris arsip: `opacity-50` + badge `ARCHIVED` outline.

### Badge
`text-[10px] font-mono px-1.5 py-0.5 rounded` dengan pemetaan warna pada §2.3.

### Input / Select
`h-9 px-3 rounded-lg border border-input bg-card text-sm`, focus `ring-2 ring-ring/20 border-ring`.

### Nav item
Aktif: `bg-foreground text-background shadow-sm`. Idle: `text-muted-foreground hover:bg-accent hover:text-foreground`. Semua `rounded-lg px-3 py-2 text-sm font-medium`, ikon 16px.

---

## 7. Efek & Animasi

| Utility | Definisi |
|---|---|
| `glass` | `background: color-mix(in oklab, var(--card) 70%, transparent)` + `backdrop-filter: blur(20px) saturate(140%)` + border 1px |
| `grid-bg` | dua linear-gradient garis 1px, `foreground` 4%, ukuran 48×48px |
| `noise-overlay` | `::before` SVG feTurbulence, opacity 0.035 |
| `shimmer` | gradien horizontal `foreground` 8%, 200% width, animasi 2.4s linear infinite |
| `float-slow` | translateY 0 → -8px, 6s ease-in-out infinite |
| `pulse-ring` | box-shadow menyebar 0→12px warna `destructive`, 2s infinite (badge alert & notifikasi) |

Prinsip animasi: durasi 150–250ms untuk interaksi, 2–6s untuk ambient. Tanpa bounce/spring berlebihan.

---

## 8. Aksesibilitas

- Kontras teks utama vs latar ≥ 15:1; `muted-foreground` vs `background` ≈ 6.4:1 (lolos AA).
- Focus ring wajib terlihat: `ring-2` warna `--ring`.
- Warna status selalu didampingi teks/ikon (tidak mengandalkan warna saja).
- Target sentuh minimum 32×32px (desktop), 44×44px (mobile teknisi).
- Nomor WA di-mask secara default; role tertentu saja yang boleh melihat penuh.

---

## 9. Implementasi cepat di proyek lain

1. Salin blok `:root` dan `.dark` pada §2 ke CSS global.
2. Muat font via `<link>` Google Fonts:
   `Inter:wght@400;500;600;700`, `Space+Grotesk:wght@500;600;700`, `JetBrains+Mono:wght@400;500`.
3. Set `--radius: 0.75rem`.
4. Terapkan `border-color: var(--border)` global pada `*`.
5. Gunakan token semantik saja di komponen — jangan pernah menulis `text-white`, `bg-black`, atau hex langsung.
