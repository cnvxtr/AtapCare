import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./master-data";

export interface AuditLog {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditFilters {
  from?: string;
  to?: string;
  action?: string;
  limit?: number;
}

export async function getAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  let q = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.from) q = q.gte("created_at", new Date(filters.from).toISOString());
  if (filters.to) q = q.lte("created_at", new Date(`${filters.to}T23:59:59`).toISOString());
  const { data } = await q;
  return (data || []).map((r) => ({
    id: r.id,
    actorName: r.actor_name ?? null,
    action: r.action,
    entityType: r.entity_type ?? null,
    entityId: r.entity_id ?? null,
    metadata: (r.metadata as Record<string, unknown>) || {},
    createdAt: r.created_at,
  }));
}

export async function trackArchiveReveal(
  type: string,
  id: string,
  label: string,
): Promise<void> {
  await logActivity("archive_reveal", type, id, { label, reason: "revealed_by_admin" });
}

export { logActivity };
