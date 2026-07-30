import { Link } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan.")}`;

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Portal Publik</p>
          <h1 className="text-3xl font-display font-bold mt-2">Syarat dan Ketentuan</h1>
          <p className="text-xs text-muted-foreground font-mono mt-2">Terakhir diperbarui: 24 Juli 2026 · Berlaku efektif: 24 Juli 2026</p>
        </div>

        <article className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Penerimaan Syarat">
            <p>Selamat datang di Atap Care, sistem informasi ticketing keluhan pelanggan yang disediakan oleh PT Atap Teknologi Indonesia ("kami", "perusahaan"). Dengan mengakses atau menggunakan Portal Publik (lapor.atapcare.id), Anda menyetujui untuk terikat dengan Syarat dan Ketentuan ini ("Syarat"). Jika Anda tidak menyetujui salah satu bagian dari Syarat ini, mohon untuk tidak menggunakan layanan kami.</p>
            <p>Syarat ini merupakan perjanjian hukum antara Anda (selanjutnya disebut "Pengguna", "Pelanggan", atau "Anda") dan PT Atap Teknologi Indonesia terkait penggunaan layanan Atap Care.</p>
          </Section>

          <Section title="2. Deskripsi Layanan">
            <p>Atap Care adalah sistem ticketing yang menyediakan:</p>
            <SubSection title="2.1 Untuk Pelanggan (Portal Publik)">
              <ul>
                <li>Formulir pelaporan keluhan terkait layanan VMS (Vessel Monitoring System) dan INTANK (Intelligent Tank Monitoring System) yang dikelola oleh PT Atap Teknologi Indonesia.</li>
                <li>Fitur pelacakan status tiket menggunakan ID Tiket unik.</li>
                <li>Komunikasi tindak lanjut melalui WhatsApp dengan tim Helpdesk kami.</li>
              </ul>
            </SubSection>
            <SubSection title="2.2 Untuk Karyawan Internal (Portal Internal & APK)">
              <ul>
                <li>Dashboard operasional untuk Helpdesk, Project Management Lead, Teknisi Lapangan, dan Administrator.</li>
                <li>Manajemen tiket, penugasan, penjadwalan, dan validasi pekerjaan.</li>
                <li>Dokumentasi pekerjaan lapangan dan Berita Acara Serah Terima (BAST) digital.</li>
              </ul>
            </SubSection>
            <p>Layanan ini tidak mencakup transaksi finansial, pembayaran, atau jual-beli produk. Layanan ini disediakan sebagai bagian dari kontrak pemeliharaan antara PT Atap Teknologi Indonesia dengan perusahaan klien korporat.</p>
          </Section>

          <Section title="3. Akun & Keamanan (Khusus Karyawan Internal)">
            <SubSection title="3.1 Pembuatan Akun">
              <ul>
                <li>Akun karyawan dibuat secara eksklusif oleh Administrator perusahaan.</li>
                <li>Setiap karyawan bertanggung jawab menjaga kerahasiaan username dan password mereka.</li>
                <li>Karyawan wajib mengganti password pada login pertama kali.</li>
              </ul>
            </SubSection>
            <SubSection title="3.2 Tanggung Jawab Keamanan">
              <ul>
                <li>Karyawan bertanggung jawab atas seluruh aktivitas yang dilakukan menggunakan akun mereka.</li>
                <li>Karyawan dilarang membagikan kredensial login kepada pihak lain.</li>
                <li>Karyawan wajib segera melaporkan kepada Administrator jika mencurigai adanya akses tidak sah terhadap akun mereka.</li>
                <li>Sesi login akan berakhir otomatis setelah 30 menit tanpa aktivitas.</li>
              </ul>
            </SubSection>
            <SubSection title="3.3 Fitur Switch Role">
              <ul>
                <li>Karyawan dengan lebih dari satu role dapat berpindah antar role menggunakan fitur Switch Role.</li>
                <li>Setiap perpindahan role tercatat di Activity Log.</li>
                <li>Karyawan bertanggung jawab atas aksi yang dilakukan pada setiap role yang aktif.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="4. Penggunaan yang Diizinkan">
            <SubSection title="4.1 Untuk Pelanggan">
              <p>Anda diperbolehkan menggunakan Portal Publik untuk:</p>
              <ul>
                <li>Mengirimkan laporan keluhan yang benar dan akurat terkait unit/perangkat yang dikelola oleh PT Atap Teknologi Indonesia.</li>
                <li>Melacak status tiket menggunakan ID Tiket yang telah diberikan.</li>
                <li>Berkomunikasi dengan Helpdesk melalui WhatsApp untuk klarifikasi atau informasi tambahan.</li>
              </ul>
            </SubSection>
            <SubSection title="4.2 Untuk Karyawan Internal">
              <p>Karyawan diperbolehkan menggunakan sistem sesuai dengan role dan kewenangan yang telah ditetapkan oleh Administrator, dengan mematuhi Standar Operasional Prosedur (SOP) perusahaan.</p>
            </SubSection>
          </Section>

          <Section title="5. Larangan">
            <p>Anda DILARANG melakukan hal-hal berikut:</p>
            <SubSection title="5.1 Larangan Umum">
              <ul>
                <li>Mengirimkan laporan palsu, menyesatkan, atau berisi informasi yang tidak benar (prank).</li>
                <li>Menggunakan bahasa yang tidak pantas, merendahkan, atau mengancam dalam deskripsi keluhan atau komunikasi.</li>
                <li>Mengunggah konten yang melanggar hukum, mengandung malware, atau melanggar hak kekayaan intelektual pihak ketiga.</li>
                <li>Mencoba mengakses sistem secara tidak sah, termasuk melalui brute-force, SQL injection, atau eksploitasi kerentanan lainnya.</li>
                <li>Menggunakan bot, scraper, atau alat otomatis untuk mengakses layanan tanpa izin tertulis.</li>
                <li>Mengganggu atau membebani infrastruktur sistem secara berlebihan (Denial of Service).</li>
              </ul>
            </SubSection>
            <SubSection title="5.2 Larangan Khusus Karyawan">
              <ul>
                <li>Mengakses tiket atau data di luar kewenangan role yang aktif.</li>
                <li>Memodifikasi atau menghapus Activity Log (yang bersifat immutable).</li>
                <li>Menyalahgunakan data pelanggan untuk kepentingan pribadi.</li>
                <li>Memvalidasi (close/return) tiket yang dikerjakan sendiri (konflik kepentingan).</li>
                <li>Melakukan self-assignment tanpa sepengetahuan atasan (sistem akan mencatat flag SELF-ASSIGNMENT).</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="6. Pengiriman Laporan oleh Pelanggan">
            <SubSection title="6.1 Kebenaran Informasi">
              <p>Anda bertanggung jawab penuh atas kebenaran dan kelengkapan informasi yang Anda berikan dalam formulir pelaporan, termasuk: identitas pelapor, nomor WhatsApp aktif, lokasi/site dan unit/perangkat yang dilaporkan, serta deskripsi kendala yang jelas.</p>
            </SubSection>
            <SubSection title="6.2 Sifat Final Laporan">
              <p>Setelah dikirim, laporan tidak dapat diubah atau ditambahkan informasinya oleh pelanggan melalui Portal Publik. Jika ada informasi tambahan atau koreksi, silakan hubungi Helpdesk melalui WhatsApp Group resmi.</p>
            </SubSection>
            <SubSection title="6.3 ID Tiket">
              <p>Setiap laporan yang berhasil dikirim akan mendapatkan ID Tiket unik dengan format acak (contoh: ATC-20260724-X7K9). Simpan ID Tiket ini untuk keperluan pelacakan status. ID Tiket bersifat rahasia; hanya Anda dan pihak internal perusahaan yang dapat mengakses detail tiket terkait.</p>
            </SubSection>
            <SubSection title="6.4 Deteksi Duplikasi">
              <p>Sistem kami akan mendeteksi laporan duplikat (site + unit + deskripsi serupa dalam 10 menit terakhir). Jika terdeteksi, sistem akan meminta konfirmasi. Laporan duplikat yang dikonfirmasi akan digabungkan dengan tiket utama, dan Anda akan diberitahu melalui WhatsApp.</p>
            </SubSection>
          </Section>

          <Section title="7. Berita Acara Serah Terima (BAST)">
            <SubSection title="7.1 Status Hukum BAST Digital">
              <p>Foto BAST yang ditandatangani oleh PIC (Person in Charge) pelanggan dan diunggah ke sistem merupakan dokumen sah yang menjadi bukti penyelesaian pekerjaan. BAST digital ini memiliki kekuatan hukum yang sama dengan BAST fisik.</p>
            </SubSection>
            <SubSection title="7.2 Tanggung Jawab PIC">
              <p>Dengan menandatangani BAST, PIC pelanggan menyatakan bahwa: pekerjaan telah selesai dilaksanakan dengan baik, unit/perangkat telah berfungsi normal sesuai spesifikasi, dan PIC telah memeriksa dan memverifikasi hasil pekerjaan.</p>
            </SubSection>
          </Section>

          <Section title="8. Hak Kekayaan Intelektual">
            <p>Seluruh konten, desain, logo, kode program, dan arsitektur sistem Atap Care adalah hak milik eksklusif PT Atap Teknologi Indonesia dan dilindungi oleh undang-undang hak cipta dan kekayaan intelektual.</p>
            <p>Anda tidak diperkenankan: menyalin, memodifikasi, atau mendistribusikan bagian apa pun dari sistem tanpa izin tertulis; melakukan reverse engineering, decompile, atau disassemble terhadap kode program; menggunakan nama, logo, atau merek Atap Care untuk tujuan komersial tanpa izin.</p>
          </Section>

          <Section title="9. Batasan Tanggung Jawab">
            <SubSection title="9.1 Layanan 'Sebagaimana Adanya'">
              <p>Layanan Atap Care disediakan "sebagaimana adanya" (as is) dan "sebagaimana tersedia" (as available). Kami tidak memberikan jaminan tersurat maupun tersirat bahwa layanan akan selalu tersedia tanpa gangguan, bebas dari kesalahan atau bug, atau memenuhi semua kebutuhan spesifik Anda.</p>
            </SubSection>
            <SubSection title="9.2 Batasan Kerugian">
              <p>Sejauh diizinkan oleh hukum yang berlaku, PT Atap Teknologi Indonesia tidak bertanggung jawab atas: kerugian tidak langsung, insidental, khusus, atau konsekuensial yang timbul dari penggunaan layanan; keterlambatan penanganan keluhan yang disebabkan oleh force majeure; kerugian akibat informasi yang tidak akurat yang diberikan oleh pelanggan dalam formulir pelaporan.</p>
            </SubSection>
            <SubSection title="9.3 Service Level Agreement (SLA)">
              <p>Target SLA yang ditampilkan dalam sistem (P1: 4 jam, P2: 24 jam, P3: 72 jam) merupakan target operasional internal dan bukan jaminan kontraktual, kecuali diatur secara khusus dalam perjanjian tertulis dengan perusahaan klien.</p>
            </SubSection>
          </Section>

          <Section title="10. Penghentian Layanan">
            <p>Kami berhak untuk: menolak atau menangguhkan akses Anda ke layanan jika Anda melanggar Syarat ini; menandai laporan sebagai VOID jika laporan dianggap tidak valid, berisi informasi palsu, atau merupakan prank; menghentikan layanan secara keseluruhan dengan pemberitahuan wajar kepada perusahaan klien.</p>
          </Section>

          <Section title="11. Perubahan Layanan dan Syarat">
            <p>Kami berhak untuk: memodifikasi atau menghentikan fitur layanan tertentu tanpa pemberitahuan sebelumnya, untuk keperluan pemeliharaan atau peningkatan sistem; memperbarui Syarat dan Ketentuan ini dari waktu ke waktu. Perubahan akan diberitahukan melalui pembaruan tanggal "Terakhir diperbarui". Penggunaan berkelanjutan setelah perubahan dianggap sebagai persetujuan Anda.</p>
          </Section>

          <Section title="12. Hukum yang Berlaku dan Penyelesaian Sengketa">
            <p>Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Negara Republik Indonesia. Setiap sengketa yang timbul dari atau terkait dengan Syarat ini akan diselesaikan secara musyawarah untuk mufakat. Jika tidak tercapai kesepakatan, sengketa akan diselesaikan melalui Pengadilan Negeri Bandung.</p>
          </Section>

          <Section title="13. Ketentuan Tambahan">
            <ul>
              <li><strong>Keterpisahan (Severability):</strong> Jika ada ketentuan dalam Syarat ini yang dianggap tidak sah atau tidak dapat dilaksanakan oleh pengadilan yang berwenang, ketentuan lainnya tetap berlaku penuh.</li>
              <li><strong>Tidak Ada Pelepasan Hak (No Waiver):</strong> Kegagalan kami untuk menegakkan ketentuan tertentu bukan berarti pelepasan hak untuk menegakkannya di kemudian hari.</li>
              <li><strong>Perjanjian Utuh:</strong> Syarat ini (bersama dengan Kebijakan Privasi) merupakan perjanjian utuh antara Anda dan kami terkait penggunaan layanan Atap Care.</li>
            </ul>
          </Section>

          <Section title="14. Kontak Kami">
            <p>Jika Anda memiliki pertanyaan atau keberatan terkait Syarat dan Ketentuan ini, silakan hubungi:</p>
            <div className="mt-3 p-4 rounded-xl border border-border bg-card space-y-1">
              <p className="font-medium">PT Atap Teknologi Indonesia</p>
              <p className="text-muted-foreground">Alamat: Jl. Kamarung No.888, RT.03/RW.14, Padaasih, Kec. Cisarua, Kabupaten Bandung Barat, Jawa Barat 40551</p>
              <p className="text-muted-foreground">Email: <span className="font-mono">legal@atapcare.id</span></p>
              <p className="text-muted-foreground">Helpdesk Operasional: Kustiara Bhakti (melalui WhatsApp Group resmi klien)</p>
            </div>
          </Section>
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-display font-bold mb-3">{title}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-display font-semibold mb-2">{title}</h3>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-foreground text-background grid place-items-center font-display font-bold">A</div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold">Atap Care</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PT Atap Teknologi Indonesia</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-mono">0812421414</span>
          </a>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2.5">
            <SocialIcon href="https://facebook.com" label="Facebook">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </SocialIcon>
            <SocialIcon href="https://twitter.com" label="Twitter">
              <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
            </SocialIcon>
            <SocialIcon href="https://linkedin.com" label="LinkedIn">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4" cy="4" r="2" />
            </SocialIcon>
            <SocialIcon href="https://instagram.com" label="Instagram">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </SocialIcon>
          </div>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
        <p>&copy; 2026 PT Atap Teknologi Indonesia. Semua hak dilindungi.</p>
        <span className="hidden sm:inline">·</span>
        <div className="flex items-center gap-2">
          <Link to="/privacy" className="hover:text-foreground transition underline underline-offset-2">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms" className="hover:text-foreground transition underline underline-offset-2">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="text-muted-foreground hover:text-foreground transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </a>
  );
}
