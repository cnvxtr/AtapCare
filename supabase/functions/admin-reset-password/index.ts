// Edge Function: reset password user oleh Admin.
// Deploy: supabase functions deploy admin-reset-password
// service_role hanya hidup di server, tidak pernah diekspos ke frontend anon.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
const supabaseSecretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
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
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return json({ error: "Akses ditolak: hanya Admin" }, 403);
  }

  let body: { userId?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { userId, newPassword } = body;

  if (!userId || typeof newPassword !== "string" || newPassword.length < 6) {
    return json({ error: "Password minimal 6 karakter" }, 400);
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return json({ error: error.message }, 500);

  // tandai wajib ganti password (update via service client, RLS di-bypass).
  await supabase.from("users").update({ must_change_password: true }).eq("id", userId);

  return json({ ok: true });
});
