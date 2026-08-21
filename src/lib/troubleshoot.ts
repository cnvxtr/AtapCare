import { BarChart3, Zap, type LucideIcon } from "lucide-react";
import IlustrasiPanel from "@/assets/IlustrasiPanel.jpeg";

export interface TroubleshootStep {
  title: string;
  body: string;
  image?: string;
}

export interface TroubleshootScenario {
  slug: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconClass: string;
  guideTitle: string;
  steps: TroubleshootStep[];
  reportLabel: string;
  reportPrefix: string;
}

export const SCENARIOS: TroubleshootScenario[] = [
  {
    slug: "mati-total",
    title: "Mati Total",
    subtitle: "Unit / VMS tidak menyala sama sekali",
    Icon: Zap,
    iconClass: "bg-white text-red-600 border-red-600/30",
    guideTitle: "Mari kita cek bersama. Ikuti langkah di bawah ini secara berurutan.",
    steps: [
      {
        title: "Cek Indikator Panel",
        body: "Perhatikan lampu indikator pada panel/adaptor. MERAH = daya masuk 220VAC tersambung, HIJAU = output 24VDC tersedia. Tidak ada yang menyala berarti kemungkinan besar tidak ada catu daya.",
      },
      {
        title: "Cek Tegangan dengan Avometer",
        body: "Ukur tegangan masuk 220VAC. Cek output Power Supply: terminal Biru/Hitam harus 24VDC, terminal Abu-abu harus 12VDC. Hasil tidak sesuai (0V atau di bawah toleransi) = PSU berkendala.",
      },
      {
        title: "Restart MCB",
        body: "Buka panel listrik, matikan MCB yang menuju unit, tunggu 15–20 menit, lalu nyalakan kembali. Pastikan indikator panel menyala setelahnya.",
      },
    ],
    reportLabel: "Masih Mati, Buat Tiket Laporan",
    reportPrefix:
      "[Mati Total] Setelah pengecekan mandiri sesuai panduan (indikator panel, tegangan PSU, restart MCB) unit masih tidak menyala. ",
  },
  {
    slug: "nilai-tidak-sesuai",
    title: "Nilai Tidak Sesuai",
    subtitle: "Nilai yang tampil salah / tidak masuk akal",
    Icon: BarChart3,
    iconClass: "bg-white text-orange-600 border-orange-500/30",
    guideTitle: "Mari kita cek bersama. Ikuti langkah di bawah ini secara berurutan.",
    steps: [
      {
        title: "Cek Indikator HMI",
        body: "Lihat indikator di bagian bawah HMI/display: lampu 4G GSM dan Sensor harus menyala HIJAU. Lampu berwarna lain (merah/kuning) atau mati menandakan kendala koneksi/sensor.",
        image: IlustrasiPanel,
      },
      {
        title: "Cek Fisik Kabel",
        body: "Periksa kabel dari unit ke sensor dan konektor. Pastikan tidak ada kabel putus, terkelupas, atau kendor. Jika ditemukan kerusakan, ambil foto sebagai bukti.",
      },
    ],
    reportLabel: "Belum Berhasil, Buat Laporan",
    reportPrefix:
      "[Nilai Tidak Sesuai] Setelah pengecekan mandiri sesuai panduan (indikator HMI/GSM, kabel sensor) nilai masih tidak sesuai. ",
  },
];

export function getScenario(slug: string): TroubleshootScenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
