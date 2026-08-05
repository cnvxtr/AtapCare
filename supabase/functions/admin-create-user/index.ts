// Edge Function: membuat auth user (tanpa email konfirmasi) oleh Admin.
// Deploy: supabase functions deploy admin-create-user
// Kenapa server-side: signUp client mengirim email konfirmasi → kena rate limit email Supabase.
// email_confirm: true => tidak ada email terkirim, user langsung bisa login.
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

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
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

    let body: {
      username?: string;
      password?: string;
      name?: string;
      wa_number?: string;
      role?: string;
      roles?: string;
      status?: string;
    };
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { username, password, name, wa_number, role, roles, status } = body;

    if (typeof username !== "string" || !username.trim()) {
      return json({ error: "Username wajib diisi" }, 400);
    }
    if (typeof password !== "string" || password.length < 6) {
      return json({ error: "Password minimal 6 karakter" }, 400);
    }

    const email = `${username.trim()}@atapcare.local`;

    // Idempoten: kalau auth user sudah ada (mis. retry setelah response hilang),
    // pakai userId yang ada — baris public.users tetap di-upsert di bawah.
    let userId: string;
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError && createError.code !== "user_already_exists") {
      return json({ error: createError.message }, 500);
    }
    if (created?.user) {
      userId = created.user.id;
    } else {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const existing = list.users.find((u) => u.email === email);
      if (!existing) return json({ error: createError?.message || "Gagal membuat user" }, 500);
      userId = existing.id;
    }

    // Tulis/update baris public.users sendiri (service role bypass RLS) supaya
    // full_name, name, wa_number, role, roles, status & must_change_password
    // tersimpan benar — tidak bergantung RPC admin_save_user yang bisa tertinggal.
    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      email,
      username: username.trim(),
      name: name || "",
      full_name: name || "",
      wa_number: wa_number || "",
      role: role || "teknisi",
      roles: roles || role || "teknisi",
      status: status || "aktif",
      must_change_password: true,
      is_deleted: false,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      return json({ error: `Gagal menyimpan profil user: ${upsertError.message}` }, 500);
    }

    return json({ userId });
  } catch (err) {
    return json({ error: `Internal error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
