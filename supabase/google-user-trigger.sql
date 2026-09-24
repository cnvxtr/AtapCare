-- ============================================================
-- Provisioning profil otomatis untuk user baru dari auth.users
-- (dipakai oleh login Google: "login = daftar" bila belum punya akun)
--
-- SELARAS dengan supabase/migrations/54_register_upsert_fix.sql —
-- isi fungsi di bawah sama persis dengan versi di migrasi tersebut.
--
-- CARA PAKAI:
--   Supabase Dashboard → SQL Editor → paste seluruh isi file → Run.
--   Idempoten: aman dijalankan ulang.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, username, role, roles, status, default_role)
  values (
    new.id,
    -- Nama dari profil Google; cadangan: bagian depan email
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    -- Username unik sederhana: nama/email yang dibersihkan + potongan UUID
    left(
      regexp_replace(
        coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1)),
        '[^a-zA-Z0-9_]', '', 'g'
      ), 20
    ) || '_' || left(new.id::text, 6),
    'customer', 'customer', 'aktif', 'customer'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- CATATAN PENYESUAIAN:
-- 1. Kalau tabel users punya kolom NOT NULL lain yang tidak tercantum di INSERT,
--    pesan error Supabase akan menyebutkan nama kolomnya — tambahkan dengan nilai wajar.
-- 2. Google tidak memberikan nomor telepon — pengguna bisa mengisinya
--    kemudian lewat halaman Profil.
