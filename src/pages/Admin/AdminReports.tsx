import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { selectTriggerFilter, selectTriggerFilterSm } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Badge as ColorBadge } from "@/components/Badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import DateRangePicker from "@/components/DateRangePicker";
import {
  getTicketReport,
  getKpiReport,
  getAuditReport,
  getSites,
  TICKET_REPORT_HEADERS,
  KPI_HEADERS,
  AUDIT_HEADERS,
  STATUS_FILTER_OPTIONS,
  exportStyledXlsx,
  todayStamp,
  type ReportFilters,
  type TicketReportRow,
} from "@/services";
import type { SiteRow } from "@/services";

type ExportCell = string | number | null | undefined;
type TabKey = "tickets" | "kpi" | "audit";

const fmtIso = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00`),
  );

const PRIORITY_OPTIONS = ["P1", "P2", "P3"].map((p) => ({ value: p, label: p }));

const DATASETS: Array<{ key: TabKey; label: string }> = [
  { key: "tickets", label: "Tiket & Penanganan" },
  { key: "kpi", label: "KPI Agregat" },
  { key: "audit", label: "Audit / Activity" },
];

const PRIORITY_COLS: Record<TabKey, number[]> = {
  tickets: [4],
  kpi: [0],
  audit: [],
};
const STATUS_COLS: Record<TabKey, number[]> = {
  tickets: [5],
  kpi: [],
  audit: [],
};

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-muted-foreground whitespace-nowrap">{label}</label>
      {children}
    </div>
  );
}

export function AdminReports({ helpdesk = false }: { helpdesk?: boolean } = {}) {
  const [tab, setTab] = useState<TabKey>("tickets");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [search, setSearch] = useState("");
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [tickets, setTickets] = useState<TicketReportRow[]>([]);
  const [kpis, setKpis] = useState<Array<Record<string, string | number>>>([]);
  const [audits, setAudits] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    getSites().then(setSites);
  }, []);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "tickets") setTickets(await getTicketReport(filters));
      if (tab === "kpi")
        setKpis((await getKpiReport(filters)) as unknown as Array<Record<string, string | number>>);
      if (tab === "audit")
        setAudits((await getAuditReport(filters)) as unknown as Array<Record<string, string>>);
    } finally {
      setLoading(false);
    }
  }, [tab, filters]);

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  const activeRows: ExportCell[][] =
    tab === "tickets"
      ? tickets.map((r) => Object.values(r))
      : tab === "kpi"
        ? kpis.map((r) => Object.values(r))
        : audits.map((r) => Object.values(r));

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((r) =>
      r.some((c) => String(c ?? "").toLowerCase().includes(q)),
    );
  }, [activeRows, search]);

  const activeHeaders: string[] =
    tab === "tickets"
      ? TICKET_REPORT_HEADERS
      : tab === "kpi"
        ? KPI_HEADERS
        : AUDIT_HEADERS;

  const stamp = todayStamp();
  const baseName = `atapcare-${tab}-${stamp}`;
  const datasetLabel = DATASETS.find((d) => d.key === tab)?.label || tab;

  // Snapshot data saat klik, bukan saat proses berjalan, agar ganti tab di
  // tengah tidak mengekspor dataset yang salah.
  function doExport() {
    if (exporting || visibleRows.length === 0) return;
    const rows = visibleRows.map((r) => [...r]);
    const headers = [...activeHeaders];
    const name = baseName;
    const label = datasetLabel;
    const periodText =
      filters.from && filters.to
        ? `${fmtIso(filters.from)} – ${fmtIso(filters.to)}`
        : "Semua Periode";
    setExporting(true);
    toast.info(`Menyiapkan unduhan XLSX "${label}"…`);
    exportStyledXlsx({
      rows,
      headers,
      sheetName: label,
      baseName: name,
      bandTitle: `${label} — ${periodText}`,
      priorityCols: PRIORITY_COLS[tab].map((c) => c + 1),
      statusCols: STATUS_COLS[tab].map((c) => c + 1),
    })
      .then(() => toast.success(`XLSX "${label}" berhasil diunduh (${rows.length} baris)`))
      .catch(() => toast.error("Gagal membuat file XLSX."))
      .finally(() => setExporting(false));
  }

  function setRange(from?: string, to?: string) {
    setFilters((f) => ({ ...f, from, to }));
  }

  function selectedRecord(arr: string[] | undefined): Record<string, boolean> {
    if (!arr?.length) return { all: true };
    return { all: false, ...Object.fromEntries(arr.map((v) => [v, true])) };
  }

  function toggleFilterValue(key: "siteId" | "status" | "priority", value: string) {
    setFilters((f) => {
      if (value === "all") return { ...f, [key]: undefined };
      const cur = (f[key] as string[] | undefined) ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...f, [key]: next.length ? next : undefined };
    });
  }

  return (
    <div className="space-y-4">
      {/* ─── Baris Filter ────────────────────────────────────────── */}
      <Card>
        <CardContent className="px-2.5 py-3">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-52 rounded border border-border bg-card pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-foreground"
              />
            </div>
            <FilterGroup label="Periode">
              <DateRangePicker from={filters.from} to={filters.to} onChange={setRange} />
            </FilterGroup>
            {tab !== "audit" && (
              <>
                <FilterGroup label="Site">
                  <MultiSelectFilter
                    label="Semua"
                    options={sites.map((s) => ({ value: s.id, label: s.name }))}
                    selected={selectedRecord(filters.siteId)}
                    onToggle={(v) => toggleFilterValue("siteId", v)}
                    className={selectTriggerFilter}
                  />
                </FilterGroup>
                <FilterGroup label="Status">
                  <MultiSelectFilter
                    label="Semua"
                    options={STATUS_FILTER_OPTIONS}
                    selected={selectedRecord(filters.status)}
                    onToggle={(v) => toggleFilterValue("status", v)}
                    className={selectTriggerFilterSm}
                  />
                </FilterGroup>
                <FilterGroup label="Prioritas">
                  <MultiSelectFilter
                    label="Semua"
                    options={PRIORITY_OPTIONS}
                    selected={selectedRecord(filters.priority)}
                    onToggle={(v) => toggleFilterValue("priority", v)}
                    className={selectTriggerFilterSm}
                  />
                </FilterGroup>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({});
                    setSearch("");
                  }}
                  title="Reset filter"
                  aria-label="Reset filter"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-foreground hover:text-primary-foreground"
                >
                  <RefreshCw className="h-4 w-4 shrink-0" />
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── 3 Tab Dataset ───────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        {!helpdesk && (
          <TabsList className="flex-wrap h-auto gap-1 rounded border border-border bg-card p-1.5">
            {DATASETS.map((d) => (
              <TabsTrigger
                key={d.key}
                value={d.key}
                className="border border-border rounded bg-card text-muted-foreground [&[data-state=active]]:bg-foreground [&[data-state=active]]:text-primary-foreground [&[data-state=active]]:border-foreground [&[data-state=active]]:shadow"
              >
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {DATASETS.filter((d) => !helpdesk || d.key === "tickets").map((d) => (
          <TabsContent key={d.key} value={d.key}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-foreground text-primary-foreground rounded">
                      {tab === "kpi"
                        ? visibleRows.reduce((s, r) => s + (Number(r[1]) || 0), 0)
                        : visibleRows.length}{" "}
                      {tab === "audit" ? "baris" : "tiket"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={doExport}
                      disabled={visibleRows.length === 0 || exporting}
                      className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:text-white rounded"
                    >
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      XLSX
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Memuat data…</p>
                ) : visibleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {search.trim()
                      ? "Tidak ditemukan hasil untuk pencarian."
                      : "Tidak ada data untuk filter ini."}
                  </p>
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                          <TableHeader>
                            <TableRow>
                              {activeHeaders.map((h) => (
                                <TableHead
                                  key={h}
                                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 py-2 whitespace-nowrap"
                                >
                                  {h}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                        <TableBody className="divide-y divide-border">
                          {visibleRows.map((r, i) => (
                            <TableRow key={i} className="hover:bg-muted">
                              {r.map((c, j) => (
                                <TableCell
                                  key={j}
                                  className="whitespace-nowrap text-[11px] px-2 py-2"
                                >
                                  {PRIORITY_COLS[tab].includes(j) ? (
                                    <ColorBadge type="priority" value={String(c ?? "—")} />
                                  ) : STATUS_COLS[tab].includes(j) ? (
                                    <ColorBadge type="status" value={String(c ?? "—")} />
                                  ) : (
                                    String(c ?? "—")
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

