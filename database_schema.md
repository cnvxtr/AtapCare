# AtapCare — Database Schema

> Reconstructed from 57 migration files. Reflects **final** state after all `CREATE OR REPLACE` and `ALTER TABLE`.

## Extensions

| Extension | Purpose |
|-----------|---------|
| `pg_cron` | Scheduled jobs (auto-close, PII cleanup, pending alarm, activity cleanup) |
| `pg_net` | HTTP requests from DB (push webhook trigger) |

---

## Tables

### `users`

Extended from Supabase auth.users.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | — | PK, FK → auth.users(id) |
| email | text | — | |
| full_name | text | — | |
| username | text | — | UNIQUE (lower(username)) |
| role | text | — | Active role |
| roles | text | NULL | CSV of all roles (e.g. `"admin,teknisi"`) |
| default_role | text | `'customer'` | |
| status | text | `'aktif'` | NOT NULL |
| wa_number | text | NULL | |
| avatar_url | text | NULL | |
| customer_id | uuid | NULL | FK → customers(id) ON DELETE SET NULL |
| must_change_password | boolean | `false` | NOT NULL |
| is_deleted | boolean | `false` | NOT NULL |
| last_login | timestamptz | — | |
| created_at | timestamptz | — | |
| updated_at | timestamptz | `now()` | |

**RLS:** anon SELECT(email), authenticated SELECT(all), self UPDATE(last_login, full_name, name, username, wa_number, avatar_url)

---

### `tickets`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| code | text | — | NOT NULL |
| customer | text | — | Customer name (legacy string) |
| company | text | — | |
| site | text | — | Site name (legacy string, NOT FK) |
| unit | text | — | Unit name (legacy string, NOT FK) |
| location | text | — | |
| description | text | — | |
| status | text | — | State machine |
| priority | text | NULL | `Critical` / `Medium` / `Low` |
| category | text | — | Legacy text category |
| category_id | uuid | NULL | FK → problem_categories(id) |
| root_cause_id | uuid | NULL | FK → root_causes(id) |
| root_cause_note | text | NULL | |
| assigned_to | uuid | NULL | FK → users(id) — lead technician |
| created_by | text | — | Reporter name |
| created_by_user_id | uuid | NULL | FK → users(id) ON DELETE SET NULL |
| photo_url | text | NULL | |
| bapp_document_url | text | NULL | |
| rejection_reason | text | NULL | |
| rework_flag | boolean | `false` | |
| rating | int | NULL | 1-5 |
| review | text | NULL | |
| frt_minutes | numeric | NULL | First Response Time |
| confirm_sent_at | timestamptz | NULL | WA confirmation sent |
| closed_at | timestamptz | NULL | |
| duplicate_of | uuid | NULL | FK → tickets(id) |
| pending_alarm_sent_at | timestamptz | NULL | |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

**Status state machine:** `NEW → OPEN → UNASSIGNED → SCHEDULED → EN_ROUTE → WORKING → PENDING → RESOLVED → CLOSED`. Also: `VOID`, `DUPLICATE`, `REJECTED`.

**RLS:** technicians see own/assigned tickets; admin/helpdesk/pm see all; customer sees own (via created_by_user_id); executive sees all; anon INSERT only.

---

### `activities`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| ticket_id | uuid | — | FK → tickets(id) ON DELETE CASCADE |
| user_id | uuid | NULL | FK → users(id) |
| user_name | text | `''` | |
| action | text | — | NOT NULL |
| details | text | NULL | |
| created_at | timestamptz | `now()` | NOT NULL |

---

### `customers`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| code | text | NULL | |
| address | text | NULL | |
| phone | text | NULL | |
| pic_name | text | NULL | |
| pic_phone | text | NULL | |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

---

### `regions`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| customer_id | uuid | NULL | FK → customers(id) ON DELETE SET NULL |
| name | text | — | NOT NULL |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |

---

### `sites`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| customer_id | uuid | NULL | FK → customers(id) ON DELETE SET NULL |
| region_id | uuid | NULL | FK → regions(id) ON DELETE SET NULL |
| pic_name | text | — | NOT NULL |
| pic_phone | text | — | NOT NULL |
| address | text | NULL | |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

---

### `units`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| site_id | uuid | — | FK → sites(id) ON DELETE CASCADE |
| serial_number | text | NULL | |
| type | text | NULL | |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

---

### `customer_sites_mapping`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| customer_id | uuid | — | FK → customers(id) ON DELETE CASCADE |
| site_id | uuid | — | FK → sites(id) ON DELETE CASCADE |
| created_at | timestamptz | `now()` | NOT NULL |

**Constraint:** `UNIQUE(customer_id, site_id)`

---

### `ticket_assignments`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| ticket_id | uuid | — | FK → tickets(id) ON DELETE CASCADE |
| user_id | uuid | — | FK → users(id) |
| role | text | `'teknisi'` | CHECK IN (`lead`, `teknisi`) |
| created_at | timestamptz | `now()` | NOT NULL |

**PK:** `(ticket_id, user_id)`

---

### `ticket_gps`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| ticket_id | uuid | — | FK → tickets(id) ON DELETE CASCADE |
| user_id | uuid | — | FK → users(id) |
| lat | double precision | — | CHECK BETWEEN -90 AND 90 |
| lon | double precision | — | CHECK BETWEEN -180 AND 180 |
| phase | text | — | CHECK IN (`start`, `end`) |
| captured_at | timestamptz | `now()` | NOT NULL |

---

### `ticket_status_history`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | bigint | GENERATED ALWAYS AS IDENTITY | PK |
| ticket_id | uuid | — | FK → tickets(id) ON DELETE CASCADE |
| old_status | text | NULL | |
| new_status | text | — | NOT NULL |
| by_user | uuid | NULL | FK → users(id) |
| changed_at | timestamptz | `now()` | NOT NULL |

---

### `notifications`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| user_id | uuid | — | FK → users(id) ON DELETE CASCADE |
| title | text | — | NOT NULL |
| message | text | `''` | NOT NULL |
| read | boolean | `false` | NOT NULL |
| push | boolean | `true` | NOT NULL |
| ticket_id | uuid | NULL | FK → tickets(id) ON DELETE SET NULL |
| created_at | timestamptz | `now()` | NOT NULL |

**RLS:** owner SELECT/UPDATE only.

---

### `push_subscriptions`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| user_id | uuid | — | FK → users(id) ON DELETE CASCADE |
| endpoint | text | — | NOT NULL, UNIQUE |
| keys_p256dh | text | — | NOT NULL |
| keys_auth | text | — | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |

**RLS:** own user_id only.

---

### `problem_categories`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

**RLS:** all (anon + authenticated) full access.

---

### `root_causes`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| is_deleted | boolean | `false` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |
| updated_at | timestamptz | `now()` | |

**RLS:** all full access.

---

### `holidays`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| name | text | — | NOT NULL |
| date | date | — | NOT NULL, UNIQUE |
| is_active | boolean | `true` | NOT NULL |
| kind | text | `'holiday'` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |

---

### `audit_logs`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| actor_name | text | NULL | |
| action | text | — | NOT NULL |
| entity_type | text | NULL | |
| entity_id | text | NULL | |
| metadata | jsonb | `'{}'` | NOT NULL |
| created_at | timestamptz | `now()` | NOT NULL |

**RLS:** authenticated INSERT; admin/helpdesk/pm SELECT.

---

### `rate_limits`

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| key | text | — | PK |
| window_start | timestamptz | — | NOT NULL |
| count | int | — | NOT NULL |

No RLS — REVOKE ALL from anon/authenticated; access via RPC only.

---

## Data Relationships

```
customers ──→ regions ──→ sites ──→ units
                          │
                          ├─────→ tickets (by site NAME, not FK — legacy)
                          │
                          └─────→ customer_sites_mapping ←── customers

tickets ──→ activities (timeline)
tickets ──→ ticket_assignments ──→ users (lead + support)
tickets ──→ ticket_gps (tracking)
tickets ──→ ticket_status_history (audit)
tickets ──→ problem_categories (FK)
tickets ──→ root_causes (FK)
tickets ──→ tickets (duplicate_of self-FK)

users ──→ notifications
users ──→ push_subscriptions
users ──→ customers (customer_id FK)
```

---

## Functions (RPCs)

### Ticket Lifecycle

| Function | Signature | Purpose |
|----------|-----------|---------|
| `create_public_ticket` | `(p_reporter_name, p_position, p_phone, p_site, p_unit, p_description, p_photos[]) → json` | Create ticket from public portal (SECURITY DEFINER) |
| `create_internal_ticket` | `(p_code, p_customer, p_company, p_site, p_unit, p_status, p_priority, p_description, p_activity_action, p_activity_details, p_category?, p_location?, p_photo_url?) → tickets` | Create ticket internally |
| `update_ticket_status` | `(p_ticket_id, p_new_status, p_new_priority?, p_resolved_by?, p_rejection_reason?, p_activity_action?, p_activity_details?, p_duplicate_of?) → void` | Main state machine transition + notifications |
| `assign_ticket` | `(p_ticket_id, p_technician_id, p_activity_action?, p_activity_details?, p_support_ids[]?) → void` | Assign/reassign ticket (PM only) |
| `set_ticket_catalog` | `(p_ticket_id, p_category_id?, p_root_cause_id?, p_root_cause_note?) → void` | Set problem category + root cause |
| `submit_rating` | `(p_ticket_id, p_rating, p_review?) → json` | Customer rates resolved ticket (1-5) |
| `set_confirm_sent` | `(p_ticket_id) → void` | Mark WA confirmation sent (triggers 24h auto-close) |
| `set_frt_on_open` | `(p_ticket_id) → void` | Calculate FRT on NEW→OPEN transition |
| `record_gps` | `(p_ticket_id, p_lat, p_lon, p_phase) → void` | Record GPS (technicians) |
| `add_team_note` | `(p_ticket_id, p_details, p_action?) → void` | Support tech adds note |
| `get_ticket_for_tracking` | `(p_code) → json` | Public ticket tracking |
| `get_public_timeline` | `(p_code) → json` | Public guest timeline |

### Backup/Reassignment

| Function | Signature | Purpose |
|----------|-----------|---------|
| `request_backup` | `(p_ticket_id, p_reason?) → void` | Tech requests lead handover |
| `approve_backup` | `(p_ticket_id) → void` | PM approves swap |
| `reject_backup` | `(p_ticket_id) → void` | PM rejects swap |
| `get_backup_request` | `(p_ticket_id) → json` | Get pending request |

### User Management

| Function | Signature | Purpose |
|----------|-----------|---------|
| `admin_save_user` | `(p_id, p_email, p_username, p_name, p_wa_number, p_role, p_status, p_roles?) → json` | Admin create/update user |
| `admin_delete_user` | `(p_id) → json` | Soft-delete user (blocks if active tickets) |
| `switch_role` | `(p_role) → json` | Switch active role |
| `register_customer` | `(p_name, p_email, p_phone, p_user_id) → json` | Customer self-registration |
| `is_username_available` | `(p_username) → boolean` | Check username uniqueness |

### SLA & Calculations

| Function | Signature | Purpose |
|----------|-----------|---------|
| `working_minutes_between` | `(p_from, p_to) → numeric` | Working hours (08-17 WIB, Mon-Fri, skip holidays) |
| `sla_elapsed_working_minutes` | `(p_from, p_to) → numeric` | Wrapper → working_minutes_between (backward compat) |

### Notifications

| Function | Signature | Purpose |
|----------|-----------|---------|
| `notify_user` | `(p_uid, p_title, p_message) → void` | Notify single user |
| `notify_role` | `(p_role, p_title, p_message, p_ticket_id?) → void` | Notify all users with role (incl. CSV roles) |
| `pending_alarm` | `() → integer` | Notify on PENDING > 48h |

### Reports & Stats

| Function | Signature | Purpose |
|----------|-----------|---------|
| `get_landing_stats` | `() → json` | Public portal statistics |
| `get_sites_for_report` | `() → json` | Sites/units for public report form |

### Utilities

| Function | Signature | Purpose |
|----------|-----------|---------|
| `validate_transition` | `(p_role, p_from, p_to) → boolean` | State machine validation |
| `can_teknisi_complete` | `(p_ticket_id, p_uid) → boolean` | Check if tech can complete |
| `mask_pii` | `() → integer` | Anonymize PII per UU PDP |
| `cleanup_rate_limits` | `() → void` | Delete stale rate limits |
| `cleanup_old_activities` | `() → void` | Delete activities/audit_logs > 6 months |
| `auto_close_unconfirmed` | `() → integer` | Close RESOLVED tickets after 24h without confirmation |

---

## Storage Buckets

| Bucket | Public | Size Limit | MIME Types |
|--------|--------|------------|------------|
| `ticket-photos` | false | 10MB | jpeg, png, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, rar, mp4, mov, webm |
| `avatars` | false | 2MB | jpeg, png, webp |

**Policies:** authenticated can CRUD own folder; anon INSERT to `ticket-photos/guest/` only; anon SELECT from ticket-photos where file referenced in pending activity.

---

## Triggers

| Table | Trigger | Function | When |
|-------|---------|----------|------|
| tickets | `trg_ticket_status_change` | `log_ticket_status_change()` | BEFORE UPDATE OF status |
| notifications | `trg_push_webhook` | `notify_push_webhook()` | AFTER INSERT |
| auth.users | `on_auth_user_created` | `handle_new_auth_user()` | AFTER INSERT |

---

## pg_cron Jobs

| Job | Schedule | Function | Purpose |
|-----|----------|----------|---------|
| `atapcare-auto-close` | Hourly | `auto_close_unconfirmed()` | Close RESOLVED > 24h |
| `atapcare-rate-limit-cleanup` | Daily 04:00 UTC | `cleanup_rate_limits()` | Clean stale rate limits |
| `atapcare-pii-retention` | Daily 02:00 WIB | `mask_pii()` | PII anonymization (UU PDP) |
| `atapcare-pending-alarm` | Hourly | `pending_alarm()` | Alert on PENDING > 48h |
| `atapcare-activity-cleanup` | Monthly 1st 10:00 WIB | `cleanup_old_activities()` | Delete old activities/audit |

---

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| users | `users_username_lower_key` | (lower(username)) UNIQUE |
| users | `idx_users_customer_id` | (customer_id) |
| tickets | `idx_tickets_category` | (category_id) |
| tickets | `idx_tickets_root_cause` | (root_cause_id) |
| tickets | `idx_tickets_duplicate_of` | (duplicate_of) |
| tickets | `idx_tickets_created_by_user` | (created_by_user_id) |
| tickets | `idx_tickets_frt` | (frt_minutes) WHERE frt_minutes IS NOT NULL |
| notifications | `idx_notifications_user_read` | (user_id, read, created_at DESC) |
| ticket_assignments | `idx_ticket_assignments_user` | (user_id) |
| ticket_gps | `idx_ticket_gps_ticket` | (ticket_id) |
| ticket_status_history | `idx_ticket_status_history` | (ticket_id, changed_at) |
| push_subscriptions | `idx_push_subscriptions_user` | (user_id) |
| customer_sites_mapping | `idx_customer_sites_customer` | (customer_id) |
| customer_sites_mapping | `idx_customer_sites_site` | (site_id) |
