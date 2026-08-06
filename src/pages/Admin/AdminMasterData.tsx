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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
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
  type Customer,
  type SiteRow,
  type UnitRow,
} from "@/services";

type FormMode = "customer" | "site" | "unit";
type ActionVariant = "green" | "neutral" | "red" | "brand";
type WizardStep = 1 | 2 | 3;

const NEW_ID = "__new__";
const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: "Customer" },
  { n: 2, label: "Site" },
  { n: 3, label: "Unit" },
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
        pic_phone: formPicPhone,
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
        pic_phone: wizCustomerPicPhone,
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
        pic_phone: wizCustomerPicPhone,
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
        pic_phone: wizPicPhone,
        customer_id: custId,
      };
      if (isEdit && wizSiteTarget !== NEW_ID) {
        const orig = sites.find((s) => s.id === wizSiteTarget);
        const changed =
          !orig ||
          orig.name !== wizSiteName ||
          orig.address !== wizSiteAddress ||
          orig.pic_name !== wizPicName ||
          orig.pic_phone !== wizPicPhone;
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
      {/* ─── Header: search + add ─────────────────────────────── */}
      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari customer, site, unit…"
              className="pl-9 pr-4 h-9 rounded-[3px] border border-border bg-card text-sm outline-none focus:border-ring transition w-72 text-foreground"
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

      {/* ─── TreeTable (Customer → Site → Unit) ────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data…
        </div>
      ) : paginatedTop.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-2xl border border-dashed border-border bg-card">
          <Database className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
          <p className="text-xs mt-1">Gunakan tombol Tambah Customer untuk memulai</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
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
                    <input
                      value={wizCustomerPicPhone}
                      onChange={(e) => setWizCustomerPicPhone(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="08xxxxxxxxxx"
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
                    <input
                      value={wizPicPhone}
                      onChange={(e) => setWizPicPhone(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="08xxxxxxxxxx"
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
                    <input
                      value={formPicPhone}
                      onChange={(e) => setFormPicPhone(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="08xxxxxxxxxx"
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

