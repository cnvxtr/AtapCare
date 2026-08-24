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
          <p className="text-xs text-muted-foreground font-mono mt-2">Terakhir diperbarui: 24 Agustus 2026</p>
        </div>

        <article className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Pendahuluan">
            <p>PT Atap Teknologi Indonesia ("kami", "perusahaan") menghormati dan melindungi privasi setiap pengguna layanan Atap Care. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda saat Anda menggunakan Portal Publik (lapor.atapcare.id) maupun APK Atap Care.</p>
            <p>Kebijakan ini disusun berdasarkan Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) serta peraturan pelaksananya.</p>
          </Section>

          <Section title="2. Informasi yang Kami Kumpulkan">
            <SubSection title="2.1 Data Akun dan Laporan Pelanggan">
              <p><strong>Saat Anda membuat akun</strong>, kami mengumpulkan:</p>
              <ul>
                <li>Nama lengkap;</li>
                <li>Nama pengguna (username);</li>
                <li>Alamat email;</li>
                <li>Nomor telepon aktif (disimpan dalam format terstandar);</li>
                <li>Kata sandi disimpan hanya dalam bentuk terenkripsi satu arah dan tidak pernah dapat dibaca oleh siapa pun, termasuk kami;</li>
                <li>Foto profil (opsional).</li>
              </ul>
              <p><strong>Saat Anda mengirimkan laporan kendala</strong>, kami mengumpulkan:</p>
              <ul>
                <li>Data unit yang dilaporkan: perusahaan, site/lokasi, dan unit/perangkat;</li>
                <li>Deskripsi kendala yang Anda tulis;</li>
                <li>Lampiran berupa foto dan/atau dokumen pendukung.</li>
              </ul>
              <p>Nama pelapor pada laporan diambil otomatis dari profil akun Anda, sehingga Anda tidak perlu memasukkan ulang data identitas setiap kali melapor.</p>
            </SubSection>
            <SubSection title="2.2 Data Petugas Internal">
              <p>Kami mengelola data kepegawaian dasar para petugas kami, seperti nama, kontak dinas, dan penempatan tugas, semata-mata untuk keperluan operasional penanganan laporan. Akses atas data ini diatur secara ketat sesuai penugasan yang ditetapkan perusahaan.</p>
            </SubSection>
            <SubSection title="2.3 Data Teknis">
              <p>Sistem mencatat data teknis minimum (waktu akses dan jejak audit aktivitas penting) untuk menjaga keamanan layanan. Jejak audit bersifat rahasia dan tidak diakseskan kepada pengguna.</p>
            </SubSection>
          </Section>

          <Section title="3. Penggunaan Informasi">
            <p>Kami menggunakan data yang terkumpul untuk:</p>
            <ul>
              <li>Menerima, memverifikasi, dan menindaklanjuti laporan kendala Anda;</li>
              <li>Menghubungi Anda terkait perkembangan laporan melalui saluran resmi (WhatsApp Group atau kontak yang terdaftar);</li>
              <li>Menugaskan petugas yang tepat untuk menangani kendala di lokasi Anda;</li>
              <li>Mendokumentasikan hasil pekerjaan, termasuk berita acara serah terima digital;</li>
              <li>Menjaga keamanan akun dan mencegah penyalahgunaan layanan;</li>
              <li>Memenuhi kewajiban hukum yang berlaku.</li>
            </ul>
            <p>Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak mana pun.</p>
          </Section>

          <Section title="4. Dasar Pemrosesan dan Hak Anda">
            <p>Pemrosesan data pribadi dilakukan berdasarkan: (a) pemenuhan kewajiban kontrak layanan antara perusahaan dengan klien korporat; (b) persetujuan Anda; dan/atau (c) kepatuhan terhadap kewajiban hukum.</p>
            <p>Sesuai UU PDP, Anda memiliki hak untuk mengakses, memperbaiki, atau meminta penghapusan data pribadi Anda, serta menarik persetujuan pemrosesan. Permintaan dapat diajukan melalui kontak resmi pada bagian akhir kebijakan ini.</p>
          </Section>

          <Section title="5. Keamanan Data">
            <p>Kami menerapkan langkah pengamanan yang berlaku secara industri, termasuk:</p>
            <ul>
              <li>Enkripsi koneksi (HTTPS/TLS) untuk seluruh komunikasi data;</li>
              <li>Kata sandi disimpan hanya dalam bentuk terenkripsi satu arah;</li>
              <li>Pembatasan akses data secara teknis: hanya petugas yang berwenang yang dapat mengakses data tertentu, sesuai kebutuhan penugasannya;</li>
              <li>Pembatasan otomatis terhadap upaya login yang tidak berhasil untuk mencegah akses ilegal;</li>
              <li>Pencatatan jejak audit atas aktivitas sensitif di dalam sistem;</li>
              <li>Pemeriksaan dan pembaruan pengamanan secara berkala.</li>
            </ul>
          </Section>

          <Section title="6. Batasan Informasi">
            <p>Kami berkomitmen memberikan informasi kepada pelanggan secara jelas namun proporsional. Dengan demikian:</p>
            <ul>
              <li>Yang kami sampaikan kepada Anda: status dan perkembangan tiket Anda, ID Tiket, serta informasi hasil penyelesaian pekerjaan;</li>
              <li>Yang tidak kami ungkapkan: identitas lengkap dan kontak pribadi petugas penangani, catatan serta diskusi internal antar petugas, data milik pelanggan lain, evaluasi kinerja internal, maupun detail struktur dan mekanisme teknis sistem;</li>
              <li>Dokumen dan komunikasi publik kami tidak memaparkan susunan organisasi kerja internal; penyebutan fungsi hanya dilakukan secara umum (misalnya "teknisi" atau "tim lapangan").</li>
            </ul>
            <p>Jika Anda memerlukan kejelasan lebih lanjut terkait penanganan laporan Anda, silakan ajukan melalui saluran resmi yang tersedia.</p>
          </Section>

          <Section title="7. Penyimpanan dan Retensi">
            <p>Data pribadi disimpan di pusat data yang menerapkan standar keamanan memadai. Tiket yang telah selesai masuk ke arsip dan disimpan dalam periode tertentu untuk keperluan garansi dan audit; setelah periode tersebut, data pribadi pelapor dianonimkan secara permanen sementara catatan teknis pekerjaan tetap tersimpan untuk kepentingan riwayat unit.</p>
            <p>Data akun yang dihapus oleh pengguna akan dibersihkan dari sistem sesuai prosedur retensi kami, kecuali diwajibkan lain oleh hukum.</p>
          </Section>

          <Section title="8. Berbagi Informasi dengan Pihak Ketiga">
            <p>Kami tidak membagikan data pribadi Anda kepada pihak ketiga, kecuali:</p>
            <ul>
              <li>Ke penyedia infrastruktur teknologi yang terikat perjanjian kerahasiaan dan perlindungan data;</li>
              <li>Apabila diwajibkan oleh perintah hukum yang sah dari otoritas berwenang;</li>
              <li>Dalam batas yang diperlukan untuk melindungi hak, keselamatan, atau properti kami maupun pengguna lain.</li>
            </ul>
          </Section>

          <Section title="9. Perlindungan Identitas dalam Dokumentasi">
            <p>Dokumentasi pekerjaan (foto, berita acara, catatan penyelesaian) hanya dapat diakses oleh Anda dan petugas berwenang. Nomor telepon dan identitas pelapor ditampilkan dalam bentuk yang dilindungi (sebagian angka disembunyikan) pada tampilan sistem, dan dokumen arsip lama dianonimkan sesuai ketentuan retensi.</p>
          </Section>

          <Section title="10. Cookie dan Penyimpanan Lokal">
            <p>Aplikasi web dan APK kami hanya menggunakan penyimpanan lokal yang diperlukan untuk menjaga sesi login Anda tetap aman. Kami tidak menggunakan cookie pelacak iklan atau analitik pihak ketiga.</p>
          </Section>

          <Section title="11. Hak Anda">
            <p>Sebagai pengguna akun, Anda dapat:</p>
            <ul>
              <li>Melihat dan memperbarui data profil (nama, email, nomor telepon, foto profil) kapan saja;</li>
              <li>Mengganti kata sandi melalui fitur pemulihan akun;</li>
              <li>Menghapus akun dengan menghubungi kami melalui saluran resmi.</li>
            </ul>
          </Section>

          <Section title="12. Perubahan Kebijakan">
            <p>Kebijakan Privasi ini dapat diperbarui dari waktu ke waktu. Setiap perubahan akan ditandai dengan pembaruan tanggal "Terakhir diperbarui" pada halaman ini.</p>
          </Section>

          <Section title="13. Hubungi Kami">
            <p>Untuk pertanyaan, permintaan akses, koreksi, atau penghapusan data pribadi, hubungi:</p>
            <div className="mt-3 p-4 rounded-xl border border-border bg-card space-y-1">
              <p className="font-medium">PT Atap Teknologi Indonesia</p>
              <p className="text-muted-foreground">Alamat: Jl. Kamarung No.888, RT.03/RW.14, Padaasih, Kec. Cisarua, Kabupaten Bandung Barat, Jawa Barat 40551</p>
              <p className="text-muted-foreground">Email: <span className="font-mono">legal@atapcare.id</span></p>
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
