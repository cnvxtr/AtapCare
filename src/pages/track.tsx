import { Link, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Search, Clock, CheckCircle2, AlertCircle, Copy, Check, Phone, Loader2, User } from "lucide-react";
import { getTicketByCode } from "@/services";
import logo from '../assets/logo.png'

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan terkait tiket saya.")}`;

export default function TrackPage() {
  const [searchParams] = useSearchParams();
  const urlTicket = searchParams.get("ticket") || "";

  const [ticketId, setTicketId] = useState(urlTicket);
  const [result, setResult] = useState<{
    status: string; site: string; unit: string; updated: string; technician: string | null
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);

  const isFromSubmit = !!urlTicket && !!result;

  const doSearch = useCallback(async (id: string) => {
    setSearching(true);
    const ticket = await getTicketByCode(id.trim().toUpperCase());

    if (ticket) {
      setResult({
        status:
          ticket.status === "NEW" || ticket.status === "OPEN"
            ? "antrian"
            : ticket.status === "WORKING" || ticket.status === "EN_ROUTE" || ticket.status === "SCHEDULED"
            ? "diproses"
            : ticket.status === "RESOLVED" || ticket.status === "CLOSED"
            ? "selesai"
            : "antrian",
        site: ticket.site,
        unit: ticket.unit,
        updated: new Date(ticket.updatedAt || ticket.createdAt).toLocaleString("id-ID", {
          day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        technician: ticket.technicianName,
      });
      setNotFound(false);
    } else {
      setResult(null);
      setNotFound(true);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (urlTicket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      doSearch(urlTicket);
    }
  }, [urlTicket, doSearch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(ticketId);
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusConfig = {
    antrian: { label: "Dalam Antrian", color: "text-yellow-600", bg: "bg-yellow-500/10", icon: Clock },
    diproses: { label: "Sedang Diproses", color: "text-blue-600", bg: "bg-blue-500/10", icon: AlertCircle },
    selesai: { label: "Selesai", color: "text-green-600", bg: "bg-green-500/10", icon: CheckCircle2 },
  };

  const displayId = ticketId.trim().toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 max-w-xl mx-auto px-6 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Portal Publik</p>
          <h1 className="text-3xl font-display font-bold mt-2">Pelacakan Tiket</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Masukkan nomor tiket Anda untuk melihat status laporan.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="Contoh: ATC-20260728-X7K9"
            className="input flex-1"
          />
          <button type="submit" disabled={searching} className="px-5 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition disabled:opacity-50 inline-flex items-center gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cari
          </button>
        </form>

        {isFromSubmit && result && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
            <div className="h-14 w-14 rounded-full bg-success/10 grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-xl font-display font-bold">Tiket Berhasil Dikirim!</h2>

            <div className="mt-4 inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-background w-full max-w-sm">
              <span className="text-xs text-muted-foreground">Kode</span>
              <span className="font-mono text-sm font-bold flex-1 text-left">{displayId}</span>
              <button
                type="button"
                onClick={() => handleCopy(displayId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-accent transition text-xs font-medium"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-success" /> Tersalin</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Salin</>
                )}
              </button>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Tim helpdesk akan menghubungi via WhatsApp.
            </p>
          </div>
        )}

        {searching && !result && !notFound && (
          <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Mencari tiket…</p>
          </div>
        )}

        {notFound && !searching && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium">ID Tiket tidak ditemukan.</p>
            <p className="text-xs text-muted-foreground mt-1">Periksa kembali nomor tiket Anda.</p>
          </div>
        )}

        {result && (() => {
          const cfg = statusConfig[result.status as keyof typeof statusConfig];
          const StatusIcon = cfg.icon;
          return (
            <div className="mt-4 rounded-xl border border-border bg-muted p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{displayId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(displayId)}
                    className="p-1 rounded-md hover:bg-accent transition"
                    title="Salin"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Site</p>
                  <p className="font-medium">{result.site}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Unit / Perangkat</p>
                  <p className="font-medium">{result.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Terakhir Update</p>
                  <p className="font-medium">{result.updated}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Teknisi</p>
                  <p className="font-medium inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {result.technician || <span className="text-muted-foreground italic">Belum ditugaskan</span>}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        <p className="mt-8 text-xs text-center text-muted-foreground font-mono">
          Status diperbarui secara real-time ·{" "}
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
            Hubungi jika ada kendala
          </a>
        </p>
      </div>
      <SiteFooter />

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--background);
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input:focus {
          border-color: var(--foreground);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--foreground) 10%, transparent);
        }
      `}</style>
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
