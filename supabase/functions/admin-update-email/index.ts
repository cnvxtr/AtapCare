// Edge Function: ganti email (auth + public.users) user oleh Admin.
// Deploy: supabase functions deploy admin-update-email
export {};
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
const supabaseSecretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

// Service client: bypass RLS untuk update public.users.
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

    let body: { userId?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { userId, email } = body;

    if (!userId || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return json({ error: "Email wajib diisi dan harus valid" }, 400);
    }
    const finalEmail = email.trim();

    // updateUserById menolak email yang sudah dipakai akun lain.
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email: finalEmail,
      email_confirm: true,
    });
    if (error) return json({ error: error.message }, 500);

    // Sinkron public.users.email — dipakai login-email untuk resolve username.
    const { error: upsertError } = await supabase
      .from("users")
      .update({ email: finalEmail })
      .eq("id", userId);
    if (upsertError) {
      return json({ error: `Gagal menyimpan profil user: ${upsertError.message}` }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: `Internal error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});