// Edge Function: reset password user oleh Admin.
// Deploy: supabase functions deploy admin-reset-password
// service_role hanya hidup di server, tidak pernah diekspos ke frontend anon.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(
  supabaseUrl,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Otorisasi: pemanggil harus user dengan role "admin".
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Akses ditolak: hanya Admin" }, { status: 403 });
  }

  let body: { userId?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { userId, newPassword } = body;

  if (
    !userId ||
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    !/[a-zA-Z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    return Response.json(
      { error: "Password minimal 8 karakter, kombinasi huruf dan angka" },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // tandai wajib ganti password (update via service client, RLS di-bypass).
  await supabase.from("users").update({ must_change_password: true }).eq("id", userId);

  return Response.json({ ok: true });
});
