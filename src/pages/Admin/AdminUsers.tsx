import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Loader2, Search, Key, Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, UserStatus } from "@/lib/types";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "pm", label: "Project Manager" },
  { value: "teknisi", label: "Teknisi Lapangan" },
];

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "cuti", label: "Cuti" },
  { value: "nonaktif", label: "Nonaktif" },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  helpdesk: "bg-blue-100 text-blue-700",
  pm: "bg-purple-100 text-purple-700",
  teknisi: "bg-green-100 text-green-700",
};

interface UserRow {
  id: string;
  username: string;
  name: string;
  wa_number: string | null;
  role: AppRole;
  status: UserStatus;
  must_change_password: boolean;
  last_login: string | null;
  active_tickets: number;
}

const ITEMS_PER_PAGE = 10;

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formWa, setFormWa] = useState("");
  const [formRole, setFormRole] = useState<AppRole>("teknisi");
  const [formStatus, setFormStatus] = useState<UserStatus>("aktif");

  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [resetPwName, setResetPwName] = useState("");
  const [resetPwValue, setResetPwValue] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data: userData } = await supabase
      .from("users")
      .select(
        "id, username, name, wa_number, role, status, must_change_password, last_login",
      )
      .eq("is_deleted", false)
      .order("name");

    if (!userData) {
      setLoading(false);
      return;
    }

    const rows: UserRow[] = [];
    for (const u of userData) {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", u.id)
        .in("status", ["NEW", "OPEN", "UNASSIGNED", "SCHEDULED", "EN_ROUTE", "WORKING", "PENDING"]);
      rows.push({
        id: u.id,
        username: u.username,
        name: u.name,
        wa_number: u.wa_number,
        role: (u.role || "teknisi") as AppRole,
        status: (u.status || "aktif") as UserStatus,
        must_change_password: u.must_change_password,
        last_login: u.last_login,
        active_tickets: count || 0,
      });
    }
    setUsers(rows);
    setLoading(false);
  }

  function resetForm() {
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setFormWa("");
    setFormRole("teknisi");
    setFormStatus("aktif");
    setEditingId(null);
  }

  function openAddDrawer() {
    resetForm();
    setDrawerOpen(true);
  }

  function openEditDrawer(u: UserRow) {
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword("");
    setFormWa(u.wa_number || "");
    setFormRole(u.role);
    setFormStatus(u.status);
    setEditingId(u.id);
    setDrawerOpen(true);
  }

  async function checkActiveTickets(userId: string, newStatus: UserStatus): Promise<boolean> {
    const user = users.find((u) => u.id === userId);
    if (!user) return true;
    if (newStatus !== "nonaktif") return true;
    if (user.status === "nonaktif") return true;
    if (user.active_tickets === 0) return true;
    toast.error(
      `Aksi Ditolak: User "${user.name}" masih memegang ${user.active_tickets} tiket aktif. Harap ganti penugasan tiket terlebih dahulu.`,
    );
    return false;
  }

  async function handleSave() {
    if (!formName.trim() || !formUsername.trim() || !formWa.trim()) return;
    if (!formRole) return;

    const username = formUsername.trim();
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      toast.error("Username hanya boleh huruf, angka, titik, dan underscore");
      return;
    }
    const { data: dup } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (dup && dup.id !== editingId) {
      toast.error(`Username "${username}" sudah dipakai user lain`);
      return;
    }
    if (!editingId) {
      const pw = formPassword.trim();
      const pwOk =
        pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
      if (!pwOk) {
        toast.error("Password minimal 8 karakter, kombinasi huruf dan angka");
        return;
      }
    }

    if (editingId) {
      const canProceed = await checkActiveTickets(editingId, formStatus);
      if (!canProceed) return;
    }

    setSaving(true);

    const payload = {
      name: formName.trim(),
      full_name: formName.trim(),
      username,
      wa_number: formWa.trim(),
      role: formRole,
      status: formStatus,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      // RLS users hanya mengizinkan self-update last_login; tulis user lain
      // lewat RPC SECURITY DEFINER (validasi caller role=admin).
      const { data: saveResult, error: saveError } = await supabase.rpc("admin_save_user", {
        p_id: editingId,
        p_email: "",
        p_username: username,
        p_name: formName.trim(),
        p_wa_number: formWa.trim(),
        p_role: formRole,
        p_status: formStatus,
      });
      if (saveError || (saveResult as { error?: string } | null)?.error) {
        toast.error(
          "Gagal menyimpan user: " +
            (saveError?.message || (saveResult as { error?: string } | null)?.error),
        );
        setSaving(false);
        return;
      }
      await supabase.from("audit_logs").insert({
        actor_name: "Admin",
        action: "update_user",
        entity_type: "users",
        entity_id: editingId,
        metadata: { changes: payload },
      });
      toast.success("User berhasil diperbarui");
    } else {
      const newPassword = formPassword.trim();
      const email = `${username}@atapcare.local`;
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email,
        password: newPassword,
      });
      if (authError) {
        toast.error("Gagal membuat user: " + authError.message);
        setSaving(false);
        return;
      }
      if (!authUser?.user) {
        setSaving(false);
        return;
      }

      const { data: saveResult, error: saveError } = await supabase.rpc("admin_save_user", {
        p_id: authUser.user.id,
        p_email: email,
        p_username: username,
        p_name: formName.trim(),
        p_wa_number: formWa.trim(),
        p_role: formRole,
        p_status: formStatus,
      });
      if (saveError || (saveResult as { error?: string } | null)?.error) {
        toast.error(
          "Gagal membuat user: " +
            (saveError?.message || (saveResult as { error?: string } | null)?.error),
        );
        setSaving(false);
        return;
      }

      toast.success("User berhasil ditambahkan");
    }

    resetForm();
    setSaving(false);
    setDrawerOpen(false);
    loadUsers();
  }

  async function handleResetPassword(userId: string) {
    const pw = resetPwValue;
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
      toast.error("Password minimal 8 karakter, kombinasi huruf dan angka");
      return;
    }
    setSaving(true);

    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
    const { data: sessionData } = await supabase.auth.getSession();
    const bearer = sessionData.session?.access_token || VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ userId, newPassword: pw }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(
        "Gagal reset password: " +
          (data.error ||
            "Edge Function belum di-deploy (supabase functions deploy admin-reset-password)"),
      );
      setSaving(false);
      return;
    }

    // must_change_password di-set oleh edge function (service client, bypass RLS).

    await supabase.from("audit_logs").insert({
      actor_name: "Admin",
      action: "reset_password",
      entity_type: "users",
      entity_id: userId,
      metadata: { reset_by: "Admin" },
    });

    toast.success("Password direset. User wajib ganti password saat login berikutnya.");
    setResetPwId(null);
    setResetPwValue("");
    setSaving(false);
  }

  function getRoleLabel(role: string): string {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  }

  function handleImportCsv() {
    toast.info("Fitur Import CSV akan segera tersedia");
  }

  function handleExportCsv() {
    const rows = [["Nama", "Username", "Role", "Status", "WA", "Tiket Aktif"]];
    for (const u of filtered) {
      rows.push([
        u.name,
        u.username,
        getRoleLabel(u.role),
        u.status,
        u.wa_number || "",
        String(u.active_tickets),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV berhasil diexport");
  }

  const filtered = users.filter((u) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama atau username…"
            className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:border-ring transition w-64 text-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportCsv}
            className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          <button
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={openAddDrawer}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah User
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data…
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
          <p className="text-xs mt-1">
            {searchQ ? "Coba kata kunci lain" : "Klik 'Tambah User' untuk menambahkan"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Nama
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Username
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Tiket Aktif
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Terakhir Login
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-accent transition"
                  >
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-bold text-muted-foreground">
                          {u.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        {u.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ROLE_BADGE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}
                      >
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          u.status === "aktif"
                            ? "bg-green-100 text-green-700"
                            : u.status === "cuti"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {STATUS_OPTIONS.find((s) => s.value === u.status)?.label || u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-mono font-bold ${
                          u.active_tickets > 0 ? "text-yellow-600" : "text-muted-foreground"
                        }`}
                      >
                        {u.active_tickets}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-muted-foreground">
                        {u.last_login
                          ? new Date(u.last_login).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEditDrawer(u)}
                          className="p-1.5 rounded hover:bg-accent transition text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setResetPwId(u.id);
                            setResetPwName(u.name);
                          }}
                          className="p-1.5 rounded hover:bg-accent transition text-yellow-600 hover:text-yellow-700"
                          title="Reset Password"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <button
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 text-xs rounded ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        {p}
                      </button>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg bg-card">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-foreground">
              {editingId ? "Edit User" : "Tambah User Baru"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nama Lengkap *</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Username *</label>
              <input
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                placeholder="Username login"
                disabled={!!editingId}
              />
            </div>
            {!editingId && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Password Awal * <span className="text-muted-foreground">(min. 8, huruf + angka)</span>
                </label>
                <input
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  type="password"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Min. 8 karakter (huruf + angka)"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">No WhatsApp *</label>
              <input
                value={formWa}
                onChange={(e) => setFormWa(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setFormRole(r.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      formRole === r.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <div className="flex gap-1.5 mt-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setFormStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      formStatus === s.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-border">
            <SheetClose className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
              Batal
            </SheetClose>
            <button
              onClick={handleSave}
              disabled={
                saving ||
                !formName.trim() ||
                !formUsername.trim() ||
                !formWa.trim() ||
                !formRole ||
                (!editingId && !formPassword.trim())
              }
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Simpan" : "Tambah User"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!resetPwId}
        onOpenChange={(open) => {
          if (!open) {
            setResetPwId(null);
            setResetPwValue("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Set password baru untuk <strong>{resetPwName}</strong>. User wajib ganti password
              saat login berikutnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={resetPwValue}
            onChange={(e) => setResetPwValue(e.target.value)}
            type="password"
            placeholder="Min. 8 karakter (huruf + angka)"
            className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border text-muted-foreground">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetPwId) handleResetPassword(resetPwId);
              }}
              className="bg-yellow-500 text-primary-foreground hover:bg-yellow-600"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


