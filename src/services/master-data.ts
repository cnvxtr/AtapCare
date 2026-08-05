import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  name: string;
  code?: string | null;
  pic_name?: string | null;
  pic_phone?: string | null;
  address?: string | null;
  phone?: string | null;
  is_deleted: boolean;
}

export interface Region {
  id: string;
  customer_id?: string | null;
  name: string;
  is_deleted: boolean;
}

export interface SiteRow {
  id: string;
  name: string;
  customer_id?: string | null;
  region_id?: string | null;
  pic_name: string;
  pic_phone: string;
  address?: string | null;
  is_deleted: boolean;
}

export interface UnitRow {
  id: string;
  name: string;
  site_id: string;
  serial_number?: string | null;
  type?: string | null;
  is_deleted: boolean;
}

const ACTIVE_STATUSES = [
  "NEW",
  "OPEN",
  "UNASSIGNED",
  "SCHEDULED",
  "EN_ROUTE",
  "WORKING",
  "PENDING",
];

export async function getCustomers(includeDeleted = false): Promise<Customer[]> {
  let q = supabase.from("customers").select("*").order("name");
  if (!includeDeleted) q = q.eq("is_deleted", false);
  const { data } = await q;
  return (data || []) as Customer[];
}

export async function getSites(includeDeleted = false): Promise<SiteRow[]> {
  let q = supabase.from("sites").select("*").order("name");
  if (!includeDeleted) q = q.eq("is_deleted", false);
  const { data } = await q;
  return (data || []) as SiteRow[];
}

export async function getUnits(includeDeleted = false): Promise<UnitRow[]> {
  let q = supabase.from("units").select("*").order("name");
  if (!includeDeleted) q = q.eq("is_deleted", false);
  const { data } = await q;
  return (data || []) as UnitRow[];
}

type NewCustomer = {
  name: string;
  code?: string;
  pic_name?: string;
  pic_phone?: string;
  address?: string;
  phone?: string;
};
type NewSite = {
  name: string;
  address?: string;
  pic_name: string;
  pic_phone: string;
  customer_id: string;
  region_id?: string | null;
};
type NewUnit = { name: string; serial_number?: string; type?: string; site_id: string };

export async function createCustomer(input: NewCustomer): Promise<string | null> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...input, is_deleted: false })
    .select("id")
    .single();
  if (error) return null;
  await logActivity("create", "customers", data.id, { name: input.name });
  return data.id;
}

export async function updateCustomer(id: string, input: NewCustomer): Promise<boolean> {
  const { error } = await supabase.from("customers").update(input).eq("id", id);
  if (error) return false;
  await logActivity("update", "customers", id, { changes: input });
  return true;
}

export async function softDeleteCustomer(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("customers")
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) return false;
  await logActivity("soft_delete", "customers", id);
  return true;
}

export async function restoreCustomer(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("customers")
    .update({ is_deleted: false })
    .eq("id", id);
  if (error) return false;
  await logActivity("restore", "customers", id);
  return true;
}

export async function createSite(input: NewSite): Promise<string | null> {
  const { data, error } = await supabase
    .from("sites")
    .insert({ ...input, is_deleted: false })
    .select("id")
    .single();
  if (error) return null;
  await logActivity("create", "sites", data.id, { name: input.name });
  return data.id;
}

export async function updateSite(id: string, input: NewSite): Promise<boolean> {
  const { error } = await supabase.from("sites").update(input).eq("id", id);
  if (error) return false;
  await logActivity("update", "sites", id, { changes: input });
  return true;
}

export async function softDeleteSite(id: string): Promise<boolean> {
  const { error } = await supabase.from("sites").update({ is_deleted: true }).eq("id", id);
  if (error) return false;
  await logActivity("soft_delete", "sites", id);
  return true;
}

export async function restoreSite(id: string): Promise<boolean> {
  const { error } = await supabase.from("sites").update({ is_deleted: false }).eq("id", id);
  if (error) return false;
  await logActivity("restore", "sites", id);
  return true;
}

export async function createUnit(input: NewUnit): Promise<string | null> {
  const { data, error } = await supabase
    .from("units")
    .insert({ ...input, is_deleted: false })
    .select("id")
    .single();
  if (error) return null;
  await logActivity("create", "units", data.id, { name: input.name });
  return data.id;
}

export async function updateUnit(id: string, input: NewUnit): Promise<boolean> {
  const { error } = await supabase.from("units").update(input).eq("id", id);
  if (error) return false;
  await logActivity("update", "units", id, { changes: input });
  return true;
}

export async function softDeleteUnit(id: string): Promise<boolean> {
  const { error } = await supabase.from("units").update({ is_deleted: true }).eq("id", id);
  if (error) return false;
  await logActivity("soft_delete", "units", id);
  return true;
}

export async function restoreUnit(id: string): Promise<boolean> {
  const { error } = await supabase.from("units").update({ is_deleted: false }).eq("id", id);
  if (error) return false;
  await logActivity("restore", "units", id);
  return true;
}

// BR-75D guard: unit/site/customer dengan tiket aktif tidak boleh di-soft-delete.
// Tiket menyimpan nama (string), bukan FK, dan `tickets.customer` berisi nama
// pelapor (bukan nama perusahaan) — jadi guard customer diturunkan dari site
// yang dimiliki customer (tickets.site cocok dengan sites.name).
// ponytail: pencocokan berbasis nama; upgrade sebenarnya = kolom FK unit_id di
// tickets yang diisi saat pembuatan tiket.
export async function countActiveTicketsFor(
  type: "customer" | "site" | "unit",
  id: string,
): Promise<number> {
  if (type === "customer") {
    const { data: sites } = await supabase.from("sites").select("name").eq("customer_id", id);
    const names = (sites || []).map((s) => s.name);
    if (!names.length) return 0;
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("site", names)
      .in("status", ACTIVE_STATUSES);
    return count || 0;
  }

  const column = type === "site" ? "site" : "unit";
  const table = type === "site" ? "sites" : "units";
  const { data: entity } = await supabase.from(table).select("name").eq("id", id).single();
  if (!entity?.name) return 0;
  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq(column, entity.name)
    .in("status", ACTIVE_STATUSES);
  return count || 0;
}

// Actor audit diset saat login (lihat AuthContext). Fallback 'Admin' agar
// service tetap aman dipakai di luar konteks sesi (mis. seed/script).
let currentActor: string | null = null;
export function setAuditActor(name: string | null) {
  currentActor = name;
}

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("audit_logs").insert({
    actor_name: currentActor || "Admin",
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata || {},
  });
}
