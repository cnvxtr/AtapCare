export type DemoRole =
  | "is_sys_admin"
  | "is_helpdesk"
  | "is_supervisor"
  | "is_field_tech"
  | "is_warehouse";

export interface DemoAccount {
  username: string;
  password: string;
  role: DemoRole;
  roleLabel: string;
  scope: string;
}

export const demoAccounts: DemoAccount[] = [
  { username: "Rahma", password: "admin123", role: "is_sys_admin", roleLabel: "System Admin", scope: "Master Data & Analytics" },
  { username: "Kustiara", password: "helpdesk123", role: "is_helpdesk", roleLabel: "Helpdesk", scope: "Triage & WA Confirmation" },
  { username: "Aditya", password: "supervisor123", role: "is_supervisor", roleLabel: "Supervisor", scope: "Assign P1 & Force Re-assign" },
  { username: "Pak Dedy", password: "pm123", role: "is_supervisor", roleLabel: "Project Manager", scope: "Approval Restock Gudang" },
  { username: "Kevin", password: "tech123", role: "is_field_tech", roleLabel: "Field Technician", scope: "Mobile Teknisi & Barang Terpakai" },
  { username: "Endang Suryadi", password: "warehouse123", role: "is_warehouse", roleLabel: "Warehouse", scope: "Log Mutasi & Karantina/RMA" },
];

export function findDemoAccount(username: string, password: string) {
  return demoAccounts.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.password === password,
  );
}

export function loginAs(account: DemoAccount) {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      "atap-care:session",
      JSON.stringify({ username: account.username, role: account.role, roleLabel: account.roleLabel, at: Date.now() }),
    );
  }
}
