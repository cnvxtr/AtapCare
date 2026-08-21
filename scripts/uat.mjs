import ExcelJS from "exceljs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const ROWS = [
  // [Modul, Skenario UAT, Langkah Pengujian, Hasil Diharapkan]
  ["A. PORTAL PUBLIK", "Landing page tampil tanpa login", "Buka halaman utama (/). Scroll seluruh halaman.", "Statistik, alur 6 langkah layanan, FAQ, panduan kendala umum, dan kontak tampil. FAQ menampilkan target SLA sesuai konfigurasi."],
  ["A. PORTAL PUBLIK", "Halaman Privacy & Terms", "Buka /privacy dan /terms.", "Kedua halaman tampil normal tanpa error."],
  ["A. PORTAL PUBLIK", "Halaman 404", "Ketik URL acak yang tidak ada.", "Halaman 'Tidak Ditemukan' tampil, bukan error mentah."],
  ["B. LAPOR KENDALA", "Kirim tiket valid", "Buka /report, isi nama, posisi, no HP, site, unit, deskripsi. Klik kirim.", "Muncul ID tiket ATC-YYYYMMDD-XXXX. Tiket masuk sistem dan timeline 'Tiket dibuat' tercatat."],
  ["B. LAPOR KENDALA", "Validasi field wajib", "Kosongkan salah satu field wajib lalu kirim.", "Muncul pesan field wajib. Tiket TIDAK terkirim."],
  ["B. LAPOR KENDALA", "Upload foto pelaporan", "Lampirkan beberapa foto (JPG/PNG) lalu kirim tiket.", "Foto terunggah ke Storage dan tampil di detail tiket."],
  ["B. LAPOR KENDALA", "Rate limit per nomor WA", "Kirim 3 tiket dengan no HP sama dalam 10 menit, lalu kirim tiket ke-4.", "Tiket 1-3 sukses. Tiket ke-4 ditolak dengan pesan rate limit."],
  ["C. PELACAKAN", "Lacak tiket dengan kode valid", "Buka /track, masukkan kode tiket yang valid (atau buka /track?ticket=<kode>).", "Status, site, unit, waktu update, dan nama teknisi tampil. Timeline transisi status tampil."],
  ["C. PELACAKAN", "Lacak dengan kode salah", "Masukkan kode tiket acak/tidak ada.", "Muncul pesan 'tidak ditemukan' + tautan WhatsApp bantuan."],
  ["C. PELACAKAN", "Timeline publik", "Buka timeline tiket yang sudah berproses.", "Aksi (dibuat, perubahan status, catatan tim, foto bukti) tampil. Tidak ada data pribadi sensitif."],
  ["D. LOGIN & ROLE", "Login sesuai role", "Login bergantian sebagai helpdesk, admin, teknisi, dan PM.", "Redirect benar: helpdesk ke /dashboard, admin ke /admin, teknisi ke /tugas, PM ke /dashboard."],
  ["D. LOGIN & ROLE", "Password salah", "Login dengan password yang salah.", "Muncul pesan error, tetap di halaman login."],
  ["D. LOGIN & ROLE", "Akses tanpa login", "Buka /dashboard langsung tanpa login.", "Redirect otomatis ke halaman login."],
  ["D. LOGIN & ROLE", "Pembatasan akses antar-role", "Login helpdesk lalu coba buka /admin dan /tugas.", "Redirect otomatis; halaman role lain tidak dapat diakses."],
  ["D. LOGIN & ROLE", "Logout", "Klik tombol keluar pada menu.", "Kembali ke halaman login dan sesi berakhir."],
  ["E. HELPDESK", "Dashboard Helpdesk", "Buka /dashboard sebagai helpdesk. Cek KPI, grafik, dan filter.", "Angka KPI dan grafik muncul sesuai data. Filter status bekerja."],
  ["E. HELPDESK", "Badge SLA sesuai prioritas", "Buka daftar tiket dengan prioritas berbeda.", "Badge P1/P2/P3 dan deadline SLA dihitung benar (jam kerja 08.00-17.00, skip Sabtu/Minggu/libur)."],
  ["E. HELPDESK", "Inbox & pencarian", "Buka /inbox, lakukan pencarian dan filter status/prioritas.", "Daftar tiket tampil; pencarian dan filter bekerja."],
  ["E. HELPDESK", "Detail tiket (drawer)", "Klik satu tiket dari inbox.", "Detail lengkap tampil: unit, PIC, deskripsi, foto, riwayat, SLA."],
  ["E. HELPDESK", "Ubah status tiket", "Ubah status tiket (mis. OPEN -> SCHEDULED).", "Status berubah, tercatat di timeline, notif terkirim ke role terkait."],
  ["E. HELPDESK", "Assign ke teknisi", "Assign tiket ke seorang teknisi.", "Teknisi melihat tiket di halaman Tugas; nama teknisi muncul di tracking pelanggan."],
  ["E. HELPDESK", "Ubah prioritas", "Ubah prioritas tiket (mis. P2 -> P1).", "Badge dan deadline SLA terhitung ulang sesuai prioritas baru."],
  ["E. HELPDESK", "Tambah catatan tim", "Tambahkan team note pada tiket.", "Catatan muncul di timeline dan notif terkirim ke anggota tim terkait."],
  ["E. HELPDESK", "Laporan & export", "Buka /reports, pilih rentang tanggal, lalu export.", "Rekap tampil sesuai filter. File CSV dan XLSX terunduh."],
  ["E. HELPDESK", "Notif tiket baru + chime", "Saat aplikasi terbuka, minta tiket baru dibuat (dari portal publik).", "Notif muncul di dropdown dan suara chime berbunyi."],
  ["F. TEKNISI", "Daftar tugas", "Buka /tugas sebagai teknisi.", "Hanya tiket yang ditugaskan ke teknisi tersebut yang tampil."],
  ["F. TEKNISI", "Update status lapangan", "Ubah status SCHEDULED -> EN_ROUTE -> WORKING -> RESOLVED.", "Setiap perubahan status tampil di tracking pelanggan dan timeline."],
  ["F. TEKNISI", "Upload bukti pengerjaan", "Saat status WORKING, unggah foto bukti.", "Foto tersimpan; bukti tampil di detail tiket."],
  ["F. TEKNISI", "Minta backup", "Klik minta backup dan isi alasan.", "Sinyal masuk ke PM Command Center. Status tiket belum berubah sampai PM menyetujui."],
  ["F. TEKNISI", "Catatan dari teknisi", "Tambah catatan dari halaman tugas.", "Catatan tampil di timeline tiket."],
  ["G. PM", "Command Center", "Buka /command-center sebagai PM.", "Alarm pending dan daftar tiket tampil."],
  ["G. PM", "Setujui permintaan backup", "Setujui permintaan backup yang masuk.", "Penanggung jawab tiket berpindah, audit tercatat, teknisi pendukung diberi tahu."],
  ["G. PM", "Tolak permintaan backup", "Tolak permintaan backup.", "Permintaan dibatalkan dan audit tercatat."],
  ["G. PM", "Dashboard PM", "Buka /dashboard sebagai PM.", "KPI dan grafik sesuai peran PM tampil."],
  ["H. ADMIN", "Manajemen user", "Buka /admin/users. Coba buat user, reset password, ubah role, dan hapus user.", "Semua aksi bekerja dan perubahan langsung berlaku."],
  ["H. ADMIN", "Master data", "Buka /admin/master-data. Tambah/ubah/hapus site, unit, customer, katalog kendala, jam operasional.", "CRUD master data berfungsi dan berdampak ke form laporan."],
  ["H. ADMIN", "Konfigurasi SLA", "Ubah target P1/P2/P3 di /admin/sla.", "Badge SLA dan FAQ landing ikut berubah sesuai nilai baru."],
  ["H. ADMIN", "Laporan admin & export", "Buka /admin/reports lalu export.", "Laporan tampil dan file export terunduh."],
  ["H. ADMIN", "Audit trail", "Lakukan beberapa aksi, lalu cek log audit.", "Setiap aksi tercatat: siapa, kapan, dan apa yang dilakukan."],
  ["I. NOTIFIKASI & PUSH", "Perizinan push", "Login pertama kali di browser.", "Browser meminta izin notifikasi; service worker terdaftar; data push_subscriptions terisi."],
  ["I. NOTIFIKASI & PUSH", "Push saat aplikasi tertutup", "Tutup tab browser, lalu buat aksi baru (mis. tiket baru).", "Notifikasi OS muncul; klik notif membuka aplikasi."],
  ["I. NOTIFIKASI & PUSH", "Push saat aplikasi terbuka", "Saat aplikasi terbuka, ada notif baru.", "Chime berbunyi tanpa notif OS ganda."],
  ["I. NOTIFIKASI & PUSH", "Notifikasi multi-role", "Buat aksi yang melibatkan teknisi vs PM.", "Notif hanya terkirim ke role yang relevan (teknisi dapat tugas, PM dapat alarm backup)."],
  ["J. SLA & JAM KERJA", "SLA skip akhir pekan & libur", "Buat tiket pada Jumat sore atau sebelum hari libur.", "Deadline hanya menghitung jam kerja 08.00-17.00 dan melewati Sabtu/Minggu/libur nasional."],
  ["J. SLA & JAM KERJA", "Riwayat SLA", "Buka tiket yang sudah berganti status berkali-kali.", "Riwayat perhitungan SLA tersimpan dan akurat."],
  ["K. PENUTUPAN", "Konfirmasi WhatsApp", "Tandai konfirmasi WA terkirim pada tiket RESOLVED.", "Status konfirmasi tercatat; tiket ditutup otomatis setelah 24 jam."],
  ["K. PENUTUPAN", "Auto-close tiket", "Biarkan tiket berstatus RESOLVED.", "Tiket tertutup otomatis oleh cron dan berstatus CLOSED."],
  ["L. DATA & KEAMANAN", "Tandai tiket duplikat", "Tandai tiket sebagai duplikat dari tiket lain.", "Status tiket menjadi DUPLICATE tanpa mengganggu tiket utama."],
  ["L. DATA & KEAMANAN", "Perlindungan data pribadi (PDP)", "Buka endpoint publik (track/report) dan periksa data yang keluar.", "Hanya field publik yang tampil; no HP/alamat internal tidak bocor."],
  ["L. DATA & KEAMANAN", "RLS & validasi server", "Coba insert langsung ke tabel via Supabase tanpa RPC.", "Ditolak RLS; data hanya bisa masuk lewat RPC yang divalidasi."],
  ["M. BRANDING & PWA", "Aplikasi bisa di-install", "Buka aplikasi, periksa prompt install / menu browser.", "Prompt install PWA muncul; manifest dan icon benar."],
  ["M. BRANDING & PWA", "Konsistensi branding", "Periksa logo, warna, dan tampilan di semua halaman.", "Branding konsisten di seluruh halaman."],
]

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outPath = path.join(root, "UAT.xlsx")

const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet("UAT AtapCare")

const HEADERS = ["No", "Modul", "Skenario UAT", "Langkah Pengujian", "Hasil Diharapkan", "Lulus", "Gagal", "Catatan"]
const WIDTHS = [5, 20, 38, 52, 48, 10, 10, 24]
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } }
const BAND_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF1F8" } }
const MODULE_COLORS = {}
const MODULE_PALETTE = [
  "FF1F4E79", "FF2E75B6", "FF2F5597", "FF4A6FA5", "FF1F6E79", "FF2F6B8F",
  "FF3B6296", "FF1D5C7A", "FF2A6FA9", "FF275D8F", "FF1F5370", "FF31608C", "FF24507A",
]

const border = {
  top: { style: "thin", color: { argb: "FFB0BEC5" } },
  left: { style: "thin", color: { argb: "FFB0BEC5" } },
  bottom: { style: "thin", color: { argb: "FFB0BEC5" } },
  right: { style: "thin", color: { argb: "FFB0BEC5" } },
}

ws.columns = WIDTHS.map((w, i) => ({ width: w, key: String(i) }))

const header = ws.getRow(1)
header.values = HEADERS
header.eachCell((cell) => {
  cell.fill = HEADER_FILL
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  cell.border = border
})
header.height = 28

let moduleIdx = -1
let prevModule = ""
ROWS.forEach((row, i) => {
  if (row[0] !== prevModule) {
    prevModule = row[0]
    moduleIdx += 1
  }
  const r = ws.addRow([i + 1, ...row])
  r.eachCell((cell, col) => {
    cell.alignment = {
      vertical: "top",
      wrapText: col > 1,
      horizontal: col === 1 || col >= 6 ? "center" : "left",
    }
    cell.border = border
    if (i % 2 === 1) cell.fill = BAND_FILL
  })
  r.getCell(2).font = { bold: true, color: { argb: MODULE_COLORS[row[0]] ??= MODULE_PALETTE[moduleIdx % MODULE_PALETTE.length] } }
})

ws.views = [{ state: "frozen", ySplit: 1 }]
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ROWS.length + 1, column: HEADERS.length } }

const lastRow = ROWS.length + 1
for (const col of ["F", "G"]) {
  ws.getCell(`${col}1`).value = `${HEADERS[col === "F" ? 5 : 6]}  ☐`
  ws.getCell(`${col}1`).alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  ws.getCell(`${col}1`).fill = HEADER_FILL
  ws.getCell(`${col}1`).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getCell(`${col}1`).border = border
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Lulus,Gagal,N/A"'],
      showErrorMessage: true,
    }
  }
}

await wb.xlsx.writeFile(outPath)
console.log(`UAT.xlsx dibuat: ${outPath} (${ROWS.length} skenario)`)
