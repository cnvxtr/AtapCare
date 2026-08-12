import { Link, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Search, Clock, CheckCircle2, AlertCircle, Copy, Check, Loader2, User } from "lucide-react";
import { getTicketByCode, getPublicTimeline, type PublicTimelineItem } from "@/services";
import { resolvePhotos } from "@/services/photoService";
import { sanitizeTimeline } from "@/components/TicketDrawer";
import { SiteHeader } from "@/components/SiteHeader";
import { OrderTracking } from "@/components/ui/order-tracking";

const WA_LINK = `https://wa.me/6281242141414?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan terkait tiket saya.")}`;

const STATUS_LABEL: Record<string, string> = {
  NEW: "Baru",
  OPEN: "Diproses",
  UNASSIGNED: "Belum Ditugaskan",
  SCHEDULED: "Ditugaskan",
  EN_ROUTE: "Dalam Perjalanan",
  WORKING: "Dikerjakan",
  PENDING: "Dijeda",
  RESOLVED: "Selesai",
  CLOSED: "Selesai",
  VOID: "Dibatalkan",
  DUPLICATE: "Duplikat",
  REJECTED: "Ditolak",
};

function labelForAction(action: string): string {
  if (action.startsWith("Tiket dibuat")) return "Laporan Dibuat";
  if (action === "Tiket dijeda") return "Tiket Dijeda";
  const m = action.match(/^Status:\s*.*?\s*->\s*(.+)$/);
  if (m) return STATUS_LABEL[m[1].trim()] || action;
  return action;
}

// Details pending: "Ditunda: <alasan> [ | Foto (N):\n<path1>\n<path2>]".
function parsePendingDetails(details?: string | null): { reason: string; photos: string[] } {
  if (!details) return { reason: "", photos: [] };
  const m = details.match(/^Ditunda:\s*(.*?)(?:\s*\|\s*Foto \(\d+\):\s*\n(.*))?$/s);
  if (!m) return { reason: details, photos: [] };
  return { reason: m[1].trim(), photos: m[2] ? m[2].split("\n").map(s => s.trim()).filter(Boolean) : [] };
}

function formatWib(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TrackPage() {
  const [searchParams] = useSearchParams();
  const urlTicket = searchParams.get("ticket") || "";

  const [ticketId, setTicketId] = useState(urlTicket);
  const [result, setResult] = useState<{
    status: string; site: string; unit: string; updated: string; technician: string | null; rawStatus: string
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastSearched, setLastSearched] = useState("");
  const [timeline, setTimeline] = useState<PublicTimelineItem[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<Record<string, string>>({});

  const isFromSubmit = !!urlTicket && !!result;

  const doSearch = useCallback(async (id: string) => {
    setSearching(true);
    const code = id.trim().toUpperCase();
    const ticket = await getTicketByCode(code);
    const tl = await getPublicTimeline(code);
    setLastSearched(code);

    if (ticket) {
      setResult({
        status: ticket.status,
        site: ticket.site,
        unit: ticket.unit,
        updated: formatWib(ticket.updatedAt || ticket.createdAt),
        technician: ticket.technicianName,
        rawStatus: ticket.status,
      });
      setTimeline(tl);
      setNotFound(false);
    } else {
      setResult(null);
      setTimeline([]);
      setNotFound(true);
    }
    setSearching(false);
  }, []);

  // Polling 30s selama hasil tampil; berhenti saat status final
  // (Realtime anon diblokir RLS → polling adalah jalur yang diizinkan blueprint 2.8.1).
  useEffect(() => {
    if (!lastSearched || !result) return
    if (["CLOSED", "VOID", "DUPLICATE", "REJECTED"].includes(result.rawStatus)) return
    const t = setInterval(() => { doSearch(lastSearched) }, 30_000)
    return () => clearInterval(t)
  }, [lastSearched, result, doSearch]);

  useEffect(() => {
    if (urlTicket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      doSearch(urlTicket);
    }
  }, [urlTicket, doSearch]);

  // Resolve foto bukti pending ke signed URL (anon diizinkan via policy migration 32).
  useEffect(() => {
    const paths: string[] = [];
    for (const item of timeline) {
      if (item.action !== "Tiket dijeda") continue;
      paths.push(...parsePendingDetails(item.details).photos);
    }
    if (!paths.length) { setPendingPhotoUrls({}); return; }
    let active = true;
    resolvePhotos(paths).then((m) => { if (active) setPendingPhotoUrls(m); });
    return () => { active = false; };
  }, [timeline]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(ticketId);
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
    NEW: { label: STATUS_LABEL.NEW, color: "text-blue-600", bg: "bg-blue-500/10", icon: Clock },
    OPEN: { label: STATUS_LABEL.OPEN, color: "text-blue-600", bg: "bg-blue-500/10", icon: AlertCircle },
    UNASSIGNED: { label: STATUS_LABEL.UNASSIGNED, color: "text-indigo-600", bg: "bg-indigo-500/10", icon: Clock },
    SCHEDULED: { label: STATUS_LABEL.SCHEDULED, color: "text-indigo-600", bg: "bg-indigo-500/10", icon: Clock },
    EN_ROUTE: { label: STATUS_LABEL.EN_ROUTE, color: "text-blue-600", bg: "bg-blue-500/10", icon: AlertCircle },
    WORKING: { label: STATUS_LABEL.WORKING, color: "text-blue-600", bg: "bg-blue-500/10", icon: AlertCircle },
    PENDING: { label: STATUS_LABEL.PENDING, color: "text-amber-600", bg: "bg-amber-500/10", icon: Clock },
    RESOLVED: { label: STATUS_LABEL.RESOLVED, color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle2 },
    CLOSED: { label: STATUS_LABEL.CLOSED, color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle2 },
    VOID: { label: STATUS_LABEL.VOID, color: "text-muted-foreground", bg: "bg-muted", icon: AlertCircle },
    DUPLICATE: { label: STATUS_LABEL.DUPLICATE, color: "text-muted-foreground", bg: "bg-muted", icon: AlertCircle },
    REJECTED: { label: STATUS_LABEL.REJECTED, color: "text-red-600", bg: "bg-red-500/10", icon: AlertCircle },
  };

  const displayId = ticketId.trim().toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 max-w-xl mx-auto px-6 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[3px] bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
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
          <button type="submit" disabled={searching} className="px-5 py-2.5 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition disabled:opacity-50 inline-flex items-center gap-2">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-card border border-border hover:bg-accent transition text-xs font-medium"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-success" /> Tersalin</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Salin</>
                )}
              </button>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Tim akan menghubungi via WhatsApp.
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
          const cfg = statusConfig[result.status] ?? statusConfig.NEW;
          const StatusIcon = cfg.icon;
          const isFinal = ["CLOSED", "RESOLVED", "VOID", "DUPLICATE", "REJECTED"].includes(result.status);
          const steps = timeline.map((item, i) => {
            const { action, details } = sanitizeTimeline(item.action, item.details ?? undefined);
            return {
              name: labelForAction(action),
              timestamp: formatWib(item.created_at),
              isCompleted: i < timeline.length - 1 || isFinal,
              details: action === "Tiket dijeda" ? (() => {
                const { reason, photos } = parsePendingDetails(details);
                return (
                  <>
                    {reason && (
                      <p className="text-xs text-muted-foreground">
                        Alasan: <span className="text-foreground font-medium">{reason}</span>
                      </p>
                    )}
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {photos.map((p, j) => {
                          const url = pendingPhotoUrls[p];
                          return url ? (
                            <a key={j} href={url} target="_blank" rel="noopener noreferrer"
                              className="block w-20 h-20 rounded-lg overflow-hidden border border-border hover:opacity-90 transition"
                              title="Buka foto bukti">
                              <img src={url} alt={`Bukti pending ${j + 1}`} className="w-full h-full object-cover" loading="lazy" />
                            </a>
                          ) : null;
                        })}
                      </div>
                    )}
                  </>
                );
              })() : details ? (
                <p className="whitespace-pre-wrap">{details}</p>
              ) : undefined,
            };
          });
          return (
            <div className="mt-4 rounded-xl border border-border bg-muted p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{displayId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(displayId)}
                    className="p-1 rounded-[3px] hover:bg-accent transition"
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

              {steps.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Riwayat Status</h3>
                  <OrderTracking steps={steps} />
                </div>
              )}
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
          border-radius: 3px;
          border: 1.5px solid hsl(var(--foreground) / 15%);
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
