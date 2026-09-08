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
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import DateRangePicker from "@/components/DateRangePicker";
import TicketDrawer, { TicketTimeline, TicketDescription, AssignmentCard, type DrawerTab } from "@/components/TicketDrawer";
import { useTickets } from "@/context/TicketContext";
import {
  getTicketReport,
  getKpiReport,
  getRootCauseReport,
  getSerialNumberReport,
  getSites,
  TICKET_REPORT_HEADERS,
  KPI_HEADERS,
  ROOTCAUSE_HEADERS,
  SERIAL_NUMBER_HEADERS,
  exportStyledXlsx,
  todayStamp,
  type ReportFilters,
  type TicketReportRow,
} from "@/services";
import type { SiteRow } from "@/services";

type ExportCell = string | number | null | undefined;
type TabKey = "tickets" | "kpi" | "rootcause" | "sparepart";

const fmtIso = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00`),
  );

const PRIORITY_OPTIONS = ["Critical", "Medium", "Low"].map((p) => ({ value: p, label: p }));

const DATASETS: Array<{ key: TabKey; label: string }> = [
  { key: "tickets", label: "Tiket & Penanganan" },
  { key: "kpi", label: "KPI Agregat" },
  { key: "rootcause", label: "Akar Kendala" },
  { key: "sparepart", label: "Serial Number" },
];

// Per-role dataset: admin semua; helpdesk tiket + akar kendala.
function datasetsFor(mode: "admin" | "helpdesk") {
  return DATASETS.filter((d) =>
    mode === "admin" ? true : d.key === "tickets" || d.key === "rootcause",
  );
}

const PRIORITY_COLS: Record<TabKey, number[]> = {
  tickets: [6],
  kpi: [0],
  rootcause: [],
  sparepart: [],
};
const STATUS_COLS: Record<TabKey, number[]> = {
  tickets: [7],
  kpi: [],
  rootcause: [],
  sparepart: [],
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
  const mode: "admin" | "helpdesk" = helpdesk ? "helpdesk" : "admin";
  const visibleDatasets = datasetsFor(mode);
  const [tab, setTab] = useState<TabKey>("tickets");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [search, setSearch] = useState("");
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadedKeys, setLoadedKeys] = useState<Partial<Record<TabKey, string>>>({});
  const { tickets: allTickets } = useTickets();
  const [selectedTicket, setSelectedTicket] = useState<TicketReportRow | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>("detail");

  const [tickets, setTickets] = useState<TicketReportRow[]>([]);
  const [kpis, setKpis] = useState<Array<Record<string, string | number>>>([]);
  const [audits, setAudits] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    getSites().then(setSites);
  }, []);

  const loadDataset = useCallback(async () => {
    const filtersKey = JSON.stringify(filters);
    if (loadedKeys[tab] === filtersKey) return;
    setLoading(true);
    try {
      if (tab === "tickets") setTickets(await getTicketReport({ ...filters, status: ["CLOSED"] }));
      if (tab === "kpi")
        setKpis((await getKpiReport(filters)) as unknown as Array<Record<string, string | number>>);
      if (tab === "rootcause")
        setKpis((await getRootCauseReport(filters)) as unknown as Array<Record<string, string | number>>);
      if (tab === "sparepart")
        setAudits((await getSerialNumberReport(filters)) as unknown as Array<Record<string, string>>);
    } finally {
      setLoading(false);
      setLoadedKeys((prev) => ({ ...prev, [tab]: filtersKey }));
    }
  }, [tab, filters, loadedKeys]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDataset();
  }, [loadDataset]);

  const activeRows: ExportCell[][] =
    tab === "tickets"
      ? tickets.map((r) => Object.values(r))
      : tab === "kpi" || tab === "rootcause"
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
        : tab === "rootcause"
            ? ROOTCAUSE_HEADERS
            : SERIAL_NUMBER_HEADERS;

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
            <div className="relative grow">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full min-w-0 rounded-lg border border-border bg-card pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <FilterGroup label="Periode">
              <DateRangePicker from={filters.from} to={filters.to} onChange={setRange} />
            </FilterGroup>
            {(tab === "tickets" || tab === "kpi") && (
              <>
                <FilterGroup label="Site">
                  <MultiSelectFilter
                    label="Semua"
                    options={sites.map((s) => ({ value: s.id, label: s.name }))}
                    selected={selectedRecord(filters.siteId)}
                    onToggle={(v) => toggleFilterValue("siteId", v)}
                    className={`${selectTriggerFilter} max-md:min-w-[100px]`}
                  />
                </FilterGroup>
                <FilterGroup label="Prioritas">
                  <MultiSelectFilter
                    label="Semua"
                    options={PRIORITY_OPTIONS}
                    selected={selectedRecord(filters.priority)}
                    onToggle={(v) => toggleFilterValue("priority", v)}
                    className={`${selectTriggerFilterSm} max-md:min-w-[90px]`}
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
        {mode === "admin" && (
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

        {visibleDatasets.map((d) => (
          <TabsContent key={d.key} value={d.key}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-foreground text-primary-foreground rounded">
                      {tab === "kpi"
                        ? visibleRows.reduce((s, r) => s + (Number(r[1]) || 0), 0)
                        : visibleRows.length}{" "}
                      tiket
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
                  <div className="space-y-2 py-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : visibleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {search.trim()
                      ? "Tidak ditemukan hasil untuk pencarian."
                      : "Tidak ada data untuk filter ini."}
                  </p>
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="min-w-[900px]">
                      <Table>
                          <TableHeader>
                            <TableRow>
                              {activeHeaders.map((h) => (
                                <TableHead
                                  key={h}
                                  className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-1.5 py-1.5 whitespace-nowrap"
                                >
                                  {h}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                        <TableBody className="divide-y divide-border">
                          {visibleRows.map((r, i) => (
                            <TableRow key={i} className="hover:bg-muted cursor-pointer" onClick={() => { if (tab === 'tickets') { setSelectedTicket(tickets[i]); setActiveDrawerTab('detail') } }}>
                              {r.map((c, j) => (
                                <TableCell
                                  key={j}
                                  className="text-[10px] px-1.5 py-1.5"
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {selectedTicket && (() => {
        const live = allTickets.find(t => t.code === selectedTicket.code)
        const acts = live?.activities || []
        const status = live?.status || selectedTicket.status
        const isFinal = ['CLOSED', 'RESOLVED', 'VOID', 'DUPLICATE', 'REJECTED'].includes(status)
        return (
          <TicketDrawer
            onClose={() => setSelectedTicket(null)}
            code={selectedTicket.code}
            ticketId={live?.id}
            status={status}
            priority={live?.priority || selectedTicket.priority}
            createdAt={live?.createdAt || ''}
            activeTab={activeDrawerTab}
            onTabChange={setActiveDrawerTab}
            activities={live?.activities}
            duplicateCode={live?.duplicateOf ?? undefined}
            footer={<p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>}
          >
            {activeDrawerTab === 'detail' && (
              <div className="space-y-4">
                <AssignmentCard items={acts} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/60 p-4 rounded-lg border border-border">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Pelapor</p>
                    <p className="font-medium text-sm">{live?.customer || selectedTicket.customer}</p>
                  </div>
                  <div className="bg-muted/60 p-4 rounded-lg border border-border">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Site / Unit</p>
                    <p className="font-medium text-sm">{live?.site || selectedTicket.site} - {live?.unit || selectedTicket.unit}</p>
                  </div>
                </div>
                <TicketDescription description={live?.description || ''} />
              </div>
            )}
            {activeDrawerTab === 'timeline' && <TicketTimeline items={acts} isFinal={isFinal} />}
          </TicketDrawer>
        )
      })()}
    </div>
  );
}

