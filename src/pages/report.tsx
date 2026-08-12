import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, CheckCircle2, Copy, Check, Loader2, AlertTriangle, X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { SiteHeader } from "@/components/SiteHeader";
import { createTicket, getSitesForReport, type SiteReport } from "@/services";
import { loadDraft, clearDraft, persistDraft, saveDraft, type ReportDraftFields } from "@/lib/draft";
import { getScenario } from "@/lib/troubleshoot";
import { toast } from "sonner";

const MAX_PHOTOS = 5;
const MAX_TOTAL_SIZE_MB = 10;

export default function ReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reporterName, setReporterName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const [unit, setUnit] = useState("");
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [sites, setSites] = useState<SiteReport[]>([]);
  const [mdLoading, setMdLoading] = useState(true);
  const fieldsRef = useRef<ReportDraftFields>({ reporterName: "", position: "", phone: "", company: "", site: "", unit: "", desc: "" });
  const lastPhotosRef = useRef<string[]>([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getSitesForReport().then((data) => {
      if (!alive) return;
      setSites(data);
      setMdLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Pulihkan draft per-sesi (sessionStorage).
  // Prefill skenario troubleshoot bila dibuka via /report?kendala=<slug>.
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      const prefix = getScenario(searchParams.get("kendala") ?? "")?.reportPrefix;
      if (prefix) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill skenario one-shot
        setDesc(prefix);
      }
      return;
    }
    setReporterName(draft.reporterName);
    setPosition(draft.position);
    setPhone(draft.phone);
    setCompany(draft.company);
    setSite(draft.site);
    setUnit(draft.unit);
    setDesc(draft.desc);
    if (draft.photos.length) {
      Promise.all(draft.photos.map(dataUrlToFile)).then(setPhotos).catch(() => setPhotos([]));
    }
    toast.info("Draft tersimpan dipulihkan.", { id: "draft-restore" });
  }, [searchParams]);

  // Autosave setiap 10 detik selama tidak dalam layar sukses.
  useEffect(() => {
    if (submitted) return;
    const t = setTimeout(async () => {
      const { dataUrls } = await persistDraft({ reporterName, position, phone, company, site, unit, desc }, photos);
      lastPhotosRef.current = dataUrls;
    }, 10_000);
    return () => clearTimeout(t);
  }, [reporterName, position, phone, company, site, unit, desc, photos, submitted]);

  // Flush sinkron saat tab ditutup/reload (pagehide) atau navigasi keluar dari
  // halaman (unmount): draft tersimpan begitu form terisi, tanpa menunggu autosave.
  useEffect(() => {
    fieldsRef.current = { reporterName, position, phone, company, site, unit, desc };
  }, [reporterName, position, phone, company, site, unit, desc]);

  useEffect(() => {
    const flush = () => {
      if (submittedRef.current) return;
      saveDraft(fieldsRef.current, lastPhotosRef.current);
    };
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, []);

  const NO_COMPANY = "(Tanpa Perusahaan)";
  const companyOptions = Array.from(new Set(sites.map((s) => s.customer_name || NO_COMPANY))).map((n) => ({ value: n, label: n }));
  const siteOptions = sites
    .filter((s) => (s.customer_name || NO_COMPANY) === company)
    .map((s) => ({ value: s.site_name, label: s.site_name }));
  const unitOptions = (sites.find((s) => s.site_name === site)?.units || []).map((u) => ({ value: u, label: u }));

  useEffect(() => {
    if (!submitted) return;
    if (countdown <= 0) {
      navigate(`/track?ticket=${encodeURIComponent(ticketId)}`);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [submitted, countdown, ticketId, navigate]);

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError("");
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setPhotos(prev => {
      const merged = [...prev, ...files];
      if (merged.length > MAX_PHOTOS) {
        setPhotoError(`Maksimal ${MAX_PHOTOS} foto. Saat ini ${prev.length} foto sudah dipilih.`);
        return prev;
      }
      const totalSize = merged.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        setPhotoError(`Total ukuran foto maks ${MAX_TOTAL_SIZE_MB} MB.`);
        return prev;
      }
      return merged;
    });
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhotoError("");
    setSubmitError("");
    if (!site || !unit) {
      setSubmitError("Site dan Unit/Perangkat wajib diisi.");
      return;
    }
    if (!photos.length) {
      setPhotoError("Foto pendukung wajib diunggah.");
      return;
    }
    setSubmitting(true);

    const result = await createTicket({
      reporterName,
      position,
      phone,
      site,
      unit,
      description: desc,
      photos,
    });

    if (result?.code) {
      setTicketId(result.code);
      clearDraft();
      submittedRef.current = true;
      setSubmitted(true);
    } else {
      setSubmitError(result?.error || "Gagal mengirim tiket. Silakan coba lagi.");
    }
    setSubmitting(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyAndRedirect() {
    handleCopy();
    setTimeout(() => {
      navigate(`/track?ticket=${encodeURIComponent(ticketId)}`);
    }, 800);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <SiteHeader />
        <div className="relative flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-success/10 grid place-items-center animate-in zoom-in duration-300">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>

            <h1 className="text-2xl font-display font-bold animate-in fade-in duration-500">
              Tiket Berhasil Dikirim!
            </h1>
            <p className="text-sm text-muted-foreground mt-2 animate-in fade-in duration-500 delay-100">
              Laporan Anda telah diterima oleh sistem helpdesk kami.
            </p>

            <div className="mt-6 inline-flex items-center gap-3 px-5 py-3.5 rounded-xl border border-border bg-card w-full animate-in slide-in-from-bottom duration-500 delay-200">
              <span className="text-xs text-muted-foreground">Kode Tiket</span>
              <span className="font-mono text-sm font-bold flex-1 text-left">{ticketId}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-background border border-border hover:bg-accent transition text-xs font-medium"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-success" /> Tersalin</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Salin</>
                )}
              </button>
            </div>

            <p className="text-sm text-muted-foreground mt-5 animate-in fade-in duration-500 delay-300">
              Tim akan menghubungi via WhatsApp.
            </p>

            <div className="mt-8 flex flex-col gap-3 animate-in fade-in duration-500 delay-[400ms]">
              <button
                onClick={handleCopyAndRedirect}
                className="w-full px-5 py-3 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm inline-flex items-center justify-center gap-2"
              >
                Lacak Tiket Sekarang
              </button>
              <Link
                to="/"
                className="w-full px-5 py-3 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm inline-flex items-center justify-center gap-2"
              >
                Kembali ke Beranda
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground font-mono">
              Mengalihkan otomatis ke pelacakan dalam {countdown} detik…
            </p>

            <p className="mt-6 text-sm text-muted-foreground">
              Sudah punya ID Tiket?{" "}
              <Link to="/track" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
                Lacak di sini
              </Link>
            </p>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <SiteHeader />
      <div className="relative flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[3px] bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mt-2">Laporkan Kendala</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Isi formulir di bawah. Anda akan menerima nomor tiket untuk pelacakan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-[3px] border border-border bg-card p-4 sm:p-6">
          <section>
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Identitas Pelapor</h2>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Field label="Nama Pelapor">
                <input required value={reporterName} onChange={(e) => setReporterName(e.target.value)} className="input" placeholder="Nama lengkap" />
              </Field>
              <Field label="Jabatan">
                <input required value={position} onChange={(e) => setPosition(e.target.value)} className="input" placeholder="Contoh: Teknisi, Supervisor" />
              </Field>
              <Field label="Nomor WhatsApp">
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="" />
              </Field>
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Lokasi Unit</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <Field label="Perusahaan">
                <Combobox
                  options={companyOptions}
                  value={company}
                  onChange={(v) => { setCompany(v); setSite(""); setUnit(""); }}
                  placeholder="Pilih perusahaan…"
                  disabled={mdLoading || sites.length === 0}
                />
              </Field>
              <Field label="Site">
                <Combobox
                  options={siteOptions}
                  value={site}
                  onChange={(v) => { setSite(v); setUnit(""); }}
                  placeholder="Pilih site…"
                  disabled={!company}
                />
              </Field>
              <Field label="Unit / Perangkat">
                <Combobox
                  options={unitOptions}
                  value={unit}
                  onChange={setUnit}
                  placeholder="Pilih unit…"
                  disabled={!site}
                  emptyText="Belum ada unit di site ini"
                />
              </Field>
            </div>

            {!mdLoading && sites.length === 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Belum ada Site terdaftar. Silakan hubungi Helpdesk via WhatsApp Group.</span>
              </div>
            )}
          </section>

          <section className="border-t border-border pt-6">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Detail Kendala</h2>
            <div className="space-y-4 mt-4">
              <Field label={`Deskripsi Kendala (${desc.length}/2000)`}>
                <textarea
                  required maxLength={2000} rows={4}
                  value={desc} onChange={(e) => setDesc(e.target.value)}
                  className="input resize-none"
                  placeholder="Jelaskan kendala yang terjadi, kapan mulai bermasalah, dampak…"
                />
              </Field>

              <Field label={`Foto Pendukung (${photos.length}/${MAX_PHOTOS})`}>
                <label className="flex items-center gap-3 p-4 border border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/40 transition">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Klik untuk upload</p>
                    <p className="text-xs text-muted-foreground">JPG / JPEG / PNG · maks {MAX_PHOTOS} foto · total maks {MAX_TOTAL_SIZE_MB} MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    className="hidden"
                    onChange={handlePhotosChange}
                  />
                </label>
                {photoError && (
                  <p className="text-xs text-destructive mt-1.5">{photoError}</p>
                )}
                {photos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {photos.map((file, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Foto ${idx + 1}`}
                          className="h-16 w-16 rounded-lg object-cover border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background grid place-items-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          </section>

          <div className="flex justify-end pt-4 border-t border-border">
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition disabled:opacity-50 inline-flex items-center gap-2">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim…</> : "Kirim Tiket"}
            </button>
          </div>
          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{submitError}</p>
            </div>
          )}
        </form>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

async function dataUrlToFile(dataUrl: string, index: number): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], `draft-${index}.jpg`, { type: "image/jpeg" });
}
