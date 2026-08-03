import React, { Fragment, useRef, useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  Loader2,
  Search,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
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
  type Region,
} from "@/services";
import { exportCsv, todayStamp, type ExportCell } from "@/lib/export";

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

const EXPORT_HEADERS = [
  "Tipe",
  "Nama",
  "Customer",
  "Site",
  "Region",
  "Serial Number",
  "Tipe Unit",
  "Nama PIC",
  "No WA PIC",
  "Alamat",
  "No Telepon",
];

const VARIANT_CLASS: Record<ActionVariant, string> = {
  green: "border-emerald-100 text-emerald-700 hover:bg-emerald-50",
  neutral: "border-border text-muted-foreground hover:bg-accent",
  red: "border-red-100 text-red-600 hover:bg-red-50",
  brand: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
};

const FIELD_CLASS =
  "w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring";
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
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-40 ${VARIANT_CLASS[variant]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function AdminMasterData() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedTop, setExpandedTop] = useState<Set<string>>(new Set());
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("customer");
  const [formParentCustomerId, setFormParentCustomerId] = useState<string | null>(null);
  const [formParentSiteId, setFormParentSiteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formRegionId, setFormRegionId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPicName, setFormPicName] = useState("");
  const [formPicPhone, setFormPicPhone] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formType, setFormType] = useState("");

  // Wizard Customer → Site → Unit
  const [wizStep, setWizStep] = useState<WizardStep>(1);
  const [wizCustomerName, setWizCustomerName] = useState("");
  const [wizCustomerAddress, setWizCustomerAddress] = useState("");
  const [wizCustomerPhone, setWizCustomerPhone] = useState("");
  const [wizSiteName, setWizSiteName] = useState("");
  const [wizSiteAddress, setWizSiteAddress] = useState("");
  const [wizSiteRegionId, setWizSiteRegionId] = useState("");
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
    const [cData, rData, sData, uData] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("regions").select("id, customer_id, name, is_deleted").order("name"),
      supabase.from("sites").select("*").order("name"),
      supabase.from("units").select("*").order("name"),
    ]);
    if (cData.data) setCustomers(cData.data as Customer[]);
    if (rData.data) setRegions(rData.data as Region[]);
    if (sData.data) setSites(sData.data as SiteRow[]);
    if (uData.data) setUnits(uData.data as UnitRow[]);
    setLoading(false);
  }

  function resetForm() {
    setFormName("");
    setFormAddress("");
    setFormRegionId("");
    setFormCustomerId("");
    setFormPicName("");
    setFormPicPhone("");
    setFormSerialNumber("");
    setFormType("");
    setEditingId(null);
    setFormParentCustomerId(null);
    setFormParentSiteId(null);
  }

  // ─── Wizard Customer → Site → Unit ──────────────────────────

  function clearSiteFields() {
    setWizSiteName("");
    setWizSiteAddress("");
    setWizSiteRegionId("");
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
    setWizCustomerName("");
    setWizCustomerAddress("");
    setWizCustomerPhone("");
    clearSiteFields();
    clearUnitFields();
    setWizSiteTarget(NEW_ID);
    setWizUnitTarget(NEW_ID);
    setWizSiteSkipped(false);
  }

  function prefillSite(s: SiteRow) {
    setWizSiteName(s.name);
    setWizSiteAddress(s.address || "");
    setWizSiteRegionId(s.region_id || "");
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
      setWizCustomerAddress(c.address || "");
      setWizCustomerPhone(c.phone || "");
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

  function openAddSite(parentCustomerId: string | null) {
    resetForm();
    setFormMode("site");
    setFormParentCustomerId(parentCustomerId);
    if (parentCustomerId) setFormCustomerId(parentCustomerId);
    setDrawerOpen(true);
  }

  function openAddUnit(siteId: string) {
    resetForm();
    setFormMode("unit");
    setFormParentSiteId(siteId);
    setDrawerOpen(true);
  }

  function startEditCustomer(c: Customer) {
    openCustomerWizard("edit", c);
  }

  function startEditSite(s: SiteRow) {
    resetForm();
    setFormMode("site");
    setFormName(s.name);
    setFormAddress(s.address || "");
    setFormRegionId(s.region_id || "");
    setFormCustomerId(s.customer_id || "");
    setFormPicName(s.pic_name);
    setFormPicPhone(s.pic_phone);
    setEditingId(s.id);
    setDrawerOpen(true);
  }

  function startEditUnit(u: UnitRow) {
    resetForm();
    setFormMode("unit");
    setFormName(u.name);
    setFormSerialNumber(u.serial_number || "");
    setFormType(u.type || "");
    setFormParentSiteId(u.site_id);
    setEditingId(u.id);
    setDrawerOpen(true);
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
        region_id: formRegionId || null,
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
        address: wizCustomerAddress,
        phone: wizCustomerPhone,
      });
      if (!ok) {
        setSaving(false);
        toast.error("Gagal memperbarui customer");
        return;
      }
    } else {
      const newId = await createCustomer({
        name: wizCustomerName,
        address: wizCustomerAddress,
        phone: wizCustomerPhone,
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
        region_id: wizSiteRegionId || null,
      };
      if (isEdit && wizSiteTarget !== NEW_ID) {
        const orig = sites.find((s) => s.id === wizSiteTarget);
        const changed =
          !orig ||
          orig.name !== wizSiteName ||
          orig.address !== wizSiteAddress ||
          orig.pic_name !== wizPicName ||
          orig.pic_phone !== wizPicPhone ||
          (orig.region_id ?? null) !== (wizSiteRegionId || null);
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

  // ─── CSV Export ─────────────────────────────────────────────

  function handleExportCsv() {
    const customerName = new Map(customers.map((c) => [c.id, c.name]));
    const regionNameMap = new Map(regions.filter((r) => !r.is_deleted).map((r) => [r.id, r.name]));
    const rows: ExportCell[][] = [];
    for (const c of customers) {
      rows.push([
        "Customer",
        c.name,
        c.name,
        "",
        "",
        "",
        "",
        "",
        "",
        c.address || "",
        c.phone || "",
      ]);
    }
    for (const s of sites) {
      rows.push([
        "Site",
        s.name,
        customerName.get(s.customer_id || "") || "",
        s.name,
        regionNameMap.get(s.region_id || "") || "",
        "",
        "",
        s.pic_name || "",
        s.pic_phone || "",
        s.address || "",
        "",
      ]);
    }
    for (const u of units) {
      const site = sites.find((x) => x.id === u.site_id);
      rows.push([
        "Unit",
        u.name,
        site ? customerName.get(site.customer_id || "") || "" : "",
        site?.name || "",
        "",
        u.serial_number || "",
        u.type || "",
        "",
        "",
        "",
        "",
      ]);
    }
    exportCsv([EXPORT_HEADERS, ...rows], `atapcare-master-data-${todayStamp()}`);
    toast.success(`${rows.length} baris diekspor ke CSV`);
  }

  // ─── CSV Import ─────────────────────────────────────────────

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      await importCsv(text);
    } catch {
      toast.error("Gagal membaca file CSV");
    } finally {
      setImporting(false);
    }
  }

  async function importCsv(text: string) {
    const raw = parseCsv(text);
    if (raw.length < 2) {
      toast.error("File CSV tidak valid atau kosong");
      return;
    }
    const headers = raw[0].map(normalizeKey);
    const col = (k: string) => headers.indexOf(normalizeKey(k));
    const cell = (row: Record<string, string>, k: string) => {
      const i = col(k);
      return i >= 0 ? row[headers[i]] || "" : "";
    };
    const data = raw.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] || "").trim();
      });
      return obj;
    });

    let createdCustomers = 0;
    let createdSites = 0;
    let createdUnits = 0;
    let skipped = 0;

    const { data: existingCust } = await supabase.from("customers").select("id, name");
    const knownCust = new Map(
      (existingCust || []).map((c: { id: string; name: string }) => [normalizeKey(c.name), c.id]),
    );
    for (const row of data) {
      if (normalizeKey(cell(row, "tipe")) !== "customer") continue;
      const name = cell(row, "nama");
      if (!name || knownCust.has(normalizeKey(name))) {
        skipped++;
        continue;
      }
      const ok = await createCustomer({
        name,
        address: cell(row, "alamat") || undefined,
        phone: cell(row, "no telepon") || undefined,
      });
      if (ok) {
        createdCustomers++;
        knownCust.set(normalizeKey(name), name);
      } else skipped++;
    }

    const { data: freshCust } = await supabase.from("customers").select("id, name");
    const custId = new Map(
      (freshCust || []).map((c: { id: string; name: string }) => [normalizeKey(c.name), c.id]),
    );
    const custNameById = new Map(
      (freshCust || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    );
    const { data: existingSites } = await supabase.from("sites").select("id, name, customer_id");
    const knownSite = new Set(
      (existingSites || []).map(
        (s: { name: string; customer_id: string | null }) =>
          `${normalizeKey(custNameById.get(s.customer_id || "") || "")}::${normalizeKey(s.name)}`,
      ),
    );
    for (const row of data) {
      if (normalizeKey(cell(row, "tipe")) !== "site") continue;
      const custName = cell(row, "customer");
      const cid = custName ? custId.get(normalizeKey(custName)) : undefined;
      const name = cell(row, "nama");
      if (!cid || !name) {
        skipped++;
        continue;
      }
      if (knownSite.has(`${normalizeKey(custName)}::${normalizeKey(name)}`)) {
        skipped++;
        continue;
      }
      const ok = await createSite({
        name,
        address: cell(row, "alamat"),
        pic_name: cell(row, "nama pic") || "-",
        pic_phone: cell(row, "no wa pic") || "-",
        customer_id: cid,
      });
      if (ok) {
        createdSites++;
        knownSite.add(`${normalizeKey(custName)}::${normalizeKey(name)}`);
      } else skipped++;
    }

    const { data: existingSites2 } = await supabase.from("sites").select("id, name, customer_id");
    const siteId = new Map(
      (existingSites2 || []).map((s: { id: string; name: string; customer_id: string | null }) => [
        `${normalizeKey(custNameById.get(s.customer_id || "") || "")}::${normalizeKey(s.name)}`,
        s.id,
      ]),
    );
    const { data: existingUnits } = await supabase.from("units").select("id, site_id, name");
    const knownUnit = new Set(
      (existingUnits || []).map(
        (u: { site_id: string; name: string }) => `${u.site_id}::${normalizeKey(u.name)}`,
      ),
    );
    for (const row of data) {
      if (normalizeKey(cell(row, "tipe")) !== "unit") continue;
      const custName = cell(row, "customer");
      const siteName = cell(row, "site");
      const sid = siteId.get(`${normalizeKey(custName)}::${normalizeKey(siteName)}`);
      const name = cell(row, "nama");
      if (!sid || !name) {
        skipped++;
        continue;
      }
      if (knownUnit.has(`${sid}::${normalizeKey(name)}`)) {
        skipped++;
        continue;
      }
      const ok = await createUnit({
        name,
        serial_number: cell(row, "serial number") || undefined,
        type: cell(row, "tipe unit") || undefined,
        site_id: sid,
      });
      if (ok) {
        createdUnits++;
        knownUnit.add(`${sid}::${normalizeKey(name)}`);
      } else skipped++;
    }

    toast.success(
      `Import selesai: +${createdCustomers} customer, +${createdSites} site, +${createdUnits} unit${skipped ? `, ${skipped} dilewati (duplikat/tanpa induk)` : ""}`,
    );
    loadAll();
  }

  // ─── Derived ────────────────────────────────────────────────

  const regionName = new Map(regions.filter((r) => !r.is_deleted).map((r) => [r.id, r.name]));

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
        className="p-1 rounded-md hover:bg-accent transition text-muted-foreground"
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
      {/* ─── Header: search + toggle + import/export/add ───────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari customer, site, unit…"
              className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:border-ring transition w-72 text-foreground"
            />
          </div>
          <button
            onClick={() => {
              setShowDeleted(false);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!showDeleted ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent"}`}
          >
            Aktif
          </button>
          <button
            onClick={() => {
              setShowDeleted(true);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${showDeleted ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent"}`}
          >
            Data Dihapus
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Import CSV
          </button>
          <button
            onClick={handleExportCsv}
            disabled={customers.length === 0 && sites.length === 0 && units.length === 0}
            className="h-9 px-3.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={openAddCustomer}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
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
                              <p className="text-[13px] font-semibold text-foreground truncate">
                                {c.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.address || c.phone || `${cSites.length} site`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-right">
                          {c.is_deleted ? (
                            <ActionButton
                              icon={RotateCcw}
                              label="Pulihkan"
                              variant="green"
                              onClick={() => handleRestore("customer", c.id, c.name)}
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 justify-end">
                              <ActionButton
                                icon={Plus}
                                label="Tambah Site"
                                variant="green"
                                onClick={() => openAddSite(c.id)}
                              />
                              <ActionButton
                                icon={Pencil}
                                label="Edit"
                                onClick={() => startEditCustomer(c)}
                              />
                            </div>
                          )}
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
                                      <p className="text-[13px] font-medium text-foreground truncate">
                                        {site.name}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        Region: {regionName.get(site.region_id || "") || "—"}
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
                                  ) : (
                                    <div className="flex items-center gap-1.5 justify-end">
                                      <ActionButton
                                        icon={Plus}
                                        label="Tambah Unit"
                                        variant="green"
                                        onClick={() => openAddUnit(site.id)}
                                      />
                                      <ActionButton
                                        icon={Pencil}
                                        label="Edit"
                                        onClick={() => startEditSite(site)}
                                      />
                                      <ActionButton
                                        icon={Trash2}
                                        label="Hapus"
                                        variant="red"
                                        onClick={() => handleSoftDelete("site", site.id, site.name)}
                                      />
                                    </div>
                                  )}
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
                                          <p className="text-[13px] font-medium text-foreground truncate">
                                            {unit.name}
                                          </p>
                                          {unit.type && (
                                            <p className="text-[11px] text-muted-foreground truncate">
                                              {unit.type}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                                      {unit.serial_number || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {unit.is_deleted ? (
                                        <ActionButton
                                          icon={RotateCcw}
                                          label="Pulihkan"
                                          variant="green"
                                          onClick={() => handleRestore("unit", unit.id, unit.name)}
                                        />
                                      ) : (
                                        <div className="flex items-center gap-1.5 justify-end">
                                          <ActionButton
                                            icon={Pencil}
                                            label="Edit"
                                            onClick={() => startEditUnit(unit)}
                                          />
                                          <ActionButton
                                            icon={Trash2}
                                            label="Hapus"
                                            variant="red"
                                            onClick={() =>
                                              handleSoftDelete("unit", unit.id, unit.name)
                                            }
                                          />
                                        </div>
                                      )}
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

      {/* ─── Slide-out Drawer (add/edit) ───────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg bg-card">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-foreground">
              {formMode === "customer"
                ? editingId
                  ? "Edit Customer"
                  : "Tambah Customer"
                : `${editingId ? "Edit" : "Tambah"} ${formMode === "site" ? "Site" : "Unit"}`}
            </SheetTitle>
            {formMode === "customer" && (
              <div className="flex items-center gap-2 pt-2">
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
          </SheetHeader>

          {formMode === "customer" ? (
            <>
              {wizStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={LABEL_CLASS}>Nama *</label>
                    <input
                      value={wizCustomerName}
                      onChange={(e) => setWizCustomerName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Nama customer"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Alamat</label>
                    <input
                      value={wizCustomerAddress}
                      onChange={(e) => setWizCustomerAddress(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Alamat customer"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No Telepon</label>
                    <input
                      value={wizCustomerPhone}
                      onChange={(e) => setWizCustomerPhone(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Nomor telepon customer"
                    />
                  </div>
                </div>
              )}

              {wizStep === 2 && (
                <div className="space-y-4">
                  {editingId && (
                    <div>
                      <label className={LABEL_CLASS}>Site yang dikelola</label>
                      <select
                        value={wizSiteTarget}
                        onChange={(e) => handleSiteTargetChange(e.target.value)}
                        className={FIELD_CLASS}
                      >
                        {sites
                          .filter((s) => s.customer_id === editingId && !s.is_deleted)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        <option value={NEW_ID}>＋ Site Baru</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={LABEL_CLASS}>Nama Site</label>
                    <input
                      value={wizSiteName}
                      onChange={(e) => setWizSiteName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Nama site / lokasi"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Region</label>
                    <select
                      value={wizSiteRegionId}
                      onChange={(e) => setWizSiteRegionId(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="">— Tanpa Region —</option>
                      {regions
                        .filter((r) => !r.is_deleted)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Alamat Site</label>
                    <input
                      value={wizSiteAddress}
                      onChange={(e) => setWizSiteAddress(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Alamat lokasi site"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Nama PIC *</label>
                    <input
                      value={wizPicName}
                      onChange={(e) => setWizPicName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Nama penanggung jawab site"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No WA PIC *</label>
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
                <div className="space-y-4">
                  {hasWizardSite ? (
                    <>
                      {editingId && wizSiteTarget !== NEW_ID && (
                        <div>
                          <label className={LABEL_CLASS}>Unit yang dikelola</label>
                          <select
                            value={wizUnitTarget}
                            onChange={(e) => handleUnitTargetChange(e.target.value)}
                            className={FIELD_CLASS}
                          >
                            {units
                              .filter((u) => u.site_id === wizSiteTarget && !u.is_deleted)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            <option value={NEW_ID}>＋ Unit Baru</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className={LABEL_CLASS}>Nama Unit</label>
                        <input
                          value={wizUnitName}
                          onChange={(e) => setWizUnitName(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="Nama unit"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Serial Number</label>
                        <input
                          value={wizUnitSerial}
                          onChange={(e) => setWizUnitSerial(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="Serial number unit"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Tipe Unit</label>
                        <input
                          value={wizUnitType}
                          onChange={(e) => setWizUnitType(e.target.value)}
                          className={FIELD_CLASS}
                          placeholder="cth. AC Split 1PK, Genset, dll."
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
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Nama *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder={formMode === "site" ? "Nama site / lokasi" : "Nama unit"}
                />
              </div>

              {formMode === "site" && (
                <>
                  <div>
                    <label className={LABEL_CLASS}>Region</label>
                    <select
                      value={formRegionId}
                      onChange={(e) => setFormRegionId(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="">— Tanpa Region —</option>
                      {regions
                        .filter((r) => !r.is_deleted)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Customer</label>
                    <select
                      value={formCustomerId || formParentCustomerId || ""}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      disabled={!!formParentCustomerId}
                      className={`${FIELD_CLASS} disabled:opacity-50`}
                    >
                      {formParentCustomerId && (
                        <option value={formParentCustomerId}>
                          {customers.find((c) => c.id === formParentCustomerId)?.name}
                        </option>
                      )}
                      {!formParentCustomerId &&
                        customers
                          .filter((c) => !c.is_deleted)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Alamat Site</label>
                    <input
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Alamat lokasi site"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Nama PIC *</label>
                    <input
                      value={formPicName}
                      onChange={(e) => setFormPicName(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Nama penanggung jawab site"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>No WA PIC *</label>
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
                    <label className={LABEL_CLASS}>Serial Number</label>
                    <input
                      value={formSerialNumber}
                      onChange={(e) => setFormSerialNumber(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="Serial number unit"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Tipe Unit</label>
                    <input
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className={FIELD_CLASS}
                      placeholder="cth. AC Split 1PK, Genset, dll."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-border">
            {formMode === "customer" ? (
              <>
                {wizStep === 1 && (
                  <>
                    <SheetClose className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
                      Batal
                    </SheetClose>
                    <button
                      onClick={() => setWizStep(2)}
                      disabled={!wizCustomerName.trim() || saving}
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
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
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
                        className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition"
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
                      className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
                    >
                      Lanjut <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {wizStep === 3 && (
                  <>
                    <button
                      onClick={() => setWizStep(2)}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                    </button>
                    <button
                      onClick={handleWizardSave}
                      disabled={saving}
                      className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Simpan
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <SheetClose className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
                  Batal
                </SheetClose>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !formName.trim() ||
                    (formMode === "site" && (!formPicName.trim() || !formPicPhone.trim()))
                  }
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan
                </button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

