import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { getScenario } from "@/lib/troubleshoot";
import NotFound from "./NotFound";

export default function Troubleshoot() {
  const { scenario } = useParams();
  const navigate = useNavigate();
  const data = getScenario(scenario ?? "");

  if (!data) return <NotFound />;
  const { slug, title, subtitle, Icon, iconClass, guideTitle, steps, reportLabel } = data;

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

        <div className="flex items-start gap-4 mb-6">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] border ${iconClass}`}>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mt-1">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="rounded-[3px] border border-border bg-card p-4 sm:p-5">
          <p className="text-sm flex items-start gap-2">
            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{guideTitle}</span>
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-[3px] border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-background font-mono text-xs font-bold">
                  {i + 1}
                </span>
                <h2 className="font-semibold text-sm">{s.title}</h2>
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              {s.image && (
                <img
                  src={s.image}
                  alt={`Ilustrasi ${s.title}`}
                  className="mt-3 w-full rounded-[3px] border border-border object-cover"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate(`/report?kendala=${encodeURIComponent(slug)}`)}
            className="w-full px-5 py-3 rounded-[3px] bg-foreground text-background font-medium hover:bg-foreground/90 transition text-sm inline-flex items-center justify-center gap-2"
          >
            {reportLabel} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <SiteFooter />
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
