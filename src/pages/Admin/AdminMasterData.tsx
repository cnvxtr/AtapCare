import React, { Fragment, useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Database,
  RotateCcw,
  Check,
  ArrowRight,
  ArrowLeft,
  ListTree,
  Tags,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { PhoneInput, toStoredPhone } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  countActiveTicketsFor,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
  createSite,
  updateSite,
  softDeleteSite,
  restoreSite,
  createUnit,
  updateUnit,
  softDeleteUnit,
  restoreUnit,
  problemCategoriesApi,
  rootCausesApi,
  type Customer,
  type SiteRow,
  type UnitRow,
  type CatalogItem,
} from "@/services";

type FormMode = "customer" | "site" | "unit";
type ActionVariant = "green" | "neutral" | "red" | "brand";
type WizardStep = 1 | 2 | 3;
type MasterTab = "assets" | "categories" | "rootcauses" | "customersites";
type CatalogTable = "problem_categories" | "root_causes";

const NEW_ID = "__new__";
const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: "Customer" },
  { n: 2, label: "Site" },
  { n: 3, label: "Unit" },
];

const MASTER_TABS: Array<{ key: MasterTab; label: string; icon: React.ElementType }> = [
  { key: "assets", label: "Pohon Aset", icon: Building2 },
  { key: "customersites", label: "Peta Site Pelanggan", icon: MapPin },
  { key: "categories", label: "Kategori Kendala", icon: ListTree },
  { key: "rootcauses", label: "Akar Kendala", icon: Tags },
];

const ITEMS_PER_PAGE = 20;

const VARIANT_CLASS: Record<ActionVariant, string> = {
  green: "border-emerald-100 text-emerald-700 hover:bg-emerald-50",
  neutral: "border-border text-muted-foreground hover:bg-accent",
  red: "border-red-100 text-red-600 hover:bg-red-50",
  brand: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
};

const FIELD_CLASS =
  "w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring";
const LABEL_CLASS = "text-xs font-medium text-muted-foreground mb-1 block";

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "neutral",
  disabled,
  title,
}: {
  icon?: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-[3px] border text-[11px] font-medium transition disabled:opacity-40 ${VARIANT_CLASS[variant]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

function RowActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Aksi"
          className="h-8 w-8 grid place-items-center rounded-[3px] bg-black text-white hover:bg-neutral-800 transition"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] bg-card border-border text-card-foreground"
      >
        <DropdownMenuItem
          onClick={onEdit}
          className="cursor-pointer focus:bg-black focus:text-white"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-red-500 focus:bg-red-100 focus:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuSelect({
  value,
  options,
  onSelect,
  disabled,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className={`${FIELD_CLASS} flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50`}
        >
          <span className="truncate text-left">{current ? current.label : "—"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] bg-card border-border text-card-foreground"
      >
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="cursor-pointer focus:bg-black focus:text-white"
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CatalogPanel({
  items,
  loading,
  searchQ,
  onSearch,
  page,
  setPage,
  icon: Icon,
  iconClass,
  addLabel,
  emptyHint,
  onAdd,
  onEdit,
  onArchive,
  onRestore,
}: {
  items: CatalogItem[];
  loading: boolean;
  searchQ: string;
  onSearch: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  icon: React.ElementType;
  iconClass: string;
  addLabel: string;
  emptyHint: string;
  onAdd: () => void;
  onEdit: (item: CatalogItem) => void;
  onArchive: (item: CatalogItem) => void;
  onRestore: (item: CatalogItem) => void;
}) {
  const filtered = items.filter((i) => i.name.toLowerCase().includes(searchQ.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <>
      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => {
                onSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari…"
              className="pl-9 pr-4 h-9 rounded-[3px] border border-border bg-card text-sm outline-none focus:border-ring transition w-72 text-foreground"
            />
          </div>
          <button
            onClick={onAdd}
            className="h-9 px-4 rounded-[3px] bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-2xl border border-dashed border-border bg-card">
          <Database className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
          <p className="text-xs mt-1">{emptyHint}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/70">
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-[40%]">
                    Nama
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((i) => (
                  <tr
                    key={i.id}
                    className={`border-b border-border bg-card hover:bg-accent/60 transition ${i.is_deleted ? "opacity-50" : ""}`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${iconClass}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-foreground">{i.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {i.is_deleted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          Diarsipkan
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                          Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.is_deleted ? (
                        <div className="flex justify-end">
                          <ActionButton
                            icon={RotateCcw}
                            label="Pulihkan"
                            variant="green"
                            onClick={() => onRestore(i)}
                          />
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <RowActionMenu onEdit={() => onEdit(i)} onDelete={() => onArchive(i)} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <button
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 text-xs rounded ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        {p}
                      </button>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
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
    </>
  );
}

export function AdminMasterData() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const showDeleted = false;
  const [expandedTop, setExpandedTop] = useState<Set<string>>(new Set());
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("customer");
  const [formParentCustomerId] = useState<string | null>(null);
  const [formParentSiteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Tab Master Data: Pohon Aset / Kategori Kendala / Akar Kendala ───
  const [tab, setTab] = useState<MasterTab>("assets");
  const [cats, setCats] = useState<CatalogItem[]>([]);
  const [roots, setRoots] = useState<CatalogItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catSearch, setCatSearch] = useState("");
  const [catPage, setCatPage] = useState(1);
  const [catDialog, setCatDialog] = useState<{
    table: CatalogTable;
    editingId: string | null;
    name: string;
  } | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  // ─── Customer Sites Mapping ───
  const [csMappings, setCsMappings] = useState<Array<{ id: string; customer_id: string; customer_name: string; site_name: string }>>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [csCustomerId, setCsCustomerId] = useState("");
  const [csSiteId, setCsSiteId] = useState("");
  const [csSaving, setCsSaving] = useState(false);

  async function loadCatalog(table: CatalogTable) {
    setCatLoading(true);
    const api = table === "problem_categories" ? problemCategoriesApi : rootCausesApi;
    const rows = await api.getAll();
    if (table === "problem_categories") setCats(rows);
    else setRoots(rows);
    setCatLoading(false);
  }

  async function loadCustomerSites() {
    setCsLoading(true);
    const { data } = await supabase
      .from("customer_sites_mapping")
      .select("id, customer_id, site_name")
      .order("customer_id");
    const userIds = [...new Set((data || []).map((r: any) => r.customer_id))];
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: users } = await supabase.from("users").select("id, full_name").in("id", userIds);
      nameMap = new Map((users || []).map((u: any) => [u.id, u.full_name]));
    }
    setCsMappings((data || []).map((r: any) => ({
      id: r.id,
      customer_id: r.customer_id,
      customer_name: nameMap.get(r.customer_id) || r.customer_id,
      site_name: r.site_name,
    })));
    setCsLoading(false);
  }

  async function handleAddCsMapping() {
    if (!csCustomerId || !csSiteId.trim()) return;
    setCsSaving(true);
    const siteName = csSiteId.trim();
    const { error } = await supabase.from("customer_sites_mapping").insert({ customer_id: csCustomerId, site_name: siteName });
    setCsSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mapping ditambahkan");
    setCsCustomerId(""); setCsSiteId("");
    loadCustomerSites();
  }

  async function handleDeleteCsMapping(id: string) {
    const { error } = await supabase.from("customer_sites_mapping").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Mapping dihapus");
    setCsMappings(prev => prev.filter(m => m.id !== id));
  }

  async function handleCatalogSave() {
    if (!catDialog || !catDialog.name.trim()) return;
    setCatSaving(true);
    const api = catDialog.table === "problem_categories" ? problemCategoriesApi : rootCausesApi;
    const ok = catDialog.editingId
      ? await api.update(catDialog.editingId, catDialog.name.trim())
      : (await api.create(catDialog.name.trim())) !== null;
    setCatSaving(false);
    if (!ok) {
      toast.error("Gagal menyimpan");
      return;
    }
    toast.success(catDialog.editingId ? "Nama diperbarui" : "Ditambahkan");
    setCatDialog(null);
    loadCatalog(catDialog.table);
  }

  async function handleCatalogArchive(table: CatalogTable, item: CatalogItem) {
    const api = table === "problem_categories" ? problemCategoriesApi : rootCausesApi;
    const ok = await api.softDelete(item.id);
    if (!ok) {
      toast.error("Gagal mengarsipkan");
      return;
    }
    toast.success(`"${item.name}" diarsipkan`);
    loadCatalog(table);
  }

  async function handleCatalogRestore(table: CatalogTable, item: CatalogItem) {
    const api = table === "problem_categories" ? problemCategoriesApi : rootCausesApi;
    const ok = await api.restore(item.id);
    if (!ok) {
      toast.error("Gagal memulihkan");
      return;
    }
    toast.success(`"${item.name}" dipulihkan`);
    loadCatalog(table);
  }


  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPicName, setFormPicName] = useState("");
  const [formPicPhone, setFormPicPhone] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formType, setFormType] = useState("");

  // Wizard Customer → Site → Unit
  const [wizStep, setWizStep] = useState<WizardStep>(1);
  const [wizEditLabel, setWizEditLabel] = useState<"customer" | "site" | "unit">("customer");
  const [wizCustomerName, setWizCustomerName] = useState("");
  const [wizCustomerCode, setWizCustomerCode] = useState("");
  const [wizCustomerPicName, setWizCustomerPicName] = useState("");
  const [wizCustomerPicPhone, setWizCustomerPicPhone] = useState("");
  const [wizSiteName, setWizSiteName] = useState("");
  const [wizSiteAddress, setWizSiteAddress] = useState("");
  const [wizPicName, setWizPicName] = useState("");
  const [wizPicPhone, setWizPicPhone] = useState("");
  const [wizUnitName, setWizUnitName] = useState("");
  const [wizUnitSerial, setWizUnitSerial] = useState("");
  const [wizUnitType, setWizUnitType] = useState("");
  const [wizSiteTarget, setWizSiteTarget] = useState<string>(NEW_ID);
  const [wizUnitTarget, setWizUnitTarget] = useState<string>(NEW_ID);
  const [wizSiteSkipped, setWizSiteSkipped] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  // Lazy-load katalog saat tab pertama kali dibuka.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "categories" && cats.length === 0) loadCatalog("problem_categories");
    if (tab === "rootcauses" && roots.length === 0) loadCatalog("root_causes");
    if (tab === "customersites" && csMappings.length === 0) loadCustomerSites();
    setCatPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);


  async function loadAll() {
    setLoading(true);
    const [cData, sData, uData] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("sites").select("*").order("name"),
      supabase.from("units").select("*").order("name"),
    ]);
    if (cData.data) setCustomers(cData.data as Customer[]);
    if (sData.data) setSites(sData.data as SiteRow[]);
    if (uData.data) setUnits(uData.data as UnitRow[]);
    setLoading(false);
  }

  function resetForm() {
    setFormName("");
    setFormAddress("");
    setFormCustomerId("");
    setFormPicName("");
    setFormPicPhone("");
    setFormSerialNumber("");
    setFormType("");
    setEditingId(null);
  }

  // ─── Wizard Customer → Site → Unit ──────────────────────────

  function clearSiteFields() {
    setWizSiteName("");
    setWizSiteAddress("");
    setWizPicName("");
    setWizPicPhone("");
  }

  function clearUnitFields() {
    setWizUnitName("");
    setWizUnitSerial("");
    setWizUnitType("");
  }

  function resetWizard() {
    setWizStep(1);
    setWizEditLabel("customer");
    setWizCustomerName("");
    setWizCustomerCode("");
    setWizCustomerPicName("");
    setWizCustomerPicPhone("");
    clearSiteFields();
    clearUnitFields();
    setWizSiteTarget(NEW_ID);
    setWizUnitTarget(NEW_ID);
    setWizSiteSkipped(false);
  }

  function prefillSite(s: SiteRow) {
    setWizSiteName(s.name);
    setWizSiteAddress(s.address || "");
    setWizPicName(s.pic_name);
    setWizPicPhone(s.pic_phone);
  }

  function prefillUnit(u: UnitRow) {
    setWizUnitName(u.name);
    setWizUnitSerial(u.serial_number || "");
    setWizUnitType(u.type || "");
  }

  function openCustomerWizard(mode: "add" | "edit", c?: Customer) {
    resetForm();
    resetWizard();
    setFormMode("customer");
    if (mode === "edit" && c) {
      setEditingId(c.id);
      setWizCustomerName(c.name);
      setWizCustomerCode(c.code || "");
      setWizCustomerPicName(c.pic_name || "");
      setWizCustomerPicPhone(c.pic_phone || "");
      const cSites = sites.filter((s) => s.customer_id === c.id && !s.is_deleted);
      if (cSites.length > 0) {
        setWizSiteTarget(cSites[0].id);
        prefillSite(cSites[0]);
      } else {
        setWizSiteTarget(NEW_ID);
      }
    } else {
      setEditingId(null);
    }
    setDrawerOpen(true);
  }

  function handleSiteTargetChange(v: string) {
    setWizSiteTarget(v);
    setWizUnitTarget(NEW_ID);
    clearUnitFields();
    if (v === NEW_ID) {
      clearSiteFields();
    } else {
      const s = sites.find((x) => x.id === v);
      if (s) prefillSite(s);
    }
  }

  function handleUnitTargetChange(v: string) {
    setWizUnitTarget(v);
    if (v === NEW_ID) {
      clearUnitFields();
    } else {
      const u = units.find((x) => x.id === v);
      if (u) prefillUnit(u);
    }
  }

  function wizSiteStepValid(): boolean {
    // PIC/WA PIC wajib selama ada nama site — berlaku juga saat edit site lama
    // (sebelumnya selalu true untuk site existing → bisa simpan PIC kosong).
    if (wizSiteName.trim() === "") return true;
    return wizPicName.trim() !== "" && wizPicPhone.trim() !== "";
  }

  function goStep3() {
    if (editingId && wizSiteTarget !== NEW_ID) {
      const siteUnits = units.filter((u) => u.site_id === wizSiteTarget && !u.is_deleted);
      if (siteUnits.length > 0) {
        setWizUnitTarget(siteUnits[0].id);
        prefillUnit(siteUnits[0]);
      } else {
        setWizUnitTarget(NEW_ID);
        clearUnitFields();
      }
    } else {
      setWizUnitTarget(NEW_ID);
      clearUnitFields();
    }
    setWizStep(3);
  }

  function openAddCustomer() {
    openCustomerWizard("add");
  }

  function startEditCustomer(c: Customer) {
    openCustomerWizard("edit", c);
  }

  function startEditSite(s: SiteRow) {
    const cust = customers.find((c) => c.id === s.customer_id);
    if (!cust) {
      toast.error("Data customer dari site ini tidak ditemukan");
      return;
    }
    openCustomerWizard("edit", cust);
    setWizEditLabel("site");
    setWizSiteTarget(s.id);
    prefillSite(s);
    setWizStep(2);
  }

  function startEditUnit(u: UnitRow) {
    const site = sites.find((x) => x.id === u.site_id);
    const cust = site ? customers.find((c) => c.id === site.customer_id) : undefined;
    if (!site || !cust) {
      toast.error("Data site/customer dari unit ini tidak ditemukan");
      return;
    }
    openCustomerWizard("edit", cust);
    setWizEditLabel("unit");
    setWizSiteTarget(site.id);
    prefillSite(site);
    setWizUnitTarget(u.id);
    prefillUnit(u);
    setWizStep(3);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    if (formMode === "site") {
      if (!formPicName.trim() || !formPicPhone.trim()) {
        setSaving(false);
        toast.error("Site wajib memiliki PIC dan No WA PIC");
        return;
      }
      const customerId = formCustomerId || formParentCustomerId;
      if (!customerId) {
        setSaving(false);
        toast.error("Pilih customer terlebih dahulu");
        return;
      }
      const input = {
        name: formName,
        address: formAddress,
        pic_name: formPicName,
        pic_phone: toStoredPhone(formPicPhone),
        customer_id: customerId,
      };
      const ok = editingId ? await updateSite(editingId, input) : await createSite(input);
      if (!ok) {
        setSaving(false);
        toast.error("Gagal menyimpan site");
        return;
      }
    } else if (formMode === "unit") {
      if (!formParentSiteId) {
        setSaving(false);
        return;
      }
      const input = {
        name: formName,
        serial_number: formSerialNumber,
        type: formType,
        site_id: formParentSiteId,
      };
      const ok = editingId ? await updateUnit(editingId, input) : await createUnit(input);
      if (!ok) {
        setSaving(false);
        toast.error("Gagal menyimpan unit");
        return;
      }
    }

    resetForm();
    setSaving(false);
    setDrawerOpen(false);
    toast.success("Data berhasil disimpan");
    loadAll();
  }

  async function handleWizardSave() {
    if (!wizCustomerName.trim()) return;
    if (!wizCustomerPicName.trim() || !wizCustomerPicPhone.trim()) {
      toast.error("Customer wajib memiliki PIC dan No WA PIC");
      return;
    }
    if (!wizSiteStepValid()) {
      toast.error("Site wajib memiliki PIC dan No WA PIC");
      return;
    }
    setSaving(true);

    const isEdit = !!editingId;
    let custId = editingId;
    let createdSite = false;
    let updatedSite = false;
    let createdUnit = false;
    let updatedUnit = false;

    if (isEdit) {
      const ok = await updateCustomer(editingId, {
        name: wizCustomerName,
        code: wizCustomerCode || undefined,
        pic_name: wizCustomerPicName,
        pic_phone: toStoredPhone(wizCustomerPicPhone),
      });
      if (!ok) {
        setSaving(false);
        toast.error("Gagal memperbarui customer");
        return;
      }
    } else {
      const newId = await createCustomer({
        name: wizCustomerName,
        code: wizCustomerCode || undefined,
        pic_name: wizCustomerPicName,
        pic_phone: toStoredPhone(wizCustomerPicPhone),
      });
      if (!newId) {
        setSaving(false);
        toast.error("Gagal menyimpan customer");
        return;
      }
      custId = newId;
    }

    if (!custId) {
      setSaving(false);
      toast.error("Data customer tidak valid");
      return;
    }

    const hasSite = wizSiteName.trim() !== "" && (isEdit || !wizSiteSkipped);
    let siteId: string | null = null;
    if (hasSite) {
      const siteInput = {
        name: wizSiteName,
        address: wizSiteAddress,
        pic_name: wizPicName,
        pic_phone: toStoredPhone(wizPicPhone),
        customer_id: custId,
      };
      if (isEdit && wizSiteTarget !== NEW_ID) {
        const orig = sites.find((s) => s.id === wizSiteTarget);
        const changed =
          !orig ||
          orig.name !== wizSiteName ||
          orig.address !== wizSiteAddress ||
          orig.pic_name !== wizPicName ||
          orig.pic_phone !== toStoredPhone(wizPicPhone);
        if (changed) {
          const ok = await updateSite(wizSiteTarget, siteInput);
          if (!ok) {
            setSaving(false);
            toast.error("Gagal memperbarui site");
            return;
          }
          updatedSite = true;
        }
        siteId = wizSiteTarget;
      } else {
        siteId = await createSite(siteInput);
        if (!siteId) {
          setSaving(false);
          toast.error("Gagal menyimpan site");
          return;
        }
        createdSite = true;
      }
    }

    if (siteId && wizUnitName.trim() !== "") {
      const unitInput = {
        name: wizUnitName,
        serial_number: wizUnitSerial,
        type: wizUnitType,
        site_id: siteId,
      };
      if (isEdit && wizUnitTarget !== NEW_ID) {
        const origU = units.find((u) => u.id === wizUnitTarget);
        const changedU =
          !origU ||
          origU.name !== wizUnitName ||
          (origU.serial_number || "") !== wizUnitSerial ||
          (origU.type || "") !== wizUnitType;
        if (changedU) {
          const ok = await updateUnit(wizUnitTarget, unitInput);
          if (!ok) {
            setSaving(false);
            toast.error("Gagal memperbarui unit");
            return;
          }
          updatedUnit = true;
        }
      } else {
        const ok = await createUnit(unitInput);
        if (!ok) {
          setSaving(false);
          toast.error("Gagal menyimpan unit");
          return;
        }
        createdUnit = true;
      }
    }

    resetForm();
    resetWizard();
    setSaving(false);
    setDrawerOpen(false);

    const parts: string[] = isEdit ? ["Customer diperbarui"] : ["+1 customer"];
    if (createdSite) parts.push("+1 site");
    if (updatedSite) parts.push("site diperbarui");
    if (createdUnit) parts.push("+1 unit");
    if (updatedUnit) parts.push("unit diperbarui");
    toast.success(parts.join(" · "));

    loadAll();
  }

  async function handleSoftDelete(type: "customer" | "site" | "unit", id: string, label: string) {
    const count = await countActiveTicketsFor(type, id);
    if (count > 0) {
      toast.error(
        `Aksi Ditolak: "${label}" masih memiliki ${count} tiket aktif. Selesaikan/ganti penugasan tiket terlebih dahulu.`,
      );
      return;
    }
    const ok =
      type === "customer"
        ? await softDeleteCustomer(id)
        : type === "site"
          ? await softDeleteSite(id)
          : await softDeleteUnit(id);
    if (ok) {
      toast.success(`${label} diarsipkan`);
      loadAll();
    } else {
      toast.error("Gagal mengarsipkan");
    }
  }

  async function handleRestore(type: "customer" | "site" | "unit", id: string, label: string) {
    const ok =
      type === "customer"
        ? await restoreCustomer(id)
        : type === "site"
          ? await restoreSite(id)
          : await restoreUnit(id);
    if (ok) {
      toast.success(`${label} dipulihkan`);
      loadAll();
    }
  }

  function toggleTop(id: string) {
    setExpandedTop((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSite(id: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Derived ────────────────────────────────────────────────

  const hasWizardSite =
    formMode === "customer"
      ? editingId
        ? wizSiteTarget !== NEW_ID || wizSiteName.trim() !== ""
        : wizSiteName.trim() !== "" && !wizSiteSkipped
      : false;

  const filteredCustomers = customers.filter((c) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    const siteHit = sites.some((s) => s.customer_id === c.id && s.name.toLowerCase().includes(q));
    return (
      c.name.toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q) || siteHit
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const paginatedTop = filteredCustomers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const activeCount = units.filter((u) => !u.is_deleted).length;

  const chevronBtn = (expanded: boolean, hasChildren: boolean, onToggle: () => void) =>
    hasChildren ? (
      <button
        onClick={onToggle}
        className="p-1 rounded-[3px] hover:bg-accent transition text-muted-foreground"
        title={expanded ? "Tutup" : "Buka"}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
    ) : (
      <span className="w-6 block" />
    );

  return (
    <div className="space-y-4">
      {/* ─── Tab Master Data ───────────────────────────────────── */}
      <div className="bg-card p-1 rounded-xl border border-border inline-flex gap-1 flex-wrap w-fit">
        {MASTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 h-8 rounded-[3px] text-xs font-medium transition inline-flex items-center gap-1.5 ${
              tab === t.key
                ? "bg-foreground text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── Pohon Aset (Customer → Site → Unit) ───────────────── */}
      {tab === "assets" && (
        <>
      {/* ─── Header: search + add ─────────────────────────────── */}
<div className="bg-card p-4 rounded-xl border border-border">
  <div className="flex items-center justify-between flex-wrap gap-2">
    <div className="relative flex-1 min-w-0">
      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={searchQ}
        onChange={(e) => {
          setSearchQ(e.target.value);
          setPage(1);
        }}
        placeholder="Cari customer, site, unit…"
        className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-foreground/20 transition w-full text-foreground"
      />
          </div>
          <button
            onClick={openAddCustomer}
            className="h-9 px-4 rounded-[3px] bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah Customer
          </button>
        </div>
      </div>

      {/* ─── Card gabungan: Titik Aktif + TreeTable ────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-border">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-foreground text-xs font-mono uppercase tracking-widest border border-border shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success pulse-ring" />
            {activeCount} Titik Aktif
          </span>
        </div>
        {loading ? (
          <div className="space-y-2 py-4 px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : paginatedTop.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Database className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
            <p className="text-xs mt-1">Gunakan tombol Tambah Customer untuk memulai</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <div className="min-w-[580px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/70">
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-[40%]">
                    Hierarki Aset
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    PIC
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    No WA PIC
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Serial / Tipe
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTop.map((c) => {
                  const cSites = sites.filter(
                    (s) => s.customer_id === c.id && s.is_deleted === showDeleted,
                  );
                  return (
                    <Fragment key={c.id}>
                      {/* Level 1 — Customer */}
                      <tr
                        className={`border-b border-border bg-card hover:bg-accent/60 transition ${c.is_deleted ? "opacity-50" : ""}`}
                      >
                        <td className="py-3 pl-3 pr-2">
                          <div className="flex items-center gap-1.5">
                            {chevronBtn(expandedTop.has(c.id), cSites.length > 0, () =>
                              toggleTop(c.id),
                            )}
                            <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0">
                              <Building2 className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <button
                                onClick={() => startEditCustomer(c)}
                                className="block max-w-full text-left text-[13px] font-semibold text-foreground truncate hover:text-primary transition"
                                title={`Edit ${c.name}`}
                              >
                                {c.name}
                              </button>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.address || c.phone || `${cSites.length} site`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{c.pic_name || "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {c.pic_phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-right">
                          {c.is_deleted ? (
                            <ActionButton
                              icon={RotateCcw}
                              label="Pulihkan"
                              variant="green"
                              onClick={() => handleRestore("customer", c.id, c.name)}
                            />
                          ) : !showDeleted ? (
                            <div className="flex justify-end">
                              <RowActionMenu
                                onEdit={() => startEditCustomer(c)}
                                onDelete={() => handleSoftDelete("customer", c.id, c.name)}
                              />
                            </div>
                          ) : null}
                        </td>
                      </tr>

                      {expandedTop.has(c.id) &&
                        cSites.map((site) => {
                          const siteUnits = units.filter(
                            (u) => u.site_id === site.id && u.is_deleted === showDeleted,
                          );
                          return (
                            <Fragment key={site.id}>
                              {/* Level 2 — Site */}
                              <tr
                                className={`border-b border-border bg-muted/40 hover:bg-accent transition ${site.is_deleted ? "opacity-50" : ""}`}
                              >
                                <td className="py-2.5 pl-9 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    {chevronBtn(
                                      expandedSites.has(site.id),
                                      siteUnits.length > 0,
                                      () => toggleSite(site.id),
                                    )}
                                    <span className="h-6 w-6 rounded-md bg-purple-50 text-purple-600 grid place-items-center shrink-0">
                                      <MapPin className="h-3 w-3" />
                                    </span>
                                    <div className="min-w-0">
                                      <button
                                        onClick={() => startEditSite(site)}
                                        className="block max-w-full text-left text-[13px] font-medium text-foreground truncate hover:text-primary transition"
                                        title={`Edit ${site.name}`}
                                      >
                                        {site.name}
                                      </button>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        Lokasi: {site.address || "—"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-foreground">
                                  {site.pic_name || "—"}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                                  {site.pic_phone || "—"}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                                <td className="px-4 py-3 text-right">
                                  {site.is_deleted ? (
                                    <ActionButton
                                      icon={RotateCcw}
                                      label="Pulihkan"
                                      variant="green"
                                      onClick={() => handleRestore("site", site.id, site.name)}
                                    />
                                  ) : !showDeleted ? (
                                    <div className="flex justify-end">
                                      <RowActionMenu
                                        onEdit={() => startEditSite(site)}
                                        onDelete={() =>
                                          handleSoftDelete("site", site.id, site.name)
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </td>
                              </tr>

                              {expandedSites.has(site.id) &&
                                siteUnits.map((unit) => (
                                  <tr
                                    key={unit.id}
                                    className={`border-b border-border bg-card hover:bg-accent/60 transition ${unit.is_deleted ? "opacity-50" : ""}`}
                                  >
                                    {/* Level 3 — Unit */}
                                    <td className="py-2.5 pl-16 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-6 block shrink-0" />
                                        <span className="h-6 w-6 rounded-md bg-amber-50 text-amber-600 grid place-items-center shrink-0">
                                          <Cpu className="h-3 w-3" />
                                        </span>
                                        <div className="min-w-0">
                                          <button
                                            onClick={() => startEditUnit(unit)}
                                            className="block max-w-full text-left text-[13px] font-medium text-foreground truncate hover:text-primary transition"
                                            title={`Edit ${unit.name}`}
                                          >
                                            {unit.name}
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                                    <td className="px-4 py-3 text-xs">
                                      <span className="font-mono text-muted-foreground">
                                        {unit.serial_number || "—"}
                                      </span>
                                      {unit.type && (
                                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                                          {unit.type}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {unit.is_deleted ? (
                                        <ActionButton
                                          icon={RotateCcw}
                                          label="Pulihkan"
                                          variant="green"
                                          onClick={() => handleRestore("unit", unit.id, unit.name)}
                                        />
                                      ) : !showDeleted ? (
                                        <div className="flex justify-end">
                                          <RowActionMenu
                                            onEdit={() => startEditUnit(unit)}
                                            onDelete={() =>
                                              handleSoftDelete("unit", unit.id, unit.name)
                                            }
                                          />
                                        </div>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {totalPages > 1 && (
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <button
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 text-xs rounded ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        {p}
                      </button>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
          </>
        )}
        </div>
      </>
      )}

      {/* ─── Katalog: Kategori Kendala & Akar Kendala ──────────── */}
      {tab === "categories" && (
        <CatalogPanel
          items={cats}
          loading={catLoading}
          searchQ={catSearch}
          onSearch={setCatSearch}
          page={catPage}
          setPage={setCatPage}
          icon={ListTree}
          iconClass="bg-blue-50 text-blue-600"
          addLabel="Tambah Kategori Kendala"
          emptyHint="Gunakan tombol Tambah Kategori Kendala untuk memulai"
          onAdd={() => setCatDialog({ table: "problem_categories", editingId: null, name: "" })}
          onEdit={(i) =>
            setCatDialog({ table: "problem_categories", editingId: i.id, name: i.name })
          }
          onArchive={(i) => handleCatalogArchive("problem_categories", i)}
          onRestore={(i) => handleCatalogRestore("problem_categories", i)}
        />
      )}
      {tab === "rootcauses" && (
        <CatalogPanel
          items={roots}
          loading={catLoading}
          searchQ={catSearch}
          onSearch={setCatSearch}
          page={catPage}
          setPage={setCatPage}
          icon={Tags}
          iconClass="bg-purple-50 text-purple-600"
          addLabel="Tambah Akar Kendala"
          emptyHint="Gunakan tombol Tambah Akar Kendala untuk memulai"
          onAdd={() => setCatDialog({ table: "root_causes", editingId: null, name: "" })}
          onEdit={(i) => setCatDialog({ table: "root_causes", editingId: i.id, name: i.name })}
          onArchive={(i) => handleCatalogArchive("root_causes", i)}
          onRestore={(i) => handleCatalogRestore("root_causes", i)}
        />
      )}

      {/* ─── Dialog Katalog (tambah/edit nama) ─────────────────── */}
      <Dialog open={!!catDialog} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent className="sm:max-w-md bg-card p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-foreground">
              {catDialog?.editingId ? "Edit" : "Tambah"}{" "}
              {catDialog?.table === "problem_categories" ? "Kategori Kendala" : "Akar Kendala"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <label className={LABEL_CLASS}>Nama</label>
            <input
              value={catDialog?.name || ""}
              onChange={(e) =>
                setCatDialog((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
              className={FIELD_CLASS}
              placeholder="cth. Mati Total"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            <DialogClose className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
              Batal
            </DialogClose>
            <button
              onClick={handleCatalogSave}
              disabled={!catDialog?.name.trim() || catSaving}
              className="px-5 py-2 rounded-[3px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Centered Modal (add/edit) ─────────────────────────── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-md bg-card p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-foreground">
              {formMode === "customer"
                ? `${editingId ? "Edit" : "Tambah"} ${
                    wizEditLabel === "site" ? "Site" : wizEditLabel === "unit" ? "Unit" : "Customer"
                  }`
                : `${editingId ? "Edit" : "Tambah"} ${formMode === "site" ? "Site" : "Unit"}`}
            </DialogTitle>
            {formMode === "customer" && (
              <div className="flex items-center justify-center gap-2 pt-2">
                {WIZARD_STEPS.map(({ n, label }, i) => (
                  <Fragment key={label}>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold transition ${
                          wizStep >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {wizStep > n ? <Check className="h-3.5 w-3.5" /> : n}
                      </div>
                      <span
                        className={`text-[11px] font-medium ${wizStep >= n ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {label}
                      </span>
                    </div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 w-10 rounded ${wizStep > n ? "bg-primary" : "bg-muted"}`}
        />
      )}

      {/* ─── Peta Site Pelanggan (Customer Sites Mapping) ─────── */}
      {tab === "customersites" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Tambah Mapping</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Customer (user)</label>
                <select value={csCustomerId} onChange={e => setCsCustomerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-[3px] border border-border bg-background text-sm">
                  <option value="">Pilih customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Nama Site</label>
                <input value={csSiteId} onChange={e => setCsSiteId(e.target.value)} placeholder="contoh: Site Jakarta"
                  className="w-full h-9 px-3 rounded-[3px] border border-border bg-background text-sm" />
              </div>
              <button onClick={handleAddCsMapping} disabled={csSaving || !csCustomerId || !csSiteId.trim()}
                className="h-9 px-4 rounded-[3px] bg-foreground text-background text-xs font-semibold hover:opacity-90 transition disabled:opacity-50">
                {csSaving ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Mapping Aktif</h3>
            </div>
            {csLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : csMappings.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada mapping</div>
            ) : (
              <div className="divide-y divide-border">
                {csMappings.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition">
                    <div className="text-sm">
                      <span className="font-medium">{m.customer_name}</span>
                      <span className="text-muted-foreground mx-2">&rarr;</span>
                      <span className="font-mono text-xs">{m.site_name}</span>
                    </div>
                    <button onClick={() => handleDeleteCsMapping(m.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition">Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
                  </Fragment>
                ))}
              </div>
            )}
          </DialogHeader>

          {formMode === "customer" ? (
            <>
              {wizStep === 1 && (
                <div className="space-y-3">
                  <div>
                    <label className={LABEL_CLASS}>Nama Perusahaan</label>
                    <input
                      value={wizCustomerName}
                      onChange={(e) => setWizCustomerName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. PT PAMA"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Kode / Singkatan</label>
                    <input
                      value={wizCustomerCode}
                      onChange={(e) => setWizCustomerCode(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. PAMA"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Nama PIC Perusahaan</label>
                    <input
                      value={wizCustomerPicName}
                      onChange={(e) => setWizCustomerPicName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Budi - GM IT"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No. WA PIC Perusahaan</label>
                    <PhoneInput
                      value={wizCustomerPicPhone}
                      onChange={setWizCustomerPicPhone}
                      className={FIELD_CLASS}
                      placeholder="cth. 8123456789"
                    />
                  </div>
                </div>
              )}

              {wizStep === 2 && (
                <div className="space-y-3">
                  {editingId && (
                    <div>
                      <label className={LABEL_CLASS}>Site yang dikelola</label>
                      <MenuSelect
                        value={wizSiteTarget}
                        onSelect={handleSiteTargetChange}
                        options={[
                          ...sites
                            .filter((s) => s.customer_id === editingId && !s.is_deleted)
                            .map((s) => ({ value: s.id, label: s.name })),
                          { value: NEW_ID, label: "＋ Site Baru" },
                        ]}
                      />
                    </div>
                  )}
                  <div>
                    <label className={LABEL_CLASS}>Nama Site & Layanan</label>
                    <input
                      value={wizSiteName}
                      onChange={(e) => setWizSiteName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. SMMS Site Sangatta"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Detail Area Lokasi</label>
                    <input
                      value={wizSiteAddress}
                      onChange={(e) => setWizSiteAddress(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Pos Tambang Utara"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Nama Koordinator Site</label>
                    <input
                      value={wizPicName}
                      onChange={(e) => setWizPicName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Joko - KTT"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No. WA Koordinator Site</label>
                    <PhoneInput
                      value={wizPicPhone}
                      onChange={setWizPicPhone}
                      className={FIELD_CLASS}
                      placeholder="cth. 8123456789"
                    />
                  </div>
                  {!editingId && (
                    <p className="text-[11px] text-muted-foreground">
                      Kosongkan seluruh field site lalu "Lanjut" untuk melewati langkah ini.
                    </p>
                  )}
                </div>
              )}

              {wizStep === 3 && (
                <div className="space-y-3">
                  {hasWizardSite ? (
                    <>
                      {editingId && wizSiteTarget !== NEW_ID && (
                        <div>
                          <label className={LABEL_CLASS}>Unit yang dikelola</label>
                          <MenuSelect
                            value={wizUnitTarget}
                            onSelect={handleUnitTargetChange}
                            options={[
                              ...units
                                .filter((u) => u.site_id === wizSiteTarget && !u.is_deleted)
                                .map((u) => ({ value: u.id, label: u.name })),
                              { value: NEW_ID, label: "＋ Unit Baru" },
                            ]}
                          />
                        </div>
                      )}
                      <div>
                        <label className={LABEL_CLASS}>Nama / Kode Unit</label>
                        <input
                          value={wizUnitName}
                          onChange={(e) => setWizUnitName(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="cth. SMMS MTS-1"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Serial Number (SN)</label>
                        <input
                          value={wizUnitSerial}
                          onChange={(e) => setWizUnitSerial(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="Serial number unit"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Merek & Tipe</label>
                        <input
                          value={wizUnitType}
                          onChange={(e) => setWizUnitType(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="cth. Sensor Level"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/60 p-5 text-center">
                      <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Belum ada site</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Tambah site & unit nanti lewat tombol [+ Tambah Site] di pohon aset.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>
                  {formMode === "site" ? "Nama Site & Layanan" : "Nama / Kode Unit"}
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder={
                    formMode === "site" ? "cth. SMMS Site Sangatta" : "cth. SMMS MTS-1"
                  }
                />
              </div>

              {formMode === "site" && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Customer</label>
                    <MenuSelect
                      value={formCustomerId || formParentCustomerId || ""}
                      onSelect={setFormCustomerId}
                      disabled={!!formParentCustomerId}
                      options={
                        formParentCustomerId
                          ? customers
                              .filter((c) => c.id === formParentCustomerId)
                              .map((c) => ({ value: c.id, label: c.name }))
                          : customers
                              .filter((c) => !c.is_deleted)
                              .map((c) => ({ value: c.id, label: c.name }))
                      }
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Detail Area Lokasi</label>
                    <input
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Pos Tambang Utara"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Nama Koordinator Site</label>
                    <input
                      value={formPicName}
                      onChange={(e) => setFormPicName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Joko - KTT"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No. WA Koordinator Site</label>
                    <PhoneInput
                      value={formPicPhone}
                      onChange={setFormPicPhone}
                      className={FIELD_CLASS}
                      placeholder="cth. 8123456789"
                    />
                  </div>
                </>
              )}

              {formMode === "unit" && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Serial Number (SN)</label>
                    <input
                      value={formSerialNumber}
                      onChange={(e) => setFormSerialNumber(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Serial number unit"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Merek & Tipe</label>
                    <input
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. Sensor Level"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            {formMode === "customer" ? (
              <>
                {wizStep === 1 && (
                  <>
                    <DialogClose className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
                      Batal
                    </DialogClose>
                    <button
                      onClick={() => setWizStep(2)}
                      disabled={
                        !wizCustomerName.trim() ||
                        !wizCustomerPicName.trim() ||
                        !wizCustomerPicPhone.trim() ||
                        saving
                      }
                      className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      Lanjut <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {wizStep === 2 && (
                  <>
                    <button
                      onClick={() => setWizStep(1)}
                      className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                    </button>
                    {!editingId && (
                      <button
                        onClick={() => {
                          setWizSiteSkipped(true);
                          clearSiteFields();
                          goStep3();
                        }}
                        className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition"
                      >
                        Lewati
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!wizSiteStepValid()) {
                          toast.error("Site wajib memiliki PIC dan No WA PIC");
                          return;
                        }
                        setWizSiteSkipped(false);
                        goStep3();
                      }}
                      className="px-5 py-2 rounded-[3px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
                    >
                      Lanjut <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {wizStep === 3 && (
                  <>
                    <button
                      onClick={() => setWizStep(2)}
                      className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                    </button>
                    <button
                      onClick={handleWizardSave}
                      disabled={saving}
                      className="px-5 py-2 rounded-[3px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Simpan
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <DialogClose className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
                  Batal
                </DialogClose>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !formName.trim() ||
                    (formMode === "site" && (!formPicName.trim() || !formPicPhone.trim()))
                  }
                  className="px-5 py-2 rounded-[3px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

