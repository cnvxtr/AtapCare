---
slug: migrate-dashboard-to-services
status: approved
intent: clear
pending-action: write .omo/plans/migrate-dashboard-to-services.md
approach: Migrate all 6 dashboard-related route files from direct @/lib/mock-data imports to the new @/services layer, and add auth guard to the /app layout route.
---

# Draft: migrate-dashboard-to-services

## Components (topology ledger)
| id | outcome | status | evidence |
|---|---|---|---|
| auth-guard | app.tsx redirects unauthenticated users to /login | active | src/routes/app.tsx:1-5 |
| dashboard-index | app.index.tsx imports kpiData/tickets/workloadData/trendData/statusColors/priorityColors from @/services | active | src/routes/app.index.tsx:4 |
| dashboard-tickets | app.tickets.tsx imports allTickets/statusColors/priorityColors/TicketStatus from @/services | active | src/routes/app.tickets.tsx:4 |
| dashboard-inventory | app.inventory.tsx imports inventory from @/services | active | src/routes/app.inventory.tsx:3 |
| dashboard-technicians | app.technicians.tsx imports workloadData from @/services | active | src/routes/app.technicians.tsx:3 |
| app-shell | app-shell.tsx shows hardcoded user "Kustiara" — wire to getSession() for dynamic user display | deferred | src/components/app-shell.tsx:78 |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Auth guard uses beforeLoad + redirect to /login | Use getSession() from @/services | Service layer wraps localStorage, matches existing session pattern | Yes |
| app-shell user display stays hardcoded for now | Deferred | Requires more context about role-based sidebar behavior; current task is import migration only | Yes |

## Findings (cited - path:lines)
- `src/routes/app.index.tsx:4` imports: `kpiData, tickets, workloadData, trendData, statusColors, priorityColors` from `@/lib/mock-data`
- `src/routes/app.tickets.tsx:4` imports: `tickets as allTickets, statusColors, priorityColors, type TicketStatus` from `@/lib/mock-data`
- `src/routes/app.inventory.tsx:3` imports: `inventory` from `@/lib/mock-data`
- `src/routes/app.technicians.tsx:3` imports: `workloadData` from `@/lib/mock-data`
- `src/routes/app.reports.tsx` — no mock-data imports (all hardcoded data), no migration needed
- `src/routes/app.settings.tsx` — no mock-data imports (all hardcoded data), no migration needed
- `src/routes/app.tsx:4` currently exports bare `<Outlet />` with no auth check
- `src/services/index.ts` re-exports all: `getTickets, getTicketByCode, filterTickets, getTicketStats, getTechnicians, getLocations, getAllLocations, statusColors, priorityColors, kpiData, workloadData, trendData, getSession, hasRole, getInventory, getInventoryItem, filterInventory, getInventoryStats, getInventoryCategories, getDemoAccounts, login, quickLogin, logout`
- `src/services/auth.ts` exports `getSession()` which reads from `localStorage.getItem("atap-care:session")`
- `src/services/tickets.ts` re-exports `statusColors, priorityColors, kpiData, workloadData, trendData` from mock-data (UI display helpers)
- `src/services/tickets.ts` exports `getTickets()` returning `Ticket[]`
- `src/services/inventory.ts` exports `getInventory()` returning `InventoryItem[]`

## Decisions (with rationale)
- **Use `import { ... } from "@/services"` instead of individual service imports** — barrel export keeps import lines clean and the migration surface small (one line change per file).
- **Auth guard via `beforeLoad` + `throw redirect()`** — TanStack Router's standard pattern; runs before any component renders, preventing flash of protected content.
- **Deferred: app-shell dynamic user** — the sidebar currently hardcodes "Kustiara / Helpdesk". Wiring it to `getSession()` requires also adding a logout button and handling role-based nav visibility. This is a separate, larger task.

## Scope IN
- `src/routes/app.tsx` — add auth guard
- `src/routes/app.index.tsx` — swap import from `@/lib/mock-data` to `@/services`
- `src/routes/app.tickets.tsx` — swap import from `@/lib/mock-data` to `@/services`
- `src/routes/app.inventory.tsx` — swap import from `@/lib/mock-data` to `@/services`
- `src/routes/app.technicians.tsx` — swap import from `@/lib/mock-data` to `@/services`

## Scope OUT (Must NOT have)
- Must NOT modify `app.reports.tsx` or `app.settings.tsx` (no mock-data imports to migrate)
- Must NOT modify `src/lib/mock-data.ts` or `src/lib/demo-accounts.ts` (source of truth for mock data)
- Must NOT add new features (logout button, role-based sidebar filtering, etc.)
- Must NOT change component rendering logic — only import paths
- Must NOT touch client-facing routes (`index.tsx`, `report.tsx`, `track.tsx`, `login.tsx`)

## Open questions
None — all decisions are mechanical and reversible.

## Approval gate
status: awaiting-approval
