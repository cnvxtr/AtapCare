import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import {
  getTicketReport,
  getKpiReport,
  getOvertimeReport,
  getAuditReport,
  getMasterDataReport,
  getArchiveSnapshot,
  getSites,
  getTechnicians,
  TICKET_REPORT_HEADERS,
  KPI_HEADERS,
  OVERTIME_HEADERS,
  AUDIT_HEADERS,
  MASTER_DATA_HEADERS,
  exportCsv,
  exportXlsx,
  todayStamp,
  type ReportFilters,
  type TicketReportRow,
} from "@/services";
import type { SiteRow } from "@/services";

type ExportCell = string | number | null | undefined;
type ExportFormat = "CSV" | "XLSX" | "PDF";
type TabKey = "tickets" | "kpi" | "overtime" | "audit" | "master" | "archive";

const STATUS_OPTIONS = [
  "NEW",
  "OPEN",
  "UNASSIGNED",
  "SCHEDULED",
  "EN_ROUTE",
  "WORKING",
  "PENDING",
  "CLOSED",
  "DUPLICATE",
];
const PRIORITY_OPTIONS = ["P1", "P2", "P3"];

const DATASETS: Array<{ key: TabKey; label: string }> = [
  { key: "tickets", label: "Tiket & Penanganan" },
  { key: "kpi", label: "KPI Agregat" },
  { key: "overtime", label: "Lembur (HR)" },
  { key: "audit", label: "Audit / Activity" },
  { key: "master", label: "Master Data" },
  { key: "archive", label: "Snapshot Arsip" },
];

type FilterField = {
  key: keyof ReportFilters;
  label: string;
  type: "date" | "select";
  options?: string[];
};

const FILTER_FIELDS: Record<TabKey, FilterField[]> = {
  tickets: [
    { key: "from", label: "Dari Tanggal", type: "date" },
    { key: "to", label: "Sampai Tanggal", type: "date" },
    { key: "siteId", label: "Site", type: "select" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "priority", label: "Prioritas", type: "select", options: PRIORITY_OPTIONS },
  ],
  kpi: [
    { key: "from", label: "Dari Tanggal", type: "date" },
    { key: "to", label: "Sampai Tanggal", type: "date" },
    { key: "siteId", label: "Site", type: "select" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "priority", label: "Prioritas", type: "select", options: PRIORITY_OPTIONS },
  ],
  overtime: [
    { key: "from", label: "Dari Tanggal", type: "date" },
    { key: "to", label: "Sampai Tanggal", type: "date" },
    { key: "technicianId", label: "Teknisi", type: "select" },
  ],
  audit: [
    { key: "from", label: "Dari Tanggal", type: "date" },
    { key: "to", label: "Sampai Tanggal", type: "date" },
  ],
  master: [],
  archive: [
    { key: "from", label: "Dari Tanggal", type: "date" },
    { key: "to", label: "Sampai Tanggal", type: "date" },
    { key: "siteId", label: "Site", type: "select" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { key: "priority", label: "Prioritas", type: "select", options: PRIORITY_OPTIONS },
  ],
};

export function AdminReports() {
  const [tab, setTab] = useState<TabKey>("tickets");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const [tickets, setTickets] = useState<TicketReportRow[]>([]);
  const [kpis, setKpis] = useState<Array<Record<string, string | number>>>([]);
  const [overtime, setOvertime] = useState<Array<Record<string, string | number>>>([]);
  const [audits, setAudits] = useState<Array<Record<string, string>>>([]);
  const [masterRows, setMasterRows] = useState<Array<Record<string, string>>>([]);
  const [archive, setArchive] = useState<TicketReportRow[]>([]);

  useEffect(() => {
    getSites().then(setSites);
    getTechnicians().then((t) => setTechnicians(t.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "tickets") setTickets(await getTicketReport(filters));
      if (tab === "kpi")
        setKpis((await getKpiReport(filters)) as unknown as Array<Record<string, string | number>>);
      if (tab === "overtime")
        setOvertime(
          (await getOvertimeReport(filters)) as unknown as Array<Record<string, string | number>>,
        );
      if (tab === "audit")
        setAudits((await getAuditReport(filters)) as unknown as Array<Record<string, string>>);
      if (tab === "master")
        setMasterRows((await getMasterDataReport()) as unknown as Array<Record<string, string>>);
      if (tab === "archive") setArchive(await getArchiveSnapshot(filters));
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
        : tab === "overtime"
          ? overtime.map((r) => Object.values(r))
          : tab === "audit"
            ? audits.map((r) => Object.values(r))
            : tab === "master"
              ? masterRows.map((r) => Object.values(r))
              : archive.map((r) => Object.values(r));

  const activeHeaders: string[] =
    tab === "tickets"
      ? TICKET_REPORT_HEADERS
      : tab === "kpi"
        ? KPI_HEADERS
        : tab === "overtime"
          ? OVERTIME_HEADERS
          : tab === "audit"
            ? AUDIT_HEADERS
            : tab === "master"
              ? MASTER_DATA_HEADERS
              : TICKET_REPORT_HEADERS;

  const stamp = todayStamp();
  const baseName = `atapcare-${tab}-${stamp}`;
  const datasetLabel = DATASETS.find((d) => d.key === tab)?.label || tab;

  function doPdf(rows: ExportCell[][], headers: string[], name: string, label: string) {
    const w = window.open("", "_blank", "width=1100,height=700");
    if (!w) {
      toast.error("Popup diblokir — izinkan popup lalu coba lagi");
      return;
    }
    const tableRows = rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td>${String(c ?? "").replace(/</g, "&lt;")}</td>`).join("")}</tr>`,
      )
      .join("");
    const headerRows = headers.map((h) => `<th>${h}</th>`).join("");
    w.document.write(`
      <html><head><title>Laporan ${name}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#111}
        h2{font-size:18px;margin-bottom:4px}
        p{color:#666;font-size:12px;margin:0 0 16px}
        table{border-collapse:collapse;width:100%;font-size:11px}
        th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}
        th{background:#f3f4f6;font-weight:600}
      </style></head><body>
      <h2>Atap Care — ${label}</h2>
      <p>Dihasilkan ${new Date().toLocaleString("id-ID")}</p>
      <table><thead><tr>${headerRows}</tr></thead><tbody>${tableRows}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  // Simulasi proses unduhan: spinner → proses ekspor → toast sukses.
  // Snapshot data saat klik, bukan saat timeout, agar ganti tab di tengah tidak
  // mengekspor dataset yang salah.
  function simulateExport(fmt: ExportFormat) {
    if (exporting || activeRows.length === 0) return;
    const rows = activeRows.map((r) => [...r]);
    const headers = [...activeHeaders];
    const name = baseName;
    const label = datasetLabel;
    setExporting(fmt);
    toast.info(`Menyiapkan unduhan ${fmt} "${label}"…`);
    window.setTimeout(() => {
      if (fmt === "CSV") exportCsv([headers, ...rows], name);
      else if (fmt === "XLSX") exportXlsx([headers, ...rows], name, label);
      else doPdf(rows, headers, name, label);
      setExporting(null);
      toast.success(`${fmt} "${label}" berhasil diunduh (${rows.length} baris)`);
    }, 1200);
  }

  const fields = FILTER_FIELDS[tab];
  const hasFilter = Object.keys(filters).some((k) => Boolean(filters[k as keyof ReportFilters]));
  const gridClass =
    fields.length <= 2 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-6";

  function updateFilter(key: keyof ReportFilters, value: string | undefined) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  function renderField(field: FilterField) {
    if (field.type === "date") {
      return (
        <div key={field.key}>
          <label className="text-[11px] font-medium text-muted-foreground">{field.label}</label>
          <Input
            type="date"
            value={String(filters[field.key] || "").slice(0, 10)}
            onChange={(e) =>
              updateFilter(
                field.key,
                e.target.value ? new Date(e.target.value).toISOString() : undefined,
              )
            }
          />
        </div>
      );
    }

    const options =
      field.key === "siteId"
        ? sites.map((s) => ({ value: s.id, label: s.name }))
        : field.key === "technicianId"
          ? technicians.map((t) => ({ value: t.id, label: t.name }))
          : (field.options || []).map((o) => ({ value: o, label: o }));

    return (
      <div key={field.key}>
        <label className="text-[11px] font-medium text-muted-foreground">{field.label}</label>
        <Select
          value={String(filters[field.key] || "")}
          onValueChange={(v) => updateFilter(field.key, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Semua" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Baris Filter Dinamis (mengikuti tab aktif) ─────────── */}
      <Card>
        <CardContent className="p-4">
          {fields.length === 0 ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Dataset <span className="font-medium text-muted-foreground">{datasetLabel}</span> tidak
                memerlukan filter. Data diambil langsung dari hierarki Customer → Site → Unit.
              </p>
              {hasFilter && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                  Reset
                </Button>
              )}
            </div>
          ) : (
            <div className={`grid gap-3 ${gridClass}`}>
              {fields.map(renderField)}
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={loadDataset}
                  disabled={loading}
                  title="Muat ulang"
                >
                  <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                {hasFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 6 Tab Dataset ───────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex-wrap h-auto">
          {DATASETS.map((d) => (
            <TabsTrigger key={d.key} value={d.key}>
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {DATASETS.map((d) => (
          <TabsContent key={d.key} value={d.key}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{activeRows.length} baris</Badge>
                    <span className="text-xs text-muted-foreground">
                      {tab === "overtime"
                        ? "Data lembur untuk diolah HR"
                        : `${d.label} — periode terpilih`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => simulateExport("CSV")}
                      disabled={activeRows.length === 0 || exporting !== null}
                    >
                      {exporting === "CSV" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => simulateExport("XLSX")}
                      disabled={activeRows.length === 0 || exporting !== null}
                    >
                      {exporting === "XLSX" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      XLSX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => simulateExport("PDF")}
                      disabled={activeRows.length === 0 || exporting !== null}
                    >
                      {exporting === "PDF" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      PDF
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Memuat data…</p>
                ) : activeRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Tidak ada data untuk filter ini.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {activeHeaders.map((h) => (
                            <TableHead key={h} className="whitespace-nowrap text-[11px]">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRows.map((r, i) => (
                          <TableRow key={i}>
                            {r.map((c, j) => (
                              <TableCell key={j} className="whitespace-nowrap text-xs">
                                {String(c ?? "—")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

