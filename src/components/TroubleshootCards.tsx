import { Cpu, Router as RouterIcon, Wifi, Zap } from "lucide-react";
import Reveal from "@/components/Reveal";

const TROUBLE_CARDS = [
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

export function TroubleshootCards() {
  return (
    <section
      id="kendala"
      className="relative z-10 mx-auto w-full max-w-5xl scroll-mt-16 px-6 py-20"
    >
      <Reveal className="mb-10">
        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
          Kendala <span className="italic font-serif text-muted-foreground">Umum</span>
        </h2>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TROUBLE_CARDS.map(({ code, title, desc, Icon }, i) => (
          <Reveal key={code} delay={i * 80}>
            <article className="sweep group h-full rounded-[3px] border border-border bg-card p-5 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/40">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-foreground text-background">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-foreground">
                  {code}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-tight">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
