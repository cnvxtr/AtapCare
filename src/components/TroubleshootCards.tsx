import { Link } from "react-router-dom";
import Reveal from "@/components/Reveal";
import { TROUBLE_CARDS } from "./troubleCards";

export function TroubleshootCards() {
  return (
    <section
      id="kendala"
      className="relative z-10 mx-auto w-full max-w-5xl scroll-mt-16 px-6 py-20"
    >
      <Reveal className="mb-10">
        <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
          Kendala Umum
        </h2>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TROUBLE_CARDS.map(({ code, title, desc, Icon }, i) => (
          <Reveal key={code} delay={i * 80}>
            <Link
              to={`/customer/report?dari=${code}`}
              className="sweep group block h-full rounded-[3px] border border-border bg-card p-5 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/40 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-foreground text-background">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-foreground">
                  {code}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-tight">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
