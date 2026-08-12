import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Phone, X } from "lucide-react";
import Logo from "./Logo";

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan.")}`;

const NAV_ITEMS = [
  { label: "Beranda", href: "/#beranda" },
  { label: "Kendala", href: "/#kendala" },
  { label: "Alur", href: "/#alur" },
  { label: "Info", href: "/#info" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo className="h-9 w-9 rounded-xl object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold">Atap Care</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PT Atap Teknologi Indonesia</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-mono">0812421414</span>
          </a>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2.5">
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
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> 0812421414
            </a>
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
