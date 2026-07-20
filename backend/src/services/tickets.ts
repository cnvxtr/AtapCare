/**
 * Tickets Service — Backend layer untuk CRUD tiket.
 * 
 * Menggunakan Supabase database queries.
 * Masih ada static helpers dari mock-data untuk display (colors, kpi, dll).
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  type Ticket as MockTicket,
  type Priority,
  type TicketStatus,
  technicians as _mockTechnicians,
  locations as _mockLocations,
  statusColors,
  priorityColors,
  kpiData,
  workloadData,
  trendData,
} from "@/lib/mock-data";

// ─── Re-export types & display helpers ───────────────────────
export type Ticket = MockTicket;
export type { Priority, TicketStatus };
export { statusColors, priorityColors, kpiData, workloadData, trendData };

type DbTicket = Database["public"]["Tables"]["tickets"]["Row"];

// ─── Transform helper ────────────────────────────────────────
function toTicket(db: DbTicket): Ticket {
  return {
    id: db.id,
    code: db.code,
    customer: db.customer,
    company: db.company,
    phone: db.phone,
    category: db.category,
    location: db.location,
    equipment: db.equipment,
    serial: db.serial || undefined,
    description: db.description,
    priority: db.priority,
    status: db.status,
    createdAt: db.created_at,
    assignee: db.assignee || undefined,
    slaDeadline: db.sla_deadline || "",
    slaPaused: db.sla_paused,
  };
}

// ─── Public API ──────────────────────────────────────────────

/** Ambil semua tiket dari database. */
export async function getTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tickets] getTickets error:", error);
    return [];
  }
  return (data || []).map(toTicket);
}

/** Cari tiket berdasarkan kode (misal: TKT-2026-0812). */
export async function getTicketByCode(code: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) return null;
  return toTicket(data);
}

/** Filter tiket berdasarkan beberapa kriteria. */
export async function filterTickets(opts: {
  status?: TicketStatus;
  priority?: Priority;
  category?: string;
  assignee?: string;
  search?: string;
}): Promise<Ticket[]> {
  let query = supabase.from("tickets").select("*");

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.priority) query = query.eq("priority", opts.priority);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.assignee) query = query.eq("assignee", opts.assignee);

  if (opts.search) {
    const q = opts.search;
    query = query.or(
      `code.ilike.%${q}%,customer.ilike.%${q}%,equipment.ilike.%${q}%,description.ilike.%${q}%`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[tickets] filterTickets error:", error);
    return [];
  }
  return (data || []).map(toTicket);
}

/** Hitung statistik tiket untuk dashboard. */
export async function getTicketStats(): Promise<{
  total: number; open: number; inProgress: number;
  pending: number; resolved: number; closed: number; p1: number;
}> {
  const { data, error } = await supabase.from("tickets").select("*");

  if (error || !data) {
    return { total: 0, open: 0, inProgress: 0, pending: 0, resolved: 0, closed: 0, p1: 0 };
  }

  return {
    total: data.length,
    open: data.filter((t) => t.status === "Open").length,
    inProgress: data.filter((t) => t.status === "In Progress").length,
    pending: data.filter((t) => t.status === "Pending").length,
    resolved: data.filter((t) => t.status === "Resolved").length,
    closed: data.filter((t) => t.status === "Closed").length,
    p1: data.filter((t) => t.priority === "P1").length,
  };
}

/** Buat tiket baru (dari form publik / dashboard). */
export async function createTicket(input: {
  customer: string;
  phone: string;
  company: string;
  category: Database["public"]["Enums"]["ticket_category"];
  location: string;
  equipment: string;
  description: string;
  serial?: string;
}): Promise<Ticket | null> {
  const num = Math.floor(1000 + Math.random() * 9000);
  const code = `TKT-2026-${num}`;

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      code,
      customer: input.customer,
      phone: input.phone,
      company: input.company,
      category: input.category,
      location: input.location,
      equipment: input.equipment,
      description: input.description,
      serial: input.serial || null,
      priority: "P3",
      status: "Open",
      sla_paused: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[tickets] createTicket error:", error);
    return null;
  }
  return toTicket(data);
}

/** Ambil daftar teknisi (static — bisa di-DB nanti). */
export function getTechnicians(): string[] {
  return _mockTechnicians;
}

/** Ambil daftar lokasi berdasarkan kategori. */
export function getLocations(category: "ASDP VMS" | "INTANK"): string[] {
  return _mockLocations[category] || [];
}

/** Ambil semua lokasi (flat). */
export function getAllLocations(): string[] {
  return [..._mockLocations["ASDP VMS"], ..._mockLocations["INTANK"]];
}
