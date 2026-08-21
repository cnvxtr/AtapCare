import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SCENARIOS } from "@/lib/troubleshoot";

export function TroubleshootCards() {
  return (
    <section
      id="kendala"
      className="relative z-10 px-6 py-16 max-w-5xl mx-auto w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center scroll-mt-16"
    >
      <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-center mb-3">
        Kendala <span className="italic font-serif text-muted-foreground">Umum?</span>
      </h2>
      <p className="text-center text-sm text-muted-foreground mb-8">
        Coba cek dulu dengan panduan cepat — sebagian kendala bisa teratasi tanpa teknisi.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {SCENARIOS.map(({ slug, title, subtitle, Icon, iconClass }) => (
          <Link
            key={slug}
            to={`/troubleshoot/${slug}`}
            className="group relative rounded-[3px] border border-border bg-card p-6 hover:border-foreground/30 transition flex items-start gap-4"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border ${iconClass}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold tracking-tight">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
              <p className="mt-2 text-xs font-medium inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                Mulai Panduan <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Kendala Anda tidak ada di pilihan atas?{" "}
        <Link to="/login" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
          Langsung Buat Laporan Manual Tanpa Panduan →
        </Link>
      </p>
    </section>
  );
}
