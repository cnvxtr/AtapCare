# connect-supabase-database - Work Plan

## TL;DR (For humans)

**What you'll get:** Semua data di dashboard akan langsung dari database Supabase — tiket, inventaris, dan login pakai akun real, bukan data palsu (mock).

**Why this approach:** Service layer (`src/services/`) sudah dirancang sebagai "jembatan" yang bisa ditukar dari mock ke database tanpa mengubah UI. Sekarang tinggal ganti isi service-nya — UI tetap sama.

**What it will NOT do:** Tidak mengubah schema database, tidak menambah tabel baru, tidak mengubah tampilan UI.

**Effort:** Medium (3 service files + 5 dashboard pages + 1 login page)
**Risk:** Medium — data jadi async (butuh loading/error state), login flow berubah total ke Supabase Auth

**Decisions to sanity-check:** Semua service jadi `async` — dashboard pages perlu `useEffect`/`useState` untuk loading. Login page tidak lagi pakai demo accounts untuk produksi.

Your next move: approve plan, atau jalankan `/start-work`.

---

> TL;DR (machine): Medium effort, Medium risk — rewrite 3 service files from sync mock data to async Supabase queries; update login page to use Supabase Auth; update dashboard pages with loading states.

## Scope
### Must have
- `src/services/auth.ts` — rewrite pake `supabase.auth.signInWithPassword()` + `supabase.auth.getSession()`
- `src/services/tickets.ts` — rewrite pake `supabase.from('tickets').select(...)` queries
- `src/services/inventory.ts` — rewrite pake `supabase.from('inventory').select(...)` queries
- `src/routes/login.tsx` — panggil auth service baru (async), hapus direct import demo-accounts untuk form login
- `src/routes/app.index.tsx` — handle async `getTickets()`
- `src/routes/app.tickets.tsx` — handle async `getTickets()`
- `src/routes/app.inventory.tsx` — handle async `getInventory()`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ Tidak mengubah schema database atau migration
- ❌ Tidak menambah package dependencies baru
- ❌ Tidak mengubah UI rendering logic — hanya data fetching
- ❌ Tidak menghapus `src/lib/demo-accounts.ts` atau `src/lib/mock-data.ts` (masih bisa dipakai fallback/testing)

## Verification strategy
> Zero human intervention — all verification is agent-executed.
- Test decision: tests-after + manual QA
- Evidence: `.omo/evidence/connect-supabase-database/`

## Execution strategy
### Parallel execution waves
Wave 1: Auth service + Login page (harus selesai dulu biar bisa login ke dashboard)
Wave 2: Tickets + Inventory services + Dashboard pages (bisa parallel)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. auth.ts | none | 2 | none |
| 2. login.tsx | 1 | none | 3, 4, 5, 6, 7 |
| 3. tickets.ts | none | 5, 6 | 4 |
| 4. inventory.ts | none | 7 | 3 |
| 5. app.index.tsx | 3 | none | 6, 7 |
| 6. app.tickets.tsx | 3 | none | 5, 7 |
| 7. app.inventory.tsx | 4 | none | 5, 6 |
| 8. verify | 1-7 | none | none |

## Todos
- [ ] 1. `src/services/auth.ts` — Rewrite auth pake Supabase Auth
  What to do / Must NOT do: Ganti implementasi `login()` dari `findDemoAccount()` ke `supabase.auth.signInWithPassword({ email, password })`. Ganti `getSession()` dari baca localStorage ke `supabase.auth.getSession()`. Tambah `getCurrentUser()` return user + role dari `user_roles` table. Hapus import `demo-accounts`. **Jangan** ubah exported function signatures (login, logout, getSession, hasRole tetap ada) tapi semua jadi `async`.
  
  Detail implementasi:
  - `login(email, password)` → `await supabase.auth.signInWithPassword({ email, password })` → jika berhasil, ambil role dari `supabase.from('user_roles').select('role').eq('user_id', userId).single()` → simpan session + role di context Supabase
  - `logout()` → `await supabase.auth.signOut()`
  - `getSession()` → `const { data } = await supabase.auth.getSession()` → return `data.session`
  - `hasRole(role)` → cek dari user_roles table atau dari session claims
  - Ekspor `supabase` client dari sini juga biar services lain bisa pake
  
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2
  References:
    - `src/services/auth.ts:1-68` — current auth service
    - `src/integrations/supabase/client.ts` — `supabase` client ready
    - `supabase/migrations/20260720041253_e4f5d51f-bda2-4c0f-ac40-a12e3774f2df.sql:16-36` — user_roles table & has_role function
    - Supabase Auth docs: `signInWithPassword`, `getSession`, `signOut`
  Acceptance criteria: `login('test@example.com', 'password')` returns Promise with user data. `getSession()` returns current session. All functions are async.
  QA scenarios: Happy — login with valid credentials. Failure — login with wrong password returns error. Evidence: task-1-auth-service.txt
  Commit: Y | feat(auth): connect to Supabase Auth

- [ ] 2. `src/routes/login.tsx` — Update form login pake Supabase Auth
  What to do / Must NOT do: Ganti `submit()` function dari `findDemoAccount()` ke panggil `login()` dari `@/services` (yang sudah async). Ganti `quickLogin()` untuk demo accounts — demo accounts tetap tampil sebagai badge tapi panggil `login()` juga. **Jangan** ubah UI layout, hanya logic login-nya.
  
  Detail:
  - `submit()` jadi async: `const result = await login(username, password)` → jika gagal tampilkan error → jika sukses `navigate({ to: '/app' })`
  - Import dari `@/services` bukan langsung dari `@/lib/demo-accounts`
  - Import `demoAccounts` tetap tapi via `@/services` untuk badge quick-login
  
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: none
  References:
    - `src/routes/login.tsx:26-36` — current submit function
    - `src/routes/login.tsx:38-41` — current quickLogin function
    - `src/services/index.ts` — barrel export includes `login`, `getDemoAccounts`
  Acceptance criteria: Login form submit calls async auth service. Error handling works. Navigate to /app on success.
  QA scenarios: Happy — login with valid Supabase Auth credentials. Failure — wrong credentials show error message. Evidence: task-2-login-page.txt
  Commit: Y | feat(login): connect login form to Supabase Auth

- [ ] 3. `src/services/tickets.ts` — Rewrite tickets pake Supabase queries
  What to do / Must NOT do: Ganti semua function dari sync mock data ke async Supabase queries.
  
  Detail:
  ```ts
  import { supabase } from "@/integrations/supabase/client";
  import type { Database } from "@/integrations/supabase/types";
  
  // Re-export display helpers (masih static) — statusColors, priorityColors, kpiData, workloadData, trendData
  
  export async function getTickets(): Promise<Ticket[]> {
    const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
    return data || [];
  }
  
  export async function getTicketByCode(code: string): Promise<Ticket | null> {
    const { data } = await supabase.from('tickets').select('*').eq('code', code).single();
    return data;
  }
  
  export async function filterTickets(opts: { ... }): Promise<Ticket[]> {
    let query = supabase.from('tickets').select('*');
    if (opts.status) query = query.eq('status', opts.status);
    if (opts.priority) query = query.eq('priority', opts.priority);
    if (opts.category) query = query.eq('category', opts.category);
    if (opts.search) query = query.or(`code.ilike.%${opts.search}%,customer.ilike.%${opts.search}%`);
    const { data } = await query;
    return data || [];
  }
  ```
  **Jangan** ubah UI helpers (statusColors, priorityColors). **Jangan** ubah `getTechnicians()` dan `getLocations()` — bisa tetap static atau query dari database nanti.
  
  Parallelization: Wave 2 | Blocked by: none | Blocks: 5, 6
  References:
    - `src/services/tickets.ts:1-89` — current tickets service
    - `src/integrations/supabase/types.ts:77-135` — Database tickets type
    - `supabase/migrations/20260720041253_e4f5d51f-bda2-4c0f-ac40-a12e3774f2df.sql:38-71` — tickets table + RLS
  Acceptance criteria: `await getTickets()` returns array of tickets from database. `await getTicketByCode('TKT-2026-0812')` returns matching ticket.
  QA scenarios: Happy — returns seed data from Supabase. Failure — empty result returns empty array. Evidence: task-3-tickets-service.txt
  Commit: Y | feat(tickets): connect to Supabase database

- [ ] 4. `src/services/inventory.ts` — Rewrite inventory pake Supabase queries
  What to do / Must NOT do: Ganti implementasi dari mock data ke `supabase.from('inventory').select(...)`. Sama seperti tickets — semua function jadi async.
  
  Detail:
  ```ts
  export async function getInventory(): Promise<InventoryItem[]> {
    const { data } = await supabase.from('inventory').select('*').order('name');
    return data || [];
  }
  
  export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
    const { data } = await supabase.from('inventory').select('*').eq('id', id).single();
    return data;
  }
  
  export async function filterInventory(opts: { ... }): Promise<InventoryItem[]> {
    let query = supabase.from('inventory').select('*');
    if (opts.category) query = query.eq('category', opts.category);
    if (opts.lowStock) query = query.lte('stock', supabase.rpc('col', { col: 'min_stock' }));
    if (opts.search) query = query.or(`name.ilike.%${opts.search}%,sku.ilike.%${opts.search}%`);
    const { data } = await query;
    return data || [];
  }
  ```
  
  Parallelization: Wave 2 | Blocked by: none | Blocks: 7
  References:
    - `src/services/inventory.ts:1-69` — current inventory service
    - `src/integrations/supabase/types.ts:17-55` — Database inventory type
    - `supabase/migrations/20260720041253_e4f5d51f-bda2-4c0f-ac40-a12e3774f2df.sql:73-92` — inventory table + RLS
  Acceptance criteria: `await getInventory()` returns array from Supabase database.
  QA scenarios: Happy — returns seed data. Failure — returns empty array. Evidence: task-4-inventory-service.txt
  Commit: Y | feat(inventory): connect to Supabase database

- [ ] 5. `src/routes/app.index.tsx` — Handle async getTickets/getInventory
  What to do / Must NOT do: Karena `getTickets()` dan `getInventory()` sekarang async, komponen perlu loading state. Tambah `useState` + `useEffect` untuk fetch data. Tampilkan loading skeleton/indicator saat data belum siap.
  
  Detail:
  - Tambah `const [tickets, setTickets] = useState<Ticket[]>([]); const [loading, setLoading] = useState(true);`
  - `useEffect(() => { getTickets().then(setTickets).finally(() => setLoading(false)); }, [])`
  - `if (loading) return <LoadingSkeleton />`
  - Ganti `tickets.filter(...)` jadi `tickets.filter(...)` (variable name sama)
  
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: none
  References:
    - `src/routes/app.index.tsx:4` — imports from mock-data (akan diubah di plan sebelumnya)
    Note: Plan `migrate-dashboard-to-services` harus dijalankan dulu atau digabung dengan perubahan ini.
  Acceptance criteria: Dashboard renders data from Supabase (not mock). Shows loading state while fetching.
  QA scenarios: Happy — dashboard shows real ticket counts. Evidence: task-5-dashboard-async.txt
  Commit: Y | feat(dashboard): handle async data from Supabase

- [ ] 6. `src/routes/app.tickets.tsx` — Handle async getTickets
  What to do / Must NOT do: Sama seperti app.index.tsx — tambah loading state untuk data async. Tampilkan loading skeleton saat data belum siap.
  
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: none
  References: `src/routes/app.tickets.tsx:14-19`
  Acceptance criteria: Tickets page renders from Supabase data. Loading state visible while fetching.
  Commit: Y | feat(tickets-page): handle async data from Supabase

- [ ] 7. `src/routes/app.inventory.tsx` — Handle async getInventory
  What to do / Must NOT do: Sama seperti di atas — tambah loading state. `getInventory()` sekarang async.
  
  Parallelization: Wave 2 | Blocked by: 4 | Blocks: none
  References: `src/routes/app.inventory.tsx:11-14`
  Acceptance criteria: Inventory page renders from Supabase data.
  Commit: Y | feat(inventory-page): handle async data from Supabase

- [ ] 8. Verifikasi akhir — semua service connected ke Supabase
  What to do: Login dengan akun real Supabase Auth. Cek dashboard tampilkan data dari database (bukan mock). Cek tickets dan inventory bisa difilter. Pastikan tidak ada error runtime.
  Parallelization: Final | Blocked by: 1-7
  Commitment: Pastikan semua page terload dengan benar tanpa error. `console.error` clean.
  Commit: N (verification only)

## Final verification wave
- [ ] F1. Plan compliance audit — semua service file diubah, login page diubah, dashboard pages handle async
- [ ] F2. Code quality review — tidak ada mock data yang bocor ke production; semua async functions handle error
- [ ] F3. Real manual QA — login → dashboard → tickets → inventory — semua data real dari Supabase
- [ ] F4. Scope fidelity — tidak ada perubahan di luar scope

## Commit strategy
Multiple commits (satu per service + satu per page):
1. `feat(auth): connect to Supabase Auth`
2. `feat(login): connect login form to Supabase Auth`
3. `feat(tickets): connect to Supabase database`
4. `feat(inventory): connect to Supabase database`
5-7. Dashboard page updates

## Success criteria
1. Login dengan kredensial Supabase Auth berhasil → redirect ke /app
2. Dashboard menampilkan data tiket & inventaris dari database
3. Tickets page menampilkan data real dari Supabase
4. Inventory page menampilkan data real dari Supabase
5. Tidak ada error runtime terkait async data fetching
6. Mock data tidak bocor ke production UI
