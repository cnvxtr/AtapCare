import { Link } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan.")}`;

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <p className="text-6xl font-display font-bold text-muted-foreground/30">404</p>
          <h1 className="text-xl font-display font-bold mt-4">Halaman tidak ditemukan.</h1>
          <p className="text-sm text-muted-foreground mt-2">
            URL yang Anda akses tidak tersedia atau telah dipindahkan.
          </p>
          <Link
            to={isAuthenticated ? "/dashboard" : "/"}
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAuthenticated ? "Kembali ke Dashboard" : "Kembali ke Beranda"}
          </Link>
        </div>
      </div>
      <SiteFooter />
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
