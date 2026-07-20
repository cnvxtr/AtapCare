---
slug: connect-supabase-database
status: approved
intent: clear
pending-action: write .omo/plans/connect-supabase-database.md
approach: Update auth, tickets, dan inventory services dari mock data ke Supabase queries langsung.
---

# Draft: connect-supabase-database

## Components (topology ledger)
| id | outcome | status | evidence |
|---|---|---|---|
| auth-service | `auth.ts` menggunakan `supabase.auth.signInWithPassword()` & `supabase.auth.getSession()` | active | src/services/auth.ts |
| tickets-service | `tickets.ts` menggunakan `supabase.from('tickets').select(...)` | active | src/services/tickets.ts |
| inventory-service | `inventory.ts` menggunakan `supabase.from('inventory').select(...)` | active | src/services/inventory.ts |
| login-page | `login.tsx` panggil auth service yang baru (async) | active | src/routes/login.tsx |
| dashboard-pages | `app.*.tsx` panggil getTickets/getInventory yang async | active | src/routes/app.*.tsx |

## Findings (cited - path:lines)
- `.env` — sudah ada SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, VITE variants
- `src/integrations/supabase/client.ts` — `supabase` client ready (lazy singleton)
- `src/services/auth.ts:27-33` — `login()` pakai `findDemoAccount()` sync
- `src/services/auth.ts:48-57` — `getSession()` baca localStorage manual
- `src/services/tickets.ts:29-31` — `getTickets()` return `_mockTickets` array
- `src/services/tickets.ts:34-36` — `getTicketByCode()` find di array
- `src/services/inventory.ts:18-20` — `getInventory()` return `_mockInventory` array
- Migration sudah jalan: tabel `profiles`, `user_roles`, `tickets`, `inventory` + seed data + RLS

## Decisions (with rationale)
- **Auth pake Supabase Auth, bukan custom** — `supabase.auth.signInWithPassword()` handle JWT, session, refresh token otomatis. Tidak perlu manage localStorage manual.
- **Services jadi async** — semua Supabase query return Promise. Caller (routes) perlu pakai `useQuery` atau `useEffect`.
- **UI helpers tetap static** — `statusColors`, `priorityColors`, `kpiData`, `workloadData`, `trendData` tetap di services, tidak perlu query database.
- **Demo accounts tetap di lib/** — bisa dipakai untuk development/testing, tapi auth service tidak lagi depend ke demo-accounts.

## Scope IN
- `src/services/auth.ts` — rewrite pake Supabase Auth
- `src/services/tickets.ts` — rewrite pake Supabase queries
- `src/services/inventory.ts` — rewrite pake Supabase queries
- `src/routes/login.tsx` — update panggilan auth (jika perlu)
- `src/routes/app.*.tsx` — update untuk handle async data

## Scope OUT (Must NOT have)
- ❌ Tidak mengubah UI/components/shared code (kecuali route pages yang panggil service)
- ❌ Tidak mengubah database schema (hanya consume existing tables)
- ❌ Tidak perlu tambah package baru (supabase-js sudah ada)

## Open questions
Tidak ada — semua sudah jelas.

## Approval gate
status: awaiting-approval
