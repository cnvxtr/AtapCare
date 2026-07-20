# migrate-dashboard-to-services - Work Plan

## TL;DR (For humans)

**What you'll get:** Semua halaman dashboard (`/app`, `/app/tickets`, `/app/inventory`, `/app/technicians`) akan menggunakan service layer (`@/services`) sebagai satu-satunya sumber data, bukan langsung dari `@/lib/mock-data`. Halaman `/app` juga akan mendapat auth guard — user yang belum login otomatis dialihkan ke `/login`.

**Why this approach:** Import dari barrel `@/services` artinya ketika nanti mock data diganti Supabase, cukup ganti isi service — **UI tidak perlu diutak-atik sama sekali**. Auth guard via `beforeLoad` + `redirect` adalah standar TanStack Router, berjalan sebelum komponen render (tidak ada flash halaman terproteksi).

**What it will NOT do:** Tidak menambah fitur baru (logout button, role-based sidebar filtering, dll). Tidak mengubah logika rendering — hanya path import. Tidak menyentuh halaman client (`/`, `/report`, `/track`, `/login`).

**Effort:** Quick (5 file, satu baris import per file + satu blok auth guard)
**Risk:** Low — semua perubahan reversible, tidak ada perubahan perilaku

**Decisions to sanity-check:** Auth guard redirect ke `/login` jika session tidak ada. User yang sudah login tapi akses `/app` akan masuk ke dashboard (tidak ada role-based routing ke sub-halaman — semua role bisa lihat semua halaman dashboard).

Your next move: approve plan, atau jalankan `/start-work`.

---

> TL;DR (machine): Quick effort, Low risk — migrate 4 dashboard pages from `@/lib/mock-data` to `@/services` + add auth guard to `/app` layout route.

## Scope
### Must have
- `src/routes/app.tsx` — tambah `beforeLoad` auth guard dengan `getSession()` + `redirect` ke `/login`
- `src/routes/app.index.tsx` — ganti import dari `@/lib/mock-data` ke `@/services`
- `src/routes/app.tickets.tsx` — ganti import dari `@/lib/mock-data` ke `@/services`
- `src/routes/app.inventory.tsx` — ganti import dari `@/lib/mock-data` ke `@/services`
- `src/routes/app.technicians.tsx` — ganti import dari `@/lib/mock-data` ke `@/services`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ Tidak mengubah `app.reports.tsx` atau `app.settings.tsx` (tidak ada import mock-data)
- ❌ Tidak mengubah `src/lib/mock-data.ts` atau `src/lib/demo-accounts.ts`
- ❌ Tidak menambah fitur logout, role-based nav visibility, atau dynamic user di sidebar
- ❌ Tidak mengubah logika rendering/JSX — **hanya** path import
- ❌ Tidak menyentuh client routes (`index.tsx`, `report.tsx`, `track.tsx`, `login.tsx`)

## Verification strategy
> Zero human intervention — all verification is agent-executed.
- Test decision: tests-after — grep-based import verification + manual QA by reading the files
- Evidence: `.omo/evidence/migrate-dashboard-to-services/` (attempt dir)

## Execution strategy
### Parallel execution waves
> Single wave — all 5 todos are independent (different files, no dependencies).

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. auth guard | none | none | 2, 3, 4, 5 |
| 2. app.index.tsx | none | none | 1, 3, 4, 5 |
| 3. app.tickets.tsx | none | none | 1, 2, 4, 5 |
| 4. app.inventory.tsx | none | none | 1, 2, 3, 5 |
| 5. app.technicians.tsx | none | none | 1, 2, 3, 4 |
| 6. verify | 1-5 | none | none |

## Todos
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. `src/routes/app.tsx` — Tambah auth guard via `beforeLoad`
  What to do / Must NOT do: Ganti isi file dari bare `<Outlet />` menjadi layout route dengan `beforeLoad` yang memanggil `getSession()`. Jika session null, `throw redirect({ to: "/login" })`. Import `getSession` dari `@/services` dan `redirect` dari `@tanstack/react-router`. **Jangan** ubah `component` — tetap `<Outlet />`.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 6
  References (executor has NO interview context):
    - `src/routes/app.tsx:1-5` — current file content (5 lines, bare Outlet)
    - `src/services/auth.ts:33-37` — `getSession()` reads `localStorage.getItem("atap-care:session")`, returns `Session | null`
    - TanStack Router `beforeLoad` pattern: `beforeLoad: () => { ... throw redirect({ to: "/login" }); }`
  Acceptance criteria (agent-executable): File `src/routes/app.tsx` contains `import { getSession } from "@/services"`, contains `import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"`, contains `beforeLoad` that calls `getSession()` and throws `redirect({ to: "/login" })` when session is null.
  QA scenarios: Read `src/routes/app.tsx` — confirm auth guard present and `Outlet` still rendered. Evidence: `.omo/evidence/migrate-dashboard-to-services/task-1-auth-guard.txt`
  Commit: Y | feat(app): add auth guard to /app layout route

- [ ] 2. `src/routes/app.index.tsx` — Ganti import ke `@/services`
  What to do / Must NOT do: Ganti baris `import { kpiData, tickets, workloadData, trendData, statusColors, priorityColors } from "@/lib/mock-data";` menjadi `import { kpiData, getTickets, workloadData, trendData, statusColors, priorityColors } from "@/services";`. Ubah semua referensi `tickets` (variabel) menjadi `getTickets()` (function call) di dalam komponen — `const active = getTickets().filter(...)` etc. **Jangan** ubah rendering logic.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 6
  References:
    - `src/routes/app.index.tsx:4` — current import line
    - `src/routes/app.index.tsx:12` — `tickets.filter(...)` usage
    - `src/services/index.ts:14-19` — re-exports `getTickets, kpiData, workloadData, trendData, statusColors, priorityColors`
    - `src/services/tickets.ts:23-26` — `getTickets()` returns `_mockTickets` array
  Acceptance criteria: No references to `@/lib/mock-data` in the file. `getTickets()` is called as a function. All existing UI renders identically.
  QA scenarios: `grep("@/lib/mock-data" src/routes/app.index.tsx)` returns empty. `grep("getTickets()" src/routes/app.index.tsx)` returns at least 1 match. Evidence: task-2-dashboard-index.txt
  Commit: Y | feat(dashboard): migrate index to service layer

- [ ] 3. `src/routes/app.tickets.tsx` — Ganti import ke `@/services`
  What to do / Must NOT do: Ganti baris `import { tickets as allTickets, statusColors, priorityColors, type TicketStatus } from "@/lib/mock-data";` menjadi `import { getTickets, statusColors, priorityColors, type TicketStatus } from "@/services";`. Ubah semua `allTickets` menjadi `getTickets()` — di `const filtered = getTickets().filter(...)`. **Jangan** ubah kanban/list rendering.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 6
  References:
    - `src/routes/app.tickets.tsx:4` — current import
    - `src/routes/app.tickets.tsx:17` — `allTickets.filter(...)` usage
    - `src/services/index.ts` — re-exports `getTickets, statusColors, priorityColors, type TicketStatus`
  Acceptance criteria: No `@/lib/mock-data` references. `getTickets()` called as function.
  QA scenarios: grep-based verification. Evidence: task-3-dashboard-tickets.txt
  Commit: Y | feat(tickets): migrate to service layer

- [ ] 4. `src/routes/app.inventory.tsx` — Ganti import ke `@/services`
  What to do / Must NOT do: Ganti baris `import { inventory } from "@/lib/mock-data";` menjadi `import { getInventory } from "@/services";`. Ubah semua referensi `inventory` (variabel) menjadi `getInventory()` (function call) — di `const lowStock = getInventory().filter(...)`, `const totalQuarantine = getInventory().reduce(...)`, `const totalStock = getInventory().reduce(...)`, `getInventory().length`, dan di JSX map. **Jangan** ubah rendering.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 6
  References:
    - `src/routes/app.inventory.tsx:3` — current import
    - `src/routes/app.inventory.tsx:12-14` — `inventory.filter`, `inventory.reduce` usage
    - `src/routes/app.inventory.tsx:27` — `inventory.length` usage
    - `src/routes/app.inventory.tsx:67` — `inventory.map(...)` in JSX
    - `src/services/index.ts` — re-exports `getInventory`
  Acceptance criteria: No `@/lib/mock-data` references. All `inventory` variable usages replaced with `getInventory()`.
  QA scenarios: grep-based verification. Evidence: task-4-dashboard-inventory.txt
  Commit: Y | feat(inventory): migrate to service layer

- [ ] 5. `src/routes/app.technicians.tsx` — Ganti import ke `@/services`
  What to do / Must NOT do: Ganti baris `import { workloadData } from "@/lib/mock-data";` menjadi `import { workloadData } from "@/services";`. **Jangan** ubah roles data atau rendering — `workloadData` adalah array statik yang di-re-export.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 6
  References:
    - `src/routes/app.technicians.tsx:3` — current import
    - `src/routes/app.technicians.tsx:17` — `workloadData.map(...)` usage
    - `src/services/index.ts` — re-exports `workloadData`
  Acceptance criteria: No `@/lib/mock-data` references. File imports `workloadData` from `@/services`.
  QA scenarios: grep-based verification. Evidence: task-5-dashboard-technicians.txt
  Commit: Y | feat(technicians): migrate to service layer

- [ ] 6. Verifikasi akhir — pastikan tidak ada dashboard page yang masih import `@/lib/mock-data`
  What to do / Must NOT do: Jalankan grep untuk memastikan tidak ada file di `src/routes/app*.tsx` yang masih import dari `@/lib/mock-data`. Verifikasi bahwa semua import dari `@/services` memuat simbol yang dibutuhkan. Baca `src/services/index.ts` dan pastikan semua simbol yang di-import di routes tersedia di barrel export.
  Parallelization: Wave 1 (final) | Blocked by: 1-5 | Blocks: none
  References:
    - `src/routes/app.index.tsx`, `app.tickets.tsx`, `app.inventory.tsx`, `app.technicians.tsx` — all should be clean
    - `src/services/index.ts` — barrel export
  Acceptance criteria: `grep -r "@/lib/mock-data" src/routes/app*.tsx` returns empty. TypeScript compiles without errors.
  QA scenarios: grep verification + manual read of each file. Evidence: task-6-verification.txt
  Commit: N (verification only)

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — every file in Scope IN was modified; no file in Scope OUT was touched
- [ ] F2. Code quality review — no `@/lib/mock-data` imports remain in `src/routes/app*.tsx`; all `@/services` imports resolve to existing symbols
- [ ] F3. Real manual QA — browse `/app` after login, verify dashboard renders correctly; test unauthenticated access redirects to `/login`
- [ ] F4. Scope fidelity — no rendering logic changes, no new features, no changes to client routes

## Commit strategy
Single atomic commit: `feat(dashboard): migrate all pages to service layer + add auth guard`
- Includes all 5 modified files
- No new files created
- No dependencies added

## Success criteria
1. `grep -r "@/lib/mock-data" src/routes/app*.tsx` returns empty
2. All `app.*.tsx` files import from `@/services`
3. `src/routes/app.tsx` has auth guard that redirects to `/login`
4. Unauthenticated user visiting `/app` is redirected to `/login`
5. Authenticated user visiting `/app` sees dashboard normally
6. No rendering regressions in any dashboard page
