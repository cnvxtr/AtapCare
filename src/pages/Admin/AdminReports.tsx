import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { selectTriggerFilter, selectTriggerFilterSm } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import { STATUS_LABELS } from "@/components/Badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Loader2, Search, Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import DateRangePicker from "@/components/DateRangePicker";
import { isNativePlatform } from "@/lib/platform";
import { useIsMobile } from "@/lib/platform";
import TicketDrawer, { TicketTimeline, TicketDescription, AssignmentCard, type DrawerTab } from "@/components/TicketDrawer";
import { useTickets } from "@/context/TicketContext";
import { notifyTicketCode } from "@/services/notifications";
import {
  getTicketReport,
  getKpiReport,
  getSerialNumberReport,
  getReportCompanies,
  TICKET_REPORT_HEADERS,
  TICKET_REPORT_TABLE_HEADERS,
  TICKET_REPORT_TABLE_INDEXES,
  TICKET_EXPORT_INDEXES,
  KPI_HEADERS,
  SERIAL_NUMBER_HEADERS,
  exportStyledXlsx,
  exportStyledPdf,
  todayStamp,
  type ReportFilters,
  type TicketReportRow,
} from "@/services";

type ExportCell = string | number | null | undefined;
type TabKey = "tickets" | "kpi" | "sparepart";

const fmtIso = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00`),
  );

const PRIORITY_OPTIONS = ["Critical", "Medium", "Low"].map((p) => ({ value: p, label: p }));

const DATASETS: Array<{ key: TabKey; label: string }> = [
  { key: "tickets", label: "Tiket & Penanganan" },
  { key: "kpi", label: "KPI Agregat" },
  { key: "sparepart", label: "Serial Number" },
];

function datasetsFor(mode: "admin" | "helpdesk") {
  return DATASETS.filter((d) =>
    mode === "admin" ? true : d.key === "tickets" || d.key === "sparepart",
  );
}

const PRIORITY_COLS: Record<TabKey, number[]> = {
  tickets: [6],
  kpi: [0],
  sparepart: [],
};
const STATUS_COLS: Record<TabKey, number[]> = {
  tickets: [7],
  kpi: [],
  sparepart: [],
};

const TICKET_PRIORITY_PROP = 8;
const TICKET_STATUS_PROP = 9;

function FilterGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className || ""}`}>
      <label className="text-xs text-muted-foreground whitespace-nowrap truncate hidden md:inline">{label}</label>
      {children}
    </div>
  );
}

export function AdminReports({ helpdesk = false }: { helpdesk?: boolean } = {}) {
  const mode: "admin" | "helpdesk" = helpdesk ? "helpdesk" : "admin";
  const isMobile = useIsMobile();
  const visibleDatasets = datasetsFor(mode);
  const [tab, setTab] = useState<TabKey>("tickets");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loadedKeys, setLoadedKeys] = useState<Partial<Record<TabKey, string>>>({});
  const { tickets: allTickets } = useTickets();
  const [selectedTicket, setSelectedTicket] = useState<TicketReportRow | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>("detail");

  const [tickets, setTickets] = useState<TicketReportRow[]>([]);
  const location = useLocation();
  const notifyOpenCode = notifyTicketCode(location.state, location.search);
  const navigate = useNavigate();
  useEffect(() => {
    if (!notifyOpenCode) return
    const t = tickets.find((x) => x.code === notifyOpenCode)
    if (!t) return
    setSelectedTicket(t)
    setActiveDrawerTab("detail")
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyOpenCode, tickets])
  const [kpis, setKpis] = useState<Array<Record<string, string | number>>>([]);
  const [audits, setAudits] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, tab]);

  useEffect(() => {
    getReportCompanies().then(setCompanies);
  }, []);

  const loadDataset = useCallback(async () => {
    const filtersKey = JSON.stringify(filters);
    if (loadedKeys[tab] === filtersKey) return;
    setLoading(true);
    try {
      if (tab === "tickets") setTickets(await getTicketReport(filters));
      if (tab === "kpi")
        setKpis((await getKpiReport(filters)) as unknown as Array<Record<string, string | number>>);
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
  const visibleTicketIndices = useMemo(() => {
    if (tab !== "tickets") return [] as number[];
    const q = search.trim().toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const row = Object.values(tickets[i]);
      if (q && !row.some((c) => String(c ?? "").toLowerCase().includes(q))) continue;
      out.push(i);
    }
    return out;
  }, [tickets, search, tab]);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, page, pageSize]);
  const visibleInternalRows = useMemo(() => {
    if (tab !== "tickets") return new Set<number>();
    const q = search.trim().toLowerCase();
    const set = new Set<number>();
    let vi = 0;
    for (const t of tickets) {
      const row = Object.values(t);
      if (q && !row.some((c) => String(c ?? "").toLowerCase().includes(q))) continue;
      if (t.source === "internal") set.add(vi);
      vi++;
    }
    return set;
  }, [tickets, search, tab]);

  const activeHeaders: string[] =
    tab === "tickets"
      ? TICKET_REPORT_TABLE_HEADERS
      : tab === "kpi"
        ? KPI_HEADERS
        : SERIAL_NUMBER_HEADERS;
  const displayHeaders: string[] = ["No", ...activeHeaders];
  const activeIndexes: number[] =
    tab === "tickets"
      ? TICKET_REPORT_TABLE_INDEXES
      : Array.from({ length: activeHeaders.length }, (_, i) => i);
  const exportHeaders: string[] =
    tab === "tickets" ? TICKET_REPORT_HEADERS : activeHeaders;

  const stamp = todayStamp();
  const baseName = `atapcare-${tab}-${stamp}`;
  const datasetLabel = DATASETS.find((d) => d.key === tab)?.label || tab;

  function doExport(format: "xlsx" | "pdf" = "xlsx") {
    if (exporting || visibleRows.length === 0) return;
    const rows =
      tab === "tickets"
        ? visibleRows.map((r, i) => [i + 1, ...TICKET_EXPORT_INDEXES.map((idx) => r[idx])])
        : visibleRows.map((r) => [...r]);
    const headers = tab === "tickets" ? ["No", ...TICKET_REPORT_HEADERS] : [...exportHeaders];
    const name = baseName;
    const label = datasetLabel;
    const periodText =
      filters.from && filters.to
        ? `${fmtIso(filters.from)} – ${fmtIso(filters.to)}`
        : "Semua Periode";
    const priorityCols =
      tab === "tickets"
        ? [TICKET_EXPORT_INDEXES.indexOf(TICKET_PRIORITY_PROP) + 2]
        : PRIORITY_COLS[tab].map((c) => c + 1);
    const statusCols =
      tab === "tickets"
        ? [TICKET_EXPORT_INDEXES.indexOf(TICKET_STATUS_PROP) + 2]
        : STATUS_COLS[tab].map((c) => c + 1);
    const filterBox = [
      filters.company?.length ? `Perusahaan: ${filters.company.join(", ")}` : null,
      filters.site?.length ? `Site: ${filters.site.join(", ")}` : null,
      filters.unit?.length ? `Unit: ${filters.unit.join(", ")}` : null,
      filters.priority?.length ? `Prioritas: ${filters.priority.join(", ")}` : null,
      filters.status?.length ? `Status: ${filters.status.map((s) => STATUS_LABELS[s] || s).join(", ")}` : null,
    ].filter(Boolean).join("\n") || undefined;
    const highlightRows = tab === "tickets"
      ? (() => {
          const q = search.trim().toLowerCase();
          const out: number[] = [];
          let vi = 0;
          for (const t of tickets) {
            const row = Object.values(t);
            if (q && !row.some((c) => String(c ?? "").toLowerCase().includes(q))) continue;
            if (t.source === "internal") out.push(vi);
            vi++;
          }
          return out;
        })()
      : [];
    setExporting(true);
    if (!isNativePlatform()) toast.info(`Menyiapkan unduhan ${format.toUpperCase()} "${label}"…`);
    const exporter = format === "pdf" ? exportStyledPdf : exportStyledXlsx;
    exporter({
      rows,
      headers,
      sheetName: label,
      baseName: name,
      bandTitle: `${label} — ${periodText}`,
      filterBox,
      highlightRows,
      priorityCols,
      statusCols,
    })
      .then(() => { if (!isNativePlatform()) toast.success(`${format.toUpperCase()} "${label}" berhasil diunduh (${rows.length} baris)`) })
      .catch(() => toast.error(`Gagal membuat file ${format.toUpperCase()}.`))
      .finally(() => setExporting(false));
  }

  function setRange(from?: string, to?: string) {
    setFilters((f) => ({ ...f, from, to }));
  }

  function selectedRecord(arr: string[] | undefined): Record<string, boolean> {
    if (!arr?.length) return { all: true };
    return { all: false, ...Object.fromEntries(arr.map((v) => [v, true])) };
  }

  function toggleFilterValue(key: "company" | "priority" | "status", value: string) {
    setFilters((f) => {
      if (value === "all") return { ...f, [key]: undefined };
      const cur = (f[key] as string[] | undefined) ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...f, [key]: next.length ? next : undefined };
    });
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
        <div className={`bg-card p-1 rounded-xl border border-border grid gap-1 ${mode === "admin" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2"}`}>
          {visibleDatasets.map((d) => (
            <button
              key={d.key}
              onClick={() => setTab(d.key)}
              className={`px-3.5 h-8 rounded-[3px] text-xs font-medium transition inline-flex items-center justify-center gap-1.5 ${
                tab === d.key
                  ? "bg-foreground text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

      <Card>
        <CardContent className="px-2.5 py-3">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            <div className="relative flex-1 min-w-[7rem] md:grow md:min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full min-w-0 rounded-lg border border-border bg-card pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <label className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap truncate">Periode</label>
              <DateRangePicker from={filters.from} to={filters.to} onChange={setRange} />
            </div>
            {tab === "tickets" && (
              <div className="w-full md:w-auto flex flex-wrap gap-x-1.5 gap-y-2">
                <FilterGroup label="Perusahaan" className="flex-1 md:flex-none">
                    <MultiSelectFilter
                      label={isMobile ? "Perusahaan" : "Semua"}
                      options={companies.map((c) => ({ value: c, label: c }))}
                      selected={selectedRecord(filters.company)}
                      onToggle={(v) => toggleFilterValue("company", v)}
                      className={`${selectTriggerFilter} w-full md:w-auto max-md:min-w-[100px]`}
                    />
                </FilterGroup>
                <FilterGroup label="Prioritas" className="flex-1 md:flex-none">
                  <MultiSelectFilter
                    label={isMobile ? "Prioritas" : "Semua"}
                    options={PRIORITY_OPTIONS}
                    selected={selectedRecord(filters.priority)}
                    onToggle={(v) => toggleFilterValue("priority", v)}
                    className={`${selectTriggerFilterSm} w-full md:w-auto max-md:min-w-[90px]`}
                  />
                </FilterGroup>
                <FilterGroup label="Status" className="flex-1 md:flex-none">
                  <MultiSelectFilter
                    label={isMobile ? "Status" : "Semua"}
                    options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                    selected={selectedRecord(filters.status)}
                    onToggle={(v) => toggleFilterValue("status", v)}
                    className={`${selectTriggerFilterSm} w-full md:w-auto max-md:min-w-[90px]`}
                  />
                </FilterGroup>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {visibleDatasets.map((d) => (
          <TabsContent key={d.key} value={d.key} className="mt-0">
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
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExportOpen((o) => !o)}
                      disabled={visibleRows.length === 0 || exporting}
                      className="rounded"
                      aria-label="Unduh laporan"
                    >
                      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                    {exportOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                        <div className="absolute right-0 mt-1 z-20 flex flex-col gap-0 rounded border border-border bg-card p-0 shadow-md min-w-[110px] overflow-hidden">
                        <button
                          type="button"
                          disabled={exporting}
                          onClick={() => { setExportOpen(false); doExport("xlsx"); }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-none bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 w-full"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
                        </button>
                        <button
                          type="button"
                          disabled={exporting}
                          onClick={() => { setExportOpen(false); doExport("pdf"); }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-none bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 w-full"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                      </>
                    )}
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
                    <>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="overflow-x-auto">
                      <div className={tab === "kpi" ? "w-full" : "min-w-[900px]"}>
                      <Table>
                          <TableHeader>
                            <TableRow>
                              {displayHeaders.map((h) => (
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
                          {paginatedRows.map((r, i) => (
                            <TableRow key={i} className={`hover:bg-muted cursor-pointer ${visibleInternalRows.has((page - 1) * pageSize + i) ? "text-yellow-700" : ""}`} onClick={() => { if (tab === 'tickets') { const ticketIndex = visibleTicketIndices[(page - 1) * pageSize + i]; if (ticketIndex !== undefined) setSelectedTicket(tickets[ticketIndex]); setActiveDrawerTab('detail') } }}>
                              <TableCell
                                key="no"
                                className="text-[10px] px-1.5 py-1.5 w-8 text-center"
                              >
                                {(page - 1) * pageSize + i + 1}
                              </TableCell>
                              {activeIndexes.map((idx, j) => (
                                <TableCell
                                  key={j}
                                  className="text-[10px] px-1.5 py-1.5"
                                >
                                  {PRIORITY_COLS[tab].includes(j) ? (
                                    <ColorBadge type="priority" value={String(r[idx] ?? "-")} />
                                  ) : STATUS_COLS[tab].includes(j) ? (
                                    <ColorBadge type="status" value={String(r[idx] ?? "-")} />
                                  ) : (
                                    String(r[idx] ?? "-")
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
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Sebelumnya">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">{page} / {Math.max(1, Math.ceil(visibleRows.length / pageSize))}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(visibleRows.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(visibleRows.length / pageSize))} aria-label="Berikutnya">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    </>
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

