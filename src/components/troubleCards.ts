import { Cpu, Router as RouterIcon, Wifi, Zap } from "lucide-react";

export const TROUBLE_CARDS = [
  {
    code: "TS-01",
    title: "Perangkat Tidak Menyala",
    desc: "Periksa sumber daya, adaptor, dan kabel. Bila tetap mati, laporkan dengan foto unit.",
    Icon: Zap,
  },
  {
    code: "TS-02",
    title: "Koneksi Terputus",
    desc: "Restart perangkat, tunggu 3 menit. Catat lampu indikator sebelum melapor.",
    Icon: Wifi,
  },
  {
    code: "TS-03",
    title: "Jaringan Lambat",
    desc: "Uji kecepatan pada dua perangkat berbeda lalu lampirkan hasilnya pada tiket.",
    Icon: RouterIcon,
  },
  {
    code: "TS-04",
    title: "Perangkat Bermasalah",
    desc: "Sebutkan kode unit dan gejala yang muncul agar teknisi menyiapkan sparepart.",
    Icon: Cpu,
  },
];
