// Edge Function: hapus user secara permanen oleh Admin.
// Deploy: supabase functions deploy admin-delete-user
// service_role hanya hidup di server, tidak pernah diekspos ke frontend anon.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(
  supabaseUrl,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Otorisasi: pemanggil harus user dengan role "admin".
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return json({ error: "Akses ditolak: hanya Admin" }, 403);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { userId } = body;

  if (!userId || typeof userId !== "string") {
    return json({ error: "userId wajib diisi" }, 400);
  }
  if (userId === user.id) {
    return json({ error: "Tidak bisa menghapus akun sendiri" }, 400);
  }

  // Blokir jika user masih memegang tiket aktif.
  const { data: active } = await supabase
    .from("tickets")
    .select("id")
    .in("status", ACTIVE_STATUSES)
    .eq("assigned_to", userId)
    .limit(1);
  if (active && active.length > 0) {
    return json({ error: "User masih memiliki tiket aktif." }, 400);
  }

  // Lepas tiket lama (menghindari FK RESTRICT yang belum terdokumentasi di repo).
  await supabase.from("tickets").update({ assigned_to: null }).eq("assigned_to", userId);

  const { error: deleteProfileError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);
  if (deleteProfileError) {
    return json({ error: deleteProfileError.message }, 500);
  }

  // Hapus akun auth agar hilang dari tab Authentication.
  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    // Profil sudah terhapus; retry oleh admin akan menyelesaikan penghapusan akun.
    return json({ error: deleteAuthError.message }, 500);
  }

  await supabase.from("audit_logs").insert({
    actor_name: profile.name || "Admin",
    action: "delete_user",
    entity_type: "users",
    entity_id: userId,
    metadata: { deleted_by: user.id },
  });

  return json({ ok: true });
});
