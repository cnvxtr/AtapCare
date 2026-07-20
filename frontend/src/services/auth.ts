/**
 * Auth Service — Backend layer untuk autentikasi & session management.
 * 
 * Menggunakan Supabase Auth untuk login real.
 * Demo accounts tetap tersedia untuk development/quick-access.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  type DemoAccount,
  demoAccounts,
  loginAs as _loginAsDemo,
} from "@/lib/demo-accounts";

// ─── Types ───────────────────────────────────────────────────
export interface Session {
  userId: string;
  email: string;
  role: string;
  roleLabel: string;
  displayName: string;
}

// ─── Public API ──────────────────────────────────────────────

/** Login dengan email & password via Supabase Auth. */
export async function login(email: string, password: string): Promise<{ user: any; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: "Login gagal" };

  // Ambil role dari tabel user_roles
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .single();

  // Ambil display name dari profiles
  const { data: profileData } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .single();

  // Simpan session ke localStorage untuk akses cepat
  const session: Session = {
    userId: data.user.id,
    email: data.user.email || email,
    role: roleData?.role || "helpdesk",
    roleLabel: formatRole(roleData?.role || "helpdesk"),
    displayName: profileData?.display_name || email.split("@")[0],
  };
  localStorage.setItem("atap-care:session", JSON.stringify(session));

  return { user: data.user };
}

/** Quick login untuk demo accounts (development). */
export function quickLogin(account: DemoAccount): void {
  _loginAsDemo(account);
}

/** Logout — hapus session dari Supabase & localStorage. */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  localStorage.removeItem("atap-care:session");
}

/** Ambil session saat ini dari localStorage (sync, untuk UI). */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("atap-care:session");
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/** Ambil session dari Supabase Auth (async, untuk verifikasi). */
export async function getSupabaseSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Cek apakah user saat ini punya role tertentu. */
export function hasRole(role: string): boolean {
  const session = getSession();
  return session?.role === role;
}

/** Ambil daftar semua akun demo (untuk UI quick-login). */
export function getDemoAccounts(): DemoAccount[] {
  return demoAccounts;
}

/** Format role name ke label yang lebih readable. */
function formatRole(role: string): string {
  const labels: Record<string, string> = {
    sys_admin: "Sys Admin",
    helpdesk: "Helpdesk",
    supervisor: "Supervisor",
    field_tech: "Field Technician",
    warehouse: "Warehouse",
  };
  return labels[role] || role;
}
