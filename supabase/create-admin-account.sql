-- ============================================================================
-- Membuat akun ADMIN langsung dari SQL:
--   email    : ahmadadptr@gmail.com
--   password : bagas123#
--   role     : admin (email langsung ditandai terkonfirmasi)
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Butuh schema.sql sudah dijalankan
-- (tabel public.profiles + kolom role) dan ekstensi pgcrypto aktif.
--
-- PERINGATAN KEAMANAN: file ini berisi password asli. Jangan commit ke git,
-- dan sebaiknya ganti passwordnya lewat aplikasi setelah berhasil login.
--
-- Bersifat idempoten: kalau email sudah ada, script hanya memperbarui
-- password + role (tidak menggandakan user).
-- ============================================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'ahmadadptr@gmail.com';

  if uid is null then
    -- ---- Buat user baru di auth.users --------------------------------------
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid, 'authenticated', 'authenticated', 'ahmadadptr@gmail.com',
      crypt('bagas123#', gen_salt('bf')),  -- password ter-hash bcrypt
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    );

    -- Identity email (dibutuhkan GoTrue untuk login email/password).
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid,
      jsonb_build_object(
        'sub', uid::text,
        'email', 'ahmadadptr@gmail.com',
        'email_verified', true
      ),
      'email', 'ahmadadptr@gmail.com',
      now(), now(), now()
    );
  else
    -- ---- User sudah ada: perbarui password & pastikan terkonfirmasi --------
    update auth.users
    set encrypted_password = crypt('bagas123#', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = uid;
  end if;

  -- ---- Pastikan profil ada dan role = admin --------------------------------
  insert into public.profiles (id, email, role)
  values (uid, 'ahmadadptr@gmail.com', 'admin')
  on conflict (id) do update
    set role = 'admin', email = excluded.email;
end $$;

-- Verifikasi hasil:
select u.id, u.email, u.email_confirmed_at, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'ahmadadptr@gmail.com';
