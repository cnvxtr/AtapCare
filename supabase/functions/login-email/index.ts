// Edge Function: resolusi nama pengguna → email untuk login.
// Email hanya dibuka SETELAH kata sandi terverifikasi — anon tidak bisa
// memanen email milik pengguna lain dari nama penggunanya.
// Deploy: supabase functions deploy login-email
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
const supabaseSecretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

// Service client: membaca users.username tanpa terkena RLS.
const service = createClient(
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

  let body: { identifier?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) return json({ error: "invalid_credentials" }, 401);

  // Identifier berupa email → langsung dipakai; selain itu → cari via username.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data } = await service
      .from("users")
      .select("email")
      .eq("username", identifier)
      .maybeSingle();
    if (!data?.email) return json({ error: "invalid_credentials" }, 401);
    email = data.email;
  }

  // Bukti kata sandi sebelum email diakui — jawaban gagal selalu generik.
  const probe = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return json({ error: "invalid_credentials" }, 401);

  // Akun nonaktif / ditandai terhapus tetap diblokir walau sandi benar.
  const { data: account } = await service
    .from("users")
    .select("status, is_deleted")
    .eq("email", email)
    .maybeSingle();
  if (!account || account.status === "nonaktif" || account.is_deleted) {
    return json({ error: "invalid_credentials" }, 401);
  }

  return json({ email });
});
