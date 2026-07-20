import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Download, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — Atap Care" }] }),
  component: Reports,
});

const reports = [
  { title: "Total Tiket per Periode", desc: "Open, In Progress, Resolved, Closed dalam rentang tanggal.", owner: "Rahma, Kustiara, Aditya" },
  { title: "SLA Compliance Rate", desc: "Persentase teknisi menyelesaikan tepat waktu per prioritas.", owner: "Aditya, Rahma" },
  { title: "Average Resolution Time", desc: "Durasi rata-rata dari Open ke Resolved, per teknisi & kategori.", owner: "Aditya" },
  { title: "Technician Workload", desc: "Beban kerja per teknisi, distribusi P1/P2/P3.", owner: "Aditya" },
  { title: "Mutasi Inventaris", desc: "Log keluar-masuk barang per teknisi + tanggal.", owner: "Endang, Rahma" },
  { title: "Fast-Moving Items", desc: "Barang paling sering habis dalam 30 hari terakhir.", owner: "Endang" },
  { title: "Rasio Karantina / RMA", desc: "Persentase barang rusak vs total mutasi.", owner: "Endang, Aditya" },
];

function Reports() {
  return (
    <AppShell title="Laporan & Analitik" subtitle="Dasbor visual · Export Excel .xlsx">
      <div className="grid md:grid-cols-2 gap-3">
        {reports.map((r) => (
          <div key={r.title} className="group rounded-2xl border border-border bg-card p-5 hover:border-foreground/30 transition">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold">{r.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3">
                  Akses: {r.owner}
                </p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition h-9 w-9 rounded-lg border border-border grid place-items-center hover:bg-accent">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
