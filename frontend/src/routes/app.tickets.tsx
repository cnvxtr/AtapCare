import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { getTickets, statusColors, priorityColors, type TicketStatus, type Ticket } from "@/services";
import { Search, LayoutGrid, List, Pause, Clock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/tickets")({
  head: () => ({ meta: [{ title: "Tickets — Atap Care" }] }),
  component: Tickets,
});

const statuses: TicketStatus[] = ["Open", "In Progress", "Pending", "Resolved", "Closed", "Rejected"];

function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [q, setQ] = useState("");

  useEffect(() => {
    getTickets().then((data) => {
      setTickets(data);
      setLoading(false);
    });
  }, []);

  const filtered = tickets.filter(
    (t) => !q || t.code.toLowerCase().includes(q.toLowerCase()) || t.customer.toLowerCase().includes(q.toLowerCase()) || t.equipment.toLowerCase().includes(q.toLowerCase())
  );

  if (loading) {
    return (
      <AppShell title="Tickets" subtitle="Memuat data…">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat tiket…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Tickets"
      subtitle={`${filtered.length} tiket · Realtime sync`}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
            <button onClick={() => setView("kanban")} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${view === "kanban" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button onClick={() => setView("list")} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card w-64 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode, klien, alat…" className="bg-transparent flex-1 outline-none" />
          </div>
        </div>
      }
    >
      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statuses.map((s) => {
            const items = filtered.filter((t) => t.status === s);
            return (
              <div key={s} className="rounded-2xl border border-border bg-card/50">
                <div className="p-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded border ${statusColors[s]}`}>{s}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {items.map((t) => (
                    <div key={t.id} className="rounded-xl border border-border bg-card p-3 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${priorityColors[t.priority]}`}>{t.priority}</span>
                      </div>
                      <p className="text-xs font-medium leading-snug line-clamp-2">{t.equipment}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{t.customer} · {t.location}</p>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          {t.slaPaused ? <><Pause className="h-2.5 w-2.5" /> Paused</> : <><Clock className="h-2.5 w-2.5" /> SLA</>}
                        </span>
                        {t.assignee && (
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-foreground to-foreground/60 text-background text-[9px] font-bold grid place-items-center">
                            {t.assignee[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center text-[10px] text-muted-foreground py-8">Kosong</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="col-span-2">Kode</div>
            <div className="col-span-3">Alat & Klien</div>
            <div className="col-span-2">Lokasi</div>
            <div className="col-span-1">Pri</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Teknisi</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((t) => (
              <div key={t.id} className="grid grid-cols-12 gap-3 px-6 py-3.5 items-center hover:bg-accent/40 transition group cursor-pointer">
                <div className="col-span-2 font-mono text-xs">{t.code}</div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium truncate">{t.equipment}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.customer}</p>
                </div>
                <div className="col-span-2 text-xs">{t.location}</div>
                <div className="col-span-1">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${priorityColors[t.priority]}`}>{t.priority}</span>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border ${statusColors[t.status]}`}>
                    {t.slaPaused && <Pause className="h-2.5 w-2.5" />}
                    {t.status}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {t.assignee || <span className="italic">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
