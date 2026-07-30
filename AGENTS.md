FINAL BLUEPRINT: ATAP CARE v3.0

Sistem Ticketing Keluhan — PT Atap Teknologi Indonesia

Versi: 3.0 (Final)

Tanggal: 27 Juli 2026

Status: Siap Development

Total Business Rules: 152 BR (lihat Dokumen BR v3.0)


## CATATAN TEKNOLOGI (FINAL):

Blueprint ini ditulis dalam istilah teknologi umum agar mudah dipahami seluruh stakeholder. Implementasi aktual menggunakan stack berikut:

Struktur APK: Satu aplikasi berisi portal guest (tanpa login) + portal internal (dengan login gate).

Catatan Proposal: Proposal KP awal menyebutkan Flutter + Firebase. Berdasarkan analisis kebutuhan lanjutan, stack direvisi menjadi React + Node.js + Supabase agar satu codebase dapat menghasilkan web dan APK Android sekaligus (lebih efisien). Revisi proposal wajib diajukan ke dosen pembimbing.

Seluruh aturan bisnis, alur kerja, dan spesifikasi fungsional TETAP BERLAKU regardless of platform (web maupun APK).


## BAGIAN 1: DESIGN SYSTEM

 1.1 Filosofi Desain

Arah Visual: "Monochrome Industrial"

- Dominan: Hitam, putih, dan abu-abu

- Aksen Fungsional:

  - 🔴 Merah: Destruktif/urgent (Void, P1/Kritis)

  - 🟡 Kuning: Peringatan (Pending, P2, SLA Warning)

  - 🟢 Hijau: Sukses (Closed, Resolved, Success Action)

  - 🔵 Biru/Abu: Informasi (P3, Arsip)

Prinsip Desain:

- Klaritas: Informasi prioritas, status, dan aksi harus langsung terbaca

- Kedalaman: Efek kaca (glassmorphism), grid halus, dan noise tekstur untuk dimensi tanpa warna berlebihan

- Konsistensi: Semua pengguna melihat UI yang sama, hanya hak akses yang membedakan

 1.2 Color System (CSS Variables oklch)

Catatan Penting:

- Priority Badge: P1 (merah), P2 (kuning), P3 (biru/abu)

- Status: Gunakan text/background pill, bukan warna yang sama dengan priority

- Dark Mode: Mengikuti pengaturan OS secara otomatis (BR-131)

- Larangan: Dilarang menggunakan warna hardcode di luar theme system

 1.3 Tipografi & Ikonografi

Font Family:

- Display / Heading (H1-H4): Space Grotesk (bold, letter-spacing: -0.02em)

- Body / UI: Inter (paragraf, label, tombol)

- Monospace: JetBrains Mono (ID Tiket, Serial Number, Timestamp, SLA countdown)

Ikon:

- Library: Lucide React (`lucide-react` package)

- Warna: `currentColor` (mengikuti konteks)

- Ukuran: 16px (inline), 20px (button), 24px (navigation)


## 1.4 Utilitas Visual & Efek Khusus


## BAGIAN 1.1: ARSITEKTUR ANTARMUKA (THE 3-TIER SYSTEM)

Setiap peran (selain Guest) wajib menggunakan arsitektur 3 Lapis (Tier) yang seragam agar navigasi tetap konsisten dan tidak membingungkan saat pengguna berganti peran.

TIER 1: Global Filter & KPI

Posisi: Baris paling atas (sticky)

Komponen:

- Filter Rentang Waktu Persisten:

  - [Hari Ini] [Minggu Ini] [Bulan Ini] [Custom Range]

  - Filter yang dipilih bersifat persisten selama sesi pengguna berlangsung

- Quick Filter:

  - Status (multi-select)

  - Prioritas (P1/P2/P3)

  - Site (dropdown)

  - Customer (dropdown)

  - Teknisi (dropdown)

  - SLA Status (Normal/Warning/Overdue)

- Ringkasan KPI (Card):

  - Tiket Baru (24 jam terakhir)

  - Sedang Diproses

  - Menunggu PM

  - Menunggu Validasi

  - SLA Warning (<20% sisa)

  - SLA Overdue

Fungsi: Analisis jangka panjang dan monitoring operasional real-time.

TIER 2: Area Operasional Utama

Prinsip: Tampilan disesuaikan dengan kebutuhan masing-masing role.

Metadata Wajib di Setiap Kartu/Baris:

- ID Tiket (monospace, clickable)

- Status (badge warna)

- Prioritas (badge: P1 merah, P2 kuning, P3 biru)

- Keluhan (truncate 50 karakter)

- Waktu Diterima (immutable, format: DD MMM YYYY, HH:mm)

- Target SLA (countdown timer jika aktif)

- Progress (visual indicator)

 TIER 3: Offcanvas Detail Drawer

Spesifikasi:

- Lebar: 90% (mobile), 40% (desktop)

- Posisi: Muncul dari kanan layar

- Bukan full-page agar pengguna tidak perlu menekan tombol Back

Konten Drawer:

```

┌─────────────────────────────────────────┐


## │  [X] ATC-20260724-X7K9                  │

│  Status: WORKING  |  Prioritas: P1 🔴   │

├─────────────────────────────────────────┤

│  TAB: [Detail] [Timeline] [Activity]    │

│                                         │


## │  ── TAB DETAIL ──                       │

│  Identitas Pelanggan                    │

│  Deskripsi Kendala                      │

│  Dokumentasi (Foto)                     │

│  Remote Support Notes (jika ada)        │

│  Catatan Internal (Helpdesk/PM/Admin/   │

│  Lead Engineer only)                    │

│                                         │


## │  ── TAB TIMELINE ──                     │

│  Visual timeline status changes         │

│                                         │


## │  ── TAB ACTIVITY LOG ──                 │

│  List: user, role, timestamp, action    │

├─────────────────────────────────────────┤

│  [Action Buttons - Dinamis per Role]    │

└─────────────────────────────────────────┘

```

State Machine Visual (di Tab Timeline):

Status Final:

- VOID (permanen)

- DUPLICATE (permanen)

- CLOSED (dapat di-reopen dalam 7 hari oleh Helpdesk)

Catatan Transisi:

Action Button (Dinamis berdasarkan Status & Role):


## BAGIAN 2: ARSITEKTUR DATABASE & KEAMANAN SISTEM

 2.1 Kalkulasi SLA (Backend Level)

Prinsip: Perhitungan SLA TIDAK menggunakan kolom otomatis pada database karena SLA dipengaruhi oleh:

- Jam operasional perusahaan (08.15–17.00 WIB)

- Hari operasional (Senin–Jumat)

- Hari libur nasional

- Status tiket (WORKING vs PENDING)

Implementasi:

- Seluruh perhitungan SLA wajib dilakukan oleh Backend Service (Node.js) yang mengacu pada konfigurasi sistem

- SLA dihitung secara real-time saat data ditampilkan, bukan disimpan sebagai kolom permanen

Konfigurasi SLA (Default):

- P1: 4 jam

- P2: 24 jam

- P3: 72 jam

Ketentuan:

- Administrator dapat mengubah target SLA melalui menu konfigurasi

- Seluruh perubahan tercatat di Activity Log (user, waktu, nilai sebelum, nilai sesudah)

- Waktu pada status NEW, OPEN, UNASSIGNED, SCHEDULED, EN_ROUTE tidak dihitung dalam SLA (BR-28D)


## 2.2 Mekanisme Penyimpanan Data (Auto-Save Draft)

Prinsip MVP: Pada fase MVP, sistem TIDAK menggunakan mekanisme offline-sync kompleks (IndexedDB/Service Worker).

Ketentuan:

- Auto-save setiap 10 detik saat mengisi form

- Tombol "Simpan & Lanjut Nanti" untuk kondisi sinyal lemah

- Draft expiry 24 jam

- Draft otomatis dihapus setelah berhasil submit atau setelah 24 jam

Capacitor Implementation (APK):


## 2.3 Activity Log dan Audit Trail

Prinsip: Seluruh aktivitas penting wajib dicatat secara otomatis. Activity Log bersifat immutable.

Struktur Data:

Aktivitas yang Wajib Dicatat:

- Perubahan status tiket (status sebelum & sesudah)

- Perubahan prioritas

- Perubahan SLA configuration

- Perubahan penugasan (assignee)

- Upload dokumentasi

- Perubahan konfigurasi sistem

- Perubahan Master Data

- Perubahan hak akses pengguna

- Login/logout

- Switch role

Flag/Tag Khusus:

- `REWORK`: Tiket kembali dari monitoring atau reopen

- `OVERTIME`: Penugasan di luar jam operasional

- `DUPLICATE`: Tiket ditandai duplikat

- `SELF-ASSIGNMENT`: PM assign ke diri sendiri

- `AUTO-CLOSE`: Ditutup otomatis (pelanggan tidak merespons 1×24 jam)

Akses:

- Admin & Helpdesk: seluruh Activity Log

- PM: seluruh Activity Log

- Teknisi: hanya tiket yang ditugaskan kepadanya

- Pelanggan: TIDAK dapat melihat Activity Log


## 2.4 Role Based Access Control (RBAC)

Role yang Tersedia:

Ketentuan:

- 1+ role per user, 1 Default Role saat login

- Switch Role hanya jika 1 role

- Lead Engineer = penugasan sementara oleh PM, bukan role login

- Perpindahan role mengubah: Dashboard, Menu, Hak akses, API endpoint, Data yang ditampilkan

Implementasi (Supabase Row Level Security):


## 2.5 Master Data

Entitas & Relasi:

```

```

- 1 pelanggan = banyak Site

- 1 Site = banyak Unit

- 1 Unit = hanya 1 Site

- 1 Tiket = 1 Unit

Field Wajib:

Ketentuan:

- PIC Utama & WA PIC pada Site WAJIB diisi (fondasi Auto-fill)

- Soft-delete (`is_deleted=true`), bukan hapus fisik

- Unit/Site dengan tiket aktif TIDAK BISA di-soft-delete (BR-75D)

- Seluruh perubahan tercatat di Activity Log

Supabase Tables:


## 2.6 Keamanan Data

Masking Data Sensitif:

- Nomor telepon: `0812-xxxx-xxxx` di tampilan yang tidak memerlukan info lengkap

- Data lengkap hanya untuk Helpdesk & Admin

Rate Limiting (BR-115B):

- API: maksimal 100 request/menit per user

- Upload: maksimal 10 file/menit per user

Proteksi Web (BR-115C):

- CSRF: Token per session untuk semua request POST/PUT/DELETE

- XSS: Sanitasi semua input, escape semua output

Kepatuhan UU PDP:

- Data pribadi masking setelah 6 bulan

- Data pribadi anonymize setelah 5 tahun

- Activity Log permanen, tidak pernah dihapus

Audit Trail:

Seluruh aktivitas berikut wajib tercatat:

- Perubahan konfigurasi, hak akses, Master Data, SLA, status tiket

- Upload/download dokumentasi

- Login/logout, Switch role

 2.7 Autentikasi & Manajemen Pengguna

 2.7.1 Autentikasi

Mekanisme Login:

- Username + Password (tanpa email)

- Username dibuat Admin. Format: huruf, angka, titik, underscore

- Password awal dibuat Admin

- Wajib ganti password pada login pertama

- Password hanya bisa di-reset Admin (user tidak bisa ganti sendiri) (BR-60K)

Password Policy:

- Minimal 8 karakter, kombinasi huruf dan angka

- Tidak boleh sama dengan 3 password terakhir

Session Management:

- Auto-logout setelah 30 menit tanpa aktivitas

- Multi-device diperbolehkan

- Tidak ada "Forgot Password" otomatis

 2.7.2 Navigasi User (Dropdown Avatar)

- Terletak di pojok kanan atas header

- Menampilkan: Avatar, Nama, Role aktif

- Tidak ada halaman Profil terpisah (BR-60O)

- Tidak ada halaman Settings umum (BR-130)

 2.7.3 Switch Role

Mekanisme:

- Switch Role hanya muncul jika user punya 1 role

- User tidak bisa ubah role sendiri (BR-60D-A)

- Saat Switch Role:

  1. Simpan draft form yang terbuka (BR-115)

  2. Tutup semua modal/drawer

  3. Reload ke Dashboard role baru

  4. Toast: "Role berubah menjadi [Nama Role]"

- Tombol aksi di Drawer dinamis berdasarkan role aktif (BR-111)

Backend:


## 2.8 Notifikasi

 2.8.1 Notifikasi In-App & Push Notification

Ketentuan:

- Web: In-App Badge + Supabase Realtime (channel subscription) atau polling 60 detik

- APK: Push Notification (FCM) yang berfungsi meski app background/closed (BR-115F)

- Tidak ada fallback SMS/WA otomatis di MVP

Struktur Data:

 2.8.2 Notifikasi WhatsApp (Click-to-Chat)

Prinsip: Click-to-Chat (`wa.me`) dengan template otomatis. Tidak ada integrasi WhatsApp API.

Template Kontak Awal:

Template Konfirmasi RESOLVED (Jalur B):

 2.9 Fitur Pendukung

 2.9.1 Pencarian & Filter

- Search: by ID Tiket, Nama Pelanggan, Site, Unit

- Filter: by Status, Prioritas, Tanggal, Assigned To

- Export CSV oleh Helpdesk & Admin

Implementasi (Supabase):

 2.9.2 Penanganan Error

Error Pages:

- 404: "Halaman tidak ditemukan." + [Kembali ke Dashboard]

- 500: "Sistem sedang dalam pemeliharaan. Hubungi Admin jika urgent." (tanpa stack trace)

- 401: "Sesi berakhir." + [Login & Pulihkan Draft]

- 403: "Akses ditolak." + [Kembali ke Dashboard]

Ketentuan:

- Tidak menampilkan error teknis kepada pengguna

- Pesan ramah dan actionable

- Log error teknis di backend (Node.js logging / Supabase logs)

 2.9.3 Platform & Teknis

Platform:

- Web Portal Pelanggan: React di `lapor.atapcare.ptatapi.co.id`

- Web Portal Internal: React di `app.atapcare.ptatapi.co.id`

- Mobile App (APK): React + Capacitor wrapper, target Android 8.0 (API 26)+

- iOS: Tidak termasuk MVP

Kompatibilitas Browser (BR-115A):

- Chrome (v90+), Firefox (v88+), Safari (v14+), Edge (v90+)

- Resolusi: 360px (mobile) hingga 1920px (desktop)

Mobile Optimization (Teknisi):

- Tombol aksi minimal 44×44px (touch-friendly)

- Upload foto: Capacitor Camera plugin (kamera belakang)

- Font size minimal 16px untuk input field

Dashboard Polling:

- Web: Supabase Realtime (channel subscription) atau polling 60 detik

- APK: Push Notification (FCM) + Supabase Realtime listener

- Tidak menggunakan WebSocket

Timestamp & Timezone:

- Database: UTC

- Backend: konversi ke WIB (UTC+7)

- Frontend: hanya tampilkan `DD MMM YYYY, HH:mm WIB`

- Semua timer (SLA, monitoring, auto-close, reopen) pakai waktu server

Deteksi Platform (React + Capacitor):


## BAGIAN 3: ALUR KERJA (WORKFLOW ROLE)


##  ROLE 0: PORTAL PELANGGAN (GUEST PORTAL)

Portal publik diakses melalui subdomain `lapor.atapcare.ptatapi.co.id`. Tampilan sangat minimalis, tidak ada menu navigasi lain selain [Buat Laporan], [Lacak Tiket], dan link footer (Privacy Policy & Terms of Service).

 3.0.1 Landing Page

```

┌─────────────────────────────────────┐


## │  🏢 ATAP CARE                       │

│  Sistem Ticketing Keluhan           │

├─────────────────────────────────────┤

│                                     │

│  [Buat Laporan]  [Lacak Tiket]      │

│                                     │

│  ─────────────────────────────────  │

│                                     │

│  [Form / Halaman Lacak]             │

│                                     │

├─────────────────────────────────────┤

│  Privacy Policy | Terms of Service  │

│  © 2026 PT Atap Teknologi Indonesia │

└─────────────────────────────────────┘

```

 3.0.2 Form Pelaporan

Validasi:

- Semua field wajib terisi

- WA format valid (regex)

- Foto dikompresi client-side (target <500KB)

- Validasi file di client-side + server-side (BR-112)

Anti-Duplikasi:

- Debounce tombol submit (disabled setelah klik pertama)

Catatan (BR-115E):

 Jika Site atau Unit pelanggan belum terdaftar di Master Data, pelanggan tidak dapat submit via portal. Pelanggan harus menghubungi Helpdesk via WhatsApp Group. Helpdesk membuat Tiket Internal sekaligus mendaftarkan Site/Unit baru.

Setelah Submit:


## 1. Generate ID: `ATC-[YYYYMMDD]-[4 KARAKTER ACAK]` (anti-tebak)


## 2. Catat timestamp WIB


## 3. Status: NEW


## 4. Sumber: "Portal Publik"

Halaman Konfirmasi:

```

┌─────────────────────────────────────┐

│                                     │

│  ID Tiket: ATC-20260724-X7K9        │

│  [Salin ID]                         │

│                                     │

│  Simpan ID ini untuk pelacakan.     │

│                                     │

│  Sudah punya ID Tiket?              │

└─────────────────────────────────────┘

```

 3.0.3 Pelacakan Tiket

Input: ID Tiket saja (satu field)

Output (jika ditemukan):

```

┌─────────────────────────────────────┐


## │  ATC-20260724-X7K9                  │

│  Status: Sedang Diperbaiki          │

│  Terakhir Update: 24 Jul 2026, 14:30│

│  Teknisi: Dedy Ardiansyah           │

└─────────────────────────────────────┘

```

Output (jika tidak ditemukan):

 "ID Tiket tidak ditemukan. Periksa kembali nomor tiket Anda."

Data yang Ditampilkan: Status (bahasa pelanggan), Waktu Update, Nama Teknisi

Data yang TIDAK Ditampilkan: Activity Log, catatan teknisi, BAST, Catatan Internal

Batasan:

- Pelanggan tidak bisa ubah data setelah submit

- Pelanggan tidak bisa tambah info (hubungi Helpdesk via WA Group)

- Pelanggan hanya bisa lacak tiket yang ID-nya diketahui (BR-08G)


## ROLE 1: HELPDESK (KUSTIARA)

Gerbang utama seluruh tiket masuk. Validasi, remote support, prioritas, eskalasi, validasi penyelesaian, penutupan.

 3.1.1 Dashboard Helpdesk

Tier 1: Filter waktu + Quick Filter + KPI Cards (Tiket Baru, Diproses, Menunggu PM, Validasi, SLA Warning, Overdue)

Tier 2: Tabel tiket

Tier 3: Drawer Detail (lihat BAGIAN 1.1)

 3.1.2 Menu Inbox Ticket

Status: NEW, OPEN

Fitur: Search, Filter, Sort, Bulk Select, Export CSV

Action: Validasi, Void (wajib alasan), Duplicate (pilih tiket utama), Open Ticket

 3.1.3 Menu Validasi Tiket

Melihat: Detail Pelapor (WA masked), Detail Unit, Foto, Riwayat Tiket

Aksi:

 3.1.4 Menu Remote Support

Field: Media (WA/Telepon/VC), Catatan, Durasi (menit), Hasil

Outcome Berhasil:

```

├─ Jalur A: [Pelanggan Sudah Konfirmasi]

│

└─ Jalur B: [Kirim Konfirmasi via WA]

```

Outcome Gagal (BR-15A):

```

```

 3.1.5 Menu Eskalasi Lapangan

Status: UNASSIGNED (sudah diekalasi)

Helpdesk: View only (monitoring prioritas & catatan eskalasi)

 3.1.6 Menu Tiket Internal

Koreksi Data Setelah Submit (BR-12J s.d. BR-12L):

Momen Eskalasi / Selesai Remote (review-gate): sebelum commit, muncul layar ringkasan data identitas dengan [Edit dulu] (balik ke form editable) dan [Ya, Lanjutkan]. Ini kesempatan koreksi terakhir sebelum data keluar — menutup kasus "langsung eskalasi tanpa sempat edit".

Matriks Editability Tiket Internal (field identitas):

Quick Action:

 3.1.7 Menu Monitoring Tiket

Status: UNASSIGNED, SCHEDULED, EN_ROUTE, WORKING, PENDING

Helpdesk: View only. Bisa lihat: Progress, SLA, Teknisi, Activity Log.

 3.1.8 Menu Validasi Penyelesaian

Status: RESOLVED

Periksa: Foto hasil, BAST ditandatangani, Catatan Teknisi, Sparepart

Action:

- [Close Ticket]:

- [Return for Rework]:

  - Wajib alasan

 3.1.9 Menu Arsip Tiket

Status: CLOSED, VOID, DUPLICATE

Fitur: Search, Filter, Export CSV, View Detail (Read Only)

Ketentuan: CLOSED bisa reopen 7 hari. VOID & DUPLICATE final permanen.

 3.1.10 Menu Activity Log

Read Only. Filter: User, Role, Tanggal, Jenis Aktivitas.

 3.1.11 Menu Dashboard SLA

Widget: SLA Warning, SLA Overdue, Rata-rata Penyelesaian, Tiket per Prioritas/Site/Customer, FRT


## ROLE 2: PROJECT MANAGER (ADITYA)

Orkestrator lapangan. Assign teknisi, jadwal, re-assignment, approval kendala.

 3.2.1 Command Center & Dispatch Board

Tier 1: Filter (Waktu, Site, Teknisi, Prioritas)

Tier 2 (Dual Mode Toggle):

Mode Kanban:

- 6 kolom: UNASSIGNED, SCHEDULED, EN_ROUTE, WORKING, PENDING, RESOLVED

- Drag-and-drop

- Pulse-ring merah untuk P1 atau SLA Overdue

- Kartu: ID, Prioritas, Customer, Site, SLA countdown

Mode Smart Table:

- Checkbox + Bulk Assign ke satu teknisi

- Kolom: Checkbox, ID, Customer, Site, Unit, Prioritas, Status, SLA

 3.2.2 Alur Penugasan & Lembur

Penugasan Normal:

```

```

Penugasan Lembur:

```

Jika jadwal di luar 08.15-17.00 atau hari libur:

→ Pop-up "⚠️ Berpotensi Lembur"

```

 3.2.3 Alur Re-Assignment

```

PM buka Drawer tiket SCHEDULED/EN_ROUTE

```

 3.2.4 Alur Kendala Lapangan (Pending)

 3.2.5 Alur Handover

```

```


## ROLE 3: TEKNISI LAPANGAN (DEDY, HILMAN, ET AL)

Fokus, linier, tangguh terhadap sinyal lemah. Navigasi sederhana.

 3.3.1 Dashboard Tugas (Task List)

```

┌─────────────────────────────────────┐

│  Tugas Hari Ini - 24 Jul 2026       │

├─────────────────────────────────────┤

│  ┌───────────────────────────────┐  │


## │  │ ATC-20260724-X7K9    P1 🔴   │  │

│  │ ASDP - Ambon | VMS Unit 5   │  │

│  │ Status: SCHEDULED | 08:00    │  │

│  │ [Terima Tugas]               │  │

│  └───────────────────────────────┘  │

│  ┌───────────────────────────────┐  │


## │  │ ATC-20260724-M2P4    P2 🟡   │  │

│  │ INTANK - PAMA | Sensor 3    │  │

│  │ Status: EN_ROUTE             │  │

│  │ [Mulai Kerja]                │  │

│  └───────────────────────────────┘  │

└─────────────────────────────────────┘

```

Ketentuan:

- Hanya tiket yang di-assign ke teknisi tersebut

- Pulse-ring merah untuk P1

- Banner kuning jika offline: "Mode Offline - Data disimpan lokal"

 3.3.2 Alur Eksekusi (4-Langkah Linier)

Langkah 1: [Terima Tugas]

- Push Notification (FCM) ke HP teknisi

- Jika lembur: pop-up persetujuan lembur sebelum status berubah

Langkah 2: [Mulai Kerja]

- SLA mulai dihitung

- WAJIB rekam GPS (latitude, longitude) sebagai bukti kehadiran (BR-39A)

- Jika GPS gagal/ditolak: status TIDAK BISA berubah ke WORKING

- Error: "Lokasi gagal ditangkap. Aktifkan GPS dan coba lagi."

Langkah 3: [Ajukan Pending] (Opsional)

Langkah 4: [Selesaikan Tugas & Unggah BAST]

- Buka kamera belakang (Capacitor Camera plugin)

- Upload: (1) Foto hasil perbaikan, (2) Foto Serial Number, (3) Foto BAST ditandatangani

- Kompresi <500KB, max 10MB per file, max 10 foto

- Isi catatan hasil + sparepart (jika ada)

- Notifikasi ke Helpdesk

Multi-Teknisi:

- 1 teknisi: teknisi tersebut bisa [Selesai]

- 1 teknisi: hanya Lead Engineer bisa [Selesai]

- Teknisi pendukung: upload foto + tambah catatan saja

Capacitor Camera Implementation:

Capacitor Geolocation Implementation:

 3.3.3 Penyimpanan Data

- Auto-save draft setiap 10 detik

- Tombol "Simpan & Lanjut Nanti"

- Draft di `localStorage` (web) / Capacitor Preferences (APK), expiry 24 jam

- Tidak menggunakan IndexedDB / Service Worker / offline-sync kompleks


## ROLE 4: ADMIN PERUSAHAAN (RAHMADINA)

Pusat kontrol konfigurasi, kepatuhan, dan kebersihan Master Data.

 Catatan UX:

 - TIDAK ada menu "Settings" umum (BR-130). Konfigurasi dipecah menjadi menu spesifik.

 - TIDAK memiliki kewenangan operasional tiket (BR-60P). Admin tidak bisa validasi, assign, close, reopen. Jika perlu, gunakan Switch Role ke Helpdesk/PM.

Menu Sidebar Admin:

- 📊 Dashboard (System Health + Performa)

- 👥 Manajemen Pengguna

- 🏢 Master Data

- 📦 Arsip Lanjutan

- 📋 Activity Log

 3.4.1 System Health & Performa Operasional

Tab 1: Kesehatan Sistem

- Jumlah user online

- Riwayat audit (last 24h)

- Storage usage

- Error log (last 24h)

Tab 2: Performa Operasional

- Tiket lewat SLA (per prioritas)

- Performa teknisi (tiket selesai per teknisi)

- Akumulasi jam lembur (export CSV)

- FRT rata-rata

- Tiket per Prioritas / Site / Customer

Semua terikat Filter Rentang Waktu di Tier 1.

 3.4.2 Manajemen Pengguna

Tabel:

Form Tambah/Edit:

- Nama Lengkap (wajib)

- Username (wajib, unik)

- Password Awal (saat tambah baru)

- No WhatsApp (wajib)

- Role (multi-select: Helpdesk/PM/Teknisi/Admin)

- Default Role (dropdown)

- Status (Aktif/Cuti/Nonaktif)

Aturan:

- Tidak ada hapus permanen (soft)

- Password hanya Admin yang reset (BR-60K)

 3.4.3 Master Data

Field Site (wajib semua):

- Nama Site, Alamat, Nama PIC Utama, No WA PIC Utama, Customer

Soft-delete:

- Flag `is_deleted=true`, tidak hapus fisik

- Unit/Site dengan tiket aktif TIDAK BISA di-soft-delete (BR-75D)

- Peringatan: "Unit/Site ini masih memiliki X tiket aktif."

 3.4.4 Konfigurasi SLA & Laporan Lembur


## SLA:

Libur Nasional:

- Saklar [Libur Nasional] + pilih tanggal

- SLA global beku pada tanggal tersebut

Laporan Lembur:

- Export CSV, filter: Teknisi, Tanggal, Prioritas

 3.4.5 Pengarsipan & Retensi Data

Ketentuan:

- Activity Log permanen

- Master Data tidak diarsipkan (soft-delete)

- KPI kumulatif, filter rentang waktu

- Filter = tampilan saja, tidak hapus data

- Cron Job: harian 02.00 WIB (node-cron / Supabase pg_cron)

- Masking 6 bulan, anonymize 5 tahun (UU PDP)


## LAMPIRAN

 A. State Machine Lengkap

Final Permanen: VOID, DUPLICATE

Final Bersyarat: CLOSED (7 hari)

Transisi Balik (PM only, wajib alasan):

Rework (Helpdesk, flag REWORK):

```

 B. Daftar Business Rules

Bussines Role

TTotal: 152 Business Rules (BR-01 s.d. BR-133, termasuk sub-BR).

C. Halaman Error, States, & Komponen UI


## 1. Error Pages:

- 404: Halaman tidak ada + [Kembali ke Dashboard]

- 500: "Sistem sedang perbaikan" (tanpa stack trace)

- 401: Sesi habis + [Login & Pulihkan Draft]

- 403: Akses ditolak + [Kembali ke Dashboard]


## 2. Empty States (BR-132):

- Inbox kosong, Hasil pencarian tidak ditemukan, Arsip kosong, Tidak ada notifikasi

- Ilustrasi sederhana + pesan informatif + tombol aksi (jika relevan)


## 3. Loading States (BR-132):

- Skeleton Loader: Tabel dan kartu saat data di-fetch

- Spinner: Tombol submit (anti double-click)

- Progress Bar: Upload foto BAST/dokumentasi


## 4. Toast Notifications:

- ⚠️ Warning (Kuning): "Koneksi lemah, draft tersimpan"

- ℹ️ Info (Biru): "Draft tersimpan otomatis"


## 5. APK-Specific UI (BR-133):

- Splash Screen saat launch

- Bottom Navigation (Dashboard, Tiket, Notifikasi, Logout)

- Push Notification (FCM)

- Web Internal menggunakan Sidebar Navigation + In-App Badge

 D. Priority Decision Matrix

 F. Supabase (PostgreSQL) Database Schema