-- ============================================================================
-- Menjadikan sebuah akun sebagai ADMIN.
--
-- PENTING: akun harus SUDAH mendaftar lewat aplikasi terlebih dahulu, supaya
-- barisnya ada di auth.users + public.profiles. Baru jalankan perintah ini di
-- Supabase Dashboard → SQL Editor. Ganti email di bawah dengan email akunmu.
-- ============================================================================

update public.profiles
set role = 'admin'
where email = 'kamu@email.com';

-- Cek hasilnya (opsional): pastikan role sudah 'admin'.
select id, email, role
from public.profiles
where email = 'kamu@email.com';

-- ----------------------------------------------------------------------------
-- Melepas status admin (kembalikan ke user biasa):
--   update public.profiles set role = 'user' where email = 'kamu@email.com';
--
-- Melihat semua admin:
--   select email, role from public.profiles where role = 'admin';
-- ----------------------------------------------------------------------------
