-- Daftarkan tabel yang dipakai Realtime postgres_changes:
-- #1 ticket_assignments (dukungan support ditugaskan PM -> muncul instan di app)
-- #2 notifications (notifikasi baru -> chime/badge instan, tanpa nunggu 30 dtk)
-- Idempoten: aman dijalankan berulang.

do $$
begin
  if not exists (
    select 1 from pg_publication_rel r
      join pg_publication p on p.oid = r.prpubid
     where p.pubname = 'supabase_realtime'
       and r.prrelid = 'public.ticket_assignments'::regclass
  ) then
    alter publication supabase_realtime add table public.ticket_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_rel r
      join pg_publication p on p.oid = r.prpubid
     where p.pubname = 'supabase_realtime'
       and r.prrelid = 'public.notifications'::regclass
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;