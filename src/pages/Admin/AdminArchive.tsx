import { useState, useEffect, useCallback } from "react";
import {
  Archive,
  Search,
  Loader2,
  Shield,
  RotateCcw,
  Eye,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuditLogs,
  trackArchiveReveal,
  restoreCustomer,
  restoreSite,
  restoreUnit,
  countActiveTicketsFor,
  ROLE_LABELS,
  type AuditLog,
} from "@/services";
import {
  getCustomers,
  getSites,
  getUnits,
  type Customer,
  type SiteRow,
  type UnitRow,
} from "@/services/master-data";

interface ArchivedTicket {
  id: string;
  code: string;
  reporter_name: string;
  reporter_phone: string | null;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  closed_at: string | null;
  site: { name: string } | null;
  unit: { name: string } | null;
}

const SIX_MONTHS = 1000 * 60 * 60 * 24 * 183;
const FIVE_YEARS = 1000 * 60 * 60 * 24 * 365 * 5;

const PRIORITY_STYLES: Record<string, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-yellow-100 text-yellow-700",
  P3: "bg-muted text-muted-foreground",
};

const ACTION_FLAGS: Record<string, string> = {
  reopen: "REWORK",
  reassign: "REASSIGN",
  escalate: "ESCALATE",
};

const ITEMS_PER_PAGE = 15;

function maskName(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0] + "***";
  return `${parts[0]} ${parts[parts.length - 1][0]}***`;
}

function maskPhone(phone: string): string {
  if (!phone) return "—";
  return phone.slice(0, 4) + "-xxxx-xxxx";
}

function getFlag(action: string): string | null {
  const lower = action.toLowerCase();
  for (const [key, label] of Object.entries(ACTION_FLAGS)) {
    if (lower.includes(key)) return label;
  }
  return null;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminArchive() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tickets, setTickets] = useState<ArchivedTicket[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [revealTarget, setRevealTarget] = useState<ArchivedTicket | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);

  const [userFilter, setUserFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [deletedSites, setDeletedSites] = useState<SiteRow[]>([]);
  const [deletedUnits, setDeletedUnits] = useState<UnitRow[]>([]);
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});

  const [auditUsers, setAuditUsers] = useState<string[]>([]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setPage(1);
    const logs = await getAuditLogs({
      from: fromFilter || undefined,
      to: toFilter || undefined,
      limit: 2000,
    });
    const filtered = logs.filter((l) => {
      if (userFilter && l.actorName !== userFilter) return false;
      if (roleFilter && l.metadata.role !== roleFilter && l.metadata.active_role !== roleFilter)
        return false;
      return true;
    });
    setAuditLogs(filtered);
    setAuditUsers(
      Array.from(
        new Set(filtered.map((l) => l.actorName).filter((n): n is string => !!n)),
      ),
    );
    setLoading(false);
  }, [userFilter, roleFilter, fromFilter, toFilter]);

  async function loadTickets() {
    setLoading(true);
    setPage(1);
    // Rekonsiliasi ke schema app: tickets memakai string `customer`/`site`/`unit`,
    // bukan FK join ke sites/units.
    const { data } = await supabase
      .from("tickets")
      .select(
        "id, code, customer, site, unit, priority, status, description, created_at, closed_at, assigned_to",
      )
      .in("status", ["CLOSED", "DUPLICATE", "VOID"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) {
      setTickets(
        (data as unknown as Array<{
          id: string;
          code: string;
          customer: string;
          site: string | null;
          unit: string | null;
          priority: string;
          status: string;
          description: string | null;
          created_at: string;
          closed_at: string | null;
          assigned_to: string | null;
        }>).map((t) => ({
          id: t.id,
          code: t.code,
          reporter_name: t.customer,
          reporter_phone: null,
          priority: t.priority,
          status: t.status,
          description: t.description || "",
          created_at: t.created_at,
          closed_at: t.closed_at,
          site: t.site ? { name: t.site } : null,
          unit: t.unit ? { name: t.unit } : null,
        })),
      );
    }
    setLoading(false);
  }

  async function loadDeletedMaster() {
    const [customers, sites, units] = await Promise.all([
      getCustomers(true),
      getSites(true),
      getUnits(true),
    ]);
    const deletedCustomers = customers.filter((c) => c.is_deleted);
    const deletedSites = sites.filter((s) => s.is_deleted);
    const deletedUnits = units.filter((u) => u.is_deleted);
    setDeletedCustomers(deletedCustomers);
    setDeletedSites(deletedSites);
    setDeletedUnits(deletedUnits);

    const counts: Record<string, number> = {};
    for (const c of deletedCustomers)
      counts[`c:${c.id}`] = await countActiveTicketsFor("customer", c.id);
    for (const s of deletedSites) counts[`s:${s.id}`] = await countActiveTicketsFor("site", s.id);
    for (const u of deletedUnits) counts[`u:${u.id}`] = await countActiveTicketsFor("unit", u.id);
    setActiveCounts(counts);
  }

  useEffect(() => {
    loadTickets();
    loadDeletedMaster();
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  async function handleReveal(t: ArchivedTicket) {
    setRevealTarget(t);
  }

  async function confirmReveal() {
    if (!revealTarget) return;
    setRevealing(true);
    await trackArchiveReveal("ticket", revealTarget.id, revealTarget.code);
    setRevealedIds((prev) => new Set(prev).add(revealTarget.id));
    setRevealing(false);
    setRevealTarget(null);
    toast.success(`Data arsip ${revealTarget.code} diungkap — tercatat di audit`);
  }

  async function handleRestoreMaster(
    type: "customer" | "site" | "unit",
    id: string,
    label: string,
  ) {
    if ((activeCounts[`${type[0]}:${id}`] || 0) > 0) {
      toast.error(
        `Aksi Ditolak: "${label}" masih memiliki tiket aktif. Selesaikan terlebih dahulu.`,
      );
      return;
    }
    const ok =
      type === "customer"
        ? await restoreCustomer(id)
        : type === "site"
          ? await restoreSite(id)
          : await restoreUnit(id);
    if (ok) {
      toast.success(`${label} dipulihkan`);
      loadDeletedMaster();
    }
  }

  function renderTierBadge(ageMs: number) {
    if (ageMs > FIVE_YEARS)
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Anonim</Badge>
      );
    if (ageMs > SIX_MONTHS)
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          Tersamarkan
        </Badge>
      );
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        Read-only
      </Badge>
    );
  }

  function paginate<T>(list: T[]): T[] {
    return list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }

  const filteredAudit = auditLogs.filter((l) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (
      l.actorName?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.entityType?.toLowerCase().includes(q)
    );
  });

  const revealLogs = auditLogs.filter((l) => l.action === "archive_reveal");

  const filteredTickets = tickets.filter((t) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (
      t.code.toLowerCase().includes(q) ||
      t.site?.name?.toLowerCase().includes(q) ||
      t.reporter_name?.toLowerCase().includes(q)
    );
  });

  const masterCount = deletedCustomers.length + deletedSites.length + deletedUnits.length;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="arsip">Arsip Tiket</TabsTrigger>
          <TabsTrigger value="master">Master Data Dihapus ({masterCount})</TabsTrigger>
          <TabsTrigger value="reveal">Log Reveal</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari user, aksi, entitas…"
                className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:border-ring transition w-60 text-foreground"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="Semua User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua User</SelectItem>
                {auditUsers.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="Semua Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Role</SelectItem>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="w-40 h-9 text-xs"
              aria-label="Dari tanggal"
            />
            <Input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="w-40 h-9 text-xs"
              aria-label="Sampai tanggal"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat…
            </div>
          ) : filteredAudit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Shield className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada aktivitas</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Waktu
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Nama User
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Aktivitas
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Detail
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Flag
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredAudit).map((log) => {
                      const flag = getFlag(log.action);
                      const meta = log.metadata as Record<string, unknown>;
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-border last:border-0 hover:bg-accent transition"
                        >
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-foreground">
                            {log.actorName || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {String(meta.role || meta.active_role || "—")}
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{log.action}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {log.entityType}
                            {log.entityId ? `:${log.entityId.slice(0, 8)}` : ""}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {flag ? (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  flag === "REWORK"
                                    ? "bg-red-100 text-red-700"
                                    : flag === "REASSIGN"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {flag}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredAudit.length > ITEMS_PER_PAGE && (
                <div className="px-4 py-3 border-t border-border">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-muted-foreground">
                          {page} / {Math.ceil(filteredAudit.length / ITEMS_PER_PAGE)}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <button
                          onClick={() =>
                            setPage(
                              Math.min(Math.ceil(filteredAudit.length / ITEMS_PER_PAGE), page + 1),
                            )
                          }
                          disabled={page >= Math.ceil(filteredAudit.length / ITEMS_PER_PAGE)}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="arsip">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari kode tiket, site, pelapor…"
                className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:border-ring transition w-72 text-foreground"
              />
            </div>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Tiket final {">"} 6 bln tersamarkan · {">"} 5 thn dianonimkan · foto BAST tetap aman
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat…
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Archive className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada tiket di arsip</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Tiket
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Site
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Pelapor
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        WA
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Prioritas
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Tingkat
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Foto BAST
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredTickets).map((t) => {
                      const ageMs = Date.now() - new Date(t.created_at).getTime();
                      const masked = ageMs > SIX_MONTHS;
                      const anonymized = ageMs > FIVE_YEARS;
                      const revealed = revealedIds.has(t.id);
                      const showName =
                        anonymized && !revealed
                          ? "Anonim"
                          : masked && !revealed
                            ? maskName(t.reporter_name)
                            : t.reporter_name || "—";
                      const showPhone =
                        anonymized && !revealed
                          ? "—"
                          : masked && !revealed
                            ? maskPhone(t.reporter_phone || "")
                            : t.reporter_phone || "—";
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-border last:border-0 hover:bg-accent transition"
                        >
                          <td className="px-4 py-3 text-xs font-mono text-foreground whitespace-nowrap">
                            {t.code}
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{t.site?.name || "—"}</td>
                          <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">
                            {showName}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {showPhone}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[t.priority] || ""}`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{t.status}</td>
                          <td className="px-4 py-3 text-center">{renderTierBadge(ageMs)}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600"
                              title="Foto BAST tidak pernah dihapus/di-mask"
                            >
                              <Camera className="h-3 w-3" /> Aman
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {revealed ? (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Terungkap
                              </Badge>
                            ) : masked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                onClick={() => handleReveal(t)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Reveal
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredTickets.length > ITEMS_PER_PAGE && (
                <div className="px-4 py-3 border-t border-border">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-muted-foreground">
                          {page} / {Math.ceil(filteredTickets.length / ITEMS_PER_PAGE)}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <button
                          onClick={() =>
                            setPage(
                              Math.min(
                                Math.ceil(filteredTickets.length / ITEMS_PER_PAGE),
                                page + 1,
                              ),
                            )
                          }
                          disabled={page >= Math.ceil(filteredTickets.length / ITEMS_PER_PAGE)}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="master">
          {deletedCustomers.length + deletedSites.length + deletedUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Archive className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Tidak ada master data yang dihapus
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {deletedCustomers.length > 0 && (
                <MasterGroup
                  title="Customer"
                  rows={deletedCustomers.map((c) => ({
                    id: c.id,
                    label: c.name,
                    sub: c.address || "",
                    count: activeCounts[`c:${c.id}`] || 0,
                  }))}
                  onRestore={(id, label) => handleRestoreMaster("customer", id, label)}
                />
              )}
              {deletedSites.length > 0 && (
                <MasterGroup
                  title="Site"
                  rows={deletedSites.map((s) => ({
                    id: s.id,
                    label: s.name,
                    sub: s.pic_name,
                    count: activeCounts[`s:${s.id}`] || 0,
                  }))}
                  onRestore={(id, label) => handleRestoreMaster("site", id, label)}
                />
              )}
              {deletedUnits.length > 0 && (
                <MasterGroup
                  title="Unit"
                  rows={deletedUnits.map((u) => ({
                    id: u.id,
                    label: u.name,
                    sub: u.serial_number || "",
                    count: activeCounts[`u:${u.id}`] || 0,
                  }))}
                  onRestore={(id, label) => handleRestoreMaster("unit", id, label)}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reveal">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              Setiap pengungkapan data arsip ({">"} 6 bulan) dicatat di audit trail.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat…
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Shield className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada reveal data arsip</p>
            </div>
          ) : revealLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Shield className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada reveal data arsip</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Waktu
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Admin
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Tiket
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Alasan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(revealLogs).map((log) => {
                      const meta = log.metadata as Record<string, unknown>;
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-border last:border-0 hover:bg-accent transition"
                        >
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-foreground">
                            {log.actorName || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-foreground">
                            {String(meta.label || log.entityId || "—")}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {String(meta.reason || "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {revealLogs.length > ITEMS_PER_PAGE && (
                <div className="px-4 py-3 border-t border-border">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-muted-foreground">
                          {page} / {Math.ceil(revealLogs.length / ITEMS_PER_PAGE)}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <button
                          onClick={() =>
                            setPage(
                              Math.min(Math.ceil(revealLogs.length / ITEMS_PER_PAGE), page + 1),
                            )
                          }
                          disabled={page >= Math.ceil(revealLogs.length / ITEMS_PER_PAGE)}
                          className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!revealTarget}
        onOpenChange={(open) => {
          if (!open) setRevealTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Ungkap Data Arsip</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mengungkap data pelapor untuk tiket <strong>{revealTarget?.code}</strong>{" "}
              yang telah disamarkan. Tindakan ini akan dicatat dalam audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border text-muted-foreground">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReveal}
              disabled={revealing}
              className="bg-amber-500 text-primary-foreground hover:bg-amber-600"
            >
              {revealing ? "Mencatat…" : "Ya, Ungkap"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MasterGroup({
  title,
  rows,
  onRestore,
}: {
  title: string;
  rows: { id: string; label: string; sub: string; count: number }[];
  onRestore: (id: string, label: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {title} — Dihapus ({rows.length})
        </h4>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
              {r.sub && <p className="text-[11px] text-muted-foreground truncate">{r.sub}</p>}
            </div>
            {r.count > 0 && (
              <Badge
                className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                title="Masih ada tiket aktif, tidak dapat dipulihkan"
              >
                {r.count} tiket aktif
              </Badge>
            )}
            <button
              onClick={() => onRestore(r.id, r.label)}
              disabled={r.count > 0}
              className="p-1.5 rounded hover:bg-green-50 transition text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title={r.count > 0 ? "Blokir: masih ada tiket aktif" : "Pulihkan"}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

