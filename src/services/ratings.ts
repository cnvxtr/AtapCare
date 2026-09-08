import { supabase } from "@/lib/supabase";

// Data rating tiket untuk admin (leaderboard helpdesk + detail).
// rating/review ada di tabel tickets. Atribusi helpdesk diambil dari tabel
// activities (action 'Tiket divalidasi', utk NEW→OPEN) agar retroaktif —
// helpdesk yang memvalidasi tercatat untuk semua tiket, bukan hanya yang
// divalidasi setelah migration 61.

export interface RatingRow {
  id: string;
  code: string;
  customer: string;
  site: string | null;
  unit: string | null;
  rating: number;
  review: string | null;
  helpdeskUserId: string | null;
  helpdeskName: string | null;
  closedAt: string;
}

export interface HelpdeskScore {
  userId: string | null;
  name: string;
  total: number;       // jumlah tiket yang dirating
  totalStars: number;  // jumlah total bintang (sum semua rating)
  avg: number;         // rata-rata bintang
  validated: number;   // jumlah tiket yang divalidasi helpdesk ini
}

interface ValidateActivity {
  ticket_id: string;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

// Semua aktivitas validasi (NEW→OPEN), untuk atribusi & hitung jumlah validasi.
async function getValidateActivities(): Promise<ValidateActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("ticket_id, user_id, user_name, created_at")
    .eq("action", "Tiket divalidasi")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as ValidateActivity[];
}

async function getRatingTickets(): Promise<RatingRow[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("id, code, customer, site, unit, rating, review, closed_at")
    .not("rating", "is", null)
    .order("closed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    customer: t.customer,
    site: t.site,
    unit: t.unit,
    rating: t.rating,
    review: t.review,
    helpdeskUserId: null,
    helpdeskName: null,
    closedAt: t.closed_at,
  }));
}

// Leaderboard per user id helpdesk (bukan per nama) agar nama sama terpisah.
export function buildSeedHelpdeskLeaderboard(rows: RatingRow[]): HelpdeskScore[] {
  const map = new Map<string, HelpdeskScore>();
  for (const r of rows) {
    // Tanpa atribusi user → satu bucket "Tanpa atribusi" agar tdk salah menggabung
    // per nama (bisa dua orang berbeda dengan nama sama).
    const key = r.helpdeskUserId ?? "__no_attribution__";
    let s = map.get(key);
    if (!s) {
      s = { userId: r.helpdeskUserId, name: r.helpdeskName || "Tanpa atribusi", total: 0, totalStars: 0, avg: 0, validated: 0 };
      map.set(key, s);
    }
    s.total += 1;
    s.totalStars += r.rating;
    s.avg += r.rating;
  }
  const scores = Array.from(map.values()).map((s) => ({ ...s, avg: s.total ? s.avg / s.total : 0 }));
  scores.sort((a, b) => b.avg - a.avg || b.total - a.total);
  return scores;
}

export async function getRatings(): Promise<{ rows: RatingRow[]; leaderboard: HelpdeskScore[] }> {
  const rows = await getRatingTickets();
  const acts = await getValidateActivities();

  // Atribusi: helpdesk yang memvalidasi tiap tiket (activity pertama per tiket).
  const helpdeskByTicket = new Map<string, { userId: string | null; name: string }>();
  const validatedByUser = new Map<string, number>();
  for (const a of acts) {
    if (!a.user_id) continue;
    if (!helpdeskByTicket.has(a.ticket_id)) {
      helpdeskByTicket.set(a.ticket_id, { userId: a.user_id, name: a.user_name ?? "—" });
    }
    validatedByUser.set(a.user_id, (validatedByUser.get(a.user_id) ?? 0) + 1);
  }

  const withHelpdesk = rows.map((r) => {
    const h = helpdeskByTicket.get(r.id);
    return { ...r, helpdeskUserId: h?.userId ?? null, helpdeskName: h?.name ?? null };
  });

  const leaderboard = buildSeedHelpdeskLeaderboard(withHelpdesk).map((s) => ({
    ...s,
    validated: s.userId ? validatedByUser.get(s.userId) ?? 0 : 0,
  }));

  return { rows: withHelpdesk, leaderboard };
}