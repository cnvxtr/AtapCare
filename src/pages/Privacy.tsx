import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[3px] bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mt-2">Kebijakan Privasi</h1>
          <p className="text-xs text-muted-foreground font-mono mt-2">Terakhir diperbarui: 24 Juli 2026</p>
        </div>

        <article className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Pendahuluan">
            <p>Selamat datang di Atap Care — sistem informasi ticketing keluhan pelanggan yang dikelola oleh PT Atap Teknologi Indonesia ("kami", "perusahaan"). Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda ketika Anda menggunakan portal pelaporan keluhan kami di lapor.atapcare.id ("Portal Publik") serta aplikasi internal yang digunakan oleh karyawan kami ("Portal Internal" dan "APK Atap Care").</p>
            <p>Kami berkomitmen untuk mematuhi Undang-Undang No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP) dan peraturan turunannya. Dengan menggunakan layanan kami, Anda menyetujui praktik pengolahan data yang dijelaskan dalam Kebijakan Privasi ini.</p>
          </Section>

          <Section title="2. Data yang Kami Kumpulkan">
            <SubSection title="2.1 Data dari Pelanggan (Pengguna Portal Publik)">
              <p>Ketika Anda mengirimkan laporan keluhan melalui Portal Publik, kami mengumpulkan:</p>
              <ul>
                <li>Nama Pelapor (nama lengkap atau nama jabatan)</li>
                <li>Jabatan Anda di perusahaan klien</li>
                <li>Nomor WhatsApp aktif untuk komunikasi tindak lanjut</li>
                <li>Lokasi/Site tempat unit/perangkat berada</li>
                <li>Unit/Perangkat yang mengalami kendala</li>
                <li>Deskripsi kendala yang Anda sampaikan (maksimal 2.000 karakter)</li>
                <li>Foto pendukung (opsional, maksimal 5 foto)</li>
              </ul>
              <p>Kami tidak meminta Anda membuat akun atau memberikan email. Pelacakan status tiket dilakukan menggunakan ID Tiket unik yang diberikan setelah pengiriman laporan.</p>
            </SubSection>

            <SubSection title="2.2 Data dari Karyawan Internal (Pengguna Portal Internal & APK)">
              <p>Untuk karyawan PT Atap Teknologi Indonesia yang menggunakan sistem internal, kami mengumpulkan:</p>
              <ul>
                <li>Nama lengkap dan jabatan struktural</li>
                <li>Username (dibuat oleh Administrator)</li>
                <li>Password (disimpan dalam bentuk hashed menggunakan bcrypt, tidak pernah disimpan sebagai teks asli)</li>
                <li>Nomor WhatsApp untuk keperluan operasional</li>
                <li>Role yang ditugaskan (Helpdesk, PM, Teknisi, Admin)</li>
                <li>Koordinat GPS saat teknisi memulai pekerjaan di lokasi pelanggan (sebagai bukti kehadiran)</li>
                <li>Foto dokumentasi pekerjaan (hasil perbaikan, Serial Number unit, BAST yang ditandatangani)</li>
              </ul>
            </SubSection>

            <SubSection title="2.3 Data yang Dicatat Otomatis">
              <p>Sistem kami secara otomatis mencatat:</p>
              <ul>
                <li>Activity Log: setiap perubahan status tiket, perubahan prioritas, penugasan, upload dokumen, serta aksi login/logout dan switch role. Log ini bersifat immutable (tidak dapat diubah atau dihapus).</li>
                <li>Timestamp setiap aksi (dalam zona waktu WIB, UTC+7).</li>
                <li>Alamat IP dan User-Agent browser untuk keperluan keamanan.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. Tujuan Pengumpulan Data">
            <p>Data pribadi Anda kami gunakan untuk:</p>
            <ul>
              <li>Memproses laporan keluhan yang Anda sampaikan dan memberikan tindak lanjut yang sesuai.</li>
              <li>Mengidentifikasi unit/perangkat yang dilaporkan agar penanganan tepat sasaran.</li>
              <li>Menghubungi Anda melalui WhatsApp untuk klarifikasi, konfirmasi, atau informasi penyelesaian.</li>
              <li>Mencatat jejak audit penanganan keluhan untuk keperluan evaluasi kualitas layanan dan kepatuhan terhadap Service Level Agreement (SLA).</li>
              <li>Menghasilkan laporan operasional agregat (tanpa mengungkap identitas individu) untuk perbaikan layanan internal.</li>
              <li>Memenuhi kewajiban hukum yang berlaku, termasuk UU PDP.</li>
            </ul>
          </Section>

          <Section title="4. Dasar Hukum Pengolahan Data">
            <p>Pengolahan data pribadi Anda didasarkan pada:</p>
            <ul>
              <li>Pelaksanaan kontrak antara PT Atap Teknologi Indonesia dengan perusahaan tempat Anda bekerja (klien korporat).</li>
              <li>Kepentingan sah kami dalam menyediakan layanan pemeliharaan sistem monitoring (VMS, INTANK) yang berkualitas.</li>
              <li>Kewajiban hukum berdasarkan UU PDP dan peraturan terkait.</li>
            </ul>
          </Section>

          <Section title="5. Penyimpanan & Keamanan Data">
            <p>Kami menerapkan langkah-langkah teknis dan organisasional yang wajar untuk melindungi data Anda, termasuk:</p>
            <ul>
              <li>Enkripsi data dalam perjalanan (HTTPS/TLS) dan saat disimpan (Supabase Storage).</li>
              <li>Password hashing menggunakan algoritma bcrypt.</li>
              <li>Row Level Security (RLS) pada database untuk membatasi akses data berdasarkan role.</li>
              <li>Rate limiting untuk mencegah brute-force (5x percobaan login gagal → akun terkunci 15 menit).</li>
              <li>Masking nomor telepon pada tampilan yang tidak memerlukan informasi lengkap.</li>
              <li>Validasi file upload (client-side dan server-side) untuk mencegah unggahan berbahaya.</li>
            </ul>
            <p>Meskipun demikian, tidak ada sistem yang 100% aman. Kami tidak dapat menjamin keamanan mutlak data yang Anda kirimkan melalui internet.</p>
          </Section>

          <Section title="6. Retensi & Penghapusan Data">
            <p>Kami menerapkan kebijakan retensi data sebagai berikut:</p>
            <ul>
              <li><strong>Aktif</strong> — Tiket status NEW s.d. RESOLVED: Data ditampilkan penuh di dashboard operasional.</li>
              <li><strong>Closed</strong> — Tiket final (CLOSED/VOID/DUPLICATE), usia 0–6 bulan: Data tetap dapat dicari di menu "Arsip Tiket" (Read-Only).</li>
              <li><strong>Archived</strong> — Tiket final, usia &gt;6 bulan: Data pribadi (Nama, No WhatsApp) di-masking penuh. Data teknis (ID Tiket, Site, Unit, Status, Activity Log) tetap disimpan untuk audit.</li>
              <li><strong>Anonymized</strong> — Tiket final, usia &gt;5 tahun: Data pribadi di-anonimisasi permanen (Nama → "Pelanggan X", No WA → "08xx-xxxx-xxxx"). Data teknis tetap disimpan permanen untuk histori maintenance unit.</li>
            </ul>
            <p>Activity Log bersifat permanen dan tidak pernah dihapus atau diarsipkan, untuk menjaga integritas audit trail.</p>
            <p>Master Data (Customer, Site, Unit) tidak diarsipkan, melainkan menggunakan mekanisme soft-delete (flag is_deleted=true) sehingga data tidak dihapus secara fisik dari database.</p>
          </Section>

          <Section title="7. Pembagian Data kepada Pihak Ketiga">
            <p>Kami tidak menjual, menyewakan, atau memperdagangkan data pribadi Anda kepada pihak ketiga. Data Anda hanya dapat dibagikan dalam kondisi berikut:</p>
            <ul>
              <li>Kepada perusahaan klien tempat Anda bekerja, sebagai bagian dari layanan pemeliharaan yang kami berikan.</li>
              <li>Kepada teknisi lapangan kami yang ditugaskan untuk menangani keluhan Anda (nama, site, unit, dan deskripsi kendala).</li>
              <li>Kepada otoritas yang berwenang, jika diwajibkan oleh hukum atau perintah pengadilan.</li>
            </ul>
            <p>Kami tidak menggunakan layanan analitik pihak ketiga (Google Analytics, Facebook Pixel, dll.) pada Portal Publik.</p>
          </Section>

          <Section title="8. Hak Anda sebagai Subjek Data (UU PDP)">
            <p>Berdasarkan UU PDP, Anda memiliki hak untuk:</p>
            <ul>
              <li>Memperoleh informasi tentang kejelasan identitas, dasar hukum, dan tujuan pengolahan data pribadi Anda.</li>
              <li>Melengkapi, memperbarui, dan/atau memperbaiki kesalahan data pribadi Anda (melalui Helpdesk kami).</li>
              <li>Mengakses dan mendapatkan salinan data pribadi Anda yang kami simpan.</li>
              <li>Mengakhiri pengolahan, menghapus, dan/atau membatasi pemrosesan data pribadi Anda (dengan pengecualian untuk data yang wajib disimpan berdasarkan kewajiban hukum atau kontrak).</li>
              <li>Menarik kembali persetujuan pengolahan data pribadi.</li>
              <li>Mengajukan pengaduan kepada lembaga yang berwenang jika terjadi pelanggaran.</li>
            </ul>
            <p>Untuk melaksanakan hak-hak tersebut, silakan hubungi kami melalui kontak di Bagian 11.</p>
          </Section>

          <Section title="9. Cookie & Teknologi Pelacakan">
            <p>Portal Publik kami tidak menggunakan cookie pelacakan atau teknologi serupa (tracking pixels, fingerprinting). Kami hanya menggunakan:</p>
            <ul>
              <li>Session cookie esensial untuk menjaga sesi aktif pada Portal Internal (khusus karyawan).</li>
              <li>Penyimpanan sesi browser (sessionStorage) untuk draft formulir sementara — terhapus otomatis saat tab atau browser ditutup.</li>
              <li>localStorage untuk preferensi tampilan dasar.</li>
            </ul>
          </Section>

          <Section title="10. Perubahan Kebijakan Privasi">
            <p>Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu untuk mencerminkan perubahan praktik atau persyaratan hukum. Perubahan akan diberitahukan melalui pembaruan tanggal "Terakhir diperbarui" di bagian atas dokumen ini. Penggunaan layanan secara berkelanjutan setelah perubahan dianggap sebagai persetujuan Anda terhadap Kebijakan Privasi yang diperbarui.</p>
          </Section>

          <Section title="11. Kontak Kami">
            <p>Jika Anda memiliki pertanyaan, permintaan, atau pengaduan terkait Kebijakan Privasi ini atau pengolahan data pribadi Anda, silakan hubungi:</p>
            <div className="mt-3 p-4 rounded-xl border border-border bg-card space-y-1">
              <p className="font-medium">PT Atap Teknologi Indonesia</p>
              <p className="text-muted-foreground">Alamat: Jl. Kamarung No.888, RT.03/RW.14, Padaasih, Kec. Cisarua, Kabupaten Bandung Barat, Jawa Barat 40551</p>
              <p className="text-muted-foreground">Email: <span className="font-mono">privacy@atapcare.id</span></p>
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
