import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { getInventory, type InventoryItem } from "@/services";
import { AlertTriangle, Package, ShieldAlert, TrendingDown, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Atap Care" }] }),
  component: Inventory,
});

function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventory().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const lowStock = items.filter((i) => i.stock <= i.minStock);
  const totalQuarantine = items.reduce((s, i) => s + i.quarantine, 0);
  const totalStock = items.reduce((s, i) => s + i.stock, 0);

  if (loading) {
    return (
      <AppShell title="Inventory" subtitle="Memuat data…">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded mt-3" />
              <div className="h-8 w-16 bg-muted rounded mt-1" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Inventory"
      subtitle="Mutasi gudang, karantina & pengadaan"
      actions={
        <button className="px-3 py-2 rounded-lg bg-foreground text-background text-sm inline-flex items-center gap-1.5 hover:bg-foreground/90 transition">
          <Plus className="h-3.5 w-3.5" /> Ajukan Pengadaan
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total SKU" value={items.length.toString()} />
        <StatCard icon={TrendingDown} label="Total Stok" value={totalStock.toString()} />
        <StatCard icon={AlertTriangle} label="Stok Menipis" value={lowStock.length.toString()} tone="warning" />
        <StatCard icon={ShieldAlert} label="Karantina (RMA)" value={totalQuarantine.toString()} tone="destructive" />
      </div>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/5 p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/20 grid place-items-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-sm">Perhatian: {lowStock.length} SKU di bawah minimum</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Ajukan pengadaan ke Pak Dedy untuk mencegah kegagalan penugasan lapangan.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lowStock.map((i) => (
                  <span key={i.id} className="text-[10px] font-mono px-2 py-1 rounded bg-background border border-border">
                    {i.sku} · {i.stock}/{i.minStock}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <div className="col-span-2">SKU</div>
          <div className="col-span-4">Nama Barang</div>
          <div className="col-span-2">Kategori</div>
          <div className="col-span-1 text-right">Stok</div>
          <div className="col-span-1 text-right">Min</div>
          <div className="col-span-1 text-right">Karantina</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        <div className="divide-y divide-border">
          {items.map((i) => {
            const low = i.stock <= i.minStock;
            const pct = Math.min(100, (i.stock / (i.minStock * 3)) * 100);
            return (
              <div key={i.id} className="grid grid-cols-12 gap-3 px-6 py-3.5 items-center hover:bg-accent/40 transition">
                <div className="col-span-2 font-mono text-xs">{i.sku}</div>
                <div className="col-span-4 min-w-0">
                  <p className="text-sm font-medium truncate">{i.name}</p>
                  <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden max-w-[200px]">
                    <div className={`h-full rounded-full transition-all ${low ? "bg-destructive" : "bg-foreground"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">{i.category}</div>
                <div className="col-span-1 text-right font-mono text-sm font-medium">{i.stock}</div>
                <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">{i.minStock}</div>
                <div className="col-span-1 text-right font-mono text-xs">
                  {i.quarantine > 0 ? <span className="text-destructive">{i.quarantine}</span> : "—"}
                </div>
                <div className="col-span-1 text-right">
                  {low ? (
                    <span className="text-[10px] font-medium px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/30">Low</span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-1 rounded bg-success/10 text-success border border-success/30">OK</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "warning" | "destructive" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 overflow-hidden group hover:border-foreground/30 transition">
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
      <Icon className={`h-5 w-5 ${toneClass}`} />
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-3">{label}</p>
      <p className="text-3xl font-display font-bold mt-1">{value}</p>
    </div>
  );
}
