# AtapCare — Project Context

Single source of truth for AI agents working on this codebase.

## Overview

**PT Atap Teknologi Indonesia**. Sistem ticketing keluhan field service untuk produk ATAP/roofing. Seluruh UI dalam Bahasa Indonesia. App ID: `com.atap.atapcare`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19.2 + TypeScript 6.0 |
| Build | Vite 8.1 |
| Styling | Tailwind CSS 3.4 + custom HSL tokens |
| UI | shadcn/ui pattern (Radix UI primitives) |
| Animation | Framer Motion 12.4 |
| Forms | React Hook Form 7.86 + Zod 3.25 |
| Routing | React Router DOM 7.18 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime) |
| Mobile | Capacitor 8.5 (Android) |
| Charts | Recharts 3.10 |
| Export | ExcelJS 4.4 (XLSX) |
| Icons | Lucide React 1.25 |
| Fonts | Inter (body), Space Grotesk (headings), JetBrains Mono (mono) |

**Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`

## Architecture

- Frontend SPA → Supabase backend (no custom API server)
- Auth: username → email resolved server-side via Edge Function (privacy: email never exposed to browser before password verified)
- Ticket lifecycle: RPC-based transitions with server-side role validation
- Push notifications: Web Push VAPID + DB webhook → Edge Function `send-push` (future: native push via Capacitor + FCM)
- In-app notifications: 30-second polling via `getMyNotifications` RPC
- Photo upload: client-side compression → Supabase Storage (`ticket-photos` bucket)

## Roles (6)

| Role | Label | Access |
|------|-------|--------|
| `admin` | Administrator | Users, master data, reports, SLA config |
| `helpdesk` | Helpdesk | Triage, validate, assign priority, reports |
| `pm` | Project Manager | Command center, assign technicians, approve backups |
| `teknisi` | Teknisi Lapangan | Assigned tasks, update status, GPS tracking |
| `customer` | Pelanggan | Submit complaints, view own tickets, rate |
| `executive` | Executive | Read-only dashboards, inbox, reports |

Multi-role: `users.roles` stores CSV (e.g. `"admin,teknisi"`). `switch_role` RPC changes active role.

## Ticket Lifecycle

```
NEW → OPEN → UNASSIGNED → SCHEDULED → EN_ROUTE → WORKING → PENDING → RESOLVED → CLOSED
Also: VOID, DUPLICATE, REJECTED
```

Ticket code format: `ATC-YYYYMMDD-XXXX` (4 random alphanumeric).

Status transitions validated server-side via RPC `update_ticket_status`.

## Directory Structure

```
src/
  App.tsx                         # Route definitions + role gates
  main.tsx                        # Entry: BrowserRouter > AuthProvider > App
  index.css                       # Design system tokens (light/dark) + utilities
  assets/                         # logo.png, logo2.png
  components/
    layout/MainLayout.tsx         # Desktop: sidebar + topbar + notifications
    mobile/
      MobileLayout.tsx            # Mobile: topbar + bottom tabs + sheets
      BottomTabs.tsx              # Role-aware animated tab bar
      SplashScreen.tsx            # Native splash
    ui/                           # shadcn/ui primitives (20 files)
    Badge.tsx                     # Status/priority badge
    TicketDrawer.tsx              # Off-canvas ticket detail (540+ lines)
    Reveal.tsx                    # Scroll-reveal animation wrapper
    TroubleshootCards.tsx         # Landing page troubleshooting steps
    [SiteHeader, SiteFooter, DateRangePicker, FieldError, etc.]
  context/
    AuthContext.tsx                # Auth state, login/logout/register/switchRole
    TicketContext.tsx              # Ticket CRUD, realtime, status transitions
  lib/
    constants.ts                  # Status filter groups
    export.ts                     # CSV/XLSX export utilities
    geocode.ts                    # Reverse geocoding via Nominatim
    pendingAlarm.ts               # PENDING ticket stale alarm (>8h)
    platform.ts                   # isNativePlatform() + useIsMobile()
    pushNotifications.ts          # Web Push subscription + chime audio
    status.ts                     # Field statuses constant
    supabase.ts                   # Supabase client init
    theme.ts                      # Dark/light mode persistence
    types.ts                      # AppRole union + UserStatus
    utils.ts                      # cn() utility (clsx + tailwind-merge)
  pages/
    indexclient.tsx               # Landing page
    Login.tsx                     # Login + Register (599 lines)
    Profile.tsx                   # Profile + avatar upload + logout
    NotFound.tsx, Privacy.tsx, Terms.tsx, ResetPassword.tsx
    Admin/                        # AdminDashboard, AdminUsers, AdminMasterData, AdminReports
    Helpdesk/                     # HPDashboard, HPInbox, HPReport
    Teknisi/                      # Tugas (task list)
    Project_Management/           # PMDashboard, PMCommandCenter
    Customer/                     # CustomerDashboard, CustomerReport, CustomerTicketDetail
    Executive/                    # ExecutiveDashboard, ExecutiveInbox, ExecutiveReport
  services/
    index.ts                      # Re-exports all services
    dashboard.ts                  # Admin dashboard data (FRT, leaderboard, system stats)
    master-data.ts                # Customer/Site/Unit/Region CRUD + catalog + audit
    notifications.ts              # In-app notification read/mark
    photoService.ts               # Image compression + upload + avatars + signed URLs
    reports.ts                    # Ticket/KPI/root-cause/serial-number reports
    ticketService.ts              # Public ticket creation, backup, catalog, GPS, landing stats
    users.ts                      # Technician query, role labels
    wa.ts                         # WhatsApp link generator

supabase/
  functions/
    login-email/                  # Username→email resolution (server-side, privacy)
    admin-create-user/            # Create auth user (no email confirm)
    admin-delete-user/            # Delete auth + profile (blocks if active tickets)
    admin-reset-password/         # Reset password + must_change_password flag
    send-push/                    # Web Push delivery (triggered by DB webhook)
  migrations/
    01-57                         # SQL migration files (incremental schema)
```

## Routing

| Path | Component | Role |
|------|-----------|------|
| `/` | Landing | Public |
| `/login` | Login | Public |
| `/privacy` | Privacy | Public |
| `/terms` | Terms | Public |
| `/reset-password` | ResetPassword | Public |
| `/dashboard` | RoleDashboard | helpdesk, pm |
| `/inbox` | HPInbox | helpdesk |
| `/reports` | HPReport | helpdesk |
| `/tugas` | TugasTeknisi | teknisi |
| `/command-center` | PMCommandCenter | pm |
| `/admin` | AdminDashboard | admin |
| `/admin/users` | AdminUsers | admin |
| `/admin/master-data` | AdminMasterData | admin |
| `/admin/reports` | AdminReports | admin |
| `/customer` | CustomerDashboard | customer |
| `/customer/report` | CustomerReport | customer |
| `/customer/ticket/:ticketCode` | CustomerTicketDetail | customer |
| `/executive` | ExecutiveDashboard | executive |
| `/executive/inbox` | ExecutiveInbox | executive |
| `/executive/reports` | ExecutiveReport | executive |
| `/profile` | Profile | Any authenticated |
| `*` | NotFound | Public |

Layout: `isNativePlatform()` or viewport < 768px → `MobileLayout`; otherwise `MainLayout`.

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles (id=auth.uid, role, roles, status, avatar) |
| `tickets` | Core ticket records (code, customer, site, unit, status, priority, assigned_to) |
| `activities` | Timeline/audit trail per ticket |
| `notifications` | In-app notifications per user |
| `customers` | Customer master data |
| `regions` | Region master data (FK → customers) |
| `sites` | Site master data (FK → customers, regions) |
| `units` | Unit/equipment master data (FK → sites) |
| `ticket_assignments` | Multi-technician assignment (lead + support) |
| `ticket_gps` | GPS tracking points (lat, lon, phase: start/end) |
| `audit_logs` | Admin action audit trail |
| `sla_config` | SLA targets per priority |
| `holidays` | Indonesian national holidays for SLA |
| `problem_categories` | Ticket categorization |
| `root_causes` | Root cause analysis |
| `push_subscriptions` | Web Push device subscriptions |
| `customer_sites_mapping` | Customer-site association |

### RPCs

| RPC | Purpose |
|-----|---------|
| `create_public_ticket` | Public portal ticket creation (SECURITY DEFINER) |
| `create_internal_ticket` | Internal ticket creation by staff |
| `update_ticket_status` | Status transition with role-based validation |
| `assign_ticket` | PM assigns lead + support technicians |
| `admin_save_user` | Admin create/update user profile |
| `register_customer` | Customer self-registration |
| `switch_role` | Switch active role for multi-role users |
| `compute_sla_batch` | Calculate SLA remaining hours (server-side) |
| `set_ticket_catalog` | Set category + root cause |
| `record_gps` | Record GPS point for technician travel |
| `get_landing_stats` | Public portal statistics |
| `set_confirm_sent` | Mark WA confirmation sent (auto-close trigger) |
| `request_backup` / `approve_backup` / `reject_backup` | Backup/reassignment workflow |
| `add_team_note` | Support tech adds note to ticket |
| `submit_rating` | Customer rates resolved ticket |
| `is_username_available` | Check username uniqueness |
| `get_my_notifications` | In-app notification polling |

### Data Relationships

```
customers → regions → sites → units
                         → tickets (by site NAME, not FK — legacy)
tickets → activities (timeline)
tickets → ticket_assignments → users
tickets → ticket_gps (tracking)
tickets → problem_categories (FK)
tickets → root_causes (FK)
users → notifications
users → push_subscriptions
tickets → sla_config (via priority)
holidays → SLA calculation
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `login-email` | Resolves username → email server-side. Password verified before email returned. Deployed to `heqcgbrgagxdljddhxwn`. |
| `admin-create-user` | Creates auth user + profile (email_confirm: true). |
| `admin-delete-user` | Deletes auth + profile. Blocks if active tickets exist. |
| `admin-reset-password` | Resets password + sets `must_change_password` flag. |
| `send-push` | Delivers Web Push notifications. Triggered by DB webhook on `notifications` INSERT with `push=true`. Richer body with ticket code, formatted timestamp (WIB), deep link. |

## Design System

**Theme:** Monochrome Industrial — black, white, gray + minimal semantic accents.

### CSS Variables (HSL)
- **Light:** `--background: 0 0% 98.5%`, `--foreground: 0 0% 14.5%`, `--card: 0 0% 100%`
- **Dark:** `--background: 0 0% 7%`, `--foreground: 0 0% 98.5%`
- **Semantic:** `--destructive` (red), `--success` (green), `--warning` (amber)

### Border-radius Convention
- Buttons: `rounded-[5px]`
- Inputs: `rounded-md`
- Cards: `rounded-lg` / `rounded-2xl`
- Badges: `rounded-md`

### Utility Classes
- `glass` — glassmorphism (backdrop-blur + transparent card)
- `grid-bg` — subtle grid background
- `noise-overlay` — SVG noise texture
- `pulse-ring` — animated red pulse (alerts)
- `drawer-enter` — slide-in animation
- `reveal`, `sweep` — scroll reveal / hover effects

### Layout
- Sidebar: 256px, collapsible to 64px with tooltips
- Header: 64px sticky, backdrop-blur
- Dark mode: class-based toggle, persisted to localStorage

## Conventions

- **Phone numbers:** Always `+62` prefix. `normalizeWaNumber()` in `lib/wa.ts`
- **Ticket code:** `ATC-YYYYMMDD-XXXX`
- **Photos:** Compressed <500KB client-side, storage bucket `ticket-photos` (private)
- **Error handling:** `FieldError` component for form validation
- **Date format:** `DD Mon YYYY, HH:MM` (Indonesian locale)
- **FRT:** Aggregate dashboard metric only. NEVER shown per-ticket.
- **Drawer labels:** "Kendala Pelanggan" and "Dokumentasi" (uppercase monospace)
- **Remote Support:** Auto WA media. Skip kategori/prioritas.
- **Eskalasi ke PM:** Button black bg, requires kategori + prioritas.
- **Push notifications:** Only work on HTTPS. Web push for testing, native via Capacitor later.

## Known Technical Debt

1. **Tickets reference site/unit by NAME not FK** — legacy design. Reports work around with name-matching maps.
2. **Web push unreliable on mobile HTTP** — Chrome blocks notifications from non-HTTPS origins. Will use FCM via `@capacitor/push-notifications` for native app.
3. **pg_net trigger broken** — `app.settings.service_role_key = null` in postgres.conf. DB Webhook used as alternative trigger for push.
4. **Multiple stale push subscriptions** — Each login creates new subscription. Old ones accumulate. Need periodic cleanup.

## Supabase Project

- **Project ID:** `heqcgbrgagxdljddhxwn`
- **Dashboard:** https://supabase.com/dashboard/project/heqcgbrgagxdljddhxwn
- **Storage buckets:** `ticket-photos` (private), `avatars` (private, 2MB limit)
- **Free tier:** Keep-alive ping, daily backups, photo compression policy
