import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Plus,
  Pencil,
  Loader2,
  Search,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Check,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AppRole, UserStatus } from "@/lib/types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "pm", label: "Project Manager" },
  { value: "teknisi", label: "Teknisi Lapangan" },
  { value: "customer", label: "Pelanggan" },
  { value: "executive", label: "Executive" },
];

const INTERNAL_ROLE_OPTIONS = ROLE_OPTIONS.filter((r) => r.value !== "customer");

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-black text-white",
  helpdesk: "bg-neutral-800 text-white",
  pm: "bg-neutral-600 text-white",
  teknisi: "bg-neutral-300 text-neutral-900",
  customer: "bg-emerald-100 text-emerald-800",
  executive: "bg-purple-100 text-purple-800",
};

const TRIGGER_CLS =
  "w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring inline-flex items-center justify-between gap-2";

function roleOptionCls(selected: boolean) {
  return `w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[3px] text-xs font-medium transition cursor-pointer ${
    selected ? "bg-accent text-foreground" : "hover:bg-accent/60"
  }`;
}

function RolePrimarySelect({
  options,
  value,
  onChange,
}: {
  options: { value: AppRole; label: string }[];
  value: AppRole | "";
  onChange: (v: AppRole | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const label = options.find((o) => o.value === value)?.label;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={TRIGGER_CLS}>
          {label ? (
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ROLE_BADGE_COLORS[value]}`}>
              {label}
            </span>
          ) : (
            <span className="text-muted-foreground">Pilih role…</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="flex flex-col gap-1 p-1.5 min-w-[var(--radix-dropdown-menu-trigger-width)] bg-card border-border"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onChange(o.value === value ? "" : o.value);
              setOpen(false);
            }}
            className={roleOptionCls(o.value === value)}
          >
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ROLE_BADGE_COLORS[o.value]}`}>{o.label}</span>
            {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RoleExtraSelect({
  options,
  primary,
  selected,
  onToggle,
}: {
  options: { value: AppRole; label: string }[];
  primary: AppRole | "";
  selected: AppRole[];
  onToggle: (v: AppRole) => void;
}) {
  const chosen = options.filter((o) => selected.includes(o.value));
  if (!primary) {
    return (
      <button type="button" disabled className={`${TRIGGER_CLS} opacity-50 cursor-not-allowed`}>
        <span className="text-muted-foreground">Pilih Role Utama dulu</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={TRIGGER_CLS}>
          <span className="truncate text-muted-foreground">
            {chosen.length ? chosen.map((o) => o.label).join(", ") : "Pilih role tambahan…"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="flex flex-col gap-1 p-1.5 min-w-[var(--radix-dropdown-menu-trigger-width)] bg-card border-border"
      >
        {options
          .filter((o) => o.value !== primary)
          .map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={roleOptionCls(selected.includes(o.value))}
            >
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ROLE_BADGE_COLORS[o.value]}`}>{o.label}</span>
              {selected.includes(o.value) && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface UserRow {
  id: string;
  email: string | null;
  username: string;
  name: string;
  wa_number: string | null;
  role: AppRole;
  roles: string;
  status: UserStatus;
  must_change_password: boolean;
  last_login: string | null;
  active_tickets: number;
  customer_id: string | null;
  site_id: string | null;
  unit_id: string | null;
}

const ITEMS_PER_PAGE = 10;

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { VITE_SUPABASE_ANON_KEY } = import.meta.env;
  let { data: sessionData } = await supabase.auth.getSession();
  const expAt = sessionData.session?.expires_at;
  if (sessionData.session && expAt && Date.now() >= (expAt - 60) * 1000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) sessionData = refreshed;
  }
  const token = sessionData.session?.access_token;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: VITE_SUPABASE_ANON_KEY,
  };
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [userTab, setUserTab] = useState<"internal" | "customer">("internal");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [formWa, setFormWa] = useState("");
  const [formRoles, setFormRoles] = useState<AppRole[]>([]);
  const [formPrimaryRole, setFormPrimaryRole] = useState<AppRole | "">("");
  const [formStatus, setFormStatus] = useState<UserStatus>("aktif");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCompanyCode, setFormCompanyCode] = useState("");
  const [formSiteId, setFormSiteId] = useState("");
  const [formUnitId, setFormUnitId] = useState("");

  type MdRow = { id: string; name: string; code?: string | null };
  const [mdCustomers, setMdCustomers] = useState<MdRow[]>([]);

  useEffect(() => {
    loadUsers();
    supabase
      .from("customers")
      .select("id, name, code")
      .eq("is_deleted", false)
      .order("name")
      .then(({ data }) => setMdCustomers((data as MdRow[]) || []));
  }, []);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") loadUsers();
    };
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select(
        "id, email, username, name, wa_number, role, roles, status, must_change_password, last_login, customer_id, site_id, unit_id",
      )
      .eq("is_deleted", false)
      .order("name");

    if (userErr) {
      toast.error("Gagal memuat pengguna: " + userErr.message);
      setLoading(false);
      return;
    }
    if (!userData) {
      setLoading(false);
      return;
    }

    const { data: activeRows } = await supabase
      .from("tickets")
      .select("assigned_to, created_by_user_id")
      .in("status", ["NEW", "OPEN", "UNASSIGNED", "SCHEDULED", "EN_ROUTE", "WORKING", "PENDING"]);
    const countByUser: Record<string, number> = {};
    const countByReporter: Record<string, number> = {};
    for (const t of activeRows || []) {
      if (t.assigned_to) countByUser[t.assigned_to] = (countByUser[t.assigned_to] || 0) + 1;
      if (t.created_by_user_id) countByReporter[t.created_by_user_id] = (countByReporter[t.created_by_user_id] || 0) + 1;
    }

    const rows: UserRow[] = [];
    for (const u of userData) {
      rows.push({
        id: u.id,
        email: u.email,
        username: u.username,
        name: u.name,
        wa_number: u.wa_number,
        role: (u.role || "teknisi") as AppRole,
        roles: u.roles || u.role || "teknisi",
        status: (u.status || "aktif") as UserStatus,
        must_change_password: u.must_change_password,
        last_login: u.last_login,
        active_tickets: u.role === "customer" ? countByReporter[u.id] || 0 : countByUser[u.id] || 0,
        customer_id: u.customer_id,
        site_id: u.site_id,
        unit_id: u.unit_id,
      });
    }
    setUsers(rows);
    setLoading(false);
  }

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormUsername("");
    setFormPassword("");
    setShowPw(false);
    setFormWa("");
    setFormRoles([]);
    setFormPrimaryRole("");
    setFormStatus("aktif");
    setFormCustomerId("");
    setFormCompanyCode("");
    setFormSiteId("");
    setFormUnitId("");
    setEditingId(null);
  }

  function pickPrimaryRole(r: AppRole | "") {
    setFormPrimaryRole(r);
    setFormRoles((prev) => (r ? prev.filter((v) => v !== r) : prev));
  }

  function toggleRole(r: AppRole) {
    const next = formRoles.includes(r) ? formRoles.filter((v) => v !== r) : [...formRoles, r];
    setFormRoles(next);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(u: UserRow) {
    const roles = ((u.roles || "").split(",").filter(Boolean) as AppRole[]);
    setFormName(u.name || "");
    setFormEmail(u.email || "");
    setFormUsername(u.username);
    setFormPassword("");
    setShowPw(false);
    setFormWa(u.wa_number || "");
    setFormRoles(roles.filter((r) => r !== (u.role as AppRole)));
    setFormPrimaryRole((u.role as AppRole) || "");
    setFormStatus(u.status);
    setFormCustomerId(u.customer_id || "");
    setFormCompanyCode(mdCustomers.find((c) => c.id === u.customer_id)?.code || "");
    setFormSiteId(u.site_id || "");
    setFormUnitId(u.unit_id || "");
    setEditingId(u.id);
    setDialogOpen(true);
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
    if (!formName.trim() || !formUsername.trim()) return;
    const isCustomer = userTab === "customer";
    if (isCustomer) {
      if (!formCustomerId) {
        toast.error("Kode perusahaan tidak ditemukan");
        return;
      }
    } else if (!formPrimaryRole) {
      toast.error("Pilih Role Utama");
      return;
    }

    const username = formUsername.trim();
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      toast.error("Username hanya boleh huruf, angka, titik, dan underscore");
      return;
    }
    const { data: dupRows } = await supabase.from("users").select("id, username");
    const dup = (dupRows || []).find(
      (u) => u.id !== editingId && (u.username || "").toLowerCase() === username.toLowerCase(),
    );
    if (dup) {
      toast.error(`Username "${username}" sudah dipakai user lain`);
      return;
    }
    const newPw = formPassword.trim();
    const email = formEmail.trim();
    if (!email) {
      toast.error("Email wajib diisi");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Format email tidak valid");
      return;
    }
    if (editingId) {
      if (newPw && newPw.length < 6) {
        toast.error("Password minimal 6 karakter");
        return;
      }
    } else {
      const pwOk = newPw.length >= 6;
      if (!pwOk) {
        toast.error("Password minimal 6 karakter");
        return;
      }
    }

    if (editingId) {
      const canProceed = await checkActiveTickets(editingId, formStatus);
      if (!canProceed) return;
    }

    setSaving(true);

    const primaryRole: AppRole = isCustomer ? "customer" : (formPrimaryRole as AppRole);
    const allRoles: AppRole[] = isCustomer ? ["customer"] : [formPrimaryRole as AppRole, ...formRoles];
    const payload = {
      name: formName.trim(),
      full_name: formName.trim(),
      username,
      wa_number: formWa.trim(),
      role: primaryRole,
      roles: allRoles.join(","),
      status: formStatus,
      customer_id: formCustomerId || null,
      site_id: formSiteId || null,
      unit_id: formUnitId || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const existing = users.find((u) => u.id === editingId);
      if (existing && existing.email !== email) {
        const { VITE_SUPABASE_URL } = import.meta.env;
        const headers = await getAuthHeaders();
        if (!headers) {
          toast.error("Sesi berakhir, silakan login ulang");
          setSaving(false);
          return;
        }
        const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-update-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: editingId, email }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok || data.error) {
          toast.error("Gagal mengubah email: " + (data.error || "Edge Function belum di-deploy"));
          setSaving(false);
          return;
        }
      }
      const { data: saveResult, error: saveError } = await supabase.rpc("admin_save_user", {
        p_id: editingId,
        p_email: "",
        p_username: username,
        p_name: formName.trim(),
        p_wa_number: formWa.trim(),
        p_role: primaryRole,
        p_status: formStatus,
        p_roles: allRoles.join(","),
        p_customer_id: formCustomerId || null,
        p_site_id: formSiteId || null,
        p_unit_id: formUnitId || null,
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
      if (newPw) {
        const resetOk = await resetPassword(editingId, newPw);
        if (!resetOk) {
          setSaving(false);
          return;
        }
        toast.success("User berhasil diperbarui. Password direset.");
      } else {
        toast.success("User berhasil diperbarui");
      }
    } else {
      const newPassword = formPassword.trim();
      const { VITE_SUPABASE_URL } = import.meta.env;
      const headers = await getAuthHeaders();
      if (!headers) {
        toast.error("Sesi berakhir, silakan login ulang");
        setSaving(false);
        return;
      }
      try {
        const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            username,
            email,
            password: newPassword,
            name: formName.trim(),
            wa_number: formWa.trim(),
            role: primaryRole,
            roles: allRoles.join(","),
            status: formStatus,
            customer_id: formCustomerId || null,
            site_id: formSiteId || null,
            unit_id: formUnitId || null,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error("Gagal membuat user: " + (data.error || "Edge Function belum di-deploy"));
          setSaving(false);
          return;
        }
        const result = (await res.json().catch(() => ({}))) as { userId?: string; error?: string };
        if (result.error) {
          toast.error("Gagal membuat user: " + result.error);
          setSaving(false);
          return;
        }
        if (!result.userId) {
          toast.error("Gagal membuat user: respon server tidak valid");
          setSaving(false);
          return;
        }
      } catch (err) {
        console.error("[admin-create-user] fetch ditolak:", err);
        toast.error("Gagal membuat user: permintaan ditolak browser (CORS/jaringan)");
        setSaving(false);
        return;
      }

      toast.success("User berhasil ditambahkan");
    }

    resetForm();
    setSaving(false);
    setDialogOpen(false);
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { VITE_SUPABASE_URL } = import.meta.env;
    const headers = await getAuthHeaders();
    if (!headers) {
      toast.error("Sesi berakhir, silakan login ulang");
      setDeleting(false);
      return;
    }
    try {
      const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Gagal menghapus user: " +
          (data.error ||
            "Edge Function belum di-deploy (supabase functions deploy admin-delete-user)"),
        );
        setDeleting(false);
        return;
      }
    } catch (err) {
      console.error("[admin-delete-user] fetch ditolak:", err);
      toast.error("Gagal menghapus user: permintaan ditolak browser (CORS/jaringan)");
      setDeleting(false);
      return;
    }

    toast.success(`User "${deleteTarget.name}" dihapus`);
    setDeleteTarget(null);
    setDeleting(false);
    loadUsers();
  }

  async function resetPassword(userId: string, newPassword: string): Promise<boolean> {
    const { VITE_SUPABASE_URL } = import.meta.env;
    const headers = await getAuthHeaders();
    if (!headers) {
      toast.error("Sesi berakhir, silakan login ulang");
      return false;
    }
    try {
      const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, newPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          "Gagal reset password: " +
          (data.error ||
            "Edge Function belum di-deploy (supabase functions deploy admin-reset-password)"),
        );
        return false;
      }
    } catch (err) {
      console.error("[admin-reset-password] fetch ditolak:", err);
      toast.error("Gagal reset password: permintaan ditolak browser (CORS/jaringan)");
      return false;
    }


    await supabase.from("audit_logs").insert({
      actor_name: "Admin",
      action: "reset_password",
      entity_type: "users",
      entity_id: userId,
      metadata: { reset_by: "Admin" },
    });

    return true;
  }

  function getRoleLabel(role: string): string {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  }

  const searchFiltered = users.filter((u) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
  });

  const filtered =
    userTab === "internal"
      ? searchFiltered.filter((u) => u.role !== "customer")
      : searchFiltered.filter((u) => u.role === "customer");

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="bg-card p-1 rounded-xl border border-border grid grid-cols-2 gap-1">
        {(["internal", "customer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setUserTab(t);
              setPage(1);
            }}
            className={`px-3.5 h-8 rounded-[3px] text-xs font-medium transition inline-flex items-center justify-center gap-1.5 ${userTab === t
              ? "bg-foreground text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
              }`}
          >
            {t === "internal" ? "Karyawan Internal" : "Pelanggan"}
          </button>
        ))}
      </div>

      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama atau username…"
              className="pl-9 pr-4 h-9 rounded-lg border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-foreground/20 transition w-full text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openAddDialog}
              className="h-9 px-4 rounded-[3px] bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />{" "}
              {userTab === "internal" ? "Tambah Karyawan" : "Tambah Pelanggan"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center bg-foreground text-primary-foreground rounded px-3 py-1.5 text-xs font-semibold">
          {filtered.length} {userTab === "internal" ? "Karyawan" : "Pelanggan"}
        </span>
      </div>

      {loading ? null : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
          <p className="text-xs mt-1">
            {searchQ ? "Coba kata kunci lain" : `Klik '${userTab === "internal" ? "Tambah Karyawan" : "Tambah Pelanggan"}' untuk menambahkan`}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
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
                    {userTab === "customer" && (
                      <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Perusahaan
                      </th>
                    )}
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
                              ? u.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()
                              : "?"}
                          </span>
                          {u.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{u.username}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.split(",").filter(Boolean).map((r) => (
                            <span
                              key={r}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ROLE_BADGE_COLORS[r] || "bg-muted text-muted-foreground"}`}
                            >
                              {getRoleLabel(r)}
                            </span>
                          ))}
                        </div>
                      </td>
                      {userTab === "customer" && (
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {mdCustomers.find((c) => c.id === u.customer_id)?.name || "—"}
                          </div>
                          <div className="text-[11px] font-mono">
                            {mdCustomers.find((c) => c.id === u.customer_id)?.code || "—"}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${u.status === "aktif"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                            }`}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === u.status)?.label || u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-mono font-bold ${u.active_tickets > 0 ? "text-yellow-600" : "text-muted-foreground"
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
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label="Aksi"
                                className="h-8 w-8 grid place-items-center rounded-[3px] bg-black text-white hover:bg-neutral-800 transition"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[140px] bg-card border-border text-card-foreground"
                            >
                              <DropdownMenuItem
                                onClick={() => openEditDialog(u)}
                                className="cursor-pointer focus:bg-black focus:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(u)}
                                className="cursor-pointer text-red-500 focus:bg-red-100 focus:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4 pr-8">
            <DialogTitle className="text-foreground">
              {editingId
                ? userTab === "customer" ? "Edit Pelanggan" : "Edit Karyawan"
                : userTab === "customer" ? "Tambah Pelanggan Baru" : "Tambah Karyawan Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nama Lengkap</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Nama lengkap"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
                <input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Username login"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={editingId ? "sm:col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                  placeholder="email@contoh.com"
                />
              </div>
              {!editingId && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Password <span className="text-muted-foreground">(min. 6 karakter)</span>
                  </label>
                  <div className="relative">
                    <input
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      type={showPw ? "text" : "password"}
                      className="w-full h-9 px-3 pr-10 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                      placeholder="Min. 6 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {userTab === "internal" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Role Utama
                  </label>
                  <div className="mt-1">
                    <RolePrimarySelect
                      options={INTERNAL_ROLE_OPTIONS}
                      value={formPrimaryRole}
                      onChange={pickPrimaryRole}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Role Tambahan <span className="text-muted-foreground">(opsional)</span>
                  </label>
                  <div className="mt-1">
                    <RoleExtraSelect
                      options={INTERNAL_ROLE_OPTIONS}
                      primary={formPrimaryRole}
                      selected={formRoles}
                      onToggle={toggleRole}
                    />
                  </div>
                </div>
              </div>
            )}
            {userTab === "customer" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Kode Perusahaan
                </label>
                <input
                  value={formCompanyCode}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormCompanyCode(v);
                    setFormCustomerId(
                      mdCustomers.find(
                        (c) => (c.code || "").toLowerCase() === v.trim().toLowerCase(),
                      )?.id || "",
                    );
                  }}
                  placeholder="mis. 33333"
                  className="mt-1 w-full h-9 px-3 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                />
                <p className={`text-[11px] mt-1 ${formCustomerId ? "text-green-600" : "text-muted-foreground"}`}>
                  {formCustomerId
                    ? mdCustomers.find((c) => c.id === formCustomerId)?.name
                    : "Kode unik perusahaan (lihat Master Data). Site & Unit dipilih pelanggan saat lapor."}
                </p>
              </div>
            )}
            {editingId && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <div className="flex gap-1.5 mt-1">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setFormStatus(s.value)}
                      className={`px-3 py-1.5 rounded-[3px] text-xs font-medium transition border ${formStatus === s.value
                        ? s.value === "aktif"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-red-600 text-white border-red-600"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                        }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {editingId && (
              <div className="border-t border-border pt-4">
                <label className="text-xs font-bold text-muted-foreground mb-1 block">
                  Reset Password
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Kosongkan jika tidak ingin mengubah password. Jika diisi, user wajib ganti
                  password saat login berikutnya.
                </p>
                <div className="relative">
                  <input
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    type={showPw ? "text" : "password"}
                    className="w-full h-9 px-3 pr-10 rounded-[3px] border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
                    placeholder="Min. 6 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
            <DialogClose className="px-4 py-2 rounded-[3px] border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
              Batal
            </DialogClose>
            <button
              onClick={handleSave}
              disabled={
                saving ||
                !formName.trim() ||
                !formEmail.trim() ||
                !formUsername.trim() ||
                (userTab === "customer" ? !formCustomerId : !formPrimaryRole) ||
                (!editingId && !formPassword.trim())
              }
              className="px-5 py-2 rounded-[3px] bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId
                ? "Simpan"
                : userTab === "customer" ? "Tambah Pelanggan" : "Tambah Karyawan"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 fade-in">
            <div className="bg-card border border-border w-full max-w-sm rounded-lg shadow-2xl p-6 text-center">
              <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">
                Apakah Anda yakin ingin menghapus user {deleteTarget.name}?
              </h3>
              {deleteTarget.active_tickets > 0 ? (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium mb-6">
                  ⚠️ User sedang memiliki {deleteTarget.active_tickets} tiket aktif.
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-6">
                  User akan dihapus permanen dari sistem (profil + akun login).
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting || deleteTarget.active_tickets > 0}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}


