/**
 * Inventory Service — Backend layer untuk CRUD inventaris.
 * 
 * Menggunakan Supabase database queries.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  type InventoryItem,
} from "@/lib/mock-data";

export type { InventoryItem };

type DbItem = Database["public"]["Tables"]["inventory"]["Row"];

// ─── Transform helper ────────────────────────────────────────
function toItem(db: DbItem): InventoryItem {
  return {
    id: db.id,
    sku: db.sku,
    name: db.name,
    category: db.category,
    stock: db.stock,
    minStock: db.min_stock,
    quarantine: db.quarantine,
    unit: db.unit,
  };
}

// ─── Public API ──────────────────────────────────────────────

/** Ambil semua item inventaris dari database. */
export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("name");

  if (error) {
    console.error("[inventory] getInventory error:", error);
    return [];
  }
  return (data || []).map(toItem);
}

/** Cari item berdasarkan ID. */
export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toItem(data);
}

/** Cari item berdasarkan SKU. */
export async function getInventoryBySku(sku: string): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("sku", sku)
    .single();

  if (error || !data) return null;
  return toItem(data);
}

/** Filter inventaris berdasarkan kategori atau pencarian. */
export async function filterInventory(opts: {
  category?: string;
  search?: string;
  lowStock?: boolean;
}): Promise<InventoryItem[]> {
  let query = supabase.from("inventory").select("*");

  if (opts.category) {
    query = query.eq("category", opts.category);
  }
  if (opts.lowStock) {
    query = query.lte("stock", supabase.rpc("col", { col: "min_stock" }));
  }
  if (opts.search) {
    const q = opts.search;
    query = query.or(`sku.ilike.%${q}%,name.ilike.%${q}%,category.ilike.%${q}%`);
  }

  const { data, error } = await query.order("name");

  if (error) {
    console.error("[inventory] filterInventory error:", error);
    return [];
  }
  return (data || []).map(toItem);
}

/** Hitung statistik inventaris. */
export async function getInventoryStats(): Promise<{
  total: number; lowStock: number; totalQuarantine: number; categories: string[];
}> {
  const { data, error } = await supabase.from("inventory").select("*");

  if (error || !data) {
    return { total: 0, lowStock: 0, totalQuarantine: 0, categories: [] };
  }

  return {
    total: data.length,
    lowStock: data.filter((i) => i.stock <= i.min_stock).length,
    totalQuarantine: data.reduce((sum, i) => sum + i.quarantine, 0),
    categories: [...new Set(data.map((i) => i.category))],
  };
}

/** Ambil daftar kategori unik. */
export async function getInventoryCategories(): Promise<string[]> {
  const { data, error } = await supabase.from("inventory").select("category");

  if (error || !data) return [];
  return [...new Set(data.map((i) => i.category))];
}
