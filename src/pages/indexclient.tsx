import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import logo from '../assets/logo.png'

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan.")}`;

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-clip flex flex-col">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-80" />

      <SiteHeader />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono uppercase tracking-widest mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-ring" />
          311 Titik Aktif · ASDP VMS + INTANK
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight leading-[1.05]">
          Gerbang <span className="italic font-serif text-muted-foreground">Atap Care</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Kirim laporan kerusakan untuk perangkat Anda, lalu pantau perkembangannya secara real-time
          hingga selesai ditangani teknisi kami.
        </p>

        <div className="mt-8 grid sm:grid-cols-2 gap-3 w-full max-w-md">
          <Link
            to="/report"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm"
          >
            Lapor Kendala <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/track"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] border border-border bg-card text-foreground font-medium hover:border-foreground/30 transition text-sm"
          >
            Pelacakan <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Atap Care" className="h-9 w-9 rounded-xl object-contain" />
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
