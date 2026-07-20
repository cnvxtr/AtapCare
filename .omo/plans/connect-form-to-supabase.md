# Plan: Connect Complaint Form + Tracking to Supabase

## Goal
Sambungkan form laporan kendala (`/report`) dan tracking (`/track`) ke Supabase.

## Files & Changes

### 1. `src/services/tickets.ts` — tambah createTicket()
```typescript
export async function createTicket(input: {
  customer: string;
  phone: string;
  company: string;
  category: "ASDP VMS" | "INTANK";
  location: string;
  equipment: string;
  description: string;
  serial?: string;
}): Promise<Ticket | null> {
  const num = Math.floor(1000 + Math.random() * 9000);
  const code = `TKT-2026-${num}`;
  const { data, error } = await supabase.from("tickets").insert({
    code, customer: input.customer, phone: input.phone,
    company: input.company, category: input.category,
    location: input.location, equipment: input.equipment,
    description: input.description, serial: input.serial || null,
    priority: "P3", status: "Open", sla_paused: false,
  }).select().single();
  if (error) { console.error(error); return null; }
  return toTicket(data);
}
```
Sisipkan sebelum `getTechnicians()`.

### 2. `src/routes/report.tsx` — form controlled + submit ke Supabase
- Import: `import { createTicket } from "@/services";`
- Tambah controlled states: `name`, `phone`, `serial`, `position`, `company`, `equipment`, `loc`, `category`, `desc`, `submitting`
- Ganti `handleSubmit` jadi async → panggil `createTicket()`
- Setiap input: tambah `value={state}` `onChange={(e)=>setState(e.target.value)}`
- Submit button: disabled saat submitting, text "Mengirim…"

### 3. `src/routes/track.tsx` — cari dari Supabase
- Import: `import { getTicketByCode } from "@/services";`
- Hapus `const DEMO_TICKETS`
- Ganti `doSearch()` jadi async → panggil `getTicketByCode()`
- Map status: "Open"/"In Progress" → "diproses", "Resolved"/"Closed" → "selesai", else → "antrian"

### 4. `src/services/index.ts` — export createTicket
Tambah `createTicket` di baris export Tickets.
