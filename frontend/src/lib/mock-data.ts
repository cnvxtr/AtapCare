export type Priority = "P1" | "P2" | "P3";
export type TicketStatus = "Open" | "In Progress" | "Pending" | "Resolved" | "Closed" | "Rejected";

export interface Ticket {
  id: string;
  code: string;
  customer: string;
  company: string;
  phone: string;
  category: "ASDP VMS" | "INTANK";
  location: string;
  equipment: string;
  serial?: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: string;
  assignee?: string;
  slaDeadline: string;
  slaPaused?: boolean;
}

export const technicians = [
  "Kevin", "Hilman", "Rangga", "Bagas", "Yusuf", "Fajar", "Dimas", "Rio",
];

export const locations = {
  "ASDP VMS": ["Merak", "Bakauheni", "Ketapang", "Gilimanuk", "Ambon", "Bajoe", "Kolaka"],
  "INTANK": ["PAMA Site A", "PAMA Site B", "Kideco", "Adaro", "Berau", "Kaltim Prima"],
};

export const tickets: Ticket[] = [
  {
    id: "1", code: "TKT-2026-0812", customer: "Budi Santoso", company: "ASDP Merak",
    phone: "+62 812 3345 1290", category: "ASDP VMS", location: "Merak",
    equipment: "VMS Display Panel A2", serial: "VMS-A2-0091",
    description: "Panel mati total sejak jam 3 pagi. Kapal antrian tidak bisa dipantau.",
    priority: "P1", status: "In Progress", createdAt: "2026-07-17T03:12:00Z",
    assignee: "Kevin", slaDeadline: "2026-07-20T03:12:00Z",
  },
  {
    id: "2", code: "TKT-2026-0813", customer: "Sri Mulyani", company: "PAMA Site A",
    phone: "+62 821 4455 6677", category: "INTANK", location: "PAMA Site A",
    equipment: "Flow Meter FM-08",
    description: "Reading tidak akurat, selisih 12% dari manual gauging.",
    priority: "P2", status: "Open", createdAt: "2026-07-17T07:45:00Z",
    slaDeadline: "2026-07-18T07:45:00Z",
  },
  {
    id: "3", code: "TKT-2026-0814", customer: "Anwar Fuadi", company: "ASDP Bakauheni",
    phone: "+62 813 9988 7766", category: "ASDP VMS", location: "Bakauheni",
    equipment: "Camera CCTV Dock 3",
    description: "Feed CCTV terputus intermittent, kadang muncul kadang hilang.",
    priority: "P1", status: "Pending", createdAt: "2026-07-16T22:10:00Z",
    assignee: "Hilman", slaDeadline: "2026-07-19T22:10:00Z", slaPaused: true,
  },
  {
    id: "4", code: "TKT-2026-0815", customer: "Dewi Kartika", company: "INTANK Kideco",
    phone: "+62 878 1122 3344", category: "INTANK", location: "Kideco",
    equipment: "Sensor Ultrasonic U-14",
    description: "Butuh troubleshoot pairing sensor ke gateway.",
    priority: "P3", status: "Resolved", createdAt: "2026-07-16T14:00:00Z",
    assignee: "Rangga", slaDeadline: "2026-07-16T18:00:00Z",
  },
  {
    id: "5", code: "TKT-2026-0816", customer: "Rahmat H.", company: "ASDP Ambon",
    phone: "+62 811 2020 3030", category: "ASDP VMS", location: "Ambon",
    equipment: "Server VMS Main",
    description: "Server tidak bisa remote, LED merah menyala.",
    priority: "P1", status: "Open", createdAt: "2026-07-17T09:00:00Z",
    slaDeadline: "2026-07-20T09:00:00Z",
  },
  {
    id: "6", code: "TKT-2026-0811", customer: "Linda P.", company: "ASDP Ketapang",
    phone: "+62 812 5544 1122", category: "ASDP VMS", location: "Ketapang",
    equipment: "Display Panel B1",
    description: "Sudah normal setelah reboot dari sisi klien.",
    priority: "P3", status: "Closed", createdAt: "2026-07-15T10:00:00Z",
    assignee: "Kevin", slaDeadline: "2026-07-15T14:00:00Z",
  },
  {
    id: "7", code: "TKT-2026-0810", customer: "Test Spam", company: "-",
    phone: "-", category: "ASDP VMS", location: "Merak",
    equipment: "-",
    description: "aaaaa test 123",
    priority: "P3", status: "Rejected", createdAt: "2026-07-15T08:00:00Z",
    slaDeadline: "2026-07-15T12:00:00Z",
  },
];

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  quarantine: number;
  unit: string;
}

export const inventory: InventoryItem[] = [
  { id: "1", sku: "CBL-UTP-30", name: "Kabel UTP Cat6 30m", category: "Kabel", stock: 42, minStock: 15, quarantine: 3, unit: "roll" },
  { id: "2", sku: "PSU-12V-5A", name: "Power Supply 12V 5A", category: "Power", stock: 8, minStock: 10, quarantine: 2, unit: "pcs" },
  { id: "3", sku: "CAM-IP-4MP", name: "IP Camera 4MP Dome", category: "Kamera", stock: 12, minStock: 5, quarantine: 1, unit: "pcs" },
  { id: "4", sku: "SNS-ULT-14", name: "Ultrasonic Sensor U-14", category: "Sensor", stock: 3, minStock: 6, quarantine: 4, unit: "pcs" },
  { id: "5", sku: "RTR-4G-LTE", name: "Router 4G LTE Industrial", category: "Network", stock: 15, minStock: 4, quarantine: 0, unit: "pcs" },
  { id: "6", sku: "FLM-FM08", name: "Flow Meter FM-08", category: "Sensor", stock: 5, minStock: 3, quarantine: 2, unit: "pcs" },
  { id: "7", sku: "SCR-SET-01", name: "Toolkit Screwdriver Set", category: "Tool", stock: 20, minStock: 8, quarantine: 0, unit: "set" },
];

export const statusColors: Record<TicketStatus, string> = {
  "Open": "bg-foreground/10 text-foreground border-foreground/20",
  "In Progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "Pending": "bg-warning/15 text-warning border-warning/30",
  "Resolved": "bg-success/15 text-success border-success/30",
  "Closed": "bg-muted text-muted-foreground border-border",
  "Rejected": "bg-destructive/10 text-destructive border-destructive/30",
};

export const priorityColors: Record<Priority, string> = {
  "P1": "bg-destructive text-destructive-foreground",
  "P2": "bg-warning text-black",
  "P3": "bg-muted text-muted-foreground",
};

export const kpiData = [
  { label: "Total Tiket (7 hari)", value: "148", delta: "+12%", trend: "up" },
  { label: "SLA Compliance", value: "94.2%", delta: "+2.1%", trend: "up" },
  { label: "Avg. Resolution", value: "6.4 jam", delta: "-18%", trend: "down" },
  { label: "Tiket Aktif", value: "23", delta: "5 P1", trend: "flat" },
];

export const workloadData = [
  { name: "Kevin", tickets: 8 },
  { name: "Hilman", tickets: 6 },
  { name: "Rangga", tickets: 5 },
  { name: "Bagas", tickets: 4 },
  { name: "Yusuf", tickets: 3 },
  { name: "Fajar", tickets: 3 },
];

export const trendData = [
  { day: "Sen", open: 22, resolved: 18 },
  { day: "Sel", open: 26, resolved: 24 },
  { day: "Rab", open: 19, resolved: 22 },
  { day: "Kam", open: 31, resolved: 27 },
  { day: "Jum", open: 24, resolved: 26 },
  { day: "Sab", open: 14, resolved: 15 },
  { day: "Min", open: 12, resolved: 11 },
];
