import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Upload, CheckCircle2, Copy, Check, Phone, Loader2, AlertTriangle, X, Save } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { createTicket, getSitesForReport, type SiteReport } from "@/services";
import { loadDraft, clearDraft, persistDraft } from "@/lib/draft";
import { toast } from "sonner";
import logo from '../assets/logo.png'

const WA_NUMBER = "6281242141414";
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo AtapCare, saya butuh bantuan.")}`;
const MAX_PHOTOS = 5;
const MAX_TOTAL_SIZE_MB = 10;

export default function ReportPage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    let alive = true;
    getSitesForReport().then((data) => {
      if (!alive) return;
      setSites(data);
      setMdLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Pulihkan draft (BR 2.2: expiry 24 jam, dihapus loadDraft bila lewat).
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
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
    toast.info("Draft tersimpan dipulihkan.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave setiap 10 detik selama tidak dalam layar sukses (BR 2.2).
  useEffect(() => {
    if (submitted) return;
    const t = setTimeout(() => {
      persistDraft({ reporterName, position, phone, company, site, unit, desc }, photos);
    }, 10_000);
    return () => clearTimeout(t);
  }, [reporterName, position, phone, company, site, unit, desc, photos, submitted]);

  async function handleSaveDraft() {
    const status = await persistDraft({ reporterName, position, phone, company, site, unit, desc }, photos);
    if (status === 'ok') toast.success("Draft tersimpan. Anda bisa lanjut nanti.");
    else if (status === 'text') toast.warning("Draft teks tersimpan, foto tidak ikut (penyimpanan penuh).");
    else toast.error("Gagal menyimpan draft.");
  }

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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-accent transition text-xs font-medium"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-success" /> Tersalin</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Salin</>
                )}
              </button>
            </div>

            <p className="text-sm text-muted-foreground mt-5 animate-in fade-in duration-500 delay-300">
              Tim helpdesk akan menghubungi via WhatsApp.
            </p>

            <div className="mt-8 flex flex-col gap-3 animate-in fade-in duration-500 delay-[400ms]">
              <button
                onClick={handleCopyAndRedirect}
                className="w-full px-5 py-3 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm inline-flex items-center justify-center gap-2"
              >
                Lacak Tiket Sekarang
              </button>
              <Link
                to="/"
                className="w-full px-5 py-3 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm inline-flex items-center justify-center gap-2"
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
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Portal Publik</p>
          <h1 className="text-3xl font-display font-bold mt-2">Laporkan Kendala</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Isi formulir di bawah. Anda akan menerima nomor tiket untuk pelacakan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="grid md:grid-cols-2 gap-4">
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

          <div className="h-px bg-border" />

          <div className="grid md:grid-cols-3 gap-4">
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
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Belum ada Site terdaftar. Silakan hubungi Helpdesk via WhatsApp Group.</span>
            </div>
          )}

          <Field label={`Deskripsi Kendala (${desc.length}/500)`}>
            <textarea
              required maxLength={500} rows={4}
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent/40 transition inline-flex items-center gap-2"
            >
              <Save className="h-4 w-4" /> Simpan & Lanjut Nanti
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition disabled:opacity-50 inline-flex items-center gap-2">
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
          border-radius: 0.5rem;
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
