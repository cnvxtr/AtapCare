import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Clock, LifeBuoy, Mail, FileText, Filter, CalendarClock, Wrench, CheckCircle2, BadgeCheck, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getLandingStats, type LandingStats } from "@/services/ticketService";
import SiteFooter from "@/components/SiteFooter";
import { SiteHeader, SocialIcon } from "@/components/SiteHeader";
import { TroubleshootCards } from "@/components/TroubleshootCards";

const ADMIN_EMAIL = "info@atapteknologi.id";
const ADMIN_PHONE_DISPLAY = "+62 822-8000-0694";
const ADMIN_PHONE_LINK = "6282280000694";

const SOCIALS: { href: string; label: string; children: React.ReactNode }[] = [
  {
    href: "https://facebook.com",
    label: "Facebook",
    children: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  },
  {
    href: "https://twitter.com",
    label: "Twitter",
    children: <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />,
  },
  {
    href: "https://linkedin.com",
    label: "LinkedIn",
    children: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
  {
    href: "https://instagram.com",
    label: "Instagram",
    children: (
      <>
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </>
    ),
  },
];

const FLOW_STEPS: { n: string; title: string; desc: string; Icon: typeof FileText }[] = [
  { n: "01", title: "Laporkan Kendala", desc: "Kirim laporan via portal, dapatkan ID tiket untuk pelacakan.", Icon: FileText },
  { n: "02", title: "Penilaian & Prioritas", desc: "Kendala ditelaah, prioritas ditetapkan, penanganan jarak jauh dicoba bila memungkinkan.", Icon: Filter },
  { n: "03", title: "Penjadwalan & Penugasan", desc: "Penanganan dijadwalkan dan ditugaskan ke personel lapangan.", Icon: CalendarClock },
  { n: "04", title: "Perbaikan di Lapangan", desc: "Kehadiran terekam, perbaikan dilaksanakan, bukti hasil & BAST diunggah.", Icon: Wrench },
  { n: "05", title: "Verifikasi Hasil", desc: "Hasil diverifikasi; dikembalikan untuk perbaikan ulang bila belum tuntas.", Icon: CheckCircle2 },
  { n: "06", title: "Penutupan Tiket", desc: "Tiket ditutup, pelanggan dikonfirmasi via WhatsApp.", Icon: BadgeCheck },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "Bagaimana cara melaporkan kendala?",
    a: "Buat akun pelanggan melalui halaman Login, lalu masuk dan gunakan form \"Lapor Masalah\" di Dashboard. Isi data site, unit, dan deskripsi masalah.",
  },
  {
    q: "Bagaimana cara melacak status laporan?",
    a: "Login ke akun pelanggan Anda. Semua tiket dan statusnya terlihat di Dashboard. Klik tiket untuk melihat detail dan timeline.",
  },
  {
    q: "Siapa yang akan menangani laporan saya?",
    a: "Laporan ditangani Helpdesk (Kustiara Bhakti) dan Project Manager (Aditya Okki), lalu diteruskan ke teknisi lapangan yang bertugas di lokasi Anda.",
  },
  {
    q: "Bagaimana jika gangguan terjadi di luar jam kerja (malam atau hari libur)?",
    a: "Laporan tetap dapat dikirim dan akan diproses pada jam operasional berikutnya (Senin–Jumat, 08.00–17.00 WIB). Untuk keadaan mendesak di luar jam kerja, hubungi tim kami melalui Grup WhatsApp Resmi.",
  },
];

const ZONE = "relative z-10 px-6 py-16 max-w-5xl mx-auto w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center scroll-mt-16";
const ZONE_TITLE = "text-2xl md:text-3xl font-display font-bold tracking-tight text-center mb-10";
const STATS_CACHE_KEY = "atapcare-landing-stats";

export default function Landing() {
  const [stats, setStats] = useState<LandingStats | null>(() => {
    try {
      const raw = localStorage.getItem(STATS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as LandingStats) : null;
    } catch {
      return null;
    }
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getLandingStats().then((s) => {
      if (!mounted) return;
      setStats(s);
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(s));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const badgeText = `${stats?.active_units ?? 0} Titik Aktif`;
  const faqItems = useMemo(() => FAQ_ITEMS, [])

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-clip flex flex-col">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-80" />

      <SiteHeader />

      <main id="beranda" className="relative z-10 flex-1 min-h-[calc(100vh-4rem)] scroll-mt-16 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono uppercase tracking-widest mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-ring" />
          {badgeText}
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight leading-[1.05]">
          Gerbang <span className="italic font-serif text-muted-foreground">Atap Care</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Kirim laporan kerusakan untuk perangkat Anda, lalu pantau perkembangannya secara real-time
          hingga selesai ditangani tim kami.
        </p>

        <div className="mt-8 flex justify-center w-full">
          <Link
            to="/login"
            className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] bg-black text-background font-medium hover:bg-black transition-all duration-500 text-sm"
          >
            <span className="transition-all duration-500 group-hover:pr-1">Lapor Masalah</span>
            <ArrowRight className="h-4 w-4 text-background transition-all duration-500 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0" />
          </Link>
        </div>
      </main>

      <TroubleshootCards />

      <section id="alur" className={ZONE}>
        <h2 className={ZONE_TITLE}>
          Alur <span className="italic font-serif text-muted-foreground">Layanan</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {FLOW_STEPS.map(({ n, title, desc, Icon }) => (
            <div
              key={n}
              className="group relative rounded-[3px] border border-border bg-card p-5 hover:border-foreground/30 transition"
            >
              <span className="font-mono text-3xl font-bold text-muted-foreground/30 group-hover:text-foreground/40 transition">
                {n}
              </span>
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-semibold text-sm leading-tight">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="info" className="relative z-10 px-6 pb-20 max-w-5xl mx-auto w-full scroll-mt-16">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3">
          <div className="space-y-3">
            <div className="rounded-[3px] border border-border bg-card p-6">
              <h2 className="text-lg font-display font-bold tracking-tight">
                Informasi <span className="italic font-serif text-muted-foreground">Penting</span>
              </h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background">
                    <Clock className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Jam Operasional</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Senin–Jumat · 08.00–17.00 WIB. Pelaporan di luar jam kerja akan diproses pada jam operasional berikutnya.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background">
                    <LifeBuoy className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Butuh Bantuan?</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Hubungi kami melalui chat atau hubungi admin.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[3px] border border-border bg-card p-6">
              <h2 className="text-lg font-display font-bold tracking-tight">
                Kontak <span className="italic font-serif text-muted-foreground">Kami</span>
              </h2>
              <div className="mt-4 space-y-4">
                <a href={`mailto:${ADMIN_EMAIL}`} className="flex items-center gap-3 group">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Email</p>
                    <p className="text-xs text-muted-foreground group-hover:text-foreground transition">{ADMIN_EMAIL}</p>
                  </div>
                </a>
                <a
                  href={`https://wa.me/${ADMIN_PHONE_LINK}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background">
                    <Phone className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Nomor Admin</p>
                    <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition">{ADMIN_PHONE_DISPLAY}</p>
                  </div>
                </a>
                <div className="flex items-center gap-3 pt-1">
                  {SOCIALS.map((s) => (
                    <SocialIcon key={s.label} href={s.href} label={s.label}>
                      {s.children}
                    </SocialIcon>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[3px] border border-border bg-card p-6 flex flex-col min-h-0">
            <h2 className="text-lg font-display font-bold tracking-tight">
              FAQ - <span className="italic font-serif text-muted-foreground">Pertanyaan Umum</span>
            </h2>
            <div className="mt-4 space-y-2 flex-1 min-h-0 overflow-y-auto">
              {faqItems.map((item, i) => (
                <div key={i} className="border border-border rounded-[3px] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-left cursor-pointer"
                  >
                    {item.q}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-3 text-sm text-muted-foreground border-t border-border pt-3">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
