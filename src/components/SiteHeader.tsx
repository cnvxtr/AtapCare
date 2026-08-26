import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { LoginIcon } from "./LoginIcon";
import Logo from "./Logo";

const NAV_ITEMS = [
  { label: "Beranda", href: "/#beranda" },
  { label: "Kendala Umum", href: "/#kendala" },
  { label: "Alur Layanan", href: "/#alur" },
  { label: "Informasi", href: "/#info" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo className="h-9 w-9 rounded-xl object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-bold uppercase tracking-[0.2em]">Atap Care</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PT Atap Teknologi Indonesia</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative px-3 py-2 text-sm text-muted-foreground transition-colors duration-300 after:absolute after:bottom-1 after:left-3 after:right-3 after:h-px after:origin-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:text-foreground hover:after:origin-left hover:after:scale-x-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 min-w-[180px] justify-end">
          <Link to="/login" className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-[3px] text-xs font-semibold hover:opacity-90 transition">
            <LoginIcon size={14} /> Masuk
          </Link>
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded hover:bg-accent transition" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-border bg-background/95 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition border-b border-border last:border-0"
              >
                {item.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setOpen(false)} className="px-2 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition inline-flex items-center gap-1.5 border-b border-border">
              <LoginIcon size={14} /> Masuk
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
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
