import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { workloadData } from "@/services";
import { Phone, MessageCircle, Wrench } from "lucide-react";

export const Route = createFileRoute("/app/technicians")({
  head: () => ({ meta: [{ title: "Technicians — Atap Care" }] }),
  component: Techs,
});

const roles = [
  { name: "Rahma", role: "Sys Admin", flags: ["is_sys_admin"], phone: "+62 812 0001", active: 0 },
  { name: "Kustiara", role: "Helpdesk", flags: ["is_helpdesk"], phone: "+62 812 0002", active: 12 },
  { name: "Pak Dedy", role: "Supervisor", flags: ["is_supervisor"], phone: "+62 812 0003", active: 0 },
  { name: "Aditya", role: "Supervisor", flags: ["is_supervisor", "is_field_tech"], phone: "+62 812 0004", active: 3 },
  { name: "Endang Suryadi", role: "Warehouse", flags: ["is_warehouse"], phone: "+62 812 0005", active: 0 },
  ...workloadData.map((w, i) => ({
    name: w.name, role: "Field Engineer", flags: ["is_field_tech"], phone: `+62 812 010${i}`, active: w.tickets,
  })),
];

function Techs() {
  return (
    <AppShell title="Personel" subtitle="11 akun · Modular role via boolean flags">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r.name} className="rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition group">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-foreground to-foreground/60 text-background font-display font-bold grid place-items-center shrink-0">
                {r.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.role}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.flags.map((f) => (
                    <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              </div>
              {r.active > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-2xl font-display font-bold leading-none">{r.active}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">aktif</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
              <button className="flex-1 h-8 rounded-lg border border-border text-xs inline-flex items-center justify-center gap-1.5 hover:bg-accent transition">
                <MessageCircle className="h-3 w-3" /> WA
              </button>
              <button className="flex-1 h-8 rounded-lg border border-border text-xs inline-flex items-center justify-center gap-1.5 hover:bg-accent transition">
                <Phone className="h-3 w-3" /> Call
              </button>
              <button className="flex-1 h-8 rounded-lg bg-foreground text-background text-xs inline-flex items-center justify-center gap-1.5 hover:bg-foreground/90 transition">
                <Wrench className="h-3 w-3" /> Assign
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
