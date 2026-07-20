import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Atap Care" }] }),
  component: Settings,
});

function Settings() {
  return (
    <AppShell title="Settings" subtitle="Master data · Role · Preferensi">
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { t: "Master Lokasi", d: "157 titik ASDP VMS + 154 titik INTANK" },
          { t: "Role & Akses", d: "Kelola boolean flag per akun teknisi" },
          { t: "SLA Preset", d: "P1 · P2 · P3 response & resolution time" },
          { t: "Notifikasi", d: "In-app lonceng · non-third-party" },
          { t: "WA Template", d: "One-click konfirmasi close ke pelanggan" },
          { t: "Preventive Schedule", d: "Otomatis buat tiket rutin bulanan" },
        ].map((s) => (
          <div key={s.t} className="rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition cursor-pointer">
            <h3 className="font-display font-bold">{s.t}</h3>
            <p className="text-xs text-muted-foreground mt-1">{s.d}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
