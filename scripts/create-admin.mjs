// One-off seed: buat akun auth Supabase (terkonfirmasi) + baris tabel `users`
// untuk role admin & pm. Idempotent (skip yang sudah ada).
//
// Cara pakai:
//   1. Jalankan supabase/migrations/01_admin.sql di SQL Editor (wajib dulu).
//   2. Tambahkan baris ini ke .env (lalu hapus setelah selesai):
//        SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
//   3. node scripts/create-admin.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function env(name) {
  if (process.env[name]) return process.env[name];
  const file = ".env";
  if (existsSync(file)) {
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  }
  return undefined;
}

const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !key) {
  console.error(
    "Butuh SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY. Tambahkan SUPABASE_SERVICE_ROLE_KEY ke .env lalu jalankan ulang.",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const accounts = [
  {
    username: "admin",
    email: "admin@atapcare.local",
    password: "admin123",
    name: "Administrator",
    role: "admin",
  },
  {
    username: "aditya",
    email: "aditya@atapcare.com",
    password: "123456",
    name: "Aditya",
    role: "pm",
  },
];

const { error: probe } = await sb.from("users").select("name").limit(1);
if (probe) {
  console.error(
    "Kolom 'name' belum ada di tabel users. Jalankan supabase/migrations/01_admin.sql di SQL Editor terlebih dahulu.",
  );
  process.exit(1);
}

for (const acc of accounts) {
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("username", acc.username)
    .maybeSingle();
  if (existing) {
    console.log(`skip ${acc.username} (sudah ada)`);
    continue;
  }

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: acc.email,
    password: acc.password,
    email_confirm: true,
  });
  if (authErr) {
    console.error(`gagal buat auth ${acc.username}: ${authErr.message}`);
    continue;
  }

  const { error: insErr } = await sb.from("users").insert({
    id: authUser.user.id,
    email: acc.email,
    username: acc.username,
    name: acc.name,
    full_name: acc.name,
    role: acc.role,
    default_role: acc.role,
    status: "aktif",
    must_change_password: false,
    is_deleted: false,
  });
  if (insErr) {
    console.error(`gagal insert users ${acc.username}: ${insErr.message}`);
    continue;
  }

  console.log(`OK ${acc.username} (${acc.role}) -> login: ${acc.username} / ${acc.password}`);
}

console.log("\nSelesai. Buka /login dan masukkan kredensial di atas.");
